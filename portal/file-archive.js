'use strict';
const {createHash}=require('node:crypto');
const {assert}=require('./domain');
// ZIP STORE keeps every original byte and needs at most one original in memory.
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
function entryName(file,index){
 const safe=String(file.name||'Original').normalize('NFC').replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g,'_').replace(/^[. ]+|[. ]+$/g,''),ext=safe.match(/\.[a-z0-9]{1,8}$/i)?.[0]||'';
 let stem='';for(const char of (ext?safe.slice(0,-ext.length):safe)){if(Buffer.byteLength(stem+char)>200)break;stem+=char;}
 return String(index+1).padStart(3,'0')+'-'+(stem||'Original')+ext;
}
function headers(name,size,crc,offset){
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(33,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(size,18);local.writeUInt32LE(size,22);local.writeUInt16LE(name.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x0800,8);central.writeUInt16LE(33,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(size,20);central.writeUInt32LE(size,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
 return {local:Buffer.concat([local,name]),central:Buffer.concat([central,name])};
}
async function write(res,bytes){
 for(let i=0;i<bytes.length;i+=65536){
  if(res.destroyed)throw Error('ARCHIVE_CANCELLED');
  await new Promise((resolve,reject)=>{
   const closed=()=>finish(Error('ARCHIVE_CANCELLED'));
   const finish=error=>{res.off('close',closed);error?reject(error):resolve();};
   res.once('close',closed);res.write(bytes.subarray(i,i+65536),finish);
  });
 }
}
async function sendArchive(res,files,read,filename){
 assert(files.length>0,'Für diese Auswahl sind noch keine Dateien vorhanden.',404);
 assert(files.length<=100&&files.every(f=>Number.isSafeInteger(f.size)&&f.size>0&&f.size<=25*1024*1024)&&files.reduce((n,f)=>n+f.size,0)<=750*1024*1024,'Dieser Download überschreitet das Dateilimit.',413);
 const names=files.map((f,i)=>Buffer.from(entryName(f,i))),length=22+files.reduce((n,f,i)=>n+76+names[i].length*2+f.size,0);
 const directory=[];let offset=0;
 const timeout=()=>res.destroy();res.setTimeout(120000,timeout);
 try{
  for(let i=0;i<files.length;i++){
   if(res.destroyed)throw Error('ARCHIVE_CANCELLED');
   const bytes=await read(files[i]);
   assert(Buffer.isBuffer(bytes)&&bytes.length===files[i].size&&createHash('sha256').update(bytes).digest('hex')===files[i].sha256,'Eine Originaldatei konnte nicht vollständig gelesen werden. Bitte erneut versuchen.',503);
   const header=headers(names[i],bytes.length,crc32(bytes),offset);
   if(!res.headersSent)res.writeHead(200,{'Content-Type':'application/zip','Content-Length':length,'Content-Disposition':'attachment; filename="'+filename+'"','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"});
   await write(res,header.local);await write(res,bytes);offset+=header.local.length+bytes.length;directory.push(header.central);
  }
  const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
  await write(res,central);await write(res,end);res.end();
 }catch(e){if(res.headersSent){res.destroy();return;}throw e;}finally{res.off('timeout',timeout);if(!res.destroyed)res.setTimeout(0);}
}
module.exports={sendArchive,crc32,entryName};
