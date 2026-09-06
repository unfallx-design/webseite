/* UNFALLX – kleine Helfer, ohne Framework */
(function () {
  'use strict';

  /* Jahreszahl im Footer */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });



  var sanft = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Lesefortschritt oben */
  var progress = document.querySelector('[data-progress]');
  if (progress && !sanft) {
    var ticking = false;
    var zeichne = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var anteil = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      progress.style.transform = 'scaleX(' + anteil + ')';
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(zeichne); }
    }, { passive: true });
    zeichne();
  }

  /* Abschnitte blenden beim Scrollen ein */
  var teile = document.querySelectorAll('.reveal');
  if (teile.length) {
    if (sanft || !('IntersectionObserver' in window)) {
      teile.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
      var beobachter = new IntersectionObserver(function (eintraege) {
        eintraege.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-visible');
          beobachter.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

      /* Elemente einer Gruppe leicht versetzt einblenden */
      var gruppen = {};
      teile.forEach(function (el) {
        var key = el.getAttribute('data-group') || 'x';
        gruppen[key] = (gruppen[key] || 0);
        el.style.setProperty('--d', Math.min(gruppen[key] * 70, 350) + 'ms');
        gruppen[key]++;
        beobachter.observe(el);
      });
    }
  }

  /* Header bekommt beim Scrollen mehr Deckkraft */
  var header = document.querySelector('[data-header]');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Mega-Menü */
  var megaTriggers = document.querySelectorAll('[data-mega-trigger]');
  if (megaTriggers.length) {
    var schliesseAlleMegas = function () {
      megaTriggers.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    };
    megaTriggers.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var offen = btn.getAttribute('aria-expanded') === 'true';
        schliesseAlleMegas();
        btn.setAttribute('aria-expanded', String(!offen));
      });
    });
    document.querySelectorAll('.mega').forEach(function (m) {
      m.addEventListener('click', function (e) {
        if (e.target.closest('a')) schliesseAlleMegas();
      });
    });
    document.addEventListener('click', schliesseAlleMegas);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') schliesseAlleMegas();
    });
  }

  /* Mobiles Menü */
  var toggle = document.querySelector('[data-nav-toggle]');
  var menu = document.getElementById('mobile-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      menu.setAttribute('data-open', String(!open));
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        toggle.setAttribute('aria-expanded', 'false');
        menu.setAttribute('data-open', 'false');
      }
    });
  }

  /* Schadenmeldung: baut aus den Angaben eine vorbereitete E-Mail */
  var form = document.getElementById('schadenform');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var get = function (k) { return (data.get(k) || '').toString().trim(); };

      var lines = [];
      [['Name', 'name'], ['Telefon', 'telefon'], ['E-Mail', 'email'],
       ['Unfalldatum', 'datum'], ['Fahrzeug', 'fahrzeug']].forEach(function (pair) {
        if (get(pair[1])) lines.push(pair[0] + ': ' + get(pair[1]));
      });
      if (get('beschreibung')) {
        lines.push('', 'Was ist passiert:', get('beschreibung'));
      }
      lines.push('', '— gesendet über unfallx.com');

      var betreff = 'Schadenmeldung' + (get('name') ? ' – ' + get('name') : '');
      var href = 'mailto:info@unfallx.com'
        + '?subject=' + encodeURIComponent(betreff)
        + '&body=' + encodeURIComponent(lines.join('\n'));

      window.location.href = href;

      var status = document.getElementById('form-status');
      if (status) {
        status.textContent = 'Ihr E-Mail-Programm wurde mit den Angaben geöffnet. '
          + 'Falls sich nichts tut, schreiben Sie bitte direkt an info@unfallx.com.';
      }
    });
  }
})();
