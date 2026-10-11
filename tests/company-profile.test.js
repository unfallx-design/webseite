'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('../portal/domain'),P=require('../portal/passwords'),{createPortal}=require('../portal/app'),{createStore}=require('../portal/store'),{verifyIdentity}=require('../portal/oauth');
const password='Dies ist mein sicherer Test Merksatz!';
async function harness(config={}){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ux-auth4-')),env={NODE_ENV:'test',PORTAL_LOCAL_DB:path.join(dir,'test.sqlite'),PORTAL_ORIGIN:'http://localhost',PORTAL_TRUST_PROXY:'true',...config};const messages=[];let fail=false;const mail={ready:true,send:async(to,subject,text,attachments,html,messageId)=>{if(fail)throw Error('TEST_SMTP_UNCERTAIN');messages.push({to,subject,text,html,messageId});}};const store=await createStore(env),portal=createPortal({env,store,mail});await portal.ready();const server=http.createServer((req,res)=>portal.handle(req,res,{}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let n=0;
 async function call(route,data,actor={},more={}){const res=await fetch(base+'/api/portal'+route,{method:data===undefined?'GET':'POST',headers:{Origin:env.PORTAL_ORIGIN,'Content-Type':'application/json','X-Forwarded-For':'test-'+(++n),...(actor.cookie?{Cookie:actor.cookie,'X-CSRF-Token':actor.csrf||''}:{}),...(more.headers||{})},body:data===undefined?undefined:JSON.stringify(data),redirect:'manual'});return {status:res.status,json:res.headers.get('content-type')?.includes('json')?await res.json():{},cookie:res.headers.get('set-cookie'),location:res.headers.get('location')};}
 async function actor(response){assert.equal(response.status,200,JSON.stringify(response.json));const a={cookie:response.cookie.split(';')[0]};const me=await call('/me',undefined,a);return {...a,csrf:me.json.csrf,user:me.json.user,company:me.json.company};}
 async function register(email,extra={}){const r=await call('/register',{email,company:'Testbetrieb GmbH',contact:'Testpartner',street:'Teststraße 1',postcode:'10115',city:'Berlin',type:'Werkstatt',phone:'030123456',privacy:true,terms:true,password,...extra});assert.equal(r.status,200,JSON.stringify(r.json));const token=messages.findLast(m=>m.to===email).text.match(/#token=([a-f0-9]+)/)[1];const a=await actor(await call('/exchange',{token,password}));await store.transaction(async s=>{const co=await s.get('company',a.user.companyId);co.status='approved';await s.put('company',co);});return a;}
 async function admin(){await call('/login',{email:'info@unfallx.com'});const token=messages.findLast(m=>m.to==='info@unfallx.com').text.match(/#token=([a-f0-9]+)/)[1];return actor(await call('/exchange',{token}));}
 async function drain(){for(let i=0;i<100;i++){const rows=await store.transaction(s=>s.list('notification'));if(!rows.some(r=>['pending','sending'].includes(r.state)))return;await new Promise(r=>setTimeout(r,10));}assert.fail('outbox did not drain');}
 return {env,store,portal,base,call,actor,register,admin,messages,drain,fail(value){fail=value;},async close(){await drain();await new Promise(r=>server.close(r));await portal.close();fs.rmSync(dir,{recursive:true,force:true});}};}

test('Company profile and evidence remain scoped, validated, versioned and usable while pending',async()=>{
 const h=await harness();
 try {
  const a=await h.register('company-a@example.test'),b=await h.register('company-b@example.test'),admin=await h.admin();
  await h.store.transaction(async s=>{const co=await s.get('company',a.company.id);co.status='pending';await s.put('company',co);});
  assert.equal((await h.call('/company/profile')).status,401);
  assert.equal((await h.call('/company/profile',undefined,admin)).status,403);
  const loaded=await h.call('/company/profile',undefined,a);assert.equal(loaded.status,200);assert.equal(loaded.json.profile.version,0);
  const data={...loaded.json.profile,name:'Neuer Firmenname GmbH',accountHolder:'Neuer Firmenname GmbH',iban:'de89 3704 0044 0532 0130 00',bic:'COBADEFFXXX',taxNumber:'12/345/67890',vatId:'DE123456789',register:'HRB 12345',companyId:b.company.id,status:'approved',id:b.company.id,role:'admin'};
  assert.equal((await h.call('/company/profile',data,{...a,csrf:'bad'})).status,403);
  assert.equal((await h.call('/company/profile',{...data,iban:'DE00370400440532013000'},a)).status,400);
  assert.equal((await h.call('/company/profile',{...data,bic:'bad'},a)).status,400);
  assert.equal((await h.call('/company/profile',{...data,accountHolder:''},a)).status,400);
  const save=await h.call('/company/profile',data,a);assert.equal(save.status,200,JSON.stringify(save));assert.equal(save.json.profile.version,1);assert.equal(save.json.profile.id,a.company.id);assert.equal(save.json.profile.status,'pending');assert.equal(save.json.profile.iban,'DE89370400440532013000');
  assert.equal((await h.call('/company/profile',data,a)).status,409);
  const unchanged=await h.call('/company/profile',undefined,b);assert.equal(unchanged.json.profile.name,'Testbetrieb GmbH');assert.equal(unchanged.json.profile.iban,'');
  const adminView=await h.call('/admin/overview',undefined,admin);const co=adminView.json.companies.find(c=>c.id===a.company.id);assert.equal(co.taxNumber,'12/345/67890');assert.equal(co.profileNeedsReview,true);assert.equal(co.status,'pending');
  const events=await h.store.transaction(s=>s.list('admin_event'));assert.ok(events.some(e=>e.companyId===a.company.id&&e.action==='Firmendaten aktualisiert'));assert.ok(!JSON.stringify(events).includes(data.taxNumber));
  const {PDFDocument}=require('pdf-lib'),pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());
  async function upload(actor,category,content=bytes,extra={}){const response=await fetch(h.base+'/api/portal/documents',{method:'POST',headers:{Origin:h.env.PORTAL_ORIGIN,Cookie:actor.cookie,'X-CSRF-Token':actor.csrf,'Content-Type':'application/pdf','X-File-Name':encodeURIComponent('Gewerbeanmeldung.pdf'),'X-Document-Category':category,...extra},body:content});return {status:response.status,json:await response.json()};}
  assert.equal((await upload(a,'forged')).status,400);assert.equal((await upload(a,'certificate',Buffer.from('not pdf'))).status,415);
  const uploaded=await upload(a,'business_registration',bytes,{'X-Company-Id':b.company.id});assert.equal(uploaded.status,200,JSON.stringify(uploaded));const doc=uploaded.json.document;assert.equal(doc.companyId,a.company.id);assert.equal(doc.category,'business_registration');
  assert.equal((await upload(a,'business_registration')).json.document.id,doc.id,'retries do not duplicate evidence');
  const certificate=await upload(a,'certificate');assert.equal(certificate.status,200);assert.notEqual(certificate.json.document.id,doc.id,'category is part of duplicate identity');
  assert.equal((await h.call('/documents',undefined,a)).json.documents.length,2);
  assert.equal((await h.call('/documents',undefined,b)).json.documents.length,0);
  assert.equal((await h.call('/documents',undefined,admin)).json.documents.length,2);
  assert.equal((await h.call('/documents/'+doc.id,undefined,b)).status,404);
  const download=await fetch(h.base+'/api/portal/documents/'+doc.id,{headers:{Cookie:a.cookie,Origin:h.env.PORTAL_ORIGIN}});assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
  assert.equal((await h.call('/documents/'+doc.id,{action:'delete',confirmed:true},b)).status,404);
  assert.equal((await h.call('/documents/'+doc.id,{action:'delete',confirmed:true},a)).status,200);
  assert.equal((await h.call('/documents/'+doc.id,undefined,a)).status,404);
  assert.equal((await h.call('/documents/'+doc.id,{action:'restore',confirmed:true},a)).status,200);
  await h.store.transaction(async s=>{const co=await s.get('company',a.company.id);co.status='suspended';await s.put('company',co);});
  assert.equal((await h.call('/company/profile',undefined,a)).status,403);assert.equal((await upload(a,'certificate')).status,403);
 } finally {await h.close();}
});

test('IBAN checksum rejects invalid forms and accepts supported international accounts',()=>{
 const {validIBAN}=require('../portal/company-profile');
 for(const value of ['DE89370400440532013000','GB82WEST12345698765432','FR1420041010050500013M02606'])assert.equal(validIBAN(value),true);
 for(const value of ['','DE00370400440532013000','DE893704004405320130001','DE89<svg>','1234567890123456'])assert.equal(validIBAN(value),false);
});
