'use strict';
const nodemailer=require('nodemailer');
function createMailer(env=process.env) {
 const ready=Boolean(env.SMTP_HOST&&env.SMTP_USER&&env.SMTP_PASS);
 const transport=ready?nodemailer.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||465),secure:env.SMTP_SECURE==='true'||Number(env.SMTP_PORT||465)===465,auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000}):null;
 return {ready,async send(to,subject,text,attachments=[]) {if(!transport)throw new Error('MAIL_NOT_CONFIGURED');const result=await transport.sendMail({from:env.MAIL_FROM||'UNFALLX <info@unfallx.com>',to,subject,text,attachments});if(!result.accepted.some(x=>String(x).toLowerCase()===to.toLowerCase()))throw new Error('MAIL_NOT_ACCEPTED');}};
}
module.exports={createMailer};
