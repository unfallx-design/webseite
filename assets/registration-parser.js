/* Suggestions only: a registration holder is not necessarily the vehicle owner. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.UnfallxRegistrationParser=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const keys={plate:'Kennzeichen · A',vin:'Fahrgestellnummer · E',vehicle:'Fahrzeug / Modell · D.1 / D.3',vehicleMake:'Hersteller · D.1',firstRegistration:'Erstzulassung · B',hsn:'Herstellerschlüssel · 2.1',tsn:'Typschlüssel · 2.2',ownerCompany:'Firma des Halters · C.1.1',ownerLastName:'Nachname des Halters · C.1.1',ownerFirstName:'Vorname des Halters · C.1.2',ownerStreet:'Straße des Halters · C.1.3',ownerHouseNumber:'Hausnummer des Halters · C.1.3',ownerPostcode:'Postleitzahl des Halters · C.1.3',ownerCity:'Ort des Halters · C.1.3'};
const clean=s=>String(s||'').replace(/[\x00-\x1f]/g,' ').replace(/\s+/g,' ').replace(/^[|:;=\s]+|[|;\s]+$/g,'').trim();
const codePattern='C\\s*[.,]\\s*1\\s*[.,]\\s*[123]|D\\s*[.,]\\s*[123]|2\\s*[.,]\\s*[12]|A|B|E';
const start=new RegExp('^\\s*\\(?('+codePattern+')\\)?(?:\\s*[|:]\\s*|\\s+|$)','i');
const anyCode=/^\s*\(?([A-Z](?:\s*[.,]\s*\d){0,2}|\d{1,2}(?:[.,]\d)?)\)?(?:\s*[|:]\s*|\s+|$)/;
const label=/^(?:Amtliches Kennzeichen|Kennzeichen|Fahrzeug-?Ident|Fahrgestell|FIN\b|Name oder Firmenname|Name des Halters|Vorname[n]?\b|Anschrift\b|Marke\b|Handelsbezeichnung\b|Datum der Erstzulassung|Erstzulassung\b)/i;
function date(s){const m=s.match(/\b(\d{2})[.\/-](\d{2})[.\/-](\d{4})\b/);if(!m)return '';const v=m[3]+'-'+m[2]+'-'+m[1];return !isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v?v:'';}
function parse(text){
 const lines=String(text||'').slice(0,40000).replace(/[\r\t]/g,' ').split(/\n| {3,}(?=\(?(?:[CD]\s*[.,]\s*\d\s*[.,]?\s*\d?|2[.,][12])\)?\s)| {3,}(?=B\s+\d{2}[.]\d{2}[.]\d{4}\b)/).map(clean).filter(Boolean),codes={};
 for(let i=0;i<lines.length;i++){const m=lines[i].match(start);if(!m)continue;const code=m[1].replace(/\s/g,'').replace(/,/g,'.').toUpperCase();let v=clean(lines[i].slice(m[0].length));
  // Printed explanations in the reverse-side legend are not values.
  if(label.test(v))continue;
  if(!v&&lines[i+1]&&!anyCode.test(lines[i+1])&&!label.test(lines[i+1]))v=lines[++i];
  if(code==='C.1.3'){for(let j=0;j<2&&lines[i+1]&&!anyCode.test(lines[i+1])&&!label.test(lines[i+1]);j++)v+=' '+lines[++i];}
  if(v&&!codes[code])codes[code]=clean(v);
 }
 const candidates={};
 const all=lines.join('\n'),vin=(codes.E||'').replace(/\s/g,'').match(/^[A-HJ-NPR-Z0-9]{17}$/i)?.[0]||all.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i)?.[0];
 const document=/(?:Zulassungsbescheinigung|Fahrzeugschein)/i.test(all)||Object.keys(codes).length>=2;
 if(!document)return {fields:{},recognized:false};
 const put=(key,value)=>{if(value)candidates[key]=clean(value);};
 put('vin',vin?.toUpperCase());
 const plate=codes.A||all.match(/(?:Amtliches Kennzeichen|Kennzeichen)\s*[:|]\s*([^\n]+)/i)?.[1]||'';
 if(/^[A-ZÄÖÜ]{1,3}[\s-]+[A-Z]{1,2}[\s-]*\d{1,4}[EH]?$/i.test(plate))put('plate',plate.toUpperCase().replace(/\s+/g,' '));
 if(codes['D.1']&&codes['D.1'].length<60)put('vehicleMake',codes['D.1']);
 const model=codes['D.3'];if(model&&model.length<90)put('vehicle',[candidates.vehicleMake,model].filter(Boolean).join(' '));
 put('firstRegistration',date(codes.B||''));
 if(/^\d{4}$/.test(codes['2.1']||''))put('hsn',codes['2.1']);
 if(/^[A-Z0-9]{3,10}$/i.test(codes['2.2']||''))put('tsn',codes['2.2'].toUpperCase());
 const name=codes['C.1.1'],first=codes['C.1.2'];
 if(name&&name.length<120)put(/\b(?:GmbH|AG|KG|OHG|UG|e\.K\.|GbR)\b/i.test(name)?'ownerCompany':'ownerLastName',name);
 if(first&&first.length<100)put('ownerFirstName',first);
 const addr=codes['C.1.3']||'',zip=addr.match(/\b(\d{5})\s+([A-ZÄÖÜa-zäöüß][\p{L}\s.()/-]+)$/u);
 if(zip){put('ownerPostcode',zip[1]);put('ownerCity',zip[2]);const street=clean(addr.slice(0,zip.index)).replace(/[,;]$/,'').match(/^(.+?)\s+(\d+[a-zA-Z]?(?:\s*[-/]\s*\d+[a-zA-Z]?)?)$/);if(street){put('ownerStreet',street[1]);put('ownerHouseNumber',street[2]);}}
 return {fields:candidates,recognized:true};
}
function merge(existing,proposed,selected,holderConfirmed=false){const next={...existing},applied=[];for(const k of selected){if(!Object.hasOwn(keys,k)||!proposed[k]||k.startsWith('owner')&&!holderConfirmed)continue;next[k]=clean(proposed[k]);applied.push(k);}if(applied.includes('ownerCompany'))next.ownerType='company';else if(applied.some(k=>['ownerFirstName','ownerLastName'].includes(k))&&!existing.ownerType)next.ownerType='person';return {values:next,applied};}
return {parse,merge,keys};
});
