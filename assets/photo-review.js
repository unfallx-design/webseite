/* Shared, touch-friendly review of selected files and private case photos. */
(function(scope){
'use strict';
function create(options){
 const dialog=document.createElement('dialog');dialog.className='photo-review';dialog.setAttribute('aria-label','Fotos prüfen');
 dialog.innerHTML='<header><button type="button" data-remove aria-label="Dieses Foto aus der Auswahl entfernen">× <span>Foto entfernen</span></button><strong data-count aria-live="polite"></strong><button type="button" data-close aria-label="Fotovorschau schließen">Fertig ×</button></header><div class="photo-review-stage"><img alt="" draggable="false"><p data-fallback hidden>Diese Vorschau kann auf deinem Gerät nicht angezeigt werden. Das Original bleibt unverändert erhalten.</p></div><div class="photo-review-meta"><strong data-name></strong><span data-hint>Nach links oder rechts wischen · oder Pfeiltasten verwenden</span></div><footer><button type="button" data-prev aria-label="Vorheriges Foto">←</button><button type="button" data-add>＋ Fotos hinzufügen</button><a data-download download>Original herunterladen</a><button type="button" data-next aria-label="Nächstes Foto">→</button></footer>';
 document.body.append(dialog);
 const q=s=>dialog.querySelector(s),image=q('img'),stage=q('.photo-review-stage');let key=null,opener=null,start=null;
 const items=()=>options.items();
 function refresh(){
  const all=items();if(!all.length){close();return;}
  let index=all.findIndex(f=>f.key===key);if(index<0)index=0;const item=all[index];key=item.key;
  q('[data-count]').textContent=(index+1)+' / '+all.length;q('[data-name]').textContent=item.name;
  if(image.getAttribute('src')!==item.src){image.hidden=!item.src;q('[data-fallback]').hidden=!!item.src;if(item.src)image.src=item.src;else image.removeAttribute('src');}
  image.alt=item.name;q('[data-prev]').disabled=index===0;q('[data-next]').disabled=index===all.length-1;
  q('[data-remove]').hidden=!options.remove;q('[data-remove]').disabled=!!options.locked?.()||item.removable===false;
  q('[data-add]').hidden=!options.add;q('[data-add]').disabled=!!options.locked?.();
  const link=q('[data-download]');link.hidden=!item.download;if(item.download){link.href=item.download;link.download=item.name;}else link.removeAttribute('href');
 }
 function move(delta){const all=items(),i=all.findIndex(f=>f.key===key);key=all[Math.max(0,Math.min(all.length-1,i+delta))]?.key;refresh();}
 function close(){if(dialog.open)dialog.close();}
 q('[data-close]').onclick=close;q('[data-prev]').onclick=()=>move(-1);q('[data-next]').onclick=()=>move(1);
 q('[data-add]').onclick=()=>{close();options.add?.();};
 q('[data-remove]').onclick=()=>{const all=items(),i=all.findIndex(f=>f.key===key),item=all[i];if(!item||options.locked?.()||item.removable===false)return;options.remove(item.key);key=items()[Math.min(i,items().length-1)]?.key;refresh();};
 dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?-1:1);}});
 // Ignore vertical gestures and multi-touch so scrolling and pinch zoom remain native.
 stage.addEventListener('touchstart',e=>{start=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
 stage.addEventListener('touchmove',e=>{if(e.touches.length!==1)start=null;},{passive:true});
 stage.addEventListener('touchend',e=>{if(!start||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;start=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1);},{passive:true});
 stage.addEventListener('touchcancel',()=>{start=null;});
 image.addEventListener('error',()=>{image.hidden=true;q('[data-fallback]').hidden=false;});image.addEventListener('load',()=>{image.hidden=false;q('[data-fallback]').hidden=true;});
 dialog.addEventListener('close',()=>{image.removeAttribute('src');document.body.classList.remove('photo-review-open');if(opener?.isConnected)opener.focus();});
 return {open(selected){opener=document.activeElement;key=selected;refresh();if(!items().length)return;dialog.showModal();document.body.classList.add('photo-review-open');q('[data-close]').focus();},refresh(){if(dialog.open)refresh();},close,destroy(){close();dialog.remove();}};
}
scope.UnfallxPhotoReview={create};
})(typeof window==='undefined'?globalThis:window);
