(function () {
  'use strict';
  var dialog = document.querySelector('.photo-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  var large = dialog.querySelector('[data-photo-large]');
  var title = dialog.querySelector('[data-photo-title]');
  var trigger;
  var note = dialog.querySelector('.photo-dialog-note');
  var originalNote = note ? note.textContent : ''; 
  document.querySelectorAll('[data-photo-open]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      trigger = link;
      large.src = link.href;
      large.alt = link.querySelector('img').alt;
      var heading = link.closest('figure') && link.closest('figure').querySelector('h3');
      title.textContent = link.getAttribute('data-photo-title') || (heading ? heading.textContent : large.alt);
      var wide = link.hasAttribute('data-photo-wide');
      dialog.classList.toggle('photo-dialog-wide', wide);
      if (note) note.textContent = wide ? 'Echter Screenshot des aktuellen Webportals · Fiktive Beispieldaten.' : originalNote;
      dialog.showModal();
    });
  });
  dialog.querySelector('[data-photo-close]').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (event) {
    var box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  dialog.addEventListener('close', function () { large.removeAttribute('src'); if (trigger) trigger.focus(); });
}());
