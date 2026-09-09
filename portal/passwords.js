'use strict';
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const {assert}=require('./domain');
const scrypt=promisify(crypto.scrypt);
// OWASP scrypt profile: 32 MiB, r=8, p=3. Work stays outside database transactions.
const options={N:32768,r:8,p:3,maxmem:48*1024*1024};
let active=0;
function password(value){assert(typeof value==='string'&&[...value].length>=15&&[...value].length<=128&&Buffer.byteLength(value)<=512,'Bitte ein Passwort mit 15 bis 128 Zeichen verwenden. Ein langer Merksatz ist möglich.');return value;}
async function derive(value,salt){assert(active<4,'Die Anmeldung ist gerade ausgelastet. Bitte gleich erneut versuchen.',429);active++;try{return await scrypt(value,salt,64,options);}finally{active--;}}
async function encode(value){password(value);const salt=crypto.randomBytes(16).toString('hex');const key=await derive(value,salt);return 'scrypt-v1$'+salt+'$'+key.toString('hex');}
async function verify(value,encoded){if(typeof value!=='string'||Buffer.byteLength(value)>512)return false;const parts=String(encoded||'').split('$'),valid=parts[0]==='scrypt-v1'&&/^[a-f0-9]{32}$/.test(parts[1])&&/^[a-f0-9]{128}$/.test(parts[2]);const key=await derive(value,valid?parts[1]:'00000000000000000000000000000000');return valid&&crypto.timingSafeEqual(key,Buffer.from(parts[2],'hex'));}
module.exports={password,encode,verify};
