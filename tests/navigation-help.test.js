'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),H=require('../portal/hosts'),Help=require('../assets/help-content');
const contexts=[['public',false,false,'partner'],['report',false,true,'partner'],['partner',true,false,'partner'],['admin',true,false,'admin']];
test('explicit links between public website, reports and workspaces retain their destinations',()=>{
 for(const [name,isApp,isReport,workspace] of contexts)for(const origin of [H.PUBLIC_ORIGIN,H.APP_ORIGIN,H.ADMIN_ORIGIN])for(const suffix of ['/','/#kontakt','/?quelle=header','/datenschutz']){const href=origin+suffix;assert.equal(H.links('<a href="'+href+'">Link</a>',isApp,true,isReport,workspace),'<a href="'+href+'">Link</a>',name+' to '+href);}
});
test('report articles open on the consolidated company page',()=>{
 for(const [name,isApp,isReport,workspace] of contexts){for(const p of ['/unfallgutachten','/wertgutachten','/einsatzgebiete'])assert.equal(H.links('<a href="'+p+'">Link</a>',isApp,true,isReport,workspace),'<a href="'+H.PUBLIC_ORIGIN+'/ueber-uns#'+p.slice(1)+'">Link</a>');}
});
test('relative workspace navigation stays in the selected app',()=>{
 for(const role of ['partner','admin'])for(const p of ['/','/portal','/app-hilfe','/app-hilfe#fotos','/datenschutz'])assert.equal(H.links('<a href="'+p+'">Link</a>',true,true,false,role),'<a href="'+H.workspaces[role].origin+p+'">Link</a>');
 for(const role of ['partner','admin'])assert.equal(H.hostPolicy(new URL(H.workspaces[role].origin).host,'/workspace-login.html?next=portal').redirect,H.workspaces[role].origin+'/login?next=portal');
});
test('role-specific help links resolve to real topics and exclude administrative tasks from partner guides',()=>{
 const routes=['start','faelle','fall/123','neu','status','statistik','empfehlungen','abrechnung','firma','dokumente','kanzleien','partner','team','provisionen','versand','einstellungen','konto'];
 for(const role of ['partner','admin','appraiser']){const topics=Help.forRole(role),ids=topics.map(t=>t.id);assert.equal(new Set(ids).size,ids.length);for(const route of routes)assert.ok(ids.includes(Help.contextual(role,route)),role+route);assert.ok(ids.includes('fotos'));assert.ok(ids.includes('login'));if(['partner','appraiser'].includes(role))for(const id of ['team','partner','bildung','provisionen'])assert.ok(!ids.includes(id),role+' unexpectedly has '+id);}
});
test('retired mobile and promotional pages lead to the remaining workspaces and homepage introduction',()=>{
 assert.deepEqual(Object.keys(H.workspaces),['partner','admin']);
 for(const path of ['/','/portal?quelle=alt','/login','/passwort','/app-hilfe#fotos']){
  const u=new URL(path,H.MOBILE_ORIGIN),expected=H.APP_ORIGIN+u.pathname+u.search;
  assert.equal(H.hostPolicy('mobile.unfallx.com',u.pathname+u.search).redirect,expected);
  for(const [,isApp,isReport,w]of contexts)assert.equal(H.links('<a href="'+u.href+'">Alt</a>',isApp,true,isReport,w),'<a href="'+expected+u.hash+'">Alt</a>');
 }
 for(const origin of [H.PUBLIC_ORIGIN,H.APP_ORIGIN,H.ADMIN_ORIGIN,H.REPORT_ORIGIN]){
  const host=new URL(origin).host;
  for(const p of ['/mobile','/mobile.html','/mobile-app','/mobile-app.html'])assert.equal(H.hostPolicy(host,p).redirect,H.APP_ORIGIN+'/portal');
  assert.equal(H.hostPolicy(host,'/app-demo').redirect,H.PUBLIC_ORIGIN+'/#app');
  assert.equal(H.hostPolicy(host,'/mitglied-werden?quelle=alt').redirect,(origin===H.ADMIN_ORIGIN?H.ADMIN_ORIGIN+'/login':H.APP_ORIGIN+'/registrieren')+'?quelle=alt');
 }
 assert.equal(H.isRetiredHost('mobile.unfallx.com.evil.example'),false);
 assert.equal(H.workspaceForHost('mobile.unfallx.com'),null);
});
