'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {create,expired}=require('../assets/session-guard'),{Batch}=require('../assets/uploads');
const tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}

// A serialized IDB test adapter: requests commit only at transaction completion.
function draftBrowser(){
 const records=new Map(),timers=new Map();let nextTimer=0,tail=Promise.resolve(),holdPut=null,abortDelete=false;
 const database={transaction(){const tx={error:null},jobs=[];let cursor=false;
  tx.objectStore=()=>({put(value){const gate=holdPut;holdPut=null;const r={};jobs.push(async()=>{if(gate)await gate;records.set(value.id,structuredClone(value));});return r;},get(id){const r={};jobs.push(()=>{r.result=records.get(id);});return r;},delete(id){jobs.push(()=>records.delete(id));return {};},openCursor(){cursor=true;const r={};jobs.push(async()=>{if(abortDelete){abortDelete=false;tx.error=Error('Disk denied');throw tx.error;}for(const value of [...records.values()]){await new Promise(resolve=>{r.result={value,delete(){records.delete(value.id);},continue:resolve};r.onsuccess();});}r.result=null;r.onsuccess();});return r;}});
  const previous=tail;tail=new Promise(resolve=>setImmediate(async()=>{await previous;try{for(const job of jobs)await job();tx.oncomplete?.();}catch(e){tx.error=e;tx.onabort?.();}resolve();}));return tx;}};
 const browser={indexedDB:{open(){const request={result:database};setImmediate(()=>request.onsuccess());return request;}},setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},Date,Event,Promise,Map,Set,window:{UnfallxUploads:{Batch}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../assets/drafts.js'),'utf8'),browser);
 return {drafts:browser.window.UnfallxDrafts,records,timers,hold(gate){holdPut=gate;},abortNextDelete(){abortDelete=true;}};
}
test('Logout waits for running draft writes and prevents queued or future writes after deletion',async()=>{
 const b=draftBrowser(),gate=deferred();b.hold(gate.promise);let value='first';const a=b.drafts.controller('alice','new',()=>({values:{name:value},items:[{file:new Blob(['original'])}]}));
 const first=a.save();await tick();await tick();value='queued';const second=a.save();a.schedule();let finished=false;const clear=b.drafts.clearUser('alice').then(()=>finished=true);await tick();assert.equal(finished,false);assert.equal(b.timers.size,0);
 gate.resolve();await Promise.all([first,second,clear]);assert.equal(b.records.size,0);await a.save();a.schedule();const late=b.drafts.controller('alice','other',()=>({values:{name:'late'}}));await late.save();assert.equal(b.records.size,0);assert.equal(await b.drafts.load('alice','new'),null);
});
test('Controllers from a previous view are drained; other accounts remain scoped',async()=>{
 const b=draftBrowser(),gate=deferred();const other=b.drafts.controller('bob','new',()=>({values:{name:'Bob'}}));await other.save();b.hold(gate.promise);const old=b.drafts.controller('alice','case-old',()=>({values:{name:'old view'}}));old.save();await tick();await tick();old.stop();const clear=b.drafts.clearUser('alice');gate.resolve();await clear;assert.equal(b.records.has('alice:case-old'),false);assert.equal((await b.drafts.load('bob','new')).values.name,'Bob');
});
test('Aborted draft deletion is reported, remains blocked, and can be retried',async()=>{
 const b=draftBrowser();const a=b.drafts.controller('alice','new',()=>({values:{name:'private'}}));await a.save();b.abortNextDelete();await assert.rejects(b.drafts.clearUser('alice'),/Disk denied/);assert.equal(b.records.size,1);assert.equal(await b.drafts.load('alice','new'),null);await a.save();await b.drafts.clearUser('alice');assert.equal(b.records.size,0);
});
test('Session end hides sensitive views immediately, aborts requests, and rejects late successful responses',async()=>{
 const remote=deferred(),clean=deferred();let visible='private case',aborted=false,cleanupCalled=0,rendered=0;
 const guard=create({onLock(){visible='locked';},cleanup:async()=>{cleanupCalled++;await clean.promise;},onSettled(){rendered++;}});
 const request=guard.request(async signal=>{signal.addEventListener('abort',()=>aborted=true);return remote.promise;});const rejected=assert.rejects(request,e=>e.status===401);
 const end=guard.end('logout');assert.equal(visible,'locked');assert.equal(guard.locked,true);assert.equal(aborted,true);assert.equal(guard.end(),end);assert.throws(()=>guard.check(),e=>e.status===401);remote.resolve({private:'late response'});await rejected;await tick();assert.equal(rendered,0);clean.resolve();await end;assert.equal(cleanupCalled,1);assert.equal(rendered,1);
});
test('401 locks the workspace; cleanup failures are exposed rather than swallowed',async()=>{
 let result,locks=0;const guard=create({onLock(){locks++;},cleanup:async()=>{throw Error('Storage denied');},onSettled:r=>result=r});await assert.rejects(guard.request(async()=>{throw expired();}),e=>e.status===401);await guard.end();assert.equal(locks,1);assert.match(result.cleanupError.message,/Storage denied/);await assert.rejects(guard.request(async()=>assert.fail('No new requests after expiry')),e=>e.status===401);
});
test('Photo and PDF batch stops on session expiry instead of sending the remaining files',async()=>{
 const batch=new Batch();batch.add([new File(['first'],'first.jpg'),new File(['second'],'second.pdf')]);let calls=0;await assert.rejects(batch.send(async()=>{calls++;throw expired();}),e=>e.status===401);assert.equal(calls,1);assert.equal(batch.running,false);assert.equal(batch.cancelled,true);await assert.rejects(batch.send(()=>assert.fail('closed batch')),/geschlossen/);
});
test('Cancelling a running batch prevents subsequent originals from being transmitted',async()=>{
 const batch=new Batch(),gate=deferred();batch.add([new File(['first'],'first.jpg'),new File(['second'],'second.pdf')]);let calls=0;const sending=batch.send(async()=>{calls++;await gate.promise;return {ok:true};});const rejected=assert.rejects(sending,/Einige Dateien/);batch.cancel();gate.resolve();await rejected;assert.equal(calls,1);assert.equal(batch.items[0].state,'done');assert.notEqual(batch.items[1].state,'done');
});
function portalBrowser(identity,status=200){
 const elements=new Map(),events={},requests=[],cleared=[],messages=[];let replacements=0,listener;
 const make=()=>({innerHTML:'',textContent:'',value:'',dataset:{},classList:{toggle(){}},addEventListener(){},querySelectorAll:()=>[],setAttribute(){},getAttribute(){return 'false';}}),node=s=>{if(!elements.has(s))elements.set(s,make());return elements.get(s);};
 const context={Intl,Date,URL,File,AbortController,AbortSignal,UnfallxSessionGuard:require('../assets/session-guard'),UnfallxDrafts:{clearUser:async user=>cleared.push(user)},setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},matchMedia:()=>({matches:false}),location:{pathname:'/portal',hash:'#faelle'},history:{replaceState(){}},document:{title:'private',visibilityState:'visible',body:{...make(),replaceChildren(){replacements++;}},querySelector:node,querySelectorAll:()=>[],createElement:make,addEventListener:(type,fn)=>events[type]=fn},window:{UnfallxWorkspace:{},addEventListener:(type,fn)=>events[type]=fn,scrollTo(){}},BroadcastChannel:class{constructor(){listener=this;}postMessage(v){messages.push(v);}},fetch:async(url)=>{requests.push(url);return {ok:status===200,status,json:async()=>identity};}};
 const source=fs.readFileSync(require.resolve('../assets/portal.js'),'utf8').replace('});boot();','});window.privacyTest={seed(value){me=value;csrf=value.csrf;},checkSession,guard:sessionGuard};');vm.runInNewContext(source,context);context.window.privacyTest.seed({user:{id:'alice',role:'partner'},csrf:'old-session'});
 return {...context.window.privacyTest,elements,requests,cleared,events,messages,get replacements(){return replacements;},broadcast:payload=>listener.onmessage({data:payload})};
}
test('A different account or renewed session locks the old portal without signing out the new session',async()=>{
 for(const identity of [{user:{id:'bob'},csrf:'new-session'},{user:{id:'alice'},csrf:'new-session'}]){
  const b=portalBrowser(identity);await b.checkSession();assert.equal(b.guard.locked,true);assert.equal(b.replacements,1);assert.deepEqual(b.cleared,['alice']);assert.deepEqual(b.requests,['/api/portal/me']);assert.match(b.elements.get('#session-end-status').textContent,/Zugang hat gewechselt/);
 }
});
test('Cross-tab logout messages apply only to the same user and session',async()=>{
 const b=portalBrowser({user:{id:'alice'},csrf:'old-session'});b.broadcast({type:'ended',user:'bob',session:'old-session'});b.broadcast({type:'ended',user:'alice',session:'new-session'});assert.equal(b.guard.locked,false);b.broadcast({type:'ended',user:'alice',session:'old-session'});await b.guard.end();assert.equal(b.replacements,1);assert.deepEqual(b.cleared,['alice']);assert.equal(b.messages.length,0);assert.deepEqual(b.requests,['/api/portal/logout']);
});

test('Revoked account access hides an open workspace and clears local drafts',async()=>{
 const b=portalBrowser({error:'Der Firmenzugang ist gesperrt.'},403);await b.checkSession();await b.guard.end();assert.equal(b.guard.locked,true);assert.equal(b.replacements,1);assert.deepEqual(b.cleared,['alice']);
});
test('A temporary identity-check outage does not silently erase the current local draft',async()=>{
 const b=portalBrowser({error:'Vorübergehend nicht verfügbar.'},503);await b.checkSession();assert.equal(b.guard.locked,false);assert.equal(b.replacements,0);assert.deepEqual(b.cleared,[]);
});
