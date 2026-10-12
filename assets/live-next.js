/* UNFALLX Live-Ebene: neue Nachrichten in Echtzeit (Hinweis oben neben dem Tag-/Nacht-Schalter,
   Zähler, Ton, Desktop-Benachrichtigung), Einstellungen für Ansicht & Benachrichtigungen und
   Firmenprofil mit Nachweisen (PDF oder Foto). Alle Daten kommen aus der vorhandenen Portal-API. */
(function () {
  'use strict';
  var root = document.getElementById('portal-root');
  if (!root || !document.body) return;
  var body = document.body;

  var isAdmin = function () { return body.classList.contains('admin-zentrale'); };
  var isPartner = function () { return body.classList.contains('partner-workspace'); };
  var hash = function () { return (location.hash || '#start').split('?')[0]; };
  var reduced = function () { return body.dataset.motion === 'off' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var P = {
    chat: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
    car: 'M5 16h14M6 16l1.5-5h9L18 16M5 16v3h3v-3M16 16v3h3v-3',
    close: 'M6 6l12 12M18 6 6 18',
    sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5',
    auto: 'M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18',
    bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2',
    doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
    shield: 'M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    building: 'M4 21V5l8-2v18M12 8h8v13M8 8h.01M8 12h.01M8 16h.01M16 12h.01M16 16h.01',
    award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12M8.5 14 7 21l5-3 5 3-1.5-7',
    folder: 'M3 6h7l2 2h9v11H3z',
    upload: 'M12 16V5M7 10l5-5 5 5M5 19h14',
    check: 'M5 12l5 5 9-10',
    edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
    pdf: 'M7 3h7l5 5v13H7zM14 3v5h5',
    arrow: 'M5 12h14M13 6l6 6-6 6'
  };
  function ic(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + P[n] + '"/></svg>'; }
  function toast(text, tone, action) { if (window.UnfallxUX) window.UnfallxUX.toast(text, tone, action); }
  function store(key, fallback) { try { var v = localStorage.getItem(key); return v == null ? fallback : v; } catch (e) { return fallback; } }
  function keep(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* privat */ } }

  /* ---------- API ---------- */
  var meP = null;
  function me() {
    if (!meP) meP = getJSON('/me').catch(function (e) { meP = null; throw e; });
    return meP;
  }
  function getJSON(path) {
    return fetch('/api/portal' + path, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Die Daten konnten nicht geladen werden.'); e.status = r.status; throw e; } return j; });
    });
  }
  function send(path, init) {
    return me().then(function (m) {
      init.headers = init.headers || {};
      init.headers['X-CSRF-Token'] = m.csrf || '';
      init.headers.Accept = 'application/json';
      init.credentials = 'same-origin';
      init.cache = 'no-store';
      return fetch('/api/portal' + path, init);
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Die Änderung konnte nicht gespeichert werden.'); e.status = r.status; throw e; } return j; });
    });
  }
  function postJSON(path, data) { return send(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }

  /* ---------- Einstellungen auf diesem Gerät ---------- */
  var NKEY = 'unfallx-notify-v1';
  var NDEF = { popup: true, sound: true, desktop: false, title: true };
  function prefs() {
    var p = {};
    try { p = JSON.parse(store(NKEY, '{}')) || {}; } catch (e) { p = {}; }
    var o = {};
    Object.keys(NDEF).forEach(function (k) { o[k] = typeof p[k] === 'boolean' ? p[k] : NDEF[k]; });
    return o;
  }
  function setPref(k, v) { var p = prefs(); p[k] = v; keep(NKEY, JSON.stringify(p)); }
  var MOTION_KEY = 'unfallx-partner-motion', START_KEY = 'unfallx-partner-start';

  /* Startansicht für Partner: vor dem ersten Laden der Seite umleiten */
  if (/^\/portal\/?$/.test(location.pathname) && !location.hash) {
    var startAt = store(START_KEY, '');
    if (startAt === 'faelle' || startAt === 'neu') history.replaceState(null, '', location.pathname + location.search + '#' + startAt);
  }
  function applyMotion() {
    if (!isPartner()) return;
    var m = store(MOTION_KEY, '');
    if (['full', 'calm', 'off'].indexOf(m) < 0) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) m = 'off';
    if (body.dataset.motion !== m) body.dataset.motion = m;
  }
  new MutationObserver(applyMotion).observe(body, { attributes: true, attributeFilter: ['data-motion', 'class'] });

  /* ---------- Live-Nachrichten ---------- */
  var inbox = { unread: 0, list: [], loaded: false };
  var timer = 0, stopped = false, busy = false, firstRun = true, userKey = '';
  function interval() { return document.hidden ? 45000 : 10000; }
  function schedule(ms) { clearTimeout(timer); if (!stopped) timer = setTimeout(poll, ms); }
  function openThread() { var m = hash().match(/^#chat\/([0-9a-f-]{36})/i); return m ? m[1] : ''; }
  function seenMap() { try { return JSON.parse(store('unfallx-chat-seen-v1' + userKey, '{}')) || {}; } catch (e) { return {}; } }
  function poll() {
    if (busy || stopped) return;
    if (!(isPartner() || isAdmin())) { schedule(1500); return; }
    if (navigator.onLine === false) { schedule(interval()); return; }
    busy = true;
    me().then(function (m) {
      if (m && m.user) userKey = ':' + m.user.id;
      return fetch('/api/portal/chat/inbox', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    }).then(function (r) {
      if (r.status === 401) { stopped = true; return null; }
      if (r.status === 403) { schedule(300000); return null; }
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }).then(function (d) {
      busy = false;
      if (!d) return;
      handle(d);
      schedule(interval());
    }).catch(function () { busy = false; schedule(60000); });
  }
  function handle(d) {
    var list = Array.isArray(d.messages) ? d.messages : [];
    inbox.list = list;
    inbox.unread = Number(d.unreadCount) || 0;
    inbox.loaded = true;
    var seen = seenMap(), fresh = [], changed = false, open = openThread();
    list.forEach(function (m) {
      if (seen[m.caseId] === m.id) return;
      if (m.unread > 0 && !(m.caseId === open && !document.hidden)) fresh.push(m);
      seen[m.caseId] = m.id;
      changed = true;
    });
    if (changed) keep('unfallx-chat-seen-v1' + userKey, JSON.stringify(seen));
    paintAll();
    if (pop && pop.isConnected) renderPop();
    if (fresh.length) notify(fresh, firstRun);
    firstRun = false;
  }
  function paintAll() { paintButton(); paintCounters(); paintTitle(); }

  /* Chat-Knopf oben mit Zähler */
  function chatButton() { return document.querySelector('.portal-top .portal-top-actions a.ws-icon-button[href="#chat"], .portal-top .portal-top-actions a[href="#nachrichten"]'); }
  function paintButton() {
    var btn = chatButton();
    if (!btn) return;
    if (!btn.classList.contains('x-msg-btn')) {
      btn.classList.add('x-msg-btn');
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-expanded', 'false');
      btn.title = 'Nachrichten';
    }
    var badge = btn.querySelector('.x-msg-badge');
    if (!badge) { badge = document.createElement('b'); badge.className = 'x-msg-badge'; badge.setAttribute('aria-hidden', 'true'); btn.appendChild(badge); }
    var n = inbox.unread, text = n > 99 ? '99+' : String(n);
    if (badge.textContent !== text) badge.textContent = text;
    badge.hidden = n < 1;
    var label = n > 0 ? 'Nachrichten öffnen – ' + (n === 1 ? '1 ungelesene Nachricht' : n + ' ungelesene Nachrichten') : 'Nachrichten öffnen';
    if (btn.getAttribute('aria-label') !== label) btn.setAttribute('aria-label', label);
  }
  function paintCounters() {
    if (!inbox.loaded) return;
    ['#portal-nav', '#portal-mobile-nav'].forEach(function (sel) {
      var a = document.querySelector(sel + ' a[href="#chat"]');
      if (!a) return;
      var b = a.querySelector('[data-nav-count=chat]'), n = inbox.unread;
      if (!b && n > 0) { b = document.createElement('b'); b.className = 'ws-nav-counter'; b.dataset.navCount = 'chat'; a.appendChild(b); }
      if (!b) return;
      var text = n > 99 ? '99+' : String(n);
      if (n > 0) {
        if (b.hidden) b.hidden = false;
        if (b.textContent !== text) b.textContent = text;
        var label = n === 1 ? '1 ungelesene Nachricht' : n + ' ungelesene Nachrichten';
        if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
      } else if (!b.hidden) b.hidden = true;
    });
  }
  function paintTitle() {
    var plain = document.title.replace(/^\(\d+\+?\)\s/, '');
    var n = prefs().title ? inbox.unread : 0;
    var want = n > 0 ? '(' + (n > 99 ? '99+' : n) + ') ' + plain : plain;
    if (document.title !== want) document.title = want;
  }
  var titleEl = document.querySelector('head title');
  if (titleEl) new MutationObserver(paintTitle).observe(titleEl, { childList: true, characterData: true, subtree: true });

  /* Zeitangaben */
  function ago(iso) {
    var t = Date.parse(iso);
    if (!t) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'gerade eben';
    if (s < 3600) return 'vor ' + Math.floor(s / 60) + ' Min.';
    if (s < 86400) return 'vor ' + Math.floor(s / 3600) + ' Std.';
    var d = new Date(t);
    if (s < 172800) return 'gestern';
    return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.';
  }
  function who(m, name) { return m.actor && name && m.actor === name ? 'Du' : (m.actor || 'UNFALLX'); }
  function mine(m) { return !!(m.actor && myName && m.actor === myName); }
  function unreadText(n) { return n === 1 ? '1 ungelesene Nachricht' : n + ' ungelesene Nachrichten'; }
  function headline(m) { return (mine(m) ? unreadText(m.unread || 1) : who(m, myName)) + (m.vehicle ? ' · ' + m.vehicle : ''); }
  function summary(m) { return mine(m) ? 'Öffne den Chat, um alles zu lesen.' : (excerpt(m) || 'Neue Nachricht'); }
  function excerpt(m) {
    var t = String(m.note || '').replace(/\s+/g, ' ').trim();
    if (!t && m.attachmentCount) t = m.attachmentCount === 1 ? 'Anhang gesendet' : m.attachmentCount + ' Anhänge gesendet';
    return t.length > 120 ? t.slice(0, 117) + ' …' : t;
  }

  /* Fahrzeugbilder für die Liste */
  var thumbs = null, thumbsAt = 0;
  function loadThumbs() {
    if (thumbs && Date.now() - thumbsAt < 60000) return Promise.resolve(thumbs);
    return getJSON('/cases').then(function (d) {
      var map = {};
      (d.cases || []).forEach(function (c) { map[c.id] = c.thumbnailFileId || ''; });
      thumbs = map; thumbsAt = Date.now();
      return map;
    }).catch(function () { return thumbs || {}; });
  }
  function thumb(caseId, cls) {
    var f = thumbs && thumbs[caseId];
    return '<span class="' + cls + (f ? '' : ' is-empty') + '" aria-hidden="true">' + (f ? '<img src="/api/portal/files/' + esc(f) + '/thumbnail" alt="" loading="lazy" decoding="async">' : ic('car')) + '</span>';
  }

  /* Nachrichten-Fenster unter dem Chat-Knopf */
  var pop = null, myName = '';
  me().then(function (m) { myName = (m && m.user && m.user.name) || ''; }).catch(function () {});
  function place(el) {
    var btn = chatButton();
    var r = btn ? btn.getBoundingClientRect() : null;
    if (!r || !r.width) { var bar = document.querySelector('.portal-top'); var b = bar ? bar.getBoundingClientRect() : null; r = { bottom: b && b.height ? b.bottom : 64, right: innerWidth - 12 }; }
    var narrow = innerWidth < 560;
    el.style.setProperty('top', Math.round(r.bottom + 10) + 'px');
    if (narrow) { el.style.setProperty('left', '10px'); el.style.setProperty('right', '10px'); }
    else { el.style.setProperty('right', Math.max(10, Math.round(innerWidth - r.right - 8)) + 'px'); el.style.removeProperty('left'); }
  }
  function renderPop() {
    if (!pop) return;
    var list = inbox.list.slice(0, 6), n = inbox.unread;
    var rows = list.map(function (m) {
      return '<li><a href="#chat/' + esc(m.caseId) + '"' + (m.unread ? ' class="is-unread"' : '') + '>' + thumb(m.caseId, 'x-msg-thumb') +
        '<span class="x-msg-body"><span class="x-msg-top"><b class="x-msg-plate">' + esc(m.plate || m.caseNumber) + '</b><em>' + esc(m.vehicle) + '</em><time datetime="' + esc(m.at) + '">' + esc(ago(m.at)) + '</time></span>' +
        '<span class="x-msg-text"><b>' + esc(who(m, myName)) + ':</b> ' + esc(excerpt(m) || 'Neue Nachricht') + '</span></span>' +
        (m.unread ? '<i class="x-msg-count" aria-label="' + m.unread + ' ungelesen">' + m.unread + '</i>' : '') + '</a></li>';
    }).join('');
    pop.innerHTML = '<header><span class="x-msg-pop-icon">' + ic('chat') + '</span><div><strong>Nachrichten</strong><small>' + (n ? (n === 1 ? '1 ungelesene Nachricht' : n + ' ungelesene Nachrichten') : 'Alles gelesen') + '</small></div><a href="#chat" class="x-msg-all">Alle Chats ' + ic('arrow') + '</a></header>' +
      (rows ? '<ul>' + rows + '</ul>' : '<p class="x-msg-empty">' + ic('chat') + '<span>Noch keine Nachrichten. Sobald jemand schreibt, erscheint es hier – ohne Neuladen.</span></p>') +
      '<footer><span class="x-live-dot"><i></i>Live</span><a href="#einstellungen" class="x-msg-settings">' + ic('bell') + ' Benachrichtigungen einstellen</a></footer>';
    place(pop);
  }
  function openPop() {
    closeAlert();
    if (!pop) {
      pop = document.createElement('div');
      pop.className = 'x-msg-pop';
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-label', 'Nachrichten');
      pop.addEventListener('click', function (e) { if (e.target.closest('a')) closePop(); });
    }
    body.appendChild(pop);
    renderPop();
    requestAnimationFrame(function () { pop.classList.add('is-on'); });
    var btn = chatButton();
    if (btn) btn.setAttribute('aria-expanded', 'true');
    loadThumbs().then(function () { if (pop && pop.isConnected) renderPop(); });
    if (!busy) poll();
  }
  function closePop() {
    if (!pop || !pop.isConnected) return;
    var el = pop;
    el.classList.remove('is-on');
    var btn = chatButton();
    if (btn) btn.setAttribute('aria-expanded', 'false');
    setTimeout(function () { if (!el.classList.contains('is-on')) el.remove(); }, 220);
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.x-msg-btn');
    if (btn) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
      e.preventDefault();
      if (pop && pop.isConnected && pop.classList.contains('is-on')) closePop(); else openPop();
      return;
    }
    if (pop && pop.isConnected && !pop.contains(e.target)) closePop();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closePop(); closeAlert(); } });
  window.addEventListener('resize', function () { if (pop && pop.isConnected) place(pop); if (alertBox && alertBox.isConnected) place(alertBox); });
  window.addEventListener('hashchange', function () {
    closePop();
    if (/^#chat\//.test(hash())) { closeAlert(); setTimeout(function () { if (!busy) poll(); }, 2500); }
  });

  /* Live-Hinweis bei neuer Nachricht */
  var alertBox = null, alertTimer = 0;
  function closeAlert() {
    clearTimeout(alertTimer);
    if (!alertBox || !alertBox.isConnected) return;
    var el = alertBox;
    el.classList.remove('is-on');
    setTimeout(function () { if (!el.classList.contains('is-on')) el.remove(); }, 260);
  }
  function showAlert(m, more, test) {
    if (!alertBox) {
      alertBox = document.createElement('div');
      alertBox.className = 'x-msg-alert';
      alertBox.setAttribute('role', 'status');
      alertBox.setAttribute('aria-live', 'polite');
      alertBox.addEventListener('mouseenter', function () { clearTimeout(alertTimer); });
      alertBox.addEventListener('mouseleave', function () { armAlert(); });
      alertBox.addEventListener('click', function (e) {
        if (e.target.closest('[data-close]')) { e.preventDefault(); closeAlert(); return; }
        if (e.target.closest('a')) closeAlert();
      });
    }
    var href = test ? '#chat' : '#chat/' + m.caseId;
    alertBox.innerHTML = thumb(test ? '' : m.caseId, 'x-msg-alert-img') +
      '<div class="x-msg-alert-body"><span class="x-msg-alert-eyebrow"><i></i>' + (test ? 'Test-Hinweis' : 'Neue Nachricht') + (m.plate ? ' · <b>' + esc(m.plate) + '</b>' : '') + '</span>' +
      '<strong>' + esc(test ? 'So erscheinen neue Nachrichten' : headline(m)) + '</strong>' +
      '<p>' + esc(test ? 'Der Hinweis kommt live oben neben dem Tag-/Nacht-Schalter – ohne Neuladen.' : summary(m)) + '</p>' +
      '<div class="x-msg-alert-actions"><a class="x-msg-reply" href="' + href + '">' + ic('chat') + (test ? 'Zum Chat' : 'Antworten') + '</a>' + (more > 0 ? '<a class="x-msg-more" href="#chat">+' + more + ' weitere</a>' : '') + '</div></div>' +
      '<button type="button" class="x-msg-alert-close" data-close aria-label="Hinweis schließen">' + ic('close') + '</button>';
    body.appendChild(alertBox);
    place(alertBox);
    alertBox.classList.remove('is-on');
    void alertBox.offsetWidth;
    alertBox.classList.add('is-on');
    armAlert();
  }
  function armAlert() { clearTimeout(alertTimer); alertTimer = setTimeout(closeAlert, 10000); }
  function ring() {
    var btn = chatButton();
    if (!btn || reduced()) return;
    btn.classList.remove('x-ring');
    void btn.offsetWidth;
    btn.classList.add('x-ring');
    setTimeout(function () { btn.classList.remove('x-ring'); }, 1300);
  }

  /* Ton – leise, ohne Datei */
  var audio = null;
  function unlockAudio() {
    if (audio) { if (audio.state === 'suspended') audio.resume().catch(function () {}); return; }
    try { var C = window.AudioContext || window.webkitAudioContext; if (C) audio = new C(); } catch (e) { audio = null; }
  }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('keydown', unlockAudio, true);
  function chime() {
    if (!audio || audio.state !== 'running') return;
    try {
      var t = audio.currentTime;
      [[784, 0], [1175, 0.13]].forEach(function (n) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t + n[1]);
        g.gain.exponentialRampToValueAtTime(0.09, t + n[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + n[1] + 0.38);
        o.connect(g); g.connect(audio.destination);
        o.start(t + n[1]); o.stop(t + n[1] + 0.42);
      });
    } catch (e) { /* ohne Ton */ }
  }
  function desktop(m, count) {
    if (!prefs().desktop || !('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
    try {
      var n = new Notification(count > 1 ? count + ' neue Nachrichten · UNFALLX' : 'Neue Nachricht · ' + (m.plate || m.caseNumber || 'UNFALLX'), { body: mine(m) ? headline(m) : who(m, myName) + ': ' + (excerpt(m) || 'Neue Nachricht'), tag: 'unfallx-chat', icon: '/assets/logo-mark.svg' });
      n.onclick = function () { try { window.focus(); } catch (e) {} location.hash = 'chat/' + m.caseId; n.close(); };
    } catch (e) { /* Browser ohne Benachrichtigungen */ }
  }
  function notify(fresh, initial) {
    var p = prefs(), m = fresh[0];
    ring();
    if (p.popup) {
      if (pop && pop.isConnected && pop.classList.contains('is-on')) renderPop();
      else loadThumbs().then(function () { showAlert(m, fresh.length - 1, false); });
    }
    if (p.sound && !initial) chime();
    desktop(m, fresh.length);
  }

  document.addEventListener('visibilitychange', function () { if (!document.hidden) { if (!busy) poll(); } else schedule(interval()); });
  window.addEventListener('online', function () { if (!busy) poll(); });

  /* ---------- Einstellungen: Ansicht & Benachrichtigungen ---------- */
  function seg(name, label, options, current) {
    return '<div class="x-pref"><span class="x-pref-label" id="x-pref-' + name + '">' + label + '</span><div class="x-seg" role="radiogroup" aria-labelledby="x-pref-' + name + '" data-pref="' + name + '">' +
      options.map(function (o) { var on = o[0] === current; return '<button type="button" role="radio" aria-checked="' + on + '" data-v="' + o[0] + '">' + (o[2] ? ic(o[2]) : '') + '<span>' + o[1] + '</span></button>'; }).join('') + '</div></div>';
  }
  function sw(key, title, text, on) {
    return '<label class="x-switch"><input type="checkbox" data-n="' + key + '"' + (on ? ' checked' : '') + '><span class="x-switch-ui" aria-hidden="true"></span><span class="x-switch-text"><strong>' + title + '</strong><small' + (key === 'desktop' ? ' data-desktop-state' : '') + '>' + text + '</small></span></label>';
  }
  function desktopText() {
    if (!('Notification' in window)) return 'Dieser Browser unterstützt keine Desktop-Benachrichtigungen.';
    if (Notification.permission === 'denied') return 'Im Browser blockiert – bitte in den Website-Einstellungen erlauben.';
    return 'Auch wenn das Portal nur im Hintergrund geöffnet ist.';
  }
  function prefsHTML() {
    var p = prefs(), partner = isPartner();
    var view = partner ? '<div class="x-prefs-group"><h3>Darstellung</h3>' +
      seg('theme', 'Farbschema', [['light', 'Hell', 'sun'], ['dark', 'Dunkel', 'moon'], ['system', 'Automatisch', 'auto']], window.UnfallxUX ? window.UnfallxUX.theme() : 'light') +
      seg('motion', 'Animationen', [['full', 'Voll'], ['calm', 'Ruhig'], ['off', 'Aus']], store(MOTION_KEY, '') || (body.dataset.motion === 'off' ? 'off' : body.dataset.motion === 'calm' ? 'calm' : 'full')) +
      seg('start', 'Beim Öffnen starten mit', [['start', 'Übersicht'], ['faelle', 'Meine Fälle'], ['neu', 'Schaden übermitteln']], store(START_KEY, 'start')) +
      '</div>' : '';
    return '<div class="x-prefs-head"><span class="x-prefs-icon">' + ic(partner ? 'gear' : 'bell') + '</span><div><h2>' + (partner ? 'Ansicht &amp; Benachrichtigungen' : 'Benachrichtigungen') + '</h2>' +
      '<p>' + (partner ? 'Lege fest, wie dein Portal aussieht und wie du über neue Nachrichten informiert wirst.' : 'Neue Nachrichten erscheinen live oben neben dem Tag-/Nacht-Schalter – ohne Neuladen.') + ' Gilt sofort auf diesem Gerät.</p></div></div>' +
      '<div class="x-prefs-grid' + (partner ? '' : ' is-single') + '">' + view +
      '<div class="x-prefs-group"><h3>Neue Nachrichten</h3>' +
      sw('popup', 'Hinweis oben einblenden', 'Erscheint neben dem Tag-/Nacht-Schalter, sobald jemand schreibt.', p.popup) +
      sw('sound', 'Ton abspielen', 'Kurzer, leiser Signalton bei neuen Nachrichten.', p.sound) +
      sw('desktop', 'Desktop-Benachrichtigung', desktopText(), p.desktop && 'Notification' in window && Notification.permission === 'granted') +
      sw('title', 'Zähler im Browser-Tab', 'Zeigt ungelesene Nachrichten im Tab-Titel, z. B. „(2) UNFALLX“.', p.title) +
      '<div class="x-prefs-actions"><button type="button" class="x-btn" data-test>' + ic('bell') + 'Test-Hinweis anzeigen</button><span class="x-live-dot"><i></i>Live · prüft laufend auf neue Nachrichten</span></div>' +
      '</div></div>';
  }
  function bindPrefs(card) {
    card.addEventListener('click', function (e) {
      var b = e.target.closest('.x-seg button');
      if (b) {
        var group = b.parentElement, v = b.dataset.v, name = group.dataset.pref;
        group.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
        if (name === 'theme' && window.UnfallxUX) { window.UnfallxUX.setTheme(v, b); toast(v === 'system' ? 'Farbschema folgt jetzt deinem Gerät.' : v === 'dark' ? 'Dunkelmodus aktiviert.' : 'Hellmodus aktiviert.', 'ok'); }
        if (name === 'motion') { keep(MOTION_KEY, v); applyMotion(); toast(v === 'off' ? 'Animationen ausgeschaltet.' : v === 'calm' ? 'Ruhige Animationen aktiviert.' : 'Alle Animationen aktiviert.', 'ok'); }
        if (name === 'start') { keep(START_KEY, v); toast('Gespeichert – beim nächsten Öffnen startest du mit „' + b.textContent.trim() + '“.', 'ok'); }
        return;
      }
      if (e.target.closest('[data-test]')) {
        var p = prefs();
        ring();
        showAlert({ plate: '', vehicle: '', caseId: '' }, 0, true);
        unlockAudio();
        if (p.sound) setTimeout(chime, 60);
      }
    });
    card.addEventListener('change', function (e) {
      var input = e.target.closest('input[data-n]');
      if (!input) return;
      var key = input.dataset.n, on = input.checked;
      if (key === 'desktop' && on) {
        var state = card.querySelector('[data-desktop-state]');
        if (!('Notification' in window)) { input.checked = false; return; }
        if (Notification.permission === 'granted') { setPref('desktop', true); toast('Desktop-Benachrichtigungen aktiviert.', 'ok'); return; }
        if (Notification.permission === 'denied') { input.checked = false; if (state) state.textContent = desktopText(); toast('Desktop-Benachrichtigungen sind im Browser blockiert.', 'error'); return; }
        Promise.resolve(Notification.requestPermission()).then(function (res) {
          var ok = res === 'granted';
          input.checked = ok;
          setPref('desktop', ok);
          if (state) state.textContent = desktopText();
          toast(ok ? 'Desktop-Benachrichtigungen aktiviert.' : 'Desktop-Benachrichtigungen wurden nicht erlaubt.', ok ? 'ok' : 'error');
        }).catch(function () { input.checked = false; });
        return;
      }
      setPref(key, on);
      if (key === 'title') paintTitle();
      if (key === 'sound' && on) { unlockAudio(); setTimeout(chime, 60); }
      toast('Gespeichert.', 'ok');
    });
  }
  function enhanceSettings() {
    if (hash() !== '#einstellungen' || root.querySelector('.x-prefs')) return;
    var form = root.querySelector('#settings-form');
    if (!form) return;
    var top = form;
    while (top.parentElement && top.parentElement !== root) top = top.parentElement;
    if (top.parentElement !== root) return;
    var card = document.createElement('section');
    card.className = 'portal-card x-prefs';
    card.innerHTML = prefsHTML();
    root.insertBefore(card, top);
    bindPrefs(card);
    var link = root.querySelector('.partner-account-links a[href="#firma"]');
    if (link) {
      for (var i = 0; i < link.childNodes.length; i++) {
        var nd = link.childNodes[i];
        if (nd.nodeType === 3 && /Firmendaten/.test(nd.textContent)) nd.textContent = 'Firmenprofil & Nachweise';
      }
    }
  }

  /* ---------- Firmenprofil: Daten bearbeiten & Nachweise hochladen ---------- */
  var SLOTS = [
    { key: 'gewerbe', title: 'Gewerbeanmeldung', text: 'Gewerbeschein bzw. Gewerbeanmeldung deines Betriebs.', cat: 'business_registration', tag: 'Empfohlen', icon: 'building', match: /gewerbe/i },
    { key: 'steuer', title: 'Steuernummer', text: 'Schreiben vom Finanzamt, auf dem deine Steuernummer steht.', cat: 'other', tag: 'Empfohlen', icon: 'receipt', match: /steuernummer|finanzamt/i },
    { key: 'ust', title: 'USt-IdNr.', text: 'Bestätigung deiner Umsatzsteuer-Identifikationsnummer – falls vorhanden.', cat: 'other', tag: 'Optional', icon: 'doc', match: /ust-?id|umsatzsteuer/i },
    { key: 'register', title: 'Handelsregisterauszug', text: 'Nur nötig, wenn dein Betrieb im Handelsregister eingetragen ist.', cat: 'business_registration', tag: 'Optional', icon: 'folder', match: /handelsregister/i },
    { key: 'versicherung', title: 'Betriebshaftpflicht', text: 'Versicherungsnachweis deines Betriebs.', cat: 'certificate', tag: 'Optional', icon: 'shield', match: /haftpflicht|versicherung/i },
    { key: 'weitere', title: 'Weitere Nachweise', text: 'Zum Beispiel Meisterbrief, Zertifikate oder Vollmachten.', cat: 'certificate', tag: 'Optional', icon: 'award', match: /^weitere nachweise|zertifikat|meisterbrief/i }
  ];
  function slotOf(doc) {
    var name = String(doc.name || '');
    for (var i = 0; i < SLOTS.length; i++) if (name.toLowerCase().indexOf(SLOTS[i].title.toLowerCase()) === 0) return SLOTS[i].key;
    for (var j = 0; j < SLOTS.length; j++) if (SLOTS[j].match.test(name)) return SLOTS[j].key;
    return '';
  }
  function shortName(name, title) { var n = String(name || ''); return n.toLowerCase().indexOf(title.toLowerCase() + ' - ') === 0 ? n.slice(title.length + 3) : n; }
  function day(iso) { var d = new Date(iso); return isNaN(d) ? '' : String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); }
  function slotHTML(s) {
    return '<article class="x-slot" data-slot="' + s.key + '" data-state="empty"><div class="x-slot-top"><span class="x-slot-icon">' + ic(s.icon) + '</span><span class="x-slot-tag' + (s.tag === 'Empfohlen' ? ' is-key' : '') + '">' + s.tag + '</span><span class="x-slot-ok" aria-hidden="true">' + ic('check') + '</span></div>' +
      '<h3>' + s.title + '</h3><p>' + s.text + '</p><ul class="x-slot-files"></ul>' +
      '<label class="x-slot-btn"><input type="file" accept="application/pdf,.pdf,image/jpeg,image/png,image/webp" multiple>' + ic('upload') + '<span>PDF oder Foto hochladen</span></label>' +
      '<p class="x-slot-status" role="status" aria-live="polite"></p></article>';
  }
  function docsCardHTML() {
    return '<div class="x-firm-head"><div><span class="x-firm-eyebrow">Firmenprofil · Nachweise</span><h2>Unterlagen deines Betriebs</h2>' +
      '<p>Lade Gewerbeanmeldung, Steuernummer und weitere Nachweise hoch – als PDF oder einfach als Foto. Fotos werden automatisch in ein PDF umgewandelt. Nur dein Betrieb und UNFALLX sehen diese Dateien.</p></div>' +
      '<div class="x-firm-ring" aria-live="polite"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19"/><circle class="x-firm-ring-fill" cx="22" cy="22" r="19"/></svg><span><b>0</b>/2</span><small>empfohlen</small></div></div>' +
      '<div class="x-firm-grid">' + SLOTS.map(slotHTML).join('') + '</div>' +
      '<p class="x-firm-foot">' + ic('shield') + '<span>PDF bis 6 MB oder Fotos (JPG, PNG). Alle Dateien findest du zusätzlich unter <a href="#dokumente">Firmenunterlagen</a>.</span></p>';
  }
  function paintDocs(card, docs) {
    var by = {};
    docs.forEach(function (d) { var k = slotOf(d); if (k) (by[k] = by[k] || []).push(d); });
    var keyDone = 0;
    SLOTS.forEach(function (s) {
      var tile = card.querySelector('[data-slot="' + s.key + '"]');
      if (!tile) return;
      var list = by[s.key] || [];
      if (tile.dataset.state !== 'busy') tile.dataset.state = list.length ? 'done' : 'empty';
      if (list.length && s.tag === 'Empfohlen') keyDone++;
      tile.querySelector('.x-slot-files').innerHTML = list.slice(0, 3).map(function (d) {
        return '<li><a href="/api/portal/documents/' + esc(d.id) + '" target="_blank" rel="noopener">' + ic('pdf') + '<span>' + esc(shortName(d.name, s.title)) + '</span></a><small>' + esc(day(d.at)) + '</small></li>';
      }).join('') + (list.length > 3 ? '<li class="x-slot-more"><a href="#dokumente">+' + (list.length - 3) + ' weitere</a></li>' : '');
      var label = tile.querySelector('.x-slot-btn span');
      if (label) label.textContent = list.length ? 'Weitere Datei hinzufügen' : 'PDF oder Foto hochladen';
    });
    var ring = card.querySelector('.x-firm-ring');
    if (ring) {
      ring.querySelector('b').textContent = String(keyDone);
      ring.style.setProperty('--x-p', String(keyDone / 2));
      ring.classList.toggle('is-done', keyDone >= 2);
    }
  }
  function loadDocs(card) {
    return getJSON('/documents').then(function (d) { paintDocs(card, (d.documents || []).filter(function (x) { return !x.archivedAt; })); }).catch(function () {
      card.querySelectorAll('.x-slot-status').forEach(function (p) { p.textContent = 'Die Unterlagen konnten gerade nicht geladen werden.'; });
    });
  }

  /* Fotos in ein PDF umwandeln (ohne externe Bibliothek) */
  function readImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 2400, s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          if (!b) return reject(new Error('Das Foto konnte nicht umgewandelt werden.'));
          b.arrayBuffer().then(function (buf) { resolve({ jpg: new Uint8Array(buf), w: w, h: h }); }, reject);
        }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Dieses Bildformat kann der Browser nicht lesen. Bitte als JPG, PNG oder PDF hochladen.')); };
      img.src = url;
    });
  }
  function imagesToPdf(pages) {
    var enc = new TextEncoder(), chunks = [], size = 0, offsets = [];
    function add(x) { var b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); size += b.length; }
    function obj(n, head, stream) {
      offsets[n] = size;
      add(n + ' 0 obj\n' + head);
      if (stream) { add('\nstream\n'); add(stream); add('\nendstream'); }
      add('\nendobj\n');
    }
    add('%PDF-1.4\n');
    var kids = [], n = pages.length;
    for (var i = 0; i < n; i++) kids.push((3 + i * 3) + ' 0 R');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>');
    pages.forEach(function (p, i) {
      var pid = 3 + i * 3, iid = pid + 1, cid = pid + 2;
      var landscape = p.w > p.h, pw = landscape ? 841.89 : 595.28, ph = landscape ? 595.28 : 841.89, m = 24;
      var sc = Math.min((pw - 2 * m) / p.w, (ph - 2 * m) / p.h), dw = p.w * sc, dh = p.h * sc;
      var content = 'q ' + dw.toFixed(2) + ' 0 0 ' + dh.toFixed(2) + ' ' + ((pw - dw) / 2).toFixed(2) + ' ' + ((ph - dh) / 2).toFixed(2) + ' cm /Im0 Do Q';
      obj(pid, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 ' + iid + ' 0 R >> >> /Contents ' + cid + ' 0 R >>');
      obj(iid, '<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpg.length + ' >>', p.jpg);
      obj(cid, '<< /Length ' + enc.encode(content).length + ' >>', enc.encode(content));
    });
    var total = 3 + n * 3, xref = size;
    var table = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (var k = 1; k < total; k++) table += String(offsets[k]).padStart(10, '0') + ' 00000 n \n';
    add(table + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(chunks, { type: 'application/pdf' });
  }
  function base(name) { return String(name || 'Dokument').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[\/\\"<>]/g, ' ').trim().slice(0, 90) || 'Dokument'; }
  function uploadPdf(blob, name, cat) {
    if (blob.size > 6 * 1024 * 1024) return Promise.reject(new Error('Die Datei ist größer als 6 MB. Bitte kleiner speichern oder weniger Fotos auf einmal wählen.'));
    return send('/documents', { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(name), 'X-Document-Category': cat }, body: blob });
  }
  function handleFiles(card, tile, files) {
    var s = SLOTS.filter(function (x) { return x.key === tile.dataset.slot; })[0];
    if (!s || !files.length || tile.dataset.state === 'busy') return;
    var status = tile.querySelector('.x-slot-status');
    var pdfs = files.filter(function (f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name); });
    var imgs = files.filter(function (f) { return pdfs.indexOf(f) < 0 && /^image\//.test(f.type); });
    var skipped = files.length - pdfs.length - imgs.length;
    if (!pdfs.length && !imgs.length) { status.textContent = 'Bitte eine PDF-Datei oder ein Foto (JPG, PNG) wählen.'; return; }
    var before = tile.dataset.state;
    tile.dataset.state = 'busy';
    status.textContent = imgs.length ? 'Fotos werden in ein PDF umgewandelt …' : 'Wird sicher hochgeladen …';
    var jobs = Promise.resolve(), saved = 0;
    pdfs.forEach(function (f) {
      jobs = jobs.then(function () { status.textContent = 'Wird sicher hochgeladen …'; return uploadPdf(f, s.title + ' - ' + base(f.name) + '.pdf', s.cat); }).then(function () { saved++; });
    });
    if (imgs.length) {
      jobs = jobs.then(function () {
        var pages = [], chain = Promise.resolve();
        imgs.forEach(function (f) { chain = chain.then(function () { return readImage(f).then(function (p) { pages.push(p); }); }); });
        return chain.then(function () {
          status.textContent = 'Wird sicher hochgeladen …';
          var name = s.title + ' - ' + (imgs.length === 1 ? base(imgs[0].name) : 'Fotos ' + day(new Date().toISOString())) + '.pdf';
          return uploadPdf(imagesToPdf(pages), name, s.cat);
        }).then(function () { saved++; });
      });
    }
    jobs.then(function () {
      tile.dataset.state = 'done';
      status.textContent = skipped ? skipped + ' Datei(en) übersprungen – nur PDF oder Fotos möglich.' : '';
      tile.classList.remove('x-saved'); void tile.offsetWidth; tile.classList.add('x-saved');
      toast(s.title + ' gespeichert. UNFALLX sieht die Unterlage jetzt in deinem Firmenprofil.', 'ok');
      return loadDocs(card);
    }).catch(function (err) {
      tile.dataset.state = saved ? 'done' : before;
      status.textContent = (err && err.message) || 'Das Hochladen hat nicht geklappt. Bitte erneut versuchen.';
      toast(status.textContent, 'error');
      if (saved) loadDocs(card);
    });
  }
  function bindDocs(card) {
    card.addEventListener('change', function (e) {
      var input = e.target.closest('.x-slot input[type=file]');
      if (!input) return;
      var files = [].slice.call(input.files || []);
      handleFiles(card, input.closest('.x-slot'), files);
      input.value = '';
    });
    var over = null;
    card.addEventListener('dragover', function (e) {
      var tile = e.target.closest && e.target.closest('.x-slot');
      if (!tile || !e.dataTransfer || [].indexOf.call(e.dataTransfer.types || [], 'Files') < 0) return;
      e.preventDefault(); e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      if (over !== tile) { if (over) over.classList.remove('is-over'); over = tile; tile.classList.add('is-over'); }
    });
    card.addEventListener('dragleave', function (e) { var tile = e.target.closest && e.target.closest('.x-slot'); if (tile && !tile.contains(e.relatedTarget)) { tile.classList.remove('is-over'); if (over === tile) over = null; } });
    card.addEventListener('drop', function (e) {
      var tile = e.target.closest && e.target.closest('.x-slot');
      if (!tile) return;
      e.preventDefault(); e.stopPropagation();
      tile.classList.remove('is-over'); over = null;
      handleFiles(card, tile, [].slice.call((e.dataTransfer && e.dataTransfer.files) || []));
    });
  }

  /* Firmendaten anzeigen & bearbeiten */
  var TYPES = ['Werkstatt', 'Gutachter / Fotopartner', 'Abschleppdienst', 'Sonstiges Unternehmen'];
  function maskIban(v) { v = String(v || '').replace(/\s/g, ''); return v.length > 8 ? v.slice(0, 4) + ' •••• •••• ' + v.slice(-4) : v; }
  function metaHTML(p) {
    var addr = [p.street, [p.postcode, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    var rows = [['Ansprechpartner', p.contact], ['E-Mail', p.email], ['Telefon', p.phone], ['Anschrift', addr], ['Unternehmensart', p.type], ['Steuernummer', p.taxNumber], ['USt-IdNr.', p.vatId], ['Handelsregister', p.register], ['Bankverbindung', p.iban ? (p.accountHolder ? p.accountHolder + ' · ' : '') + maskIban(p.iban) : '']];
    return rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd' + (r[1] ? '' : ' class="x-empty"') + '>' + esc(r[1] || 'Noch nicht hinterlegt') + '</dd></div>'; }).join('');
  }
  function field(name, label, value, opts) {
    opts = opts || {};
    return '<label class="x-field' + (opts.wide ? ' is-wide' : '') + '"><span>' + label + (opts.required ? '' : ' <em>optional</em>') + '</span><input name="' + name + '" type="' + (opts.type || 'text') + '" value="' + esc(value || '') + '"' + (opts.required ? ' required' : '') + ' maxlength="' + (opts.max || 180) + '"' + (opts.auto ? ' autocomplete="' + opts.auto + '"' : '') + (opts.hint ? ' placeholder="' + esc(opts.hint) + '"' : '') + '></label>';
  }
  function formHTML(p) {
    return '<form class="x-firm-form" novalidate><div class="x-firm-form-grid">' +
      field('name', 'Firmenname', p.name, { required: true, wide: true, auto: 'organization' }) +
      '<label class="x-field"><span>Unternehmensart</span><select name="type" required>' + TYPES.map(function (t) { return '<option' + (t === p.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label>' +
      field('contact', 'Ansprechpartner', p.contact, { required: true, max: 120, auto: 'name' }) +
      field('phone', 'Telefon', p.phone, { required: true, type: 'tel', max: 40, auto: 'tel' }) +
      field('street', 'Straße und Hausnummer', p.street, { required: true, auto: 'street-address' }) +
      field('postcode', 'PLZ', p.postcode, { required: true, max: 12, auto: 'postal-code' }) +
      field('city', 'Ort', p.city, { required: true, max: 100, auto: 'address-level2' }) +
      '</div><h3>Steuer &amp; Register</h3><div class="x-firm-form-grid">' +
      field('taxNumber', 'Steuernummer', p.taxNumber, { max: 40, hint: 'z. B. 12/345/67890' }) +
      field('vatId', 'USt-IdNr.', p.vatId, { max: 32, hint: 'z. B. DE123456789' }) +
      field('register', 'Handelsregister', p.register, { max: 100, wide: true, hint: 'z. B. Amtsgericht, HRB-Nummer' }) +
      '</div><details class="x-firm-bank"' + (p.iban ? ' open' : '') + '><summary>Bankverbindung für Auszahlungen</summary><div class="x-firm-form-grid">' +
      field('accountHolder', 'Kontoinhaber', p.accountHolder, { max: 180, wide: true }) +
      field('iban', 'IBAN', p.iban, { max: 50, auto: 'off' }) +
      field('bic', 'BIC', p.bic, { max: 20, auto: 'off' }) +
      '</div></details><p class="x-firm-error" role="alert" hidden></p><div class="x-firm-actions"><button type="submit" class="btn">Firmendaten speichern</button><button type="button" class="x-btn" data-cancel>Abbrechen</button><small>UNFALLX prüft geänderte Angaben kurz.</small></div></form>';
  }
  function enhanceCompany(card) {
    var dl = card.querySelector('dl.portal-meta');
    if (!dl) return;
    dl.querySelectorAll('dd').forEach(function (dd) {
      var t = dd.textContent.replace(/undefined/g, '').replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s*,\s*,/g, ',').trim();
      if (t !== dd.textContent) dd.textContent = t;
      if (!t) { dd.textContent = 'Noch nicht hinterlegt'; dd.classList.add('x-empty'); }
    });
    getJSON('/company/profile').then(function (d) {
      var p = d.profile;
      if (!p || !card.isConnected) return;
      card.dataset.xProfile = '1';
      dl.innerHTML = metaHTML(p);
      var anchor = card.querySelector('#export-data');
      var edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn x-firm-edit';
      edit.innerHTML = ic('edit') + '<span>Firmendaten bearbeiten</span>';
      if (anchor) anchor.insertAdjacentElement('beforebegin', edit); else card.appendChild(edit);
      var form = null;
      edit.addEventListener('click', function () {
        if (form) return;
        card.classList.add('is-editing');
        dl.insertAdjacentHTML('afterend', formHTML(p));
        form = dl.nextElementSibling;
        dl.hidden = true; edit.hidden = true;
        var first = form.querySelector('input');
        if (first) first.focus();
        form.querySelector('[data-cancel]').addEventListener('click', close);
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var err = form.querySelector('.x-firm-error'), btn = form.querySelector('[type=submit]');
          var missing = [].slice.call(form.querySelectorAll('[required]')).filter(function (x) { return !String(x.value).trim(); });
          if (missing.length) { err.hidden = false; err.textContent = 'Bitte noch ausfüllen: ' + missing.map(function (x) { return x.closest('label').querySelector('span').childNodes[0].textContent.trim(); }).join(', ') + '.'; missing[0].focus(); return; }
          var data = { version: p.version };
          ['name', 'type', 'contact', 'phone', 'street', 'postcode', 'city', 'taxNumber', 'vatId', 'register', 'accountHolder', 'iban', 'bic'].forEach(function (k) { var el = form.elements[k]; data[k] = el ? String(el.value).trim() : ''; });
          btn.disabled = true; err.hidden = true;
          postJSON('/company/profile', data).then(function (r) {
            p = r.profile || p;
            dl.innerHTML = metaHTML(p);
            var h = card.querySelector('h2');
            if (h && p.name) h.textContent = p.name;
            close();
            toast(r.message || 'Firmendaten gespeichert.', 'ok');
          }).catch(function (x) { btn.disabled = false; err.hidden = false; err.textContent = x.message; });
        });
      });
      function close() { if (form) form.remove(); form = null; dl.hidden = false; edit.hidden = false; card.classList.remove('is-editing'); }
    }).catch(function () { /* Ansicht bleibt wie vom Portal geliefert */ });
  }
  function enhanceFirma() {
    if (!isPartner()) return;
    var route = hash();
    if (route === '#dokumente' && !root.querySelector('.x-firm-link')) {
      var head = root.querySelector('.ws-page-heading');
      if (head) head.insertAdjacentHTML('afterend', '<a class="portal-card x-firm-link" href="#firma"><span class="x-firm-link-icon">' + ic('building') + '</span><span><strong>Gewerbeanmeldung, Steuernummer &amp; Co.</strong><small>Im Firmenprofil hat jeder Nachweis einen festen Platz – mit Status und auch als Foto.</small></span>' + ic('arrow') + '</a>');
    }
    if (route !== '#firma' || root.querySelector('.x-firm-docs')) return;
    var heading = root.querySelector('.ws-page-heading');
    var company = root.querySelector('#export-data');
    if (!heading || !company) return;
    var card = document.createElement('section');
    card.className = 'portal-card x-firm-docs';
    card.innerHTML = docsCardHTML();
    heading.insertAdjacentElement('afterend', card);
    bindDocs(card);
    loadDocs(card);
    enhanceCompany(company.closest('section'));
  }
  /* Kein versehentliches Öffnen einer Datei im Browser, wenn sie neben einem Feld landet */
  document.addEventListener('dragover', function (e) { if (isPartner() && hash() === '#firma' && e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') > -1) e.preventDefault(); });
  document.addEventListener('drop', function (e) { if (isPartner() && hash() === '#firma' && !(e.target.closest && e.target.closest('.x-slot'))) e.preventDefault(); });

  /* Fehlende Anschriftteile nicht als „undefined“ anzeigen */
  function cleanMissing() {
    root.querySelectorAll('dd').forEach(function (dd) {
      if (dd.children.length || dd.textContent.indexOf('undefined') < 0) return;
      var t = dd.textContent.replace(/undefined/g, '').replace(/\s*,\s*(,\s*)+/g, ', ').replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s{2,}/g, ' ');
      if (t) dd.textContent = t; else { dd.textContent = 'Noch nicht hinterlegt'; dd.classList.add('x-empty'); }
    });
  }

  /* ---------- Steuerung ---------- */
  var queued = false;
  function run() {
    queued = false;
    try {
      applyMotion();
      cleanMissing();
      paintAll();
      enhanceSettings();
      enhanceFirma();
    } catch (e) { /* rein ergänzend */ }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(run); } }
  new MutationObserver(queue).observe(root, { childList: true, subtree: true });
  var top = document.querySelector('.portal-top');
  if (top) new MutationObserver(queue).observe(top, { childList: true, subtree: true });
  ['#portal-nav', '#portal-mobile-nav'].forEach(function (s) { var n = document.querySelector(s); if (n) new MutationObserver(queue).observe(n, { childList: true, subtree: true }); });
  new MutationObserver(queue).observe(body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('hashchange', queue);
  queue();
  schedule(1200);
})();
