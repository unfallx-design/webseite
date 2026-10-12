/* UNFALLX Dashboard – optische Verfeinerungen im Stil von unfallx.com.
   Ändert keine Daten und keine Abläufe. Respektiert reduzierte Bewegung. */
(function () {
  'use strict';
  var root = document.getElementById('portal-root');
  if (!root || !document.body) return;
  var reduce = function () {
    return document.body.dataset.motion === 'off' ||
      (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  /* Letztes Wort der Hauptüberschrift in UNFALLX-Rot */
  function accentTitle() {
    var h = root.querySelector(':scope > .ws-page-heading h1');
    if (!h || h.querySelector('.x-accent') || h.children.length) return;
    var m = h.textContent.match(/^([\s\S]*?)(\S+)\s*$/);
    if (!m || !m[1].trim()) return;
    h.textContent = m[1];
    var span = document.createElement('span');
    span.className = 'x-accent';
    span.textContent = m[2];
    h.appendChild(span);
  }

  /* Werte aus style="--x:…" anwenden. Die Sicherheitsregeln der Seite blockieren
     Inline-Styles im Markup; über das CSSOM sind sie erlaubt (z. B. Trend-Balken). */
  function applyInlineVars() {
    root.querySelectorAll('[style]').forEach(function (el) {
      if (el.dataset.xStyled) return;
      el.dataset.xStyled = '1';
      String(el.getAttribute('style') || '').split(';').forEach(function (rule) {
        var i = rule.indexOf(':');
        if (i < 1) return;
        var name = rule.slice(0, i).trim(), value = rule.slice(i + 1).trim();
        if (/^--[a-z0-9-]+$/i.test(name) && /^[\d.]+(%|px)?$/.test(value)) el.style.setProperty(name, value);
      });
    });
  }

  /* Zahlen hochzählen – der Endwert ist exakt der Originaltext */
  var fmt = new Intl.NumberFormat('de-DE');
  function countUp(el) {
    if (el.dataset.xCounted) return;
    el.dataset.xCounted = '1';
    var original = el.textContent.trim();
    if (!/^\d{1,6}$/.test(original)) return;
    var target = parseInt(original, 10);
    if (!target || reduce()) return;
    var start = performance.now(), dur = Math.min(1200, 500 + target * 40);
    function step(now) {
      if (!el.isConnected) return;
      var t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 4);
      el.textContent = t < 1 ? fmt.format(Math.round(target * e)) : original;
      if (t < 1) requestAnimationFrame(step);
    }
    el.textContent = '0';
    requestAnimationFrame(step);
  }

  /* Verteilungsbalken: macht Mengen auf einen Blick sichtbar */
  var palette = {
    working: '#0a84ff', requests: '#ff9f0a', done: '#30d158', draft: '#8e8e93',
    new: '#ff0000', neu: '#ff0000', review: '#bf5af2', archived: '#636366'
  };
  var fallback = ['#ff0000', '#0a84ff', '#ff9f0a', '#30d158', '#bf5af2', '#8e8e93'];
  function mixBar(items, label) {
    var total = items.reduce(function (s, x) { return s + x.count; }, 0);
    if (!total) return null;
    var wrap = document.createElement('div');
    wrap.className = 'x-mix';
    var bar = document.createElement('div');
    bar.className = 'x-mix-bar';
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', label + ': ' + items.map(function (x) { return x.label + ' ' + x.count; }).join(', '));
    var legend = document.createElement('div');
    legend.className = 'x-mix-legend';
    items.forEach(function (x, i) {
      if (x.count) {
        var seg = document.createElement('button');
        seg.type = 'button';
        seg.title = x.label + ': ' + x.count;
        seg.setAttribute('aria-label', x.label + ' anzeigen');
        seg.style.setProperty('--x-seg', x.color);
        seg.style.flexGrow = String(x.count);
        seg.style.animationDelay = (i * 0.06) + 's';
        if (x.onClick) seg.addEventListener('click', x.onClick);
        bar.appendChild(seg);
      }
      var key = document.createElement('span');
      var dot = document.createElement('i');
      dot.style.setProperty('--x-seg', x.color);
      var num = document.createElement('b');
      num.textContent = String(x.count);
      key.appendChild(dot);
      key.appendChild(document.createTextNode(x.label + ' '));
      key.appendChild(num);
      legend.appendChild(key);
    });
    wrap.appendChild(bar);
    wrap.appendChild(legend);
    return wrap;
  }

  function visualizeFilters() {
    root.querySelectorAll('.ws-filters').forEach(function (filters) {
      var next = filters.nextElementSibling;
      if (next && next.classList.contains('x-mix')) return;
      var items = [];
      filters.querySelectorAll('button[data-case-group]').forEach(function (b, i) {
        var g = b.dataset.caseGroup;
        if (g === 'all') return;
        var n = b.querySelector('span');
        var count = n ? parseInt(n.textContent, 10) || 0 : 0;
        var label = (b.firstChild && b.firstChild.nodeType === 3 ? b.firstChild.textContent : b.textContent).trim();
        items.push({ label: label, count: count, color: palette[g] || fallback[i % fallback.length], onClick: function () { b.click(); } });
      });
      var el = mixBar(items, 'Verteilung der Fälle');
      if (el) filters.insertAdjacentElement('afterend', el);
    });
  }

  function visualizePipeline() {
    var pipe = root.querySelector('.uz-pipeline');
    if (!pipe) return;
    var prev = pipe.previousElementSibling;
    if (prev && prev.classList.contains('x-mix')) return;
    var items = [];
    pipe.querySelectorAll(':scope > a').forEach(function (a, i) {
      var s = a.querySelector('strong'), l = a.querySelector('span'), dot = a.querySelector('i');
      var count = parseInt(s && (s.dataset.xFinal || s.textContent), 10) || 0;
      var color = dot ? getComputedStyle(dot).backgroundColor : '';
      items.push({ label: l ? l.textContent.trim() : '', count: count, color: color && color !== 'rgba(0, 0, 0, 0)' ? color : fallback[i % fallback.length], onClick: function () { a.click(); } });
    });
    var el = mixBar(items, 'Fälle je Schritt');
    if (el) pipe.insertAdjacentElement('beforebegin', el);
  }

  var queued = false;
  function enhance() {
    queued = false;
    try {
      accentTitle();
      applyInlineVars();
      root.querySelectorAll('.uz-pipeline a > strong').forEach(function (s) { if (!s.dataset.xFinal) s.dataset.xFinal = s.textContent.trim(); });
      visualizePipeline();
      visualizeFilters();
      root.querySelectorAll('.uz-metric > strong, .uz-pipeline a > strong').forEach(countUp);
    } catch (e) { /* rein optisch – Fehler nie an die Oberfläche geben */ }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(enhance); } }

  new MutationObserver(queue).observe(root, { childList: true, subtree: true });
  queue();
})();
