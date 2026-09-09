'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('../portal/domain'),P=require('../portal/passwords'),H=require('../portal/hosts'),{createPortal}=require('../portal/app'),{createStore}=require('../portal/store');
test('Three dedicated workspace hosts keep routes and navigation inside the correct area',()=>{
 for(const [w,c] of Object.entries(H.workspaces)){
  const host=new URL(c.origin).host;assert.equal(H.hostPolicy(host,'/').workspace,w);assert.equal(H.hostPolicy(host,'/api/portal/me').workspace,w);
  const html=H.links('<a href="/">Home</a><a href="/login">Login</a><a href="/portal">Cases</a>',true,true,false,w);assert(!html.includes('https://unfallx.com/'));assert(html.includes(c.origin+'/login'));
 }
 assert.equal(H.hostPolicy('app.unfallx.com','/gutachter-portal').redirect,H.ADMIN_ORIGIN+'/gutachter-portal');
 assert.equal(H.hostPolicy('unfallx.com','/gutachter-portal').redirect,H.ADMIN_ORIGIN+'/gutachter-portal');
 assert.equal(H.hostPolicy('app.unfallx.com','/login?bereich=team').redirect,H.ADMIN_ORIGIN+'/login');
 assert.equal(H.hostPolicy('admin.unfallx.com','/registrieren').redirect,H.ADMIN_ORIGIN+'/login');
 assert.equal(H.hostPolicy('app.unfallx.com','/mobile').redirect,H.MOBILE_ORIGIN+'/portal');
 assert.equal(H.workspaceForHost('admin.unfallx.com.evil.example'),null);
});
test('Workspace roles, host-bound sessions, request origins and access emails are enforced',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ux-workspaces-')),env={NODE_ENV:'test',PORTAL_LOCAL_DB:path.join(dir,'test.sqlite'),PORTAL_ORIGIN:'http://localhost',PORTAL_TRUST_PROXY:'true'},sent=[];
 const store=await createStore(env),portal=createPortal({env,store,mail:{ready:true,send:async(to,subject,text)=>sent.push({to,subject,text})}});await portal.ready();const server=http.createServer((req,res)=>portal.handle(req,res,{}));await new Promise(r=>server.listen(0,'127.0.0.1',r));let seq=0;
 const password='Workspace fixture secret phrase 2026!';const encoded=await P.encode(password);
 const addresses={partner:'partner@fixture.example',admin:'info@unfallx.com',appraiser:'team@fixture.example',other:'other@fixture.example'};
 for(const [kind,address]of Object.entries(addresses))await store.transaction(async s=>{const companyId=['partner','other'].includes(kind)?kind:null;if(companyId)await s.put('company',{id:companyId,name:'Fixture '+kind,status:'approved'});await s.put('user',{id:D.hash(address),name:'Fixture '+kind,email:address,role:kind==='other'?'partner':kind,companyId,active:true,verifiedAt:new Date().toISOString(),passwordHash:encoded},companyId||'internal');});
 async function call(w,p,data,actor={},extra={}){return new Promise((resolve,reject)=>{const host=new URL(H.workspaces[w].origin).host;const req=http.request({host:'127.0.0.1',port:server.address().port,path:'/api/portal'+p,method:data===undefined?'GET':'POST',headers:{Host:host,Origin:H.workspaces[w].origin,'Content-Type':'application/json','X-Forwarded-For':'fixture-'+(++seq),...actor,...extra}},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>{try{resolve({status:res.statusCode,json:JSON.parse(Buffer.concat(chunks)),cookie:res.headers['set-cookie']?.[0]||null});}catch(e){reject(e);}});});req.on('error',reject);req.end(data===undefined?undefined:JSON.stringify(data));});}
 async function login(w,kind){const r=await call(w,'/password-login',{email:addresses[kind],password});assert.equal(r.status,200,r.json.error);const headers={Cookie:r.cookie.split(';')[0]};const m=await call(w,'/me',undefined,headers);assert.equal(m.status,200);headers['X-CSRF-Token']=m.json.csrf;return headers;}
 try{
 let partner,mobile,admin,staff;
 await t.test('Each account can only log in to its permitted host, and cookies cannot be replayed on another host',async()=>{
  for(const [w,kind]of [['partner','admin'],['mobile','admin'],['partner','appraiser'],['mobile','appraiser'],['admin','partner']]){const r=await call(w,'/password-login',{email:addresses[kind],password});assert.equal(r.status,403);assert.equal(r.cookie,null);}
  [partner,mobile,admin,staff]=await Promise.all([login('partner','partner'),login('mobile','partner'),login('admin','admin'),login('admin','appraiser')]);
  for(const [w,h]of [['mobile',partner],['partner',mobile],['partner',admin],['admin',partner]])assert([401,403].includes((await call(w,'/me',undefined,h)).status));
  assert.equal((await call('mobile','/admin/overview',undefined,mobile)).status,403);assert.equal((await call('admin','/admin/overview',undefined,staff)).status,403);
  assert.equal((await call('mobile','/cases',{plate:'CSRF'},mobile,{Origin:H.APP_ORIGIN})).status,403);
  assert.equal((await call('partner','/cases',{plate:'CSRF'},partner,{'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await call('admin','/register',{email:'new@fixture.example'})).status,403);
 });
 await t.test('Mobile intake is the same durable case visible to its partner and internal team, with tenant and version protection',async()=>{
  const created=await call('mobile','/cases',{vehicle:'Mobile test vehicle',plate:'TEST-10'},mobile);assert.equal(created.status,200);const id=created.json.case.id;
  for(const [w,h]of [['partner',partner],['admin',admin]])assert.equal((await call(w,'/cases/'+id,undefined,h)).json.case.intake.plate,'TEST-10');
  const changed=await call('partner','/cases/'+id,{...created.json.case.intake,plate:'TEST-11',action:'save',version:created.json.case.version},partner);assert.equal(changed.status,200);
  assert.equal((await call('mobile','/cases/'+id,{...created.json.case.intake,action:'save',version:created.json.case.version},mobile)).status,409);
  const other=await login('mobile','other');assert.equal((await call('mobile','/cases/'+id,undefined,other)).status,404);
 });
 await t.test('Reset and invitation links use the account’s correct domain; wrong-host tokens do not consume or mutate accounts',async()=>{
  await call('partner','/password/request',{email:addresses.admin});let mail=sent.findLast(m=>m.to===addresses.admin);assert(mail.text.includes(H.ADMIN_ORIGIN+'/passwort#token='));const token=mail.text.match(/#token=([a-f0-9]{64})/)[1];
  const changedPassword='New workspace fixture secret phrase 2026!';assert.equal((await call('partner','/password/finish',{token,password:changedPassword})).status,403);assert.equal((await call('admin','/password/finish',{token,password:changedPassword})).status,200);assert(sent.findLast(m=>m.to===addresses.admin).text.includes(H.ADMIN_ORIGIN+'/login'));
  // Restore fixture session with its newly chosen password, without using a production account.
  const l=await call('admin','/password-login',{email:addresses.admin,password:changedPassword});admin={Cookie:l.cookie.split(';')[0]};admin['X-CSRF-Token']=(await call('admin','/me',undefined,admin)).json.csrf;
  await call('admin','/admin/invite',{name:'Invited fixture',email:'invite@fixture.example'},admin);mail=sent.findLast(m=>m.to==='invite@fixture.example');assert(mail.text.includes(H.ADMIN_ORIGIN+'/login#token='));const invitation=mail.text.match(/#token=([a-f0-9]{64})/)[1];assert.equal((await call('mobile','/exchange',{token:invitation})).status,403);assert.equal((await call('admin','/exchange',{token:invitation})).status,200);
  await call('mobile','/password/request',{email:addresses.partner});assert(sent.findLast(m=>m.to===addresses.partner).text.includes(H.MOBILE_ORIGIN+'/passwort#token='));
  await call('partner','/login',{email:addresses.appraiser});assert(sent.findLast(m=>m.to===addresses.appraiser).text.includes(H.ADMIN_ORIGIN+'/login#token='));
 });
 }finally{await new Promise(r=>server.close(r));await portal.close();fs.rmSync(dir,{recursive:true,force:true});}
});
