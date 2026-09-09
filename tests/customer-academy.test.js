'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),sharp=require('sharp');
const {createPortal}=require('../portal/app'),{createStore}=require('../portal/store'),D=require('../portal/domain');
test('Partner intake remains isolated; academy confirmation, capacity and schedule use durable transactions',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ux-partner-academy-'));const env={NODE_ENV:'test',PORTAL_LOCAL_DB:path.join(dir,'test.sqlite'),PORTAL_ORIGIN:'http://localhost',PORTAL_TRUST_PROXY:'true'};const sent=[];let fail=false;const mail={ready:true,send:async(to,subject,text,attachments,html)=>{sent.push({to,subject,text,html});if(fail)throw new Error('MAIL_TEST');}};
 const store=await createStore(env),portal=createPortal({env,mail,store});await portal.ready();const server=http.createServer((req,res)=>portal.handle(req,res,{}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let counter=0;
 async function call(p,data,actor={},rawHeaders={}){const r=await fetch(base+'/api/portal'+p,{method:data===undefined?'GET':'POST',headers:{Origin:env.PORTAL_ORIGIN,'Content-Type':'application/json','X-Forwarded-For':'test-client-'+(++counter),...(actor.cookie?{Cookie:actor.cookie,'X-CSRF-Token':actor.csrf}:{}),...rawHeaders},body:data===undefined?undefined:Buffer.isBuffer(data)?data:JSON.stringify(data)});const bytes=Buffer.from(await r.arrayBuffer());return {status:r.status,json:r.headers.get('content-type')?.includes('application/json')?JSON.parse(bytes):null,bytes,cookie:r.headers.get('set-cookie')};}
 async function signin(address,partner=true){const r=await call(partner?'/register':'/login',{email:address,company:'Testbetrieb GmbH',contact:'Testpartner',street:'Teststraße 1',postcode:'10115',city:'Berlin',type:'Werkstatt',phone:'03000000',privacy:true,terms:true,password:'Mein sicherer Test Merksatz 2026!',role:'admin',companyId:'evil'});assert.equal(r.status,200);const email=sent.findLast(x=>x.to===address),token=email.text.match(/#token=([a-f0-9]+)/)[1];const auth=await call('/exchange',{token,password:'Mein sicherer Test Merksatz 2026!'});assert.equal(auth.status,200);const actor={cookie:auth.cookie.split(';')[0],csrf:''};const me=(await call('/me',undefined,actor)).json;if(partner)await store.transaction(async s=>{const co=await s.get('company',me.user.companyId);co.status='approved';await s.put('company',co);});return {...actor,csrf:me.csrf,user:me.user,redirect:auth.json.redirect};}
 try{
 const admin=await signin('info@unfallx.com',false),a=await signin('customer-a@example.com'),b=await signin('customer-b@example.com');
 await t.test('Trusted roles, no fake company, private own-case list and export',async()=>{
 assert.equal(a.user.role,'partner');assert.ok(a.user.companyId&&a.user.companyId!=='evil');assert.equal(a.redirect,'/portal');assert.equal((await call('/admin/overview',undefined,a)).status,403);assert.equal((await call('/admin/academy',undefined,a)).status,403);assert.equal((await call('/admin/overview',undefined,admin)).json.team.some(u=>u.role==='customer'),false);
 const email=sent.find(x=>x.to===a.user.email);assert.match(email.text,/Ersten Fall einreichen/);assert.match(email.html,/Firmendaten|Registrierung/);
 });
 const intake={vehicle:'Beispielfahrzeug',plate:'DEMO',accidentDate:'2026-09-09',location:'Berlin',owner:'Beispielkunde',ownerContact:'customer-a@example.com',description:'Fiktiver Parkschaden',authority:true};
 const first=await call('/cases',intake,a);assert.equal(first.status,200);const cid=first.json.case.id;assert.equal(first.json.case.companyId,a.user.companyId);assert.equal(first.json.case.ownerUserId,null);assert.equal(first.json.case.source,'partner');
 const photo=await sharp({create:{width:16,height:16,channels:3,background:'#445566'}}).jpeg().toBuffer(),pdf=Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF');
 async function version(){return (await call('/cases/'+cid,undefined,admin)).json.case.version;}
 async function act(actor,data){return call('/cases/'+cid,{...data,version:await version()},actor);}
 async function upload(actor,kind,bytes,type){return call('/cases/'+cid+'/files',bytes,actor,{'Content-Type':type,'X-File-Kind':kind,'X-File-Name':kind+'.'+(type==='application/pdf'?'pdf':'jpg')});}
 await t.test('Partner cannot read another tenant or use staff actions/files',async()=>{
 assert.equal((await call('/cases',undefined,b)).json.cases.length,0);assert.equal((await call('/export',undefined,b)).json.cases.length,0);assert.equal((await call('/cases/'+cid,undefined,b)).status,404);assert.equal((await act(a,{action:'submit'})).status,400);
 for(const action of ['status','finance','assign','payment','approve_invoice','payout','internal_note'])assert.equal((await act(a,{action,status:'accepted'})).status,403,action);
 assert.equal((await call('/cases/'+cid+'/dispatch',{confirmed:true},a)).status,403);
 assert.equal((await upload(a,'report',pdf,'application/pdf')).status,403);assert.equal((await upload(a,'partner_invoice',pdf,'application/pdf')).status,400);
 const f=await upload(a,'photo',photo,'image/jpeg');assert.equal(f.status,200);assert.equal((await call('/files/'+f.json.file.id,undefined,b)).status,404);assert.deepEqual((await call('/files/'+f.json.file.id,undefined,a)).bytes,photo);
 const partnerUser={id:D.hash('partner@example.com'),email:'partner@example.com',name:'Partner',role:'partner',companyId:'company-fixture',active:true};await store.transaction(async s=>{await s.put('user',partnerUser,'company-fixture');await s.put('company',{id:'company-fixture',name:'Firma',status:'approved'});});const p=await signin('partner@example.com',false);assert.equal((await call('/cases/'+cid,undefined,p)).status,404);
 });
 await t.test('Submission, staff review, private notes and explicit report release',async()=>{
 assert.equal((await act(a,{action:'submit'})).status,200);assert.equal((await act(a,{action:'save',...intake})).status,403);assert.equal((await upload(a,'photo',photo,'image/jpeg')).status,400);
 assert.equal((await act(admin,{action:'internal_note',note:'INTERNAL_ONLY'})).status,200);
 const view=(await call('/cases/'+cid,undefined,a)).json;assert.equal(view.case.internalNote,undefined);assert.equal(view.events.some(e=>e.internal),false);
 assert.equal((await act(admin,{action:'finance'})).status,400);
 assert.equal((await act(admin,{action:'status',status:'needs_info',note:'Bitte ein Detailfoto ergänzen.'})).status,200);assert.equal((await upload(a,'photo',photo,'image/jpeg')).status,200);assert.equal((await act(a,{action:'submit'})).status,200);
 for(const status of ['accepted','in_progress'])assert.equal((await act(admin,{action:'status',status})).status,200);
 const f=await upload(admin,'report',pdf,'application/pdf');assert.equal(f.status,200);assert.equal((await call('/files/'+f.json.file.id,undefined,a)).status,403);assert.equal((await call('/cases/'+cid,undefined,a)).json.files.some(f=>f.kind==='report'),false);
 assert.equal((await act(admin,{action:'status',status:'report_ready'})).status,200);assert.deepEqual((await call('/files/'+f.json.file.id,undefined,a)).bytes,pdf);assert.equal((await call('/cases',undefined,a)).json.cases.length,1);
 });
 let registration,verifyToken;
 await t.test('Undated course, opt-in email, token replay, duplicates and delivery failure',async()=>{
 const available=(await call('/academy/weeks')).json;assert.equal(available.weeks[0].week,'start-folgt');assert.equal(available.weeks[0].available,26);
 registration={mode:'berlin',week:'start-folgt',name:'Kurs Beispiel',email:'course@example.com',phone:'0300000',privacy:true,terms:true,password:'Mein sicherer Test Merksatz 2026!'};
 assert.equal((await call('/academy/register',{...registration,week:'2020-01-01'})).status,400);assert.equal((await call('/academy/register',{...registration,privacy:false})).status,400);
 assert.equal((await call('/academy/register',registration)).status,200);assert.equal((await call('/academy/weeks')).json.weeks[0].reserved,0);
 const msg=sent.findLast(x=>x.to===registration.email);assert.match(msg.text,/1\.500(?:,00)?\s€/);assert.match(msg.html,/demnächst/);verifyToken=msg.text.match(/#bestaetigen=([a-f0-9]+)/)[1];assert.equal((await call('/exchange',{token:verifyToken})).status,401);
 assert.equal((await call('/academy/verify',{token:verifyToken})).json.status,'requested');assert.equal((await call('/academy/verify',{token:verifyToken})).status,401);assert.equal((await call('/academy/weeks')).json.weeks[0].reserved,1);
 const count=sent.length;assert.equal((await call('/academy/register',registration)).status,200);assert.equal(sent.length,count);
 fail=true;assert.equal((await call('/academy/register',{...registration,email:'failcourse@example.com'})).status,503);fail=false;const failedToken=sent.at(-1).text.match(/#bestaetigen=([a-f0-9]+)/)[1];assert.equal((await call('/academy/verify',{token:failedToken})).status,401);
 });
 await t.test('Concurrent confirmations enforce 26 places, waitlist and authenticated administration',async()=>{
 // Seed verified-mail challenges without generating bulk email; exercise actual concurrent HTTP confirmations.
 const tokens=[];await store.transaction(async s=>{for(let n=0;n<28;n++){const rid=D.hash('seat-'+n),token=D.random();tokens.push(token);await s.put('academy_registration',{id:rid,mode:'berlin',week:'start-folgt',email:'seat'+n+'@example.com',name:'Seat '+n,status:'email_pending'},'start-folgt');await s.put('academy_token',{id:D.hash(token),registrationId:rid,expires:Date.now()+600000},rid);}});
 const result=await Promise.all(tokens.map(token=>call('/academy/verify',{token})));assert.equal(result.filter(r=>r.json.status==='requested').length,25);assert.equal(result.filter(r=>r.json.status==='waitlisted').length,3);assert.ok(result.every(r=>r.status===200));
 const avail=(await call('/academy/weeks')).json.weeks[0];assert.equal(avail.reserved,26);assert.equal(avail.available,0);assert.equal(avail.waitlisted,3);
 const data=(await call('/admin/academy',undefined,admin)).json;const wait=data.registrations.find(r=>r.status==='waitlisted'),booked=data.registrations.find(r=>r.status==='requested');
 assert.equal((await call('/admin/academy',{id:wait.id,status:'confirmed'},a)).status,403);assert.equal((await call('/admin/academy',{id:wait.id,status:'confirmed'},admin)).status,409);
 assert.equal((await call('/admin/academy',{id:booked.id,status:'cancelled'},admin)).json.notificationSent,true);assert.equal((await call('/admin/academy',{id:wait.id,status:'confirmed'},admin)).status,200);
 assert.equal((await call('/academy/weeks')).json.weeks[0].reserved,26);
 fail=true;const notify=await call('/admin/academy',{id:wait.id,status:'confirmed'},admin);fail=false;assert.equal(notify.json.notificationSent,false);assert.equal((await call('/admin/academy',undefined,admin)).json.registrations.find(r=>r.id===wait.id).notification,'failed');
 assert.equal((await call('/admin/academy',{id:wait.id,status:'confirmed'},admin)).json.notificationSent,true);
 const monday=new Date();monday.setUTCDate(monday.getUTCDate()+((8-monday.getUTCDay())%7||7)+7);const start=monday.toISOString().slice(0,10);
 assert.equal((await call('/admin/academy',{action:'schedule',start},a)).status,403);assert.equal((await call('/admin/academy',{action:'schedule',start},admin)).status,200);
 const published=(await call('/academy/weeks')).json;assert.equal(published.weeks[0].week,start);assert.equal(published.weeks[0].reserved,26);assert.equal(published.weeks[1].reserved,0);assert.equal(published.weeks.length,12);assert.equal((await call('/admin/academy',{action:'schedule',start},admin)).status,409);
 });
 await t.test('Digital interest never occupies a Berlin place; expired links cannot enroll',async()=>{
 assert.equal((await call('/academy/register',{...registration,email:'digital@example.com',mode:'digital',week:''})).status,200);const token=sent.at(-1).text.match(/#bestaetigen=([a-f0-9]+)/)[1];assert.equal((await call('/academy/verify',{token})).json.status,'interest');assert.equal((await call('/academy/weeks')).json.weeks[0].reserved,26);
 const expired=D.random();await store.transaction(s=>s.put('academy_token',{id:D.hash(expired),registrationId:'missing',expires:Date.now()-10}));assert.equal((await call('/academy/verify',{token:expired})).status,401);
 });
 }finally{await new Promise(r=>server.close(r));await portal.close();fs.rmSync(dir,{recursive:true,force:true});}
});
