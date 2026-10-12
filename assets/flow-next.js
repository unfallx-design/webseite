/* UNFALLX Prozess-Ebene: macht den Weg vom Schaden zum Gutachten sichtbar.
   Partner → UNFALLX → Gutachten → Kanzlei. Liest nur vorhandene Daten
   (GET /api/portal/cases …) und verlinkt vorhandene Funktionen. Ändert nichts. */
(function () {
  'use strict';
  var root = document.getElementById('portal-root');
  if (!root || !document.body || !window.fetch) return;

  var isAdmin = function () { return document.body.classList.contains('admin-zentrale'); };
  var reduce = function () {
    return document.body.dataset.motion === 'off' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  var route = function () { return (location.hash || '#start').split('?')[0]; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var P = {
    capture: 'M12 5v14M5 12h14',
    inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4',
    report: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4',
    done: 'M5 12l5 5 9-10',
    law: 'M12 3v18M7 21h10M5 7h14M5 7l-3 7h6zM19 7l-3 7h6z',
    camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    card: 'M3 6h18v12H3zM7 10h4M7 14h6M15 10h3v4h-3z',
    pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
    alert: 'M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0',
    doc: 'M7 3h7l5 5v13H7zM14 3v5h5',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
    cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    chat: 'M4 5h16v11H9l-5 4z',
    status: 'M4 12h4l3-7 4 14 3-7h2',
    car: 'M5 16h14M6 16l1.5-5h9L18 16M5 16v3h3v-3M16 16v3h3v-3',
    x: 'M7 7l10 10M17 7 7 17',
    seal: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4'
  };
  function ic(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + P[name] + '"/></svg>'; }

  /* ---------- Daten (nur lesend) ---------- */
  var cache = {};
  function get(path) {
    var hit = cache[path];
    if (hit && (hit.p || Date.now() - hit.t < 1500)) return hit.p || Promise.resolve(hit.v);
    var p = fetch('/api/portal' + path, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (v) { cache[path] = { t: Date.now(), v: v }; return v; }, function (e) { delete cache[path]; throw e; });
    cache[path] = { p: p };
    return p;
  }

  var DRAFT = ['draft', 'recording', 'ready_to_submit'];
  function kinds(files) {
    var k = { photo: 0, registration: 0, authorization: 0, bundle: 0, document: 0, report: 0 };
    (files || []).forEach(function (f) {
      if (f.deletedAt || f.chatAttachment) return;
      if (f.kind === 'photo') k.photo++;
      else if (f.kind === 'registration') k.registration++;
      else if (f.kind === 'authorization') k.authorization++;
      else if (f.kind === 'case_bundle') k.bundle++;
      else if (f.kind === 'report') k.report++;
      else if (f.kind === 'document') k.document++;
    });
    return k;
  }
  function openRequests(c) { return (c.requests || []).filter(function (r) { return r.state === 'open'; }).length; }
  function checks(c, files) {
    var k = kinds(files), open = openRequests(c);
    var list = [
      { key: 'photo', icon: 'camera', label: 'Schadenfotos', ok: k.photo > 0, value: k.photo ? k.photo + (k.photo === 1 ? ' Foto' : ' Fotos') : 'Fehlen noch' },
      { key: 'registration', icon: 'card', label: 'Fahrzeugschein', ok: k.registration + k.bundle > 0, value: k.registration + k.bundle > 0 ? 'Liegt vor' : 'Fehlt noch' },
      { key: 'authorization', icon: 'pen', label: 'Unterschriebener Auftrag', ok: k.authorization + k.bundle > 0, value: k.authorization + k.bundle > 0 ? 'Liegt vor' : 'Fehlt noch' },
      { key: 'requests', icon: 'alert', label: 'Rückfragen', ok: open === 0 && c.status !== 'needs_info', value: open ? open + ' offen' : c.status === 'needs_info' ? 'Rückmeldung nötig' : 'Keine offen' }
    ];
    var done = list.filter(function (x) { return x.ok; }).length;
    return { list: list, done: done, pct: Math.round(done / list.length * 100), k: k, open: open };
  }

  /* ---------- Schritte ---------- */
  function caseStep(status) {
    if (DRAFT.indexOf(status) > -1) return 0;
    if (status === 'submitted') return 1;
    if (['review', 'accepted', 'needs_info'].indexOf(status) > -1) return 2;
    if (status === 'in_progress') return 3;
    if (status === 'report_ready') return 4;
    if (['report_sent', 'closed'].indexOf(status) > -1) return 5;
    return -1;
  }
  var CASE_STEPS = [
    ['capture', 'Aufnahme', 'Partner'],
    ['inbox', 'Eingang', 'UNFALLX'],
    ['search', 'Prüfung', 'UNFALLX'],
    ['report', 'Gutachten in Arbeit', 'UNFALLX'],
    ['seal', 'Gutachten fertig', 'UNFALLX'],
    ['law', 'Bei der Kanzlei', 'Kanzlei']
  ];
  function stages(cases) {
    var n = function (fn) { return cases.filter(fn).length; };
    var is = function () { var a = [].slice.call(arguments); return function (c) { return a.indexOf(c.status) > -1; }; };
    var info = n(is('needs_info'));
    if (isAdmin()) {
      return {
        lanes: [['Vom Partner', 1], ['Bei dir in der Zentrale', 3], ['Kanzlei', 1]],
        items: [
          { icon: 'inbox', label: 'Neu eingegangen', hint: 'Fotos & Unterlagen sichten', count: n(is('submitted')), href: '#faelle/new', hot: true },
          { icon: 'search', label: 'In Prüfung', hint: 'Vollständigkeit & Annahme', count: n(is('review', 'accepted', 'needs_info')), href: '#status', badge: info ? info + ' warten auf Partner' : '' },
          { icon: 'report', label: 'Gutachten in Arbeit', hint: 'Erstellen, z. B. per autoiXpert', count: n(is('in_progress')), href: '#faelle/in_progress' },
          { icon: 'seal', label: 'Gutachten freigegeben', hint: 'Bereit zum Versand', count: n(is('report_ready')), href: '#faelle/ready' },
          { icon: 'law', label: 'An Kanzlei versandt', hint: 'Übergabe erledigt', count: n(is('report_sent')), href: '#faelle/report_sent' }
        ]
      };
    }
    return {
      lanes: [['Du', 1], ['UNFALLX', 3], ['Kanzlei', 1]],
      items: [
        { icon: 'capture', label: 'Aufnahme', hint: 'Fotos & Unterlagen sammeln', count: n(function (c) { return DRAFT.indexOf(c.status) > -1; }), href: '#faelle/draft' },
        { icon: 'inbox', label: 'Bei UNFALLX', hint: 'Sicher übermittelt', count: n(is('submitted')), href: '#faelle/new' },
        { icon: 'search', label: 'Prüfung', hint: 'UNFALLX sichtet alles', count: n(is('review', 'accepted', 'needs_info')), href: info ? '#faelle/requests' : '#faelle/working', badge: info ? info + (info === 1 ? ' Rückfrage an dich' : ' Rückfragen an dich') : '', hot: !!info },
        { icon: 'report', label: 'Gutachten', hint: 'Wird erstellt', count: n(is('in_progress')), href: '#faelle/in_progress' },
        { icon: 'law', label: 'Fertig & Kanzlei', hint: 'Gutachten liegt vor', count: n(is('report_ready', 'report_sent', 'closed')), href: '#faelle/done' }
      ]
    };
  }

  /* ---------- Bausteine ---------- */
  function countUp(scope) {
    scope.querySelectorAll('[data-x-count]').forEach(function (el) {
      var target = parseInt(el.getAttribute('data-x-count'), 10) || 0;
      el.textContent = String(target);
      if (!target || reduce()) return;
      var start = performance.now(), dur = Math.min(1100, 450 + target * 60);
      el.textContent = '0';
      (function step(now) {
        if (!el.isConnected) return;
        var t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 4);
        el.textContent = String(t < 1 ? Math.round(target * e) : target);
        if (t < 1) requestAnimationFrame(step);
      })(start);
    });
  }
  function tilt(scope) {
    scope.querySelectorAll('[data-x-tilt]').forEach(function (el) {
      if (el.dataset.xTiltBound) return;
      el.dataset.xTiltBound = '1';
      el.addEventListener('pointermove', function (e) {
        if (reduce() || document.body.dataset.motion !== 'full' || !(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches)) return;
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--x-rx', (-y * 7).toFixed(2) + 'deg');
        el.style.setProperty('--x-ry', (x * 9).toFixed(2) + 'deg');
        el.classList.add('x-lift');
      }, { passive: true });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--x-rx', '0deg'); el.style.setProperty('--x-ry', '0deg'); el.classList.remove('x-lift'); });
    });
  }
  function ring(pct, size) {
    return '<span class="x-ring" data-pct="' + pct + '" data-full="' + (pct === 100) + '" role="img" aria-label="Unterlagen zu ' + pct + ' Prozent vollständig"><svg viewBox="0 0 44 44" width="' + size + '" height="' + size + '" aria-hidden="true"><circle cx="22" cy="22" r="18" class="x-ring-bg"/><circle cx="22" cy="22" r="18" class="x-ring-fg" pathLength="100" stroke-dasharray="' + pct + ' 100"/></svg><b>' + pct + '<small>%</small></b></span>';
  }
  function plate(text) { return text ? '<span class="x-plate"><i>D</i>' + esc(text) + '</span>' : ''; }

  /* ---------- 1) Prozess-Strecke auf dem Dashboard ---------- */
  function flowMarkup(cases) {
    var s = stages(cases), total = s.items.reduce(function (a, x) { return a + x.count; }, 0);
    var admin = isAdmin();
    var lanes = s.lanes.map(function (l) { return '<span style-span="' + l[1] + '" class="x-lane x-lane-' + l[1] + '">' + esc(l[0]) + '</span>'; }).join('');
    var items = s.items.map(function (x, i) {
      return '<a class="x-stage' + (x.count ? ' is-filled' : '') + (x.hot && x.count ? ' is-hot' : '') + '" href="' + x.href + '" data-x-tilt>' +
        '<span class="x-node"><span class="x-node-core">' + ic(x.icon) + '</span><em>' + (i + 1) + '</em></span>' +
        '<strong data-x-count="' + x.count + '">' + x.count + '</strong>' +
        '<span class="x-stage-label">' + esc(x.label) + '</span>' +
        '<small>' + esc(x.hint) + '</small>' +
        (x.badge ? '<span class="x-stage-badge">' + esc(x.badge) + '</span>' : '') +
        '</a>';
    }).join('');
    return '<section class="portal-card x-flow" aria-label="Prozess vom Schaden zum Gutachten">' +
      '<div class="x-flow-head"><div><span class="x-kicker">Prozess · live</span><h2>' + (admin ? 'Vom Partner bis zur Kanzlei.' : 'Dein Weg zum Gutachten.') + '</h2>' +
      '<p>' + (admin ? 'Alle aktiven Fälle auf einen Blick – vom Eingang der Fotos und Unterlagen bis zur Übergabe an die Kanzlei.' : 'Du sammelst Fotos und Unterlagen, UNFALLX prüft und erstellt das Gutachten, die Kanzlei übernimmt.') + '</p></div>' +
      '<span class="x-flow-total"><b data-x-count="' + total + '">' + total + '</b><small>' + (total === 1 ? 'aktiver Fall' : 'aktive Fälle') + '</small></span></div>' +
      '<div class="x-flow-stage"><div class="x-lanes" aria-hidden="true">' + lanes + '</div>' +
      '<div class="x-track" aria-hidden="true"><span class="x-track-line"></span><i></i><i></i><i></i><i></i></div>' +
      '<div class="x-stages">' + items + '</div></div></section>';
  }

  /* ---------- 2) Gutachten-Werkbank (Zentrale) ---------- */
  var BENCH = ['submitted', 'review', 'accepted', 'in_progress', 'needs_info'];
  var BENCH_ORDER = { submitted: 0, in_progress: 1, review: 2, accepted: 2, needs_info: 3 };
  var LABEL = { draft: 'Entwurf', recording: 'Aufnahme läuft', ready_to_submit: 'Bereit zum Senden', submitted: 'Neu eingegangen', review: 'In Prüfung', needs_info: 'Unterlagen fehlen', accepted: 'Angenommen', in_progress: 'Gutachten in Arbeit', report_ready: 'Gutachten freigegeben', report_sent: 'An Kanzlei versandt', closed: 'Abgeschlossen', declined: 'Abgelehnt' };
  function benchCard(c, d) {
    var ck = d ? checks(d.case, d.files) : null;
    var img = c.thumbnailFileId ? '<img src="/api/portal/files/' + esc(c.thumbnailFileId) + '/thumbnail" alt="" loading="lazy" decoding="async">' : ic('car');
    var rows = ck ? ck.list.map(function (x) { return '<li data-ok="' + x.ok + '">' + ic(x.ok ? 'done' : 'x') + '<span>' + esc(x.label) + '</span><b>' + esc(x.value) + '</b></li>'; }).join('') : '<li class="x-skeleton"></li><li class="x-skeleton"></li><li class="x-skeleton"></li>';
    var since = c.submittedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(c.submittedAt)) / 864e5)) : null;
    var aix = d && d.case.autoixpert && d.case.autoixpert.reportId;
    return '<article class="x-bench-card" data-state="' + esc(c.status) + '" data-x-tilt>' +
      '<div class="x-bench-top"><span class="x-bench-thumb">' + img + '</span><div>' + plate(c.intake && c.intake.plate) +
      '<strong>' + esc((c.intake && c.intake.vehicle) || 'Schadenakte') + '</strong><small>' + esc(c.companyName || '') + (since !== null ? ' · ' + (since === 0 ? 'heute' : since === 1 ? 'seit 1 Tag' : 'seit ' + since + ' Tagen') : '') + '</small></div>' +
      (ck ? ring(ck.pct, 50) : '<span class="x-ring x-skeleton-ring"></span>') + '</div>' +
      '<span class="x-bench-status">' + esc(LABEL[c.status] || c.status) + (aix ? ' · autoiXpert ✓' : '') + '</span>' +
      '<ul class="x-checks">' + rows + '</ul>' +
      '<div class="x-bench-actions"><a class="x-btn x-btn-primary" href="#fall/' + esc(c.id) + '">' + ic('arrow') + 'Fall öffnen</a>' +
      '<a class="x-btn" href="/api/portal/cases/' + esc(c.id) + '/archive?scope=all" download title="Alle Fotos und Unterlagen als ZIP laden">' + ic('download') + 'ZIP</a>' +
      '<a class="x-btn x-btn-icon" href="#fall/' + esc(c.id) + '/processing" title="Bearbeitung: Status, autoiXpert, Kanzlei" aria-label="Bearbeitung öffnen: Status, autoiXpert, Kanzlei">' + ic('cube') + '</a></div></article>';
  }
  function benchMarkup(list) {
    return '<section class="portal-card x-bench" aria-label="Gutachten-Werkbank"><div class="x-flow-head"><div><span class="x-kicker">Gutachten-Werkbank</span><h2>Bereit für dein Gutachten.</h2>' +
      '<p>Neue Eingänge zuerst. Jede Karte zeigt, ob Fotos, Fahrzeugschein und Auftrag vollständig sind – mit allen Unterlagen als ZIP oder direkt in die Bearbeitung.</p></div>' +
      '<a class="x-btn" href="#status">' + ic('status') + 'Alle Schritte</a></div>' +
      (list.length ? '<div class="x-bench-grid">' + list.map(function (c) { return benchCard(c, null); }).join('') + '</div>' :
        '<div class="x-bench-empty">' + ic('done') + '<p>Aktuell wartet kein Fall auf ein Gutachten. Neue Eingänge der Partner erscheinen hier automatisch.</p></div>') + '</section>';
  }

  var dashBusy = false;
  function enhanceDashboard() {
    var r = route();
    if (r !== '#start' && r !== '#' && r !== '') return;
    var heading = root.querySelector(':scope > .ws-page-heading');
    if (!heading || root.querySelector('.x-flow') || dashBusy) return;
    if (!isAdmin() && !root.querySelector('.ws-dashboard-grid, .workflow-inbox')) return;
    if (isAdmin() && !root.querySelector('.uz-metrics, .uz-dashboard-grid')) return;
    dashBusy = true;
    get('/cases').then(function (data) {
      dashBusy = false;
      var h = root.querySelector(':scope > .ws-page-heading');
      if (!h || root.querySelector('.x-flow') || route() !== r) return;
      var cases = (data.cases || []).filter(function (c) { return !c.filing || (c.filing.folder || 'active') === 'active'; });
      var anchor = isAdmin() ? (root.querySelector(':scope > .uz-callout') || h) : (root.querySelector(':scope > .ws-pending, :scope > .portal-alert') || h);
      anchor.insertAdjacentHTML('afterend', flowMarkup(cases));
      var flow = root.querySelector('.x-flow');
      countUp(flow); tilt(flow);
      if (isAdmin()) {
        var old = root.querySelector('.uz-pipeline');
        var card = old && old.closest('.portal-card');
        if (card) card.classList.add('x-merged');
        var list = cases.filter(function (c) { return BENCH.indexOf(c.status) > -1; })
          .sort(function (a, b) { return (BENCH_ORDER[a.status] - BENCH_ORDER[b.status]) || String(a.submittedAt || a.createdAt).localeCompare(String(b.submittedAt || b.createdAt)); })
          .slice(0, 6);
        var after = root.querySelector(':scope > .uz-metrics') || flow;
        after.insertAdjacentHTML('afterend', benchMarkup(list));
        var bench = root.querySelector('.x-bench');
        tilt(bench);
        list.forEach(function (c) {
          get('/cases/' + c.id).then(function (d) {
            var old = bench.querySelector('.x-bench-card:nth-child(' + (list.indexOf(c) + 1) + ')');
            if (!old || !old.isConnected) return;
            old.insertAdjacentHTML('afterend', benchCard(c, d));
            var fresh = old.nextElementSibling;
            old.remove();
            fresh.classList.add('x-in');
            tilt(bench);
          }).catch(function () {});
        });
      }
    }).catch(function () { dashBusy = false; });
  }

  /* ---------- 3) Fallakte: Fallweg + Gutachten-Paket ---------- */
  function tabExists(key) { return !!root.querySelector('[data-detail-tab="' + key + '"]'); }
  function goTab(key, after) {
    var t = root.querySelector('[data-detail-tab="' + key + '"]');
    if (!t) return;
    t.click();
    setTimeout(function () { if (after) after(); }, 30);
  }
  function openUpload(kind) {
    goTab('documents', function () {
      var up = root.querySelector('.ws-media-upload');
      if (up) up.setAttribute('open', '');
      var form = document.getElementById('file-upload');
      if (kind && form && form.elements.kind && [].some.call(form.elements.kind.options || [], function (o) { return o.value === kind; })) {
        form.elements.kind.value = kind;
        form.elements.kind.dispatchEvent(new Event('change', { bubbles: true }));
      }
      var a = document.getElementById('detail-upload-anchor') || up;
      if (a) a.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' });
    });
  }
  function caseMarkup(c, files) {
    var admin = isAdmin(), step = caseStep(c.status), ck = checks(c, files);
    var declined = c.status === 'declined';
    var steps = CASE_STEPS.map(function (s, i) {
      var state = declined ? 'next' : i < step || c.status === 'closed' ? 'done' : i === step ? 'current' : 'next';
      var sub = state === 'current' ? (c.status === 'needs_info' ? 'Rückmeldung nötig' : LABEL[c.status] || '') : state === 'done' ? 'Erledigt' : s[2];
      return '<li data-state="' + state + '"' + (state === 'current' && c.status === 'needs_info' ? ' data-alert="true"' : '') + '><span class="x-dot">' + (state === 'done' ? ic('done') : ic(s[0])) + '</span><strong>' + esc(s[1]) + '</strong><small>' + esc(sub) + '</small></li>';
    }).join('');
    var fill = declined ? 0 : c.status === 'closed' ? 100 : Math.max(0, step) / (CASE_STEPS.length - 1) * 100;
    var tiles = ck.list.map(function (x) {
      return '<li data-ok="' + x.ok + '"><span class="x-tile-icon">' + ic(x.icon) + '</span><div><span>' + esc(x.label) + '</span><b>' + esc(x.value) + '</b></div><i>' + ic(x.ok ? 'done' : 'x') + '</i></li>';
    }).join('');
    var reportVisible = ck.k.report > 0;
    tiles += '<li data-ok="' + reportVisible + '" data-result="true"><span class="x-tile-icon">' + ic('report') + '</span><div><span>Gutachten (PDF)</span><b>' + (reportVisible ? 'Liegt vor' : admin ? 'Noch offen' : 'Folgt von UNFALLX') + '</b></div><i>' + ic(reportVisible ? 'done' : 'report') + '</i></li>';
    var actions = [];
    if (admin) {
      actions.push('<a class="x-btn x-btn-primary" href="/api/portal/cases/' + esc(c.id) + '/archive?scope=all" download>' + ic('download') + 'Alle Unterlagen (ZIP)</a>');
      if (ck.k.photo) actions.push('<a class="x-btn" href="/api/portal/cases/' + esc(c.id) + '/archive?scope=photos" download>' + ic('camera') + 'Nur Fotos (ZIP)</a>');
      if (tabExists('processing')) actions.push('<button type="button" class="x-btn" data-x-go="autoixpert">' + ic('cube') + 'An autoiXpert</button>');
      if (tabExists('requirements')) actions.push('<button type="button" class="x-btn" data-x-go="requirements">' + ic('alert') + 'Unterlagen anfordern</button>');
      if (tabExists('documents')) actions.push('<button type="button" class="x-btn" data-x-go="report">' + ic('upload') + 'Gutachten hochladen</button>');
      if (tabExists('processing')) actions.push('<button type="button" class="x-btn" data-x-go="processing">' + ic('status') + 'Status & Kanzlei</button>');
    } else {
      if (step === 0 && root.querySelector('[data-complete-intake]')) actions.push('<button type="button" class="x-btn x-btn-primary" data-x-go="complete">' + ic('capture') + 'Aufnahme vervollständigen</button>');
      if ((ck.open || c.status === 'needs_info') && tabExists('requirements')) actions.push('<button type="button" class="x-btn x-btn-primary" data-x-go="requirements">' + ic('alert') + 'Rückfrage beantworten</button>');
      if (tabExists('documents') && root.querySelector('.ws-media-upload')) actions.push('<button type="button" class="x-btn' + (actions.length ? '' : ' x-btn-primary') + '" data-x-go="upload">' + ic('upload') + 'Fotos & Unterlagen nachreichen</button>');
      if (reportVisible && tabExists('documents')) actions.push('<button type="button" class="x-btn" data-x-go="documents">' + ic('report') + 'Gutachten ansehen</button>');
      actions.push('<a class="x-btn" href="#chat/' + esc(c.id) + '">' + ic('chat') + 'Chat mit UNFALLX</a>');
    }
    var title = admin ? (ck.pct === 100 ? 'Gutachten-Paket vollständig' : 'Gutachten-Paket: es fehlt noch etwas') : (step === 0 ? (ck.pct === 100 ? 'Alles bereit zum Senden an UNFALLX' : 'Das fehlt noch vor dem Senden') : ck.pct === 100 ? 'Alles Nötige ist bei UNFALLX' : 'Das braucht UNFALLX noch von dir');
    return '<section class="portal-card x-case-flow" aria-label="Fallweg und Gutachten-Paket">' +
      '<div class="x-flow-head"><div><span class="x-kicker">Fallweg</span><h2>' + (declined ? 'Dieser Vorgang wurde abgelehnt.' : esc(CASE_STEPS[Math.max(0, step)][1]) + (c.status === 'closed' ? ' · abgeschlossen' : '')) + '</h2></div></div>' +
      '<ol class="x-steps" style-fill="' + fill + '"><span class="x-steps-fill" aria-hidden="true"></span>' + steps + '</ol>' +
      '<div class="x-pack"><div class="x-pack-head">' + ring(ck.pct, 64) + '<div><strong>' + esc(title) + '</strong><small>' + ck.done + ' von ' + ck.list.length + ' Punkten erledigt' + (admin && c.autoixpert && c.autoixpert.reportId ? ' · an autoiXpert übertragen' : '') + '</small></div></div>' +
      '<ul class="x-tiles">' + tiles + '</ul>' +
      '<div class="x-actions">' + actions.join('') + '</div></div></section>';
  }
  function bindCase(panel) {
    panel.querySelectorAll('[data-x-go]').forEach(function (b) {
      b.addEventListener('click', function () {
        var go = b.getAttribute('data-x-go');
        if (go === 'upload') openUpload('');
        else if (go === 'report') openUpload('report');
        else if (go === 'complete') { var c = root.querySelector('[data-complete-intake]'); if (c) c.click(); }
        else if (go === 'autoixpert') goTab('processing', function () { var a = document.getElementById('autoixpert-transfer') || root.querySelector('.autoixpert-transfer-card'); if (a) a.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' }); });
        else goTab(go, function () { var p = document.getElementById('panel-' + go); if (p) p.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' }); });
      });
    });
    var ol = panel.querySelector('.x-steps');
    if (ol) {
      var fill = parseFloat(ol.getAttribute('style-fill')) || 0;
      ol.style.setProperty('--x-fill', String(fill / 100));
    }
  }
  var caseBusy = '';
  function enhanceCase() {
    var m = (location.hash || '').match(/^#fall\/([0-9a-f-]{36})/i);
    if (!m) return;
    var id = m[1];
    var summary = root.querySelector('.ws-case-summary');
    if (!summary || root.querySelector('.x-case-flow') || caseBusy === id) return;
    caseBusy = id;
    get('/cases/' + id).then(function (d) {
      caseBusy = '';
      var s = root.querySelector('.ws-case-summary');
      var mm = (location.hash || '').match(/^#fall\/([0-9a-f-]{36})/i);
      if (!s || !mm || mm[1] !== id || root.querySelector('.x-case-flow') || !d.case) return;
      s.insertAdjacentHTML('afterend', caseMarkup(d.case, d.files));
      var panel = root.querySelector('.x-case-flow');
      bindCase(panel);
    }).catch(function () { caseBusy = ''; });
  }

  /* ---------- Lanes: Spaltenbreite per CSSOM (Inline-Styles sind per CSP gesperrt) ---------- */
  function applySpans() {
    root.querySelectorAll('[style-span]').forEach(function (el) {
      el.style.setProperty('grid-column', 'span ' + el.getAttribute('style-span'));
      el.removeAttribute('style-span');
    });
  }

  var queued = false;
  function run() {
    queued = false;
    try { enhanceDashboard(); enhanceCase(); applySpans(); } catch (e) { /* rein optisch */ }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(run); } }
  new MutationObserver(function () { queue(); setTimeout(applySpans, 0); }).observe(root, { childList: true, subtree: true });
  window.addEventListener('hashchange', queue);
  queue();
})();
