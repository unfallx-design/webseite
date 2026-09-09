'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createPortal}=require('../portal/app'),{createStore}=require('../portal/store'),D=require('../portal/domain'),passwords=require('../portal/passwords'),{createSms,phone}=require('../portal/security');
test('SMS transport uses HTTPS, a header key and one transactional message; rejects ambiguous delivery',async()=>{
 const env={SMS_PROVIDER:'seven',SEVEN_API_KEY:'local-test-api-key'};let request;
 const transport=createSms(env,async(url,options)=>{request={url,options};return {ok:true,json:async()=>({success:'100',messages:[{success:true}]})};});
 assert.equal(phone('0176 12345678'),'+4917612345678');assert.throws(()=>phone('+19001234567'));assert.throws(()=>phone('+4930123456'));
 await transport.send(phone('0176 12345678'),'123456');assert.equal(request.url,'https://gateway.seven.io/api/sms');assert.equal(request.options.headers['X-Api-Key'],env.SEVEN_API_KEY);assert.equal(request.options.redirect,'error');assert.equal(request.options.body.get('ttl'),'5');assert.ok(request.options.body.get('text').length<=160);assert.equal(request.options.body.get('to'),'4917612345678');
 for(const result of [{success:'101'},{success:'100',debug:'true',messages:[{success:true}]},{success:'100',messages:[{success:false}]}])await assert.rejects(createSms(env,async()=>({ok:true,json:async()=>result})).send('+4917612345678','123456'));
});
test('SMS proof, optional 2FA, reset/magic-link bypass prevention, recovery and draft administration',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ux-security6-')),env={NODE_ENV:'test',PORTAL_LOCAL_DB:path.join(dir,'portal.sqlite'),PORTAL_ORIGIN:'http://localhost',PORTAL_TRUST_PROXY:'true',PORTAL_OTP_SECRET:D.random()};
 const mails=[],smsSent=[];let failSms=false;
 const store=await createStore(env),portal=createPortal({env,store,mail:{ready:true,send:async(to,subject,text)=>mails.push({to,subject,text})},sms:{ready:true,send:async(to,code)=>{smsSent.push({to,code});if(failSms)throw Error('LOCAL_PROVIDER_FAILURE');}}});await portal.ready();
 const server=http.createServer((req,res)=>portal.handle(req,res,{}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let ip=0;
 async function call(p,data,u={},extra={}){const response=await fetch(base+'/api/portal'+p,{method:data===undefined?'GET':'POST',headers:{Origin:env.PORTAL_ORIGIN,'Content-Type':'application/json',Cookie:u.cookie||'','X-CSRF-Token':u.csrf||'','X-Forwarded-For':'local-'+(++ip),...extra},body:data===undefined?undefined:JSON.stringify(data)});return {status:response.status,json:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const password='Dieser lokale Test Merksatz bleibt privat!';const encoded=await passwords.encode(password);
 async function actor(name,role,companyId=null){const u={id:D.hash(name+'@example.com'),email:name+'@example.com',name,role,companyId,active:true,verifiedAt:new Date().toISOString(),passwordHash:encoded,phone:''},token=D.random(),csrf=D.random();await store.transaction(async s=>{await s.put('user',u,companyId||'internal');await s.put('session',{id:D.hash(token),userId:u.id,csrf,createdAt:new Date().toISOString(),expires:Date.now()+3600000},u.id);if(companyId)await s.put('company',{id:companyId,name:companyId,status:'approved'});});return {...u,cookie:'ux_session='+token,csrf};}
 const a=await actor('admin','admin'),p=await actor('partner','partner','test-company'),other=await actor('other','appraiser'),staff=await actor('staff','appraiser');
 const resetLimits=()=>store.transaction(async s=>{for(const kind of ['sms_guard','limit'])for(const x of await s.list(kind))await s.remove(kind,x.id);});
 let full=a,recoveryCodes=[];
 try{
 await t.test('Admin can move drafts; partners and assigned employees cannot take over drafts',async()=>{
  const input={vehicle:'Demo',plate:'DEMO',owner:'Test',ownerContact:'example@example.com',accidentDate:'2026-09-09',location:'Berlin',description:'Test',authority:true};
  const c=(await call('/cases',input,p)).json.case;
  await store.transaction(async s=>{const r=await s.get('case',c.id);r.assignee=staff.id;await s.put('case',r,p.companyId);});
  assert.equal((await call('/cases/'+c.id,{action:'status',status:'review',version:c.version},p)).status,403);
  assert.equal((await call('/cases/'+c.id,{action:'status',status:'review',version:c.version},staff)).status,403);
  assert.equal((await call('/cases/'+c.id,{action:'status',status:'review',version:c.version},a)).json.case.status,'review');
  assert.equal((await call('/cases/'+c.id,{action:'status',status:'accepted',version:c.version},a)).status,409);
  for(const from of ['recording','ready_to_submit']){const nc=(await call('/cases',input,p)).json.case;await store.transaction(async s=>{const r=await s.get('case',nc.id);r.status=from;await s.put('case',r,p.companyId);});assert.equal((await call('/cases/'+nc.id,{action:'status',status:'submitted',version:nc.version},a)).json.case.status,'submitted');}
 });
 await t.test('Authenticated SMS only, CSRF, number allowlist, cooldown and persistent five-attempt limit',async()=>{
  assert.equal((await call('/security/phone/send',{phone:'017612345678'})).status,401);
  assert.equal((await call('/security/phone/send',{phone:'017612345678'},a,{'X-CSRF-Token':'bad'})).status,403);
  assert.equal((await call('/security/phone/send',{phone:'+19001234567'},a)).status,400);assert.equal(smsSent.length,0);
  const r=await call('/security/phone/send',{phone:'017612345678'},a);assert.equal(r.status,200);const challenge=r.json.challenge,code=smsSent.at(-1).code;
  assert.equal((await call('/security/phone/send',{phone:'017612345678'},a)).status,429);assert.equal(smsSent.length,1);
  const row=await store.transaction(s=>s.get('sms_challenge',challenge));assert.notEqual(row.proof,code);assert.equal(row.code,undefined);
  assert.equal((await call('/security/phone/verify',{challenge,code},other)).status,400);
  const wrong=code==='000000'?'111111':'000000';for(let n=0;n<5;n++)assert.equal((await call('/security/phone/verify',{challenge,code:wrong},a)).status,400);
  assert.equal((await store.transaction(s=>s.get('sms_challenge',challenge))).attempts,5);
  assert.equal((await call('/security/phone/verify',{challenge,code},a)).status,400);
  await resetLimits();const fresh=await call('/security/phone/send',{phone:'017612345678'},a);const proof={challenge:fresh.json.challenge,code:smsSent.at(-1).code};assert.equal((await call('/security/phone/verify',proof,a)).status,200);assert.equal((await call('/security/phone/verify',proof,a)).status,400);
  assert.equal((await call('/security',undefined,a)).json.security.phoneVerified,true);
 });
 await t.test('Enabling needs fresh phone proof and password; recovery is shown once and never exported',async()=>{
  assert.equal((await call('/security/configure',{action:'enable',confirmed:true,password:'wrong'},a)).status,401);
  const r=await call('/security/configure',{action:'enable',confirmed:true,password},a);assert.equal(r.status,200);recoveryCodes=r.json.recoveryCodes;assert.equal(recoveryCodes.length,8);
  for(const endpoint of ['/me','/export','/admin/overview','/security']){const result=JSON.stringify((await call(endpoint,undefined,a)).json);for(const code of recoveryCodes)assert.ok(!result.includes(code));assert.ok(!result.includes(encoded));}
  const settings=(await call('/settings',undefined,a)).json;
  assert.equal((await call('/settings',{...settings.profile,...settings.preferences,name:'Test',phone:'017612345679',startPage:'start',theme:'light',compact:false,reducedMotion:false},a)).status,400);
 });
 await t.test('Password alone gives a restricted session, SMS completes login once',async()=>{
  const first=await call('/password-login',{email:a.email,password});assert.equal(first.json.mfaRequired,true);assert.equal(first.json.redirect,'/login?factor=1');let pending={cookie:first.cookie};const state=await call('/security/login',undefined,pending);pending.csrf=state.json.csrf;
  for(const endpoint of ['/me','/cases','/admin/overview','/export','/settings'])assert.equal((await call(endpoint,undefined,pending)).status,401);
  await resetLimits();const challenge=await call('/security/login/send',{},pending);const proof={challenge:challenge.json.challenge,code:smsSent.at(-1).code};
  const done=await call('/security/login/verify',proof,pending);assert.equal(done.status,200);assert.notEqual(done.cookie,pending.cookie);full={cookie:done.cookie};full.csrf=(await call('/me',undefined,full)).json.csrf;
  assert.equal((await call('/admin/overview',undefined,full)).status,200);assert.equal((await call('/security/login/verify',proof,pending)).status,401);
 });
 await t.test('Magic links and password reset cannot remove or bypass the second factor',async()=>{
  await call('/login',{email:a.email});const token=mails.at(-1).text.match(/#token=([a-f0-9]{64})/)[1];const magic=await call('/exchange',{token});assert.equal(magic.json.mfaRequired,true);assert.equal((await call('/me',undefined,{cookie:magic.cookie})).status,401);
  await call('/password/request',{email:a.email});const reset=mails.at(-1).text.match(/#token=([a-f0-9]{64})/)[1];assert.equal((await call('/password/finish',{token:reset,password})).status,200);
  assert.equal((await call('/me',undefined,full)).status,401);const first=await call('/password-login',{email:a.email,password});assert.equal(first.json.mfaRequired,true);
  full={cookie:first.cookie};full.csrf=(await call('/security/login',undefined,full)).json.csrf;
 });
 await t.test('Recovery is single-use; forged codes persist attempts; recovery permits safe phone replacement',async()=>{
  const r=await call('/security/login/verify',{recoveryCode:recoveryCodes[0]},full);assert.equal(r.status,200);full={cookie:r.cookie};full.csrf=(await call('/me',undefined,full)).json.csrf;
  const again=await call('/password-login',{email:a.email,password});const pending={cookie:again.cookie};pending.csrf=(await call('/security/login',undefined,pending)).json.csrf;
  for(let n=0;n<5;n++)assert.equal((await call('/security/login/verify',{recoveryCode:recoveryCodes[0]},pending)).status,401);
  assert.equal((await call('/security/login/verify',{recoveryCode:recoveryCodes[1]},pending)).status,401);
  assert.equal((await call('/security/configure',{action:'disable',confirmed:true,password},full)).status,200);
  assert.equal((await call('/password-login',{email:a.email,password})).json.mfaRequired,false);
 });
 await t.test('Expired codes and uncertain delivery never verify; failures still count toward send limits',async()=>{
  await resetLimits();const r=await call('/security/phone/send',{phone:'017612345679'},full);assert.equal(r.status,200);await store.transaction(async s=>{const c=await s.get('sms_challenge',r.json.challenge);c.expires=Date.now()-1;await s.put('sms_challenge',c,a.id);});assert.equal((await call('/security/phone/verify',{challenge:r.json.challenge,code:smsSent.at(-1).code},full)).status,400);
  await resetLimits();failSms=true;assert.equal((await call('/security/phone/send',{phone:'017612345679'},full)).status,503);assert.equal((await call('/security/phone/send',{phone:'017612345679'},full)).status,429);
 });
 }finally{await new Promise(r=>server.close(r));await portal.close();fs.rmSync(dir,{recursive:true,force:true});}
});
