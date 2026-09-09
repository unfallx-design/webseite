'use strict';
const {brandHtml}=require('./brand-mail');
const {assert,text,email,date,id,hash,random,Problem,money}=require('./domain');
const CAPACITY=26,DAY=86400000;
const escape=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function weeks(start){
 if(!start)return ['start-folgt'];
 const d=new Date(start+'T12:00:00Z');
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 while(d.toISOString().slice(0,10)<today)d.setUTCDate(d.getUTCDate()+7);
 return Array.from({length:12},(_,i)=>new Date(d.getTime()+i*7*DAY).toISOString().slice(0,10));
}
const active=r=>['requested','confirmed'].includes(r.status);
const label=week=>week==='start-folgt'?'wird demnächst bekannt gegeben':week?new Intl.DateTimeFormat('de-DE',{dateStyle:'long',timeZone:'UTC'}).format(new Date(week+'T12:00:00Z')):'Digital · demnächst';
function academyEmail({origin,name,week,mode,token,status,course}){
 const verification=!!token;
 const state={requested:'Deine Anmeldung ist auf unserer Vormerkliste.',confirmed:'Dein Kursplatz wurde von UNFALLX bestätigt.',waitlisted:'Du stehst auf unserer Warteliste.',cancelled:'Deine Anmeldung wurde storniert.',interest:'Du bist auf unserer Interessentenliste für digitale Kurse.'}[status]||'Bitte bestätige deine E-Mail-Adresse.';
 const url=origin+'/bildung'+(token?'#bestaetigen='+token:'');
 const subject=verification?'UNFALLX Bildung – Anmeldung bestätigen':'UNFALLX Bildung – Status deiner Anmeldung';
 const intro=verification?'Bestätige deine E-Mail, damit wir deine Kursanfrage aufnehmen können. Erst die Bestätigung ordnet deine Anmeldung der Vormerk- oder Warteliste zu.':state;
 const coursePrice=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format((course?.price??150000)/100);const detail=course&&mode==='digital'&&!week?'Digitale Kurse sind in Vorbereitung. Inhalte, Start und Preis werden demnächst bekannt gegeben. Deine Interessensbekundung ist unverbindlich.':course?`${course.title} · ${course.duration} · ${course.location||'Online'} · Start: ${label(week)}. Kurskosten: ${coursePrice} pro Person (Gesamtpreis). Die Anfrage ist kostenlos und unverbindlich. Ein kostenpflichtiger Vertrag entsteht erst nach persönlicher Abstimmung.`:mode==='digital'?'Digitale Kurse sind in Vorbereitung. Wir informieren dich, sobald das Angebot startet.':'Praxiskurs in Berlin · eine Woche · Start: '+label(week)+'. Kurskosten: 1.500 € pro Person. Die Anfrage ist kostenlos und unverbindlich. Durchführung, genauer Lernort und Zeiten stimmen wir persönlich mit dir ab. Es entsteht durch diese E-Mail kein kostenpflichtiger Vertrag.';
 const textBody=`Hallo ${name},\n\n${intro}\n\n${detail}\n\n${verification?'Anmeldung bestätigen (24 Stunden gültig):':'Informationen:'}\n${url}\n\n${verification?'Falls du die Anmeldung nicht angefordert hast, ignoriere diese E-Mail. Der Link ist einmal verwendbar.':'Fragen oder Stornierung? Antworte bitte an info@unfallx.com und nenne deine Kurswoche.'}\n\nUNFALLX · Unext GmbH\nEmmentaler Str. 76E, 13407 Berlin\ninfo@unfallx.com\n${origin}/impressum\n${origin}/portal-datenschutz`;
 const html=`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#f1f3f6;font-family:Arial,sans-serif;color:#344155"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 14px"><table role="presentation" style="width:100%;max-width:600px;background:white;border:1px solid #e0e4eb;border-radius:20px;overflow:hidden"><tr><td style="padding:30px;background:#11151c;border-bottom:4px solid #e3241c;color:white;font-size:26px;font-weight:bold">UNFALL<span style="color:#ff443b">X</span><div style="font-size:12px;letter-spacing:3px;margin-top:12px">BILDUNG · WISSEN AUS DER PRAXIS</div></td></tr><tr><td style="padding:32px"><p>Hallo ${escape(name)},</p><h1 style="font-size:27px;line-height:1.2;color:#142137">${escape(intro)}</h1><p style="font-size:16px;line-height:1.8">${escape(detail)}</p><a href="${escape(url)}" style="display:inline-block;background:#e3241c;color:white;padding:17px 24px;border-radius:10px;font-weight:bold;text-decoration:none">${verification?'Anmeldung bestätigen':'Bildungsangebot ansehen'} →</a><p style="font-size:13px;line-height:1.8;margin-top:24px">${verification?'Einmalig verwendbar · 24 Stunden gültig. Falls du keine Anmeldung angefordert hast, kannst du diese Nachricht ignorieren.':'Für Rückfragen oder Stornierung: info@unfallx.com. Bitte nenne deine Kurswoche.'}</p><p style="font-size:11px;overflow-wrap:anywhere;word-break:break-all">${escape(url)}</p><hr style="border:0;border-top:1px solid #e1e6ed"><p style="font-size:12px;line-height:1.7">UNFALLX · Unext GmbH<br>Emmentaler Str. 76E · 13407 Berlin<br><a href="${origin}/impressum">Impressum</a> · <a href="${origin}/portal-datenschutz">Datenschutz</a></p></td></tr></table></td></tr></table></body></html>`;
 return {subject,text:textBody,html:brandHtml(html)};
}
function createAcademy({tx,rate,mail,origin}){
 async function send(record,token){const e=academyEmail({...record,origin,token});await mail.send(record.email,e.subject,e.text,[],e.html);}
 const defaultCourses=[{id:'praxis-berlin',title:'Kfz-Gutachten · Praxiskurs Berlin',description:'Eine Woche Fahrzeugaufnahme, Fotodokumentation und Grundlagen der Gutachtenerstellung in Berlin.',price:150000,capacity:26,duration:'1 Woche',mode:'berlin',location:'Berlin',weekly:true,start:'',status:'published',version:0},{id:'digital',title:'Kfz-Gutachten · Digitale Kurse',description:'Unser digitales Lernangebot ist in Vorbereitung. Jetzt unverbindlich Interesse vormerken.',price:0,capacity:26,duration:'Wird bekannt gegeben',mode:'digital',location:'Online',weekly:false,start:'',status:'published',version:0}];
 const courseId=r=>r.courseId||(r.mode==='digital'?'digital':'praxis-berlin');
 async function courses(s){const stored=await s.list('academy_course');const list=defaultCourses.map(d=>stored.find(c=>c.id===d.id)||{...d});for(const c of stored)if(!list.some(x=>x.id===c.id))list.push(c);const schedule=await s.get('academy_schedule','berlin');for(const c of list)if(c.id==='praxis-berlin'&&!c.start&&schedule?.start)c.start=schedule.start;return list;}
 async function courseFor(s,id='praxis-berlin'){const c=(await courses(s)).find(c=>c.id===id);assert(c,'Kurs nicht gefunden.',404);return c;}
 async function offered(s,c){c=c||await courseFor(s);if(c.mode==='digital'&&!c.start)return [''];if(!c.start)return ['start-folgt'];return c.weekly?weeks(c.start):[c.start].filter(d=>d>=new Date().toISOString().slice(0,10));}
 async function availability(s,c){c=c||await courseFor(s);const rows=await s.list('academy_registration');return (await offered(s,c)).map(week=>{const reserved=rows.filter(r=>courseId(r)===c.id&&r.week===week&&active(r)).length;return {week,capacity:c.capacity,reserved,available:Math.max(0,c.capacity-reserved),waitlisted:rows.filter(r=>courseId(r)===c.id&&r.week===week&&r.status==='waitlisted').length};});}
 async function catalog(s,all=false){const result=[];for(const c of await courses(s))if(all||c.status==='published')result.push({...c,weeks:await availability(s,c)});return result;}
 async function saveCourse(data,user){return tx(async s=>{const old=data.id?await courseFor(s,text(data.id,128,true)):null;assert(!old||data.version===old.version,'Kurs wurde geändert. Bitte neu laden.',409);const mode=text(data.mode,20,true);assert(['berlin','digital'].includes(mode),'Ungültiges Format.');assert(['draft','published','archived'].includes(data.status),'Ungültiger Veröffentlichungsstatus.');const capacity=Number(data.capacity);assert(Number.isInteger(capacity)&&capacity>=1&&capacity<=26,'Bitte 1 bis 26 Plätze eingeben.');const start=data.start?date(data.start):'';if(start&&(!old||old.start!==start))assert(start>=new Date().toISOString().slice(0,10),'Bitte einen zukünftigen Starttermin wählen.');if(start)assert(!data.weekly||new Date(start+'T12:00:00Z').getUTCDay()===1,'Wöchentliche Kurse starten montags.');const rows=old?(await s.list('academy_registration')).filter(r=>courseId(r)===old.id&&r.status!=='cancelled'):[];if(old&&rows.length){assert(old.mode===mode,'Bei vorhandenen Anmeldungen bitte einen neuen Kurs für ein anderes Format anlegen.');assert(!old.start||old.start===start,'Ein gebuchter Starttermin kann nicht verschoben werden. Bitte einen neuen Kurs anlegen.');assert(old.weekly===(data.weekly===true),'Der Rhythmus eines Kurses mit Anmeldungen bleibt bestehen.');for(const w of new Set(rows.map(r=>r.week)))assert(rows.filter(r=>r.week===w&&active(r)).length<=capacity,'Die Kapazität darf vorhandene Anmeldungen nicht unterschreiten.');}
 const record={id:old?.id||id(),title:text(data.title,160,true),description:text(data.description,2500,true),price:money(data.price),capacity,duration:text(data.duration,120,true),mode,location:text(data.location,200,true),weekly:data.weekly===true,start,status:data.status,version:(old?.version||0)+1,updatedAt:new Date().toISOString()};if(mode==='berlin')assert(record.price>0,'Bitte einen Kurspreis angeben.');await s.put('academy_course',record);if(old&&!old.start&&start){for(const r of rows)if(r.week==='start-folgt'||r.week===''){r.week=start;await s.put('academy_registration',r,start);}}await s.put('admin_event',{id:id(),action:'Kurs gespeichert: '+record.title,actor:user.id,at:record.updatedAt});return {message:record.status==='published'?'Kurs und Preis sind auf der Website veröffentlicht.':'Kurs gespeichert.',course:record};});}
 async function publicRoute(path,req,data,ip){
  if(path==='/academy/courses'&&req.method==='GET')return tx(async s=>({courses:await catalog(s)}));
  if(path==='/academy/weeks'&&req.method==='GET')return tx(async s=>({weeks:await availability(s),capacity:CAPACITY}));
  if(path==='/academy/register'&&req.method==='POST'){
   assert(mail.ready,'Der E-Mail-Versand ist gerade nicht verfügbar.',503);
   const mode=text(data.mode,20,true);assert(['berlin','digital'].includes(mode),'Bitte ein Kursformat wählen.');
   const week=text(data.week,20,mode==='berlin');
   assert(data.privacy===true,'Bitte die Datenschutzhinweise bestätigen.');
   const address=email(data.email),name=text(data.name,120,true),phone=text(data.phone,40,true),background=text(data.background,1200);
   const result=await tx(async s=>{
    const c=await courseFor(s,text(data.courseId,128)||(mode==='digital'?'digital':'praxis-berlin'));assert(c.status==='published'&&c.mode===mode,'Dieser Kurs ist nicht für die Anmeldung verfügbar.');assert((await offered(s,c)).includes(week),'Bitte einen angebotenen Kurs wählen.');
    await rate(s,'academy-ip:'+ip,8);await rate(s,'academy-email:'+address,3);await rate(s,'academy-global',200,DAY);
    const previous=(await s.list('academy_registration')).find(r=>courseId(r)===c.id&&r.week===week&&r.email===address);const rid=previous?.id||hash(c.id+':'+week+':'+address),old=previous;
    if(old&&old.status!=='email_pending')return null;
    const record={id:rid,mode,week,courseId:c.id,course:{title:c.title,price:c.price,duration:c.duration,location:c.location},email:address,name,phone,background,status:'email_pending',privacyVersion:'2026-09-09',createdAt:old?.createdAt||new Date().toISOString()};
    for(const t of await s.list('academy_token',rid))await s.remove('academy_token',t.id);
    const token=random();await s.put('academy_token',{id:hash(token),registrationId:rid,expires:Date.now()+DAY},rid);await s.put('academy_registration',record,week||'digital');return {record,token};
   });
   if(result)try{await send(result.record,result.token);}catch{await tx(s=>s.remove('academy_token',hash(result.token)));throw new Problem(503,'Die Bestätigungs-E-Mail konnte nicht versandt werden. Bitte erneut versuchen.');}
   return {message:'Wenn für diese Adresse noch keine bestätigte Anfrage vorliegt, erhältst du eine E-Mail. Bestätige deine Anmeldung über den Link. Bitte auch im Spamordner prüfen.'};
  }
  if(path==='/academy/verify'&&req.method==='POST'){
   assert(/^[a-f0-9]{64}$/.test(data.token||''),'Ungültiger Bestätigungslink.');
   const result=await tx(async s=>{
    await rate(s,'academy-verify:'+ip,40);const t=await s.get('academy_token',hash(data.token));assert(t&&t.expires>Date.now(),'Der Link ist abgelaufen oder wurde bereits benutzt. Bei Fragen: info@unfallx.com.',401);
    const r=await s.get('academy_registration',t.registrationId);assert(r&&r.status==='email_pending','Diese Anmeldung wurde bereits bearbeitet.',409);
    const c=await courseFor(s,courseId(r));assert(c.status==='published','Dieser Kurs ist aktuell nicht verfügbar. Bitte UNFALLX kontaktieren.');assert((await offered(s,c)).includes(r.week),'Die Wunschwoche liegt nicht mehr im Anmeldezeitraum. Bitte eine neue Woche wählen.');
    const count=(await s.list('academy_registration')).filter(x=>courseId(x)===courseId(r)&&x.week===r.week&&active(x)).length;
    r.status=r.mode==='digital'&&!c.start?'interest':count<c.capacity?'requested':'waitlisted';r.verifiedAt=new Date().toISOString();await s.put('academy_registration',r,r.week||'digital');await s.remove('academy_token',t.id);return r;
   });
   return {status:result.status,message:result.status==='interest'?'Dein Interesse ist bestätigt. Wir informieren dich zum Start der digitalen Kurse.':result.status==='waitlisted'?'Deine E-Mail ist bestätigt. Die Vormerkplätze sind belegt; du stehst auf der Warteliste. UNFALLX meldet sich persönlich.':'Deine E-Mail ist bestätigt und deine Anfrage vorgemerkt. Kurskosten: '+new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format((result.course?.price??150000)/100)+' pro Person. UNFALLX stimmt die Teilnahme persönlich mit dir ab.'};
  }
  throw new Problem(404,'Nicht gefunden.');
 }
 async function adminRoute(req,data,user){
  assert(user.role==='admin','Nur für die Administration.',403);
  if(req.method==='GET')return tx(async s=>({courses:await catalog(s,true),registrations:(await s.list('academy_registration')).filter(r=>r.status!=='email_pending'),weeks:await availability(s),capacity:CAPACITY,schedule:await s.get('academy_schedule','berlin')}));
  if(data.action==='course')return saveCourse(data,user);
  if(data.action==='schedule')return tx(async s=>{assert(!await s.get('academy_schedule','berlin'),'Der Kursstart ist bereits veröffentlicht.',409);const start=date(data.start);const d=new Date(start+'T12:00:00Z');assert(d.getUTCDay()===1&&d.getTime()>Date.now(),'Bitte einen zukünftigen Montag als Kursstart wählen.');await s.put('academy_schedule',{id:'berlin',start,announcedBy:user.id,at:new Date().toISOString()});for(const r of await s.list('academy_registration'))if(r.week==='start-folgt'){r.week=start;await s.put('academy_registration',r,start);}return {message:'Starttermin veröffentlicht. Bereits vorgemerkte Teilnehmer sind der ersten Kurswoche zugeordnet. Bitte Teilnahme und Details persönlich bestätigen.'};});
  const record=await tx(async s=>{
   const r=await s.get('academy_registration',text(data.id,128,true));assert(r&&r.status!=='email_pending','Bestätigte Anmeldung nicht gefunden.',404);
   assert(['requested','confirmed','waitlisted','cancelled','interest'].includes(data.status),'Ungültiger Anmeldestatus.');
   assert(r.mode==='digital'&&!r.week?['interest','cancelled'].includes(data.status):data.status!=='interest','Status passt nicht zum Kursformat.');
   const c=await courseFor(s,courseId(r));if(['requested','confirmed'].includes(data.status)){const count=(await s.list('academy_registration')).filter(x=>x.id!==r.id&&x.week===r.week&&courseId(x)===courseId(r)&&active(x)).length;assert(count<c.capacity,'Die 26 Plätze dieser Woche sind belegt. Bitte Warteliste verwenden.',409);}
   r.status=data.status;r.note=text(data.note,2000);r.updatedAt=new Date().toISOString();r.updatedBy=user.id;r.notification='pending';await s.put('academy_registration',r,r.week||'digital');await s.put('admin_event',{id:id(),action:'Bildung: '+r.id+' · '+r.status,actor:user.id,at:r.updatedAt});return r;
  });
  let sent=false;try{await send(record);sent=true;}catch{}
  await tx(async s=>{const fresh=await s.get('academy_registration',record.id);if(fresh.updatedAt===record.updatedAt){fresh.notification=sent?'sent':'failed';await s.put('academy_registration',fresh,fresh.week||'digital');}});
  return {message:sent?'Status gespeichert und E-Mail versandt.':'Status gespeichert. E-Mail-Versand fehlgeschlagen; bitte erneut speichern oder persönlich kontaktieren.',notificationSent:sent};
 }
 return {publicRoute,adminRoute,catalog:()=>tx(s=>catalog(s))};
}
module.exports={createAcademy,weeks,academyEmail,CAPACITY};
