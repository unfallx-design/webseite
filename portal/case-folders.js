'use strict';
const D=require('./domain');
const folders=['active','archived','deleted'];
// Filing belongs to one business workspace, never to the shared case or its status.
function scope(user){D.assert(['partner','admin','appraiser'].includes(user.role),'Kein Portalzugang.',403);if(user.role==='partner'){D.assert(user.companyId,'Firmenzugang fehlt.',403);return 'partner:'+user.companyId;}return 'internal';}
const key=(user,cid)=>D.hash(scope(user)+':'+cid);
const canManage=user=>['partner','admin'].includes(user.role);
function view(user,record){return {folder:record?.folder||'active',version:record?.version||0,updatedAt:record?.updatedAt||null,canManage:canManage(user)};}
async function read(s,user,cid){return view(user,await s.get('case_folder',key(user,cid)));}
async function listing(s,user,cases,folder='active'){
 D.assert([...folders,'all'].includes(folder),'Ungültige Fallablage.');
 const records=new Map((await s.list('case_folder',scope(user))).map(r=>[r.caseId,r]));
 const counts={active:0,archived:0,deleted:0};
 const rows=cases.map(c=>{const filing=view(user,records.get(c.id));counts[filing.folder]++;return {...c,filing};});
 return {cases:folder==='all'?rows:rows.filter(c=>c.filing.folder===folder),folders:counts};
}
async function change(s,user,c,data){
 D.assert(canManage(user),'Die Administration verwaltet die interne Fallablage.',403);
 D.assert(folders.includes(data.folder),'Ungültige Fallablage.');
 D.assert(data.folder!=='deleted'||data.confirmed===true,'Bitte das Verschieben in den eigenen Papierkorb bestätigen.');
 const old=await s.get('case_folder',key(user,c.id));
 D.assert(Number.isSafeInteger(data.version)&&data.version===(old?.version||0),'Die Ablage wurde inzwischen geändert. Bitte den Fall neu laden.',409);
 if((old?.folder||'active')===data.folder)return {filing:view(user,old)};
 const updatedAt=new Date().toISOString(),record={id:key(user,c.id),caseId:c.id,folder:data.folder,version:(old?.version||0)+1,updatedAt,updatedBy:user.id};
 await s.put('case_folder',record,scope(user));
 await s.put('case_folder_event',{id:D.id(),caseId:c.id,from:old?.folder||'active',to:data.folder,actor:user.id,at:updatedAt},scope(user));
 return {filing:view(user,record)};
}
module.exports={listing,read,change};
