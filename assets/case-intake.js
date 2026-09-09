/* Shared field definitions and submission rules for the partner form and the server. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.UnfallxIntake=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const groups=[
 {id:'owner',title:'Geschädigte Person & Kontaktdaten',short:'Auftraggeber',intro:'Angaben zur geschädigten Person oder Firma. Der einreichende Partnerbetrieb wird dem Fall automatisch zugeordnet.'},
 {id:'vehicle',title:'Fahrzeug & Eigentumsverhältnis',short:'Fahrzeug',intro:'FIN aus Feld E des Fahrzeugscheins übernehmen. Fahrzeugschein und bekannte Vorschäden bitte mit dokumentieren.'},
 {id:'accident',title:'Unfall & Unfallgegner',short:'Unfall',intro:'Das Gegnerkennzeichen ist erforderlich. Die Ausnahme gilt nur, wenn stattdessen eine Polizei-Aktennummer bekannt ist.'},
 {id:'inspection',title:'Besichtigung & Aufnahme',short:'Besichtigung',intro:'Wo, wann und unter welchen Bedingungen wurde das Fahrzeug besichtigt? Trage auch die besichtigende Person und alle Anwesenden ein.'},
 {id:'lawyer',title:'Kanzlei & Freigaben',short:'Kanzlei',intro:'Gib die bestehende Kanzlei an oder wähle die Vermittlung durch UNFALLX. Die interne Zuordnung und der Versand werden gesondert geprüft.'}
];
const options={
 ownerType:{person:'Person',company:'Firma / Unternehmen'},
 ownership:{owned:'Eigentum',leasing:'Leasing',financed:'Finanzierung',manufacturer_bank:'Finanzierung über Herstellerbank'},
 vatDeductible:{yes:'Ja',no:'Nein'},
 previousDamage:{no:'Keine bekannten Vorschäden',repaired:'Ja, reparierte Vorschäden',unrepaired:'Ja, unreparierte Vorschäden',both:'Ja, reparierte und unreparierte Vorschäden',unknown:'Vorschadenhistorie noch unklar'},
 policeInvolved:{yes:'Ja',no:'Nein'},
 inspectionCondition:{assembled:'Unzerlegt',partly_dismantled:'Teilweise zerlegt',dismantled:'Zerlegt'},
 inspectionConditionsAdequate:{yes:'Ausreichend',no:'Nicht ausreichend'},
 inspectionToolsUsed:{yes:'Ja, Hilfsmittel verwendet',no:'Keine Hilfsmittel verwendet'},
 inspectionTools:{dent_puller:'Dellenentferner',measuring_rod:'Messlatte',lift:'Hebebühne',paint_meter:'Lackschichtmessgerät',diagnostic_device:'Diagnosegerät',lighting:'Zusätzliche Beleuchtung',other:'Andere Hilfsmittel'},
 lawyerChoice:{own:'Eigene Kanzlei vorhanden',unfallx:'Kanzleivermittlung durch UNFALLX gewünscht',undecided:'Noch keine Kanzlei beauftragt / Entscheidung offen'}
};
const F=(name,label,group,extra={})=>({name,label,group,max:180,...extra});
const fields=[
 F('ownerType','Auftraggeber ist','owner',{type:'select',required:true}),
 F('ownerCompany','Firma','owner',{show:d=>d.ownerType==='company',required:d=>d.ownerType==='company'}),
 F('ownerFirstName','Vorname','owner',{required:true,max:100,autocomplete:'given-name'}),
 F('ownerLastName','Nachname','owner',{required:true,max:100,autocomplete:'family-name'}),
 F('ownerStreet','Straße','owner',{required:true,max:140,autocomplete:'address-line1'}),
 F('ownerHouseNumber','Hausnummer','owner',{required:true,max:20}),
 F('ownerPostbox','Postfach (falls vorhanden)','owner',{max:40}),
 F('ownerPostcode','Postleitzahl','owner',{required:true,max:12,autocomplete:'postal-code'}),
 F('ownerCity','Ort','owner',{required:true,max:100,autocomplete:'address-level2'}),
 F('ownerPhone','Telefonnummer','owner',{required:true,type:'tel',max:50,autocomplete:'tel'}),
 F('customerEmail','E-Mail-Adresse','owner',{required:true,type:'email',max:254,autocomplete:'email'}),
 F('ownerIban','IBAN für die Schadenregulierung','owner',{required:true,max:42,hint:'Bankverbindung des Anspruchstellers. Hierdurch wird keine Zahlung ausgelöst.'}),
 F('vehicle','Fahrzeug / Modell','vehicle',{required:true,max:120}),
 F('plate','Kennzeichen des geschädigten Fahrzeugs','vehicle',{required:true,max:20}),
 F('vin','Fahrgestellnummer / FIN','vehicle',{required:true,max:17,hint:'Im Fahrzeugschein unter E. Meist 17 Zeichen.'}),
 F('mileage','Kilometerstand','vehicle',{required:true,max:10,inputmode:'numeric',hint:'Kilometer als ganze Zahl, z. B. 123456.'}),
 F('huDue','Nächste Hauptuntersuchung (TÜV)','vehicle',{required:true,type:'month',max:7}),
 F('ownership','Eigentumsverhältnis','vehicle',{required:true,type:'select'}),
 F('financeCompany','Leasinggeber / finanzierende Bank (falls bekannt)','vehicle',{show:d=>['leasing','financed','manufacturer_bank'].includes(d.ownership)}),
 F('vatDeductible','Vorsteuerabzugsberechtigt','vehicle',{required:true,type:'select'}),
 F('previousDamage','Bekannte Vorschäden','vehicle',{required:true,type:'select'}),
 F('previousDamageDescription','Vorschäden: Stelle, Umfang und Reparaturstand','vehicle',{type:'textarea',max:4000,wide:true,show:d=>['repaired','unrepaired','both','unknown'].includes(d.previousDamage),required:d=>['repaired','unrepaired','both','unknown'].includes(d.previousDamage),hint:'Bei unklarer Historie angeben, was bereits geprüft wurde oder noch geklärt werden muss.'}),
 F('accidentDate','Unfalltag','accident',{required:true,type:'date',max:10}),
 F('accidentTime','Unfallzeit','accident',{required:true,type:'time',max:5}),
 F('location','Unfallort / Straße / genaue Stelle','accident',{required:true,wide:true,max:300}),
 F('policeInvolved','Wurde der Unfall polizeilich aufgenommen?','accident',{required:true,type:'select'}),
 F('policeAuthority','Polizeibehörde / Dienststelle','accident',{show:d=>d.policeInvolved==='yes'||d.opponentPlateUnknown,required:d=>d.policeInvolved==='yes'||d.opponentPlateUnknown}),
 F('policeFileNumber','Polizei-Aktennummer','accident',{max:120,show:d=>d.policeInvolved==='yes'||d.opponentPlateUnknown,required:d=>d.opponentPlateUnknown,hint:'Bei unbekanntem Gegnerkennzeichen zwingend erforderlich.'}),
 F('opponentPlateUnknown','Gegnerkennzeichen nicht bekannt, aber Polizei-Aktennummer ist bekannt','accident',{type:'checkbox',wide:true}),
 F('opponentPlate','Kennzeichen des Unfallgegners','accident',{max:20,show:d=>!d.opponentPlateUnknown,required:d=>!d.opponentPlateUnknown}),
 F('description','Unfallhergang & sichtbare Schäden','accident',{required:true,type:'textarea',max:8000,wide:true}),
 F('opponentCompany','Firma des Unfallgegners','accident',{optionalSection:true}),
 F('opponentFirstName','Vorname des Unfallgegners','accident',{max:100,optionalSection:true}),
 F('opponentLastName','Nachname des Unfallgegners','accident',{max:100,optionalSection:true}),
 F('opponentStreet','Straße des Unfallgegners','accident',{max:140,optionalSection:true}),
 F('opponentHouseNumber','Hausnummer des Unfallgegners','accident',{max:20,optionalSection:true}),
 F('opponentPostcode','Postleitzahl des Unfallgegners','accident',{max:12,optionalSection:true}),
 F('opponentCity','Ort des Unfallgegners','accident',{max:100,optionalSection:true}),
 F('opponentPhone','Telefon des Unfallgegners','accident',{type:'tel',max:50,optionalSection:true}),
 F('opponentEmail','E-Mail des Unfallgegners','accident',{type:'email',max:254,optionalSection:true}),
 F('insurer','Gegnerische Versicherung','accident',{optionalSection:true}),
 F('insuranceNumber','Versicherungsnummer / Policennummer','accident',{max:120,optionalSection:true}),
 F('claimNumber','Schadennummer der Versicherung','accident',{max:120,optionalSection:true}),
 F('inspectionStreet','Besichtigung: Straße','inspection',{required:true,max:140}),
 F('inspectionHouseNumber','Besichtigung: Hausnummer','inspection',{required:true,max:20}),
 F('inspectionPostcode','Besichtigung: Postleitzahl','inspection',{required:true,max:12}),
 F('inspectionCity','Besichtigung: Ort','inspection',{required:true,max:100}),
 F('inspectionAddressExtra','Betrieb / Halle / Adresszusatz','inspection'),
 F('inspectionDate','Besichtigungstag','inspection',{required:true,type:'date',max:10}),
 F('inspectionTime','Besichtigungszeit','inspection',{required:true,type:'time',max:5}),
 F('inspectorName','Besichtigt von: Vor- und Nachname','inspection',{required:true}),
 F('inspectorCompany','Firma der besichtigenden Person (falls abweichend)','inspection'),
 F('inspectionCondition','Zustand bei der Besichtigung','inspection',{required:true,type:'select'}),
 F('inspectionConditionNote','Ergänzungen zum Fahrzeugzustand','inspection',{type:'textarea',max:2000,wide:true}),
 F('inspectionConditionsAdequate','Besichtigungsbedingungen','inspection',{required:true,type:'select'}),
 F('inspectionConditionsNote','Welche Einschränkungen bestanden?','inspection',{show:d=>d.inspectionConditionsAdequate==='no',required:d=>d.inspectionConditionsAdequate==='no',type:'textarea',max:2000,wide:true}),
 F('inspectionToolsUsed','Wurden Hilfsmittel verwendet?','inspection',{required:true,type:'select'}),
 F('inspectionTools','Verwendete Hilfsmittel','inspection',{type:'multiselect',wide:true,show:d=>d.inspectionToolsUsed==='yes',required:d=>d.inspectionToolsUsed==='yes'}),
 F('inspectionToolsOther','Andere Hilfsmittel beschreiben','inspection',{show:d=>d.inspectionToolsUsed==='yes'&&d.inspectionTools?.includes('other'),required:d=>d.inspectionToolsUsed==='yes'&&d.inspectionTools?.includes('other'),max:500}),
 F('inspectionAlone','Nur die besichtigende Person war anwesend','inspection',{type:'checkbox',wide:true}),
 F('inspectionAttendees','Weitere Anwesende: Name und Funktion','inspection',{show:d=>!d.inspectionAlone,required:d=>!d.inspectionAlone,type:'textarea',wide:true,max:2000,hint:'Zum Beispiel geschädigte Person, Werkstattmitarbeiter oder Fahrzeughalter.'}),
 F('lawyerChoice','Rechtsanwaltskanzlei','lawyer',{required:true,type:'select',wide:true}),
 F('lawyerName','Name der Kanzlei','lawyer',{show:d=>d.lawyerChoice==='own',required:d=>d.lawyerChoice==='own'}),
 F('lawyerEmail','E-Mail der Kanzlei (falls bekannt)','lawyer',{type:'email',max:254,show:d=>d.lawyerChoice==='own'}),
 F('lawyerPhone','Telefon der Kanzlei (falls bekannt)','lawyer',{type:'tel',max:50,show:d=>d.lawyerChoice==='own'}),
 F('shareWithLawyer','Der Auftraggeber hat die Übermittlung des fertigen Gutachtens an die beauftragte Kanzlei autorisiert.','lawyer',{type:'checkbox',wide:true,show:d=>['own','unfallx'].includes(d.lawyerChoice)}),
 F('notifyCustomer','Der Auftraggeber möchte Status-E-Mails erhalten. Die E-Mail-Adresse wird vor dem ersten Statusversand per Bestätigungslink geprüft.','lawyer',{type:'checkbox',wide:true}),
 F('authority','Ich bin zur Übermittlung der Angaben und Unterlagen berechtigt. Die betroffenen Personen sind informiert; ein entsprechender Auftrag liegt vor.','lawyer',{type:'checkbox',wide:true,required:true})
];
function visible(f,d){return !f.show||f.show(d);}
function required(f,d){return visible(f,d)&&(typeof f.required==='function'?f.required(d):!!f.required);}
function normalize(body={}){
 const d={schemaVersion:2};
 for(const f of fields){const v=body[f.name];d[f.name]=f.type==='checkbox'?v===true:f.type==='multiselect'?(Array.isArray(v)?[...new Set(v)]:[]):typeof v==='string'?v.trim():'';}
 for(const k of ['plate','opponentPlate','vin'])d[k]=d[k].toUpperCase();
 d.ownerIban=d.ownerIban.replace(/\s/g,'').toUpperCase();
 for(const k of ['customerEmail','opponentEmail','lawyerEmail'])d[k]=d[k].toLowerCase();
 if(d.opponentPlateUnknown){d.opponentPlate='';d.policeInvolved='yes';}
 if(!d.lawyerChoice&&d.lawyerEmail)d.lawyerChoice='own';
 if(d.lawyerChoice==='undecided'){d.lawyerName='';d.lawyerEmail='';d.lawyerPhone='';d.shareWithLawyer=false;}
 d.owner=[d.ownerType==='company'?d.ownerCompany:'',[d.ownerFirstName,d.ownerLastName].filter(Boolean).join(' ')].filter(Boolean).join(' · ')||(typeof body.owner==='string'?body.owner.trim():'');
 d.ownerContact=[d.ownerPhone,d.customerEmail].filter(Boolean).join(' · ')||(typeof body.ownerContact==='string'?body.ownerContact.trim():'');
 return d;
}
function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
function validIban(v){if(!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v))return false;if(v.startsWith('DE')&&v.length!==22)return false;const digits=(v.slice(4)+v.slice(0,4)).replace(/[A-Z]/g,c=>String(c.charCodeAt(0)-55));let remainder=0;for(const c of digits)remainder=(remainder*10+Number(c))%97;return remainder===1;}
function errors(body){const d=normalize(body),out=[];const add=(f,message)=>out.push({name:f.name,group:f.group,label:f.label,message});
 for(const f of fields){if(!visible(f,d))continue;const v=d[f.name];if(required(f,d)&&(!v||Array.isArray(v)&&!v.length)){add(f,f.type==='checkbox'?'Bitte bestätigen.':'Bitte ausfüllen oder auswählen.');continue;}if(!v||Array.isArray(v)&&!v.length)continue;
  if(options[f.name]&&(Array.isArray(v)?v.some(x=>!options[f.name][x]):!options[f.name][v]))add(f,'Bitte eine gültige Auswahl treffen.');
  else if(f.type==='email'&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v))add(f,'Bitte eine gültige E-Mail-Adresse eingeben.');
  else if(f.type==='tel'&&(!/^[+\d()\s/.-]{6,50}$/.test(v)||v.replace(/\D/g,'').length<6))add(f,'Bitte eine gültige Telefonnummer eingeben.');
  else if(f.type==='date'&&!validDate(v))add(f,'Bitte ein gültiges Datum eingeben.');
  else if(f.type==='time'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))add(f,'Bitte eine gültige Uhrzeit eingeben.');
  else if(f.type==='month'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(v))add(f,'Bitte Monat und Jahr eingeben.');
  else if(f.name==='ownerIban'&&!validIban(v))add(f,'Die IBAN-Prüfziffer stimmt nicht. Bitte mit der Bankverbindung abgleichen.');
  else if(f.name==='vin'&&!/^[A-HJ-NPR-Z0-9]{5,17}$/.test(v))add(f,'Bitte 5 bis 17 Zeichen aus Feld E übernehmen, ohne I, O oder Q.');
  else if(f.name==='mileage'&&!/^\d{1,8}$/.test(v))add(f,'Kilometerstand bitte als ganze Zahl ohne Punkt oder Komma eingeben.');
  else if(typeof v==='string'&&(v.length>f.max||/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(v)))add(f,'Bitte die Eingabe kürzen oder ungültige Zeichen entfernen.');
 }
 return out;
}
const documentKinds={registration:'Fahrzeugschein',authorization:'Unterschriebener Auftrag',case_bundle:'Fahrzeugschein & Auftrag'};
function fileErrors(files=[]){const out=[];const add=(name,label)=>out.push({name,group:'documents',label,message:'Bitte hochladen und entsprechend zuordnen.'});if(!files.some(f=>f.kind==='photo'))add('photo','Mindestens ein Schadenfoto');if(!files.some(f=>['registration','case_bundle'].includes(f.kind)))add('registration','Fahrzeugschein');if(!files.some(f=>['authorization','case_bundle'].includes(f.kind)))add('authorization','Unterschriebener Auftrag');return out;}
function display(f,d){const v=d[f.name];if(f.name==='opponentPlate'&&d.opponentPlateUnknown)return 'Nicht bekannt – Polizei-Aktennummer hinterlegt';if(f.type==='checkbox')return v?'Ja':'Nein';if(Array.isArray(v))return v.map(x=>options[f.name]?.[x]||x).join(', ');return options[f.name]?.[v]||v||'—';}
return {groups,fields,options,normalize,visible,required,errors,fileErrors,documentKinds,display,validIban,validDate};
});
