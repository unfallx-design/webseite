/* Local recovery only: no API cache, no tokens, originals retained as browser Blobs. */
(function(root){
'use strict';
let connection;
function db(){if(!connection)connection=new Promise((resolve,reject)=>{const r=indexedDB.open('unfallx-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'id'});r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);});return connection;}
async function transaction(mode,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('drafts',mode),result=fn(t.objectStore('drafts'));t.oncomplete=()=>resolve(result?.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Lokale Sicherung abgebrochen.'));});}
const key=(user,slot)=>user+':'+slot;
async function load(user,slot){const r=await transaction('readonly',s=>s.get(key(user,slot)));if(r&&Date.now()-r.at>7*86400000){await remove(user,slot);return null;}return r;}
function remove(user,slot){return transaction('readwrite',s=>s.delete(key(user,slot)));}
async function clearUser(user){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('drafts','readwrite'),r=t.objectStore('drafts').openCursor();r.onsuccess=()=>{const c=r.result;if(c){if(c.value.user===user||Date.now()-c.value.at>7*86400000)c.delete();c.continue();}};t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
function restoreBatch(snapshot){const batch=new root.UnfallxUploads.Batch();batch.items=(snapshot?.items||[]).map(x=>({...x,state:x.state==='done'?'done':x.state==='invalid'?'invalid':'waiting',progress:x.state==='done'?100:0,error:x.state==='invalid'?x.error:null}));return batch;}
function restoreFields(form,values){for(const [name,value] of Object.entries(values||{})){const elements=[...form.elements].filter(el=>el.name===name);for(const el of elements){if(el.type==='checkbox')el.checked=Array.isArray(value)?value.includes(el.value):value===true;else if(el.type!=='file')el.value=value??'';}}form.dispatchEvent(new Event('change'));}
function controller(user,slot,snapshot,status){let chain=Promise.resolve(),closed=false,timer;const display=text=>{if(status?.isConnected)status.textContent=text;};
 function save(){clearTimeout(timer);if(closed)return chain;const value=snapshot();chain=chain.catch(()=>{}).then(()=>transaction('readwrite',s=>s.put({...value,id:key(user,slot),user,at:Date.now()}))).then(()=>display('Auf diesem Gerät gesichert · noch nicht automatisch eingereicht. Beim Abmelden werden lokale Entwürfe entfernt.')).catch(()=>display('Lokale Sicherung nicht möglich. Bitte die Seite geöffnet lassen und online als Entwurf speichern.'));return chain;}
 return {save,schedule(){clearTimeout(timer);timer=setTimeout(save,600);},async clear(){closed=true;clearTimeout(timer);await chain;await remove(user,slot);},stop(){closed=true;clearTimeout(timer);},flush:()=>save()};
}
root.UnfallxDrafts={load,remove,clearUser,restoreBatch,restoreFields,controller};
})(window);
