'use strict';
const {randomUUID, randomBytes} = require('node:crypto');
const {assert} = require('./domain');
const {storageConfig} = require('./file-storage');

function createStorageAdmin({tx, env, rate}) {
  const configuration = storageConfig(env);
  async function overview() {
    return tx(async s => ({...await s.storageStats(), limit:configuration.limit, used:(await s.get('system','storage'))?.bytes||0}));
  }
  async function check(user) {
    assert(user.role==='admin','Nur die Administration darf den Speicher prüfen.',403);
    await tx(async s => {
      await rate(s,'storage-check:'+user.id,6);
      const id=randomUUID(),bytes=randomBytes(64);
      await s.blob(id,bytes);
      const saved=await s.blob(id);
      assert(saved?.equals(bytes),'Die Dateiprüfung ist fehlgeschlagen.',503);
      await s.removeBlob(id);
    });
    return {ok:true,message:'Schreiben, Lesen und Original-Prüfsumme erfolgreich geprüft.',storage:await overview()};
  }
  async function migrate(user,data) {
    assert(user.role==='admin','Nur die Administration darf Dateien übertragen.',403);
    assert(configuration.backend==='s3','Der AWS-Speicher ist noch nicht aktiviert.',409);
    assert(data.confirmed===true,'Bitte die Übertragung bestätigen.');
    await tx(s=>rate(s,'storage-migrate:'+user.id,120));
    const ids=await tx(s=>s.legacyBlobIds(5));
    let migrated=0,bytes=0;
    // One transaction per original; a later failure preserves earlier progress.
    for(const id of ids) {
      const result=await tx(s=>s.migrateBlob(id));
      if(result.migrated){migrated++;bytes+=result.bytes;}
    }
    await tx(s=>s.put('admin_event',{id:randomUUID(),actor:user.id,action:'Originaldateien nach AWS S3 übertragen',files:migrated,bytes,at:new Date().toISOString()}));
    return {migrated,bytes,storage:await overview(),message:migrated+' Datei(en) übertragen und vollständig geprüft.'};
  }
  return {overview,check,migrate};
}

module.exports={createStorageAdmin};
