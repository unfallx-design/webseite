'use strict';
const {Readable} = require('node:stream');
const {createFileStorage} = require('../../portal/file-storage');

const env={NODE_ENV:'test',PORTAL_FILE_STORAGE:'s3',PORTAL_LOCAL_DB:':memory:',PORTAL_S3_BUCKET:'unfallx-test-private',PORTAL_S3_REGION:'eu-central-1',PORTAL_S3_ACCOUNT_ID:'123456789012',PORTAL_S3_ACCESS_KEY_ID:'fixture-key',PORTAL_S3_SECRET_ACCESS_KEY:'fixture-secret'};
function fakeS3() {
  const objects=new Map(),calls=[];
  const state={failPut:false,failGet:false,failDelete:false,corruptRead:false,putThenFail:false};
  const client={async send(command){
    const name=command.constructor.name,input=command.input;
    calls.push({name,input});
    if(name==='PutObjectCommand') {
      if(state.failPut)throw Error('fixture-private-provider-error');
      objects.set(input.Key,Buffer.from(input.Body));
      if(state.putThenFail)throw Error('timeout');
      return {};
    }
    if(name==='GetObjectCommand') {
      if(state.failGet||!objects.has(input.Key))throw Error('unavailable');
      const bytes=Buffer.from(objects.get(input.Key));
      if(state.corruptRead)bytes[0]^=255;
      return {ContentLength:bytes.length,Body:Readable.from([bytes])};
    }
    if(name==='DeleteObjectCommand') {
      if(state.failDelete)throw Error('unavailable');
      objects.delete(input.Key);return {};
    }
    throw Error('Unexpected S3 operation');
  },destroy(){}};
  return {objects,calls,state,files:createFileStorage(env,{client})};
}
module.exports={env,fakeS3};
