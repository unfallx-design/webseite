/* UNFALLX – kleine Helfer, ohne Framework */
(function () {
  'use strict';

  /* Jahreszahl im Footer */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });


  /* Header bekommt beim Scrollen mehr Deckkraft */
  var header = document.querySelector('[data-header]');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
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
