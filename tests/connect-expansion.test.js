'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),sharp=require('sharp');
const {createPortal}=require('../portal/app'),{createStore}=require('../portal/store'),D=require('../portal/domain'),math=require('../assets/finance-math'),hosts=require('../portal/hosts');
test('Subdomain routes preserve the public website, queries and app entrypoints',()=>{
 assert.deepEqual(hosts.hostPolicy('unfallx.com','/'),{isApp:false,production:true});
 assert.equal(hosts.hostPolicy('unfallx.com','/login?next=%2Fportal').redirect,'https://app.unfallx.com/login?next=%2Fportal');
 assert.equal(hosts.hostPolicy('app.unfallx.com','/').redirect,'https://app.unfallx.com/portal');
 assert.equal(hosts.hostPolicy('app.unfallx.com','/bildung').redirect,'https://unfallx.com/bildung');
 assert.equal(hosts.hostPolicy('app.unfallx.com','/api/portal/me').isApp,true);
 assert.equal(hosts.hostPolicy('localhost:3000','/login').production,false);
 assert.equal(hosts.links('<a href="/">Home</a><a href="/registrieren?ref=UX-TEST">Join</a><script src="/assets/portal.js"></script>',true,true),'<a href="https://unfallx.com/">Home</a><a href="https://app.unfallx.com/registrieren?ref=UX-TEST">Join</a><script src="/assets/portal.js"></script>');
});
test('Money is calculated in integer cents, including gross input and independent partner VAT',()=>{
 const r=math.calculate({amount:'1000',basis:'net',vatPercent:'19',partnerPercent:'50',partnerVatPercent:'19'});assert.deepEqual([r.invoiceNet,r.invoiceTax,r.invoiceGross,r.partnerNet,r.partnerTax,r.partnerGross],[100000,19000,119000,50000,9500,59500]);
 const g=math.calculate({amount:'1190,00',basis:'gross',vatPercent:'19',partnerPercent:'50',partnerVatPercent:'0'});assert.equal(g.invoiceNet,100000);assert.equal(g.partnerGross,50000);
 assert.equal(math.calculate({amount:'0.03',basis:'net',vatPercent:'19',partnerPercent:'50',partnerVatPercent:'0'}).partnerNet,2);
 for(const bad of [{amount:'1e3'},{partnerPercent:'100.01'},{vatPercent:'-1'},{amount:'NaN'},{amount:'0'},{amount:'2.001'},{basis:'other'}])assert.throws(()=>math.calculate({amount:'1000',basis:'net',vatPercent:'19',partnerPercent:'50',...bad}));
});
test('Connect expansion enforces status rights, confidential PDFs, lawyer handoff, private tracking and course snapshots',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ux-connect5-'));const env={NODE_ENV:'test',PORTAL_LOCAL_DB:path.join(dir,'portal.sqlite'),PORTAL_ORIGIN:'http://localhost',PORTAL_TRUST_PROXY:'true'};const sent=[];const mail={ready:true,send:async(to,subject,text,files,html)=>sent.push({to,subject,text,files,html})};
 const store=await createStore(env),portal=createPortal({env,store,mail});await portal.ready();const server=http.createServer((req,res)=>portal.handle(req,res,{}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let ip=0;
 async function call(p,data,u={},extra={}){const r=await fetch(base+'/api/portal'+p,{method:data===undefined?'GET':'POST',headers:{Origin:env.PORTAL_ORIGIN,'Content-Type':'application/json','X-Forwarded-For':'test-'+(++ip),Cookie:u.cookie||'','X-CSRF-Token':u.csrf||'',...extra},body:data===undefined?undefined:Buffer.isBuffer(data)?data:JSON.stringify(data)});const bytes=Buffer.from(await r.arrayBuffer());return {status:r.status,json:r.headers.get('content-type')?.includes('application/json')?JSON.parse(bytes):null,bytes,headers:r.headers};}
 async function user(name,role,companyId=null){const token=D.random(),csrf=D.random(),u={id:D.hash(name+'@example.com'),name,email:name+'@example.com',role,companyId,active:true,verifiedAt:new Date().toISOString()};await store.transaction(async s=>{await s.put('user',u,companyId||'internal');await s.put('session',{id:D.hash(token),userId:u.id,csrf,createdAt:new Date().toISOString(),expires:Date.now()+3600000},u.id);if(companyId)await s.put('company',{id:companyId,name:companyId,status:'approved'});});return {...u,cookie:'ux_session='+token,csrf};}
 const a=await user('admin','admin'),p=await user('partner','partner','company-a'),other=await user('other','partner','company-b'),c=await user('customer','customer'),staff=await user('staff','appraiser');
 const input={vehicle:'Beispielfahrzeug',plate:'DEMO',accidentDate:'2026-09-09',location:'Berlin',owner:'Beispiel',ownerContact:'customer@example.com',customerEmail:'status@example.com',notifyCustomer:true,description:'PRIVATE_DESCRIPTION',authority:true,shareWithLawyer:true};
 const pdf=Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF'),photo=await sharp({create:{width:8,height:8,channels:3,background:'#123456'}}).jpeg().toBuffer();let cid,lawyer;
 async function act(u,data){const v=(await call('/cases/'+cid,undefined,a)).json.case.version;return call('/cases/'+cid,{...data,version:v},u);}
 try{
 await t.test('Partner updates stop at submission and cannot impersonate UNFALLX status',async()=>{
  const r=await call('/cases',input,p);assert.equal(r.status,200);cid=r.json.case.id;
  assert.equal((await act(p,{action:'partner_status',status:'report_sent'})).status,403);
  assert.equal((await act(other,{action:'partner_status',status:'recording'})).status,404);
  assert.equal((await act(p,{action:'partner_status',status:'recording'})).status,200);
  assert.equal((await act(p,{action:'status',status:'accepted'})).status,403);
  assert.equal((await call('/cases/'+cid+'/files',photo,p,{'Content-Type':'image/jpeg','X-File-Kind':'photo','X-File-Name':'photo.jpg'})).status,200);
  assert.equal((await act(p,{action:'partner_status',status:'ready_to_submit'})).status,200);
  assert.equal((await act(p,{action:'submit'})).status,200);
  assert.equal((await act(p,{action:'partner_status',status:'recording'})).status,403);
  assert.equal((await act(a,{action:'internal_note',note:'PRIVATE_INTERNAL_NOTE'})).status,200);
 });
 await t.test('Vault PDFs are limited to admin and the owning partner, independent of cases',async()=>{
  assert.equal((await call('/documents')).status,401);assert.equal((await call('/documents',undefined,c)).status,403);assert.equal((await call('/documents',undefined,staff)).status,403);
  const r=await call('/documents',pdf,p,{'Content-Type':'application/pdf','X-File-Name':'vertraulich.pdf','X-Company-Id':'company-b'});assert.equal(r.status,200);assert.equal(r.json.document.companyId,'company-a');const id=r.json.document.id;
  assert.equal((await call('/documents/'+id,undefined,other)).status,404);assert.equal((await call('/documents/'+id,undefined,c)).status,403);assert.deepEqual((await call('/documents/'+id,undefined,a)).bytes,pdf);
  assert.equal((await call('/documents',Buffer.from('not-pdf'),a,{'Content-Type':'application/pdf','X-File-Name':'fake.pdf'})).status,415);
  const own=await call('/documents',pdf,a,{'Content-Type':'application/pdf','X-File-Name':'nur-admin.pdf'});assert.equal(own.status,200);assert.equal((await call('/documents/'+own.json.document.id,undefined,p)).status,404);
  assert.equal((await call('/documents',undefined,p)).json.documents.length,1);
 });
 await t.test('Kanzlei registration must verify; directory mutation and logo upload require admin',async()=>{
  const data={name:'Beispielkanzlei',contact:'Dr. Beispiel',email:'law@example.com',phone:'030 000000',address:'Musterstraße 1, Berlin',website:'https://example.com',privacy:true};
  assert.equal((await call('/lawyers/register',data)).status,200);const token=sent.findLast(m=>m.to===data.email).text.match(/#token=([a-f0-9]+)/)[1];
  assert.equal((await call('/lawyers/verify',{token})).status,200);assert.equal((await call('/lawyers/verify',{token})).status,401);
  lawyer=(await call('/admin/lawyers',undefined,a)).json.lawyers[0];assert.equal(lawyer.status,'pending');
  assert.equal((await call('/admin/lawyers',{...lawyer,status:'active'},p)).status,403);
  assert.equal((await act(a,{action:'lawyer',lawyerId:lawyer.id})).status,400);
  const saved=await call('/admin/lawyers',{...lawyer,status:'active'},a);assert.equal(saved.status,200);lawyer=saved.json.lawyer;
  assert.equal((await call('/admin/lawyers',{...lawyer,version:0},a)).status,409);
  const l=await call('/admin/lawyers/'+lawyer.id+'/logo',photo,a,{'Content-Type':'image/jpeg'});assert.equal(l.status,200);lawyer=l.json.lawyer;assert.equal((await call('/lawyers/logos/'+lawyer.logoId)).headers.get('content-type'),'image/webp');
  assert.equal((await act(a,{action:'lawyer',lawyerId:lawyer.id})).status,200);
 });
 await t.test('Status links expose no case files, names or private notes and can be revoked',async()=>{
  let invite;for(let n=0;n<30&&!invite;n++){invite=sent.find(m=>m.to==='status@example.com'&&m.text.includes('/benachrichtigungen#token='));if(!invite)await new Promise(r=>setTimeout(r,15));}assert.ok(invite);const token=invite.text.match(/#token=([a-f0-9]+)/)[1];
  const verified=await call('/notifications/verify',{token});assert.equal(verified.status,200);const statusToken=verified.json.trackingUrl.split('#token=')[1];assert.ok(statusToken);
  let tracking=await call('/tracking',{token:statusToken});assert.equal(tracking.status,200);assert.equal(tracking.json.status,'submitted');assert.equal(tracking.json.lawyer,null);assert.ok(!JSON.stringify(tracking.json).includes('PRIVATE'));assert.equal(tracking.json.files,undefined);assert.equal(tracking.headers.get('cache-control'),'private, no-store, max-age=0');
  for(const status of ['accepted','in_progress'])assert.equal((await act(a,{action:'status',status})).status,200);
  assert.equal((await act(a,{action:'status',status:'report_ready'})).status,400);
  const report=await call('/cases/'+cid+'/files',pdf,a,{'Content-Type':'application/pdf','X-File-Kind':'report','X-File-Name':'Gutachten.pdf'});assert.equal(report.status,200);
  assert.equal((await act(a,{action:'status',status:'report_ready'})).status,200);const version=(await call('/cases/'+cid,undefined,a)).json.case.version;
  assert.equal((await call('/cases/'+cid+'/dispatch',{fileId:report.json.file.id,confirmed:true,version},p)).status,403);
  assert.equal((await call('/cases/'+cid+'/dispatch',{fileId:report.json.file.id,confirmed:true,version},a)).status,200);
  tracking=await call('/tracking',{token:statusToken});assert.equal(tracking.json.status,'report_sent');assert.equal(tracking.json.lawyer.email,'law@example.com');assert.equal(tracking.json.lawyer.phone,'030 000000');assert.ok(sent.some(m=>m.to==='law@example.com'&&m.files?.some(f=>f.contentType==='application/pdf')));
  let notification;for(let n=0;n<100&&!notification;n++){notification=sent.find(m=>m.to==='status@example.com'&&m.text.includes('Beispielkanzlei'));if(!notification)await new Promise(r=>setTimeout(r,15));}assert.ok(notification);assert.match(notification.text,/\/status#token=/);assert.match(notification.html,/Statusmeldungen abbestellen/);
  assert.equal((await act(a,{action:'tracking_revoke',confirmed:true})).status,200);assert.equal((await call('/tracking',{token:statusToken})).status,401);assert.equal((await call('/tracking',{token:'x'.repeat(64)})).status,401);
 });
 await t.test('Percentage calculator persists verified amounts and referral attribution avoids unrelated private accounts',async()=>{
  const r=await act(a,{action:'finance',invoiceNumber:'R-TEST',agreement:'50 % der Nettovergütung',invoiceNet:'99999',calculation:{amount:'1000',basis:'net',vatPercent:'19',partnerPercent:'50',partnerVatPercent:'19'}});assert.equal(r.status,200);assert.equal(r.json.case.finance.invoiceGross,119000);assert.equal(r.json.case.finance.partnerNet,50000);assert.equal(r.json.case.finance.partnerGross,59500);
  assert.equal((await act(p,{action:'finance',calculation:{}})).status,403);assert.equal((await act(a,{action:'finance',calculation:{amount:'1000',basis:'net',vatPercent:'19',partnerPercent:'200'}})).status,400);
  assert.equal((await call('/referrals/join',{accepted:true},c)).status,200);const code=(await call('/referrals',undefined,c)).json.code;
  const direct=await call('/cases',{...input,customerEmail:'direct@example.com'},a);assert.equal(direct.status,200);const directId=direct.json.case.id;
  await store.transaction(async s=>{await s.put('referral_attribution',{id:'unrelated',referrerId:c.id,companyId:null});const row=await s.get('case',directId);row.status='report_sent';await s.put('case',row);});
  const v=(await call('/cases/'+directId,undefined,a)).json.case.version;await call('/cases/'+directId,{action:'comment',note:'Test',version:v},a);assert.equal((await call('/referrals',undefined,c)).json.rewards.length,0);
  const v2=(await call('/cases/'+directId,undefined,a)).json.case.version;assert.equal((await call('/cases/'+directId,{action:'referral',referralCode:code,version:v2},a)).status,200);assert.equal((await call('/referrals',undefined,c)).json.rewards.length,1);
 });
 await t.test('Course prices, publication, per-course capacity and immutable booking snapshots',async()=>{
  const course={action:'course',title:'Fotodokumentation',description:'Praxis am Fahrzeug',price:'2000',capacity:2,duration:'1 Woche',location:'Berlin',mode:'berlin',weekly:false,start:'',status:'draft'};
  assert.equal((await call('/admin/academy',course,p)).status,403);let r=await call('/admin/academy',course,a);assert.equal(r.status,200);let custom=r.json.course;assert.ok(!(await call('/academy/courses')).json.courses.some(c=>c.id===custom.id));
  r=await call('/admin/academy',{...course,id:custom.id,version:custom.version,status:'published'},a);assert.equal(r.status,200);custom=r.json.course;assert.equal((await call('/academy/courses')).json.courses.find(c=>c.id===custom.id).price,200000);
  const tokens=[];for(let n=0;n<3;n++){const email='custom-course'+n+'@example.com';r=await call('/academy/register',{mode:'berlin',courseId:custom.id,week:'start-folgt',name:'Kurs Beispiel',phone:'0300000',email,privacy:true});assert.equal(r.status,200);tokens.push(sent.findLast(m=>m.to===email).text.match(/#bestaetigen=([a-f0-9]+)/)[1]);}
  const verified=await Promise.all(tokens.map(token=>call('/academy/verify',{token})));assert.equal(verified.filter(r=>r.json.status==='requested').length,2);assert.equal(verified.filter(r=>r.json.status==='waitlisted').length,1);
  assert.equal((await call('/academy/weeks')).json.weeks[0].reserved,0);
  assert.equal((await call('/admin/academy',{...course,id:custom.id,version:0},a)).status,409);
  assert.equal((await call('/admin/academy',{...course,id:custom.id,version:custom.version,capacity:1},a)).status,400);
  r=await call('/admin/academy',{...course,id:custom.id,version:custom.version,status:'published',price:'2200'},a);assert.equal(r.status,200);
  const regs=(await call('/admin/academy',undefined,a)).json.registrations.filter(r=>r.courseId===custom.id);assert.ok(regs.every(r=>r.course.price===200000));assert.equal((await call('/academy/courses')).json.courses.find(c=>c.id===custom.id).price,220000);
 });
 }finally{await new Promise(r=>server.close(r));await portal.close();fs.rmSync(dir,{recursive:true,force:true});}
});
