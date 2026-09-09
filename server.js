/**
 * UNFALLX – Webserver
 * Liefert die statischen Seiten aus und nimmt Anfragen des Formulars
 * unter POST /api/anfrage entgegen (siehe anfrage.js).
 * Node-Standardbibliothek; nodemailer ist optional (Mailversand).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const anfrage = require('./anfrage');
const hosts = require('./portal/hosts');
const portal = require('./portal/app').createPortal();
portal.ready().catch(() => {});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;

const MIME = {
  '.webmanifest': 'application/manifest+json; charset=utf-8',
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
const BLOCKED = /(^|[\\/])(\.git|\.env[^\\/]*|node_modules|partials|data|portal|tests|pnpm-lock\.yaml|anfrage\.js|server\.js|package(-lock)?\.json)([\\/]|$)/i;

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

function renderPage(file, context={}) {
  let html=fs.readFileSync(file,'utf8');
  if(context.isReport)html=html.replace('<!--#include:header-->','<!--#include:gutachten-header-->');
  if(context.isApp)html=html.replace('<!--#include:header-->','<!--#include:app-header-->').replace('<!--#include:footer-->','<!--#include:app-footer-->').replace(/<body(?![^>]*class=)/,'<body class="connect-public"');
  if(context.isApp&&!html.includes('/assets/app-shell.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/portal.css"><link rel="stylesheet" href="/assets/app-shell.css"></head>');
  if(context.isApp)html=html.replace('<meta name="theme-color" content="#11151c">','<meta name="theme-color" content="#ffffff">');
  return versionAssets(applyPartials(html));
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
  [''].forEach((dir) => {
    try {
      fs.readdirSync(path.join(ROOT, dir))
        .filter((f) => f.toLowerCase().endsWith('.html'))
        .forEach((f) => files.push(path.join(ROOT, dir, f)));
    } catch (e) { /* ignorieren */ }
  });

  files.forEach((file) => {
    let html = '';
    try { html = renderPage(file); } catch (e) { return; }
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
  ...(process.env.NODE_ENV==='test'?{}:{'Strict-Transport-Security':'max-age=31536000'}),
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob: https://www.desag.de; media-src 'self'; style-src 'self'; frame-src https://www.google.com; " +
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

function sendError(res, status, isHead, urlPath) {
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
  let hostInfo;try{hostInfo=hosts.hostPolicy(req.headers.host,req.url);}catch{return sendError(res,400,isHead);}
  if(hostInfo.redirect)return send(res,308,{Location:hostInfo.redirect,'Cache-Control':'no-store'},'',isHead);
  const apiPath=req.url.split('?')[0];
  if(hostInfo.production&&!hostInfo.isApp&&apiPath.startsWith('/api/portal/')&&!apiPath.startsWith('/api/portal/academy/'))return send(res,409,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},JSON.stringify({error:'Die App ist umgezogen. Bitte app.unfallx.com/login öffnen und dort anmelden.',redirect:hosts.APP_ORIGIN+'/login'}),isHead);
  if (req.url.split('?')[0].startsWith('/api/portal/')) return portal.handle(req, res, SECURITY_HEADERS);

  /* Anfrageformular: POST /api/anfrage (JSON) */
  if (req.method === 'POST') {
    let p = '';
    try { p = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname; } catch (e) {}
    if (p === '/api/anfrage') {
      return anfrage.handle(req, res, SECURITY_HEADERS);
    }
    return send(res, 404, { 'Content-Type': 'application/json; charset=utf-8' },
      JSON.stringify({ ok: false, error: 'Nicht gefunden' }), false);
  }

  if (req.method !== 'GET' && !isHead) {
    return send(res, 405, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Allow': 'GET, HEAD, POST'
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

  /* Alte Sprachadressen behalten ihren Weg zum entsprechenden deutschen Inhalt. */
  if (/^\/ru(?:\/|$)/i.test(urlPath)) {
    const slug = urlPath.replace(/^\/ru\/?/i, '').replace(/\/$/, '').replace(/\.html$/i, '');
    const known = new Set(["wertminderung", "unfallgutachten", "wertgutachten", "kfz-gutachter-berlin", "nutzungsausfall", "kostenvoranschlag", "unfall-checkliste", "kfz-gutachter-brandenburg", "einsatzgebiete", "impressum", "mietwagen", "totalschaden", "kfz-gutachten", "datenschutz"]);
    if (!slug || slug === 'index') return send(res, 301, { Location: '/' }, '', isHead);
    if (known.has(slug)) return send(res, 301, { Location: '/' + slug }, '', isHead);
    return sendError(res, 404, isHead, urlPath);
  }

  if(hostInfo.production&&urlPath==='/sitemap.xml'){
    const paths=hostInfo.isApp?[]:hostInfo.isReport?['/',...['unfallgutachten','wertgutachten','kostenvoranschlag','kfz-gutachten','kfz-gutachter-berlin','kfz-gutachter-brandenburg','einsatzgebiete','unfall-checkliste','wertminderung','nutzungsausfall','mietwagen','totalschaden'].map(p=>'/'+p)]:['/',...fs.readdirSync(ROOT).filter(f=>f.endsWith('.html')&&(f.startsWith('bildung')||['kfz-gutachter-werden.html','schadenfotos-lernen.html','gutachten-aufbau.html'].includes(f))).map(f=>'/'+f.slice(0,-5))];
    const domain=hostInfo.isReport?hosts.REPORT_ORIGIN:hosts.PUBLIC_ORIGIN;
    return send(res,200,{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'no-cache'},'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(p=>'<url><loc>'+domain+p+'</loc></url>').join('')+'</urlset>',isHead);
  }
  if(hostInfo.isReport&&urlPath==='/robots.txt')return send(res,200,{'Content-Type':'text/plain'},'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://gutachten.unfallx.com/sitemap.xml\n',isHead);
  if(hostInfo.isApp&&urlPath==='/robots.txt')return send(res,200,{'Content-Type':'text/plain','Cache-Control':'no-store'},'User-agent: *\nDisallow: /\n',isHead);
  /* Healthcheck für Hostinger */
  if (urlPath === '/health') {
    return send(res, 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }, JSON.stringify({ status: 'ok', contact: anfrage.contactStatus(), portal: portal.status() }), isHead);
  }

  /* Nachgestellten Slash entfernen: /impressum/ -> /impressum */
  if (urlPath.length > 1 && urlPath.endsWith('/')) {
    const target = urlPath.replace(/\/+$/, '');
    return send(res, 301, { Location: target }, '', isHead);
  }

  if (/(^|\/)\.[^/]|\\|[\x00-\x1f]/.test(urlPath)) return sendError(res,404,isHead,urlPath);
  if (urlPath !== '/portal' && BLOCKED.test(urlPath)) return sendError(res, 404, isHead, urlPath);

  /* Startseite auf die kanonische Adresse führen. */
  if (urlPath === '/index.html' || urlPath === '/index') return send(res, 301, { Location: '/' }, '', isHead);

  /* .html in der URL auf saubere Adresse umleiten */
  if (/\.html$/i.test(urlPath)) {
    return send(res, 301, { Location: urlPath.replace(/\.html$/i, '') }, '', isHead);
  }

  const relative = hostInfo.isApp&&urlPath==='/datenschutz'?'portal-datenschutz.html':urlPath === '/' ? (hostInfo.isApp?'app.html':hostInfo.isReport?'gutachten-start.html':'index.html') : urlPath === '/portal' ? 'partner-app.html' : urlPath === '/gutachter-portal' ? 'partner-app.html' : urlPath.replace(/^\/+/, '');
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
    if (i >= candidates.length) return sendError(res, 404, isHead, urlPath);
    const file = candidates[i];
    fs.stat(file, async (err, stat) => {
      if (err || !stat.isFile()) return tryNext(i + 1);
      const ext = path.extname(file).toLowerCase();
      const publicAsset=file.startsWith(path.join(ROOT,'assets')+path.sep)&&['.css','.js','.svg','.png','.jpg','.jpeg','.webp','.avif','.ico','.woff2'].includes(ext);
      const publicRoot=path.dirname(file)===ROOT&&(ext==='.html'||['robots.txt','sitemap.xml','site.webmanifest','app.webmanifest','favicon.ico','apple-touch-icon.png'].includes(path.basename(file)));
      if(!publicAsset&&!publicRoot)return sendError(res,404,isHead,urlPath);

      if (ext === '.html') {
        let page;
        try { let html=renderPage(file,hostInfo);
          if(!hostInfo.isApp&&html.includes('data-course-price')||path.basename(file)==='bildung.html'){
            const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
            const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100);
            try{const courses=await portal.catalog(),primary=courses.find(c=>c.id==='praxis-berlin');html=html.replace(/(<span data-course-price>)[^<]*(<\/span>)/g,'$1'+(primary?euro(primary.price):'siehe Kursangebot')+'$2');
              if(path.basename(file)==='bildung.html'){const cards=courses.map(c=>'<article class="portal-card"><span class="eyebrow">'+(c.mode==='digital'?'DIGITAL':'PRÄSENZ')+'</span><h3>'+esc(c.title)+'</h3><p>'+esc(c.description)+'</p><p><strong>'+(!c.price&&c.mode==='digital'?'Preis wird bekannt gegeben':euro(c.price)+' pro Person')+'</strong><br>'+esc(c.duration)+' · '+esc(c.location)+'<br>'+(c.start?'Start: '+esc(c.weeks[0]?.week||c.start):'Start wird demnächst bekannt gegeben')+'</p><p>'+c.capacity+' Plätze pro Termin</p><a class="btn btn-outline" href="#kursanmeldung">Kurs auswählen →</a></article>').join('')||'<p>Neue Kurse werden demnächst veröffentlicht.</p>';html=html.replace('<div class="partner-grid" id="course-catalog"><p>Kursangebot wird geladen …</p></div>','<div class="partner-grid" id="course-catalog">'+cards+'</div>');}
            }catch{html=html.replace(/(<span data-course-price>)[^<]*(<\/span>)/g,'$1Preis auf Anfrage$2');}
          }
          page = Buffer.from(hosts.links(html,hostInfo.isApp,hostInfo.production,hostInfo.isReport), 'utf8'); }
        catch (e) { return sendError(res, 500, isHead); }
        return send(res, 200, {
          'Content-Type': MIME[ext],
          'Content-Length': page.length,
          'Cache-Control': (hostInfo.isApp||hosts.appPath(urlPath))?'private, no-store, max-age=0':cacheFor(ext, false),
          ...((hostInfo.isApp||hosts.appPath(urlPath))?{'CDN-Cache-Control':'no-store','Vary':'Cookie','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}:{})
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

server.requestTimeout = 180000;
server.headersTimeout = 15000;
server.maxRequestsPerSocket = 100;
server.listen(PORT, HOST, () => {
  console.log(`UNFALLX Webseite laeuft auf http://${HOST}:${PORT}`);
});
