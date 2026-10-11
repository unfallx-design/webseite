/* UNFALLX Startseite – Dynamic Island, Kino-Intro, Scroll-Inszenierung, Glas und 3D.
   Progressive Verbesserung: Ohne JavaScript, im Datensparmodus oder mit reduzierter
   Bewegung bleiben alle Inhalte vollständig sichtbar, lesbar und bedienbar.
   Muss vor home-motion.js laden: übernimmt das Erscheinen der Inhalte. */
(() => {
  'use strict';
  const body = document.body;
  if (!body || body.id !== 'ux') return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const calm = () => reduce.matches || saveData;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const NS = 'http://www.w3.org/2000/svg';
  const MARK = '<svg viewBox="0 0 100 100" fill="currentColor"><path d="M17.12 0 5.88 39.51 31.37 85.28 56.95 71.64Z"/><path d="M70.54 18.28 44.76 31.52 82.82 99.97 94.09 60.52Z"/></svg>';
  const svgMark = (cls) => {
    const t = document.createElement('template');
    t.innerHTML = MARK;
    const s = t.content.firstChild;
    s.setAttribute('class', cls);
    s.setAttribute('aria-hidden', 'true');
    return s;
  };
  const hero = document.getElementById('start');
  const motion = !calm() && 'IntersectionObserver' in window;
  body.classList.add('gx-js');

  /* 0 · Hell/Dunkel: Wahl wird gemerkt; der Wechsel läuft als Kreis-Welle ab dem Klickpunkt */
  const root = document.documentElement;
  const SUN = '<svg class="gx-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>';
  const MOON = '<svg class="gx-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/></svg>';
  const metaTheme = $('meta[name="theme-color"]');
  const themeViews = [];
  const isLight = () => root.classList.contains('gx-light');
  const syncTheme = () => {
    const light = isLight();
    if (metaTheme) metaTheme.setAttribute('content', light ? '#fbfbfd' : '#000000');
    themeViews.forEach((fn) => fn(light));
  };
  // Ohne eigene Wahl folgt die Darstellung der Einstellung des Geräts – auch live beim Umstellen
  let themeChosen = false;
  try { themeChosen = !!localStorage.getItem('ux-theme'); } catch (e) { /* Speicher gesperrt */ }
  const sysLight = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
  if (sysLight && sysLight.addEventListener) sysLight.addEventListener('change', (e) => { if (themeChosen) return; root.classList.toggle('gx-light', e.matches); syncTheme(); });
  const applyTheme = (light) => {
    root.classList.toggle('gx-light', light);
    themeChosen = true;
    try { localStorage.setItem('ux-theme', light ? 'light' : 'dark'); } catch (e) { /* Speicher gesperrt: Wahl gilt nur für diesen Besuch */ }
    syncTheme();
  };
  const switchTheme = (light, x, y) => {
    if (light === isLight()) return;
    if (!document.startViewTransition || calm()) { applyTheme(light); return; }
    const vt = document.startViewTransition(() => applyTheme(light));
    vt.ready.then(() => {
      const r = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)));
      root.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 800, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
  };
  const segmented = () => {
    const g = document.createElement('div');
    g.className = 'gx-theme';
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', 'Darstellung');
    [['dark', 'Dunkel', MOON], ['light', 'Hell', SUN]].forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-gx-theme', o[0]);
      b.innerHTML = o[2];
      b.appendChild(document.createTextNode(o[1]));
      b.addEventListener('click', (e) => switchTheme(o[0] === 'light', e.clientX || innerWidth / 2, e.clientY || innerHeight / 2));
      g.appendChild(b);
    });
    themeViews.push((light) => $$('button', g).forEach((b) => b.setAttribute('aria-pressed', String((b.getAttribute('data-gx-theme') === 'light') === light))));
    return g;
  };
  const headerActions = $('.ux-header-actions');
  if (headerActions) {
    const tb = document.createElement('button');
    tb.type = 'button';
    tb.className = 'gx-theme-btn';
    tb.setAttribute('aria-label', 'Helle Darstellung');
    tb.title = 'Hell / Dunkel';
    tb.innerHTML = SUN + MOON;
    tb.addEventListener('click', () => { const r = tb.getBoundingClientRect(); switchTheme(!isLight(), r.left + r.width / 2, r.top + r.height / 2); });
    headerActions.insertBefore(tb, headerActions.firstChild);
    themeViews.push((light) => {
      tb.setAttribute('aria-pressed', String(light));
      tb.setAttribute('aria-label', light ? 'Dunkle Darstellung' : 'Helle Darstellung');
    });
  }
  const footBar = $('.connect-footer-bottom');
  if (footBar) footBar.appendChild(segmented());
  const menuInner = $('.mobile-menu-inner');
  if (menuInner) {
    const row = document.createElement('div');
    row.className = 'gx-menu-theme';
    const lab = document.createElement('span');
    lab.textContent = 'Darstellung';
    row.appendChild(lab);
    row.appendChild(segmented());
    menuInner.appendChild(row);
  }
  syncTheme();

  /* 1 · Überschriften: Zeilen steigen aus einer unsichtbaren Kante */
  const splitLines = (h) => {
    const lines = [[]];
    Array.prototype.slice.call(h.childNodes).forEach((n) => {
      if (n.nodeName === 'BR') lines.push([]);
      else lines[lines.length - 1].push(n);
    });
    const real = lines.filter((l) => l.some((n) => n.nodeType !== 3 || n.nodeValue.trim()));
    if (!real.length) return;
    h.textContent = '';
    real.forEach((l, i) => {
      if (i) h.appendChild(document.createTextNode(' '));
      const ln = document.createElement('span');
      const li = document.createElement('span');
      ln.className = 'gx-ln';
      li.className = 'gx-li';
      li.style.setProperty('--ld', (i * 0.12).toFixed(2) + 's');
      l.forEach((n) => li.appendChild(n));
      ln.appendChild(li);
      h.appendChild(ln);
    });
  };
  const heads = motion ? $$('main h1, main h2').filter((h) => !h.closest('.prose,.learning-article>section,.about-topic-body,.reveal,.photo-band')) : [];
  heads.forEach(splitLines);
  if (heads.length) {
    const ho = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('gx-up');
      ho.unobserve(e.target);
    }), { threshold: 0.25 });
    const introEl = $('[data-home-intro]');
    const aboutEl = !introEl && $('.connect-about');
    heads.forEach((h) => { if (!(motion && ((introEl && introEl.contains(h)) || (aboutEl && aboutEl.contains(h))))) ho.observe(h); });
  }

  /* 2 · Erscheinen: Inhalte gleiten weich aus der Unschärfe herein */
  const intro = $('[data-home-intro]');
  const blocks = $$('[data-home-reveal]');
  blocks.forEach((el) => el.removeAttribute('data-home-reveal'));
  if (intro) intro.removeAttribute('data-home-intro');
  if (motion) {
    const SUB_REVEAL = '.about-group-head,.about-topic,.about-contact,.learning-article>section,.location-option,.map-shell,.page-head+.wrap>.prose,.centerpiece>div';
    const subBlocks = $$(SUB_REVEAL).filter((el) => !el.closest('.reveal') && !el.querySelector('.reveal'));
    const targets = blocks.concat(subBlocks).filter((el) => !el.classList.contains('design-hero-app') && !el.closest('.design-workflow ol'));
    const io = new IntersectionObserver((entries) => {
      let n = 0;
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.style.setProperty('--d', (Math.min(n++, 4) * 0.09).toFixed(2) + 's');
        e.target.classList.add('gx-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
    // Sehr hohe Bloecke (z. B. lange Rechtstexte) bleiben immer sichtbar
    targets.filter((el) => el.offsetHeight < innerHeight * 1.4).forEach((el) => { el.classList.add('gx-rv'); io.observe(el); });
    const aboutHero = !intro && $('.connect-about');
    if (aboutHero) {
      const aparts = [$('figure', aboutHero)].concat(Array.prototype.slice.call(($(':scope > div', aboutHero) || aboutHero).children)).filter(Boolean);
      aparts.forEach((el, k) => {
        if (el.tagName === 'H1') { el.querySelectorAll('.gx-li').forEach((li, i) => li.style.setProperty('--ld', (0.3 + i * 0.14).toFixed(2) + 's')); return; }
        el.classList.add('gx-rv');
        el.style.setProperty('--d', (0.1 + k * 0.09).toFixed(2) + 's');
      });
      requestAnimationFrame(() => requestAnimationFrame(() => aparts.forEach((el) => el.classList.add(el.tagName === 'H1' ? 'gx-up' : 'gx-in'))));
    }
    if (intro) {
      const parts = Array.prototype.slice.call(intro.children);
      let k = 0;
      parts.forEach((el) => {
        if (el.tagName === 'H1') { el.querySelectorAll('.gx-li').forEach((li, i) => li.style.setProperty('--ld', (0.35 + i * 0.14).toFixed(2) + 's')); return; }
        el.classList.add('gx-rv');
        el.style.setProperty('--d', (k++ === 0 ? 0.2 : 0.55 + k * 0.08).toFixed(2) + 's');
      });
      requestAnimationFrame(() => requestAnimationFrame(() => parts.forEach((el) => el.classList.add(el.tagName === 'H1' ? 'gx-up' : 'gx-in'))));
    }
  }

  /* 3 · Statement bleibt stehen, Wörter leuchten nacheinander auf */
  const scrub = $('.design-partner-intro .design-section-heading > p');
  let words = 0, pin = null;
  if (scrub && motion) {
    const walker = document.createTreeWalker(scrub, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach((node) => {
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const w = document.createElement('span');
        w.className = 'gx-w';
        w.textContent = part;
        w.style.setProperty('--i', String(words++));
        frag.appendChild(w);
      });
      node.parentNode.replaceChild(frag, node);
    });
    scrub.style.setProperty('--n', String(words));
    scrub.style.setProperty('--scrub', '0');
    const head = scrub.closest('.design-section-heading');
    if (head && head.parentNode) {
      pin = document.createElement('div');
      pin.className = 'gx-pin';
      const inner = document.createElement('div');
      inner.className = 'gx-pin-in';
      head.parentNode.insertBefore(pin, head);
      inner.appendChild(head);
      pin.appendChild(inner);
      const sec = pin.closest('section');
      if (sec) sec.classList.add('gx-pinned');
    }
  }

  /* 4 · Riesiges Typo-Band aus den vier Schritten */
  const titles = $$('.design-workflow li h3').map((h) => h.textContent.trim()).filter(Boolean);
  let band = null;
  if (hero && titles.length) {
    band = document.createElement('div');
    band.className = 'gx-band';
    band.setAttribute('aria-hidden', 'true');
    ['gx-r1', 'gx-r2'].forEach((cls, r) => {
      const row = document.createElement('div');
      row.className = 'gx-row ' + cls;
      for (let k = 0; k < 3; k++) {
        titles.forEach((t, i) => {
          const it = document.createElement('span');
          it.className = 'gx-item' + ((i + k + r) % 2 ? ' gx-o' : '');
          it.appendChild(document.createTextNode(t));
          it.appendChild(svgMark('gx-sep'));
          row.appendChild(it);
        });
      }
      band.appendChild(row);
    });
    hero.parentNode.insertBefore(band, hero.nextSibling);
  }
  const bandRows = band ? $$('.gx-row', band) : [];

  /* 5 · Dynamic Island: oben ausgeklappt, beim Scrollen kompakt mit Abschnitt, Fortschritt und Live-Aktivität */
  const header = $('.ux-header');
  const toggle = $('[data-nav-toggle]');
  let islandLabel = null, current = '';
  const sections = [['#start', 'UNFALLX Connect'], ['#partner', 'Für Partner'], ['#fuer-wen', 'Für deinen Betrieb'], ['#app-ablauf', 'So funktioniert’s'], ['#aufnahme', 'Schadenaufnahme'],
    ['#app', 'Die App'], ['#leistungen', 'Leistungen'], ['#provision', 'Vergütung'], ['#app-fragen', 'Häufige Fragen'], ['#iphone-app', 'iPhone-App'],
    ['#vertrauen', 'Vertrauen'], ['.design-final-cta', 'Partner werden'], ['#kontakt', 'Kontakt'], ['#gutachterservice', 'Über uns']]
    .map((s) => [$(s[0]), s[1]]).filter((s) => s[0])
    .sort((a, b) => (a[0].compareDocumentPosition(b[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  /* „Leistungen" in Navigation und Handy-Menü ergänzen (nur auf der Startseite) */
  const addLink = (box, before, href, text, arrow) => {
    if (!box || box.querySelector('a[href$="' + href + '"]')) return;
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    if (arrow) { const sp = document.createElement('span'); sp.setAttribute('aria-hidden', 'true'); sp.textContent = ' ↗'; a.appendChild(sp); }
    const ref = before ? box.querySelector('a[href$="' + before + '"]') : null;
    box.insertBefore(a, ref);
  };
  if ($('#leistungen')) {
    addLink($('.ux-primary-nav'), '#kontakt', '#leistungen', 'Leistungen', false);
    addLink($('.ux-mobile-shortcuts'), '#iphone-app', '#leistungen', 'Leistungen', true);
  }
  if ($('#provision')) addLink($('.ux-mobile-shortcuts'), '#iphone-app', '#provision', 'Vergütung', true);
  if (!sections.length) {
    const toc = $$('.about-toc a[href^="#"]');
    const h1 = $('main h1');
    if (toc.length) toc.forEach((a) => { const el = $(a.getAttribute('href')); if (el) sections.push([el, a.textContent.trim()]); });
    else {
      if (h1) sections.push([h1, h1.textContent.trim()]);
      $$('.page-head+.wrap>.prose h2, .learning-article>section>h2').forEach((h, i) => {
        if (!h.id) h.id = 'abschnitt-' + (i + 1);
        sections.push([h, h.textContent.trim().replace(/^\d+\.\s*/, '')]);
      });
    }
    sections.sort((a, b) => (a[0].compareDocumentPosition(b[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  }
  const navLinks = $$('.ux-primary-nav a[href*="#"]').map((a) => [a, a.getAttribute('href').split('#')[1]]);
  const liveFrom = $('#provision');
  const tocLinks = $$('.about-toc a[href^="#"]').map((a) => [a, a.getAttribute('href').slice(1)]);
  if (header) {
    const island = document.createElement('div');
    island.className = 'gx-isl';
    island.setAttribute('aria-hidden', 'true');
    island.appendChild(svgMark('gx-isl-mark'));
    islandLabel = document.createElement('span');
    islandLabel.className = 'gx-isl-label';
    islandLabel.textContent = 'UNFALLX Connect';
    island.appendChild(islandLabel);
    const ring = document.createElementNS(NS, 'svg');
    ring.setAttribute('class', 'gx-isl-ring');
    ring.setAttribute('viewBox', '0 0 22 22');
    ['bg', 'fg'].forEach((c) => {
      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('class', c);
      circle.setAttribute('cx', '11'); circle.setAttribute('cy', '11'); circle.setAttribute('r', '9');
      ring.appendChild(circle);
    });
    island.appendChild(ring);
    const join = $('.design-hero .partner-actions a.btn');
    if (join) {
      const cta = document.createElement('a');
      cta.className = 'gx-isl-cta';
      cta.href = join.href;
      cta.tabIndex = -1;
      cta.textContent = 'Partner werden ↗';
      island.appendChild(cta);
    }
    header.appendChild(island);
    island.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('.gx-isl-cta')) return;
      if (innerWidth <= 760 && toggle) toggle.click();
      else header.classList.add('gx-peek');
    });
    document.addEventListener('click', (e) => { if (!header.contains(e.target)) header.classList.remove('gx-peek'); });
    if (toggle && 'MutationObserver' in window) {
      new MutationObserver(() => header.classList.toggle('gx-open', toggle.getAttribute('aria-expanded') === 'true'))
        .observe(toggle, { attributes: true, attributeFilter: ['aria-expanded'] });
    }
  }
  const setLabel = (t) => {
    if (!islandLabel || t === current) return;
    current = t;
    islandLabel.textContent = t;
    islandLabel.classList.remove('gx-swap');
    void islandLabel.offsetWidth;
    islandLabel.classList.add('gx-swap');
  };

  /* 6 · Gigantischer UNFALLX-Schriftzug im Footer */
  const footer = $('.connect-footer');
  const wordmark = $('.ux-header .wordmark');
  let giant = null;
  if (footer && wordmark) {
    giant = document.createElement('div');
    giant.className = 'gx-giant';
    giant.setAttribute('aria-hidden', 'true');
    const copy = wordmark.cloneNode(true);
    copy.removeAttribute('class');
    copy.setAttribute('focusable', 'false');
    giant.appendChild(copy);
    footer.appendChild(giant);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => giant.classList.toggle('gx-vis', entries[0].isIntersecting)).observe(giant);
    }
  }

  /* 7 · Scroll-Inszenierung: alles hängt an einer Messung pro Bild */
  const flowList = $('.design-workflow ol');
  const steps = flowList ? $$('li', flowList) : [];
  const paths = $$('.design-paths article');
  const scene = $('.design-connection-scene');
  const laptop = $('.design-laptop');
  const gallery = $('.native-gallery');
  const cta = $('.design-final-cta');
  const markBody = () => $('.gx-mark-body');
  const along = (r, vh, a, b) => clamp((vh * a - (r.top + r.height / 2)) / (vh * (a - b)), 0, 1);
  const through = (r, vh) => clamp((vh - r.top) / (vh + r.height), 0, 1);
  let ticking = 0;
  let afterScroll = () => {};
  const onScroll = () => {
    ticking = 0;
    const y = scrollY, vh = innerHeight, vw = innerWidth, still = !motion;
    const docH = document.documentElement.scrollHeight;
    const heroH = hero ? hero.offsetHeight : vh;
    let label = sections.length ? sections[0][1] : '', currentId = '';
    sections.forEach((s) => { if (s[0].getBoundingClientRect().top <= vh * 0.42) { label = s[1]; currentId = s[0].id; } });
    const live = !!liveFrom && liveFrom.getBoundingClientRect().top <= vh * 0.42;
    const flowRect = flowList && flowList.getBoundingClientRect();
    const stepTops = steps.map((li) => li.getBoundingClientRect().top);
    const pathRects = paths.map((a) => a.getBoundingClientRect());
    const sceneRect = scene && scene.getBoundingClientRect();
    const lapRect = laptop && laptop.getBoundingClientRect();
    const galRect = gallery && gallery.getBoundingClientRect();
    const pinRect = pin && pin.getBoundingClientRect();
    const bandRect = band && band.getBoundingClientRect();
    const ctaRect = cta && cta.getBoundingClientRect();
    const footRect = giant && footer.getBoundingClientRect();

    if (header) {
      header.classList.toggle('gx-compact', y > (vw <= 760 ? 40 : 90));
      header.classList.toggle('gx-live', live);
      header.style.setProperty('--pg', (y / Math.max(1, docH - vh)).toFixed(4));
      setLabel(label);
      navLinks.forEach((l) => l[0].classList.toggle('is-current', !!currentId && l[1] === currentId));
      tocLinks.forEach((l) => l[0].classList.toggle('is-current', !!currentId && l[1] === currentId));
    }
    if (hero) hero.style.setProperty('--sp', still ? '0' : clamp(y / (heroH * 0.8), 0, 1).toFixed(4));
    if (flowList) {
      const k = still ? 1 : clamp((vh * 0.88 - flowRect.top) / (vh * 0.5), 0, 1);
      const enter = still ? 1 : clamp((vh * 1.02 - flowRect.top) / (vh * 0.55), 0, 1);
      flowList.style.setProperty('--flow', k.toFixed(3));
      steps.forEach((li, i) => {
        li.style.setProperty('--e', still ? '1' : clamp((enter - i * 0.12) / 0.6, 0, 1).toFixed(3));
        li.classList.toggle('is-on', still || (vw > 1100 ? k >= (i + 0.6) / steps.length : stepTops[i] < vh * 0.72));
      });
    }
    paths.forEach((a, i) => a.style.setProperty('--e', still ? '1' : clamp((vh * 1.04 - pathRects[i].top) / (vh * 0.5), 0, 1).toFixed(3)));
    if (scene) scene.style.setProperty('--land', still ? '1' : along(sceneRect, vh, 1.2, 0.62).toFixed(3));
    if (laptop) laptop.style.setProperty('--lid', still ? '1' : along(lapRect, vh, 1.15, 0.62).toFixed(3));
    if (gallery) gallery.style.setProperty('--fan', still || vw <= 760 ? '1' : along(galRect, vh, 1.2, 0.62).toFixed(3));
    if (pin && words) scrub.style.setProperty('--scrub', Math.min(1, clamp(-pinRect.top / Math.max(1, pinRect.height - vh), 0, 1) * 1.18).toFixed(3));
    if (band && bandRect.bottom > -50 && bandRect.top < vh + 50) {
      const p = still ? 0.5 : through(bandRect, vh);
      if (bandRows[0]) bandRows[0].style.setProperty('--bx', Math.round(-120 - p * 900) + 'px');
      if (bandRows[1]) bandRows[1].style.setProperty('--bx', Math.round(-1100 + p * 900) + 'px');
    }
    const mb = markBody();
    if (mb && ctaRect) mb.style.setProperty('--mspin', still ? '0.5' : through(ctaRect, vh).toFixed(3));
    if (giant) giant.style.setProperty('--fe', still ? '1' : clamp((vh - footRect.top) / (vh * 0.7), 0, 1).toFixed(3));
    afterScroll(y, vh);
  };
  const requestScroll = () => { if (!ticking) ticking = requestAnimationFrame(onScroll); };
  addEventListener('scroll', requestScroll, { passive: true });
  addEventListener('resize', requestScroll);
  reduce.addEventListener('change', requestScroll);

  /* 8 · Hero: iPhones drehen sich zum Zeiger, ein Lichtkegel legt das Raster frei */
  const phones = hero && $('.design-phones', hero);
  if (hero && phones) {
    const spot = document.createElement('div');
    spot.className = 'gx-spot';
    spot.setAttribute('aria-hidden', 'true');
    hero.insertBefore(spot, hero.firstChild);
    let at = null, pr = 0;
    const turn = () => {
      pr = 0;
      if (!at) return;
      const r = hero.getBoundingClientRect();
      const x = at[0] / innerWidth - 0.5, yy = at[1] / innerHeight - 0.5;
      spot.style.setProperty('--cx', Math.round(at[0] - r.left) + 'px');
      spot.style.setProperty('--cy', Math.round(at[1] - r.top) + 'px');
      phones.style.setProperty('--sry', (x * 18).toFixed(2) + 'deg');
      phones.style.setProperty('--srx', (-yy * 8).toFixed(2) + 'deg');
      phones.style.setProperty('--shine', (62 - x * 80).toFixed(1) + '%');
    };
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || calm()) return;
      at = [e.clientX, e.clientY];
      spot.classList.add('on');
      if (!pr) pr = requestAnimationFrame(turn);
    }, { passive: true });
    hero.addEventListener('pointerleave', () => {
      at = null;
      spot.classList.remove('on');
      ['--sry', '--srx', '--shine'].forEach((k) => phones.style.removeProperty(k));
    });
  }

  /* 9 · Glas: Glanzpunkt folgt dem Zeiger, Flächen neigen sich, ein Lichtstrahl umkreist die Kante */
  const GLASS = '.auth-entry-inner,.auth-simple-main,.gx-sc,.about-topic,.card,.why-card,.check-item,.area-card,.damage-card,.location-option,.cta-inline,.about-contact,.learning-article>section,.connect-about figure,.gx-checklist,.gx-photoguide,.gx-audience-grid article,.gx-svc,.gx-hall,.design-paths article,.design-workflow li,.design-benefits article,.design-team-screens figure,.connect-wallet-demo,.connect-faq-list,.native-availability,.connect-join-action,.general-contact .portal-card,.about-home-teaser';
  const TILT = '.gx-sc,.card,.why-card,.check-item,.area-card,.damage-card,.connect-about figure,.gx-checklist,.gx-photoguide,.gx-audience-grid article,.gx-svc,.gx-hall,.design-paths article,.design-benefits article,.design-team-screens figure,.connect-wallet-demo,.native-availability,.connect-join-action,.about-home-teaser';
  let hot = null, hotAt = null, hotRaf = 0;
  const release = (el) => { el.classList.remove('gx-hot'); ['--mx', '--my', '--rx', '--ry'].forEach((k) => el.style.removeProperty(k)); };
  const shine = () => {
    hotRaf = 0;
    if (!hot || !hotAt) return;
    const r = hot.getBoundingClientRect(), x = hotAt[0] - r.left, y = hotAt[1] - r.top;
    hot.style.setProperty('--mx', Math.round(x) + 'px');
    hot.style.setProperty('--my', Math.round(y) + 'px');
    if (!calm() && hot.matches(TILT)) {
      const k = hot.classList.contains('connect-wallet-demo') ? 9 : hot.matches('.auth-entry-inner,.auth-simple-main') ? 2 : r.width > 900 ? 2.5 : 5;
      hot.style.setProperty('--rx', ((0.5 - y / r.height) * k).toFixed(2) + 'deg');
      hot.style.setProperty('--ry', ((x / r.width - 0.5) * k).toFixed(2) + 'deg');
    }
  };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !fine.matches) return;
    const el = e.target && e.target.closest ? e.target.closest(GLASS) : null;
    if (el !== hot) { if (hot) release(hot); hot = el; if (el) el.classList.add('gx-hot'); }
    if (!el) return;
    hotAt = [e.clientX, e.clientY];
    if (!hotRaf) hotRaf = requestAnimationFrame(shine);
  }, { passive: true });
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget && hot) { release(hot); hot = null; } });

  /* 10 · Magnetische Buttons */
  $$('.btn').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !fine.matches || calm()) return;
      const r = btn.getBoundingClientRect();
      btn.style.translate = ((e.clientX - r.left - r.width / 2) * 0.16).toFixed(1) + 'px ' + ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + 'px';
    });
    btn.addEventListener('pointerleave', () => { btn.style.translate = ''; });
  });

  /* 11 · Galerie auf dem Handy: Coverflow beim Wischen */
  if (gallery) {
    const shots = $$('.native-shot', gallery);
    let gr = 0;
    const flow = () => {
      gr = 0;
      const narrow = innerWidth <= 760 && !calm();
      const g = gallery.getBoundingClientRect(), mid = g.left + g.width / 2;
      const rects = shots.map((s) => s.getBoundingClientRect());
      shots.forEach((s, i) => {
        if (!narrow) { s.style.removeProperty('--cf'); s.style.removeProperty('--cfa'); return; }
        const k = clamp((rects[i].left + rects[i].width / 2 - mid) / Math.max(1, rects[i].width), -1, 1);
        s.style.setProperty('--cf', k.toFixed(3));
        s.style.setProperty('--cfa', Math.abs(k).toFixed(3));
      });
    };
    gallery.addEventListener('scroll', () => { if (!gr) gr = requestAnimationFrame(flow); }, { passive: true });
    addEventListener('resize', flow);
    reduce.addEventListener('change', flow);
    flow();
  }

  /* 12 · Beispielbeträge zählen beim Erscheinen hoch */
  const wallet = $('.connect-wallet-demo');
  if (wallet && motion && window.Intl) {
    const fmt = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const items = [];
    $$('strong', wallet).forEach((s) => {
      const tn = Array.prototype.find.call(s.childNodes, (n) => n.nodeType === 3 && /\d/.test(n.nodeValue));
      const m = tn && tn.nodeValue.match(/\d{1,3}(?:\.\d{3})*,\d{2}/);
      if (m) items.push({ tn, text: tn.nodeValue, match: m[0], value: parseFloat(m[0].replace(/\./g, '').replace(',', '.')) });
    });
    const count = () => {
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 1800), e = 1 - Math.pow(1 - k, 4);
        items.forEach((it) => { it.tn.nodeValue = it.text.replace(it.match, fmt.format(it.value * e)); });
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const wo = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      wo.disconnect();
      count();
    }, { threshold: 0 });
    if (items.length) wo.observe(wallet);
  }

  /* 13 · Die UNFALLX-Bildmarke als massiver, roter 3D-Körper: im Abschluss und in den Seitenköpfen der Unterseiten */
  const ctaWrap = $('.design-final-cta > .wrap');
  const headHost = null; // Seitenkoepfe der Unterseiten bleiben bewusst rein typografisch
  [ctaWrap, headHost].filter(Boolean).forEach((host, hostIndex) => {
    const shapes = ['M17.12 0 5.88 39.51 31.37 85.28 56.95 71.64Z', 'M70.54 18.28 44.76 31.52 82.82 99.97 94.09 60.52Z'];
    const mark = document.createElement('div');
    mark.className = 'gx-mark';
    mark.setAttribute('aria-hidden', 'true');
    const solid = document.createElement('div');
    solid.className = 'gx-mark-body';
    mark.appendChild(solid);
    const N = 20;
    for (let i = 0; i < N; i++) {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('class', 'gx-mark-l');
      svg.setAttribute('focusable', 'false');
      const front = i === N - 1, k = i / (N - 1);
      let fill = 'rgb(' + Math.round(60 + k * 150) + ',' + Math.round(k * 6) + ',' + Math.round(k * 4) + ')';
      if (front) {
        const defs = document.createElementNS(NS, 'defs');
        const grad = document.createElementNS(NS, 'linearGradient');
        grad.setAttribute('id', 'gx-face');
        grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0'); grad.setAttribute('x2', '1'); grad.setAttribute('y2', '1');
        [['0', '#ff9b92'], ['.32', '#ff1a10'], ['.7', '#e00000'], ['1', '#8e0000']].forEach((s) => {
          const stop = document.createElementNS(NS, 'stop');
          stop.setAttribute('offset', s[0]); stop.setAttribute('stop-color', s[1]);
          grad.appendChild(stop);
        });
        defs.appendChild(grad); svg.appendChild(defs);
        fill = 'url(#gx-face)';
      }
      shapes.forEach((d) => {
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d); path.setAttribute('fill', fill);
        if (front) { path.setAttribute('stroke', 'rgba(255,210,205,.55)'); path.setAttribute('stroke-width', '.6'); }
        svg.appendChild(path);
      });
      svg.style.setProperty('--z', ((i - (N - 1) / 2) * 1.5).toFixed(2) + 'px');
      solid.appendChild(svg);
    }
    if (host === headHost) { mark.classList.add('gx-headmark'); solid.querySelectorAll('#gx-face').forEach((g) => g.setAttribute('id', 'gx-face-h')); solid.querySelectorAll('[fill="url(#gx-face)"]').forEach((pth) => pth.setAttribute('fill', 'url(#gx-face-h)')); }
    host.insertBefore(mark, host.firstChild);
    const section = host === ctaWrap ? ctaWrap.parentElement : (host.closest('.page-head') || host);
    let ma = null, mr = 0;
    const tilt = () => {
      mr = 0;
      if (!ma) return;
      const r = section.getBoundingClientRect();
      const x = (ma[0] - r.left) / r.width - 0.5, y = (ma[1] - r.top) / r.height - 0.5;
      solid.style.setProperty('--mpy', (x * 40).toFixed(1) + 'deg');
      solid.style.setProperty('--mpx', (-y * 26).toFixed(1) + 'deg');
    };
    section.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || calm()) return;
      ma = [e.clientX, e.clientY];
      if (!mr) mr = requestAnimationFrame(tilt);
    }, { passive: true });
    section.addEventListener('pointerleave', () => { ma = null; solid.style.removeProperty('--mpy'); solid.style.removeProperty('--mpx'); });
  });

  /* 16 · Datenstrom: Leuchtpunkte fliegen vom iPhone zum Laptop */
  const sceneEl = $('.design-connection-scene');
  if (sceneEl && motion) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'gx-stream');
    svg.setAttribute('aria-hidden', 'true');
    const track = document.createElementNS(NS, 'path');
    svg.appendChild(track);
    const movers = [];
    for (let i = 0; i < 7; i++) {
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', i % 3 ? '2.3' : '3.4');
      dot.setAttribute('opacity', '0');
      const begin = (i * 0.34).toFixed(2) + 's';
      const move = document.createElementNS(NS, 'animateMotion');
      [['dur', '2.4s'], ['repeatCount', 'indefinite'], ['begin', begin], ['calcMode', 'spline'], ['keyTimes', '0;1'], ['keySplines', '.45 0 .55 1']].forEach((a) => move.setAttribute(a[0], a[1]));
      const fade = document.createElementNS(NS, 'animate');
      [['attributeName', 'opacity'], ['values', '0;1;1;0'], ['keyTimes', '0;.15;.85;1'], ['dur', '2.4s'], ['repeatCount', 'indefinite'], ['begin', begin]].forEach((a) => fade.setAttribute(a[0], a[1]));
      dot.appendChild(move);
      dot.appendChild(fade);
      svg.appendChild(dot);
      movers.push(move);
    }
    sceneEl.appendChild(svg);
    sceneEl.classList.add('gx-streamed');
    const local = (el) => { let x = 0, y = 0, e = el; while (e && e !== sceneEl) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; };
    const route = () => {
      const ph = $('.design-connection-phone .design-phone', sceneEl), lp = $('.design-laptop-screen', sceneEl);
      if (!ph || !lp) return;
      const a = local(ph), b = local(lp);
      const x1 = a.x + a.w, y1 = a.y + a.h * 0.45, x2 = b.x, y2 = b.y + b.h * 0.42, dx = x2 - x1, lift = Math.min(90, Math.max(30, dx * 0.5));
      const d = 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' C' + (x1 + dx * 0.35).toFixed(1) + ' ' + (y1 - lift).toFixed(1) + ' ' + (x2 - dx * 0.35).toFixed(1) + ' ' + (y2 - lift).toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1);
      track.setAttribute('d', d);
      movers.forEach((m) => m.setAttribute('path', d));
    };
    route();
    addEventListener('resize', route);
    addEventListener('load', route);
    if ('IntersectionObserver' in window && svg.pauseAnimations) {
      new IntersectionObserver((entries) => { if (entries[0].isIntersecting) svg.unpauseAnimations(); else svg.pauseAnimations(); }).observe(sceneEl);
    }
  }

  /* 19 · Licht-Schienen zwischen den Abschnitten */
  if (motion) {
    const ro = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('gx-on');
      ro.unobserve(e.target);
    }), { threshold: 1 });
    ['#fuer-wen', '#app-ablauf', '#app', '#leistungen', '#provision', '#iphone-app', '#vertrauen', '#kontakt', '#praxis', '#regionen', '#ratgeber', '#schadenbilder', '#standort'].forEach((sel) => {
      const sec = $(sel);
      if (!sec || !sec.parentNode) return;
      const rail = document.createElement('div');
      rail.className = 'gx-rail';
      rail.setAttribute('aria-hidden', 'true');
      rail.appendChild(document.createElement('i'));
      sec.parentNode.insertBefore(rail, sec);
      ro.observe(rail);
    });
  }

  /* 20 · Klick-Welle auf Buttons */
  document.addEventListener('pointerdown', (e) => {
    const b = e.target && e.target.closest ? e.target.closest('.btn,.ux-login,.gx-isl-cta') : null;
    if (!b || calm()) return;
    const r = b.getBoundingClientRect();
    const sp = document.createElement('span');
    sp.className = 'gx-ripple';
    sp.style.setProperty('--rx0', Math.round(e.clientX - r.left) + 'px');
    sp.style.setProperty('--ry0', Math.round(e.clientY - r.top) + 'px');
    b.appendChild(sp);
    sp.addEventListener('animationend', () => sp.remove());
  }, { passive: true });

  /* 21 · Screenshots werden per Scan aufgedeckt */
  if (motion) {
    const so = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('gx-in');
      so.unobserve(e.target);
    }), { threshold: 0.25 });
    $$('.design-team-screen,.design-workspace-shot,.about-topic-photo,.damage-card .cinema-frame').forEach((el) => {
      const w = document.createElement('i');
      w.className = 'gx-wipe';
      w.setAttribute('aria-hidden', 'true');
      el.appendChild(w);
      el.classList.add('gx-scanimg');
      so.observe(el);
    });
  }

  /* 22 · Leuchtender Kopf auf der Ablauf-Linie */
  if (flowList) {
    const headDot = document.createElement('i');
    headDot.className = 'gx-flowhead';
    headDot.setAttribute('aria-hidden', 'true');
    flowList.appendChild(headDot);
  }

  /* 23 · Scroll-Nachlauf: Typo-Band neigt sich mit der Scrollgeschwindigkeit */
  let lastY = scrollY, lastT = performance.now(), skew = 0, skewRaf = 0;
  const settleSkew = () => {
    skewRaf = 0;
    skew *= 0.86;
    if (Math.abs(skew) < 0.05) skew = 0;
    bandRows.forEach((r) => r.style.setProperty('--skew', skew.toFixed(2) + 'deg'));
    if (skew) skewRaf = requestAnimationFrame(settleSkew);
  };
  afterScroll = (y, vh) => {
    const now = performance.now(), v = (y - lastY) / Math.max(8, now - lastT);
    lastY = y; lastT = now;
    if (motion && bandRows.length) {
      skew = clamp(skew * 0.5 - v * 3, -9, 9);
      if (!skewRaf) skewRaf = requestAnimationFrame(settleSkew);
    }
  };

  /* 24 · Kapitel-Leiste am rechten Rand: zeigt, wo man gerade ist */
  const chapterList = [['#start', 'Start'], ['#partner', 'Partner'], ['#app-ablauf', 'Ablauf'], ['#aufnahme', 'Aufnahme'], ['#app', 'App & Portal'],
    ['#leistungen', 'Leistungen'], ['#provision', 'Vergütung'], ['#app-fragen', 'FAQ'], ['#iphone-app', 'iPhone-App'], ['#kontakt', 'Kontakt']]
    .map((c) => [$(c[0]), c[1]]).filter((c) => c[0]);
  let chapterNav = null;
  if (chapterList.length > 3) {
    chapterNav = document.createElement('nav');
    chapterNav.className = 'gx-chapters';
    chapterNav.setAttribute('aria-label', 'Seitenübersicht');
    chapterList.forEach((c) => {
      const a = document.createElement('a');
      a.href = '#' + c[0].id;
      const sp = document.createElement('span');
      sp.textContent = c[1];
      a.appendChild(sp);
      chapterNav.appendChild(a);
    });
    body.appendChild(chapterNav);
  }
  const chapterLinks = chapterNav ? $$('a', chapterNav) : [];
  const prevAfter = afterScroll;
  afterScroll = (y, vh) => {
    prevAfter(y, vh);
    if (!chapterNav) return;
    let idx = 0;
    chapterList.forEach((c, i) => { if (c[0].getBoundingClientRect().top <= vh * 0.42) idx = i; });
    chapterLinks.forEach((a, i) => { if (i === idx) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    chapterNav.classList.toggle('on', y > (hero ? hero.offsetHeight * 0.6 : vh * 0.6));
  };

  /* 25 · Social Media: Instagram & TikTok in Markenoptik. Links kommen aus dem Footer, damit sie nur an einer Stelle gepflegt werden. */
  const QR = { ig: 'M0 0h7v1h-7zM9 0h1v1h-1zM12 0h1v1h-1zM14 0h1v1h-1zM18 0h2v1h-2zM22 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM10 1h1v1h-1zM16 1h1v1h-1zM22 1h1v1h-1zM28 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM9 2h1v1h-1zM11 2h1v1h-1zM14 2h2v1h-2zM17 2h1v1h-1zM19 2h2v1h-2zM22 2h1v1h-1zM24 2h3v1h-3zM28 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM9 3h1v1h-1zM12 3h2v1h-2zM18 3h1v1h-1zM22 3h1v1h-1zM24 3h3v1h-3zM28 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM9 4h1v1h-1zM17 4h2v1h-2zM20 4h1v1h-1zM22 4h1v1h-1zM24 4h3v1h-3zM28 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h2v1h-2zM11 5h2v1h-2zM15 5h1v1h-1zM17 5h3v1h-3zM22 5h1v1h-1zM28 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h7v1h-7zM9 7h1v1h-1zM11 7h3v1h-3zM15 7h4v1h-4zM20 7h1v1h-1zM0 8h1v1h-1zM3 8h1v1h-1zM5 8h2v1h-2zM8 8h1v1h-1zM11 8h1v1h-1zM14 8h1v1h-1zM16 8h1v1h-1zM19 8h1v1h-1zM21 8h1v1h-1zM23 8h1v1h-1zM0 9h2v1h-2zM3 9h2v1h-2zM7 9h2v1h-2zM10 9h1v1h-1zM13 9h1v1h-1zM15 9h1v1h-1zM20 9h3v1h-3zM25 9h1v1h-1zM28 9h1v1h-1zM1 10h1v1h-1zM4 10h3v1h-3zM8 10h1v1h-1zM10 10h2v1h-2zM13 10h2v1h-2zM16 10h1v1h-1zM19 10h1v1h-1zM22 10h1v1h-1zM25 10h3v1h-3zM5 11h1v1h-1zM7 11h1v1h-1zM9 11h1v1h-1zM11 11h3v1h-3zM16 11h1v1h-1zM18 11h3v1h-3zM23 11h2v1h-2zM26 11h2v1h-2zM0 12h1v1h-1zM2 12h5v1h-5zM8 12h5v1h-5zM14 12h5v1h-5zM20 12h3v1h-3zM25 12h1v1h-1zM27 12h2v1h-2zM0 13h1v1h-1zM2 13h1v1h-1zM5 13h1v1h-1zM7 13h4v1h-4zM12 13h3v1h-3zM16 13h1v1h-1zM19 13h3v1h-3zM23 13h1v1h-1zM0 14h2v1h-2zM3 14h1v1h-1zM5 14h2v1h-2zM8 14h4v1h-4zM13 14h2v1h-2zM16 14h1v1h-1zM21 14h1v1h-1zM25 14h4v1h-4zM1 15h5v1h-5zM7 15h2v1h-2zM10 15h1v1h-1zM15 15h1v1h-1zM17 15h2v1h-2zM21 15h2v1h-2zM25 15h1v1h-1zM27 15h1v1h-1zM1 16h2v1h-2zM4 16h1v1h-1zM6 16h1v1h-1zM11 16h1v1h-1zM13 16h1v1h-1zM15 16h3v1h-3zM19 16h1v1h-1zM21 16h1v1h-1zM23 16h1v1h-1zM27 16h1v1h-1zM4 17h2v1h-2zM7 17h1v1h-1zM10 17h2v1h-2zM13 17h2v1h-2zM16 17h1v1h-1zM18 17h1v1h-1zM22 17h2v1h-2zM25 17h1v1h-1zM28 17h1v1h-1zM0 18h1v1h-1zM2 18h11v1h-11zM14 18h1v1h-1zM16 18h1v1h-1zM22 18h2v1h-2zM27 18h2v1h-2zM3 19h2v1h-2zM7 19h1v1h-1zM9 19h2v1h-2zM14 19h2v1h-2zM17 19h4v1h-4zM27 19h2v1h-2zM0 20h1v1h-1zM6 20h1v1h-1zM8 20h1v1h-1zM10 20h3v1h-3zM15 20h2v1h-2zM20 20h5v1h-5zM26 20h1v1h-1zM8 21h4v1h-4zM14 21h1v1h-1zM16 21h1v1h-1zM19 21h2v1h-2zM24 21h1v1h-1zM26 21h3v1h-3zM0 22h7v1h-7zM9 22h1v1h-1zM11 22h2v1h-2zM17 22h1v1h-1zM20 22h1v1h-1zM22 22h1v1h-1zM24 22h1v1h-1zM27 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM8 23h1v1h-1zM10 23h3v1h-3zM14 23h3v1h-3zM20 23h1v1h-1zM24 23h5v1h-5zM0 24h1v1h-1zM2 24h3v1h-3zM6 24h1v1h-1zM11 24h1v1h-1zM15 24h3v1h-3zM20 24h5v1h-5zM28 24h1v1h-1zM0 25h1v1h-1zM2 25h3v1h-3zM6 25h1v1h-1zM8 25h1v1h-1zM11 25h2v1h-2zM17 25h1v1h-1zM19 25h1v1h-1zM22 25h1v1h-1zM24 25h4v1h-4zM0 26h1v1h-1zM2 26h3v1h-3zM6 26h1v1h-1zM12 26h2v1h-2zM21 26h1v1h-1zM24 26h3v1h-3zM28 26h1v1h-1zM0 27h1v1h-1zM6 27h1v1h-1zM10 27h1v1h-1zM12 27h2v1h-2zM15 27h1v1h-1zM17 27h1v1h-1zM19 27h2v1h-2zM24 27h1v1h-1zM27 27h1v1h-1zM0 28h7v1h-7zM8 28h1v1h-1zM10 28h1v1h-1zM14 28h1v1h-1zM17 28h1v1h-1zM20 28h1v1h-1zM23 28h2v1h-2zM27 28h1v1h-1z', tt: 'M0 0h7v1h-7zM10 0h6v1h-6zM18 0h1v1h-1zM22 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM12 1h3v1h-3zM16 1h2v1h-2zM19 1h2v1h-2zM22 1h1v1h-1zM28 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h3v1h-3zM12 2h2v1h-2zM15 2h1v1h-1zM17 2h4v1h-4zM22 2h1v1h-1zM24 2h3v1h-3zM28 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM12 3h3v1h-3zM16 3h1v1h-1zM20 3h1v1h-1zM22 3h1v1h-1zM24 3h3v1h-3zM28 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM8 4h1v1h-1zM13 4h1v1h-1zM15 4h2v1h-2zM18 4h1v1h-1zM22 4h1v1h-1zM24 4h3v1h-3zM28 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h1v1h-1zM10 5h1v1h-1zM14 5h1v1h-1zM16 5h1v1h-1zM18 5h2v1h-2zM22 5h1v1h-1zM28 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h7v1h-7zM9 7h3v1h-3zM13 7h1v1h-1zM15 7h1v1h-1zM17 7h4v1h-4zM1 8h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1zM8 8h1v1h-1zM10 8h1v1h-1zM13 8h3v1h-3zM17 8h1v1h-1zM19 8h3v1h-3zM23 8h2v1h-2zM26 8h1v1h-1zM0 9h1v1h-1zM2 9h2v1h-2zM5 9h1v1h-1zM8 9h1v1h-1zM10 9h2v1h-2zM13 9h3v1h-3zM17 9h2v1h-2zM22 9h1v1h-1zM24 9h2v1h-2zM27 9h2v1h-2zM1 10h1v1h-1zM4 10h1v1h-1zM6 10h5v1h-5zM13 10h1v1h-1zM15 10h1v1h-1zM18 10h1v1h-1zM21 10h1v1h-1zM25 10h2v1h-2zM28 10h1v1h-1zM2 11h2v1h-2zM5 11h1v1h-1zM8 11h1v1h-1zM10 11h4v1h-4zM15 11h1v1h-1zM17 11h1v1h-1zM19 11h3v1h-3zM24 11h1v1h-1zM27 11h2v1h-2zM0 12h1v1h-1zM2 12h1v1h-1zM4 12h3v1h-3zM16 12h2v1h-2zM23 12h1v1h-1zM25 12h1v1h-1zM28 12h1v1h-1zM0 13h3v1h-3zM5 13h1v1h-1zM7 13h2v1h-2zM10 13h1v1h-1zM12 13h2v1h-2zM15 13h1v1h-1zM17 13h1v1h-1zM22 13h1v1h-1zM24 13h1v1h-1zM26 13h1v1h-1zM28 13h1v1h-1zM1 14h1v1h-1zM3 14h5v1h-5zM10 14h1v1h-1zM12 14h7v1h-7zM20 14h1v1h-1zM24 14h1v1h-1zM28 14h1v1h-1zM0 15h1v1h-1zM3 15h1v1h-1zM5 15h1v1h-1zM8 15h2v1h-2zM11 15h3v1h-3zM15 15h3v1h-3zM19 15h2v1h-2zM23 15h1v1h-1zM25 15h1v1h-1zM2 16h3v1h-3zM6 16h5v1h-5zM17 16h1v1h-1zM19 16h3v1h-3zM27 16h2v1h-2zM0 17h2v1h-2zM3 17h1v1h-1zM5 17h1v1h-1zM8 17h2v1h-2zM11 17h1v1h-1zM18 17h1v1h-1zM23 17h2v1h-2zM28 17h1v1h-1zM3 18h2v1h-2zM6 18h1v1h-1zM9 18h4v1h-4zM14 18h5v1h-5zM20 18h1v1h-1zM24 18h1v1h-1zM26 18h1v1h-1zM28 18h1v1h-1zM2 19h1v1h-1zM8 19h2v1h-2zM11 19h2v1h-2zM14 19h4v1h-4zM20 19h1v1h-1zM24 19h2v1h-2zM0 20h3v1h-3zM5 20h2v1h-2zM8 20h1v1h-1zM11 20h1v1h-1zM14 20h1v1h-1zM16 20h2v1h-2zM19 20h7v1h-7zM27 20h2v1h-2zM8 21h4v1h-4zM14 21h5v1h-5zM20 21h1v1h-1zM24 21h1v1h-1zM26 21h1v1h-1zM28 21h1v1h-1zM0 22h7v1h-7zM9 22h1v1h-1zM11 22h1v1h-1zM13 22h1v1h-1zM15 22h1v1h-1zM17 22h4v1h-4zM22 22h1v1h-1zM24 22h1v1h-1zM28 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM10 23h1v1h-1zM12 23h1v1h-1zM14 23h1v1h-1zM16 23h2v1h-2zM19 23h2v1h-2zM24 23h2v1h-2zM27 23h2v1h-2zM0 24h1v1h-1zM2 24h3v1h-3zM6 24h1v1h-1zM8 24h1v1h-1zM11 24h2v1h-2zM14 24h2v1h-2zM17 24h1v1h-1zM19 24h6v1h-6zM27 24h1v1h-1zM0 25h1v1h-1zM2 25h3v1h-3zM6 25h1v1h-1zM9 25h1v1h-1zM11 25h1v1h-1zM17 25h1v1h-1zM23 25h1v1h-1zM25 25h3v1h-3zM0 26h1v1h-1zM2 26h3v1h-3zM6 26h1v1h-1zM9 26h2v1h-2zM12 26h1v1h-1zM14 26h4v1h-4zM19 26h3v1h-3zM25 26h4v1h-4zM0 27h1v1h-1zM6 27h1v1h-1zM8 27h2v1h-2zM12 27h2v1h-2zM15 27h9v1h-9zM25 27h1v1h-1zM27 27h2v1h-2zM0 28h7v1h-7zM9 28h1v1h-1zM11 28h1v1h-1zM15 28h1v1h-1zM17 28h1v1h-1zM20 28h1v1h-1zM24 28h2v1h-2zM27 28h1v1h-1z' };
  const IG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5.2"/><circle cx="12" cy="12" r="4.1"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>';
  const TT_D = 'M16.7 2c.4 2.8 2 4.5 4.8 4.7v3.1a9.1 9.1 0 0 1-4.8-1.4v7.1a6.2 6.2 0 1 1-5.4-6.1v3.2a3 3 0 1 0 2.2 2.9V2z';
  const TT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + TT_D + '" fill="#25f4ee" transform="translate(-.9 -.7)"/><path d="' + TT_D + '" fill="#fe2c55" transform="translate(.9 .7)"/><path d="' + TT_D + '" fill="#fff"/></svg>';
  const socials = $$('.connect-footer-social a[href]').map((a) => {
    const ig = /instagram\.com/i.test(a.href), tt = /tiktok\.com/i.test(a.href);
    const small = a.querySelector('small');
    return { a, ig, tt, href: a.href, name: ig ? 'Instagram' : 'TikTok', handle: small ? small.textContent.trim() : '@unfallx' };
  }).filter((x) => x.ig || x.tt);
  const fromHTML = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
  const label = (x) => x.name + ' ' + x.handle + ' – öffnet in neuem Tab';
  socials.forEach((x) => {
    const old = x.a.querySelector('svg');
    if (old) old.replaceWith(fromHTML(x.ig ? IG_ICON : TT_ICON));
    x.a.classList.add(x.ig ? 'gx-ig' : 'gx-tt');
    x.a.setAttribute('aria-label', label(x));
  });
  const mini = (x, extra) => {
    const a = document.createElement('a');
    a.className = 'gx-sm ' + (x.ig ? 'gx-ig' : 'gx-tt') + (extra || '');
    a.href = x.href; a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', label(x));
    const i = document.createElement('i');
    i.appendChild(fromHTML(x.ig ? IG_ICON : TT_ICON));
    const sp = document.createElement('span');
    sp.textContent = x.name;
    a.appendChild(i); a.appendChild(sp);
    return a;
  };
  if (socials.length) {
    // Kontaktbereich der Startseite
    const contactCol = $('#kontakt.general-contact > div');
    if (contactCol && !$('.gx-social-mini', contactCol)) {
      const row = document.createElement('div');
      row.className = 'gx-social-mini';
      const cap = document.createElement('span');
      cap.textContent = 'Folge UNFALLX';
      row.appendChild(cap);
      socials.forEach((x) => row.appendChild(mini(x)));
      contactCol.appendChild(row);
    }
    // Handy-Menue
    const menuBox = $('.mobile-menu-inner');
    if (menuBox && !$('.gx-menu-social', menuBox)) {
      const row = document.createElement('div');
      row.className = 'gx-menu-social';
      socials.forEach((x) => row.appendChild(mini(x)));
      menuBox.appendChild(row);
    }
    // Eigener Abschnitt auf „Über uns“ – vor dem Kontakt
    const aboutContact = $('.about-contact');
    if (aboutContact && !$('#social')) {
      const sec = document.createElement('section');
      sec.className = 'gx-social wrap';
      sec.id = 'social';
      sec.setAttribute('aria-labelledby', 'social-title');
      const head = document.createElement('div');
      head.className = 'gx-social-head';
      head.innerHTML = '<span class="eyebrow">SOCIAL MEDIA</span><h2 id="social-title"><span class="gx-ln"><span class="gx-li">UNFALLX auf</span></span> <span class="gx-ln"><span class="gx-li">Instagram und TikTok.</span></span></h2><p>Neuigkeiten und Einblicke von UNFALLX – direkt in Ihrem Feed.</p>';
      const grid = document.createElement('div');
      grid.className = 'gx-social-grid';
      socials.forEach((x) => {
        const card = document.createElement('a');
        card.className = 'gx-sc ' + (x.ig ? 'gx-sc-ig' : 'gx-sc-tt');
        card.href = x.href; card.target = '_blank'; card.rel = 'noopener';
        card.setAttribute('aria-label', label(x));
        card.innerHTML = '<span class="gx-sc-ico">' + (x.ig ? IG_ICON : TT_ICON) + '</span>'
          + '<span class="gx-sc-txt"><strong></strong><small></small></span>'
          + '<span class="gx-sc-cta">Profil öffnen <b aria-hidden="true">↗</b></span>'
          + '<span class="gx-sc-qr" aria-hidden="true"><svg viewBox="-2 -2 33 33" shape-rendering="crispEdges"><path fill="#000" d="' + (x.ig ? QR.ig : QR.tt) + '"/></svg><em>Mit dem Handy scannen</em></span>';
        $('strong', card).textContent = x.name;
        $('small', card).textContent = x.handle;
        grid.appendChild(card);
      });
      sec.appendChild(head);
      sec.appendChild(grid);
      aboutContact.parentNode.insertBefore(sec, aboutContact);
      if (motion && 'IntersectionObserver' in window) {
        const parts = [head].concat($$('.gx-sc', grid));
        parts.forEach((el, k) => { el.classList.add('gx-rv'); el.style.setProperty('--d', (k * 0.1).toFixed(2) + 's'); });
        $('h2', head).classList.remove('gx-up');
        const so2 = new IntersectionObserver((entries) => entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('gx-in');
          const h = e.target.querySelector && e.target.querySelector('h2');
          if (h) h.classList.add('gx-up');
          so2.unobserve(e.target);
        }), { threshold: 0, rootMargin: '0px 0px -6% 0px' });
        parts.forEach((el) => so2.observe(el));
      } else $('h2', head).classList.add('gx-up');
    }
  }

  /* 26 · Login-Bereich: Theme-Schalter, Lade-Lichtlauf am Button, Karte schüttelt bei Fehlern. Die Anmelde-Logik bleibt unberührt. */
  if (body.classList.contains('auth-page')) {
    if (!$('.ux-header-actions')) {
      const tb = document.createElement('button');
      tb.type = 'button';
      tb.className = 'gx-auth-theme';
      tb.setAttribute('aria-label', 'Helle Darstellung');
      tb.title = 'Hell / Dunkel';
      tb.innerHTML = SUN + MOON;
      tb.addEventListener('click', () => { const r = tb.getBoundingClientRect(); switchTheme(!isLight(), r.left + r.width / 2, r.top + r.height / 2); });
      const simpleHead = $('.auth-simple-header');
      if (simpleHead) { tb.classList.add('gx-auth-theme-inline'); simpleHead.appendChild(tb); } else body.appendChild(tb);
      themeViews.push((light) => {
        tb.setAttribute('aria-pressed', String(light));
        tb.setAttribute('aria-label', light ? 'Dunkle Darstellung' : 'Helle Darstellung');
      });
      syncTheme();
    }
    const authCard = $('.auth-entry-inner') || $('.auth-simple-main');
    const authMsg = $('#auth-message');
    const clearBusy = () => $$('.gx-busy').forEach((b) => b.classList.remove('gx-busy'));
    if (authCard && authMsg && 'MutationObserver' in window) {
      new MutationObserver(() => {
        clearBusy();
        if (authMsg.classList.contains('portal-error') && !calm()) {
          authCard.classList.remove('gx-shake');
          void authCard.offsetWidth;
          authCard.classList.add('gx-shake');
        }
      }).observe(authMsg, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      authCard.addEventListener('animationend', (e) => { if (e.animationName === 'gx-shake') authCard.classList.remove('gx-shake'); });
    }
    $$('form', authCard || body).forEach((f) => f.addEventListener('submit', () => {
      const b = f.querySelector('button[type="submit"]');
      if (!b) return;
      b.classList.add('gx-busy');
      setTimeout(() => b.classList.remove('gx-busy'), 8000);
    }));
  }

  /* 27 · Login-Hintergrund: ein Feld feiner Linien fließt langsam wie eine Messlandschaft,
         ein dezenter roter Lichtlauf wandert darüber, am Rechner wölben sich die Linien um den Zeiger. */
  if (body.classList.contains('auth-page')) {
    const cv = document.createElement('canvas');
    cv.className = 'gx-lines';
    cv.setAttribute('aria-hidden', 'true');
    body.insertBefore(cv, body.firstChild);
    const g = cv.getContext && cv.getContext('2d');
    if (g) {
      let W = 0, H = 0, raf = 0, last = 0, tx = -1, ty = -1, mx = -1, my = -1;
      const t0 = performance.now();
      const size = () => {
        const dpr = Math.min(1.5, window.devicePixelRatio || 1);
        W = innerWidth; H = innerHeight;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      const draw = (now) => {
        const t = now - t0, light = isLight(), small = W < 760;
        const lines = small ? 30 : 56, pts = small ? 72 : 132;
        const top = H * (small ? 0.12 : 0.26), bottom = H * 1.04;
        g.clearRect(0, 0, W, H);
        const p = 0.5 + 0.42 * Math.sin(t * 0.00011);
        const grad = g.createLinearGradient(0, 0, W, 0);
        const base = light ? '29,29,31' : '255,255,255';
        const a0 = Math.max(0, p - 0.16), a1 = Math.min(1, p + 0.16);
        grad.addColorStop(0, 'rgba(' + base + ',1)');
        grad.addColorStop(a0, 'rgba(' + base + ',1)');
        grad.addColorStop(p, 'rgba(255,36,26,1)');
        grad.addColorStop(a1, 'rgba(' + base + ',1)');
        grad.addColorStop(1, 'rgba(' + base + ',1)');
        g.strokeStyle = grad;
        for (let i = 0; i < lines; i++) {
          const k = i / (lines - 1), depth = Math.pow(k, 1.75);
          const baseY = top + (bottom - top) * depth, amp = 8 + 48 * depth, spread = 0.8 + 0.55 * depth;
          g.beginPath();
          for (let j = 0; j <= pts; j++) {
            const u = j / pts, x = W * 0.5 + (u - 0.5) * W * spread * 1.3;
            const n = Math.sin(u * 6.1 + t * 0.00021 + i * 0.33) * 0.55 + Math.sin(u * 12.7 - t * 0.00016 + i * 0.19) * 0.28 + Math.sin(u * 2.4 + t * 0.0001 - i * 0.11) * 0.62;
            let y = baseY - n * amp;
            if (mx >= 0) { const dx = x - mx, dy = baseY - my; y -= Math.exp(-(dx * dx) / 24000 - (dy * dy) / 52000) * 42 * depth; }
            if (j) g.lineTo(x, y); else g.moveTo(x, y);
          }
          g.globalAlpha = (light ? 0.05 : 0.045) + (light ? 0.2 : 0.22) * depth;
          g.lineWidth = 0.6 + 0.85 * depth;
          g.stroke();
        }
        g.globalAlpha = 1;
      };
      const frame = (now) => {
        raf = 0;
        if (document.hidden) return;
        if (!fine.matches && now - last < 33) { raf = requestAnimationFrame(frame); return; }
        last = now;
        if (tx >= 0) { mx = mx < 0 ? tx : mx + (tx - mx) * 0.08; my = my < 0 ? ty : my + (ty - my) * 0.08; } else { mx = -1; my = -1; }
        draw(now);
        raf = requestAnimationFrame(frame);
      };
      const still = () => draw(t0 + 9000);
      size();
      if (calm()) still(); else raf = requestAnimationFrame(frame);
      addEventListener('resize', () => { size(); if (calm()) still(); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden && !calm() && !raf) raf = requestAnimationFrame(frame); });
      addEventListener('pointermove', (e) => { if (e.pointerType === 'touch' || calm()) return; tx = e.clientX; ty = e.clientY; }, { passive: true });
      document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) { tx = -1; ty = -1; } });
      themeViews.push(() => { if (calm()) still(); });
    }
  }

  onScroll();

  /* 14 · Übergänge freischalten: Das Basis-Stylesheet sperrt sie bis html.theme-ready.
         Erst Startzustände ohne Übergang anwenden, dann freigeben – so blitzt nichts auf. */
  void document.body.offsetWidth;
  document.documentElement.classList.add('theme-ready');
})();
