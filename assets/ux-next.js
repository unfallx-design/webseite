/* UNFALLX Bedien-Ebene: flüssige Übergänge, Dunkelmodus (auch Partner), Fahrzeugbilder im Chat,
   Drag & Drop (Pipeline-Status, Dateien, neue Schadenaufnahme), Offline-Hinweis.
   Statuswechsel laufen über die vorhandene API mit allen Server-Prüfungen. */
(function () {
  'use strict';
  var root = document.getElementById('portal-root');
  if (!root || !document.body) return;
  var body = document.body;

  var isAdmin = function () { return body.classList.contains('admin-zentrale'); };
  var isPartner = function () { return body.classList.contains('partner-workspace') || (!isAdmin() && !!document.querySelector('#portal-nav a')); };
  var motionOff = function () { return body.dataset.motion === 'off' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  var hash = function () { return (location.hash || '#start').split('?')[0]; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var P = {
    sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5',
    car: 'M5 16h14M6 16l1.5-5h9L18 16M5 16v3h3v-3M16 16v3h3v-3',
    upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
    camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    move: 'M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4',
    wifi: 'M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18',
    check: 'M5 12l5 5 9-10',
    alert: 'M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0'
  };
  function ic(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + P[n] + '"/></svg>'; }

  /* ---------- Daten ---------- */
  var cache = {};
  function get(path, fresh) {
    var hit = cache[path];
    if (!fresh && hit && (hit.p || Date.now() - hit.t < 4000)) return hit.p || Promise.resolve(hit.v);
    var p = fetch('/api/portal' + path, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (v) { cache[path] = { t: Date.now(), v: v }; return v; }, function (e) { delete cache[path]; throw e; });
    cache[path] = { p: p };
    return p;
  }
  function post(path, data) {
    return get('/me').then(function (me) {
      return fetch('/api/portal' + path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': me.csrf || '' }, body: JSON.stringify(data) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Die Änderung konnte nicht gespeichert werden.'); e.status = r.status; throw e; } return j; });
    });
  }

  /* ---------- Hinweis-Toast ---------- */
  var toastBox;
  function toast(text, tone, action) {
    if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'x-toasts'; toastBox.setAttribute('role', 'status'); toastBox.setAttribute('aria-live', 'polite'); body.appendChild(toastBox); }
    var t = document.createElement('div');
    t.className = 'x-toast' + (tone ? ' is-' + tone : '');
    t.innerHTML = ic(tone === 'error' ? 'alert' : 'check') + '<span>' + esc(text) + '</span>' + (action ? '<a href="' + esc(action[1]) + '">' + esc(action[0]) + '</a>' : '');
    toastBox.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); setTimeout(function () { t.remove(); }, 400); }, tone === 'error' ? 7000 : 4200);
  }

  /* ---------- 1) Flüssige Seitenwechsel ---------- */
  var bar = document.createElement('div');
  bar.className = 'x-progress';
  bar.setAttribute('aria-hidden', 'true');
  body.appendChild(bar);
  var leaveTimer = 0, barTimer = 0;
  function startRoute() {
    if (motionOff()) return;
    bar.classList.remove('is-done');
    bar.classList.add('is-run');
    root.classList.add('x-leaving');
    clearTimeout(leaveTimer); clearTimeout(barTimer);
    leaveTimer = setTimeout(function () { root.classList.remove('x-leaving'); }, 700);
    barTimer = setTimeout(endRoute, 8000);
  }
  function endRoute() {
    root.classList.remove('x-leaving');
    if (!bar.classList.contains('is-run')) return;
    bar.classList.add('is-done');
    setTimeout(function () { bar.classList.remove('is-run', 'is-done'); }, 450);
  }
  window.addEventListener('hashchange', function () {
    var h = hash();
    if (/^#chat\//.test(h) && root.querySelector('.ws-messenger')) return; /* Chatwechsel bleibt ruhig */
    startRoute();
  });
  new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) if (list[i].target === root && list[i].addedNodes.length) { endRoute(); return; }
  }).observe(root, { childList: true });

  /* ---------- 2) Dunkelmodus mit animiertem Wechsel ---------- */
  var THEME_KEY = 'unfallx-partner-theme';
  function storedTheme() { try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; } }
  function partnerDark() { return isPartner() && body.dataset.xTheme === 'dark'; }
  function setPartnerTheme(theme) {
    if (theme === 'dark') body.dataset.xTheme = 'dark'; else delete body.dataset.xTheme;
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* privat */ }
    paintToggle();
    queueDark();
  }
  function reveal(origin, update) {
    if (motionOff() || !document.startViewTransition) { fadeTheme(); return update(); }
    var r = origin && origin.getBoundingClientRect ? origin.getBoundingClientRect() : { left: innerWidth / 2, top: 0, width: 0, height: 0 };
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    var radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.classList.add('x-vt');
    var vt = document.startViewTransition(update);
    vt.ready.then(function () {
      document.documentElement.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] }, { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(function () {});
    var off = function () { document.documentElement.classList.remove('x-vt'); };
    vt.finished.then(off, off);
  }
  var fadeTimer = 0;
  function fadeTheme() {
    if (motionOff()) return;
    body.classList.add('x-theme-fade');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(function () { body.classList.remove('x-theme-fade'); }, 700);
  }
  var toggle = null;
  function paintToggle() {
    if (!toggle) return;
    var dark = partnerDark();
    toggle.innerHTML = ic(dark ? 'sun' : 'moon');
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Hellmodus einschalten' : 'Dunkelmodus einschalten');
    toggle.title = dark ? 'Hellmodus einschalten' : 'Dunkelmodus einschalten';
  }
  function ensurePartnerToggle() {
    if (!isPartner()) { if (toggle) { toggle.remove(); toggle = null; } if (body.dataset.xTheme) delete body.dataset.xTheme; return; }
    if (storedTheme() === 'dark' && body.dataset.xTheme !== 'dark') { body.dataset.xTheme = 'dark'; queueDark(); }
    if (toggle && toggle.isConnected) return;
    var actions = document.querySelector('.portal-top .portal-top-actions');
    if (!actions) return;
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'x-theme-toggle';
    toggle.className = 'ws-icon-button x-theme-toggle';
    toggle.addEventListener('click', function () {
      var next = partnerDark() ? 'light' : 'dark';
      reveal(toggle, function () { setPartnerTheme(next); });
    });
    var anchor = actions.querySelector('a[href="#nachrichten"], a[href="#chat"], #portal-avatar, .ws-avatar');
    actions.insertBefore(toggle, anchor || actions.firstChild);
    paintToggle();
  }
  /* Zentrale: Umschalter speichert vollständige Einstellungen (behebt den Fehler „gültige Startansicht“
     bei Konten ohne gespeicherte Einstellungen) und wechselt mit Kreis-Übergang. */
  var themeBusy = false;
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('#uz-theme-toggle');
    if (!t || !isAdmin()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (themeBusy) return;
    themeBusy = true;
    var next = body.dataset.portalTheme === 'dark' ? 'light' : 'dark';
    var save = get('/settings', true).then(function (d) {
      var p = d.preferences || {};
      var data = {};
      Object.keys(d.profile || {}).forEach(function (k) { data[k] = d.profile[k]; });
      Object.keys(p).forEach(function (k) { data[k] = p[k]; });
      data.startPage = p.startPage === 'faelle' ? 'faelle' : 'start';
      data.compact = !!p.compact;
      data.reducedMotion = !!p.reducedMotion;
      data.motion = ['full', 'calm', 'off'].indexOf(p.motion) > -1 ? p.motion : (p.reducedMotion ? 'off' : 'full');
      data.theme = next;
      return post('/settings', data);
    });
    reveal(t, function () {
      return save.then(function () {
        body.dataset.portalTheme = next;
        var dark = next === 'dark';
        t.setAttribute('aria-pressed', String(dark));
        t.setAttribute('aria-label', dark ? 'Hellmodus einschalten' : 'Dunkelmodus einschalten');
        t.title = dark ? 'Hellmodus einschalten' : 'Dunkelmodus einschalten';
      }, function (err) { toast(err.message || 'Das Farbschema konnte nicht gespeichert werden.', 'error'); });
    });
    save.then(function () { themeBusy = false; }, function () { themeBusy = false; });
  }, true);
  new MutationObserver(function () { if (!document.documentElement.classList.contains('x-vt')) fadeTheme(); }).observe(body, { attributes: true, attributeFilter: ['data-portal-theme', 'data-x-theme'] });

  /* Partner-Dunkelmodus: helle Altflächen angleichen (wie in der Zentrale) */
  var KEEP = '.ws-license-plate, .ws-license-plate *, .x-plate, .x-plate *, .ws-status, .portal-badge, .ws-count, .ws-nav-counter, img, video, canvas, svg, svg *, .btn, .x-btn-primary, .x-mix *, [type=checkbox], [type=radio], progress';
  function rgb(c) { var m = String(c).match(/[\d.]+/g); if (!m) return null; return { r: +m[0], g: +m[1], b: +m[2], a: m[3] == null ? 1 : +m[3] }; }
  function light(c) { return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255; }
  function darkPass() {
    var scopes = [root].concat([].slice.call(document.querySelectorAll('dialog[open], [role=dialog]:not([hidden])')));
    var dark = partnerDark();
    scopes.forEach(function (base) {
      if (!dark) {
        if (isPartner()) base.querySelectorAll('.x-dk-surface, .x-dk-field, .x-dk-text').forEach(function (el) { el.classList.remove('x-dk-surface', 'x-dk-field', 'x-dk-text'); });
        return;
      }
      var all = base.querySelectorAll('*'), i, el, cs, bg, lit;
      for (i = 0; i < all.length; i++) {
        el = all[i];
        if (el.classList.contains('x-dk-surface') || el.classList.contains('x-dk-field') || el.matches(KEEP)) continue;
        cs = getComputedStyle(el); bg = rgb(cs.backgroundColor);
        lit = bg && bg.a >= 0.6 && light(bg) >= 0.82;
        if (!lit && cs.backgroundImage.indexOf('gradient') > -1 && cs.backgroundImage.indexOf('url(') < 0) {
          var first = rgb(cs.backgroundImage.slice(cs.backgroundImage.indexOf('rgb')));
          lit = first && first.a >= 0.6 && light(first) >= 0.85;
        }
        if (lit) el.classList.add(/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) ? 'x-dk-field' : 'x-dk-surface');
      }
      for (i = 0; i < all.length; i++) {
        var t = all[i];
        if (t.classList.contains('x-dk-text') || t.matches(KEEP)) continue;
        var own = false;
        for (var k = 0; k < t.childNodes.length; k++) if (t.childNodes[k].nodeType === 3 && t.childNodes[k].textContent.trim()) { own = true; break; }
        if (!own) continue;
        var fg = rgb(getComputedStyle(t).color);
        if (!fg || light(fg) > 0.45) continue;
        var p = t, under = null;
        while (p && p !== document.documentElement) {
          if (p.classList.contains('x-dk-surface')) { under = 0.1; break; }
          var c = rgb(getComputedStyle(p).backgroundColor);
          if (c && c.a > 0.6) { under = light(c); break; }
          p = p.parentElement;
        }
        if (under === null) under = 0;
        if (under < 0.3 && Math.abs(light(fg) - under) < 0.45) t.classList.add('x-dk-text');
      }
    });
  }
  var darkTimer = 0;
  function queueDark() { if (!isPartner()) return; clearTimeout(darkTimer); darkTimer = setTimeout(function () { try { darkPass(); } catch (e) {} }, 160); }

  /* ---------- 3) Fahrzeugbild im Chat ---------- */
  function caseMap() {
    return get('/cases').then(function (d) { var m = {}; (d.cases || []).forEach(function (c) { m[c.id] = c; }); return m; });
  }
  var LABEL = { draft: 'Entwurf', recording: 'Aufnahme läuft', ready_to_submit: 'Bereit zum Senden', submitted: 'Eingegangen', review: 'In Prüfung', needs_info: 'Unterlagen fehlen', accepted: 'Angenommen', in_progress: 'Gutachten in Arbeit', report_ready: 'Gutachten bereit', report_sent: 'An Kanzlei versandt', closed: 'Abgeschlossen', declined: 'Abgelehnt' };
  function thumb(c, cls) {
    return '<span class="' + cls + (c && c.thumbnailFileId ? '' : ' is-empty') + '" aria-hidden="true">' + (c && c.thumbnailFileId ? '<img src="/api/portal/files/' + esc(c.thumbnailFileId) + '/thumbnail" alt="" loading="lazy" decoding="async">' : ic('car')) + '</span>';
  }
  var chatBusy = false;
  function enhanceChat() {
    if (!/^#(chat|nachrichten)/.test(hash())) return;
    var rows = root.querySelectorAll('.ws-chat-row:not([data-x-car])');
    var ctx = root.querySelector('.ws-chat-case-context:not([data-x-car])');
    if ((!rows.length && !ctx) || chatBusy) return;
    chatBusy = true;
    caseMap().then(function (map) {
      chatBusy = false;
      root.querySelectorAll('.ws-chat-row:not([data-x-car])').forEach(function (row) {
        row.dataset.xCar = '1';
        var m = (row.getAttribute('href') || '').match(/#chat\/([0-9a-f-]{36})/i), c = m && map[m[1]];
        var av = row.querySelector('.ws-chat-avatar');
        if (av) av.insertAdjacentHTML('beforebegin', thumb(c, 'x-chat-thumb'));
        row.classList.add('x-has-thumb');
        var plate = row.querySelector('.ws-license-plate');
        if (c && plate && c.intake && c.intake.vehicle) plate.insertAdjacentHTML('afterend', '<span class="x-chat-vehicle">' + esc(c.intake.vehicle) + '</span>');
      });
      var box = root.querySelector('.ws-chat-case-context:not([data-x-car])');
      if (box) {
        box.dataset.xCar = '1';
        var m2 = hash().match(/#chat\/([0-9a-f-]{36})/i), c2 = m2 && map[m2[1]];
        if (c2) {
          var photos = c2.photoCount || 0;
          box.insertAdjacentHTML('afterbegin', '<a class="x-chat-hero" href="#fall/' + esc(c2.id) + '/documents" title="Fotos & Dokumente öffnen">' + thumb(c2, 'x-chat-hero-img') +
            '<span><strong>' + esc((c2.intake && c2.intake.vehicle) || 'Schadenakte') + '</strong><small>' + esc(LABEL[c2.status] || '') + ' · ' + photos + (photos === 1 ? ' Foto' : ' Fotos') + '</small></span></a>');
        }
      }
    }).catch(function () { chatBusy = false; });
  }

  /* ---------- 4) Drag & Drop: Pipeline der Zentrale ---------- */
  var T = { draft: ['recording', 'ready_to_submit', 'submitted', 'review', 'needs_info', 'accepted', 'declined'], recording: ['draft', 'ready_to_submit', 'submitted', 'review', 'needs_info', 'accepted', 'declined'], ready_to_submit: ['recording', 'submitted', 'review', 'needs_info', 'accepted', 'declined'], submitted: ['review', 'needs_info', 'accepted', 'declined'], review: ['needs_info', 'accepted', 'declined'], needs_info: ['submitted', 'review', 'accepted'], accepted: ['in_progress', 'needs_info'], in_progress: ['needs_info', 'report_ready'], report_ready: ['in_progress', 'report_sent'], report_sent: ['closed'], closed: [], declined: [] };
  var COLUMN_TARGET = ['submitted', 'review', 'in_progress', 'report_ready', 'report_sent', 'closed'];
  var COLUMN_OF = { draft: 0, recording: 0, ready_to_submit: 0, submitted: 0, review: 1, needs_info: 1, accepted: 2, in_progress: 2, report_ready: 3, report_sent: 4, closed: 5 };
  function path(from, to) {
    if (from === to) return [];
    var queue = [[from]], seen = {}; seen[from] = 1;
    while (queue.length) {
      var p = queue.shift(), last = p[p.length - 1];
      var next = T[last] || [];
      for (var i = 0; i < next.length; i++) {
        var s = next[i];
        if (seen[s] || (s !== to && ['needs_info', 'declined', 'draft', 'recording', 'ready_to_submit'].indexOf(s) > -1)) continue;
        var np = p.concat([s]);
        if (s === to) return np.slice(1);
        seen[s] = 1; queue.push(np);
      }
    }
    return null;
  }
  var drag = null, suppressClick = 0;
  function boardColumns(board) { return [].slice.call(board.querySelectorAll('.uz-board-column')); }
  function enhanceBoard() {
    if (!isAdmin() || hash() !== '#status') return;
    var board = root.querySelector('#uz-case-board');
    if (!board || board.dataset.xDnd) return;
    board.dataset.xDnd = '1';
    board.classList.add('x-dnd-board');
    var hint = root.querySelector('#uz-case-board') && [].slice.call(root.querySelectorAll('p.ws-quiet')).filter(function (p) { return /verschieben/.test(p.textContent); })[0];
    if (hint) hint.innerHTML = ic('move') + ' Fälle per Drag &amp; Drop in eine andere Spalte ziehen. Die Prüfungen der Fallakte gelten weiter – fehlt etwas, sagt dir UNFALLX, was zu tun ist.';
    if (hint) hint.classList.add('x-dnd-hint');
    board.addEventListener('dragstart', function (e) { if (e.target.closest && e.target.closest('.uz-board-case')) e.preventDefault(); });
    board.addEventListener('pointerdown', function (e) {
      var card = e.target.closest && e.target.closest('.uz-board-case');
      if (!card || e.button > 0 || card.classList.contains('is-saving')) return;
      var start = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType };
      var timer = 0, armed = e.pointerType === 'mouse';
      if (!armed) timer = setTimeout(function () { armed = true; begin(card, e.clientX, e.clientY); }, 320);
      function move(ev) {
        if (ev.pointerId !== start.id) return;
        if (!drag) {
          if (!armed) { if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) { clearTimeout(timer); cleanup(); } return; }
          if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
          begin(card, ev.clientX, ev.clientY);
        }
        moveGhost(ev.clientX, ev.clientY);
      }
      function up(ev) {
        if (ev.pointerId !== start.id) return;
        clearTimeout(timer);
        cleanup();
        if (drag) finish(ev.clientX, ev.clientY);
      }
      function cleanup() { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
    });
  }
  document.addEventListener('touchmove', function (e) { if (drag) e.preventDefault(); }, { passive: false });
  document.addEventListener('click', function (e) { if (Date.now() < suppressClick && e.target.closest && e.target.closest('.uz-board-case')) { e.preventDefault(); e.stopPropagation(); } }, true);
  function begin(card, x, y) {
    var r = card.getBoundingClientRect(), board = card.closest('.uz-case-board');
    var ghost = card.cloneNode(true);
    ghost.classList.add('x-drag-ghost');
    ghost.removeAttribute('href');
    ghost.style.setProperty('width', r.width + 'px');
    body.appendChild(ghost);
    card.classList.add('x-drag-src');
    board.classList.add('is-dragging');
    drag = { card: card, board: board, ghost: ghost, dx: x - r.left, dy: y - r.top, lastX: x, from: boardColumns(board).indexOf(card.closest('.uz-board-column')), over: null };
    body.classList.add('x-dragging');
    moveGhost(x, y);
  }
  function moveGhost(x, y) {
    if (!drag) return;
    var vx = Math.max(-18, Math.min(18, x - drag.lastX));
    drag.lastX = x;
    drag.ghost.style.setProperty('transform', 'translate3d(' + (x - drag.dx) + 'px,' + (y - drag.dy) + 'px,0) rotate(' + (vx * 0.35).toFixed(2) + 'deg) scale(1.04)');
    drag.ghost.hidden = true;
    var el = document.elementFromPoint(x, y);
    drag.ghost.hidden = false;
    var col = el && el.closest && el.closest('.uz-board-column');
    if (col && col.closest('.uz-case-board') !== drag.board) col = null;
    if (col !== drag.over) {
      if (drag.over) drag.over.classList.remove('x-drop-target');
      drag.over = col;
      if (col) col.classList.add('x-drop-target');
    }
    var b = drag.board.getBoundingClientRect();
    if (drag.board.scrollWidth > drag.board.clientWidth) {
      if (x > b.right - 60) drag.board.scrollLeft += 14; else if (x < b.left + 60) drag.board.scrollLeft -= 14;
    }
  }
  function endDrag() {
    if (!drag) return;
    drag.ghost.remove();
    drag.card.classList.remove('x-drag-src');
    drag.board.classList.remove('is-dragging');
    if (drag.over) drag.over.classList.remove('x-drop-target');
    body.classList.remove('x-dragging');
    drag = null;
  }
  function finish() {
    var d = drag;
    suppressClick = Date.now() + 500;
    var cols = boardColumns(d.board), to = d.over ? cols.indexOf(d.over) : -1;
    var card = d.card, column = d.over;
    endDrag();
    if (to < 0 || to === d.from) return;
    var id = ((card.getAttribute('href') || '').match(/#fall\/([0-9a-f-]{36})/i) || [])[1];
    if (!id) return;
    var plate = (card.querySelector('strong') || {}).textContent || 'Fall';
    var colName = (column.querySelector('h3') && column.querySelector('h3').firstChild.textContent.trim()) || '';
    var target = COLUMN_TARGET[to];
    if (target === 'report_sent') {
      confirmBox({ title: plate + ' an die Kanzlei senden?', text: 'Der Versand an die Kanzlei wird in der Fallakte mit Empfänger und Referenz bestätigt. Dort ist alles vorbereitet.', ok: 'Fallakte öffnen', onOk: function () { location.hash = 'fall/' + id + '/processing'; } });
      return;
    }
    get('/cases/' + id, true).then(function (d2) {
      var c = d2.case, steps = path(c.status, target);
      if (!steps || !steps.length) { toast('„' + (LABEL[c.status] || c.status) + '“ kann nicht direkt nach „' + colName + '“ wechseln. Bitte in der Fallakte bearbeiten.', 'error', ['Fallakte öffnen', '#fall/' + id + '/processing']); return; }
      confirmBox({
        title: plate + ' nach „' + colName + '“ verschieben?',
        text: 'Neuer Status: ' + (LABEL[target] || target) + (steps.length > 1 ? ' (über ' + steps.slice(0, -1).map(function (s) { return LABEL[s] || s; }).join(' → ') + ')' : '') + '. Der Partner sieht den neuen Stand in seiner Fallakte.',
        note: true,
        ok: 'Verschieben',
        onOk: function (note) { applyMove(card, column, id, c.version, steps, note, plate); }
      });
    }).catch(function () { toast('Der Fall konnte nicht geladen werden. Bitte erneut versuchen.', 'error'); });
  }
  function flip(card, column) {
    var first = card.getBoundingClientRect();
    var from = card.parentElement;
    var empty = column.querySelector(':scope > p');
    if (empty) empty.remove();
    column.appendChild(card);
    if (!from.querySelector('.uz-board-case') && !from.querySelector(':scope > p')) from.insertAdjacentHTML('beforeend', '<p>Keine Fälle</p>');
    [from, column].forEach(function (col) { var n = col.querySelector('h3 span'); if (n) n.textContent = String(col.querySelectorAll('.uz-board-case').length); });
    if (motionOff()) return from;
    var last = card.getBoundingClientRect();
    card.animate([{ transform: 'translate(' + (first.left - last.left) + 'px,' + (first.top - last.top) + 'px) scale(1.03)' }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' });
    return from;
  }
  function applyMove(card, column, id, version, steps, note, plate) {
    var back = card.parentElement, next = card.nextElementSibling;
    flip(card, column);
    card.classList.add('is-saving');
    var i = 0;
    (function step(v) {
      if (i >= steps.length) {
        card.classList.remove('is-saving');
        card.classList.add('is-saved');
        setTimeout(function () { card.classList.remove('is-saved'); }, 1200);
        var label = card.querySelector('span');
        if (label) label.textContent = label.textContent.replace(/·\s*[^·]*$/, '· ' + (LABEL[steps[steps.length - 1]] || ''));
        delete cache['/cases'];
        toast(plate + ' → ' + (LABEL[steps[steps.length - 1]] || ''), 'ok');
        return;
      }
      var data = { action: 'status', status: steps[i], version: v };
      if (note && i === steps.length - 1) data.note = note;
      post('/cases/' + id, data).then(function (r) {
        i++;
        var nv = r && r.case && r.case.version;
        if (nv == null) return get('/cases/' + id, true).then(function (d) { step(d.case.version); });
        step(nv);
      }).catch(function (e) {
        card.classList.remove('is-saving');
        var col = card.parentElement;
        if (next && next.parentElement === back) back.insertBefore(card, next); else back.appendChild(card);
        [col, back].forEach(function (c) { var n = c.querySelector('h3 span'); if (n) n.textContent = String(c.querySelectorAll('.uz-board-case').length); var empty = c.querySelector(':scope > p'); if (empty && c.querySelector('.uz-board-case')) empty.remove(); });
        if (!col.querySelector('.uz-board-case') && !col.querySelector(':scope > p')) col.insertAdjacentHTML('beforeend', '<p>Keine Fälle</p>');
        if (i > 0) { delete cache['/cases']; window.dispatchEvent(new HashChangeEvent('hashchange')); }
        var needsReport = /Gutachten|PDF|report/i.test(e.message);
        toast(e.message, 'error', needsReport ? ['Gutachten hochladen', '#fall/' + id + '/documents'] : ['Fallakte öffnen', '#fall/' + id + '/processing']);
      });
    })(version);
  }

  /* Bestätigungsfenster */
  function confirmBox(o) {
    var wrap = document.createElement('div');
    wrap.className = 'x-modal';
    wrap.innerHTML = '<div class="x-modal-card" role="dialog" aria-modal="true" aria-labelledby="x-modal-title"><h3 id="x-modal-title">' + esc(o.title) + '</h3><p>' + esc(o.text) + '</p>' +
      (o.note ? '<label class="x-modal-note">Notiz für den Verlauf <span>optional</span><textarea rows="2" maxlength="500"></textarea></label>' : '') +
      '<div class="x-modal-actions"><button type="button" class="x-btn" data-x-cancel>Abbrechen</button><button type="button" class="x-btn x-btn-primary" data-x-ok>' + esc(o.ok) + '</button></div></div>';
    body.appendChild(wrap);
    var okBtn = wrap.querySelector('[data-x-ok]'), last = document.activeElement;
    function close() { wrap.classList.add('is-out'); document.removeEventListener('keydown', key, true); setTimeout(function () { wrap.remove(); if (last && last.focus) last.focus(); }, 220); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('[data-x-cancel]').onclick = close;
    okBtn.onclick = function () { var n = wrap.querySelector('textarea'); close(); o.onOk(n ? n.value.trim() : ''); };
    setTimeout(function () { okBtn.focus(); }, 30);
  }

  /* ---------- 5) Drag & Drop: Dateien ---------- */
  function hasFiles(e) { return e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') > -1; }
  function feed(input, files) {
    if (!input || !files.length || !window.DataTransfer) return false;
    try {
      var dt = new DataTransfer();
      files.forEach(function (f) { dt.items.add(f); });
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) { return false; }
  }
  function dropTarget() {
    var h = hash();
    if (/^#fall\/[0-9a-f-]{36}/i.test(h) && root.querySelector('#detail-upload-anchor [data-dropzone] input[type=file], .ws-upload-block [data-dropzone] input[type=file]')) return 'case';
    if (/^#chat\/[0-9a-f-]{36}/i.test(h) && root.querySelector('#case-message input[type=file]')) return 'chat';
    if (isPartner() && (h === '#start' || h === '#faelle' || h === '#') && document.querySelector('#portal-nav a[href="#neu"], .partner-capture a[href="#neu"]')) return 'new';
    if (isPartner() && h === '#neu' && root.querySelector('[data-wizard-files] [data-dropzone] input[type=file]')) return 'intake';
    return '';
  }
  var veil = null, depth = 0;
  function showVeil(kind) {
    if (!veil) { veil = document.createElement('div'); veil.className = 'x-dropveil'; veil.setAttribute('aria-hidden', 'true'); body.appendChild(veil); }
    var text = { case: ['Dateien hier loslassen', 'Fotos und PDFs werden der Fallakte zum Hochladen hinzugefügt.'], chat: ['An die Nachricht anhängen', 'Die Dateien werden der Nachricht an UNFALLX beigefügt.'], new: ['Neuen Schaden starten', 'Fotos loslassen – die Aufnahme öffnet sich mit deinen Bildern.'], intake: ['Zur Aufnahme hinzufügen', 'Fotos und PDFs werden dieser Schadenaufnahme hinzugefügt.'] }[kind];
    veil.innerHTML = '<div class="x-dropveil-card">' + ic(kind === 'new' ? 'camera' : 'upload') + '<strong>' + text[0] + '</strong><p>' + text[1] + '</p></div>';
    veil.classList.add('is-on');
  }
  function hideVeil() { depth = 0; if (veil) veil.classList.remove('is-on'); }
  document.addEventListener('dragenter', function (e) {
    if (!hasFiles(e)) return;
    var kind = dropTarget();
    if (!kind) return;
    if (e.target.closest && e.target.closest('[data-dropzone], [data-chat-drop]')) return;
    depth++;
    showVeil(kind);
  });
  document.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; depth--; if (depth <= 0) hideVeil(); });
  document.addEventListener('dragover', function (e) { if (veil && veil.classList.contains('is-on') && hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  document.addEventListener('drop', function (e) {
    var on = veil && veil.classList.contains('is-on');
    hideVeil();
    if (!on || !hasFiles(e)) return;
    e.preventDefault();
    var files = [].slice.call(e.dataTransfer.files || []);
    if (!files.length) return;
    var kind = dropTarget();
    if (kind === 'case') {
      var tab = root.querySelector('[data-detail-tab="documents"]');
      if (tab) tab.click();
      setTimeout(function () {
        var up = root.querySelector('.ws-media-upload'); if (up) up.setAttribute('open', '');
        var input = root.querySelector('#detail-upload-anchor [data-dropzone] input[type=file]') || root.querySelector('.ws-upload-block [data-dropzone] input[type=file]');
        if (feed(input, files)) {
          var a = document.getElementById('detail-upload-anchor'); if (a) a.scrollIntoView({ block: 'start', behavior: motionOff() ? 'auto' : 'smooth' });
          toast(files.length + (files.length === 1 ? ' Datei' : ' Dateien') + ' bereit – jetzt hochladen.', 'ok');
        }
      }, 60);
    } else if (kind === 'chat') {
      if (feed(root.querySelector('#case-message input[type=file]'), files)) toast(files.length + (files.length === 1 ? ' Anhang' : ' Anhänge') + ' hinzugefügt.', 'ok');
    } else if (kind === 'intake') {
      var form = [].slice.call(root.querySelectorAll('form')).filter(function (f) { return f.intakeWizard; })[0];
      if (form) form.intakeWizard.go(2);
      if (feed(root.querySelector('[data-wizard-files] [data-dropzone] input[type=file]'), files)) toast(files.length + (files.length === 1 ? ' Datei' : ' Dateien') + ' zur Aufnahme hinzugefügt.', 'ok');
    } else if (kind === 'new') {
      pendingIntake = files;
      location.hash = 'neu';
    }
  });
  var pendingIntake = null;
  function deliverPending() {
    if (!pendingIntake || hash() !== '#neu') return;
    var input = root.querySelector('[data-wizard-files] [data-dropzone] input[type=file]');
    var form = [].slice.call(root.querySelectorAll('form')).filter(function (f) { return f.intakeWizard; })[0];
    if (!input || !form) return;
    var files = pendingIntake; pendingIntake = null;
    form.intakeWizard.go(2);
    if (feed(input, files)) toast(files.length + (files.length === 1 ? ' Foto' : ' Fotos') + ' übernommen. Noch Kennzeichen und Bestätigung – fertig.', 'ok');
  }
  function enhanceCapture() {
    if (!isPartner()) return;
    var cap = root.querySelector('.partner-capture');
    if (cap && !cap.querySelector('.x-drop-tip')) cap.querySelector('div') && cap.querySelector('div').insertAdjacentHTML('beforeend', '<span class="x-drop-tip">' + ic('upload') + 'Tipp: Fotos einfach hierher ziehen – die Aufnahme startet sofort.</span>');
  }

  /* ---------- 6) Offline-Hinweis ---------- */
  var offline = null;
  function net() {
    if (navigator.onLine === false) {
      if (!offline) { offline = document.createElement('div'); offline.className = 'x-offline'; offline.setAttribute('role', 'status'); offline.innerHTML = ic('wifi') + '<span>Keine Internetverbindung. Änderungen und Uploads werden erst gesendet, wenn du wieder online bist.</span>'; body.appendChild(offline); }
      requestAnimationFrame(function () { offline.classList.add('is-on'); });
    } else if (offline) {
      offline.classList.remove('is-on');
    }
  }
  window.addEventListener('online', function () { net(); toast('Wieder online.', 'ok'); });
  window.addEventListener('offline', net);

  /* ---------- Steuerung ---------- */
  var queued = false;
  function run() {
    queued = false;
    try {
      body.classList.toggle('x-partner', isPartner());
      var seg = hash().replace(/^#/, '').split('/')[0] || 'start';
      if (body.dataset.xRoute !== seg) body.dataset.xRoute = seg;
      ensurePartnerToggle();
      enhanceChat();
      enhanceBoard();
      enhanceCapture();
      deliverPending();
    } catch (e) { /* rein optisch */ }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(run); } queueDark(); }
  new MutationObserver(queue).observe(root, { childList: true, subtree: true });
  var top = document.querySelector('.portal-top');
  if (top) new MutationObserver(queue).observe(top, { childList: true, subtree: true });
  new MutationObserver(queue).observe(body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('hashchange', queue);
  net();
  queue();
})();
