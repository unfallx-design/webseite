'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Batch,bindDropZone}=require('../assets/uploads');
function target(){return {dataset:{},handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};}
function event(files=[],types=['Files']){return {dataTransfer:{files,types},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};}
test('Dropping multiple original photos and PDFs queues every file once, preserves bytes and suppresses browser navigation',async()=>{
 const doc=target(),zone={...target(),ownerDocument:doc},batch=new Batch();bindDropZone(zone,files=>batch.add(files),()=>batch.running);
 const photo=new File(['original photo'],'photo.jpg',{type:'image/jpeg'}),pdf=new File(['%PDF original'],'document.pdf',{type:'application/pdf'}),e=event([photo,pdf]);zone.handlers.dragenter(e);assert.equal(zone.dataset.dragging,'true');zone.handlers.dragover(e);assert.equal(e.dataTransfer.dropEffect,'copy');zone.handlers.drop(e);assert.equal(e.prevented,true);assert.equal(e.stopped,true);assert.equal(zone.dataset.dragging,'false');assert.equal(batch.items.length,2);zone.handlers.drop(event([photo,pdf]));assert.equal(batch.items.length,2);assert.equal(batch.items[0].file,photo);assert.equal(batch.items[1].kind,'document');
 const outside=event([photo]);doc.handlers.drop(outside);assert.equal(outside.prevented,true);const text=event([],['text/plain']);doc.handlers.drop(text);assert.equal(text.prevented,undefined);
 batch.running=true;zone.handlers.drop(event([new File(['data'],'third.jpg')]));assert.equal(batch.items.length,2);zone.handlers.dragover(e);assert.equal(e.dataTransfer.dropEffect,'none');
});
test('Private PDFs and report uploads reject photos and oversized originals before sending',()=>{
 const q=new Batch({pdfOnly:true,maxFile:6*1024*1024});q.add([new File(['test'],'photo.jpg'),new File([new Uint8Array(6*1024*1024+1)],'large.pdf'),new File(['%PDF-1.4'],'valid.pdf')],'document');assert.deepEqual(q.items.map(x=>x.state),['invalid','invalid','waiting']);const report=new Batch();report.add([new File(['test'],'photo.jpg')],'report');assert.equal(report.items[0].state,'invalid');
});
test('A partial PDF batch retries only unsuccessful files',async()=>{
 const q=new Batch({pdfOnly:true});q.add([new File(['first'],'first.pdf'),new File(['second'],'second.pdf')],'document');const calls=[];await assert.rejects(q.send(async item=>{calls.push(item.file.name);if(item.file.name==='second.pdf')throw Error('connection lost');}),/Einige Dateien/);await q.send(async item=>calls.push(item.file.name));assert.deepEqual(calls,['first.pdf','second.pdf','second.pdf']);assert.equal(q.pending(),false);
});
test('Lost confirmation at the case limit recognizes an identical stored original by SHA-256',async()=>{
 const q=new Batch(),file=new File(['exact original'],'lost.jpg',{type:'image/jpeg'});q.add([file]);q.items[0].state='error';const sha=require('node:crypto').createHash('sha256').update('exact original').digest('hex');const existing=Array.from({length:99},(_,i)=>({id:'other'+i,size:1,type:'image/jpeg',kind:'photo',sha256:'none'}));existing.push({id:'stored',size:file.size,type:'image/jpeg',kind:'photo',sha256:sha});await q.send(()=>assert.fail('Already uploaded'),()=>{},existing);assert.equal(q.items[0].result.file.id,'stored');assert.equal(q.pending(),false);
 const other=new Batch();other.add([new File(['new original'],'new.jpg',{type:'image/jpeg'})]);await assert.rejects(other.send(()=>assert.fail('Over limit'),()=>{},existing),/100 Dateien/);assert.equal(other.running,false);
});
