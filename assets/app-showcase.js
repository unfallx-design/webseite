(() => {
  const search=document.querySelector('[data-help-search]');
  if(!search)return;
  const articles=[...document.querySelectorAll('[data-help-article]')], empty=document.querySelector('[data-help-empty]');
  search.addEventListener('input',()=>{const q=search.value.trim().toLocaleLowerCase('de');let count=0;for(const article of articles){article.hidden=!!q&&!article.textContent.toLocaleLowerCase('de').includes(q);if(!article.hidden)count++;}empty.hidden=count>0;document.querySelector('[data-help-result]').textContent=q?count+' passende Themen':'';});
  document.querySelectorAll('.help-navigation a').forEach(a=>a.addEventListener('click',()=>{search.value='';search.dispatchEvent(new Event('input'));}));
})();
