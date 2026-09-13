'use strict';
// MySQL is the production source of truth. SQLite is restricted to local tests.
const crypto = require('crypto');
const {createFileStorage, storageConfig} = require('./file-storage');
function storeApi(run, dialect, files, backend) {
  async function legacyBlob(id) {
    const legacy=await run('SELECT content FROM ux_blobs WHERE id=?',[id]);
    if(legacy[0])return Buffer.from(legacy[0].content);
    const rows=await run('SELECT part,content FROM ux_blob_parts WHERE id=? ORDER BY part',[id]);
    if(!rows.length)return null;
    if(rows.some((r,i)=>Number(r.part)!==i))throw new Error('INCOMPLETE_FILE');
    return Buffer.concat(rows.map(r=>Buffer.from(r.content)));
  }
  async function removeLegacy(id) {await run('DELETE FROM ux_blobs WHERE id=?',[id]);await run('DELETE FROM ux_blob_parts WHERE id=?',[id]);}
  const api = {
    async get(kind, id) { const rows = await run('SELECT payload FROM ux_records WHERE kind=? AND id=?', [kind,id]); return rows[0] ? JSON.parse(rows[0].payload) : null; },
    async list(kind, owner) { const rows = await run('SELECT payload FROM ux_records WHERE kind=?'+(owner === undefined ? '' : ' AND owner_id=?')+' ORDER BY updated DESC', owner === undefined ? [kind] : [kind,owner]); return rows.map(r=>JSON.parse(r.payload)); },
    async put(kind, row, owner = '') { const args=[kind,row.id,owner,JSON.stringify(row),Date.now()]; await run(dialect==='mysql' ? 'INSERT INTO ux_records (kind,id,owner_id,payload,updated) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE owner_id=VALUES(owner_id),payload=VALUES(payload),updated=VALUES(updated)' : 'INSERT INTO ux_records (kind,id,owner_id,payload,updated) VALUES (?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET owner_id=excluded.owner_id,payload=excluded.payload,updated=excluded.updated', args); return row; },
    async remove(kind,id) { await run('DELETE FROM ux_records WHERE kind=? AND id=?',[kind,id]); },
    legacyBytes:legacyBlob, removeLegacy,
    async blobSource(id,includeBytes=true) {const ref=await api.get('blob_location',id);if(ref)return {ref};const bytes=await legacyBlob(id);return bytes?{bytes:includeBytes?bytes:null}:null;},
    async attachBlob(id,ref) {if(await api.get('blob_location',id))throw new Error('FILE_ALREADY_EXISTS');await api.put('blob_location',{...ref,id});},
    async probeBlob(id,data) {
      // Startup checks the database independently. An S3 outage must not prevent
      // partners logging in, viewing statuses or exchanging case messages.
      if(data)return run('INSERT INTO ux_blobs (id,content) VALUES (?,?)',[id,data]);
      return legacyBlob(id);
    },
    async blob(id,data) {
      if(data){
        if(await api.get('blob_location',id) || await legacyBlob(id))throw new Error('FILE_ALREADY_EXISTS');
        if(backend==='s3')throw new Error('FILE_IO_REQUIRES_STORE');
        if(data.length<=1024*1024){await run('INSERT INTO ux_blobs (id,content) VALUES (?,?)',[id,data]);return;}
        for(let n=0;n<data.length;n+=1024*1024)await run('INSERT INTO ux_blob_parts (id,part,content) VALUES (?,?,?)',[id,n/(1024*1024),data.subarray(n,n+1024*1024)]);
        return;
      }
      const ref=await api.get('blob_location',id);
      if(ref)throw new Error('FILE_IO_REQUIRES_STORE');
      return legacyBlob(id);
    },
    async removeBlob(id) {
      const ref=await api.get('blob_location',id);
      if(ref) {
        if(!files)throw new Error('FILE_STORAGE_CONFIGURATION');
        // Delete the remote object only after the metadata transaction commits.
        // The durable job survives a restart or an unavailable S3 service.
        await api.put('blob_delete',{...ref,id:crypto.randomUUID()});
        await api.remove('blob_location',id);
      }
      await removeLegacy(id);
    },
    async legacyBlobIds(limit=5) {
      if(!Number.isInteger(limit)||limit<1||limit>10)throw new Error('INVALID_BATCH');
      return (await run('SELECT id FROM ux_blobs UNION SELECT id FROM ux_blob_parts ORDER BY id LIMIT '+limit)).map(r=>r.id);
    },
    async storageStats() {
      const [single]=await run('SELECT COUNT(*) AS files, COALESCE(SUM(LENGTH(content)),0) AS bytes FROM ux_blobs');
      const [parts]=await run('SELECT COUNT(DISTINCT id) AS files, COALESCE(SUM(LENGTH(content)),0) AS bytes FROM ux_blob_parts');
      const refs=await api.list('blob_location');
      return {backend,region:files?.region||null,legacyFiles:Number(single.files)+Number(parts.files),legacyBytes:Number(single.bytes)+Number(parts.bytes),remoteFiles:refs.length,remoteBytes:refs.reduce((n,r)=>n+r.size,0),pendingDeletes:(await api.list('blob_delete')).length};
    },

  };
  return api;
}
async function transactionWork(run,dialect,files,backend,fn,begin,commit,rollback) {
  const api=storeApi(run,dialect,files,backend);
  let committing=false;
  await begin();
  try {
    const result=await fn(api);
    committing=true;
    await commit();
    return result;
  } catch(error) {
    if(committing)error.commitUncertain=true;
    await rollback();
    throw error;
  }
}
async function createStore(env=process.env,options={}) {
  const {backend}=storageConfig(env);
  const files=options.fileStorage||createFileStorage(env);
  if(env.PORTAL_LOCAL_DB && env.NODE_ENV === 'test') {
    const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(env.PORTAL_LOCAL_DB);
    db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS ux_records(kind TEXT,id TEXT,owner_id TEXT,payload TEXT,updated INTEGER,PRIMARY KEY(kind,id)); CREATE INDEX IF NOT EXISTS ux_owner ON ux_records(kind,owner_id); CREATE TABLE IF NOT EXISTS ux_blobs(id TEXT PRIMARY KEY,content BLOB);');
    db.exec('CREATE TABLE IF NOT EXISTS ux_blob_parts(id TEXT,part INTEGER,content BLOB,PRIMARY KEY(id,part));');
    let queue=Promise.resolve();
    const run=async(sql,args=[])=>/^SELECT/.test(sql) ? db.prepare(sql).all(...args) : db.prepare(sql).run(...args);
    return require('./blob-service').attachBlobService({ping:async()=>{await queue;return run('SELECT 1 AS ok');},transaction(fn) {const job=queue.then(()=>transactionWork(run,'sqlite',files,backend,fn,()=>db.exec('BEGIN IMMEDIATE'),()=>db.exec('COMMIT'),()=>db.exec('ROLLBACK')));queue=job.catch(()=>{});return job;},close:()=>{files?.close();db.close();}},files,backend);
  }
  if(!env.DB_NAME || !env.DB_USER || !env.DB_PASSWORD) throw new Error('PORTAL_DATABASE_NOT_CONFIGURED');
  const mysql=require('mysql2/promise');
  const pool=mysql.createPool({host:env.DB_HOST||'localhost',port:Number(env.DB_PORT||3306),user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME,connectionLimit:5,queueLimit:30,connectTimeout:10000,charset:'utf8mb4',multipleStatements:false});
  await pool.execute('CREATE TABLE IF NOT EXISTS ux_records (kind VARCHAR(32) NOT NULL,id VARCHAR(128) NOT NULL,owner_id VARCHAR(128) NOT NULL DEFAULT \'\',payload LONGTEXT NOT NULL,updated BIGINT NOT NULL,PRIMARY KEY(kind,id),INDEX ux_owner(kind,owner_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin');
  await pool.execute('CREATE TABLE IF NOT EXISTS ux_blobs (id VARCHAR(128) PRIMARY KEY,content LONGBLOB NOT NULL) ENGINE=InnoDB');
  await pool.execute('CREATE TABLE IF NOT EXISTS ux_blob_parts (id VARCHAR(128) NOT NULL,part INT NOT NULL,content MEDIUMBLOB NOT NULL,PRIMARY KEY(id,part)) ENGINE=InnoDB');
  const lockName='ux_'+crypto.createHash('sha256').update(env.DB_NAME).digest('hex').slice(0,40);
  return require('./blob-service').attachBlobService({ping:()=>pool.query({sql:'SELECT 1 AS ok',timeout:2500}),async transaction(fn) { const c=await pool.getConnection();let locked=false;try {const [rows]=await c.execute('SELECT GET_LOCK(?,15) AS acquired',[lockName]);if(Number(rows[0].acquired)!==1)throw new Error('DATABASE_BUSY');locked=true;return await transactionWork(async(sql,args=[])=>{const [rows]=await c.execute(sql,args);return rows;},'mysql',files,backend,fn,()=>c.beginTransaction(),()=>c.commit(),async()=>{try{await c.rollback();}catch{c.destroy();throw new Error('DATABASE_ROLLBACK_FAILED');}});}finally{if(locked)await c.execute('SELECT RELEASE_LOCK(?)',[lockName]).catch(()=>{});c.release();}},close:async()=>{files?.close();await pool.end();}},files,backend);
}
module.exports={createStore};
