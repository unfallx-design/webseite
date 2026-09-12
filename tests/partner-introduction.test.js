'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),net=require('node:net'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
test('Partner introduction is public while login, installed workspace and admin entry remain separate',async()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ux-introduction-'));
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),PORTAL_LOCAL_DB:path.join(temporary,'test.sqlite'),PORTAL_ORIGIN:'http://127.0.0.1:'+port},stdio:['ignore','pipe','pipe']});
 const closed=new Promise(resolve=>child.once('exit',resolve));
 async function get(host,url,method='GET'){return new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port,path:url,method,headers:{Host:host}},res=>{let body='';res.setEncoding('utf8');res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});r.on('error',reject);r.end();});}
 try{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Preview server failed to start')),8000);child.stdout.on('data',x=>{if(String(x).includes('Webseite laeuft')){clearTimeout(timeout);resolve();}});child.once('error',reject);child.stderr.resume();});
  const intro=await get('app.unfallx.com','/');assert.equal(intro.status,200);assert.match(intro.body,/Du nimmst auf/);assert.match(intro.body,/id="verdienst"/);assert.match(intro.body,/href="https:\/\/app.unfallx.com\/login"/);assert.match(intro.body,/href="https:\/\/app.unfallx.com\/registrieren"/);assert(!intro.body.includes('id="login-form"'));assert(!intro.body.includes('admin.unfallx.com'));assert(!intro.body.includes('/assets/app-shell.css'));assert(!intro.headers['set-cookie']);
  for(const [host,url]of [['app.unfallx.com','/login'],['admin.unfallx.com','/'],['admin.unfallx.com','/login']]){const r=await get(host,url);assert.equal(r.status,200);assert.match(r.body,/id="login-form"/);assert(!r.body.includes('id="verdienst"'));}
  for(const host of ['app.unfallx.com','admin.unfallx.com']){const r=await get(host,'/api/portal/me');assert.equal(r.status,401);const manifest=JSON.parse((await get(host,'/app.webmanifest')).body);assert.equal(manifest.start_url,host.startsWith('app.')?'/portal':'/');assert.equal(manifest.scope,'/');}
  const portal=await get('app.unfallx.com','/portal');assert.match(portal.body,/id="portal-root"/);assert(!portal.body.includes('id="verdienst"'));
  const home=await get('unfallx.com','/');assert.match(home.body,/design-hero/);assert.match(home.body,/Über uns &amp; unsere Leistungen/);assert.match(home.body,/unfallx-ios-overview-v4-small.webp/);
  const about=await get('unfallx.com','/ueber-uns');assert.equal(about.status,200);assert.match(about.body,/canonical" href="https:\/\/unfallx.com\/ueber-uns"/);assert(!about.body.includes('gutachten.unfallx.com'));assert.equal((about.body.match(/<h1[ >]/g)||[]).length,1);
  for(const slug of ['unfallgutachten','wertgutachten','kostenvoranschlag','kfz-gutachten','kfz-gutachter-berlin','kfz-gutachter-brandenburg','einsatzgebiete','unfall-checkliste','wertminderung','nutzungsausfall','mietwagen','totalschaden']){
   assert(about.body.includes('id="'+slug+'"'));
   for(const host of ['unfallx.com','app.unfallx.com','gutachten.unfallx.com']){const r=await get(host,'/'+slug+'.html?quelle=alt');assert.equal(r.status,308);assert.equal(r.headers.location,'https://unfallx.com/ueber-uns?quelle=alt#'+slug);}
   assert(!fs.existsSync(path.join(__dirname,'..',slug+'.html')));
  }
  const retired=await get('gutachten.unfallx.com','/?quelle=alt');assert.equal(retired.status,308);assert.equal(retired.headers.location,'https://unfallx.com/ueber-uns?quelle=alt');
  const retiredPost=await get('gutachten.unfallx.com','/api/anfrage','POST');assert.equal(retiredPost.status,410);assert(!retiredPost.headers.location);
  const retiredApi=await get('gutachten.unfallx.com','/api/portal/me');assert.equal(retiredApi.status,410);assert(!retiredApi.headers.location);assert(!retiredApi.headers['set-cookie']);
  const sitemap=await get('unfallx.com','/sitemap.xml');assert(sitemap.body.includes('https://unfallx.com/ueber-uns'));assert(!sitemap.body.includes('gutachten.unfallx.com'));
  const footer=home.body.split('<footer class="connect-footer">')[1];assert(footer.includes('href="https://unfallx.com/ueber-uns"'));assert.equal((footer.match(/href="https:\/\/unfallx.com\/#kontakt"/g)||[]).length,1);
  for(const host of ['app.unfallx.com','admin.unfallx.com']){const r=await get(host,'/portal');assert.match(r.body,/class="portal-top"/);assert.match(r.body,/workspace-unified.css/);assert(!r.body.includes('<!--#include:'));const help=await get(host,'/app-hilfe');assert.match(help.body,/workspace-top/);const legal=await get(host,'/impressum');assert.match(legal.body,/workspace-top/);assert(!legal.body.includes('connect-footer'));}
  const alias=await get('unfallx.com','/partner-start?quelle=test');assert.equal(alias.status,308);assert.equal(alias.headers.location,'https://app.unfallx.com/?quelle=test');
 }finally{child.kill('SIGTERM');await closed;fs.rmSync(temporary,{recursive:true,force:true});}
});
