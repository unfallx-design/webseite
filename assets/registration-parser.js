/* Suggestions only: a registration holder is not necessarily the vehicle owner. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.UnfallxRegistrationParser=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const keys={plate:'Kennzeichen · A',vin:'Fahrgestellnummer · E',vehicle:'Fahrzeug / Modell · D.1 / D.3',vehicleMake:'Hersteller · D.1',firstRegistration:'Erstzulassung · B',hsn:'Herstellerschlüssel · 2.1',tsn:'Typschlüssel · 2.2',ownerCompany:'Firma des Halters · C.1.1',ownerLastName:'Nachname des Halters · C.1.1',ownerFirstName:'Vorname des Halters · C.1.2',ownerStreet:'Straße des Halters · C.1.3',ownerHouseNumber:'Hausnummer des Halters · C.1.3',ownerPostcode:'Postleitzahl des Halters · C.1.3',ownerCity:'Ort des Halters · C.1.3'};
const clean=s=>String(s||'').replace(/[\x00-\x1f]/g,' ').replace(/\s+/g,' ').replace(/^[|:;=\s‘’“”\"_]+|[|;\s‘’“”\"_]+$/g,'').trim();
const codePattern='C\\s*[.,]?\\s*1\\s*[.,]?\\s*[123]|D\\s*[.,]?\\s*[123]|2\\s*[.,]\\s*[12]|A|B|E';
const start=new RegExp('^\\s*\\(?('+codePattern+')\\)?(?:\\s*[|:]\\s*|\\s+|$)','i');
const anyCode=/^\s*\(?([A-Z](?:\s*[.,]\s*\d){0,2}|\d{1,2}(?:[.,]\d)?)\)?(?:\s*[|:]\s*|\s+|$)/;
const label=/^(?:Amtliches Kennzeichen|Kennzeichen|Fahrzeug-?Ident|Fahrgestell|FIN\b|Name oder Firmenname|Name.*Firmenname|Name des Halters|Vorname[n]?\b|Anschrift\b|Marke\b|Handelsbezeichnung\b|Datum der Erstzulassung|Erstzulassung\b)/i;
function normalizeCode(s){const v=s.toUpperCase().replace(/[^A-Z0-9]/g,'');return /^C1[123]$/.test(v)?'C.1.'+v[2]:/^D[123]$/.test(v)?'D.'+v[1]:/^2[12]$/.test(v)?'2.'+v[1]:v;}
// Rebuild rows from word coordinates: OCR frequently emits the tiny field code
// and its value as separate blocks on the three-column registration certificate.
function spatialText(data){const words=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>(p.lines||[]).flatMap(l=>l.words||[]))).filter(w=>w.bbox&&w.text?.trim());if(!words.length)return '';
 const extra=[],pageWidth=data.imageWidth||Math.max(...words.map(w=>w.bbox.x1))-Math.min(...words.map(w=>w.bbox.x0));
 for(const w of words){const raw=w.text.replace(/[()|:;]/g,'').trim(),code=normalizeCode(raw);if(!/^(?:C\.1\.[123]|D\.[13]|2\.[12]|A|B|E)$/.test(code)||!/^([CDEAB]|2)/i.test(raw))continue;
  const b=w.bbox,h=Math.max(8,b.y1-b.y0),cy=(b.y0+b.y1)/2;
  // Exclude the region to the right of the next printed field code.
  const right=words.filter(v=>v!==w&&v.bbox.x0>b.x1&&Math.abs((v.bbox.y0+v.bbox.y1)/2-cy)<h*.8).sort((a,b)=>a.bbox.x0-b.bbox.x0);
  const next=right.find(v=>/^(?:[A-Z](?:[.,]\d){0,2}|[0-9]{1,2}(?:[.,]\d)?)$/.test(v.text)&&v.bbox.x0-b.x1>h*5);
  const limit=Math.min(next?next.bbox.x0:Infinity,b.x1+Math.max(h*12,pageWidth*.28));
  const same=right.filter(v=>v.bbox.x0<limit&&v.bbox.x0-b.x1<h*34);
  if(same.length&&!label.test(clean(same.map(v=>v.text).join(' '))))extra.push(code+' '+same.map(v=>v.text).join(' '));
  // Halter labels are printed above the value, not to its left.
  if(code.startsWith('C.1.')||code==='A'){const below=words.filter(v=>v.confidence>=30&&v.bbox.y1-v.bbox.y0>=h*.6&&v.bbox.y0>=b.y1&&v.bbox.y0-b.y1<h*5&&v.bbox.x0>=b.x0-h&&v.bbox.x0<Math.min(limit,b.x0+pageWidth*.28));const groups=[];for(const v of below.sort((a,z)=>a.bbox.y0-z.bbox.y0)){let g=groups.find(g=>Math.abs(g.y-v.bbox.y0)<h);if(!g){g={y:v.bbox.y0,words:[]};groups.push(g);}g.words.push(v);}const values=groups.map(g=>clean(g.words.sort((a,z)=>a.bbox.x0-z.bbox.x0).map(v=>v.text).join(' '))).filter(v=>!label.test(v)&&(!start.test(v)||code==='A'&&/^[A-ZÄÖÜ]{1,3}[ -]+[A-Z]{1,2}[ -]*\d{1,4}[EH]?$/.test(v)));if(values.length)extra.push(code+' '+values.slice(0,code==='C.1.3'?2:1).join(' '));}
 }
 return extra.join('\n');
}
function date(s){const m=s.match(/\b(\d{2})[.\/-](\d{2})[.\/-](\d{4})\b/);if(!m)return '';const v=m[3]+'-'+m[2]+'-'+m[1];return !isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v?v:'';}
function parse(input){
 const text=typeof input==='string'?input:input?.text||'',spatial=typeof input==='object'?spatialText(input):'';
 const source=(spatial+'\n'+text).replace(/^8\s*[_|:]?\s*(?=\d{2}[.]\d{2}[.]\d{4}\b)/gm,'B ');
 const lines=String(source||'').slice(0,40000).replace(/[\r\t]/g,' ').split(/\n| {3,}(?=\(?(?:[CD]\s*[.,]\s*\d\s*[.,]?\s*\d?|2[.,][12])\)?\s)| {3,}(?=B\s+\d{2}[.]\d{2}[.]\d{4}\b)/).map(clean).filter(Boolean),codes={};
 for(let i=0;i<lines.length;i++){const m=lines[i].match(start);if(!m)continue;const code=normalizeCode(m[1]);let v=clean(lines[i].slice(m[0].length));
  // Printed explanations in the reverse-side legend are not values.
  if(label.test(v))v='';
  if(!v&&lines[i+1]&&(!anyCode.test(lines[i+1])||code==='A'&&/^[A-ZÄÖÜ]{1,3}[ -]+[A-Z]{1,2}[ -]*\d{1,4}[EH]?$/.test(lines[i+1]))&&!label.test(lines[i+1]))v=lines[++i];
  if(code==='C.1.3'){for(let j=0;j<2&&lines[i+1]&&!anyCode.test(lines[i+1])&&!start.test(lines[i+1])&&!label.test(lines[i+1]);j++)v+=' '+lines[++i];}
  v=v.split(/\s+(?=\(?[CD][.,]?[123](?:[.,][123])?\)?(?:\s|[|:]))/)[0];if(code==='B'&&!date(v))continue;if(v&&!codes[code])codes[code]=clean(v);
 }
 const candidates={};
 const all=lines.join('\n'),vin=(codes.E||'').replace(/\s/g,'').match(/^[A-HJ-NPR-Z0-9]{17}$/i)?.[0]||all.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i)?.[0];
 const document=input?.documentConfirmed===true||/(?:Zulassungsbescheinigung|Fahrzeugschein)/i.test(all)||Object.keys(codes).length>=2;
 if(!document)return {fields:{},recognized:false};
 const put=(key,value)=>{if(value)candidates[key]=clean(value);};
 if(vin&&/[0-9]/.test(vin)&&/[A-Z]/i.test(vin)&&!/(.)\1{6}/.test(vin))put('vin',vin.toUpperCase());
 const plate=codes.A||all.match(/(?:Amtliches Kennzeichen|Kennzeichen)\s*[:|]\s*([^\n]+)/i)?.[1]||'';
 if(/^[A-ZÄÖÜ]{1,3}[\s-]+[A-Z]{1,2}[\s-]*\d{1,4}[EH]?$/i.test(plate))put('plate',plate.toUpperCase().replace(/\s+/g,' '));
 if(codes['D.1']&&codes['D.1'].length<60)put('vehicleMake',codes['D.1']);
 const model=codes['D.3'];if(model&&model.length<90)put('vehicle',[candidates.vehicleMake,model].filter(Boolean).join(' '));
 put('firstRegistration',date(codes.B||''));
 if(/^\d{4}$/.test(codes['2.1']||''))put('hsn',codes['2.1']);
 if(/^[A-Z0-9]{3,10}$/i.test(codes['2.2']||''))put('tsn',codes['2.2'].toUpperCase());
 const name=codes['C.1.1'],first=codes['C.1.2'];
 if(name&&name.length<100&&!/Firmenname|Name oder|[|<>_=]/i.test(name))put(/\b(?:GmbH|AG|KG|OHG|UG|e\.K\.|GbR)\b/i.test(name)?'ownerCompany':'ownerLastName',name);
 if(first&&first.length<70&&/^[\p{L} .’-]+$/u.test(first))put('ownerFirstName',first);
 const addr=codes['C.1.3']||'',zip=addr.match(/\b(\d{5})\s+([A-ZÄÖÜa-zäöüß][\p{L}\s.()/-]+)$/u);
 if(zip){put('ownerPostcode',zip[1]);put('ownerCity',zip[2]);const street=clean(addr.slice(0,zip.index)).replace(/[,;]$/,'').match(/^(.+?)\s+(\d+[a-zA-Z]?(?:\s*[-/]\s*\d+[a-zA-Z]?)?)$/);if(street){put('ownerStreet',street[1]);put('ownerHouseNumber',street[2]);}}
 return {fields:candidates,recognized:true};
}
function merge(existing,proposed,selected,holderConfirmed=false){const next={...existing},applied=[];for(const k of selected){if(!Object.hasOwn(keys,k)||!proposed[k]||k.startsWith('owner')&&!holderConfirmed)continue;next[k]=clean(proposed[k]);applied.push(k);}if(applied.includes('ownerCompany'))next.ownerType='company';else if(applied.some(k=>['ownerFirstName','ownerLastName'].includes(k))&&!existing.ownerType)next.ownerType='person';return {values:next,applied};}
return {parse,merge,keys,spatialText};
});
