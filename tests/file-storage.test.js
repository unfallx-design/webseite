'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes,randomUUID,createHash}=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createStore}=require('../portal/store');
const {createFileStorage,storageConfig}=require('../portal/file-storage');
const {env,fakeS3}=require('./fixtures/s3');

test('S3 configuration is explicit, Frankfurt-only, private and fails closed',()=>{
  assert.equal(createFileStorage({}),null);
  assert.equal(storageConfig({}).limit,2048*1024*1024);
  for(const bad of [{PORTAL_FILE_STORAGE:'s3'},{...env,PORTAL_S3_REGION:'us-east-1'},{...env,PORTAL_S3_BUCKET:'https://evil.example'},{...env,PORTAL_S3_ACCOUNT_ID:'bad'},{PORTAL_STORAGE_MB:'NaN'},{PORTAL_STORAGE_MB:'-1'},{PORTAL_FILE_STORAGE:'unexpected'}])assert.throws(()=>createFileStorage(bad));
});
test('original bytes roundtrip with SHA256, encryption, expected owner and opaque keys',async()=>{
  const f=fakeS3(),bytes=randomBytes(2*1024*1024+7),ref=await f.files.write(bytes);
  assert.deepEqual(await f.files.read(ref),bytes);
  const put=f.calls[0].input;
  assert.equal(put.ExpectedBucketOwner,env.PORTAL_S3_ACCOUNT_ID);
  assert.equal(put.ServerSideEncryption,'AES256');
  assert.equal(put.ChecksumSHA256,createHash('sha256').update(bytes).digest('base64'));
  assert.equal(put.IfNoneMatch,'*');
  assert.equal(put.ACL,undefined);
  assert.match(put.Key,/^originals\/[a-f0-9-]{36}$/);
  for(const changed of [{key:'../private'},{bucket:'other-bucket'},{account:'111111111111'},{size:999999999}])await assert.rejects(f.files.read({...ref,...changed}),/FILE_STORAGE_REFERENCE/);
  f.state.corruptRead=true;
  await assert.rejects(f.files.read(ref),/FILE_STORAGE_INTEGRITY/);
});
test('S3 upload failure never commits file metadata or consumed quota; uncertain PUTs are cleaned',async()=>{
  for(const failure of ['failPut','putThenFail']) {
    const f=fakeS3(),s=await createStore(env,{fileStorage:f.files}),id=randomUUID();
    try {
      f.state[failure]=true;
      await assert.rejects(s.transaction(async q=>{await q.blob(id,Buffer.from('original'));await q.put('file',{id});await q.put('system',{id:'storage',bytes:8});}),/FILE_STORAGE_UNAVAILABLE/);
      assert.equal(await s.transaction(q=>q.get('file',id)),null);
      assert.equal(await s.transaction(q=>q.get('system','storage')),null);
      assert.equal(await s.transaction(q=>q.get('blob_location',id)),null);
      assert.equal(f.objects.size,0);
    } finally {await s.close();}
  }
});
test('SQL rollback cleans remote objects; committed delete is recoverable after an S3 outage',async()=>{
  const f=fakeS3(),s=await createStore(env,{fileStorage:f.files});
  try {
    await assert.rejects(s.transaction(async q=>{await q.blob(randomUUID(),Buffer.from('test'));throw Error('ROLLBACK');}),/ROLLBACK/);
    assert.equal(f.objects.size,0);
    const id=randomUUID(),bytes=Buffer.from('keep');await s.transaction(q=>q.blob(id,bytes));
    await assert.rejects(s.transaction(async q=>{await q.removeBlob(id);throw Error('ROLLBACK');}),/ROLLBACK/);
    assert.deepEqual(await s.transaction(q=>q.blob(id)),bytes);
    f.state.failDelete=true;
    await s.transaction(q=>q.removeBlob(id));
    assert.equal(f.objects.size,1);
    assert.equal((await s.transaction(q=>q.storageStats())).pendingDeletes,1);
    f.state.failDelete=false;
    await s.transaction(q=>q.get('system','storage'));
    assert.equal(f.objects.size,0);
    assert.equal((await s.transaction(q=>q.storageStats())).pendingDeletes,0);
  } finally {await s.close();}
});
test('database originals survive migration failure; verified migration survives restarts and write-backend rollback',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ux-s3-')),db=path.join(dir,'test.sqlite'),base={NODE_ENV:'test',PORTAL_LOCAL_DB:db};
  const f=fakeS3(),bytes=randomBytes(2*1024*1024+37),id=randomUUID();let s=await createStore(base);
  try {
    await s.transaction(async q=>{await q.blob(id,bytes);await q.put('file',{id,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});});
    await s.close();s=await createStore({...env,PORTAL_LOCAL_DB:db},{fileStorage:f.files});
    assert.deepEqual(await s.transaction(q=>q.blob(id)),bytes);
    f.state.corruptRead=true;
    await assert.rejects(s.transaction(q=>q.migrateBlob(id)),/FILE_STORAGE_INTEGRITY/);
    assert.deepEqual(await s.transaction(q=>q.blob(id)),bytes);
    assert.equal((await s.transaction(q=>q.storageStats())).legacyFiles,1);
    assert.equal(f.objects.size,0);
    f.state.corruptRead=false;
    assert.equal((await s.transaction(q=>q.migrateBlob(id))).migrated,true);
    assert.equal((await s.transaction(q=>q.storageStats())).legacyFiles,0);
    assert.deepEqual(await s.transaction(q=>q.blob(id)),bytes);
    assert.equal((await s.transaction(q=>q.migrateBlob(id))).migrated,false);
    await s.close();s=await createStore({...env,PORTAL_LOCAL_DB:db,PORTAL_FILE_STORAGE:'database'},{fileStorage:f.files});
    assert.deepEqual(await s.transaction(q=>q.blob(id)),bytes);
    const second=randomUUID();await s.transaction(q=>q.blob(second,bytes));
    assert.equal((await s.transaction(q=>q.storageStats())).legacyFiles,1);
    await assert.rejects(s.transaction(q=>q.blob(id,bytes)),/FILE_ALREADY_EXISTS/);
  } finally {await s.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('failed cleanup after SQL rollback is persisted and retried without deleting another original',async()=>{
  const f=fakeS3(),s=await createStore(env,{fileStorage:f.files});
  try {
    const kept=randomUUID();await s.transaction(q=>q.blob(kept,Buffer.from('keep')));
    f.state.failDelete=true;
    await assert.rejects(s.transaction(async q=>{await q.blob(randomUUID(),Buffer.from('discard'));throw Error('ROLLBACK');}),/ROLLBACK/);
    assert.equal((await s.transaction(q=>q.storageStats())).pendingDeletes,1);
    f.state.failDelete=false;
    await s.transaction(q=>q.get('system','storage'));
    assert.equal(f.objects.size,1);
    assert.equal((await s.transaction(q=>q.blob(kept))).toString(),'keep');
  } finally {await s.close();}
});
