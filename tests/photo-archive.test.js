'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),sharp=require('sharp');
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const {createStore}=require('../portal/store'),{createPortal}=require('../portal/app');
const {crc32,entryName}=require('../portal/file-archive');
const digest=b=>createHash('sha256').update(b).digest('hex');
// Parse STORE entries independently and verify the central directory and ZIP terminator.
function unzip(bytes){let offset=0,entries=[];while(bytes.readUInt32LE(offset)===0x04034b50){assert.equal(bytes.readUInt16LE(offset+8),0);assert.equal(bytes.readUInt16LE(offset+6),2048);const size=bytes.readUInt32LE(offset+18),nl=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28),start=offset+30+nl+extra;entries.push({name:bytes.subarray(offset+30,offset+30+nl).toString(),bytes:bytes.subarray(start,start+size),offset});offset=start+size;}const centralOffset=offset;for(const entry of entries){assert.equal(bytes.readUInt32LE(offset),0x02014b50);assert.equal(bytes.readUInt32LE(offset+42),entry.offset);offset+=46+bytes.readUInt16LE(offset+28)+bytes.readUInt16LE(offset+30)+bytes.readUInt16LE(offset+32);}assert.equal(bytes.readUInt32LE(offset),0x06054b50);assert.equal(bytes.readUInt16LE(offset+10),entries.length);assert.equal(bytes.readUInt32LE(offset+16),centralOffset);assert.equal(offset+22,bytes.length);return entries;}

test('ZIP names prevent paths, duplicates and header injection; CRC matches the ZIP standard vector',()=>{assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);const long=entryName({name:'ü'.repeat(170)+'.jpg'},0);assert(Buffer.byteLength(long)<255);assert(long.endsWith('.jpg'));assert(!entryName({name:'../../Übersicht\r\n.jpg'},0).includes('/'));assert.notEqual(entryName({name:'same.jpg'},0),entryName({name:'same.jpg'},1));});

