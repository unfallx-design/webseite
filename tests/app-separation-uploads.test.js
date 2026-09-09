'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const {createPortal}=require('../portal/app'),{createStore}=require('../portal/store'),D=require('../portal/domain'),hosts=require('../portal/hosts'),{Batch,MAX_FILE}=require('../assets/uploads');
test('Three hosts separate app, reports and education without losing queries or deep links',()=>{
 for(const p of ['/login','/app-hilfe','/app-demo','/registrieren','/portal-datenschutz'])assert.equal(hosts.hostPolicy('unfallx.com',p+'?x=1').redirect,'https://app.unfallx.com'+p+'?x=1');
 assert.equal(hosts.hostPolicy('gutachten.unfallx.com','/login').redirect,'https://app.unfallx.com/login');
 for(const p of ['/unfallgutachten','/einsatzgebiete','/wertminderung']){assert.equal(hosts.hostPolicy('unfallx.com',p).redirect,hosts.REPORT_ORIGIN+p);assert.equal(hosts.hostPolicy('app.unfallx.com',p).redirect,hosts.REPORT_ORIGIN+p);assert.equal(hosts.hostPolicy('gutachten.unfallx.com',p).isReport,true);}
 assert.equal(hosts.hostPolicy('gutachten.unfallx.com','/bildung').redirect,hosts.PUBLIC_ORIGIN+'/bildung');
 assert.equal(hosts.hostPolicy('app.unfallx.com','/').redirect,undefined);
 const html='<a href="/portal">Logo</a><a href="/app-hilfe#dateien">Hilfe</a><a href="/impressum">Legal</a><link rel="canonical" href="https://unfallx.com/login">';
 const out=hosts.links(html,true,true);assert.match(out,/https:\/\/app.unfallx.com\/portal/);assert.match(out,/https:\/\/app.unfallx.com\/app-hilfe#dateien/);assert.match(out,/https:\/\/app.unfallx.com\/impressum/);assert.match(out,/canonical" href="https:\/\/app.unfallx.com\/login/);
});
test('Batch selection handles mixed files, partial errors, retries and original byte identity',async()=>{
 const a=new File(['original-photo'],'a.jpg',{type:'image/jpeg',lastModified:1}),b=new File(['original-pdf'],'b.pdf',{type:'application/pdf',lastModified:2});
 const q=new Batch();q.add([a,b,a]);assert.equal(q.items.length,2);assert.deepEqual(q.items.map(x=>x.kind),['photo','document']);let attempts=[];
 await assert.rejects(q.send(async item=>{attempts.push(item.file.name);if(item.file===b)throw Error('offline');return Buffer.from(await item.file.arrayBuffer());}),/Einige Dateien/);
 assert.equal(q.items[0].state,'done');assert.equal(q.items[1].state,'error');assert.equal(q.running,false);
 await q.send(async item=>{attempts.push(item.file.name);assert.equal(item.file,b);return 'ok';});assert.deepEqual(attempts,['a.jpg','b.pdf','b.pdf']);assert.equal(q.pending(),false);assert.equal(q.items[0].result.toString(),'original-photo');
 const bad=new Batch();bad.add([{name:'big.jpg',size:MAX_FILE+1},{name:'script.html',size:20}]);await assert.rejects(bad.send(()=>assert.fail('Invalid uploads must never be sent')),/markierten Dateien/);
});
test('Authenticated original uploads above 6 MB are durable, idempotent and private',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ux-batch-')),env={NODE_ENV:'test',PORTAL_LOCAL_DB:path.join(dir,'db.sqlite'),PORTAL_ORIGIN:'http://localhost'},store=await createStore(env);const portal=createPortal({env,store,mail:{ready:true,send:async()=>{}}});await portal.ready();const server=http.createServer((req,res)=>portal.handle(req,res,{}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 async function actor(role,name){const id=D.hash(name),token=D.random(),csrf=D.random();await store.transaction(async s=>{await s.put('user',{id,name,email:name+'@example.com',role,companyId:role==='partner'?id:null,active:true,verifiedAt:new Date().toISOString()},'internal');if(role==='partner')await s.put('company',{id,name:'Testpartner',status:'approved'});await s.put('session',{id:D.hash(token),userId:id,csrf,createdAt:new Date().toISOString(),expires:Date.now()+3600000},id);});return {Cookie:'ux_session='+token,'X-CSRF-Token':csrf};}
 async function call(p,data,u={},headers={}){const r=await fetch(base+'/api/portal'+p,{method:data===undefined?'GET':'POST',headers:{Origin:env.PORTAL_ORIGIN,'Content-Type':'application/json',...u,...headers},body:data===undefined?undefined:Buffer.isBuffer(data)?data:JSON.stringify(data)});const bytes=Buffer.from(await r.arrayBuffer());return {status:r.status,headers:r.headers,bytes,json:r.headers.get('content-type')?.includes('application/json')?JSON.parse(bytes):null};}
 try{
 const customer=await actor('partner','fixture-partner'),other=await actor('partner','fixture-other'),admin=await actor('admin','fixture-admin');
 const cid=(await call('/cases',{...require('./fixtures/intake')(),vehicle:'Test',plate:'DEMO',accidentDate:'2026-09-09',location:'Berlin',owner:'Test Person',ownerContact:'fixture-customer@example.com',description:'Testaufnahme für Originaldateien',authority:true},customer)).json.case.id;
 const raw=crypto.randomBytes(1800*1500*3),jpg=await sharp(raw,{raw:{width:1800,height:1500,channels:3}}).png().toBuffer();assert.ok(jpg.length>6*1024*1024);
 const pdf=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(7*1024*1024,32),Buffer.from('\n%%EOF')]);
 const meta={'Content-Type':'image/png','X-File-Name':'Originalfoto.png','X-File-Kind':'photo'};
 assert.equal((await call('/cases/'+cid+'/files',jpg,other,meta)).status,404);
 assert.equal((await call('/cases/'+cid+'/files',jpg,{Cookie:customer.Cookie},meta)).status,403);
 const uploaded=await call('/cases/'+cid+'/files',jpg,customer,meta);assert.equal(uploaded.status,200,JSON.stringify(uploaded.json));
 const repeated=await call('/cases/'+cid+'/files',jpg,customer,meta);assert.equal(repeated.json.alreadyStored,true);assert.equal(repeated.json.file.id,uploaded.json.file.id);
 const document=await call('/cases/'+cid+'/files',pdf,customer,{'Content-Type':'application/pdf','X-File-Name':'Auftrag.pdf','X-File-Kind':'case_bundle'});assert.equal(document.status,200);
 assert.equal((await call('/cases/'+cid,undefined,customer)).json.files.length,2);
 for(const [file,bytes]of [[uploaded.json.file,jpg],[document.json.file,pdf]]){const download=await call('/files/'+file.id,undefined,admin);assert.equal(download.status,200);assert.deepEqual(download.bytes,bytes);assert.match(download.headers.get('cache-control'),/no-store/);assert.equal((await call('/files/'+file.id,undefined,other)).status,404);assert.equal((await call('/files/'+file.id)).status,401);}
 const c=(await call('/cases/'+cid,undefined,customer)).json.case;assert.equal((await call('/cases/'+cid,{action:'submit',version:c.version},customer)).status,200);
 assert.deepEqual((await call('/files/'+uploaded.json.file.id,undefined,customer)).bytes,jpg);
 // Read existing small blobs and chunked files through the same API, and remove all parts atomically.
 await store.transaction(async s=>{assert.deepEqual(await s.blob(uploaded.json.file.id),jpg);await s.removeBlob(document.json.file.id);assert.equal(await s.blob(document.json.file.id),null);});
 }finally{await new Promise(r=>server.close(r));await portal.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('HEIC validation rejects malformed containers and HTML disguised as an image',()=>{
 const {isHeif}=require('../portal/upload-format');const box=(type,data)=>{const b=Buffer.alloc(8);b.writeUInt32BE(data.length+8);b.write(type,4);return Buffer.concat([b,data]);};const valid=Buffer.concat([box('ftyp',Buffer.from('heic\0\0\0\0mif1heic')),box('meta',Buffer.alloc(12)),box('mdat',Buffer.alloc(10))]);assert.equal(isHeif(valid),true);assert.equal(isHeif(valid.subarray(0,-1)),false);assert.equal(isHeif(Buffer.from('<script>alert(1)</script>')),false);
});
test('General contact accepts a non-accident enquiry and validates email and consent',()=>{
 const {pruefe}=require('../anfrage');const input={name:'Test Person',email:'fixture@example.com',telefon:'',beschreibung:'Eine allgemeine Frage zur Zusammenarbeit.',anliegen:'sonstiges',kontaktweg:'email',datenschutz:true,t0:Date.now()-5000,website:''};const r=pruefe(input);assert.ok(r.daten);assert.equal(r.daten.anliegen,'sonstiges');assert.equal(r.daten.fahrzeug,'');assert.ok(pruefe({...input,email:'invalid'}).fehler.email);assert.ok(pruefe({...input,datenschutz:false}).fehler.datenschutz);
});
