'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),H=require('../portal/hosts'),Help=require('../assets/help-content');
const contexts=[['public',false,false,'partner'],['report',false,true,'partner'],['partner',true,false,'partner'],['admin',true,false,'admin'],['mobile',true,false,'mobile']];
test('explicit links between public website, reports and workspaces retain their destinations',()=>{
 for(const [name,isApp,isReport,workspace] of contexts)for(const origin of [H.PUBLIC_ORIGIN,H.REPORT_ORIGIN,H.APP_ORIGIN,H.ADMIN_ORIGIN,H.MOBILE_ORIGIN])for(const suffix of ['/','/#kontakt','/?quelle=header','/datenschutz']){const href=origin+suffix;assert.equal(H.links('<a href="'+href+'">Link</a>',isApp,true,isReport,workspace),'<a href="'+href+'">Link</a>',name+' to '+href);}
});
test('education links stay public and report pages open on their own domain',()=>{
 for(const [name,isApp,isReport,workspace] of contexts){for(const p of ['/bildung','/bildung#kursanmeldung','/bildung-foerderung','/kfz-gutachter-werden','/schadenfotos-lernen','/gutachten-aufbau'])assert.equal(H.links('<a href="'+p+'">Link</a>',isApp,true,isReport,workspace),'<a href="'+H.PUBLIC_ORIGIN+p+'">Link</a>',name+p);
 for(const p of ['/unfallgutachten','/wertgutachten','/einsatzgebiete'])assert.equal(H.links('<a href="'+p+'">Link</a>',isApp,true,isReport,workspace),'<a href="'+H.REPORT_ORIGIN+p+'">Link</a>');}
});
test('relative workspace navigation stays in the selected app',()=>{
 for(const role of ['partner','admin','mobile'])for(const p of ['/','/portal','/app-hilfe','/app-hilfe#fotos','/datenschutz'])assert.equal(H.links('<a href="'+p+'">Link</a>',true,true,false,role),'<a href="'+H.workspaces[role].origin+p+'">Link</a>');
});
test('role-specific help links resolve to real topics and exclude administrative tasks from partner and mobile guides',()=>{
 const routes=['start','faelle','fall/123','neu','status','statistik','empfehlungen','abrechnung','firma','dokumente','kanzleien','partner','team','bildung','provisionen','versand','einstellungen','konto'];
 for(const role of ['partner','admin','appraiser','mobile']){const topics=Help.forRole(role),ids=topics.map(t=>t.id);assert.equal(new Set(ids).size,ids.length);for(const route of routes)assert.ok(ids.includes(Help.contextual(role,route)),role+route);assert.ok(ids.includes('fotos'));assert.ok(ids.includes('login'));if(['partner','mobile','appraiser'].includes(role))for(const id of ['team','partner','bildung','provisionen'])assert.ok(!ids.includes(id),role+' unexpectedly has '+id);}
});
