'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{Readable}=require('node:stream'),sharp=require('sharp');
const {createStore}=require('../portal/store'),{createPortal}=require('../portal/app'),{summarize}=require('../portal/presentation');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
test('presentation metadata excludes hidden reports, partner invoices and internal messages',()=>{
 const c={status:'needs_info'},files=[{id:'photo',kind:'photo',type:'image/jpeg'},{id:'report',kind:'report',type:'application/pdf'},{id:'invoice',kind:'partner_invoice',type:'application/pdf'}],events=[{id:'secret',action:'Nachricht',note:'INTERNAL',internal:true,at:'2026-09-12'},{id:'request',action:'Status: Rückfrage',note:'Fahrzeugschein fehlt',internal:false,at:'2026-09-11'},{id:'message',action:'Nachricht',note:'Hallo',at:'2026-09-10'}];
 const p=summarize(c,files,events,{role:'partner'});assert.equal(p.fileCount,2);assert.equal(p.photoCount,1);assert.equal(p.documentCount,1);assert.equal(p.thumbnailFileId,'photo');assert.equal(p.latestRequest.note,'Fahrzeugschein fehlt');assert.equal(p.lastMessage.note,'Hallo');assert.equal(p.recentEvents.length,2);assert.equal(p.recentEvents[0].action,'Status: Rückfrage');assert(summarize(c,files,events,{role:'admin'}).recentEvents.some(e=>e.note==='INTERNAL'));assert(!JSON.stringify(p).includes('INTERNAL'));assert.equal(p.submittedAt,undefined);
 assert.equal(summarize(c,files,events,{role:'appraiser'}).fileCount,2);
});
async function fixture(){
 const store=await createStore({NODE_ENV:'test',PORTAL_LOCAL_DB:':memory:'}),portal=createPortal({store,env:{NODE_ENV:'production'},mail:{ready:false,send:async()=>{throw Error('No mail');}}});await portal.ready();const sessions={};
 await store.transaction(async s=>{for(const role of ['partner','other','admin']){const token=crypto.randomBytes(32).toString('hex');sessions[role]=token;const companyId=role==='admin'?null:role;
 if(companyId)await s.put('company',{id:companyId,status:'approved',name:'Test '+role});await s.put('user',{id:role,name:role,email:role+'@example.test',companyId,active:true,role:role==='admin'?'admin':'partner'});await s.put('session',{id:hash(token),userId:role,workspace:role==='admin'?'admin':'partner',expires:Date.now()+60000,csrf:'test'},role);}});
 const cid=crypto.randomUUID(),photo=crypto.randomUUID(),pdf=crypto.randomUUID(),report=crypto.randomUUID(),original=await sharp({create:{width:1600,height:1000,channels:3,background:'#e52214'}}).jpeg().toBuffer();
 await store.transaction(async s=>{await s.put('case',{id:cid,number:'TEST',companyId:'partner',companyName:'Testpartner',status:'needs_info',source:'mobile',version:1,createdAt:'2026-09-10T10:00:00Z',updatedAt:'2026-09-11T10:00:00Z',submittedAt:'2026-09-10T12:00:00Z',intake:{owner:'Beispiel',vehicle:'Testwagen',plate:'TEST'},finance:null},'partner');
 for(const [id,kind,type,bytes]of [[photo,'photo','image/jpeg',original],[pdf,'authorization','application/pdf',Buffer.from('%PDF-1.7 test %%EOF')],[report,'report','application/pdf',Buffer.from('%PDF-secret-report')]]){await s.put('file',{id,kind,type,name:'Testdatei',caseId:cid,size:bytes.length},cid);await s.blob(id,bytes);}
 for(const [action,note,internal]of [['Nachricht','Partner-visible',false],['Nachricht','SECRET-NOTE',true],['Status: Rückfrage','Foto ergänzen',false]])await s.put('event',{id:crypto.randomUUID(),caseId:cid,at:'2026-09-11T10:00:00Z',action,note,internal,actor:'Testadmin'},cid);
 });
 const call=async(route,role)=>{const req=Readable.from([]);Object.assign(req,{method:'GET',url:'/api/portal'+route,headers:{host:role==='admin'?'admin.unfallx.com':'app.unfallx.com',...(role?{cookie:'__Host-ux_session='+sessions[role]}:{})},socket:{remoteAddress:'127.0.0.1'}});const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status,headers){this.statusCode=status;Object.assign(this.headers,headers);},end(data){this.bytes=Buffer.from(data);this.headersSent=true;}};await portal.handle(req,res,{});return {...res,json:()=>JSON.parse(res.bytes)};};
 return {portal,store,cid,photo,pdf,report,original,call};
}
test('private previews preserve original bytes, enforce ownership, and queue simultaneous image requests',async()=>{
 const f=await fixture();try{
 assert.equal((await f.call('/files/'+f.photo+'/preview')).statusCode,401);assert.equal((await f.call('/files/'+f.photo+'/preview','other')).statusCode,404);assert.equal((await f.call('/files/'+f.report+'/preview','partner')).statusCode,403);assert.equal((await f.call('/files/'+f.pdf+'/preview','partner')).statusCode,415);
 const r=await f.call('/files/'+f.photo+'/thumbnail','partner');assert.equal(r.statusCode,200);assert.equal(r.headers['Content-Type'],'image/webp');assert.match(r.headers['Cache-Control'],/no-store/);const m=await sharp(r.bytes).metadata();assert.equal(m.width,960);assert.equal(m.height,600);
 const burst=await Promise.all(Array.from({length:12},()=>f.call('/files/'+f.photo+'/preview','partner')));assert(burst.every(x=>x.statusCode===200));assert.deepEqual((await f.call('/files/'+f.photo,'partner')).bytes,f.original);assert.equal((await f.call('/files/'+f.photo+'/preview','admin')).statusCode,200);
 }finally{await f.portal.close();}
});
test('case summaries, native receipt fields and messages are scoped to the logged-in company',async()=>{
 const f=await fixture();try{
 for(const route of ['/cases','/mobile/overview']){const own=(await f.call(route,'partner')).json(),rows=own.cases||own.items;assert.equal(rows.length,1);assert.equal(rows[0].submittedAt,'2026-09-10T12:00:00Z');assert.equal(rows[0].fileCount,2);assert.equal(rows[0].photoCount,1);assert.equal(rows[0].documentCount,1);assert.equal(rows[0].thumbnailFileId,f.photo);assert.equal(rows[0].latestRequest.note,'Foto ergänzen');assert(!JSON.stringify(own).includes('SECRET-NOTE'));const foreign=(await f.call(route,'other')).json();assert.equal((foreign.cases||foreign.items).length,0);}
 assert.equal((await f.call('/messages')).statusCode,401);assert.equal((await f.call('/messages','other')).json().messages.length,0);const messages=(await f.call('/messages','partner')).json().messages;assert.equal(messages.length,1);assert.equal(messages[0].note,'Partner-visible');assert.equal(messages[0].caseId,f.cid);
 }finally{await f.portal.close();}
});
