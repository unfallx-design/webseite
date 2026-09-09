'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('../portal/domain'),P=require('../portal/passwords'),hosts=require('../portal/hosts'),{createStore}=require('../portal/store'),{createPortal}=require('../portal/app');
test('Retired private entry points resolve to the two supported workspaces',()=>{
 for(const h of ['unfallx.com','app.unfallx.com','gutachten.unfallx.com']){
  assert.equal(hosts.hostPolicy(h,'/schaden-melden.html?ref=UX-TEST').redirect,hosts.APP_ORIGIN+'/mitglied-werden?ref=UX-TEST');
  assert.equal(hosts.hostPolicy(h,'/kundenportal').redirect,hosts.APP_ORIGIN+'/login');
 }
 assert.equal(hosts.hostPolicy('127.0.0.1:4187','/kundenportal').redirect,'/login');
});
test('Partner-only onboarding and staff invitations enforce roles without deleting legacy case data',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ux-two-areas-')),env={NODE_ENV:'test',PORTAL_LOCAL_DB:path.join(dir,'test.sqlite'),PORTAL_ORIGIN:'http://localhost',PORTAL_TRUST_PROXY:'true'},sent=[];
 const store=await createStore(env),portal=createPortal({env,store,mail:{ready:true,send:async(to,subject,text)=>sent.push({to,subject,text})}});await portal.ready();
 const server=http.createServer((req,res)=>portal.handle(req,res,{}));await new Promise(r=>server.listen(0,'127.0.0.1',r));let sequence=0;
 async function call(p,data,actor={}){const res=await fetch('http://127.0.0.1:'+server.address().port+'/api/portal'+p,{method:data===undefined?'GET':'POST',headers:{Origin:env.PORTAL_ORIGIN,'Content-Type':'application/json','X-Forwarded-For':'fixture-'+(++sequence),...actor},body:data===undefined?undefined:JSON.stringify(data)});return {status:res.status,json:await res.json(),cookie:res.headers.get('set-cookie')};}
 const password='Ein sicherer lokaler Test Merksatz 2026!';
 async function seed(role,address){const user={id:D.hash(address),role,email:address,name:'Local fixture',active:true,verifiedAt:new Date().toISOString(),passwordHash:await P.encode(password)},token=D.random(),csrf=D.random();await store.transaction(async s=>{await s.put('user',user,'internal');await s.put('session',{id:D.hash(token),userId:user.id,csrf,expires:Date.now()+600000,createdAt:new Date().toISOString()},user.id);});return {user,headers:{Cookie:'ux_session='+token,'X-CSRF-Token':csrf}};}
 try{
 const legacy=await seed('customer','legacy@example.com'),admin=await seed('admin','info@unfallx.com'),staff=await seed('appraiser','staff@example.com');
 const cid=D.id(),oldCase={id:cid,number:'LEGACY-FIXTURE',status:'draft',version:0,ownerUserId:legacy.user.id,companyId:null,source:'customer',intake:{vehicle:'Preserved vehicle',description:'Preserved description'}};await store.transaction(s=>s.put('case',oldCase,legacy.user.id));
 await t.test('Old registration, sessions, passwords, links and social onboarding cannot reopen private accounts',async()=>{
  assert.equal((await call('/register-customer',{email:'new-private@example.com',name:'Test',privacy:true,terms:true,password})).status,410);
  for(const p of ['/me','/cases','/export','/settings','/referrals'])assert.equal((await call(p,undefined,legacy.headers)).status,403,p);
  assert.equal((await call('/cases',{},legacy.headers)).status,403);
  const login=await call('/password-login',{email:legacy.user.email,password});assert.equal(login.status,403);assert.equal(login.cookie,null);
  const before=sent.length;await call('/login',{email:legacy.user.email});await call('/password/request',{email:legacy.user.email});assert.equal(sent.length,before);
  for(const [address,extra]of [[legacy.user.email,{}],['pending-private@example.com',{customer:{name:'Old pending account',phone:'123'}}]]){const token=D.random();await store.transaction(s=>s.put('token',{id:D.hash(token),email:address,expires:Date.now()+600000,...extra},address));assert.equal((await call('/exchange',{token})).status,403);assert.equal(await store.transaction(s=>s.get('user',D.hash('pending-private@example.com'))),null);}
  assert.equal((await call('/oauth/complete',{typeOfAccount:'customer',privacy:true,terms:true})).status,400);
 });
 await t.test('Role spoofing cannot create staff; partner is reviewed before case submission',async()=>{
  const data={email:'partner@example.com',company:'Fixture workshop',contact:'Fixture contact',street:'Teststraße 1',postcode:'10115',city:'Berlin',phone:'03012345',type:'Werkstatt',privacy:true,terms:true,password,role:'admin',companyId:'injected',typeOfAccount:'admin'};
  assert.equal((await call('/register',data)).status,200);const token=sent.findLast(m=>m.to===data.email).text.match(/#token=([a-f0-9]+)/)[1],login=await call('/exchange',{token,password});assert.equal(login.status,200);assert.equal(login.json.redirect,'/portal');
  const h={Cookie:login.cookie.split(';')[0]},me=await call('/me',undefined,h);h['X-CSRF-Token']=me.json.csrf;assert.equal(me.json.user.role,'partner');assert.notEqual(me.json.user.companyId,'injected');assert.equal(me.json.company.status,'pending');assert.equal((await call('/admin/overview',undefined,h)).status,403);assert.equal((await call('/cases',{},h)).status,403);
  assert.equal((await call('/me',undefined,staff.headers)).json.user.role,'appraiser');assert.equal((await call('/admin/overview',undefined,staff.headers)).status,403);
 });
 await t.test('Administration retains the complete existing case and user records',async()=>{
  const result=await call('/cases/'+cid,undefined,admin.headers);assert.equal(result.status,200);assert.equal(result.json.case.intake.description,oldCase.intake.description);
  assert.deepEqual(await store.transaction(s=>s.get('case',cid)),oldCase);const preserved=await store.transaction(s=>s.get('user',legacy.user.id));assert.equal(preserved.role,'customer');assert.equal(preserved.passwordHash,legacy.user.passwordHash);
 });
 }finally{await new Promise(r=>server.close(r));await portal.close();fs.rmSync(dir,{recursive:true,force:true});}
});
