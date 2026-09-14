/* Lock visible data synchronously; late requests may never restore the previous view. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.UnfallxSessionGuard=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function expired(){const error=new Error('Die Sitzung ist beendet. Bitte erneut anmelden.');error.status=401;return error;}
function create({onLock=()=>{},cleanup=async()=>{},onSettled=()=>{}}={}){
 let locked=false,ending;const requests=new Set();
 function check(){if(locked)throw expired();}
 function track(abort){if(locked){abort();throw expired();}requests.add(abort);return ()=>requests.delete(abort);}
 function end(reason='expired'){
  if(ending)return ending;locked=true;
  onLock(reason);
  for(const abort of requests){try{abort();}catch{}}requests.clear();
  ending=Promise.resolve().then(()=>cleanup(reason)).then(result=>onSettled(result,reason),error=>onSettled({cleanupError:error},reason));return ending;
 }
 async function request(fn){check();const controller=new AbortController(),release=track(()=>controller.abort());try{const result=await fn(controller.signal);check();return result;}catch(error){if(error.status===401)void end();if(locked)throw expired();throw error;}finally{release();}}
 return {check,track,end,request,get locked(){return locked;}};
}
return {create,expired};
});
