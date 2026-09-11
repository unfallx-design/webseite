'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../assets/portal.js'),'utf8');
async function render({role='partner',status='approved',hash='',failMoney=false,rows=[]}={}){
 const nodes=new Map(),calls=[],redirects=[];
 const make=()=>({innerHTML:'',textContent:'',dataset:{},hidden:false,classList:{toggle(){}},setAttribute(){},getAttribute(){return 'false'},addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},scrollIntoView(){}});
 const find=s=>{if(!nodes.has(s))nodes.set(s,make());return nodes.get(s);};
 const data={user:{role,name:'Test Partner',preferences:{startPage:'faelle'}},company:{status,name:'Testbetrieb'},csrf:'test',states:{draft:'Entwurf'}};
 const location={hash,pathname:'/portal',replace:x=>redirects.push(x)};
 const sandbox={console,Intl,Date,URL,File:class{},FormData:class{},setTimeout,clearTimeout,matchMedia:()=>({matches:false}),location,history:{replaceState(_a,_b,url){redirects.push(url);if(url.includes('#'))location.hash='#'+url.split('#')[1];}},UnfallxHelp:{contextual:()=> 'orientierung'},document:{body:make(),querySelector:find,querySelectorAll:()=>[]},window:{addEventListener(){},scrollTo(){}},fetch:async url=>{calls.push(url);const route=url.replace('/api/portal','');let result;
  if(route==='/me')result=data;
  else if(route==='/cases')result={cases:rows};
  else if(route==='/mobile/overview')return {ok:!failMoney,status:failMoney?503:200,json:async()=>failMoney?{error:'Verbindung unterbrochen'}:{totals:{expectedCents:3750,payableCents:1250,paidCents:8100},items:[]}};
  else throw Error('Unexpected request '+route);
  return {ok:true,status:200,json:async()=>result};
 }};
 vm.runInNewContext(source,sandbox);for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));
 return {html:find('#portal-root').innerHTML,nav:find('#portal-nav').innerHTML,calls,redirects};
}
test('approved partner opens the overview even with the legacy case-list preference',async()=>{const r=await render();assert.match(r.html,/Deine Schadenfälle/);assert.match(r.html,/partner-capture/);assert.match(r.html,/37,50/);assert.match(r.html,/12,50/);assert.match(r.html,/81,00/);assert(!r.html.includes('50,00'));assert(!r.redirects.some(x=>x.includes('#faelle')));assert.match(r.nav,/#provision/);});
test('an explicit case-list deep link remains intact',async()=>{const r=await render({hash:'#faelle'});assert.match(r.html,/Meine Fälle/);assert.match(r.html,/case-search/);assert(!r.html.includes('partner-wallet'));assert(!r.calls.some(x=>x.includes('/mobile/overview')));});
test('pending partner cannot start intake and does not request commission data',async()=>{const r=await render({status:'pending'});assert.match(r.html,/Freischaltung ausstehend/);assert(!r.html.includes('partner-capture'));assert(!r.calls.some(x=>x.includes('/mobile/overview')));assert(!r.html.includes('37,50'));});
test('commission read failure leaves unknown amounts, exposes retry and preserves intake',async()=>{const r=await render({failMoney:true});assert.match(r.html,/partner-wallet-amount">—/);assert.match(r.html,/data-retry-partner/);assert.match(r.html,/partner-capture/);assert(!r.html.includes('0,00'));});
test('admin keeps the existing case-list preference and internal navigation',async()=>{const r=await render({role:'admin'});assert.match(r.html,/Fallübersicht/);assert(!r.html.includes('partner-wallet'));assert(r.redirects.some(x=>x.includes('#faelle')));assert(!r.calls.some(x=>x.includes('/mobile/overview')));assert.match(r.nav,/Internes Team/);});
test('case display escapes untrusted customer and vehicle text',async()=>{const r=await render({rows:[{id:'11111111-1111-4111-8111-111111111111',number:'<img onerror=alert(1)>',status:'draft',updatedAt:'2026-09-11T08:00:00Z',intake:{vehicle:'<script>unsafe</script>',owner:'A & B',plate:'B UX 1'}}]});assert(!r.html.includes('<script>unsafe'));assert.match(r.html,/&lt;script&gt;unsafe/);assert.match(r.html,/A &amp; B/);});
