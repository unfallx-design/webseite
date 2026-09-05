/**
 * UNFALLX – statischer Webserver
 * Node-Standardbibliothek, keine externen Abhängigkeiten.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/* Dateien, die nie ausgeliefert werden dürfen */
const BLOCKED = /(^|[\\/])(\.git|\.env|node_modules|partials|package(-lock)?\.json)([\\/]|$)/i;

/**
 * Gemeinsame Bausteine aus partials/ werden in die Seiten eingesetzt.
 * In den HTML-Dateien steht dafuer z. B. <!--#include:header-->.
 * So sind Kopf- und Fussbereich auf allen Seiten garantiert identisch.
 */
const PARTIAL_DIR = path.join(ROOT, 'partials');

function loadPartials() {
  const out = {};
  let files = [];
  try { files = fs.readdirSync(PARTIAL_DIR); } catch (e) { return out; }
  files.filter((f) => f.toLowerCase().endsWith('.html')).forEach((f) => {
    try {
      out[path.basename(f, '.html')] = fs.readFileSync(path.join(PARTIAL_DIR, f), 'utf8').trim();
    } catch (e) { /* ignorieren */ }
  });
  return out;
}

const PARTIALS = loadPartials();

function applyPartials(html) {
  return html.replace(/<!--#include:([a-z0-9_-]+)-->/gi, (match, name) => {
    const key = name.toLowerCase();
    return Object.prototype.hasOwnProperty.call(PARTIALS, key) ? PARTIALS[key] : '';
  });
}

/**
 * Asset-Versionierung gegen veraltete Browser-Caches.
 * Beim Start wird je Datei in assets/ eine Pruefsumme gebildet und beim
 * Ausliefern an die URL gehaengt (/assets/styles.css?v=ab12cd34). Aendert
 * sich eine Datei, aendert sich die URL - der Browser laedt sie zwingend neu.
 */
const ASSET_VERSIONS = (function () {
  const crypto = require('crypto');
  const out = {};
  const dir = path.join(ROOT, 'assets');
  let files = [];
  try { files = fs.readdirSync(dir); } catch (e) { return out; }
  files.forEach((f) => {
    try {
      const buf = fs.readFileSync(path.join(dir, f));
      out['/assets/' + f] = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
    } catch (e) { /* ignorieren */ }
  });
  return out;
})();

function versionAssets(html) {
  return html.replace(/(["'(])(\/assets\/[A-Za-z0-9._-]+)(["')])/g, (match, before, url, after) => {
    const v = ASSET_VERSIONS[url];
    return v ? before + url + '?v=' + v + after : match;
  });
}

function renderPage(file) {
  return versionAssets(applyPartials(fs.readFileSync(file, 'utf8')));
}

/**
 * Inline-Skripte (z. B. der JSON-LD-Block für Suchmaschinen) werden beim Start
 * gehasht, damit die Content-Security-Policy ohne 'unsafe-inline' auskommt.
 * Neue Inline-Skripte werden dadurch automatisch berücksichtigt.
 */
function inlineScriptHashes() {
  const crypto = require('crypto');
  const hashes = new Set();
  let files = [];
  try {
    files = fs.readdirSync(ROOT).filter((f) => f.toLowerCase().endsWith('.html'));
  } catch (e) { /* ignorieren */ }

  files.forEach((file) => {
    let html = '';
    try { html = versionAssets(applyPartials(fs.readFileSync(path.join(ROOT, file), 'utf8'))); } catch (e) { return; }
    const re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const code = m[1];
      if (!code.trim()) continue;
      hashes.add("'sha256-" + crypto.createHash('sha256').update(code, 'utf8').digest('base64') + "'");
    }
  });
  return Array.from(hashes).join(' ');
}

const SCRIPT_HASHES = inlineScriptHashes();

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self'; " +
    ("script-src 'self' " + SCRIPT_HASHES).trim() + '; ' +
    "form-action 'self' mailto:; base-uri 'self'; frame-ancestors 'self'"
};

function cacheFor(ext, versioniert) {
  if (ext === '.html' || ext === '') return 'public, max-age=0, must-revalidate';
  if (versioniert) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

function send(res, status, headers, body, isHead) {
  res.writeHead(status, Object.assign({}, SECURITY_HEADERS, headers));
  if (isHead) return res.end();
  res.end(body);
}

function sendError(res, status, isHead) {
  const file = status === 404 ? path.join(ROOT, '404.html') : null;
  if (file && fs.existsSync(file)) {
    const body = Buffer.from(renderPage(file), 'utf8');
    return send(res, status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }, body, isHead);
  }
  send(res, status, { 'Content-Type': 'text/plain; charset=utf-8' },
    status === 404 ? 'Nicht gefunden' : 'Fehler', isHead);
}

const server = http.createServer((req, res) => {
  const isHead = req.method === 'HEAD';

  if (req.method !== 'GET' && !isHead) {
    return send(res, 405, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Allow': 'GET, HEAD'
    }, 'Methode nicht erlaubt', false);
  }

  let urlPath;
  let hatVersion = false;
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    urlPath = decodeURIComponent(parsed.pathname);
    hatVersion = parsed.searchParams.has('v');
  } catch (e) {
    return sendError(res, 400, isHead);
  }

  /* Healthcheck für Hostinger */
  if (urlPath === '/health') {
    return send(res, 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }, JSON.stringify({ status: 'ok' }), isHead);
  }

  /* Nachgestellten Slash entfernen: /impressum/ -> /impressum */
  if (urlPath.length > 1 && urlPath.endsWith('/')) {
    const target = urlPath.replace(/\/+$/, '');
    return send(res, 301, { Location: target }, '', isHead);
  }

  if (BLOCKED.test(urlPath)) return sendError(res, 404, isHead);

  /* .html in der URL auf saubere Adresse umleiten */
  if (/\.html$/i.test(urlPath) && urlPath !== '/index.html') {
    return send(res, 301, { Location: urlPath.replace(/\.html$/i, '') }, '', isHead);
  }
  if (urlPath === '/index.html') {
    return send(res, 301, { Location: '/' }, '', isHead);
  }

  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const resolved = path.resolve(ROOT, relative);

  /* Verzeichnis-Traversal verhindern */
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    return send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Verboten', isHead);
  }

  /* Kandidaten: exakter Pfad, dann .html-Variante (saubere URLs) */
  const candidates = path.extname(resolved)
    ? [resolved]
    : [resolved, resolved + '.html', path.join(resolved, 'index.html')];

  const tryNext = (i) => {
    if (i >= candidates.length) return sendError(res, 404, isHead);
    const file = candidates[i];
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) return tryNext(i + 1);
      const ext = path.extname(file).toLowerCase();

      if (ext === '.html') {
        let page;
        try { page = Buffer.from(renderPage(file), 'utf8'); }
        catch (e) { return sendError(res, 500, isHead); }
        return send(res, 200, {
          'Content-Type': MIME[ext],
          'Content-Length': page.length,
          'Cache-Control': cacheFor(ext, false)
        }, page, isHead);
      }

      fs.readFile(file, (readErr, data) => {
        if (readErr) return sendError(res, 500, isHead);
        send(res, 200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Content-Length': data.length,
          'Cache-Control': cacheFor(ext, hatVersion)
        }, data, isHead);
      });
    });
  };

  tryNext(0);
});

server.listen(PORT, HOST, () => {
  console.log(`UNFALLX Webseite laeuft auf http://${HOST}:${PORT}`);
});
