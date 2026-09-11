'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),sharp=require('sharp');
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const {createStore}=require('../portal/store'),{createPortal}=require('../portal/app');
const {fakeS3,env:fixtureEnv}=require('./fixtures/s3');
const digest=b=>createHash('sha256').update(b).digest('hex');

test('HTTP S3 integration: original photos, previews, PDFs, tenant boundaries, quota and storage administration',async()=>{
  const env={...fixtureEnv,PORTAL_ORIGIN:'http://localhost',PORTAL_STORAGE_MB:'10'},f=fakeS3();
  const store=await createStore(env,{fileStorage:f.files}),portal=createPortal({env,store,mail:{ready:true,send:async()=>{}}});
  const server=http.createServer((req,res)=>portal.handle(req,res,{}));
  await portal.ready();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  async function actor(role,companyId='') {
    const id=randomUUID(),token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');
    await store.transaction(async s=>{
      if(companyId)await s.put('company',{id:companyId,name:'Fixture workshop',status:'approved'});
      await s.put('user',{id,email:id+'@example.com',name:'Fixture',active:true,verifiedAt:new Date().toISOString(),role,companyId},companyId||'internal');
      await s.put('session',{id:digest(token),userId:id,csrf,workspace:null,expires:Date.now()+600000},id);
    });
    return {cookie:'ux_session='+token,csrf,id};
  }
  async function call(path,data,user={},headers={}) {
    const res=await fetch(base+'/api/portal'+path,{method:data===undefined?'GET':'POST',headers:{Origin:env.PORTAL_ORIGIN,'Content-Type':'application/json',Cookie:user.cookie||'','X-CSRF-Token':user.csrf||'',...headers},body:data===undefined?undefined:Buffer.isBuffer(data)?data:JSON.stringify(data)});
    const bytes=Buffer.from(await res.arrayBuffer());
    return {status:res.status,headers:res.headers,bytes,json:res.headers.get('content-type')?.includes('application/json')?JSON.parse(bytes):null};
  }
  try {
    const admin=await actor('admin'),partner=await actor('partner','one'),other=await actor('partner','two');
    const created=await call('/cases',require('./fixtures/intake')(),partner);
    assert.equal(created.status,200,JSON.stringify(created.json));
    const cid=created.json.case.id;
    const image=await sharp({create:{width:30,height:20,channels:3,background:'#e12428'}}).jpeg().toBuffer();
    const photo=await call('/cases/'+cid+'/files',image,partner,{'Content-Type':'image/jpeg','X-File-Kind':'photo','X-File-Name':'Original.jpg'});
    assert.equal(photo.status,200,JSON.stringify(photo.json));
    assert.equal(JSON.stringify(photo.json).includes('originals/'),false);
    assert.equal(JSON.stringify(photo.json).includes(env.PORTAL_S3_BUCKET),false);
    const fid=photo.json.file.id;
    for(const user of [partner,admin])assert.deepEqual((await call('/files/'+fid,undefined,user)).bytes,image);
    assert.equal((await call('/files/'+fid,undefined,other)).status,404);
    assert.equal((await call('/files/'+fid)).status,401);
    assert.match((await call('/files/'+fid,undefined,partner)).headers.get('cache-control'),/no-store/);
    assert.equal((await call('/files/'+fid+'/preview',undefined,admin)).headers.get('content-type'),'image/webp');
    const retry=await call('/cases/'+cid+'/files',image,partner,{'Content-Type':'image/jpeg','X-File-Kind':'photo','X-File-Name':'Original.jpg'});
    assert.equal(retry.json.file.id,fid);assert.equal(f.objects.size,1);
    const pdf=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(1024*1024+7,32),Buffer.from('\n%%EOF')]);
    const document=await call('/documents',pdf,partner,{'Content-Type':'application/pdf','X-File-Name':'Auftrag.pdf'});
    assert.equal(document.status,200,JSON.stringify(document.json));
    assert.deepEqual((await call('/documents/'+document.json.document.id,undefined,admin)).bytes,pdf);
    assert.equal((await call('/documents/'+document.json.document.id,undefined,other)).status,404);
    assert.equal((await call('/admin/storage',undefined,partner)).status,403);
    assert.equal((await call('/admin/storage/check',{},partner)).status,403);
    assert.equal((await call('/admin/storage/check',{},{cookie:admin.cookie})).status,403);
    const health=await call('/admin/storage/check',{},admin);
    assert.equal(health.status,200);assert.equal(health.json.storage.remoteFiles,2);assert.equal(health.json.storage.legacyFiles,0);
    assert.equal(health.json.storage.used,image.length+pdf.length);
    // A provider outage does not prevent authentication or reading case metadata.
    f.state.failGet=true;
    assert.equal((await call('/me',undefined,partner)).status,200);
    assert.equal((await call('/cases/'+cid,undefined,admin)).status,200);
    assert.equal((await call('/files/'+fid,undefined,admin)).status,500);
    f.state.failGet=false;f.state.failPut=true;
    const failed=await call('/documents',Buffer.from('%PDF-1.7\ndifferent\n%%EOF'),partner,{'Content-Type':'application/pdf','X-File-Name':'Andere.pdf'});
    assert.equal(failed.status,500);assert(!failed.bytes.toString().includes('fixture-private-provider-error'));
    assert.equal((await call('/admin/storage',undefined,admin)).json.used,image.length+pdf.length);
    f.state.failPut=false;
    // Existing SQL originals can be migrated through the admin-only API.
    const old=randomUUID(),bytes=Buffer.from('%PDF-1.7\nlegacy\n%%EOF');
    await store.transaction(async s=>{await s.probeBlob(old,bytes);await s.put('vault_document',{id:old,companyId:'one',type:'application/pdf',name:'Legacy.pdf',size:bytes.length,sha256:digest(bytes)});});
    assert.equal((await call('/admin/storage/migrate',{confirmed:true},partner)).status,403);
    assert.equal((await call('/admin/storage/migrate',{confirmed:false},admin)).status,400);
    const migration=await call('/admin/storage/migrate',{confirmed:true},admin);
    assert.equal(migration.status,200,JSON.stringify(migration.json));assert.equal(migration.json.migrated,1);
    assert.deepEqual((await call('/documents/'+old,undefined,partner)).bytes,bytes);
    assert.equal((await call('/admin/storage/migrate',{confirmed:true},admin)).json.migrated,0);
    const before=f.objects.size;
    await store.transaction(s=>s.put('system',{id:'storage',bytes:10*1024*1024}));
    assert.equal((await call('/documents',Buffer.from('%PDF-1.7\nquota\n%%EOF'),partner,{'Content-Type':'application/pdf','X-File-Name':'Limit.pdf'})).status,507);
    assert.equal(f.objects.size,before);
  } finally {await new Promise(r=>server.close(r));await portal.close();}
});

