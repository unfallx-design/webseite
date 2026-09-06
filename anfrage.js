/**
 * UNFALLX – Anfrageformular (Backend)
 *
 * Nimmt POST /api/anfrage als JSON entgegen, prueft und bereinigt die Angaben
 * und leitet sie per E-Mail weiter. Ohne konfigurierten Mailversand werden
 * Anfragen als Datei unter data/anfragen/ abgelegt, damit nichts verloren geht.
 *
 * Schutzmassnahmen: Groessenlimit, Rate-Limit je IP, Honeypot, Mindestzeit
 * seit Seitenaufruf, serverseitige Validierung, Escaping in der E-Mail,
 * Dateiuploads nur als JPEG/PNG/WebP mit Magic-Byte-Pruefung und Groessenlimit.
 *
 * Konfiguration ausschliesslich ueber Umgebungsvariablen (Hostinger: hPanel):
 *   SMTP_HOST     z. B. smtp.hostinger.com
 *   SMTP_PORT     465 (TLS) oder 587 (STARTTLS)
 *   SMTP_SECURE   "true" fuer Port 465, sonst "false"
 *   SMTP_USER     Postfach, z. B. info@unfallx.com
 *   SMTP_PASS     Passwort des Postfachs
 *   MAIL_TO       Empfaenger der Anfragen (Standard: info@unfallx.com)
 *   MAIL_FROM     Absender (Standard: SMTP_USER)
 *   ANFRAGE_LIMIT Anfragen je IP und 10 Minuten (Standard: 8)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const MAX_BODY = 12 * 1024 * 1024;        // 12 MB inkl. Fotos (Base64)
const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;   // 5 MB je Foto
const MIN_FORM_MS = 3000;                 // Mindestzeit zwischen Laden und Senden
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = Math.max(1, parseInt(process.env.ANFRAGE_LIMIT || '8', 10) || 8);
const MAIL_TO = (process.env.MAIL_TO || 'info@unfallx.com').trim();
const DATA_DIR = path.join(__dirname, 'data', 'anfragen');

/* nodemailer ist optional: fehlt es, greift der Datei-Fallback */
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (e) { nodemailer = null; }

