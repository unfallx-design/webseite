'use strict';
const {caseStates}=require('./domain');
function statistics(cases,user,now=new Date()){
 const groups=Object.entries(caseStates).map(([status,label])=>({status,label,count:cases.filter(c=>c.status===status).length}));
 const months=Array.from({length:6},(_,i)=>{const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-5+i,1));return {month:d.toISOString().slice(0,7),created:0,reports:0};});
 for(const c of cases){const m=months.find(m=>m.month===c.createdAt?.slice(0,7));if(m)m.created++;const r=months.find(m=>m.month===c.reportReadyAt?.slice(0,7));if(r)r.reports++;}
 const durations=cases.filter(c=>c.submittedAt&&c.reportReadyAt).map(c=>(Date.parse(c.reportReadyAt)-Date.parse(c.submittedAt))/86400000).filter(n=>n>=0&&Number.isFinite(n));
 return {total:cases.length,active:cases.filter(c=>!['draft','closed','declined'].includes(c.status)).length,needsInfo:cases.filter(c=>c.status==='needs_info').length,reports:cases.filter(c=>['report_ready','report_sent','closed'].includes(c.status)).length,groups,months,averageDays:durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length*10)/10:null,durationSample:durations.length,scope:user.role==='admin'?'Alle UNFALLX-Fälle':user.role==='partner'?'Fälle deines Betriebs':user.role==='customer'?'Deine eigenen Fälle':'Dir zugewiesene Fälle'};
}
module.exports={statistics};
