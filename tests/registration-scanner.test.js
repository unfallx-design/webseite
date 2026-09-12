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
 for(const url of ['/assets/ocr-v2/tesseract.min.js','/assets/ocr-v2/worker.min.js','/assets/ocr-v2/deu.traineddata.gz','/assets/ocr-v2/tesseract-core-relaxedsimd-lstm.wasm.js','/assets/ocr-v2/tesseract-core-lstm.wasm.js','/assets/ocr-v2/LICENSE.txt'])assert(fs.existsSync(A.asset(url).file),url);
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
test('public OCR delivery returns complete engine bytes and excludes shared CDN caching',async t=>{
 const http=require('node:http'),url=A.PREFIX+'tesseract-core-relaxedsimd-lstm.wasm.js',server=http.createServer((req,res)=>{if(!A.serve(req,res,req.url,{})){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const origin='http://127.0.0.1:'+server.address().port,r=await fetch(origin+url);assert.equal(r.status,200);assert.match(r.headers.get('Cache-Control'),/^private/);assert.equal(r.headers.get('CDN-Cache-Control'),'no-store');const expected=fs.readFileSync(A.asset(url).file),bytes=Buffer.from(await r.arrayBuffer());assert.equal(Number(r.headers.get('Content-Length')),expected.length);assert.deepEqual(bytes,expected);assert.equal((await fetch(origin+A.PREFIX+'package.json')).status,404);
});
test('printed field labels followed by their values are read instead of being discarded',()=>{
 const r=P.parse('Zulassungsbescheinigung Teil I\nA Amtliches Kennzeichen\nB UX 7456\nC.1.1 Name oder Firmenname\nMUSTERWERK GMBH\nC.1.2 Vorname(n)\nERIKA\nC.1.3 Anschrift\nBeispielweg 27\n13407 Berlin\nD1 VOLKSWAGEN\nD3 TIGUAN');
 assert.equal(r.fields.plate,'B UX 7456');assert.equal(r.fields.ownerCompany,'MUSTERWERK GMBH');assert.equal(r.fields.ownerFirstName,'ERIKA');assert.equal(r.fields.vehicle,'VOLKSWAGEN TIGUAN');
});
test('separate OCR blocks map by coordinates without pulling names from adjacent columns',()=>{
 const words=[['C.1.1',20,100,70,118],['Name oder Firmenname',75,100,260,118],['MUSTERMANN',20,143,245,175],['D.1',460,143,500,166],['BMW',530,143,600,175],['C.1.2',20,210,70,230],['Vorname(n)',75,210,210,230],['ERIKA',20,255,140,280],['C.1.3',20,320,70,340],['Anschrift',75,320,200,340],['Beispielweg',20,360,210,389],['27',230,360,264,389],['13407',20,400,115,430],['Berlin',135,400,240,430]];
 const r=P.parse({text:'Zulassungsbescheinigung Teil I',imageWidth:1350,blocks:words.map(([text,x0,y0,x1,y1])=>({paragraphs:[{lines:[{words:[{text,confidence:90,bbox:{x0,y0,x1,y1}}]}]}]}))});
 assert.equal(r.fields.ownerLastName,'MUSTERMANN');assert.equal(r.fields.ownerFirstName,'ERIKA');assert.equal(r.fields.vehicleMake,'BMW');assert.equal(r.fields.ownerStreet,'Beispielweg');assert.equal(r.fields.ownerPostcode,'13407');
});
test('multi-pass reader retries sparse columns and stops before issuing new work after cancellation',async()=>{
 const R=require('../assets/registration-recognition'),calls=[];let cancelled=false;
 const worker={setParameters:async()=>{},recognize:async(image,options)=>{calls.push(options);return {data:{text:calls.length===1?'Zulassungsbescheinigung Teil I':calls.length===2?'E WVGZZZ5NZLW123456':'D.1 VOLKSWAGEN\nD.3 TIGUAN'}};}};
 const r=await R.read(worker,{width:3000,height:1500},{},{onPhase:()=>{}});assert.equal(calls.length,4);assert.equal(r.fields.vin,'WVGZZZ5NZLW123456');assert.equal(r.fields.vehicle,'VOLKSWAGEN TIGUAN');assert(calls[2].rectangle.width<3000);
 calls.length=0;await assert.rejects(R.read(worker,{width:3000,height:1500},{},{cancelled:()=>cancelled,onPhase:()=>{cancelled=true;}}),/abgebrochen/);assert.equal(calls.length,1);
});
test('camera tracks stop on close and late permission responses cannot reopen a closed camera',async()=>{
 const vm=require('node:vm'),source=fs.readFileSync(require.resolve('../assets/registration-capture.js'),'utf8');
 function fixture(){let resolveStream,stops=0;const nodes=new Map(),events=new Map();const node=()=>({disabled:false,setAttribute(){},showModal(){},close(){},remove(){},play:async()=>{},getTracks:()=>[]});const get=s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);};get('[data-body]').querySelector=get;const dialog=node();dialog.querySelector=get;const document={createElement:()=>dialog,body:{append(){}},addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)};const window={addEventListener(){},removeEventListener(){}};const context={window,document,setTimeout,clearTimeout,navigator:{mediaDevices:{getUserMedia:opts=>{assert.equal(opts.audio,false);assert.equal(opts.video.facingMode.ideal,'environment');return new Promise(r=>resolveStream=r);}}}};vm.runInNewContext(source,context);const api=window.UnfallxRegistrationCapture.controller(),stream={getTracks:()=>[{stop:()=>stops++}]};return {api,get,stream,resolve:()=>resolveStream(stream),stops:()=>stops,events};}
 const f=fixture(),result=f.api.camera();f.api.destroy();f.resolve();assert.equal(await result,null);await new Promise(r=>setImmediate(r));assert.equal(f.stops(),1);assert.equal(f.events.size,0);
 const g=fixture(),open=g.api.camera();g.resolve();await new Promise(r=>setImmediate(r));assert.equal(g.get('[data-shutter]').disabled,false);g.get('[data-close]').onclick();assert.equal(await open,null);assert.equal(g.stops(),1);assert.equal(g.get('video').srcObject,null);
});
test('OCR reads a three-column form with small printed labels and background lines',async()=>{
 const sharp=require('sharp'),{createWorker}=require('tesseract.js'),R=require('../assets/registration-recognition');
 const label=(x,y,t)=>`<text x="${x}" y="${y}" font-size="21" fill="#647066">${t}</text>`,value=(x,y,t)=>`<text x="${x}" y="${y}" font-size="35" fill="#222">${t}</text>`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="2700" height="1400"><rect width="2700" height="1400" fill="#eef1e4"/><g stroke="#b9caba" stroke-width="1">${Array.from({length:25},(_,i)=>`<path d="M910 ${52+i*50}H2680"/>`).join('')}<path d="M875 0V1400M1790 0V1400"/></g><g font-family="Arial"><text x="35" y="80" font-size="31">Zulassungsbescheinigung Teil I</text><text x="35" y="130" font-size="24">TESTDATEN · KEIN AMTLICHES DOKUMENT</text>${label(35,400,'A Amtliches Kennzeichen')}${value(35,450,'B UX 7654')}${label(35,550,'C.1.1 Name oder Firmenname')}${value(35,600,'MUSTERMANN')}${label(35,710,'C.1.2 Vorname(n)')}${value(35,760,'ERIKA')}${label(35,870,'C.1.3 Anschrift')}${value(35,920,'Beispielweg 27')}${value(35,977,'13407 Berlin')}${label(930,92,'B')}${value(1000,92,'15.03.2020')}${label(930,242,'E')}${value(1000,242,'WVGZZZ5NZLW123456')}${label(930,342,'D.1')}${value(1010,342,'VOLKSWAGEN')}${label(930,542,'D.3')}${value(1010,542,'TIGUAN')}${label(930,642,'2.1')}${value(1010,642,'0603')}${label(1300,642,'2.2')}${value(1380,642,'ADB000123')}${label(1830,142,'F.1')}${value(1930,142,'2200')}${label(1830,292,'P.1')}${value(1930,292,'1968')}</g></svg>`;
 const image=await sharp(Buffer.from(svg)).blur(.4).png().toBuffer();Object.assign(image,{width:2700,height:1400});const enhanced=await sharp(image).greyscale().normalise().png().toBuffer(),worker=await createWorker('deu',1,{langPath:require('@tesseract.js-data/deu').langPath,cacheMethod:'none'});
 try{const r=await R.read(worker,image,enhanced);assert.equal(r.fields.vin,'WVGZZZ5NZLW123456');assert.equal(r.fields.plate,'B UX 7654');assert.equal(r.fields.ownerLastName,'MUSTERMANN');assert.equal(r.fields.ownerFirstName,'ERIKA');assert.equal(r.fields.vehicle,'VOLKSWAGEN TIGUAN');assert.equal(r.fields.firstRegistration,'2020-03-15');}finally{await worker.terminate();}
});