function mailerKonfiguriert() {
  return !!(nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/* ---------- Rate-Limit (im Speicher, je Prozess) ------------------------- */

const treffer = new Map();
function rateLimited(ip) {
  const jetzt = Date.now();
  const liste = (treffer.get(ip) || []).filter((t) => jetzt - t < WINDOW_MS);
  if (liste.length >= LIMIT) { treffer.set(ip, liste); return true; }
  liste.push(jetzt);
  treffer.set(ip, liste);
  if (treffer.size > 5000) {
    treffer.forEach((v, k) => { if (!v.length || jetzt - v[v.length - 1] > WINDOW_MS) treffer.delete(k); });
  }
  return false;
}

function clientIp(req) {
  const xf = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || (req.socket && req.socket.remoteAddress) || 'unbekannt';
}

/* ---------- Hilfsfunktionen ---------------------------------------------- */

function text(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, max);
}
function einzeilig(v, max) {
  return text(v, max).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function istEmail(s) {
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,24}$/i.test(s);
}
function istTelefon(s) {
  const ziffern = s.replace(/[^\d]/g, '');
  return /^[+\d\s()\/.-]{6,25}$/.test(s) && ziffern.length >= 6 && ziffern.length <= 15;
}
function istDatum(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  if (isNaN(d.getTime())) return false;
  const jetzt = Date.now();
  return d.getTime() <= jetzt + 86400000 && d.getTime() >= jetzt - 5 * 365 * 86400000;
}

const BILDTYPEN = {
  'image/jpeg': { ext: 'jpg', magic: [[0xFF, 0xD8, 0xFF]] },
  'image/png':  { ext: 'png', magic: [[0x89, 0x50, 0x4E, 0x47]] },
  'image/webp': { ext: 'webp', magic: [[0x52, 0x49, 0x46, 0x46]] }
};
function magicOk(buf, typ) {
  const def = BILDTYPEN[typ];
  if (!def) return false;
  return def.magic.some((m) => m.every((b, i) => buf[i] === b))
    && (typ !== 'image/webp' || buf.slice(8, 12).toString('ascii') === 'WEBP');
}

/* ---------- Validierung --------------------------------------------------- */

function pruefe(body) {
  const fehler = {};
  const d = {};

  if (typeof body !== 'object' || body === null) return { fehler: { allgemein: 'Ungültige Anfrage.' } };

  /* Honeypot: das Feld ist fuer Menschen unsichtbar und muss leer bleiben */
  if (text(body.website, 200)) return { spam: true };

  /* Mindestzeit seit Laden des Formulars */
  const t0 = parseInt(body.t0, 10);
  if (!t0 || Date.now() - t0 < MIN_FORM_MS) return { spam: true };

  d.name = einzeilig(body.name, 100);
  if (d.name.length < 2) fehler.name = 'Bitte geben Sie Ihren Namen an.';

  d.telefon = einzeilig(body.telefon, 30);
  if (!istTelefon(d.telefon)) fehler.telefon = 'Bitte geben Sie eine gültige Telefonnummer an.';

  d.email = einzeilig(body.email, 120).toLowerCase();
  if (d.email && !istEmail(d.email)) fehler.email = 'Die E-Mail-Adresse sieht nicht richtig aus.';

  d.ort = einzeilig(body.ort, 120);
  d.datum = einzeilig(body.datum, 10);
  if (d.datum && !istDatum(d.datum)) fehler.datum = 'Bitte prüfen Sie das Unfalldatum.';

  d.fahrzeug = einzeilig(body.fahrzeug, 120);

  d.beschreibung = text(body.beschreibung, 4000);
  if (d.beschreibung.length < 10) fehler.beschreibung = 'Bitte beschreiben Sie kurz, was passiert ist.';

  d.anliegen = einzeilig(body.anliegen, 40);
  if (!['unfallgutachten', 'wertgutachten', 'kostenvoranschlag', 'sonstiges', ''].includes(d.anliegen)) d.anliegen = 'sonstiges';

  d.kontaktweg = einzeilig(body.kontaktweg, 20);
  if (!['telefon', 'whatsapp', 'email'].includes(d.kontaktweg)) d.kontaktweg = 'telefon';
  if (d.kontaktweg === 'email' && !d.email) fehler.email = 'Für eine Antwort per E-Mail brauchen wir Ihre E-Mail-Adresse.';

  if (body.datenschutz !== true && body.datenschutz !== 'true' && body.datenschutz !== 'on') {
    fehler.datenschutz = 'Bitte bestätigen Sie den Hinweis zum Datenschutz.';
  }

  /* Fotos */
  d.fotos = [];
  const fotos = Array.isArray(body.fotos) ? body.fotos.slice(0, MAX_FILES) : [];
  for (const f of fotos) {
    if (!f || typeof f !== 'object') continue;
    const typ = einzeilig(f.type, 40).toLowerCase();
    const name = einzeilig(f.name, 120).replace(/[^\w.\- ]+/g, '_') || 'foto';
    if (!BILDTYPEN[typ]) { fehler.fotos = 'Bitte nur Fotos im Format JPG, PNG oder WebP hochladen.'; break; }
    let buf;
    try { buf = Buffer.from(String(f.data || ''), 'base64'); } catch (e) { buf = null; }
    if (!buf || !buf.length) continue;
    if (buf.length > MAX_FILE_BYTES) { fehler.fotos = 'Jedes Foto darf höchstens 5 MB groß sein.'; break; }
    if (!magicOk(buf, typ)) { fehler.fotos = 'Eine Datei konnte nicht als Bild erkannt werden.'; break; }
    d.fotos.push({ name, typ, buf });
  }

  return Object.keys(fehler).length ? { fehler } : { daten: d };
}

/* ---------- Ausgabe ------------------------------------------------------- */

const LABEL = {
  anliegen: { unfallgutachten: 'Unfallgutachten', wertgutachten: 'Wertgutachten', kostenvoranschlag: 'Kostenvoranschlag / Schadenkalkulation', sonstiges: 'Allgemeine Anfrage', '': 'Allgemeine Anfrage' },
  kontaktweg: { telefon: 'Telefon', whatsapp: 'WhatsApp', email: 'E-Mail' }
};

function mailText(d, meta) {
  const z = [];
  z.push('Neue Anfrage ueber unfallx.com');
  z.push('================================');
  z.push('Anliegen:        ' + LABEL.anliegen[d.anliegen]);
  z.push('Name:            ' + d.name);
  z.push('Telefon:         ' + d.telefon);
  if (d.email) z.push('E-Mail:          ' + d.email);
  z.push('Rueckruf per:    ' + LABEL.kontaktweg[d.kontaktweg]);
  if (d.ort) z.push('PLZ / Unfallort: ' + d.ort);
  if (d.datum) z.push('Unfalldatum:     ' + d.datum.split('-').reverse().join('.'));
  if (d.fahrzeug) z.push('Fahrzeug:        ' + d.fahrzeug);
  z.push('Fotos:           ' + (d.fotos.length ? d.fotos.length + ' im Anhang' : 'keine'));
  z.push('');
  z.push('Schilderung:');
  z.push(d.beschreibung);
  z.push('');
  z.push('--');
  z.push('Eingegangen: ' + meta.zeit + ' | IP: ' + meta.ip);
  return z.join('\n');
}

function mailHtml(d, meta) {
  const row = (k, v) => v ? `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap">${k}</td><td style="padding:6px 0">${escapeHtml(v)}</td></tr>` : '';
  return `<div style="font:15px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#14171c">
<h2 style="margin:0 0 14px;font-size:18px">Neue Anfrage &uuml;ber unfallx.com</h2>
<table style="border-collapse:collapse;font-size:15px">
${row('Anliegen', LABEL.anliegen[d.anliegen])}
${row('Name', d.name)}
${row('Telefon', d.telefon)}
${row('E-Mail', d.email)}
${row('R&uuml;ckruf per', LABEL.kontaktweg[d.kontaktweg])}
${row('PLZ / Unfallort', d.ort)}
${row('Unfalldatum', d.datum ? d.datum.split('-').reverse().join('.') : '')}
${row('Fahrzeug', d.fahrzeug)}
${row('Fotos', d.fotos.length ? d.fotos.length + ' im Anhang' : 'keine')}
</table>
<h3 style="margin:18px 0 6px;font-size:15px">Schilderung</h3>
<p style="white-space:pre-wrap;margin:0 0 18px">${escapeHtml(d.beschreibung)}</p>
<p style="color:#888;font-size:12px;margin:0">Eingegangen: ${escapeHtml(meta.zeit)} &middot; IP: ${escapeHtml(meta.ip)}</p>
</div>`;
}

async function sendeMail(d, meta) {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  const betreff = `[UNFALLX] ${LABEL.anliegen[d.anliegen]} – ${d.name}`;
  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: MAIL_TO,
    replyTo: d.email || undefined,
    subject: betreff,
    text: mailText(d, meta),
    html: mailHtml(d, meta),
    attachments: d.fotos.map((f, i) => ({
      filename: `foto-${i + 1}.${BILDTYPEN[f.typ].ext}`,
      content: f.buf,
      contentType: f.typ
    }))
  });
}

