'use strict';
const D = require('./domain');
const fields = ['name', 'contact', 'type', 'street', 'postcode', 'city', 'phone', 'accountHolder', 'iban', 'bic', 'taxNumber', 'vatId', 'register'];
function validIBAN(value) {
 if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(value)) return false;
 if (value.startsWith('DE') && value.length !== 22) return false;
 let remainder = 0;
 for (const char of value.slice(4) + value.slice(0,4)) for (const digit of /[A-Z]/.test(char) ? String(char.charCodeAt(0)-55) : char) remainder = (remainder*10 + Number(digit)) % 97;
 return remainder === 1;
}
function profile(company) {
 return {id:company.id, version:company.profileVersion || 0, status:company.status, email:company.email, updatedAt:company.profileUpdatedAt || null,
  ...Object.fromEntries(fields.map(key => [key, company[key] || (key === 'taxNumber' ? company.taxId || '' : '')]))};
}
function createCompanyProfile({tx, rate, refreshUser}) {
 async function company(s, user) {
  const fresh = await refreshUser(s,user);
  D.assert(fresh.role === 'partner' && fresh.companyId, 'Nur für Partnerbetriebe.',403);
  const row = await s.get('company',fresh.companyId);
  D.assert(row && row.status !== 'suspended','Firmenzugang nicht verfügbar.',403);
  return row;
 }
 async function get(user) { return tx(async s => ({profile:profile(await company(s,user))})); }
 async function save(user, data) {
  // Explicit allow-list: ownership, approval status, rates and payout totals are never writable here.
  const {privacyVersion: _unchangedConsentVersion, ...base} = D.companyData({...data,company:data.name});
  const bank = {accountHolder:D.text(data.accountHolder,180),iban:D.text(data.iban,50).replace(/\s/g,'').toUpperCase(),bic:D.text(data.bic,20).replace(/\s/g,'').toUpperCase()};
  D.assert(!bank.iban || validIBAN(bank.iban),'Bitte eine gültige IBAN eingeben.');
  D.assert(!bank.iban || bank.accountHolder,'Bitte den Kontoinhaber ergänzen.');
  D.assert(!bank.bic || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bank.bic),'Bitte eine gültige BIC eingeben.');
  const taxNumber=D.text(data.taxNumber,40),vatId=D.text(data.vatId,32).replace(/\s/g,'').toUpperCase();
  D.assert(!vatId || /^[A-Z]{2}[A-Z0-9]{2,14}$/.test(vatId),'Bitte die USt-IdNr. mit Länderkürzel eingeben.');
  return tx(async s => {
   const co=await company(s,user);await rate(s,'company-profile:'+user.id,30);
   D.assert(Number.isInteger(data.version) && data.version === (co.profileVersion || 0),'Die Firmendaten wurden inzwischen geändert. Bitte neu laden und erneut bearbeiten.',409);
   Object.assign(co,base,bank,{taxNumber,taxId:taxNumber,vatId,profileVersion:(co.profileVersion || 0)+1,profileUpdatedAt:new Date().toISOString(),profileUpdatedBy:user.id,profileNeedsReview:true});
   await s.put('company',co);
   await s.put('admin_event',{id:D.id(),action:'Firmendaten aktualisiert',companyId:co.id,actor:user.id,at:co.profileUpdatedAt});
   return {profile:profile(co),message:'Firmendaten gespeichert. UNFALLX kann die Angaben im Dashboard prüfen.'};
  });
 }
 return {get,save};
}
module.exports={createCompanyProfile,validIBAN};
