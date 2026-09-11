'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http'),{createRequire}=require('node:module');
const nodemailer=require('nodemailer'),{accessEmail}=require('../portal/email-templates'),{notice,brandHtml}=require('../portal/brand-mail');
function load(relative,transport,env={}){const file=path.resolve(__dirname,'..',relative),realRequire=createRequire(file),module={exports:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:id=>id==='nodemailer'?{createTransport:transport}:id==='fs'?{...fs,mkdirSync(){throw Error('Unexpected fallback in mail test');}}:realRequire(id),module,exports:module.exports,__dirname:path.dirname(file),Buffer,process:{env},console:{error(){},warn(){},log(){}},setTimeout,clearTimeout});return module.exports;}
const config={SMTP_HOST:'smtp.example.test',SMTP_PORT:'465',SMTP_SECURE:'true',SMTP_USER:'info@unfallx.com',SMTP_PASS:'fixture-only'};
test('Registration, invitation, login, notices and plain messages share a single responsive brand frame',()=>{
 const emails=['registration','invitation','login'].map(kind=>accessEmail({kind,name:'Test <img onerror=x>',company:'Werkstatt & Co',url:'https://app.example.test/login#token=fixture&test=1'}).html);
 emails.push(notice({title:'Status <script>',copy:'Zeile 1\nZeile 2',url:'https://app.example.test/portal',secondary:{label:'Abmelden',url:'https://example.test/unsubscribe'}}).html,brandHtml(null,'Text <script> & Daten'));
 for(const html of emails){assert.equal((html.match(/cid:unfallx-logo/g)||[]).length,1);assert.equal((html.match(/data-unfallx-email="v2"/g)||[]).length,1);assert.match(html,/max-width:600px/);assert.match(html,/Wir sind für dich da/);assert.match(html,/Impressum/);assert.match(html,/Datenschutz/);assert.doesNotMatch(html,/<script>|<img onerror=x>/);assert.equal(brandHtml(html),html);}
 assert.match(accessEmail({kind:'registration',url:'fixture'}).text,/15 Minuten/);assert.match(accessEmail({kind:'invitation',url:'fixture'}).text,/24 Stunden/);
});
test('Actual Nodemailer MIME retains plaintext, HTML, CID logo and document attachment over TLS-configured transport',async()=>{
 let options,mime;const stream=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
 const {createMailer}=load('portal/mail.js',o=>{options=o;return {sendMail:async m=>{mime=(await stream.sendMail(m)).message.toString();return {accepted:[m.to.toUpperCase()]};}};});
 const mail=createMailer(config),m=accessEmail({kind:'registration',name:'Testpartner',url:'https://example.test/login#token=fixture'});
 await mail.send('test@example.test',m.subject,m.text,[{filename:'test.pdf',content:Buffer.from('%PDF-1.7\nTEST')}],m.html);
 assert.equal(options.secure,true);assert.equal(options.requireTLS,true);assert.equal(options.tls?.rejectUnauthorized,undefined);assert.match(mime,/Content-Type: text\/plain/);assert.match(mime,/Content-Type: text\/html/);assert.match(mime,/Content-ID: <unfallx-logo>/);assert.match(mime,/filename=test.pdf/);assert.match(mime,/Content-Disposition: inline/);assert.match(mime,/From: UNFALLX Connect/);
});
test('Mail transport refuses unconfigured, rejected and uncertain delivery instead of reporting success',async()=>{
 const {createMailer}=load('portal/mail.js',()=>({sendMail:async()=>({accepted:[]})}));
 await assert.rejects(createMailer({}).send('test@example.test','Test','Text'),/MAIL_NOT_CONFIGURED/);
 await assert.rejects(createMailer(config).send('test@example.test','Test','Text'),/MAIL_NOT_ACCEPTED/);
 const broken=load('portal/mail.js',()=>({sendMail:async()=>{throw Error('SMTP timeout');}}));await assert.rejects(broken.createMailer(config).send('test@example.test','Test','Text'),/SMTP timeout/);
});
test('Contact endpoint delivers through the shared template and inline logo without falling back to disk',async()=>{
 let sent;const contact=load('anfrage.js',()=>({sendMail:async m=>{sent=m;return {accepted:['info@unfallx.com']};}}),config);
 const server=http.createServer((req,res)=>contact.handle(req,res,{}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const r=await fetch('http://127.0.0.1:'+server.address().port,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Funktionstest',email:'test@example.test',kontaktweg:'email',anliegen:'kontakt',beschreibung:'Dies ist eine fiktive technische Kontaktanfrage.',datenschutz:true,t0:Date.now()-10000})});assert.equal(r.status,200,JSON.stringify(await r.clone().json()));assert.equal((await r.json()).delivery,'email');assert.equal(sent.to,'info@unfallx.com');assert.equal(sent.replyTo,'test@example.test');assert.match(sent.html,/data-unfallx-email="v2"/);assert.equal(sent.attachments[0].cid,'unfallx-logo');}
 finally{await new Promise(r=>server.close(r));}
});
