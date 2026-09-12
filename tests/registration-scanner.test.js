'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const P=require('../assets/registration-parser'),I=require('../assets/case-intake'),A=require('../portal/ocr-assets');
test('certificate codes map to reviewable fields, including holder address and optional vehicle details',()=>{
 const result=P.parse('Zulassungsbescheinigung Teil I\nA            B UX 1234\nB             15.03.2020\nC.1.1 MUSTERMANN\nC.1.2 ERIKA\nC.1.3 Beispielstraße 27a\n13407 Berlin\nD.1 VOLKSWAGEN\nD.2 5N\nD.3 TIGUAN\nE WVGZZZ5NZLW123456\n2.1 0603\n2.2 ADB000123');
 assert.deepEqual(result.fields,{vin:'WVGZZZ5NZLW123456',plate:'B UX 1234',vehicleMake:'VOLKSWAGEN',vehicle:'VOLKSWAGEN TIGUAN',firstRegistration:'2020-03-15',hsn:'0603',tsn:'ADB000123',ownerLastName:'MUSTERMANN',ownerFirstName:'ERIKA',ownerPostcode:'13407',ownerCity:'Berlin',ownerStreet:'Beispielstraße',ownerHouseNumber:'27a'});
 for(const k of ['mileage','ownership','vatDeductible','ownerIban','customerEmail'])assert(!Object.hasOwn(result.fields,k));
});
test('incomplete scans and reverse-side legends do not manufacture values',()=>{
 assert.deepEqual(P.parse('Ein Schadenfoto\nB AB 1234').fields,{});
 const r=P.parse('Zulassungsbescheinigung Teil I\nA Kennzeichen\nB Datum der Erstzulassung\nC.1.1 Name oder Firmenname\nC.1.2 Vornamen\nC.1.3 Anschrift\nD.1 Marke\nD.3 Handelsbezeichnung\nE Fahrzeug-Identifizierungsnummer');assert.deepEqual(r.fields,{});
 assert.equal(P.parse('A B UX 234\nB 31.02.2020\nE WVQZZZ5NZLW123456').fields.firstRegistration,undefined);
 assert.equal(P.parse('A B UX 234\nE WVQZZZ5NZLW123456').fields.vin,undefined);
});
test('wrapped labels, firm holder, separate columns and punctuation variations are accepted',()=>{
 const r=P.parse('Zulassungsbescheinigung Teil I\n(A): B UX 4356    B 01.06.2019\nC,1,1: Beispiel GmbH\nC.1.3 Testweg 8\n12345 Musterstadt\nD.1\nBMW\nD.3\n320D\nE: WBA8C11010K123456');assert.equal(r.fields.vehicle,'BMW 320D');assert.equal(r.fields.ownerCompany,'Beispiel GmbH');assert.equal(r.fields.plate,'B UX 4356');assert.equal(r.fields.firstRegistration,'2019-06-01');
});
test('only explicitly selected fields merge; holder needs confirmation; unrelated data stays intact',()=>{
 const current=I.normalize({plate:'B ALT 99',ownership:'leasing',ownerLastName:'Alt',mileage:'35000'}),proposed={plate:'B NEU 123',ownerLastName:'Neu',mileage:'1',role:'admin'};
 let r=P.merge(current,proposed,['ownerLastName','role','mileage']);assert.equal(r.values.ownerLastName,'Alt');assert.equal(r.values.mileage,'35000');assert.equal(r.values.role,undefined);assert.equal(r.values.plate,'B ALT 99');
 r=P.merge(current,proposed,['plate','ownerLastName'],true);assert.equal(r.values.plate,'B NEU 123');assert.equal(r.values.ownerLastName,'Neu');assert.equal(r.values.ownership,'leasing');assert.equal(r.values.ownerType,'person');
});
test('OCR assets expose only explicit installed engine/model files, never arbitrary dependencies',()=>{
 for(const url of ['/assets/ocr-v1/tesseract.min.js','/assets/ocr-v1/worker.min.js','/assets/ocr-v1/deu.traineddata.gz','/assets/ocr-v1/tesseract-core-relaxedsimd-lstm.wasm.js','/assets/ocr-v1/tesseract-core-lstm.wasm.js','/assets/ocr-v1/LICENSE.txt'])assert(fs.existsSync(A.asset(url).file),url);
 for(const path of ['../package.json','../../.env','package.json','worker.min.js.map','constructor','__proto__','deu.traineddata.gz/../../.env'])assert.equal(A.asset(A.PREFIX+path),false);
 assert.equal(A.asset('/assets/portal.js'),null);
 const client=fs.readFileSync(require.resolve('../assets/registration-scanner.js'),'utf8');assert(client.includes('workerBlobURL:false'));assert(!client.includes('cdn.jsdelivr'));assert(!client.includes('console.log'));
});
test('installed German OCR reads a rendered test document without any external OCR service',async()=>{
 const sharp=require('sharp'),{createWorker}=require('tesseract.js');
 const rows=[['A','B UX 1234'],['B','15.03.2020'],['C.1.1','MUSTERMANN'],['C.1.2','ERIKA'],['C.1.3','Beispielstraße 27a'],['','13407 Berlin'],['D.1','VOLKSWAGEN'],['D.3','TIGUAN'],['E','WVGZZZ5NZLW123456'],['2.1','0603'],['2.2','ADB000123']];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1500"><rect width="1800" height="1500" fill="#eff0df"/><g font-family="Arial" fill="#111"><text x="100" y="100" font-size="36">TESTDATEN – KEIN AMTLICHES DOKUMENT</text><text x="100" y="185" font-size="38">Zulassungsbescheinigung Teil I</text>${rows.map(([k,v],i)=>`<text x="100" y="${280+i*88}" font-size="32">${k}</text><text x="310" y="${280+i*88}" font-size="38">${v}</text>`).join('')}</g></svg>`;
 const png=await sharp(Buffer.from(svg)).png().toBuffer(),worker=await createWorker('deu',1,{langPath:require('@tesseract.js-data/deu').langPath,cacheMethod:'none'});
 try{await worker.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1'});const result=await worker.recognize(png),fields=P.parse(result.data.text).fields;assert.equal(fields.vin,'WVGZZZ5NZLW123456');assert.equal(fields.plate,'B UX 1234');assert.equal(fields.ownerLastName,'MUSTERMANN');assert.equal(fields.ownerStreet,'Beispielstraße');assert.equal(fields.firstRegistration,'2020-03-15');assert.equal(fields.vehicle,'VOLKSWAGEN TIGUAN');}finally{await worker.terminate();}
});
