'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

async function render(file, configured = true, fail = false) {
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  assert.match(html, /data-oauth-buttons/);
  assert.match(html, /data-oauth-section hidden/);
  const handlers = {}, redirects = [], section = {hidden:true};
  const button = {dataset:{oauth:'google'}, disabled:false, addEventListener:(name, fn) => handlers[name] = fn};
  const box = {innerHTML:'', querySelectorAll:() => box.innerHTML.includes('data-oauth="google"') ? [button] : []};
  const form = {addEventListener(){}};
  const nodes = {'[data-oauth-buttons]':box, '[data-oauth-section]':section, '#auth-message':{textContent:'',classList:{toggle(){}}}};
  nodes[file === 'workspace-login.html' ? '#login-form' : '#register-form'] = form;
  const sandbox = {URL, URLSearchParams, console, setTimeout, clearTimeout,
    location:{search:'',hash:'',pathname:'/login',assign:value => redirects.push(value)},
    document:{querySelector:s=>nodes[s]||null,querySelectorAll:()=>[],body:{classList:{contains:()=>false}}},
    window:{addEventListener(){}},
    fetch:async url => {
      if (url.endsWith('/oauth/providers')) {
        if (fail) throw Error('Offline');
        return {ok:true,json:async()=>({providers:[{id:'google',name:'Google',enabled:configured},{id:'apple',name:'Apple',enabled:false}]})};
      }
      if (url.endsWith('/oauth/start')) return {ok:true,json:async()=>({redirect:'https://accounts.google.com/example'})};
      return {ok:false,json:async()=>({error:'Not signed in'})};
    }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/auth.js'),'utf8'), sandbox);
  for (let i=0; i<8; i++) await new Promise(resolve=>setImmediate(resolve));
  return {box,section,handlers,redirects};
}
test('Shared partner/admin login and registration expose the configured Google login and start its flow', async()=>{
  for (const file of ['workspace-login.html','registrieren.html']) {
    const r = await render(file);
    assert.equal(r.section.hidden,false);
    assert.match(r.box.innerHTML,/Mit Google anmelden/);
    assert.doesNotMatch(r.box.innerHTML,/Apple|disabled/);
    await r.handlers.click();
    assert.deepEqual(r.redirects,['https://accounts.google.com/example']);
  }
});
test('Unconfigured or unavailable providers leave the password forms usable without inactive buttons', async()=>{
  for (const fail of [false,true]) {
    const r = await render('workspace-login.html',false,fail);
    assert.equal(r.section.hidden,true);
    assert.equal(r.box.innerHTML,'');
  }
});
