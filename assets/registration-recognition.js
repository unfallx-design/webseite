(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./registration-parser'));else root.UnfallxRegistrationRecognition=factory(root.UnfallxRegistrationParser);})(typeof globalThis!=='undefined'?globalThis:this,function(P){
'use strict';
function combine(results){const fields={},votes={};for(const result of results)for(const [key,value] of Object.entries(result.fields||{})){const list=votes[key]||(votes[key]=new Map());list.set(value,(list.get(value)||0)+1);}for(const [key,list] of Object.entries(votes))fields[key]=[...list].sort((a,b)=>b[1]-a[1])[0][0];if(fields.vehicleMake&&fields.vehicle&&!fields.vehicle.toUpperCase().startsWith(fields.vehicleMake.toUpperCase()))fields.vehicle=fields.vehicleMake+' '+fields.vehicle;return {fields,recognized:results.some(r=>r.recognized)};}
async function read(worker,base,enhanced,{onPhase=()=>{},cancelled=()=>false}={}){const results=[];async function pass(image,mode,title,rectangle){if(cancelled())throw Error('Scan abgebrochen.');onPhase(title);await worker.setParameters({tessedit_pageseg_mode:String(mode),preserve_interword_spaces:'1'});const {data}=await worker.recognize(image,{rotateAuto:mode===3,...(rectangle?{rectangle}:{})},{text:true,blocks:true});if(cancelled())throw Error('Scan abgebrochen.');results.push(P.parse({...data,imageWidth:base.width,documentConfirmed:results.some(r=>r.recognized)}));return combine(results);}
 let result=await pass(base,3,'1/3 · Fahrzeugdaten werden gelesen');if(Object.keys(result.fields).length>=11)return result;
 result=await pass(enhanced,11,'2/3 · Kleine Schrift und Feldnummern werden geprüft');
 if((Object.keys(result.fields).length<8||!result.fields.vin||!result.fields.firstRegistration||!result.fields.vehicleMake)&&base.width/base.height>=1.5){const third=Math.round(base.width/3),height=base.height;for(let i=0;i<2;i++){result=await pass(enhanced,6,'3/3 · '+(i===0?'Halterspalte':'Fahrzeugspalte')+' wird einzeln gelesen',{left:Math.max(0,i*third-30),top:0,width:Math.min(third+60,base.width-i*third),height});}}
 return result;
}
return {read,combine};
});
