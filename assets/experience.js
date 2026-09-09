(function () {
  'use strict';
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var savedMotion;
  try { savedMotion = localStorage.getItem('unfallx-motion'); } catch (e) {}
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var motionOff = reduced.matches || savedMotion === 'off' || saveData;
  var motionButtons = document.querySelectorAll('[data-motion-toggle]');
  function applyMotion() {
    root.setAttribute('data-motion', motionOff ? 'off' : 'on');
    root.classList.add('motion-ready');
    motionButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(motionOff));
      button.textContent = motionOff ? 'Animationen aktivieren' : 'Animationen pausieren';
    });
  }
  applyMotion();
  motionButtons.forEach(function (button) { button.addEventListener('click', function () {
    motionOff = !motionOff; savedMotion = motionOff ? 'off' : 'on';
    try { localStorage.setItem('unfallx-motion', savedMotion); } catch (e) {}
    applyMotion();
  }); });
  reduced.addEventListener('change', function (event) { motionOff = event.matches || savedMotion === 'off' || saveData; applyMotion(); });
  document.addEventListener('visibilitychange', function () { root.toggleAttribute('data-page-hidden', document.hidden); root.classList.toggle('motion-ready', !document.hidden); });
  var scenes = document.querySelectorAll('.hero-photo,.page-head-photo,.photo-section');
  scenes.forEach(function (scene) {
    var haze = document.createElement('div');
    haze.className = 'hero-haze'; haze.setAttribute('aria-hidden', 'true'); haze.appendChild(document.createElement('span')); scene.appendChild(haze);
  });
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) { entries.forEach(function (entry) { entry.target.classList.toggle('in-view', entry.isIntersecting); }); });
    scenes.forEach(function (scene) { observer.observe(scene); });
  } else { scenes.forEach(function (scene) { scene.classList.add('in-view'); }); }

  /* The address is public; no third-party map loads before the visitor chooses it. */
  document.querySelectorAll('[data-location-map]').forEach(function (widget) {
    var options = widget.querySelectorAll('[data-map-address]');
    var load = widget.querySelector('[data-map-load]');
    var remove = widget.querySelector('[data-map-remove]');
    var shell = widget.querySelector('[data-map-shell]');
    var placeholder = widget.querySelector('[data-map-placeholder]');
    var title = widget.querySelector('[data-map-title]');
    var route = widget.querySelector('[data-map-route]');
    var selected = options[0], frame = null;
    function update() {
      options.forEach(function (button) { button.setAttribute('aria-pressed', String(button === selected)); });
      var address = selected.getAttribute('data-map-address');
      title.textContent = address;
      route.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(address);
      if (frame) {
        frame.title = 'Standortkarte: ' + address;
        frame.src = 'https://www.google.com/maps?q=' + encodeURIComponent(address) + '&output=embed&hl=' + 'de';
      }
    }
    options.forEach(function (button) { button.addEventListener('click', function () { selected = button; update(); }); });
    function loadMap() {
      if (frame) return;
      frame = document.createElement('iframe'); frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.setAttribute('allowfullscreen', '');
      update(); shell.appendChild(frame); placeholder.hidden = true; remove.hidden = false; remove.focus();
    }
    load.addEventListener('click', function () { if(window.UnfallxConsent)window.UnfallxConsent.requestMedia(loadMap); });
    window.addEventListener('unfallx-consent-change',function(e){if(!e.detail.media&&frame){frame.remove();frame=null;placeholder.hidden=false;remove.hidden=true;}});
    remove.addEventListener('click', function () { if (frame) frame.remove(); frame = null; placeholder.hidden = false; remove.hidden = true; load.focus(); });
    update();
  });

  var finder = document.querySelector('[data-area-finder]');
  if (finder) {
    var input = finder.querySelector('[data-area-query]'), cards = finder.querySelectorAll('[data-area]');
    var filters = finder.querySelectorAll('[data-area-filter]'), result = finder.querySelector('[data-area-status]');
    var empty = finder.querySelector('[data-area-empty]'), group = 'all';
    function normalize(value) { return value.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
    function filter() {
      var query = normalize(input.value), count = 0;
      cards.forEach(function (card) {
        var match = (group === 'all' || card.getAttribute('data-area') === group) && normalize(card.getAttribute('data-search') || card.textContent).indexOf(query) >= 0;
        card.hidden = !match;
        if (match) { count++; if (query) card.open = true; }
        if (!query) card.open = false;
      });
      result.textContent = count + (count === 1 ? ' Gebiet gefunden' : ' Gebiete gefunden');
      empty.hidden = count !== 0;
      var other = empty.querySelector('a'); other.href = '/' + '?ort=' + encodeURIComponent(input.value.trim().slice(0, 120)) + '#anfrage';
    }
    input.addEventListener('input', filter);
    filters.forEach(function (button) { button.addEventListener('click', function () {
      group = button.getAttribute('data-area-filter');
      filters.forEach(function (item) { item.setAttribute('aria-pressed', String(item === button)); }); filter();
    }); });
    finder.querySelector('[data-area-clear]').addEventListener('click', function () { input.value = ''; group = 'all'; filters.forEach(function (button) { button.setAttribute('aria-pressed', String(button.getAttribute('data-area-filter') === 'all')); }); filter(); input.focus(); });
    filter();
  }

  var checklist = document.querySelector('[data-checklist]');
  if (checklist) {
    var boxes = checklist.querySelectorAll('input[type=checkbox]');
    var progress = checklist.querySelector('progress');
    var checkStatus = checklist.querySelector('[data-check-status]');
    function updateChecklist() {
      var count = Array.prototype.filter.call(boxes, function (box) { return box.checked; }).length;
      progress.value = count; progress.max = boxes.length;
      checkStatus.textContent = count + ' von ' + boxes.length + ' Punkten vorbereitet';
    }
    boxes.forEach(function (box) { box.addEventListener('change', updateChecklist); });
    checklist.querySelector('[data-print]').addEventListener('click', function () { window.print(); });
    checklist.querySelector('[data-check-reset]').addEventListener('click', function () { boxes.forEach(function (box) { box.checked = false; }); updateChecklist(); });
    updateChecklist();
  }
  var topButton = document.querySelector('[data-back-top]');
  if (topButton) {
    function showTopButton() { topButton.hidden = window.scrollY < 450; }
    window.addEventListener('scroll', showTopButton, {passive:true});
    topButton.addEventListener('click', function () {
      var logo = document.querySelector('.site-header .logo');
      if (logo) logo.focus({preventScroll:true});
      window.scrollTo({top:0, behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off' ? 'instant' : 'smooth'});
    });
    showTopButton();
  }
})();
