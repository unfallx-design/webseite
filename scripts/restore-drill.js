'use strict';
// Synthetic rehearsal only. It cannot connect to production or overwrite provider backups.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID,randomBytes,createHash}=require('node:crypto');
const {createStore}=require('../portal/store'),{fakeS3,env}=require('../tests/fixtures/s3');
async function run(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ux-restore-drill-')),source=path.join(dir,'source.sqlite'),backup=path.join(dir,'backup.sqlite'),restored=path.join(dir,'restored.sqlite');const f=fakeS3();let s;
 try{
  s=await createStore({...env,PORTAL_LOCAL_DB:source},{fileStorage:f.files});const bytes=Buffer.concat([Buffer.from('%PDF-1.7\nSYNTHETIC RESTORE TEST\n'),randomBytes(64000),Buffer.from('\n%%EOF')]),caseId=randomUUID(),fileId=await s.writeBlob(bytes,async(q,staged)=>{await staged.attach(q);await q.put('case',{id:caseId,companyId:'synthetic-company',status:'submitted',number:'RESTORE-TEST'});await q.put('file',{id:staged.id,caseId,kind:'document',name:'Fiktiv.pdf',type:'application/pdf',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},caseId);return staged.id;});
  const snapshot=new Map([...f.objects].map(([k,v])=>[k,Buffer.from(v)]));await s.close();s=null;fs.copyFileSync(source,backup);fs.copyFileSync(backup,restored);
  s=await createStore({...env,PORTAL_LOCAL_DB:restored},{fileStorage:f.files});f.objects.clear();await assert.rejects(s.readBlob(fileId),/FILE_STORAGE_UNAVAILABLE/);
  for(const [key,bytes]of snapshot)f.objects.set(key,Buffer.from(bytes));const key=[...f.objects.keys()][0];f.objects.get(key)[100]^=255;await assert.rejects(s.readBlob(fileId),/FILE_STORAGE_INTEGRITY/);
  for(const [key,bytes]of snapshot)f.objects.set(key,Buffer.from(bytes));
  const file=await s.transaction(q=>q.get('file',fileId)),c=await s.transaction(q=>q.get('case',file.caseId)),download=await s.readBlob(file.id);
  assert.equal(c.number,'RESTORE-TEST');assert.deepEqual(download,bytes);assert.equal(createHash('sha256').update(download).digest('hex'),file.sha256);
  return {at:new Date().toISOString(),scope:'Synthetic local SQLite metadata + simulated private S3 snapshot',productionBackupRestored:false,caseAssociation:true,missingObjectDetected:true,corruptionDetected:true,originalBytesRestored:true,sha256:file.sha256,bytes:bytes.length,records:2};
 }finally{if(s)await s.close();fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module)run().then(result=>console.log(JSON.stringify(result,null,2))).catch(()=>{console.error('Synthetic restore rehearsal failed.');process.exitCode=1;});
module.exports={run};
