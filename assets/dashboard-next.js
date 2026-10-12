/* UNFALLX Dashboard „Next“ – rein optische Verfeinerungen.
   Ändert keine Daten und keine Abläufe. Respektiert reduzierte Bewegung. */
(function () {
  'use strict';
  var root = document.getElementById('portal-root');
  if (!root || !document.body) return;
  var reduce = function () {
    return document.body.dataset.motion === 'off' ||
      (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  /* Letztes Wort der Hauptüberschrift im Rot→Orange-Verlauf */
  function gradientTitle() {
    var h = root.querySelector(':scope > .ws-page-heading h1');
    if (!h || h.querySelector('.dx-grad') || h.children.length) return;
    var text = h.textContent;
    var m = text.match(/^([\s\S]*?)(\S+)\s*$/);
    if (!m || !m[1].trim()) return;
    h.textContent = m[1];
    var span = document.createElement('span');
    span.className = 'dx-grad';
    span.textContent = m[2];
    h.appendChild(span);
  }

  /* Zahlen hochzählen – Endwert bleibt exakt der Originaltext */
  var fmt = new Intl.NumberFormat('de-DE');
  function countUp(el) {
    if (el.dataset.dxCounted) return;
    el.dataset.dxCounted = '1';
    var original = el.textContent.trim();
    if (!/^\d{1,6}$/.test(original)) return;
    var target = parseInt(original, 10);
    if (!target || reduce()) return;
    var start = performance.now(), dur = Math.min(1400, 600 + target * 40);
    function step(now) {
      if (!el.isConnected) return;
      var t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 4);
      el.textContent = t < 1 ? fmt.format(Math.round(target * e)) : original;
      if (t < 1) requestAnimationFrame(step);
    }
    el.textContent = '0';
    requestAnimationFrame(step);
  }

  /* Lichtpunkt, der dem Mauszeiger auf Karten folgt */
  function spotlight(card) {
    if (card.dataset.dxSpot) return;
    card.dataset.dxSpot = '1';
    card.classList.add('dx-spot');
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--dx-x', (e.clientX - r.left) + 'px');
      card.style.setProperty('--dx-y', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  var queued = false;
  function enhance() {
    queued = false;
    try {
      gradientTitle();
      root.querySelectorAll('.uz-metric > strong, .uz-pipeline a > strong').forEach(countUp);
      if (window.matchMedia && matchMedia('(hover: hover)').matches) {
        root.querySelectorAll('.portal-card').forEach(spotlight);
      }
    } catch (e) { /* rein optisch – Fehler nie an die Oberfläche geben */ }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(enhance); } }

  new MutationObserver(queue).observe(root, { childList: true, subtree: true });
  queue();
})();
