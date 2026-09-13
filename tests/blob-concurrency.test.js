'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createStore}=require('../portal/store'),{attachBlobService}=require('../portal/blob-service'),{fakeS3,env}=require('./fixtures/s3');
const gate=()=>{let release,entered;const waiting=new Promise(r=>release=r),started=new Promise(r=>entered=r);return {release,entered,waiting,started};};
const fast=p=>Promise.race([p,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Metadata blocked by S3 I/O')),400);t.unref();})]);
const put=(s,b)=>s.writeBlob(b,async(q,staged)=>{await staged.attach(q);return staged.id;});
test('delayed S3 PUT, GET and DELETE never hold the serialized metadata transaction',async t=>{
 const f=fakeS3(),s=await createStore(env,{fileStorage:f.files});t.after(()=>s.close());
 const originalWrite=f.files.write,writeGate=gate();f.files.write=async(...args)=>{const ref=await originalWrite(...args);writeGate.entered();await writeGate.waiting;return ref;};
 const write=put(s,Buffer.from('original'));await writeGate.started;
 await fast(s.transaction(async q=>{await q.put('case',{id:'other-user',status:'review'});assert.equal((await q.get('case','other-user')).status,'review');}));writeGate.release();const id=await write;f.files.write=originalWrite;
 const originalRead=f.files.read,readGate=gate();f.files.read=async ref=>{const bytes=await originalRead(ref);readGate.entered();await readGate.waiting;return bytes;};
 let allowed=true;const read=s.readBlob(id,async()=>{assert(allowed,'revoked');});await readGate.started;await fast(s.transaction(q=>q.put('user',{id:'viewer',active:false})));allowed=false;readGate.release();await assert.rejects(read,/revoked/);f.files.read=originalRead;
 assert.equal((await s.readBlob(id)).toString(),'original');
 await s.cleanupBlobs();const originalDelete=f.files.remove,deleteGate=gate();f.files.remove=async ref=>{deleteGate.entered();await deleteGate.waiting;return originalDelete(ref);};await s.transaction(q=>q.removeBlob(id));const cleanup=s.cleanupBlobs();await deleteGate.started;await fast(s.transaction(q=>q.get('case','other-user')));deleteGate.release();await cleanup;assert.equal(f.objects.size,0);
});
test('simultaneous staged files recheck quota at commit and clean the rejected upload',async t=>{
 const f=fakeS3(),s=await createStore(env,{fileStorage:f.files});t.after(()=>s.close());const bytes=Buffer.from('12345678');
 const commit=()=>s.writeBlob(bytes,async(q,stage)=>{const usage=await q.get('system','storage')||{id:'storage',bytes:0};assert(usage.bytes+bytes.length<=8,'quota');await stage.attach(q);usage.bytes+=bytes.length;await q.put('system',usage);return stage.id;});
 const results=await Promise.allSettled([commit(),commit()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);await s.cleanupBlobs();await s.cleanupBlobs();assert.equal(f.objects.size,1);assert.equal((await s.transaction(q=>q.get('system','storage'))).bytes,8);
});
test('lost metadata COMMIT response retains the committed original and does not delete it',async t=>{
 const base=await createStore({NODE_ENV:'test',PORTAL_LOCAL_DB:':memory:'}),f=fakeS3();let lose=false;
 const s=attachBlobService({transaction:async fn=>{const result=await base.transaction(fn);if(lose){lose=false;throw Object.assign(Error('COMMIT response lost'),{commitUncertain:true});}return result;},close:()=>base.close()},f.files,'s3');t.after(()=>s.close());let id;
 await assert.rejects(s.writeBlob(Buffer.from('committed'),async(q,stage)=>{id=stage.id;await stage.attach(q);await q.put('file',{id,size:9});lose=true;}),/COMMIT response lost/);
 await s.cleanupBlobs();assert.equal((await s.readBlob(id)).toString(),'committed');assert.equal(f.objects.size,1);
});
test('remote file I/O fails fast inside a metadata transaction to prevent regressions',async t=>{
 const f=fakeS3(),s=await createStore(env,{fileStorage:f.files});t.after(()=>s.close());await assert.rejects(s.transaction(q=>q.blob('bad',Buffer.from('x'))),/FILE_IO_REQUIRES_STORE/);const id=await put(s,Buffer.from('x'));await assert.rejects(s.transaction(q=>q.blob(id)),/FILE_IO_REQUIRES_STORE/);assert.equal((await s.readBlob(id)).toString(),'x');
});
