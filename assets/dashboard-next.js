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


  /* ---------- Zentrale: Verwaltung & Einstellungen als ein Bereich ---------- */
  var isAdmin = function () { return document.body.classList.contains('admin-zentrale'); };
  var AREA = 'Verwaltung & Einstellungen';
  function svg(path) {
    var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.7'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    p.setAttribute('d', path); s.appendChild(p); return s;
  }
  function areaRoute() {
    var h = (location.hash || '').split('?')[0];
    if (h === '#einstellungen' && root.querySelector('#uz-workflow-config, .uz-settings-map')) return 'einstellungen';
    if (h === '#verwaltung' && root.querySelector('.ws-hub-grid')) return 'verwaltung';
    return '';
  }
  function mergeNav() {
    if (!isAdmin()) return;
    var nav = document.getElementById('portal-nav');
    if (!nav) return;
    var admin = nav.querySelector('a[href="#verwaltung"]'), settings = nav.querySelector('a[href="#einstellungen"]');
    if (!admin) return;
    var label = admin.querySelector('span');
    if (label && label.textContent !== AREA) { label.textContent = AREA; admin.setAttribute('aria-label', AREA); admin.title = AREA; }
    if (settings && !settings.classList.contains('x-merged')) settings.classList.add('x-merged');
    var inArea = /^#(verwaltung|einstellungen)\b/.test(location.hash || '');
    if (inArea && admin.getAttribute('aria-current') !== 'page') admin.setAttribute('aria-current', 'page');
    if (!inArea && admin.getAttribute('aria-current') === 'page' && !/^#verwaltung/.test(location.hash)) admin.removeAttribute('aria-current');
    var crumb = document.getElementById('portal-crumb');
    if (crumb && inArea && crumb.textContent !== AREA) crumb.textContent = AREA;
  }
  var EXTRA_TILES = [
    ['#besichtigungen', 'Halle & Termine', 'M4 7h16v13H4zM8 3v4m8-4v4M4 11h16'],
    ['#verguetung', 'Provisionen', 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6'],
    ['#partner', 'Partner & Rangliste', 'M4 20V10m6 10V4m6 16v-7m4 7H2']
  ];
  function mergeHubLinks() {
    if (!isAdmin()) return;
    root.querySelectorAll('a.ws-hub-link[href="#einstellungen"]').forEach(function (a) { a.classList.add('x-merged'); });
    root.querySelectorAll('a.ws-hub-link[href="#verwaltung"] strong').forEach(function (s) { if (s.textContent !== AREA) s.textContent = AREA; });
  }
  function mergeArea() {
    if (!isAdmin()) return;
    var route = areaRoute();
    if (!route || root.querySelector('.x-area-tabs')) return;
    var heading = root.querySelector(':scope > .ws-page-heading');
    if (!heading) return;
    var h1 = heading.querySelector('h1'), p = heading.querySelector('p');
    if (h1) h1.textContent = AREA;
    if (p) p.textContent = route === 'verwaltung' ? 'Team, Kanzleien, Verbindungen und Unterlagen der Zentrale.' : 'Dein Profil, deine Ansicht, Arbeitsziele und dein sicherer Zugang.';
    var tabs = document.createElement('nav');
    tabs.className = 'x-area-tabs';
    tabs.setAttribute('aria-label', AREA);
    [['#verwaltung', 'Verwaltung', 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6'], ['#einstellungen', 'Einstellungen', 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8']].forEach(function (t) {
      var a = document.createElement('a');
      a.href = t[0];
      a.appendChild(svg(t[2]));
      a.appendChild(document.createTextNode(t[1]));
      if ('#' + route === t[0]) a.setAttribute('aria-current', 'page');
      tabs.appendChild(a);
    });
    heading.insertAdjacentElement('afterend', tabs);
    if (route === 'verwaltung') {
      var grid = root.querySelector('.ws-hub-grid');
      EXTRA_TILES.forEach(function (t) {
        if (!grid || grid.querySelector('a[href="' + t[0] + '"]')) return;
        var a = document.createElement('a');
        a.href = t[0]; a.className = 'portal-card ws-hub-link';
        a.appendChild(svg(t[2]));
        var strong = document.createElement('strong'); strong.textContent = t[1];
        a.appendChild(strong);
        a.appendChild(svg('m9 6 6 6-6 6'));
        grid.appendChild(a);
      });
    } else {
      var map = root.querySelector('.uz-settings-map');
      var card = map && map.closest('.portal-card');
      if (card) card.classList.add('x-merged');
    }
  }

  /* ---------- 3D: Karten neigen sich zum Zeiger, Seitenkopf mit Tiefe ---------- */
  var TILT = '.uz-metric, .uz-pipeline > a, .ws-hub-link, .uz-settings-map a, .ws-task, .x-area-tabs a';
  var canTilt = function () { return window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce() && document.body.dataset.motion === 'full'; };
  function bindTilt(el) {
    if (el.dataset.xTilt) return;
    el.dataset.xTilt = '1';
    el.classList.add('x-tilt');
    el.addEventListener('pointermove', function (e) {
      if (!canTilt()) return;
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      var max = r.width > 320 ? 3 : 7;
      var ax = -y * max, ay = x * max, deg = Math.sqrt(ax * ax + ay * ay);
      el.style.setProperty('--x-rot', deg < 0.05 ? '0deg' : (ax / deg).toFixed(3) + ' ' + (ay / deg).toFixed(3) + ' 0 ' + deg.toFixed(2) + 'deg');
      el.classList.add('x-tilting');
    }, { passive: true });
    el.addEventListener('pointerleave', function () {
      el.classList.remove('x-tilting');
      el.style.setProperty('--x-rot', '0deg');
    });
  }
  function bindHero() {
    var hero = root.querySelector(':scope > .ws-page-heading');
    if (!hero || hero.dataset.xHero) return;
    hero.dataset.xHero = '1';
    hero.addEventListener('pointermove', function (e) {
      if (!canTilt()) return;
      var r = hero.getBoundingClientRect();
      hero.style.setProperty('--x-px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      hero.style.setProperty('--x-py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { hero.style.setProperty('--x-px', '0'); hero.style.setProperty('--x-py', '0'); });
  }

  var queued = false;
  function enhance() {
    queued = false;
    try {
      mergeNav();
      mergeArea();
      mergeHubLinks();
      accentTitle();
      bindHero();
      root.querySelectorAll(TILT).forEach(bindTilt);
      applyInlineVars();
      root.querySelectorAll('.uz-pipeline a > strong').forEach(function (s) { if (!s.dataset.xFinal) s.dataset.xFinal = s.textContent.trim(); });
      visualizePipeline();
      visualizeFilters();
      root.querySelectorAll('.uz-metric > strong, .uz-pipeline a > strong').forEach(countUp);
    } catch (e) { /* rein optisch – Fehler nie an die Oberfläche geben */ }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(enhance); } }

  new MutationObserver(queue).observe(root, { childList: true, subtree: true });
  var nav = document.getElementById('portal-nav');
  if (nav) new MutationObserver(queue).observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-current'] });
  window.addEventListener('hashchange', queue);
  queue();
})();
