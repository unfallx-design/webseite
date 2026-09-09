# UNFALLX – Website

Node.js liefert die deutschsprachigen Seiten aus. Nodemailer versendet Anfragen an **info@unfallx.com**. Gemeinsame Header, Footer und Standortkarten liegen in `partials/`.

## Start und Prüfung

```bash
npm ci
npm run check
npm start
```

Standard: `http://localhost:3000`. `PORT` und `HOST` können über die Hosting-Umgebung gesetzt werden. Änderungen an Partials, CSS oder Skripten benötigen einen Serverneustart, damit Asset-Versionen und CSP-Hashes neu berechnet werden.

## Mailversand

Folgende Werte werden ausschließlich in der Hosting-Umgebung gesetzt, niemals im Repository:

| Variable | Beispiel / Bedeutung |
| --- | --- |
| SMTP_HOST | SMTP-Server des Postfachanbieters |
| SMTP_PORT | 465 für TLS oder 587 für STARTTLS |
| SMTP_SECURE | true für 465, false für 587 |
| SMTP_USER | Authentifizierter Postfachbenutzer |
| SMTP_PASS | Passwort oder App-Passwort des Postfachs |
| MAIL_FROM | Optional, freigegebener Absender; Standard SMTP_USER |
| ANFRAGE_LIMIT | Optional: Anfragen pro IP in zehn Minuten, Standard 8 |

Der Empfänger ist fest `info@unfallx.com`. Antworten gehen über Reply-To an die angegebene Besucheradresse. `GET /health` meldet den Betriebszustand sowie `contact.configured` und die öffentliche Empfängeradresse; Zugangsdaten werden nie ausgegeben. Die Bereitschaftsanzeige prüft die Konfiguration, nicht die Anmeldung beim Mailserver.

Bei erfolgreicher Annahme durch den SMTP-Server antwortet das Formular mit `delivery: email`. Bei einer Störung wird die Anfrage unter dem nicht öffentlich zugänglichen Verzeichnis `data/anfragen/` gesichert. Die Antwort `delivery: stored` zeigt im Formular ausdrücklich die ausstehende Mailzustellung und bietet einen direkten E-Mail-Link. Dieser Speicher ist keine automatische Versandwarteschlange. Betreiber müssen SMTP-Störungen beheben und gesicherte Anfragen bearbeiten; die Aufbewahrung über Hosting-Neubereitstellungen hängt vom Hosting-Speicher ab.

Maximal drei JPEG-, PNG- oder WebP-Fotos mit jeweils 5 MB; das JSON-Limit berücksichtigt den Base64-Aufschlag. Keine Passwörter oder produktiven Kundendaten in Tests verwenden.

## Gestaltung und Inhalte

- `assets/styles.css` und `assets/refresh.css`: bestehendes Design und responsive Basis.
- `assets/experience.css` und `assets/experience.js`: animierte Lichtflächen, Cinematic-Look, Ortssuche, Standortkarte und Checkliste. Animationen lassen sich pausieren und berücksichtigen reduzierte Bewegung und Datensparmodus.
- `einsatzgebiete.html`: Berliner Bezirke mit 97 Ortsteilen sowie Brandenburger Landkreise und kreisfreie Städte. Die Auswahl übergibt den Ort an das Anfrageformular.
- `unfall-checkliste.html`: Vorbereitung auf die Fahrzeugbesichtigung mit Druckansicht.
- `partials/location.html`: Halle und Unternehmenssitz; Google Maps wird erst nach dem freiwilligen Laden eingebunden.
- `assets/favicon.svg`: transparente Bildmarke.

Die Website ist ausschließlich deutschsprachig. Frühere Sprachadressen werden auf passende deutsche Seiten umgeleitet. Neue öffentliche Seiten in Sitemap und Navigation ergänzen. Öffnungszeiten, Rezensionen, örtliche Niederlassungen oder Leistungsversprechen nur ergänzen, wenn sie tatsächlich belegt sind.


## UNFALLX Connect

- `/app`: Präsentation mit zwei KI-Visualisierungen. `/app-demo`: schreibgeschützte Beispielansicht mit ausschließlich fiktiven Daten und ohne API-Zugriffe. `/app-hilfe`: Anleitung mit echten Ansichten aus der Demo.
- `portal/email-templates.js`: HTML- und Textvorlagen für Registrierung, Login (15 Minuten) und interne Einladungen (24 Stunden). Kein Link wird öffentlich protokolliert.
- Die Administration legt interne Gutachter an. Eine persönliche Einladung wird direkt versandt. Fehlgeschlagener Versand bleibt sichtbar und kann erneut ausgelöst werden; dabei verlieren ältere Einladungslinks ihre Gültigkeit. Gesperrte Konten können sich nicht anmelden.
- Persönliche Einstellungen: Name, Telefon, Funktion, Startansicht, Hell/Dunkel, kompakte Tabellen und reduzierte Bewegung. E-Mail, Rollen und Firmeneigentum sind darüber nicht änderbar.
- Sitzungsverwaltung meldet andere Geräte ab und erhält die aktuelle Sitzung. CSV-Fallübersicht entschärft Tabellenformeln; Fotovorschauen nutzen die bestehende geschützte Datei-API.
- `npm test` prüft Anmeldung, Einladung und Fehlerbehandlung, Rollen/Firmengrenzen, Einstellungen, Sitzungen sowie den Fall- und Zahlungsablauf über einen lokalen HTTP-Server mit temporärer Datenbank. Es werden keine echten E-Mails versandt.
