'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createPortal}=require('../portal/app'),{createStore}=require('../portal/store'),D=require('../portal/domain'),H=require('../portal/hosts'),Help=require('../assets/help-content');

test('Retired education URLs are gone on every domain, including old HTML and bookmark links',()=>{
 for(const host of ['unfallx.com','www.unfallx.com','gutachten.unfallx.com','app.unfallx.com','admin.unfallx.com','mobile.unfallx.com']){
  for(const page of ['bildung','bildung-foerderung','kfz-gutachter-werden','schadenfotos-lernen','gutachten-aufbau'])for(const suffix of ['','.html','/','?quelle=alt#kursanmeldung']){
   const policy=H.hostPolicy(host,'/'+page+suffix);assert.equal(policy.gone,true,host+page+suffix);assert.equal(policy.redirect,undefined);
  }
 }
 for(const role of ['partner','admin','appraiser'])assert.doesNotMatch(JSON.stringify(Help.forRole(role)),/Bildung|AZAV|Kursanmeldung|Vormerkungen|Teilnehmer/);
 const root=path.join(__dirname,'..');
 for(const file of ['index.html','partials/home-header.html','partials/home-footer.html','partials/workspace-header.html','site.webmanifest','assets/portal.js','sitemap.xml'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/bildung|academy|AZAV|curriculum/i,file);
});

test('Retired course APIs cannot read or mutate historical records or send email for any role',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ux-retirement-')),env={NODE_ENV:'test',PORTAL_LOCAL_DB:path.join(dir,'test.sqlite'),PORTAL_ORIGIN:'http://localhost'};
 const store=await createStore(env),sent=[],portal=createPortal({env,store,mail:{ready:true,send:async(...m)=>sent.push(m)}});await portal.ready();
 const server=http.createServer((req,res)=>portal.handle(req,res,{}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const kinds=['academy_course','academy_registration','academy_token'];
 try{
  const actors=[{}];
  await store.transaction(async s=>{
   for(const kind of kinds)await s.put(kind,{id:'historical-record',status:'confirmed',privateNote:'HISTORICAL_PRIVATE',expires:Date.now()+3600000});
   for(const role of ['admin','partner']){const token=D.random(),csrf=D.random();await s.put('user',{id:role,email:role+'@example.com',role,active:true,verifiedAt:new Date().toISOString()});await s.put('session',{id:D.hash(token),userId:role,csrf,createdAt:new Date().toISOString(),expires:Date.now()+3600000});actors.push({Cookie:'ux_session='+token,'X-CSRF-Token':csrf});}
  });
  const snapshot=()=>store.transaction(async s=>Promise.all(kinds.map(k=>s.list(k))));const before=await snapshot();
  for(const actor of actors)for(const endpoint of ['/academy/courses','/academy/weeks','/academy/register','/academy/verify','/admin/academy'])for(const method of ['GET','POST']){
   const r=await fetch(base+'/api/portal'+endpoint,{method,headers:{Origin:env.PORTAL_ORIGIN,'Content-Type':'application/json',...actor},...(method==='POST'?{body:JSON.stringify({id:'historical-record',action:'schedule',status:'cancelled',email:'example@example.com'})}:{})});
   assert.equal(r.status,410,method+endpoint);assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('x-robots-tag'),/noindex/);assert.doesNotMatch(await r.text(),/HISTORICAL_PRIVATE/);
  }
  assert.deepEqual(await snapshot(),before);assert.equal(sent.length,0);
 }finally{await new Promise(r=>server.close(r));await portal.close();fs.rmSync(dir,{recursive:true,force:true});}
});
