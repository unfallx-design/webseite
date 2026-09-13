'use strict';
const nodemailer=require('nodemailer');
const {brandHtml,logoAttachment}=require('./brand-mail');
function createMailer(env=process.env) {
 const ready=Boolean(env.SMTP_HOST&&env.SMTP_USER&&env.SMTP_PASS);
 const transport=ready?nodemailer.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||465),secure:env.SMTP_SECURE==='true'||Number(env.SMTP_PORT||465)===465,requireTLS:true,auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000}):null;
 return {ready,async verify(){if(!transport)throw new Error('MAIL_NOT_CONFIGURED');return transport.verify();},async send(to,subject,text,attachments=[],html,messageId) {if(!transport)throw new Error('MAIL_NOT_CONFIGURED');const sender=env.MAIL_FROM||env.SMTP_USER||'info@unfallx.com';const from=sender.includes('<')?sender:{name:'UNFALLX Connect',address:sender};const result=await transport.sendMail({from,to,subject,text,html:brandHtml(html,text),attachments:[...attachments,logoAttachment()],messageId});if(!result.accepted.some(x=>String(x).toLowerCase()===to.toLowerCase()))throw new Error('MAIL_NOT_ACCEPTED');}};
}
// A timeout after SMTP DATA can mean acceptance without a response. Never retry it blindly.
function classifyDeliveryError(error){
 if(['MAIL_NOT_CONFIGURED','MAIL_NOT_ACCEPTED','EAUTH','EENVELOPE','ENOTFOUND','ECONNREFUSED','EDNS','ETLS'].includes(error?.code||error?.message)&&!['DATA','.'].includes(error?.command))return 'definite';
 if(Number(error?.responseCode)>=400&&Number(error?.responseCode)<600)return 'definite';
 if(error?.command&&['CONN','EHLO','HELO','AUTH','MAIL FROM','RCPT TO','STARTTLS'].includes(error.command))return 'definite';
 return 'uncertain';
}
module.exports={createMailer,classifyDeliveryError};
