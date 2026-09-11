/* Open the correct article for old bookmarks, internal links and search results. */
(()=>{'use strict';
 const aliases={gutachten:'leistungen',anfrage:'kontakt',vorteile:'arbeitsweise',ablauf:'begutachtung',vertrauen:'desag-zertifikat',einsatzgebiet:'einsatzgebiete',faq:'gutachten-fragen'};
 function reveal(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}if(!id)return;id=aliases[id]||id;const target=document.getElementById(id);if(!target)return;let node=target;while(node){if(node.tagName==='DETAILS')node.open=true;node=node.parentElement;}requestAnimationFrame(()=>target.scrollIntoView({block:'start',behavior:'instant'}));}
 window.addEventListener('hashchange',reveal);reveal();
})();
