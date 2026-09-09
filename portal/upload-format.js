'use strict';
// HEIF originals are private downloads. Validate the ISO-BMFF structure without transcoding.
function isHeif(bytes){
 let offset=0,ftyp=false,meta=false,media=false;
 while(offset<bytes.length){if(bytes.length-offset<8)return false;let size=bytes.readUInt32BE(offset),header=8;const type=bytes.toString('ascii',offset+4,offset+8);if(size===1){if(bytes.length-offset<16)return false;const big=bytes.readBigUInt64BE(offset+8);if(big>BigInt(Number.MAX_SAFE_INTEGER))return false;size=Number(big);header=16;}else if(size===0)size=bytes.length-offset;if(size<header||offset+size>bytes.length)return false;
  if(type==='ftyp'){if(offset!==0||size<header+8||size>256)return false;const brands=[bytes.toString('ascii',offset+header,offset+header+4)];for(let n=offset+header+8;n+4<=offset+size;n+=4)brands.push(bytes.toString('ascii',n,n+4));ftyp=brands.some(b=>['heic','heix','hevc','hevx'].includes(b));}
  if(type==='meta'&&size>header+4)meta=true;if(type==='mdat'&&size>header)media=true;offset+=size;
 }
 return ftyp&&meta&&media;
}
module.exports={isHeif};
