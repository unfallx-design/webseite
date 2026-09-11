'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
 const nodes=new Map();const make=()=>({attributes:{},hidden:false,disabled:false,handlers:{},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k]??null;},removeAttribute(k){delete this.attributes[k];},addEventListener(k,fn){this.handlers[k]=fn;},focus(){this.focused=true;},remove(){this.removed=true;}});
 const dialog=make();dialog.querySelector=selector=>{if(!nodes.has(selector))nodes.set(selector,make());return nodes.get(selector);};dialog.showModal=()=>dialog.open=true;dialog.close=()=>{dialog.open=false;dialog.handlers.close?.();};
 const document={createElement:()=>dialog,body:{append(){},classList:{add(){},remove(){}}},activeElement:{isConnected:true,focus(){}}};const scope={document};vm.runInNewContext(fs.readFileSync(require.resolve('../assets/photo-review'),'utf8'),scope);
 let rows=Array.from({length:35},(_,i)=>({key:String(i),name:'Foto '+i,src:'blob:'+i,removable:true})),locked=false,adds=0;
 const viewer=scope.UnfallxPhotoReview.create({items:()=>rows,remove:key=>rows=rows.filter(r=>r.key!==key),add:()=>adds++,locked:()=>locked});
 return {viewer,dialog,nodes,rows:()=>rows,lock:()=>locked=true,adds:()=>adds};
}
test('Photo reviewer supports 35 photos, directional swipes, keyboard, removal and adding more',()=>{
 const f=fixture();f.viewer.open('0');const q=k=>f.nodes.get(k);assert.equal(q('[data-count]').textContent,'1 / 35');assert.equal(q('[data-prev]').disabled,true);
 const stage=q('.photo-review-stage');stage.handlers.touchstart({touches:[{clientX:300,clientY:200}]});stage.handlers.touchend({changedTouches:[{clientX:120,clientY:202}]});assert.equal(q('[data-count]').textContent,'2 / 35');
 // A vertical scroll or pinch must not advance the photo.
 stage.handlers.touchstart({touches:[{clientX:300,clientY:200}]});stage.handlers.touchend({changedTouches:[{clientX:290,clientY:400}]});assert.equal(q('[data-count]').textContent,'2 / 35');
 stage.handlers.touchstart({touches:[{clientX:300,clientY:200}]});stage.handlers.touchmove({touches:[{},{}]});stage.handlers.touchend({changedTouches:[{clientX:120,clientY:202}]});assert.equal(q('[data-count]').textContent,'2 / 35');
 q('[data-remove]').onclick();assert.equal(f.rows().length,34);assert.equal(q('[data-name]').textContent,'Foto 2');assert.equal(q('[data-count]').textContent,'2 / 34');
 f.dialog.handlers.keydown({key:'ArrowLeft',preventDefault(){}});assert.equal(q('[data-name]').textContent,'Foto 0');q('[data-add]').onclick();assert.equal(f.adds(),1);assert.equal(f.dialog.open,false);
 f.viewer.open('34');assert.equal(q('[data-next]').disabled,true);f.lock();f.viewer.refresh();assert.equal(q('[data-remove]').disabled,true);q('[data-remove]').onclick();assert.equal(f.rows().length,34);f.viewer.destroy();assert.equal(f.dialog.removed,true);
});
