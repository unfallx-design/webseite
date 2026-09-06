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

  /* Theme-Umschalter (Tag/Nacht) */
  var themeButtons = document.querySelectorAll('[data-theme-toggle]');
  if (themeButtons.length) {
    var aktuellesTheme = function () {
      return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    };
    var setzeThemeButtons = function () {
      var istHell = aktuellesTheme() === 'light';
      themeButtons.forEach(function (b) { b.setAttribute('aria-pressed', String(istHell)); });
    };
    var wendeTheme = function () {
      var naechstes = aktuellesTheme() === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', naechstes);
      try { localStorage.setItem('unfallx-theme', naechstes); } catch (e) {}
      setzeThemeButtons();
    };
    setzeThemeButtons();
    themeButtons.forEach(function (b) { b.addEventListener('click', wendeTheme); });
  }

  /* Sprachumschalter (Deutsch/Englisch/Russisch) */
  var langButtons = document.querySelectorAll('[data-lang-switch] button');
  if (langButtons.length && window.UNFALLX_I18N) {
    var woerterbuch = window.UNFALLX_I18N;
    var i18nElemente = document.querySelectorAll('[data-i18n]');
    var i18nPlatzhalter = document.querySelectorAll('[data-i18n-placeholder]');
    var original = {};
    var originalPlatzhalter = {};
    i18nElemente.forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!(key in original)) original[key] = el.innerHTML;
    });
    i18nPlatzhalter.forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (!(key in originalPlatzhalter)) originalPlatzhalter[key] = el.getAttribute('placeholder');
    });

    var setzeSprache = function (lang) {
      i18nElemente.forEach(function (el) {
        var key = el.getAttribute('data-i18n');
        if (lang === 'de') {
          el.innerHTML = original[key];
        } else if (woerterbuch[lang] && woerterbuch[lang][key] != null) {
          el.innerHTML = woerterbuch[lang][key];
        }
      });
      i18nPlatzhalter.forEach(function (el) {
        var key = el.getAttribute('data-i18n-placeholder');
        if (lang === 'de') {
          el.setAttribute('placeholder', originalPlatzhalter[key]);
        } else if (woerterbuch[lang] && woerterbuch[lang][key] != null) {
          el.setAttribute('placeholder', woerterbuch[lang][key]);
        }
      });
      langButtons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
      });
      document.documentElement.setAttribute('lang', lang);
      document.querySelectorAll('[data-lang-notice]').forEach(function (n) {
        n.hidden = (lang === 'de');
      });
      try { localStorage.setItem('unfallx-lang', lang); } catch (e) {}
    };

    langButtons.forEach(function (b) {
      b.addEventListener('click', function () { setzeSprache(b.getAttribute('data-lang')); });
    });

    var gespeicherteSprache = 'de';
    try { gespeicherteSprache = localStorage.getItem('unfallx-lang') || 'de'; } catch (e) {}
    if (gespeicherteSprache !== 'de') setzeSprache(gespeicherteSprache);
  }

  /* Anfrageformular: sendet die Angaben an /api/anfrage */
  var form = document.getElementById('schadenform');
  if (form) {
    var status = document.getElementById('form-status');
    var submit = form.querySelector('button[type="submit"]');
    var t0 = form.querySelector('[name="t0"]');
    if (t0) t0.value = String(Date.now());

    var setzeStatus = function (text, art) {
      if (!status) return;
      status.textContent = text;
      status.className = 'form-note field-full' + (art ? ' is-' + art : '');
    };
    var markiere = function (felder) {
      form.querySelectorAll('.field.has-error').forEach(function (f) { f.classList.remove('has-error'); });
      form.querySelectorAll('.field-error').forEach(function (e) { e.remove(); });
      var erstes = null;
      Object.keys(felder || {}).forEach(function (name) {
        var input = form.querySelector('[name="' + name + '"]');
        var feld = input && input.closest('.field');
        if (!feld) return;
        feld.classList.add('has-error');
        var hint = document.createElement('span');
        hint.className = 'field-error';
        hint.setAttribute('role', 'alert');
        hint.textContent = felder[name];
        feld.appendChild(hint);
        input.setAttribute('aria-invalid', 'true');
        if (!erstes) erstes = input;
      });
      if (erstes) erstes.focus();
    };
    form.addEventListener('input', function (e) {
      var feld = e.target.closest && e.target.closest('.field.has-error');
      if (feld) {
        feld.classList.remove('has-error');
        var err = feld.querySelector('.field-error');
        if (err) err.remove();
        e.target.removeAttribute('aria-invalid');
      }
    });

    /* Fotos als Base64 einlesen (nur JPG/PNG/WebP, max. 3 Stueck, je 5 MB) */
    var fotoInput = form.querySelector('input[type="file"]');
    var fotoListe = form.querySelector('[data-foto-liste]');
    var erlaubt = ['image/jpeg', 'image/png', 'image/webp'];
    var zeigeFotos = function () {
      if (!fotoListe || !fotoInput) return;
      fotoListe.textContent = '';
      Array.prototype.slice.call(fotoInput.files || []).slice(0, 3).forEach(function (f) {
        var li = document.createElement('li');
        li.textContent = f.name + ' (' + Math.round(f.size / 1024) + ' KB)';
        if (erlaubt.indexOf(f.type) < 0) { li.textContent += ' – Format nicht unterstützt'; li.className = 'is-error'; }
        else if (f.size > 5 * 1024 * 1024) { li.textContent += ' – zu groß (max. 5 MB)'; li.className = 'is-error'; }
        fotoListe.appendChild(li);
      });
    };
    if (fotoInput) fotoInput.addEventListener('change', zeigeFotos);

    var leseFotos = function () {
      if (!fotoInput || !fotoInput.files || !fotoInput.files.length) return Promise.resolve([]);
      var dateien = Array.prototype.slice.call(fotoInput.files).slice(0, 3);
      return Promise.all(dateien.map(function (f) {
        return new Promise(function (resolve, reject) {
          if (erlaubt.indexOf(f.type) < 0) return reject(new Error('Bitte nur Fotos im Format JPG, PNG oder WebP hochladen.'));
          if (f.size > 5 * 1024 * 1024) return reject(new Error('Jedes Foto darf höchstens 5 MB groß sein.'));
          var r = new FileReader();
          r.onload = function () {
            var data = String(r.result || '');
            resolve({ name: f.name, type: f.type, data: data.slice(data.indexOf(',') + 1) });
          };
          r.onerror = function () { reject(new Error('Ein Foto konnte nicht gelesen werden.')); };
          r.readAsDataURL(f);
        });
      }));
    };

    var sammle = function () {
      var fd = new FormData(form);
      var get = function (k) { return (fd.get(k) || '').toString(); };
      return {
        name: get('name'), telefon: get('telefon'), email: get('email'),
        ort: get('ort'), datum: get('datum'), fahrzeug: get('fahrzeug'),
        beschreibung: get('beschreibung'), anliegen: get('anliegen'),
        kontaktweg: get('kontaktweg') || 'telefon',
        datenschutz: !!form.querySelector('[name="datenschutz"]:checked'),
        website: get('website'), t0: get('t0')
      };
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.getAttribute('data-sending') === 'true') return;
      form.setAttribute('data-sending', 'true');
      if (submit) { submit.disabled = true; submit.setAttribute('aria-busy', 'true'); }
      setzeStatus('Ihre Anfrage wird übermittelt …', 'pending');

      var daten = sammle();
      leseFotos().then(function (fotos) {
        daten.fotos = fotos;
        return fetch('/api/anfrage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(daten)
        });
      }).then(function (res) {
        return res.json().then(function (json) { return { status: res.status, json: json }; });
      }).then(function (r) {
        if (r.json && r.json.ok) {
          form.reset();
          if (fotoListe) fotoListe.textContent = '';
          var erfolg = form.parentNode.querySelector('[data-form-success]');
          if (erfolg) {
            form.hidden = true;
            erfolg.hidden = false;
            erfolg.setAttribute('tabindex', '-1');
            erfolg.focus();
          } else {
            setzeStatus('Vielen Dank. Ihre Anfrage wurde erfolgreich übermittelt. Wir melden uns schnellstmöglich bei Ihnen.', 'success');
          }
          return;
        }
        if (r.status === 422 && r.json && r.json.felder) {
          markiere(r.json.felder);
          setzeStatus(r.json.error || 'Bitte prüfen Sie die markierten Felder.', 'error');
          return;
        }
        setzeStatus((r.json && r.json.error) || 'Die Anfrage konnte gerade nicht übermittelt werden. Bitte rufen Sie uns an: 0176 64 365 185.', 'error');
      }).catch(function (err) {
        setzeStatus((err && err.message) || 'Keine Verbindung. Bitte prüfen Sie Ihr Netz oder rufen Sie uns an: 0176 64 365 185.', 'error');
      }).then(function () {
        form.removeAttribute('data-sending');
        if (submit) { submit.disabled = false; submit.removeAttribute('aria-busy'); }
        if (t0) t0.value = String(Date.now());
      });
    });
  }
})();
