'use strict';
// MySQL is the production source of truth. SQLite is restricted to local tests.
const crypto = require('crypto');
function storeApi(run, dialect) {
  return {
    async get(kind, id) { const rows = await run('SELECT payload FROM ux_records WHERE kind=? AND id=?', [kind,id]); return rows[0] ? JSON.parse(rows[0].payload) : null; },
    async list(kind, owner) { const rows = await run('SELECT payload FROM ux_records WHERE kind=?'+(owner === undefined ? '' : ' AND owner_id=?')+' ORDER BY updated DESC', owner === undefined ? [kind] : [kind,owner]); return rows.map(r=>JSON.parse(r.payload)); },
    async put(kind, row, owner = '') { const args=[kind,row.id,owner,JSON.stringify(row),Date.now()]; await run(dialect==='mysql' ? 'INSERT INTO ux_records (kind,id,owner_id,payload,updated) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE owner_id=VALUES(owner_id),payload=VALUES(payload),updated=VALUES(updated)' : 'INSERT INTO ux_records (kind,id,owner_id,payload,updated) VALUES (?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET owner_id=excluded.owner_id,payload=excluded.payload,updated=excluded.updated', args); return row; },
    async remove(kind,id) { await run('DELETE FROM ux_records WHERE kind=? AND id=?',[kind,id]); },
    async blob(id,data) {
      if(data){
        if(data.length<=1024*1024){await run('INSERT INTO ux_blobs (id,content) VALUES (?,?)',[id,data]);return;}
        for(let n=0;n<data.length;n+=1024*1024)await run('INSERT INTO ux_blob_parts (id,part,content) VALUES (?,?,?)',[id,n/(1024*1024),data.subarray(n,n+1024*1024)]);
        return;
      }
      const legacy=await run('SELECT content FROM ux_blobs WHERE id=?',[id]);
      if(legacy[0])return Buffer.from(legacy[0].content);
      const rows=await run('SELECT part,content FROM ux_blob_parts WHERE id=? ORDER BY part',[id]);
      if(!rows.length)return null;
      if(rows.some((r,i)=>Number(r.part)!==i))throw new Error('INCOMPLETE_FILE');
      return Buffer.concat(rows.map(r=>Buffer.from(r.content)));
    },
    async removeBlob(id) {await run('DELETE FROM ux_blobs WHERE id=?',[id]);await run('DELETE FROM ux_blob_parts WHERE id=?',[id]);}

  };
}
async function createStore(env=process.env) {
  if(env.PORTAL_LOCAL_DB && env.NODE_ENV === 'test') {
    const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(env.PORTAL_LOCAL_DB);
    db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS ux_records(kind TEXT,id TEXT,owner_id TEXT,payload TEXT,updated INTEGER,PRIMARY KEY(kind,id)); CREATE INDEX IF NOT EXISTS ux_owner ON ux_records(kind,owner_id); CREATE TABLE IF NOT EXISTS ux_blobs(id TEXT PRIMARY KEY,content BLOB);');
    db.exec('CREATE TABLE IF NOT EXISTS ux_blob_parts(id TEXT,part INTEGER,content BLOB,PRIMARY KEY(id,part));');
    let queue=Promise.resolve();
    const run=async(sql,args=[])=>/^SELECT/.test(sql) ? db.prepare(sql).all(...args) : db.prepare(sql).run(...args);
    return {transaction(fn) {const job=queue.then(async()=>{db.exec('BEGIN IMMEDIATE');try{const result=await fn(storeApi(run,'sqlite'));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}});queue=job.catch(()=>{});return job;},close:()=>db.close()};
  }
  if(!env.DB_NAME || !env.DB_USER || !env.DB_PASSWORD) throw new Error('PORTAL_DATABASE_NOT_CONFIGURED');
  const mysql=require('mysql2/promise');
  const pool=mysql.createPool({host:env.DB_HOST||'localhost',port:Number(env.DB_PORT||3306),user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME,connectionLimit:5,queueLimit:30,connectTimeout:10000,charset:'utf8mb4',multipleStatements:false});
  await pool.execute('CREATE TABLE IF NOT EXISTS ux_records (kind VARCHAR(32) NOT NULL,id VARCHAR(128) NOT NULL,owner_id VARCHAR(128) NOT NULL DEFAULT \'\',payload LONGTEXT NOT NULL,updated BIGINT NOT NULL,PRIMARY KEY(kind,id),INDEX ux_owner(kind,owner_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin');
  await pool.execute('CREATE TABLE IF NOT EXISTS ux_blobs (id VARCHAR(128) PRIMARY KEY,content LONGBLOB NOT NULL) ENGINE=InnoDB');
  await pool.execute('CREATE TABLE IF NOT EXISTS ux_blob_parts (id VARCHAR(128) NOT NULL,part INT NOT NULL,content MEDIUMBLOB NOT NULL,PRIMARY KEY(id,part)) ENGINE=InnoDB');
  const lockName='ux_'+crypto.createHash('sha256').update(env.DB_NAME).digest('hex').slice(0,40);
  return {async transaction(fn) { const c=await pool.getConnection();let locked=false;try {const [rows]=await c.execute('SELECT GET_LOCK(?,15) AS acquired',[lockName]);if(Number(rows[0].acquired)!==1)throw new Error('DATABASE_BUSY');locked=true;await c.beginTransaction();const result=await fn(storeApi(async(sql,args=[])=>{const [rows]=await c.execute(sql,args);return rows;},'mysql'));await c.commit();return result;}catch(e){await c.rollback().catch(()=>{});throw e;}finally{if(locked)await c.execute('SELECT RELEASE_LOCK(?)',[lockName]).catch(()=>{});c.release();}},close:()=>pool.end()};
}
module.exports={createStore};
