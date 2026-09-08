(function () {
  'use strict';
  var dialog = document.querySelector('.photo-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  var large = dialog.querySelector('[data-photo-large]');
  var title = dialog.querySelector('[data-photo-title]');
  var trigger;
  document.querySelectorAll('[data-photo-open]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      trigger = link;
      large.src = link.href;
      large.alt = link.querySelector('img').alt;
      title.textContent = link.closest('figure').querySelector('h3').textContent;
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
