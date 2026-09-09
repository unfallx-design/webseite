'use strict';
const crypto=require('node:crypto');
const D=require('./domain');
const passwords=require('./passwords');
const {notice}=require('./brand-mail');
const minute=60000;
function phone(value){
 let n=D.text(value,40,true).replace(/[\s()/-]/g,'').replace(/^00/,'+');
 if(n.startsWith('0'))n='+49'+n.slice(1);
 // Initial rollout is limited to German mobile numbers, excluding premium destinations.
 D.assert(/^\+49(?:15\d{9}|1[67]\d{8,9})$/.test(n),'Bitte eine deutsche Mobilnummer eingeben, zum Beispiel +49 176 12345678.');
 return n;
}
const mask=n=>n?'+49 •••••• '+n.slice(-4):'';
function createSms(env,transport=fetch){
 const ready=env.SMS_PROVIDER==='seven'&&!!env.SEVEN_API_KEY;
 return {ready,async send(to,code){
  D.assert(ready,'Die SMS-Bestätigung wird noch eingerichtet.',503);
  const r=await transport('https://gateway.seven.io/api/sms',{method:'POST',headers:{'X-Api-Key':env.SEVEN_API_KEY,'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams({to:to.slice(1),from:'UNFALLX',text:`UNFALLX Sicherheitscode: ${code}. Gueltig fuer 5 Minuten. Niemals weitergeben. Nur auf app.unfallx.com eingeben.`,ttl:'5',label:'account-security'}),signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!r.ok)throw new Error('SMS_UNCONFIRMED');
  const result=await r.json();
  if(String(result.success)!=='100'||result.debug===true||result.debug==='true'||!result.messages?.length||!result.messages.every(m=>m.success===true))throw new Error('SMS_UNCONFIRMED');
  // Provider responses may echo the code, phone and account balance. Never log them.
 }};
}
function createSecurity({env,tx,rate,mail,origin,sms=createSms(env)}){
 const pepper=env.PORTAL_OTP_SECRET||'';
 const ready=sms.ready&&Buffer.byteLength(pepper)>=32;
 const digest=(challenge,code)=>crypto.createHmac('sha256',pepper).update(challenge+'\0'+code).digest('hex');
 const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
 const record=async(s,user)=>(await s.get('security',user.id))||{id:user.id,epoch:0,mfaEnabled:false,recovery:[]};
 function recent(session){D.assert(Date.now()-Date.parse(session.createdAt)<15*minute,'Bitte zuerst erneut anmelden und danach die Sicherheitseinstellungen öffnen.',401);}
 async function view(s,user){const r=await record(s,user);return {available:ready,provider:ready?'seven':null,phoneVerified:!!r.verifiedAt&&r.phone===user.phone,phone:mask(r.phone),verifiedAt:r.verifiedAt||null,mfaEnabled:!!r.mfaEnabled,recoveryRemaining:r.recovery?.length||0};}
 async function changePhone(s,user,next){const r=await record(s,user);if(next===user.phone)return;D.assert(!r.mfaEnabled,'Bitte zuerst die Zwei-Faktor-Anmeldung deaktivieren, bevor du die Mobilnummer änderst.');r.phone='';r.verifiedAt=null;r.proofAt=null;r.proofSession=null;await s.put('security',r,user.id);for(const c of await s.list('sms_challenge',user.id))await s.remove('sms_challenge',c.id);}
 async function start(user,session,data,purpose='phone'){
  D.assert(ready,'Die SMS-Bestätigung wird noch eingerichtet. Dein bestehender Zugang bleibt nutzbar.',503);
  recent(session);
  const code=String(crypto.randomInt(0,1000000)).padStart(6,'0'),cid=D.id();
  const target=await tx(async s=>{
   const fresh=await s.get('user',user.id),current=await s.get('session',session.id),r=await record(s,user);
   D.assert(fresh?.active&&current&&current.expires>Date.now(),'Bitte erneut anmelden.',401);
   D.assert(purpose==='login'?current.pendingMfa&&!current.recoveryLogin:!current.pendingMfa,'Bitte erneut anmelden.',401);
   const to=purpose==='login'?r.phone:phone(data.phone);
   if(r.mfaEnabled)D.assert(to===r.phone,'Bitte zunächst die bisherige Mobilnummer bestätigen.');
   if(purpose==='login')D.assert(r.mfaEnabled&&current.securityEpoch===r.epoch,'Bitte den Login erneut starten.',401);
   const guard=await s.get('sms_guard',user.id);D.assert(!guard||guard.nextAt<=Date.now(),'Bitte 60 Sekunden bis zum nächsten Code warten.',429);
   await rate(s,'sms-user:'+user.id,5,60*minute);await rate(s,'sms-number:'+to,5,60*minute);
   await rate(s,'sms-global',Math.min(1000,Math.max(1,Number(env.SMS_DAILY_LIMIT)||100)),24*60*minute);
   await rate(s,'sms-month',Math.min(10000,Math.max(1,Number(env.SMS_MONTHLY_LIMIT)||1000)),30*24*60*minute);
   await s.put('sms_guard',{id:user.id,nextAt:Date.now()+minute,expires:Date.now()+60*minute},user.id);
   for(const old of await s.list('sms_challenge',user.id))if(old.sessionId===session.id)await s.remove('sms_challenge',old.id);
   await s.put('sms_challenge',{id:cid,userId:user.id,sessionId:session.id,to,purpose,epoch:r.epoch,proof:digest(cid,code),attempts:0,state:'sending',expires:Date.now()+5*minute},user.id);
   return to;
  });
  try{await sms.send(target,code);}catch{
   await tx(async s=>{const c=await s.get('sms_challenge',cid);if(c){c.state='failed';delete c.proof;await s.put('sms_challenge',c,user.id);}});
   throw new D.Problem(503,'Der SMS-Versand konnte nicht bestätigt werden. Warte eine Minute und versuche es erneut. Für die Anmeldung kannst du auch einen Wiederherstellungscode nutzen.');
  }
  await tx(async s=>{const c=await s.get('sms_challenge',cid);if(c){c.state='ready';await s.put('sms_challenge',c,user.id);}});
  return {challenge:cid,phone:mask(target),expiresIn:300,retryAfter:60,message:'Der Sicherheitscode wurde an den SMS-Dienst übergeben. Bitte den sechsstelligen Code eingeben.'};
 }
 async function check(s,user,session,data,purpose){
  const c=typeof data.challenge==='string'&&await s.get('sms_challenge',data.challenge),r=await record(s,user);
  if(!c||c.userId!==user.id||c.sessionId!==session.id||c.purpose!==purpose||c.epoch!==r.epoch||c.state!=='ready'||c.expires<=Date.now()||c.attempts>=5)return {error:'Der Code ist abgelaufen oder nicht mehr gültig. Bitte einen neuen Code anfordern.'};
  c.attempts++;await s.put('sms_challenge',c,user.id);
  // Return failures instead of throwing: failed-attempt counters must commit.
  if(!ready||!/^\d{6}$/.test(data.code||'')||!same(c.proof,digest(c.id,data.code)))return {error:c.attempts>=5?'Zu viele Fehlversuche. Bitte einen neuen Code anfordern.':'Der Sicherheitscode stimmt nicht.'};
  await s.remove('sms_challenge',c.id);return {ok:true,phone:c.to};
 }
 async function verify(user,session,data){
  const outcome=await tx(async s=>{const fresh=await s.get('user',user.id),current=await s.get('session',session.id);D.assert(fresh?.active&&current&&!current.pendingMfa&&current.expires>Date.now(),'Bitte erneut anmelden.',401);recent(current);const result=await check(s,fresh,current,data,'phone');if(!result.ok)return result;const r=await record(s,fresh);r.phone=result.phone;r.verifiedAt=new Date().toISOString();r.proofAt=Date.now();r.proofSession=session.id;fresh.phone=result.phone;await s.put('user',fresh,fresh.companyId||'internal');await s.put('security',r,user.id);return {ok:true,message:'Deine Mobilnummer ist bestätigt.',user:D.publicUser(fresh),security:await view(s,fresh)};});
  D.assert(outcome.ok,outcome.error,400);return outcome;
 }
 async function loginCheck(s,user,session,data){
  const r=await record(s,user);
  if(!session.pendingMfa||!r.mfaEnabled||session.securityEpoch!==r.epoch)return {error:'Bitte die Anmeldung erneut starten.'};
  if(data.recoveryCode){
   session.recoveryAttempts=(session.recoveryAttempts||0)+1;await s.put('session',session,user.id);
   if(session.recoveryAttempts>5)return {error:'Zu viele Fehlversuche. Bitte die Anmeldung erneut starten.'};
   const code=(typeof data.recoveryCode==='string'&&data.recoveryCode.length<=64?data.recoveryCode:'').replace(/[-\s]/g,'').toLowerCase(),key=D.hash(code);
   if(!/^[a-f0-9]{32}$/.test(code)||!r.recovery?.includes(key))return {error:'Dieser Wiederherstellungscode ist ungültig oder bereits verbraucht.'};
   r.recovery=r.recovery.filter(x=>x!==key);await s.put('security',r,user.id);return {ok:true,recovery:true};
  }
  return check(s,user,session,data,'login');
 }
 async function configure(user,session,data){
  recent(session);D.assert(data.confirmed===true,'Bitte die Änderung bestätigen.');
  D.assert(['enable','disable','renew'].includes(data.action),'Ungültige Sicherheitseinstellung.');
  await tx(s=>rate(s,'security-password:'+user.id,8,15*minute));
  D.assert(await passwords.verify(data.password,user.passwordHash),'Bitte dein aktuelles Passwort eingeben. Falls du bisher E-Mail-Links nutzt, lege zuerst ein Passwort fest.',401);
  const outcome=await tx(async s=>{
   const fresh=await s.get('user',user.id),current=await s.get('session',session.id),r=await record(s,user);
   D.assert(fresh?.active&&current&&!current.pendingMfa&&current.expires>Date.now()&&fresh.passwordHash===user.passwordHash,'Bitte erneut anmelden.',401);recent(current);
   const recoveryExit=data.action==='disable'&&current.recoveryLogin&&Date.now()-Date.parse(current.createdAt)<10*minute;
   D.assert(recoveryExit||(r.proofSession===session.id&&Date.now()-r.proofAt<5*minute&&r.phone===fresh.phone),'Bitte zuerst einen neuen SMS-Code für deine Mobilnummer bestätigen.');
   if(data.action!=='disable')D.assert(ready,'Die SMS-Anbindung ist nicht verfügbar.',503);
   D.assert(data.action==='enable'?!r.mfaEnabled:r.mfaEnabled,'Diese Einstellung hat sich geändert. Bitte neu laden.');
   let codes=[];r.mfaEnabled=data.action!=='disable';r.epoch++;
   if(r.mfaEnabled){codes=Array.from({length:8},()=>crypto.randomBytes(16).toString('hex'));r.recovery=codes.map(D.hash);}else r.recovery=[];
   r.proofAt=null;r.proofSession=null;await s.put('security',r,user.id);
   for(const other of await s.list('session',user.id))if(other.id!==session.id)await s.remove('session',other.id);
   for(const c of await s.list('sms_challenge',user.id))await s.remove('sms_challenge',c.id);
   current.securityEpoch=r.epoch;current.mfaVerifiedAt=r.mfaEnabled?new Date().toISOString():null;current.recoveryLogin=false;await s.put('session',current,user.id);
   await s.put('security_event',{id:D.id(),userId:user.id,action:data.action,at:new Date().toISOString(),expires:Date.now()+90*24*60*minute},user.id);
   return {message:r.mfaEnabled?'Zwei-Faktor-Anmeldung ist aktiv. Bewahre deine Wiederherstellungscodes sicher außerhalb dieser App auf.':'Zwei-Faktor-Anmeldung wurde deaktiviert. Andere Geräte wurden abgemeldet.',recoveryCodes:codes.map(c=>c.match(/.{8}/g).join('-')),security:await view(s,fresh)};
  });
  const e=notice({title:'Deine Anmeldesicherheit wurde geändert',copy:outcome.message+' Wenn du diese Änderung nicht vorgenommen hast, kontaktiere umgehend info@unfallx.com.',url:origin+'/login',cta:'Zugang prüfen',origin});
  try{await mail.send(user.email,e.subject,e.text,[],e.html);}catch{console.error('Security notice: delivery unavailable');}
  return outcome;
 }
 return {ready,view,record,changePhone,start,verify,loginCheck,configure};
}
module.exports={createSecurity,createSms,phone};
