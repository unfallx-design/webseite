'use strict';
const APP_ORIGIN='https://app.unfallx.com',PUBLIC_ORIGIN='https://unfallx.com',REPORT_ORIGIN='https://gutachten.unfallx.com';
const appPages=new Set(['/empfehlungsbedingungen','/app','/app-demo','/app-hilfe','/portal-datenschutz','/login','/portal','/partner-app','/gutachter-portal','/kundenportal','/registrieren','/mitglied-werden','/schaden-melden','/passwort','/konto-vervollstaendigen','/benachrichtigungen','/status','/kanzleipartner','/empfehlen']);
const reportPages=new Set(['/unfallgutachten','/wertgutachten','/kostenvoranschlag','/kfz-gutachten','/kfz-gutachter-berlin','/kfz-gutachter-brandenburg','/einsatzgebiete','/unfall-checkliste','/wertminderung','/nutzungsausfall','/mietwagen','/totalschaden']);
const reportAnchors=new Set(['gutachten','anfrage','leistungen','vorteile','ablauf','halle','unfallservice','ueber-uns','vertrauen','desag-zertifikat','bewertungen','einsatzgebiet','ratgeber','faq','schadenbilder','standort']);
const sharedPages=new Set(['/impressum','/datenschutz','/agb']);
const clean=p=>p.replace(/\.html$/i,'').replace(/\/$/,'');
const appPath=p=>appPages.has(clean(p));
const reportPath=p=>reportPages.has(clean(p));
const assetPath=p=>/^\/(?:api\/|assets\/|health$|(?:app|site)\.webmanifest$|apple-touch-icon(?:-precomposed)?\.png$|favicon\.ico$|robots\.txt$|sitemap\.xml$)/.test(p);
function hostPolicy(host,url){
 const u=new URL(url,PUBLIC_ORIGIN),name=String(host||'').toLowerCase().split(':')[0];
 const isApp=name==='app.unfallx.com',isReport=name==='gutachten.unfallx.com',isPublic=['unfallx.com','www.unfallx.com'].includes(name);
 if(!isApp&&!isPublic&&!isReport)return {isApp:false,isReport:false,production:false};
 const info={isApp,isReport,production:true},p=clean(u.pathname);
 if(p==='/gutachten-start')return {redirect:REPORT_ORIGIN+'/'+u.search};
 if(appPath(p)&&!isApp)return {redirect:APP_ORIGIN+(p==='/app'?'/':u.pathname)+u.search};
 if(reportPath(p)&&!isReport)return {redirect:REPORT_ORIGIN+u.pathname+u.search};
 if(isApp&&p==='/app')return {redirect:APP_ORIGIN+'/'+u.search};
 if(name==='www.unfallx.com')return {redirect:PUBLIC_ORIGIN+u.pathname+u.search};
 if((isApp||isReport)&&p&&!assetPath(u.pathname)&&!sharedPages.has(p)&&!(isApp?appPath(p):reportPath(p)))return {redirect:PUBLIC_ORIGIN+u.pathname+u.search};
 return info;
}
function links(html,isApp,production,isReport=false){
 if(!production)return html;
 const origin=isApp?APP_ORIGIN:isReport?REPORT_ORIGIN:PUBLIC_ORIGIN;
 let out=html.replace(/href="((?:https:\/\/(?:app\.|gutachten\.)?unfallx\.com)?\/(?!\/)[^"]*)"/g,(m,value)=>{
  const u=new URL(value,PUBLIC_ORIGIN),p=clean(u.pathname),suffix=u.search+u.hash;
  if(assetPath(u.pathname))return m;
  if(appPath(p))return 'href="'+APP_ORIGIN+(p==='/app'?'/':u.pathname)+suffix+'"';
  if(reportPath(p))return 'href="'+REPORT_ORIGIN+u.pathname+suffix+'"';
  if(!p&&reportAnchors.has(u.hash.slice(1))&&!isApp)return 'href="'+REPORT_ORIGIN+'/'+suffix+'"';
  if(!p||sharedPages.has(p))return 'href="'+origin+u.pathname+suffix+'"';
  return 'href="'+PUBLIC_ORIGIN+u.pathname+suffix+'"';
 });
 out=out.replace(/(<(?:link rel="canonical" href|meta property="og:url" content)=")https:\/\/unfallx\.com([^" ]*)/g,(_,a,p)=>a+origin+(isApp&&p==='/app'?'/':p));
 out=out.replace(/https:\/\/unfallx\.com\/(unfallgutachten|wertgutachten|kostenvoranschlag|kfz-gutachten|kfz-gutachter-berlin|kfz-gutachter-brandenburg|einsatzgebiete|unfall-checkliste|wertminderung|nutzungsausfall|mietwagen|totalschaden)(?=["#?/])/g,REPORT_ORIGIN+'/$1');
 return out;
}
module.exports={APP_ORIGIN,PUBLIC_ORIGIN,REPORT_ORIGIN,appPath,reportPath,hostPolicy,links};
