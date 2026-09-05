# UNFALLX – Webseite

Schlanke Node.js-Anwendung, die die Website von UNFALLX ausliefert.
Ohne externe Abhängigkeiten – nur die Node-Standardbibliothek.

## Lokal starten

```bash
npm start
# http://localhost:3000
```

## Konfiguration

| Variable | Standard  | Bedeutung |
|----------|-----------|-----------|
| `PORT`   | `3000`    | Port, auf dem der Server lauscht (wird von Hostinger gesetzt) |
| `HOST`   | `0.0.0.0` | Interface |

`GET /health` liefert `{"status":"ok"}` für Healthchecks.

## Struktur

```
server.js                HTTP-Server: statische Dateien, saubere URLs, 404, Security-Header
index.html               Startseite
impressum.html           Impressum        -> erreichbar unter /impressum
datenschutz.html         Datenschutz      -> erreichbar unter /datenschutz
404.html                 Fehlerseite
robots.txt               Suchmaschinen
sitemap.xml              Seitenverzeichnis
assets/styles.css        Design-System für alle Seiten
assets/site.js           Mobiles Menue, Header-Scrollzustand, Jahreszahl, Formular
assets/favicon.svg       Favicon (Bildmarke)
assets/logo-mark.svg     Bildmarke
assets/logo-wordmark.svg Wortmarke
assets/logo-full.svg     Bild- und Wortmarke
package.json             start-Skript für Hostinger
```

Neue Seite anlegen: `name.html` ins Projektverzeichnis legen – sie ist danach
automatisch unter `/name` erreichbar (`.html`-URLs werden umgeleitet).

## Noch einzutragen

Alle offenen Stellen sind im Browser gelb markiert (`<span class="todo">…</span>`)
und im Quelltext mit `TODO` kommentiert:

- Telefonnummer (Startseite, Impressum, Datenschutz)
- Anschrift (Startseite, Impressum, Datenschutz)
- Firmierung, Vertretungsberechtigter, ggf. Registereintrag und USt-IdNr. (Impressum)
- Hoster-Anschrift, Log-Speicherdauer, zuständige Aufsichtsbehörde, Stand-Datum (Datenschutz)

Nach dem Eintragen den `<span class="todo">` durch reinen Text ersetzen.
Impressum und Datenschutzerklärung sind Entwürfe und sollten vor dem Livegang
rechtlich geprüft werden.

## Formular

Das Formular auf der Startseite sendet nichts an den Server, sondern setzt die
Angaben im Browser zu einer E-Mail zusammen und öffnet das Mailprogramm des
Besuchers. Für echten Serverversand wäre ein Mailversand (SMTP) nötig.