test('Partner sends 35 original photos and required PDFs; admin sees them, changes status and downloads an intact ZIP',async()=>{
 const env={NODE_ENV:'test',PORTAL_ORIGIN:'http://localhost',PORTAL_STORAGE_MB:'20',PORTAL_LOCAL_DB:':memory:'};
 const store=await createStore(env),sent=[],portal=createPortal({env,store,mail:{ready:true,send:async(...args)=>sent.push(args)}});
 const server=http.createServer((req,res)=>portal.handle(req,res,{}));await portal.ready();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 async function actor(role,companyId=''){const id=randomUUID(),token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');await store.transaction(async s=>{if(companyId)await s.put('company',{id:companyId,name:'Beispiel-Werkstatt',status:'approved'});await s.put('user',{id,email:id+'@example.test',name:'Test',active:true,verifiedAt:new Date().toISOString(),role,companyId},companyId||'internal');await s.put('session',{id:digest(token),userId:id,csrf,workspace:null,expires:Date.now()+600000},id);});return {cookie:'ux_session='+token,csrf,id};}
 async function call(path,data,user={},headers={}){const res=await fetch(base+'/api/portal'+path,{method:data===undefined?'GET':'POST',headers:{Origin:env.PORTAL_ORIGIN,'Content-Type':'application/json',Cookie:user.cookie||'','X-CSRF-Token':user.csrf||'',...headers},body:data===undefined?undefined:Buffer.isBuffer(data)?data:JSON.stringify(data)});const bytes=Buffer.from(await res.arrayBuffer());return {status:res.status,headers:res.headers,bytes,json:res.headers.get('content-type')?.includes('application/json')?JSON.parse(bytes):null};}
 try{
  const admin=await actor('admin'),partner=await actor('partner','workshop'),other=await actor('partner','other'),appraiser=await actor('appraiser');
  const created=await call('/cases',require('./fixtures/intake')(),partner);assert.equal(created.status,200);const cid=created.json.case.id,originals=[];
  for(let i=0;i<35;i++){const bytes=await sharp({create:{width:80+i,height:60,channels:3,background:{r:120+i,g:30,b:60}}}).jpeg().toBuffer();originals.push(bytes);const r=await call('/cases/'+cid+'/files',bytes,partner,{'Content-Type':'image/jpeg','X-File-Kind':'photo','X-File-Name':encodeURIComponent('Schaden '+(i+1)+'.jpg')});assert.equal(r.status,200);}
  for(const kind of ['registration','authorization']){const bytes=Buffer.from('%PDF-1.7\n'+kind+'\n%%EOF');const r=await call('/cases/'+cid+'/files',bytes,partner,{'Content-Type':'application/pdf','X-File-Kind':kind,'X-File-Name':kind+'.pdf'});assert.equal(r.status,200);}
  let c=(await call('/cases/'+cid,undefined,partner)).json.case;
  assert.equal((await call('/cases/'+cid,{action:'submit',version:c.version},partner)).status,200);
  const received=await call('/cases/'+cid,undefined,admin);assert.equal(received.json.case.status,'submitted');assert.equal(received.json.files.length,37);assert.equal(received.json.case.intake.plate,'B TEST 123');
  assert.equal((await call('/cases/'+cid,{action:'status',status:'review',version:received.json.case.version},admin)).status,200);
  assert.equal((await call('/cases/'+cid,undefined,partner)).json.case.status,'review');
  const zip=await call('/cases/'+cid+'/archive?scope=photos',undefined,admin);assert.equal(zip.status,200);assert.equal(zip.headers.get('content-type'),'application/zip');assert.equal(+zip.headers.get('content-length'),zip.bytes.length);assert.match(zip.headers.get('cache-control'),/no-store/);
  const entries=unzip(zip.bytes);assert.equal(entries.length,35);assert.deepEqual(entries.map(e=>digest(e.bytes)).sort(),originals.map(digest).sort());
  assert.equal(unzip((await call('/cases/'+cid+'/archive?scope=all',undefined,admin)).bytes).length,37);
  assert.equal((await call('/cases/'+cid+'/archive',undefined,other)).status,404);assert.equal((await call('/cases/'+cid+'/archive')).status,401);assert.equal((await call('/cases/'+cid+'/archive',undefined,appraiser)).status,404);assert.equal((await call('/cases/'+cid+'/archive?scope=bad',undefined,admin)).status,400);
  // Hidden reports and invoices are excluded by the same access rules as single files.
  await store.transaction(async s=>{const c=await s.get('case',cid);c.assignee=appraiser.id;await s.put('case',c,c.companyId);for(const kind of ['report','partner_invoice']){const id=randomUUID(),bytes=Buffer.from('%PDF-1.7\n'+kind+'\n%%EOF');await s.blob(id,bytes);await s.put('file',{id,caseId:cid,kind,type:'application/pdf',name:kind+'.pdf',size:bytes.length,sha256:digest(bytes),at:new Date().toISOString()},cid);}});
  assert.equal(unzip((await call('/cases/'+cid+'/archive?scope=all',undefined,admin)).bytes).length,39);
  const partnerFiles=unzip((await call('/cases/'+cid+'/archive?scope=all',undefined,partner)).bytes);assert.equal(partnerFiles.length,38);assert(!partnerFiles.some(x=>x.name.endsWith('-report.pdf')));
  const appraiserFiles=unzip((await call('/cases/'+cid+'/archive?scope=all',undefined,appraiser)).bytes);assert.equal(appraiserFiles.length,38);assert(!appraiserFiles.some(x=>x.name.includes('partner_invoice')));
  // Corrupt/missing original refuses a successful archive instead of silently omitting it.
  await store.transaction(async s=>{const f=(await s.list('file',cid)).filter(f=>f.kind==='photo').sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id))[0];await s.removeBlob(f.id);});
  assert.equal((await call('/cases/'+cid+'/archive',undefined,admin)).status,503);
 }finally{await new Promise(r=>server.close(r));await portal.close();}
});
