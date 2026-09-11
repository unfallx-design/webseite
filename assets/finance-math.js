(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.UnfallxFinance=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function decimal(value,max,label){const s=String(value??'').trim().replace(',','.');if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(s))throw new Error(label+' bitte mit höchstens zwei Nachkommastellen eingeben.');const [a,b='']=s.split('.'),n=Number(a)*100+Number(b.padEnd(2,'0'));if(n>max)throw new Error(label+' liegt außerhalb des zulässigen Bereichs.');return n;}
const rounded=(n,d)=>Math.floor((n+d/2)/d);
function calculate(data){
 const amount=decimal(data.amount,999999999,'Betrag'),vat=decimal(data.vatPercent,10000,'Umsatzsteuer'),partnerVat=decimal(data.partnerVatPercent??data.vatPercent,10000,'Partner-Umsatzsteuer');
 const mode=data.partnerMode??'percent';if(!['fixed','percent'].includes(mode))throw new Error('Bitte Festbetrag oder Prozentanteil wählen.');
 if(amount<=0)throw new Error('Bitte einen positiven Rechnungsbetrag eingeben.');
 if(!['net','gross'].includes(data.basis))throw new Error('Bitte Netto oder Brutto als Ausgangsbetrag wählen.');
 const invoiceNet=data.basis==='net'?amount:rounded(amount*10000,10000+vat),invoiceGross=data.basis==='gross'?amount:invoiceNet+rounded(invoiceNet*vat,10000);
 const share=mode==='percent'?decimal(data.partnerPercent,10000,'Vergütungsanteil'):null;
 const partnerNet=mode==='fixed'?decimal(data.partnerAmount,999999999,'Partnerprovision'):rounded(invoiceNet*share,10000);
 if(partnerNet>invoiceNet)throw new Error('Die Partnerprovision darf das Netto-Gutachtenhonorar nicht übersteigen.');
 const partnerTax=rounded(partnerNet*partnerVat,10000);
 return {invoiceNet,invoiceGross,invoiceTax:invoiceGross-invoiceNet,partnerNet,partnerTax,partnerGross:partnerNet+partnerTax,calculation:{amount:amount/100,basis:data.basis,vatPercent:vat/100,partnerMode:mode,partnerAmount:partnerNet/100,partnerPercent:share===null?null:share/100,partnerVatPercent:partnerVat/100}};
}
return {calculate};
});