test('native iPhone intake also persists original photo and PDF bytes in S3',async()=>{
  const {createMobileIntake}=require('../portal/mobile-intake');
  const f=fakeS3(),s=await createStore(fixtureEnv,{fileStorage:f.files}),cid=randomUUID(),token=randomBytes(32).toString('hex');
  const tx=fn=>s.transaction(fn),api=createMobileIntake({tx,body:async(req,max,raw)=>raw?req.bytes:req.payload,rate:async()=>{},ip:()=> 'local',env:{...fixtureEnv,PORTAL_MOBILE_INTAKE_ENABLED:'true'},authorize:async()=>({user:{id:'partner',name:'Testpartner',role:'partner',companyId:'company'},company:{id:'company',status:'approved',name:'Testbetrieb'}})});
  const fields={'claimant.first':'Alex','claimant.last':'Beispiel','claimant.street':'Musterstraße 12','claimant.zip':'10115','claimant.city':'Berlin',plate:'B UX 123'};
  const req=(payload,bytes,headers={})=>({method:'POST',payload,bytes,headers:{authorization:'Bearer '+token,...headers}});
  try {
    await api.route('/mobile/cases',req({id:cid,fields,fieldsHash:digest(JSON.stringify(fields)),reference:'TEST'}));
    const photo=await sharp({create:{width:10,height:10,channels:3,background:'white'}}).jpeg().toBuffer();
    for(const [kind,type,name,bytes] of [['photo','image/jpeg','Original.jpg',photo],['authorization','application/pdf','Auftrag.pdf',Buffer.from('%PDF-1.7\nNative test\n%%EOF')]]) {
      const uploaded=await api.route('/mobile/cases/'+cid+'/files',req(null,bytes,{'x-file-kind':kind,'x-file-name':name,'content-type':type,'x-asset-id':randomUUID(),'x-order-kind':'unfallx','x-fields-hash':digest(JSON.stringify(fields))}));
      assert.deepEqual(await tx(q=>q.blob(uploaded.id)),bytes);
    }
    const stats=await tx(q=>q.storageStats());assert.equal(stats.remoteFiles,2);assert.equal(stats.legacyFiles,0);
  } finally {await s.close();}
});
