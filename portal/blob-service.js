'use strict';
const {randomUUID,createHash}=require('node:crypto');
const fail=code=>Object.assign(new Error(code),{code});
// Database metadata is serialized briefly. Object I/O never holds that lock.
function attachBlobService(store, files, backend) {
 const tx=store.transaction.bind(store);let draining=null,closed=false,writing=0;
 async function cleanup(){if(draining||closed)return draining;draining=(async()=>{
  for(let n=0;n<4;n++){
   const job=await tx(async s=>{
    const now=Date.now();const uploads=(await s.list('blob_upload')).filter(r=>r.expires<now);
    for(const row of uploads.slice(0,4)){
     if(!await s.get('blob_location',row.id)&&row.ref)await s.put('blob_delete',{...row.ref,id:row.id,attempts:0});
     await s.remove('blob_upload',row.id);
    }
    const row=(await s.list('blob_delete')).find(r=>(!r.lease||r.lease.expires<now)&&(!r.nextAttempt||r.nextAttempt<=now));if(!row)return null;
    // A reference is never destroyed on the strength of an uncertain COMMIT.
    if((await s.list('blob_location')).some(r=>r.key===row.key)){await s.remove('blob_delete',row.id);return {skip:true};}
    row.lease={id:randomUUID(),expires:now+120000};await s.put('blob_delete',row);return row;
   });
   if(!job)break;if(job.skip)continue;
   let ok=false;try{await files.remove(job);ok=true;}catch{}
   await tx(async s=>{const row=await s.get('blob_delete',job.id);if(row?.lease?.id!==job.lease.id)return;if(ok)await s.remove('blob_delete',row.id);else{delete row.lease;row.attempts=(row.attempts||0)+1;row.nextAttempt=Date.now()+Math.min(3600000,30000*2**Math.min(row.attempts,6));await s.put('blob_delete',row);}});
  }
 })().catch(()=>{}).finally(()=>draining=null);return draining;}
 async function stageBlob(bytes, callback){
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>25*1024*1024)throw fail('FILE_STORAGE_SIZE');
  const id=randomUUID();let ref=null;
  if(backend==='s3'){
   await tx(s=>s.put('blob_upload',{id,expires:Date.now()+10*60000,ref:null}));
   try{ref=await files.write(bytes,async next=>{ref=next;await tx(s=>s.put('blob_upload',{id,expires:Date.now()+10*60000,ref:next}));});}
   catch(e){await tx(async s=>{const row=await s.get('blob_upload',id);if(row){row.expires=0;await s.put('blob_upload',row);}}).catch(()=>{});void cleanup();throw e;}
  }
  const staged={id,attach:async(s)=>{if(ref){const row=await s.get('blob_upload',id);if(!row||row.expires<Date.now()||row.ref?.key!==ref.key)throw fail('FILE_STAGE_EXPIRED');await s.attachBlob(id,ref);await s.remove('blob_upload',id);}else await s.blob(id,bytes);}};
  try{const result=await tx(s=>callback(s,staged));if(ref)await tx(async s=>{const row=await s.get('blob_upload',id);if(row){row.expires=0;await s.put('blob_upload',row);}}).catch(()=>{});return result;}
  catch(e){if(ref&&!e.commitUncertain)await tx(async s=>{const row=await s.get('blob_upload',id);if(row){row.expires=0;await s.put('blob_upload',row);}}).catch(()=>{});throw e;}
  finally{if(ref)void cleanup();}
 }
 async function writeBlob(bytes,callback){if(writing>=6)throw Object.assign(fail('FILE_STORAGE_BUSY'),{status:429});writing++;try{return await stageBlob(bytes,callback);}finally{writing--;}}
 async function readBlob(id, authorize=async()=>{}){
  const source=await tx(async s=>{await authorize(s);return s.blobSource(id);});if(!source)return null;
  const bytes=source.ref?await files.read(source.ref):source.bytes;
  await tx(async s=>{await authorize(s);const current=await s.blobSource(id,false);if(!current||source.ref&&current.ref?.key!==source.ref.key)throw fail('FILE_NO_LONGER_AVAILABLE');});
  return bytes;
 }
 // Migration needs a verified object before the final metadata switch.
 async function migrate(id){
  if(backend!=='s3')throw fail('FILE_STORAGE_NOT_ENABLED');
  const source=await tx(async s=>({bytes:await s.legacyBytes(id),expected:await s.get('file',id)||await s.get('vault_document',id)}));
  if(!source.bytes)return {migrated:false,bytes:0};
  const sha=createHash('sha256').update(source.bytes).digest('hex');if(source.expected&&(source.expected.size!==source.bytes.length||source.expected.sha256&&source.expected.sha256!==sha))throw fail('FILE_STORAGE_INTEGRITY');
  const stageId=randomUUID();let ref;
  await tx(s=>s.put('blob_upload',{id:stageId,expires:Date.now()+10*60000}));
  try{
   ref=await files.write(source.bytes,async next=>{ref=next;await tx(s=>s.put('blob_upload',{id:stageId,ref:next,expires:Date.now()+10*60000}));});
   if(!(await files.read(ref)).equals(source.bytes))throw fail('FILE_STORAGE_INTEGRITY');
   const result=await tx(async s=>{const row=await s.get('blob_upload',stageId);if(!row||row.expires<Date.now())throw fail('FILE_STAGE_EXPIRED');const current=await s.legacyBytes(id);if(!current)return {migrated:false,bytes:0};if(!current.equals(source.bytes))throw fail('FILE_STORAGE_INTEGRITY');const existing=await s.get('blob_location',id);if(!existing)await s.attachBlob(id,ref);else{if(existing.sha256!==sha||existing.size!==source.bytes.length)throw fail('FILE_STORAGE_INTEGRITY');row.expires=0;await s.put('blob_upload',row);await s.removeLegacy(id);return {migrated:true,bytes:source.bytes.length};}await s.remove('blob_upload',stageId);await s.removeLegacy(id);return {migrated:true,bytes:source.bytes.length};});return result;
  }catch(e){if(!e.commitUncertain)await tx(async s=>{const row=await s.get('blob_upload',stageId);if(row){row.expires=0;await s.put('blob_upload',row);}}).catch(()=>{});throw e;}finally{void cleanup();}
 }
 const timer=setInterval(()=>{if(files)void cleanup();},30000);timer.unref();const close=store.close.bind(store);
 return Object.assign(store,{writeBlob,readBlob,migrateBlob:migrate,cleanupBlobs:cleanup,async close(){closed=true;clearInterval(timer);if(draining)await draining;await close();}});
}
module.exports={attachBlobService};