function speichereDatei(d, meta) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const id = meta.zeit.replace(/[^\d]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8);
  const ordner = path.join(DATA_DIR, id);
  fs.mkdirSync(ordner, { recursive: true });
  const kopie = Object.assign({}, d, { fotos: d.fotos.map((f, i) => `foto-${i + 1}.${BILDTYPEN[f.typ].ext}`) });
  fs.writeFileSync(path.join(ordner, 'anfrage.json'), JSON.stringify({ meta, daten: kopie }, null, 2), 'utf8');
  fs.writeFileSync(path.join(ordner, 'anfrage.txt'), mailText(d, meta), 'utf8');
  d.fotos.forEach((f, i) => fs.writeFileSync(path.join(ordner, `foto-${i + 1}.${BILDTYPEN[f.typ].ext}`), f.buf));
  return id;
}

/* ---------- HTTP-Handler -------------------------------------------------- */

function antwort(res, status, obj, headers) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({}, headers || {}, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  }));
  res.end(body);
}

function handle(req, res, securityHeaders) {
  const ip = clientIp(req);
  const ct = String(req.headers['content-type'] || '');
  if (!/application\/json/i.test(ct)) {
    return antwort(res, 415, { ok: false, error: 'Bitte als JSON senden.' }, securityHeaders);
  }
  const laenge = parseInt(req.headers['content-length'] || '0', 10);
  if (laenge > MAX_BODY) {
    return antwort(res, 413, { ok: false, error: 'Die Anfrage ist zu groß. Bitte kleinere Fotos verwenden.' }, securityHeaders);
  }
  if (rateLimited(ip)) {
    return antwort(res, 429, { ok: false, error: 'Zu viele Anfragen. Bitte versuchen Sie es in einigen Minuten erneut oder rufen Sie uns an.' }, securityHeaders);
  }

  const teile = [];
  let bytes = 0;
  let abgebrochen = false;
  req.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > MAX_BODY) {
      abgebrochen = true;
      antwort(res, 413, { ok: false, error: 'Die Anfrage ist zu groß. Bitte kleinere Fotos verwenden.' }, securityHeaders);
      req.destroy();
      return;
    }
    teile.push(chunk);
  });
  req.on('end', async () => {
    if (abgebrochen) return;
    let body;
    try { body = JSON.parse(Buffer.concat(teile).toString('utf8')); }
    catch (e) { return antwort(res, 400, { ok: false, error: 'Die Angaben konnten nicht gelesen werden.' }, securityHeaders); }

    const ergebnis = pruefe(body);
    if (ergebnis.spam) {
      /* Bots bekommen absichtlich eine unauffaellige Erfolgsantwort */
      return antwort(res, 200, { ok: true }, securityHeaders);
    }
    if (ergebnis.fehler) {
      return antwort(res, 422, { ok: false, error: 'Bitte prüfen Sie die markierten Felder.', felder: ergebnis.fehler }, securityHeaders);
    }

    const d = ergebnis.daten;
    const meta = { zeit: new Date().toISOString(), ip };

    if (mailerKonfiguriert()) {
      try {
        await sendeMail(d, meta);
        return antwort(res, 200, { ok: true }, securityHeaders);
      } catch (e) {
        console.error('[anfrage] Mailversand fehlgeschlagen:', e && e.message);
        /* weiter zum Datei-Fallback, damit die Anfrage nicht verloren geht */
      }
    } else {
      console.warn('[anfrage] Kein Mailversand konfiguriert (SMTP_* fehlt) – Anfrage wird als Datei abgelegt.');
    }

    try {
      const id = speichereDatei(d, meta);
      console.log('[anfrage] Anfrage gespeichert unter data/anfragen/' + id);
      return antwort(res, 200, { ok: true }, securityHeaders);
    } catch (e) {
      console.error('[anfrage] Speichern fehlgeschlagen:', e && e.message);
      return antwort(res, 503, { ok: false, error: 'Die Anfrage konnte gerade nicht übermittelt werden. Bitte rufen Sie uns an oder schreiben Sie an info@unfallx.com.' }, securityHeaders);
    }
  });
  req.on('error', () => {
    if (!res.headersSent) antwort(res, 400, { ok: false, error: 'Verbindung unterbrochen.' }, securityHeaders);
  });
}

module.exports = { handle, pruefe };
