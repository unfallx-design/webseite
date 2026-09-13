'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),sharp=require('sharp');
const D=require('../portal/domain'),{createStore}=require('../portal/store'),{createPortal}=require('../portal/app'),{fakeS3,env}=require('./fixtures/s3'),{createNotifications}=require('../portal/notifications'),{createContacts}=require('../portal/contacts'),{classifyDeliveryError}=require('../portal/mail');
const pause=()=>new Promise(r=>setTimeout(r,10));
const waitFor=async fn=>{for(let i=0;i<150;i++){const r=await fn();if(r)return r;await pause();}throw Error('Timed out');};
test('SMTP failures distinguish explicit rejection, pre-DATA connection failure and uncertain acceptance',()=>{
 for(const e of [Error('MAIL_NOT_CONFIGURED'),Error('MAIL_NOT_ACCEPTED'),{code:'EAUTH'},{code:'ECONNREFUSED'},{responseCode:550},{code:'ETIMEDOUT',command:'CONN'}])assert.equal(classifyDeliveryError(e),'definite');
 for(const e of [Error('unknown timeout'),{code:'ETIMEDOUT',command:'DATA'},{code:'ESOCKET',command:'DATA'},{code:'ESOCKET'}])assert.equal(classifyDeliveryError(e),'uncertain');
});
test('fresh database probes, admin-only diagnostics, secret-safe output and SMTP verify without mail',async t=>{
 const f=fakeS3(),store=await createStore(env,{fileStorage:f.files});let sends=0,verifies=0,failSend=false;
 const portal=createPortal({store,env:{...env,PORTAL_ORIGIN:'http://localhost',GOOGLE_CLIENT_ID:'PRIVATE_CLIENT',GOOGLE_CLIENT_SECRET:'PRIVATE_SECRET'},mail:{ready:true,verify:async()=>{verifies++;},send:async()=>{sends++;if(failSend)throw Error('uncertain DATA timeout');}}});await portal.ready();
 const server=http.createServer((req,res)=>portal.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await portal.close();});const base='http://127.0.0.1:'+server.address().port;
 async function actor(role){const id=D.id(),token=D.random(),csrf=D.random();await store.transaction(async s=>{await s.put('user',{id,role,active:true,verifiedAt:'yes',email:role+'@example.test',companyId:'company'});await s.put('company',{id:'company',status:'approved'});await s.put('session',{id:D.hash(token),userId:id,expires:Date.now()+60000,csrf});});return {Cookie:'ux_session='+token,'X-CSRF-Token':csrf};}
 const admin=await actor('admin'),partner=await actor('partner');const call=async(p,a=admin,data)=>{const r=await fetch(base+'/api/portal'+p,{method:data?'POST':'GET',headers:{...a,Origin:'http://localhost','Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()};};
 assert.equal((await call('/admin/system',partner)).status,403);assert.equal((await call('/admin/contacts',partner)).status,403);
 let r=await call('/admin/system');assert.equal(r.status,200);assert.equal(r.data.services.find(s=>s.id==='mysql').ok,true);assert.equal(r.data.services.find(s=>s.id==='smtp').ok,null);assert.equal(r.data.services.find(s=>s.id==='apple').configured,false);assert(!JSON.stringify(r.data).includes('PRIVATE_'));assert(!JSON.stringify(r.data).includes(env.PORTAL_S3_BUCKET));
 assert.equal((await call('/admin/system/check',admin,{service:'smtp'})).status,200);assert.equal(verifies,1);assert.equal(sends,0);
 assert.equal((await call('/admin/system/check',partner,{service:'s3'})).status,403);
 assert.equal((await call('/admin/system/check',admin,{service:'s3'})).status,200);assert.equal(f.objects.size,0);
 const cid=D.id(),pdf=Buffer.from('%PDF-1.7\nFiktives Gutachten\n%%EOF');
 await store.transaction(s=>s.put('case',{id:cid,number:'SMTP-TEST',companyId:'company',status:'report_ready',version:1,intake:{shareWithLawyer:true,lawyerEmail:'kanzlei@example.test',lawyerName:'Fiktive Kanzlei'}},'company'));
 const fid=await store.writeBlob(pdf,async(s,stage)=>{await stage.attach(s);await s.put('file',{id:stage.id,caseId:cid,kind:'report',name:'Test.pdf',type:'application/pdf',size:pdf.length,sha256:D.hash(pdf)},cid);return stage.id;});
 failSend=true;assert.equal((await call('/cases/'+cid+'/dispatch',admin,{version:1,fileId:fid,confirmed:true})).status,503);
 let c=await store.transaction(s=>s.get('case',cid));assert.equal(c.dispatch.state,'uncertain');const count=sends;
 assert.equal((await call('/cases/'+cid+'/dispatch',admin,{version:c.version,fileId:fid,confirmed:true})).status,400);assert.equal(sends,count);
 assert.equal((await call('/cases/'+cid,partner,{action:'dispatch_retry',version:c.version,confirmed:true})).status,403);
 assert.equal((await call('/cases/'+cid,admin,{action:'dispatch_retry',version:c.version,confirmed:false})).status,400);
 assert.equal((await call('/cases/'+cid,admin,{action:'dispatch_retry',version:c.version,confirmed:true})).status,200);
 c=await store.transaction(s=>s.get('case',cid));failSend=false;assert.equal((await call('/cases/'+cid+'/dispatch',admin,{version:c.version,fileId:fid,confirmed:true})).status,200);assert.equal((await store.transaction(s=>s.get('case',cid))).status,'report_sent');
 const ping=store.ping;store.ping=async()=>{throw Error('private db credentials');};assert.equal(await portal.readiness(),false);store.ping=ping;assert.equal(await portal.readiness(),true);
 const start=Date.now();store.ping=()=>new Promise(()=>{});assert.equal(await portal.readiness(),false);assert(Date.now()-start<3600);store.ping=ping;
 r=await call('/admin/system/backups',admin,{owner:'Testbetrieb',interval:'Täglich',retention:'30 Tage',rpo:'24 Stunden',rto:'4 Stunden',evidence:'Fiktive Testangaben'});assert.equal(r.status,200);
});
test('contact originals and mail state survive restart; access remains admin-only and retry is controlled',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ux-contact-test-')),file=path.join(dir,'db.sqlite'),f=fakeS3();let store=await createStore({...env,PORTAL_LOCAL_DB:file},{fileStorage:f.files});let sent=0,failure='uncertain';
 const tx=fn=>store.transaction(fn),mail={ready:true,send:async(to,subject,text,files,html)=>{assert.equal(to,'info@unfallx.com');assert.match(html,/cid:unfallx-logo/);sent++;if(failure)throw failure==='uncertain'?Error('timeout after DATA'):Object.assign(Error('SMTP rejected'),{responseCode:550});}};
 const notifications=createNotifications({tx,mail,origin:'http://localhost',rate:async()=>{}}),contacts=createContacts({tx,env,blobs:{write:(...a)=>store.writeBlob(...a),read:(...a)=>store.readBlob(...a)},notifications,rate:async()=>{},refreshUser:async(s,u)=>{const f=await s.get('user',u.id);D.assert(f?.active,'blocked',403);return f;}});
 t.after(async()=>{await store.close();fs.rmSync(dir,{recursive:true,force:true});});
 const photo=await sharp({create:{width:12,height:12,channels:3,background:'red'}}).jpeg().toBuffer(),data={name:'Fiktive Testperson',email:'test@example.test',beschreibung:'Geheime Testnachricht',kontaktweg:'email',fotos:[{name:'Test.jpg',typ:'image/jpeg',buf:photo}]};
 const result=await contacts.submit(data,{ip:'127.0.0.1'});assert(result.ok);const n=await waitFor(async()=>{const n=(await tx(s=>s.list('notification')))[0];return n.state==='uncertain'&&n;});assert.equal(sent,1);await notifications.flush();assert.equal(sent,1);
 const original=(await contacts.overview()).contacts[0];assert.equal(original.attachments.length,1);assert.equal(original.details.beschreibung,data.beschreibung);assert(!JSON.stringify(original).includes('originals/'));
 await store.close();store=await createStore({...env,PORTAL_LOCAL_DB:file},{fileStorage:f.files});assert.equal((await contacts.overview()).contacts.length,1);
 await tx(async s=>{await s.put('user',{id:'admin',role:'admin',active:true});await s.put('user',{id:'partner',role:'partner',active:true});});
 await assert.rejects(contacts.download({id:'partner'},original.attachments[0].id),e=>e.status===403);assert.deepEqual((await contacts.download({id:'admin'},original.attachments[0].id)).bytes,photo);
 await assert.rejects(notifications.retry({id:n.id,confirmed:false},{id:'admin'}));failure=null;await notifications.retry({id:n.id,confirmed:true},{id:'admin'});await notifications.flush();assert.equal(sent,2);assert.equal((await tx(s=>s.get('notification',n.id))).state,'sent');
 await contacts.submit(data,{ip:'127.0.0.1'});assert.equal((await contacts.overview()).contacts.length,1);assert.equal(sent,2);
 f.state.failPut=true;await contacts.submit({...data,beschreibung:'Andere fiktive Anfrage'},{ip:'127.0.0.1'});const partial=(await contacts.overview()).contacts.find(c=>c.details.beschreibung==='Andere fiktive Anfrage');assert.equal(partial.attachmentErrors,1);assert.equal(partial.attachments.length,0);assert.equal((await tx(s=>s.get('system','storage'))).bytes,photo.length);
});
test('definite mail failure retries with backoff at most four times and never replays an uncertain send',async t=>{
 const store=await createStore({NODE_ENV:'test',PORTAL_LOCAL_DB:':memory:'});t.after(()=>store.close());const tx=fn=>store.transaction(fn);let sends=0;
 const n=createNotifications({tx,origin:'https://example.test',mail:{ready:true,send:async()=>{sends++;throw Object.assign(Error('rejected'),{responseCode:550});}},rate:async()=>{}});
 await tx(s=>n.queue(s,{key:'test',to:'info@unfallx.com',title:'Test',copy:'Fiktiver Test',url:'https://example.test'}));
 for(let i=0;i<4;i++){await n.flush();const row=(await tx(s=>s.list('notification')))[0];assert(row.nextAttempt>Date.now());await n.flush();assert.equal(sends,i+1);await tx(async s=>{row.nextAttempt=0;await s.put('notification',row);});}
 assert.equal((await tx(s=>s.list('notification')))[0].state,'failed');await n.flush();assert.equal(sends,4);
});

test('stale partial contact intake recovers once, and concurrent administrative changes preserve versions',async t=>{
 const store=await createStore({NODE_ENV:'test',PORTAL_LOCAL_DB:':memory:'});t.after(()=>store.close());const tx=fn=>store.transaction(fn),notifications=createNotifications({tx,mail:{ready:false},origin:'https://example.test',rate:async()=>{}});
 const contacts=createContacts({tx,env:{},notifications,blobs:{},rate:async()=>{},refreshUser:async(s,u)=>u});
 await tx(s=>s.put('contact_request',{id:'partial',details:{name:'Fiktiv',beschreibung:'Abgebrochene Testanfrage'},files:[],state:'new',intakeState:'receiving',leaseUntil:0,expectedAttachments:2,version:1,createdAt:new Date().toISOString()}));
 await contacts.recover();await contacts.recover();let c=(await contacts.overview()).contacts[0];assert.equal(c.intakeState,'stored');assert.equal(c.attachmentErrors,2);assert.equal((await tx(s=>s.list('notification'))).length,1);
 const edit={id:c.id,version:c.version,state:'done',note:'Fiktive Prüfung'};await contacts.change({id:'admin',role:'admin'},edit);await assert.rejects(contacts.change({id:'admin',role:'admin'},edit),e=>e.status===409);assert.equal((await contacts.overview()).contacts[0].state,'done');
});
