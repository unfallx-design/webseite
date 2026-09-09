(() => {
'use strict';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const status=$('#auth-message');let csrf='',busy=false;
function message(value,error=false){if(status){status.textContent=value;status.classList.toggle('portal-error',error);}}
async function api(path,data){const r=await fetch('/api/portal'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:data===undefined?undefined:JSON.stringify(data),credentials:'same-origin',cache:'no-store'});const result=await r.json();if(!r.ok)throw new Error(result.error||'Bitte später erneut versuchen.');return result;}
function data(form){const values=Object.fromEntries(new FormData(form));form.querySelectorAll('input[type=checkbox]').forEach(i=>values[i.name]=i.checked);if(values.passwordConfirm!==undefined&&values.password!==values.passwordConfirm)throw new Error('Die beiden Passwörter stimmen nicht überein.');delete values.passwordConfirm;return values;}
function bind(selector,fn){const form=$(selector);if(form)form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);message('');try{await fn(data(form),form);}catch(e){message(e.message,true);}finally{busy=false;buttons.forEach(b=>b.disabled=false);}});}
const passFields=`<label>Neues Passwort<input name="password" type="password" minlength="15" maxlength="128" autocomplete="new-password" required aria-describedby="password-hint"></label><small id="password-hint">15 bis 128 Zeichen. Ein langer Satz mit mehreren Wörtern eignet sich gut.</small><label>Passwort wiederholen<input name="passwordConfirm" type="password" minlength="15" maxlength="128" autocomplete="new-password" required></label>`;
document.addEventListener('change',e=>{if(e.target.matches('[data-show-password]'))e.target.closest('form').querySelectorAll('input[name=password],input[name=passwordConfirm]').forEach(i=>i.type=e.target.checked?'text':'password');});
const ref=new URLSearchParams(location.search).get('ref');if(/^UX-[A-F0-9]{12}$/.test(ref||'')){document.querySelectorAll('input[name=referralCode]').forEach(i=>i.value=ref);document.querySelectorAll('a[data-referral-link]').forEach(a=>{const u=new URL(a.href);u.searchParams.set('ref',ref);a.href=u.href;});}
async function providers(){const box=$('[data-oauth-buttons]');if(!box)return;const r=await api('/oauth/providers');box.innerHTML=r.providers.map(p=>`<button class="oauth-button" type="button" data-oauth="${p.id}" ${p.enabled?'':'disabled'}>Mit ${p.name} anmelden${p.enabled?'':' · bald verfügbar'}</button>`).join('');box.querySelectorAll('[data-oauth]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{const r=await api('/oauth/start',{provider:b.dataset.oauth});location.assign(r.redirect);}catch(e){message(e.message,true);b.disabled=false;}}));}
async function boot(){
 const login=$('#login-form');
 if(login){
  bind('#login-form',async d=>{const r=await api('/password-login',d);location.replace(r.redirect);});
  bind('#magic-form',async d=>message((await api('/login',d)).message));
  await providers().catch(()=>{const box=$('[data-oauth-buttons]');if(box)box.textContent='Anbieter-Login ist gerade nicht verfügbar. Bitte nutze dein Passwort.';});
  const params=new URLSearchParams(location.hash.slice(1)),token=params.get('token');
  if(token){
   history.replaceState(null,'',location.pathname);
   const info=await api('/token-info',{token});
   $('#auth-root').innerHTML='<h2>E-Mail bestätigen.</h2><p>'+(info.passwordRequired?'Gib dein bei der Registrierung gewähltes Passwort ein. Danach ist dein Konto bestätigt.':'Bestätige die Anmeldung, um deinen geschützten Arbeitsplatz zu öffnen.')+'</p><form id="exchange-form">'+(info.passwordRequired?'<label>Dein Passwort<input type="password" name="password" autocomplete="current-password" required maxlength="128"></label>':'')+'<button class="btn btn-block" type="submit">Sicher anmelden</button></form><p class="partner-muted">Dieser persönliche Link ist einmalig nutzbar.</p>';
   bind('#exchange-form',async d=>{const r=await api('/exchange',{...d,token});location.replace(r.redirect);});
  }else{
   const state=new URLSearchParams(location.search).get('oauth');
   if(state==='link_required')message('Zu dieser E-Mail besteht bereits ein Konto. Melde dich mit Passwort oder E-Mail-Link an und verbinde Google oder Apple unter Einstellungen.',true);
   if(state==='failed')message('Der Anbieter-Login konnte nicht abgeschlossen werden. Bitte neu starten oder mit deinem Passwort anmelden.',true);
  }
 }

 bind('#register-form',async(d,f)=>{message((await api('/register',d)).message);f.reset();});bind('#customer-register',async(d,f)=>{message((await api('/register-customer',d)).message);f.reset();});
 const password=$('#password-root');if(password){const token=new URLSearchParams(location.hash.slice(1)).get('token');history.replaceState(null,'',location.pathname);if(token){password.innerHTML='<h2>Dein neues Passwort.</h2><form id="new-password-form">'+passFields+'<label class="portal-check"><input type="checkbox" data-show-password><span>Passwörter anzeigen</span></label><button class="btn" type="submit">Passwort speichern</button></form>';bind('#new-password-form',async d=>{const r=await api('/password/finish',{token,password:d.password});password.innerHTML='<h2>Passwort gespeichert.</h2><p>'+esc(r.message)+'</p><a href="/login" class="btn">Zum Login →</a>';});}else bind('#password-request',async d=>message((await api('/password/request',d)).message));}
 const notify=$('#notification-root');if(notify){const p=new URLSearchParams(location.hash.slice(1)),token=p.get('token')||p.get('unsubscribe');history.replaceState(null,'',location.pathname);if(token){notify.innerHTML='<h2>'+ (p.has('unsubscribe')?'Statusmeldungen abbestellen':'Statusmeldungen bestätigen')+'</h2><form id="notification-confirm"><button type="submit" class="btn">'+(p.has('unsubscribe')?'Für diesen Vorgang abbestellen':'E-Mail-Benachrichtigungen aktivieren')+'</button></form>';bind('#notification-confirm',async()=>{const r=await api('/notifications/verify',{token});notify.innerHTML='<h2>Erledigt.</h2><p>'+esc(r.message)+'</p><a href="/app">UNFALLX Connect kennenlernen →</a>';});}}
 const onboarding=$('#oauth-complete');if(onboarding){const profile=await api('/oauth/profile');csrf=profile.csrf;onboarding.querySelector('[name=email]').value=profile.email;onboarding.querySelector('[name=name]').value=profile.name;const type=onboarding.querySelector('[name=typeOfAccount]'),fields=$('#oauth-company');const toggle=()=>{fields.hidden=type.value!=='partner';fields.querySelectorAll('input,select').forEach(i=>{i.disabled=fields.hidden;});onboarding.querySelector('[name=name]').required=fields.hidden;};type.addEventListener('change',toggle);toggle();bind('#oauth-complete',async d=>{const r=await api('/oauth/complete',d);location.replace(r.redirect);});}
}
window.addEventListener('hashchange',()=>{const p=new URLSearchParams(location.hash.slice(1));if(/^[a-f0-9]{64}$/.test(p.get('token')||p.get('unsubscribe')||''))location.reload();});
boot().catch(e=>message(e.message,true));
})();
