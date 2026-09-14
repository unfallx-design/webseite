/* Local recovery only: no API cache, no tokens, originals retained as browser Blobs. */
(function(root){
'use strict';
let connection;const users=new Map();
function state(user){if(!users.has(user))users.set(user,{blocked:false,controllers:new Set()});return users.get(user);}
function db(){if(!connection)connection=new Promise((resolve,reject)=>{const r=indexedDB.open('unfallx-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'id'});r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);});return connection;}
async function transaction(mode,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('drafts',mode),result=fn(t.objectStore('drafts'));t.oncomplete=()=>resolve(result?.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Lokale Sicherung abgebrochen.'));});}
const key=(user,slot)=>user+':'+slot;
async function load(user,slot){const owner=state(user);if(owner.blocked)return null;const r=await transaction('readonly',s=>s.get(key(user,slot)));if(owner.blocked)return null;if(r&&Date.now()-r.at>7*86400000){await remove(user,slot);return null;}return r;}
function remove(user,slot){return transaction('readwrite',s=>s.delete(key(user,slot)));}
async function clearUser(user){const owner=state(user);owner.blocked=true;await Promise.all([...owner.controllers].map(c=>c.stop()));const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('drafts','readwrite'),r=t.objectStore('drafts').openCursor();r.onsuccess=()=>{const c=r.result;if(c){if(c.value.user===user||Date.now()-c.value.at>7*86400000)c.delete();c.continue();}};t.oncomplete=()=>{owner.controllers.clear();resolve();};t.onerror=()=>reject(t.error||new Error('Lokale Entwürfe konnten nicht entfernt werden.'));t.onabort=()=>reject(t.error||new Error('Lokale Bereinigung abgebrochen.'));});}
function restoreBatch(snapshot){const batch=new root.UnfallxUploads.Batch();batch.items=(snapshot?.items||[]).map(x=>({...x,state:x.state==='done'?'done':x.state==='invalid'?'invalid':'waiting',progress:x.state==='done'?100:0,error:x.state==='invalid'?x.error:null}));return batch;}
function restoreFields(form,values){for(const [name,value] of Object.entries(values||{})){const elements=[...form.elements].filter(el=>el.name===name);for(const el of elements){if(el.type==='checkbox')el.checked=Array.isArray(value)?value.includes(el.value):value===true;else if(el.type!=='file')el.value=value??'';}}form.dispatchEvent(new Event('change'));}
function controller(user,slot,snapshot,status){let chain=Promise.resolve(),closed=false,timer;const owner=state(user),display=text=>{if(!closed&&!owner.blocked&&status?.isConnected)status.textContent=text;};
 function save(){clearTimeout(timer);if(closed||owner.blocked)return chain;const value=snapshot();chain=chain.catch(()=>{}).then(()=>{if(!closed&&!owner.blocked)return transaction('readwrite',s=>s.put({...value,id:key(user,slot),user,at:Date.now()}));}).then(()=>display('Auf diesem Gerät gesichert · noch nicht automatisch eingereicht. Beim Abmelden werden lokale Entwürfe entfernt.')).catch(()=>display('Lokale Sicherung nicht möglich. Bitte die Seite geöffnet lassen und online als Entwurf speichern.'));return chain;}
 const control={save,schedule(){if(closed||owner.blocked)return;clearTimeout(timer);timer=setTimeout(save,600);},async clear(){await control.stop();await remove(user,slot);},stop(){closed=true;clearTimeout(timer);return chain.finally(()=>owner.controllers.delete(control));},flush:()=>save()};owner.controllers.add(control);if(owner.blocked)control.stop();return control;
}
root.UnfallxDrafts={load,remove,clearUser,restoreBatch,restoreFields,controller};
})(window);
