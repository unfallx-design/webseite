'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),sharp=require('sharp');
const D=require('../portal/domain'),{createStore}=require('../portal/store'),{createPortal}=require('../portal/app');
for(const provider of ['database','s3'])test(provider+': HTTP file trash, restore, original bytes, access boundaries, locked records and notifications',async t=>{
 const fixture=provider==='s3'?require('./fixtures/s3').fakeS3():null;
 const env={...(fixture?require('./fixtures/s3').env:{}),NODE_ENV:'test',PORTAL_ORIGIN:'http://localhost',PORTAL_LOCAL_DB:':memory:'},store=await createStore(env,fixture?{fileStorage:fixture.files}:{}),sent=[];
 const portal=createPortal({env,store,mail:{ready:true,send:async(to,subject,text,attachments,html)=>sent.push({to,subject,text,html})}});await portal.ready();
 const server=http.createServer((req,res)=>portal.handle(req,res,{}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 async function actor(role,companyId){const id=D.id(),token=D.random(),csrf=D.random();await store.transaction(async s=>{if(companyId)await s.put('company',{id:companyId,name:companyId,status:'approved'});await s.put('user',{id,name:role,email:id+'@example.test',role,companyId,active:true,verifiedAt:new Date().toISOString()},companyId||'internal');await s.put('session',{id:D.hash(token),userId:id,csrf,expires:Date.now()+600000},id);});return {id,email:id+'@example.test',cookie:'ux_session='+token,csrf};}
 async function raw(path,u={},data,extra={}){return fetch(base+'/api/portal'+path,{method:data===undefined?'GET':'POST',headers:{Origin:env.PORTAL_ORIGIN,Cookie:u.cookie||'','X-CSRF-Token':u.csrf||'','Content-Type':'application/json',...extra},body:data===undefined?undefined:Buffer.isBuffer(data)?data:JSON.stringify(data)});}
 async function call(...args){const r=await raw(...args);return {status:r.status,json:await r.json()};}
 const pdf=Buffer.from('%PDF-1.4\n% Fictional test document\n%%EOF'),pic=await sharp({create:{width:12,height:12,channels:3,background:'#ee2424'}}).jpeg().toBuffer();
 try{
 const p=await actor('partner','company-one'),other=await actor('partner','company-two'),admin=await actor('admin'),expert=await actor('appraiser');
 const cid=(await call('/cases',p,require('./fixtures/intake')())).json.case.id;
 const read=(u=p)=>call('/cases/'+cid,u);
 const act=async(u,data,expected=200)=>{const c=(await read(admin)).json.case;const r=await call('/cases/'+cid,u,{version:c.version,...data});assert.equal(r.status,expected,JSON.stringify(r.json));return r;};
 const upload=async(u,kind,bytes,type,name)=>{const r=await call('/cases/'+cid+'/files',u,bytes,{'Content-Type':type,'X-File-Kind':kind,'X-File-Name':name});assert.equal(r.status,200,JSON.stringify(r.json));return r.json.file;};
 const photo=await upload(p,'photo',pic,'image/jpeg','photo.jpg'),bundle=await upload(p,'case_bundle',pdf,'application/pdf','auftrag.pdf');
 await t.test('Remove is confirmed, versioned, scoped and recoverable without changing original bytes',async()=>{
  assert.equal((await call('/cases/'+cid,{}, {action:'file_delete',fileId:photo.id,confirmed:true,version:3})).status,401);
  assert.equal((await call('/cases/'+cid,{cookie:p.cookie},{action:'file_delete',fileId:photo.id,confirmed:true,version:3})).status,403);
  await act(other,{action:'file_delete',fileId:photo.id,confirmed:true},404);
  await act(p,{action:'file_delete',fileId:photo.id},400);
  const before=(await read()).json;assert.equal(before.files.find(f=>f.id===photo.id).canDelete,true);
  await act(p,{action:'file_delete',fileId:photo.id,confirmed:true});
  const c=(await read()).json;assert.equal(c.files.length,1);assert.equal(c.deletedFiles.length,1);assert(c.events.some(e=>e.action==='Unterlage entfernt'));assert.equal(c.deletedFiles[0].canRestore,true);if(fixture)assert.equal(fixture.calls.filter(c=>c.name==='DeleteObjectCommand').length,0);
  assert.equal((await read(admin)).json.files.length,1);assert.equal((await read(other)).status,404);
  for(const suffix of ['','/preview','/thumbnail'])assert.equal((await raw('/files/'+photo.id+suffix,p)).status,404);
  const listing=(await call('/cases',p)).json.cases[0];assert.equal(listing.photoCount,0);assert.equal(listing.thumbnailFileId,null);
  const zip=await raw('/cases/'+cid+'/archive?scope=all',admin);assert.equal(zip.status,200);const archive=Buffer.from(await zip.arrayBuffer());assert(!archive.includes(Buffer.from('photo.jpg')));assert(archive.includes(Buffer.from('auftrag.pdf')));
  const handover=(await call('/cases/'+cid+'/handover',admin)).json;assert(!JSON.stringify(handover).includes(photo.id));
  await act(p,{action:'file_kind',fileId:photo.id,kind:'document'},404);
  await act(p,{action:'files_confirm',fileIds:[photo.id]},404);
  await act(p,{action:'submit'},400);
  const stale=await call('/cases/'+cid,p,{version:before.case.version,action:'file_restore',fileId:photo.id,confirmed:true});assert.equal(stale.status,409);
  await act(p,{action:'file_restore',fileId:photo.id,confirmed:true});
  assert.deepEqual(Buffer.from(await (await raw('/files/'+photo.id,p)).arrayBuffer()),pic);
  assert.equal((await read()).json.deletedFiles.length,0);
 });
 await t.test('Readiness and submissions cannot count files in trash; submitted partner records are protected',async()=>{
  await act(p,{action:'partner_status',status:'recording'});await act(p,{action:'partner_status',status:'ready_to_submit'});
  await act(p,{action:'file_delete',fileId:bundle.id,confirmed:true});assert.equal((await read()).json.case.status,'recording');await act(p,{action:'submit'},400);
  await act(p,{action:'file_restore',fileId:bundle.id,confirmed:true});await act(p,{action:'submit'});
  await act(p,{action:'file_delete',fileId:photo.id,confirmed:true},403);
  await act(admin,{action:'request_create',kind:'photo',note:'Test: Aufnahme korrigieren'});await act(p,{action:'file_delete',fileId:photo.id,confirmed:true});
  const request=(await read()).json.case.requests[0];await act(p,{action:'request_reply',requestId:request.id,fileIds:[photo.id]},404);
  await act(admin,{action:'file_restore',fileId:photo.id,confirmed:true});
  const adminFile=await upload(admin,'document',Buffer.from('%PDF-1.4\n% INTERNAL\n%%EOF'),'application/pdf','intern.pdf');await act(p,{action:'file_delete',fileId:adminFile.id,confirmed:true},403);
  await act(admin,{action:'assign',assignee:expert.id});await act(expert,{action:'file_delete',fileId:adminFile.id,confirmed:true});await act(admin,{action:'file_restore',fileId:adminFile.id,confirmed:true});
 });
 await t.test('Review email and partner message reach administration even without an assignee',async()=>{
  await store.transaction(async s=>{const c=await s.get('case',cid);c.assignee=null;await s.put('case',c,c.companyId);});
  const before=sent.length;await act(p,{action:'comment',note:'Nur im Portal lesbarer Testtext'});
  for(let i=0;i<40&&!sent.slice(before).some(m=>m.to===admin.email);i++)await new Promise(r=>setTimeout(r,10));
  const notice=sent.slice(before).find(m=>m.to===admin.email);assert(notice);assert.match(notice.subject,/Nachricht/);assert(!notice.text.includes('Nur im Portal lesbarer Testtext'));assert.match(notice.html,/logo/i);
  const review=await call('/admin/company',admin,{id:'company-one',status:'approved',note:'Willkommen zum Test.'});assert.equal(review.status,200);
  for(let i=0;i<40&&!sent.some(m=>m.to===p.email&&m.subject.includes('freigeschaltet'));i++)await new Promise(r=>setTimeout(r,10));
  const welcome=sent.find(m=>m.to===p.email&&m.subject.includes('freigeschaltet'));assert(welcome);assert.match(welcome.text,/Willkommen zum Test/);assert.match(welcome.html,/logo/i);
  const count=await store.transaction(async s=>(await s.list('notification')).length);await call('/admin/company',admin,{id:'company-one',status:'approved',note:'Willkommen zum Test.'});assert.equal(await store.transaction(async s=>(await s.list('notification')).length),count);
 });
 await t.test('autoiXpert snapshots, dispatched reports and approved invoices are not removable',async()=>{
  await store.transaction(async s=>{await s.put('autoixpert_export',{id:cid,caseId:cid,state:'complete',files:[{id:photo.id}]},cid);});
  await act(admin,{action:'file_delete',fileId:photo.id,confirmed:true},403);await act(admin,{action:'file_kind',fileId:photo.id,kind:'document'},403);
  const report=await upload(admin,'report',pdf,'application/pdf','gutachten.pdf');await store.transaction(async s=>{const c=await s.get('case',cid);c.status='report_ready';await s.put('case',c,c.companyId);});
  await act(admin,{action:'file_delete',fileId:report.id,confirmed:true});assert.equal((await read(admin)).json.case.status,'in_progress');await act(admin,{action:'status',status:'report_ready'},400);await act(admin,{action:'file_restore',fileId:report.id,confirmed:true});
  await act(admin,{action:'status',status:'report_ready'});await store.transaction(async s=>{const c=await s.get('case',cid);c.dispatch={state:'sending',fileId:report.id};await s.put('case',c,c.companyId);});await act(admin,{action:'file_delete',fileId:report.id,confirmed:true},403);
  await store.transaction(async s=>{const c=await s.get('case',cid);c.status='report_sent';c.dispatch={state:'sent',fileId:report.id};c.finance={invoiceNet:100000,invoiceGross:119000,partnerNet:50000,agreement:'Test',agreedAt:new Date().toISOString(),partnerAcceptedAt:new Date().toISOString(),received:119000};await s.put('case',c,c.companyId);});
  await act(admin,{action:'file_delete',fileId:report.id,confirmed:true},403);
  const invoice=await upload(p,'partner_invoice',pdf,'application/pdf','rechnung.pdf');await act(p,{action:'file_delete',fileId:invoice.id,confirmed:true});assert.equal((await read()).json.case.finance.partnerInvoiceId,null);
  const replacement=await upload(p,'partner_invoice',pdf,'application/pdf','neue-rechnung.pdf');assert.notEqual(replacement.id,invoice.id);await act(p,{action:'file_restore',fileId:invoice.id,confirmed:true},403);
  await act(admin,{action:'approve_invoice',confirmed:true});await act(admin,{action:'file_delete',fileId:replacement.id,confirmed:true},403);
 });
 await t.test('Closed and declined case data cannot be overwritten through the API',async()=>{
  for(const status of ['closed','declined']){
   await store.transaction(async s=>{const c=await s.get('case',cid);c.status=status;await s.put('case',c,c.companyId);});
   const before=(await read(admin)).json.case.intake;
   await act(admin,{action:'save',...require('./fixtures/intake')(),plate:'SHOULD-NOT-SAVE'},400);
   assert.deepEqual((await read(admin)).json.case.intake,before);
   await act(admin,{action:'file_delete',fileId:bundle.id,confirmed:true},403);
  }
 });
 await t.test('Company vault PDFs have tenant-protected trash and byte-identical restore',async()=>{
  const added=await call('/documents',p,pdf,{'Content-Type':'application/pdf','X-File-Name':'vertrag.pdf'});assert.equal(added.status,200);const id=added.json.document.id;
  const data={action:'delete',confirmed:true};assert.equal((await call('/documents/'+id,other,data)).status,404);assert.equal((await call('/documents/'+id,p,{action:'delete'})).status,400);
  assert.equal((await call('/documents/'+id,p,data)).status,200);assert.equal((await raw('/documents/'+id,admin)).status,404);const listing=(await call('/documents',admin)).json;assert.equal(listing.documents.length,0);assert.equal(listing.deletedDocuments.length,1);assert.equal((await call('/documents',other)).json.deletedDocuments.length,0);
  assert.equal((await call('/documents/'+id,admin,{action:'restore',confirmed:true})).status,200);assert.deepEqual(Buffer.from(await (await raw('/documents/'+id,p)).arrayBuffer()),pdf);
  const internal=(await call('/documents',admin,Buffer.from('%PDF-1.4\n% PRIVATE\n%%EOF'),{'Content-Type':'application/pdf','X-File-Name':'intern.pdf'})).json.document;assert.equal((await call('/documents/'+internal.id,p,data)).status,404);
  const shared=(await call('/documents',admin,Buffer.from('%PDF-1.4\n% SHARED\n%%EOF'),{'Content-Type':'application/pdf','X-File-Name':'shared.pdf','X-Company-Id':'company-one'})).json.document;assert.equal((await call('/documents/'+shared.id,p,data)).status,403);
 });
 }finally{await new Promise(r=>server.close(r));await portal.close();}
});
