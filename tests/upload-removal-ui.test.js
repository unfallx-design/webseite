'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function uploadView(removeStored){
 const nodes=new Map();
 function element(){return {children:[],handlers:{},dataset:{},attributes:{},hidden:false,disabled:false,innerHTML:'',textContent:'',addEventListener(k,f){this.handlers[k]=f;},setAttribute(k,v){this.attributes[k]=v;},append(n){this.children.push(n);},remove(){this.removed=true;},querySelector(k){if(k==='select')return null;this.nodes||=new Map();if(!this.nodes.has(k))this.nodes.set(k,element());return this.nodes.get(k);}};}
 const host=element();host.querySelector=k=>{if(!nodes.has(k))nodes.set(k,element());return nodes.get(k);};host.dispatchEvent=()=>{};
 const scope={File,Event,URL,document:{createElement:element}};vm.runInNewContext(fs.readFileSync(require.resolve('../assets/uploads'),'utf8'),scope);
 const panel=scope.UnfallxUploads.mount(host,()=> 'document',{pdfOnly:true,removeStored});
 panel.add([new File(['original 1'],'first.pdf'),new File(['original 2'],'second.pdf')]);
 panel.batch.items[0].state='done';panel.batch.items[0].result={file:{id:'stored'}};panel.batch.items[1].state='error';panel.paint();
 return {panel,nodes,button:nodes.get('[data-batch-list]').children[0].querySelector('.upload-remove')};
}
test('Partial upload exposes stored-file removal and waits for confirmed server deletion',async()=>{
 let finish,calls=0;const f=uploadView(async item=>{calls++;assert.equal(item.result.file.id,'stored');return new Promise(r=>finish=r);});
 assert.equal(f.button.hidden,false);assert.match(f.button.attributes['aria-label'],/Ablage entfernen/);
 const removing=f.button.onclick();assert.equal(f.button.disabled,true);assert.equal(f.nodes.get('[data-batch-files]').disabled,true);assert.equal(f.panel.batch.items.length,2);
 await f.button.onclick();assert.equal(calls,1);finish(true);await removing;
 assert.equal(f.panel.batch.items.length,1);assert.equal(f.panel.batch.items[0].file.name,'second.pdf');assert.equal(f.panel.batch.items[0].state,'error');assert.equal(f.nodes.get('[data-batch-files]').disabled,false);
 const callsAfter=[];await f.panel.batch.send(async item=>callsAfter.push(item.file.name));assert.deepEqual(callsAfter,['second.pdf']);
});
test('Cancellation, failed removal and missing removal capability preserve the stored original',async()=>{
 const cancelled=uploadView(async()=>false);await cancelled.button.onclick();assert.equal(cancelled.panel.batch.items.length,2);
 const failed=uploadView(async()=>{throw Error('Datei geschützt');});await failed.button.onclick();assert.equal(failed.panel.batch.items.length,2);assert.match(failed.panel.batch.items[0].error,/geschützt/);assert.equal(failed.button.disabled,false);
 const noHandler=uploadView();assert.equal(noHandler.button.hidden,true);await noHandler.button.onclick();assert.equal(noHandler.panel.batch.items.length,2);
 const batch=noHandler.panel.batch;batch.remove(batch.items[0].key);assert.equal(batch.items.length,2);
});
function actions({confirm=true,canDelete=true,files,role='partner'}={}){
 const calls=[],messages=[],nodes=new Map(),file={id:'stored',name:'Auftrag.pdf',canDelete,removalBlockedReason:'Original wurde bereits exportiert.'};
 let active=files||[file];
 const node=()=>({innerHTML:'',textContent:'',classList:{toggle(){}},scrollIntoView(){}});
 const scope={Intl,Date,URL,File,AbortController,AbortSignal,UnfallxSessionGuard:require('../assets/session-guard'),window:{addEventListener(){},UnfallxWorkspace:{}},document:{querySelector(k){if(!nodes.has(k))nodes.set(k,node());return nodes.get(k);}},
 location:{hash:'#neu'},setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,matchMedia:()=>({matches:false}),
 fetch:async(url,options)=>{calls.push({url,...options});const isPost=options.method==='POST';if(isPost&&JSON.parse(options.body).action==='file_delete')active=[];return {ok:true,status:200,json:async()=>({case:{id:'case',version:42},files:active,documents:active,message:'Entfernt'})};}}
 const source=fs.readFileSync(require.resolve('../assets/portal'),'utf8'),end=source.indexOf("$('#portal-search').addEventListener('submit'");
 scope.confirmed=confirm;scope.role=role;
 vm.runInNewContext(source.slice(0,end)+`me={user:{role,preferences:{}}};csrf='csrf';current={case:{id:'case',version:1},files:[]};confirmFileRemoval=async()=>confirmed;globalThis.actions={removeUploadedCaseFile,removeUploadedVaultFile,confirmFiles};})();`,scope);
 return {calls,file,remove:()=>scope.actions.removeUploadedCaseFile('case',{result:{file}}),vault:()=>scope.actions.removeUploadedVaultFile({result:{document:file}}),confirmFiles:ids=>scope.actions.confirmFiles('case',{items:ids.map(id=>({state:'done',result:{file:{id}}}))})};
}
test('Partner and admin remove uploaded originals using fresh case versions without re-rendering edited data',async()=>{
 for(const role of ['partner','admin']){const f=actions({role});assert.equal(await f.remove(),true);const posts=f.calls.filter(r=>r.method==='POST');assert.equal(posts.length,1);assert.deepEqual(JSON.parse(posts[0].body),{action:'file_delete',fileId:'stored',version:42,confirmed:true});}
});
test('Protected and cancelled stored files never issue a deletion; already removed files are only forgotten locally',async()=>{
 const protectedFile=actions({canDelete:false});await assert.rejects(protectedFile.remove(),/exportiert/);assert(!protectedFile.calls.some(r=>r.method==='POST'));
 const cancelled=actions({confirm:false});assert.equal(await cancelled.remove(),false);assert(!cancelled.calls.some(r=>r.method==='POST'));
 const removed=actions({files:[]});assert.equal(await removed.remove(),true);assert(!removed.calls.some(r=>r.method==='POST'));
});
test('Partially uploaded company PDFs use the vault trash and retain cancellation',async()=>{
 const f=actions();assert.equal(await f.vault(),true);assert.equal(f.calls[1].url,'/api/portal/documents/stored');assert.deepEqual(JSON.parse(f.calls[1].body),{action:'delete',confirmed:true});
 const cancelled=actions({confirm:false});assert.equal(await cancelled.vault(),false);assert.equal(cancelled.calls.length,1);
});
test('Upload receipts exclude originals removed by the other workspace, without re-uploading them',async()=>{
 const f=actions();await f.confirmFiles(['stored','deleted']);assert.deepEqual(JSON.parse(f.calls[1].body).fileIds,['stored']);
 const removed=actions({files:[]});await removed.confirmFiles(['deleted']);assert.equal(removed.calls.length,1);
});
