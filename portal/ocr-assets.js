'use strict';
const path=require('node:path'),fs=require('node:fs');
// Exact public allowlist: never expose arbitrary files from node_modules.
const PREFIX='/assets/ocr-v1/',base=path.join(__dirname,'..','node_modules');
const files={
 'tesseract.min.js':'tesseract.js/dist/tesseract.min.js',
 'worker.min.js':'tesseract.js/dist/worker.min.js',
 'deu.traineddata.gz':'@tesseract.js-data/deu/4.0.0/deu.traineddata.gz',
 'LICENSE.txt':'tesseract.js/LICENSE.md'
};
for(const variant of ['','-lstm','-simd','-simd-lstm','-relaxedsimd','-relaxedsimd-lstm'])for(const ext of ['.wasm','.wasm.js']){const name='tesseract-core'+variant+ext;files[name]='tesseract.js-core/'+name;}
function asset(url){if(!url.startsWith(PREFIX))return null;const name=url.slice(PREFIX.length);if(!Object.hasOwn(files,name))return false;return {file:path.join(base,files[name]),type:name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.wasm')?'application/wasm':name.endsWith('.txt')?'text/plain; charset=utf-8':'application/gzip'};}
function serve(req,res,url,headers){const a=asset(url);if(a===null)return false;if(!a){res.writeHead(404,headers);res.end();return true;}
 fs.stat(a.file,(error,s)=>{if(error){res.writeHead(503,{...headers,'Cache-Control':'no-store'});res.end('Scanner wird vorbereitet. Bitte später erneut versuchen.');return;}
 res.writeHead(200,{...headers,'Content-Type':a.type,'Content-Length':s.size,'Cache-Control':'public, max-age=86400','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'"});
 if(req.method==='HEAD')res.end();else fs.createReadStream(a.file).on('error',()=>res.destroy()).pipe(res);
 });return true;}
module.exports={asset,serve,PREFIX};
