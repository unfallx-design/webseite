'use strict';
const path=require('node:path');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logo='<img src="cid:unfallx-logo" width="210" alt="UNFALLX" style="display:block;width:210px;max-width:100%;height:auto;border:0;margin:0 auto">';
function brandHtml(html,text=''){
 const header='<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;background:#ffffff;border-bottom:3px solid #e3241c">'+logo+'</td></tr></table>';
 if(html?.includes('cid:unfallx-logo'))return html;
 if(html)return /<body[^>]*>/i.test(html)?html.replace(/<body[^>]*>/i,m=>m+header):header+html;
 return '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f5f8;font-family:Arial,sans-serif;color:#192436">'+header+'<table role="presentation" width="100%"><tr><td align="center"><div style="max-width:560px;text-align:left;padding:30px 20px;line-height:1.7">'+esc(text).replace(/\n/g,'<br>')+'</div></td></tr></table></body></html>';
}
const logoAttachment=()=>({filename:'unfallx-logo.png',path:path.join(__dirname,'../assets/email-logo.png'),cid:'unfallx-logo',contentType:'image/png',contentDisposition:'inline'});
function notice({title,copy,url,cta='App öffnen',secondary=null,origin='https://unfallx.com'}){
 const text=title+'\n\n'+copy+'\n\n'+cta+': '+url+(secondary?'\n\n'+secondary.label+': '+secondary.url:'')+'\n\nUNFALLX · Unext GmbH\nEmmentaler Str. 76E, 13407 Berlin\ninfo@unfallx.com · 0176 64 365 185\nDatenschutz: '+origin+'/portal-datenschutz';
 const secondaryHtml=secondary?'<p style="font-size:12px"><a href="'+esc(secondary.url)+'">'+esc(secondary.label)+'</a></p>':'';
 const html=brandHtml('<div style="background:#f3f5f8;padding:28px 14px;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto;background:white;border-radius:16px;padding:28px;color:#192436"><p style="color:#e3241c;font-size:12px;letter-spacing:2px">UNFALLX CONNECT</p><h1 style="font-size:27px;line-height:1.25">'+esc(title)+'</h1><p style="line-height:1.8">'+esc(copy).replace(/\n/g,'<br>')+'</p><p style="margin:28px 0"><a href="'+esc(url)+'" style="display:inline-block;padding:15px 22px;border-radius:9px;background:#e3241c;color:white;font-weight:bold;text-decoration:none">'+esc(cta)+' →</a></p><p style="font-size:12px;line-height:1.8;color:#596678">UNFALLX · Unext GmbH<br>Emmentaler Str. 76E · 13407 Berlin<br><a href="mailto:info@unfallx.com">info@unfallx.com</a> · <a href="'+esc(origin)+'/portal-datenschutz">Datenschutz</a></p>'+secondaryHtml+'<p style="font-size:11px;word-break:break-all">'+esc(url)+'</p></div></div>');
 return {subject:'UNFALLX · '+title,text,html};
}
module.exports={esc,brandHtml,logoAttachment,notice};
