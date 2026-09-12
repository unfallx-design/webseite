'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const {createStore}=require('../portal/store'),{createPortal}=require('../portal/app');
const digest=b=>createHash('sha256').update(b).digest('hex');

test('independent workspace folders preserve files, shared case state, finances and authorization',async()=>{
 const env={NODE_ENV:'test',PORTAL_ORIGIN:'http://localhost',PORTAL_LOCAL_DB:':memory:'};
 const store=await createStore(env),sent=[],portal=createPortal({env,store,mail:{ready:true,send:async(...args)=>sent.push(args)}});
 const server=http.createServer((req,res)=>portal.handle(req,res,{}));await portal.ready();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 async function actor(role,companyId=''){const id=randomUUID(),token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');await store.transaction(async s=>{if(companyId)await s.put('company',{id:companyId,name:'Testbetrieb',status:'approved'});await s.put('user',{id,email:id+'@example.test',name:'Test',active:true,verifiedAt:new Date().toISOString(),role,companyId},companyId||'internal');await s.put('session',{id:digest(token),userId:id,csrf,workspace:null,expires:Date.now()+600000},id);});return {cookie:'ux_session='+token,csrf,id};}
 async function call(path,user={},data,headers={}){const r=await fetch(base+'/api/portal'+path,{method:data===undefined?'GET':'POST',headers:{Origin:env.PORTAL_ORIGIN,'Content-Type':'application/json',Cookie:user.cookie||'','X-CSRF-Token':user.csrf||'',...headers},body:data===undefined?undefined:JSON.stringify(data)});const bytes=Buffer.from(await r.arrayBuffer());return {status:r.status,bytes,json:r.headers.get('content-type')?.includes('application/json')?JSON.parse(bytes):null};}
 try{
  const partner=await actor('partner','workshop'),coworker=await actor('partner','workshop'),other=await actor('partner','other'),admin=await actor('admin'),admin2=await actor('admin'),appraiser=await actor('appraiser'),unassigned=await actor('appraiser');
  const cid=randomUUID(),file=randomUUID(),bytes=Buffer.from('%PDF-1.7\nOriginal contract\n%%EOF');
  const original={id:cid,number:'UX-FILING',companyId:'workshop',companyName:'Testbetrieb',status:'submitted',version:7,assignee:appraiser.id,createdAt:'2026-09-12T10:00:00Z',updatedAt:'2026-09-12T10:00:00Z',intake:{vehicle:'Testwagen',plate:'B TEST 1'},finance:{partnerNet:120000,invoiceNet:240000,invoiceGross:285600,received:285600}};
  await store.transaction(async s=>{await s.put('case',original,'workshop');await s.blob(file,bytes);await s.put('file',{id:file,caseId:cid,kind:'authorization',type:'application/pdf',name:'Auftrag.pdf',size:bytes.length,sha256:digest(bytes),at:original.createdAt},cid);});
  assert.equal((await call('/cases',partner)).json.cases.length,1);
  // Authentication, CSRF, tenancy and internal permissions are enforced before mutation.
  const endpoint='/cases/'+cid+'/filing',archive={folder:'archived',version:0};
  assert.equal((await call(endpoint,{},archive)).status,401);
  assert.equal((await call(endpoint,partner,archive,{'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await call(endpoint,partner,archive,{Origin:'https://evil.example'})).status,403);
  assert.equal((await call(endpoint,other,archive)).status,404);
  assert.equal((await call(endpoint,unassigned,archive)).status,404);
  assert.equal((await call(endpoint,appraiser,archive)).status,403);
  assert.equal((await call(endpoint,partner,{folder:'destroy',version:0})).status,400);
  assert.equal((await call('/cases?folder=unknown',partner)).status,400);
  assert.equal((await call(endpoint,partner,{folder:'deleted',version:0})).status,400);
  assert.equal((await call(endpoint,partner,{folder:'archived'})).status,409);
  assert.equal((await call(endpoint,partner,{...archive,scope:'internal',companyId:'other'})).status,200);
  assert.equal((await call('/cases',partner)).json.cases.length,0);
  assert.equal((await call('/cases',coworker)).json.cases.length,0);
  assert.equal((await call('/cases',admin)).json.cases.length,1);
  const archived=(await call('/cases?folder=archived',partner)).json;
  assert.deepEqual(archived.folders,{active:0,archived:1,deleted:0});assert.equal(archived.cases[0].filing.folder,'archived');assert.equal(archived.cases[0].filing.version,1);
  assert.equal((await call('/cases?folder=archived',other)).json.cases.length,0);
  assert.equal((await call(endpoint,partner,{folder:'active',version:0})).status,409);
  // Administration has its own version and folder, shared only with internal staff.
  assert.equal((await call(endpoint,admin,{folder:'deleted',version:0,confirmed:true})).status,200);
  assert.equal((await call('/cases',admin2)).json.cases.length,0);
  assert.equal((await call('/cases?folder=deleted',appraiser)).json.cases[0].filing.canManage,false);
  assert.equal((await call('/cases?folder=archived',partner)).json.cases.length,1);
  assert.equal((await call('/cases/'+cid,admin)).json.case.filing.folder,'deleted');
  assert.equal((await call('/cases/'+cid,partner)).json.case.filing.folder,'archived');
  assert.deepEqual((await call('/files/'+file,partner)).bytes,bytes);
  assert.deepEqual((await call('/files/'+file,admin)).bytes,bytes);
  assert.equal((await call('/cases/'+cid+'/archive?scope=all',admin)).status,200);
  assert.equal((await call('/cases?folder=all',partner)).json.cases[0].finance.partnerNet,120000);
  assert.equal((await call('/cases?folder=all',other)).json.cases.length,0);
  // Soft deletion is reversible; restoring either workspace leaves the other untouched.
  assert.equal((await call(endpoint,partner,{folder:'deleted',version:1,confirmed:true})).status,200);
  assert.equal((await call(endpoint,coworker,{folder:'active',version:2})).status,200);
  assert.equal((await call('/cases',partner)).json.cases.length,1);
  assert.equal((await call('/cases',admin)).json.cases.length,0);
  assert.equal((await call(endpoint,admin2,{folder:'active',version:1})).status,200);
  assert.equal((await call('/cases',admin)).json.cases.length,1);
  assert.equal((await call('/cases',partner)).json.cases.length,1);
  // Repeated restore is idempotent; filing creates no case-status event or mail.
  assert.equal((await call(endpoint,admin,{folder:'active',version:2})).json.filing.version,2);
  await store.transaction(async s=>{assert.deepEqual(await s.get('case',cid),original);assert.deepEqual(await s.blob(file),bytes);assert.equal((await s.list('event',cid)).length,0);assert.equal((await s.list('notification')).length,0);assert.equal((await s.list('case_folder_event','internal')).length,2);assert.equal((await s.list('case_folder_event','partner:workshop')).length,3);});
  assert.equal(sent.length,0);
 }finally{await new Promise(r=>server.close(r));await portal.close();}
});
