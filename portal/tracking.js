'use strict';
const D=require('./domain');
function createTracking({origin,tx,rate}){
 async function issue(s,c,address){D.assert(address,'Bitte zuerst eine Kunden-E-Mail hinterlegen.');const token=D.random(),expires=Date.now()+90*86400000;await s.put('tracking_token',{id:D.hash(token),caseId:c.id,email:address,epoch:c.trackingEpoch||0,expires},c.id);return {url:origin+'/status#token='+token,expires};}
 async function read(data,ip){D.assert(/^[a-f0-9]{64}$/.test(data.token||''),'Ungültiger Statuslink.',401);return tx(async s=>{await rate(s,'tracking:'+ip,120,60000);const t=await s.get('tracking_token',D.hash(data.token)),c=t&&await s.get('case',t.caseId);D.assert(t&&t.expires>Date.now()&&c&&(c.trackingEpoch||0)===t.epoch,'Dieser Statuslink ist abgelaufen oder wurde aufgehoben. Bitte UNFALLX kontaktieren.',401);const owner=c.ownerUserId&&await s.get('user',c.ownerUserId);D.assert(t.email===c.intake.customerEmail||owner?.active&&owner.email===t.email,'Dieser Statuslink ist nicht mehr gültig.',401);const events=(await s.list('event',c.id)).filter(e=>!e.internal&&(e.action==='Fall eingereicht'||e.action.startsWith('Status: ')||e.action==='Gutachten an Kanzlei versandt')).sort((a,b)=>a.at.localeCompare(b.at));return {number:c.number,status:c.status,statusLabel:D.caseStates[c.status],updatedAt:c.updatedAt,expires:t.expires,events:events.map(e=>({label:e.action.replace(/^Status: /,''),at:e.at})),lawyer:['report_sent','closed'].includes(c.status)?c.lawyerHandoff||null:null};});}
 return {issue,read};
}
module.exports={createTracking};
