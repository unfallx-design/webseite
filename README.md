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

- Die App-Vorstellung bleibt auf `https://unfallx.com/#app`. `app.unfallx.com` ist ausschließlich das Partnerportal; `admin.unfallx.com` ist das interne Dashboard. Partner starten direkt in „Meine Fälle“; Konto, Dokumente und Abrechnung liegen im aufklappbaren Nebenmenü. Beide Bereiche besitzen ein eigenes Hilfecenter unter `/app-hilfe`.
- Die separate mobile App und ihre Programmdateien sind entfernt. `mobile.unfallx.com` leitet GET/HEAD-Aufrufe zum Partnerportal um. API-Aufrufe und schreibende Anfragen auf dem alten Host antworten mit 410 und werden nicht weiterverarbeitet. Bestehende Konten, Fallakten und Uploads bleiben in der gemeinsamen Datenbank erhalten. Sitzungen sind weiterhin an den aktiven Arbeitsbereich gebunden; ehemalige mobile Sitzungen berechtigen nicht zum Partner-Login.
- Alte Demo-Adressen führen zur Vorstellung auf der Hauptseite, `/mitglied-werden` direkt zur Partnerregistrierung. Auf dem Handy wird dasselbe responsive Partnerportal verwendet. Keine DNS- oder Datenbanklöschung ist für diese Umstellung erforderlich.
- `portal/email-templates.js`: HTML- und Textvorlagen für Registrierung, Login (15 Minuten) und interne Einladungen (24 Stunden). Kein Link wird öffentlich protokolliert.
- Die Administration legt interne Gutachter an. Eine persönliche Einladung wird direkt versandt. Fehlgeschlagener Versand bleibt sichtbar und kann erneut ausgelöst werden; dabei verlieren ältere Einladungslinks ihre Gültigkeit. Gesperrte Konten können sich nicht anmelden.
- Persönliche Einstellungen: Name, Telefon, Funktion, Startansicht für interne Zugänge, kompakte Tabellen und reduzierte Bewegung. E-Mail, Rollen und Firmeneigentum sind darüber nicht änderbar.
- Sitzungsverwaltung meldet andere Geräte ab und erhält die aktuelle Sitzung. CSV-Fallübersicht entschärft Tabellenformeln; Fotovorschauen nutzen die bestehende geschützte Datei-API.
- `npm test` prüft Anmeldung, Einladung und Fehlerbehandlung, Rollen/Firmengrenzen, Einstellungen, Sitzungen sowie den Fall- und Zahlungsablauf über einen lokalen HTTP-Server mit temporärer Datenbank. Es werden keine echten E-Mails versandt.

### Connect und Bildung

Die Startseite priorisiert Connect. Die Geräte-Szene verwendet unveränderte echte Screenshots der App-Demo mit fiktiven Daten; nur die Geräteumgebung wurde generiert. Privatkunden-Zugänge sind deaktiviert. Fälle werden durch Partnerbetriebe übermittelt und durch das interne Team bearbeitet. Frühere Kundenadressen leiten zum Partnerzugang um. Interne Aktionen, Partnervergütung und fremde Dateien bleiben durch Rollen- und Firmenrechte geschützt.

`/bildung` bietet eine unverbindliche Anmeldung für den einwöchigen Berliner Kurs (1.500 € pro Person) und eine separate Interessentenliste für spätere digitale Kurse. Bis zur Terminbekanntgabe werden Anfragen unter „Start folgt“ gesammelt. Erst nach E-Mail-Bestätigung zählt eine Vormerkung; maximal 26 vorgemerkte oder bestätigte Plätze pro Kurswoche werden innerhalb einer Datenbanktransaktion vergeben. Weitere Anmeldungen landen auf der Warteliste.

Administratoren finden „Bildungsanmeldungen“ im Portal: suchen, filtern, CSV exportieren, stornieren, Plätze bestätigen und den Status per E-Mail mitteilen. Der erste bestätigte Kursstart kann dort einmalig als zukünftiger Montag veröffentlicht werden. Bestehende und noch unbestätigte Vormerkungen werden der ersten Woche zugeordnet; anschließend werden zwölf kommende Wochen zur Auswahl angeboten. Termin, genaue Adresse, Zeiten und Teilnahme müssen persönlich abgestimmt werden. Es gibt keinen Checkout und keine automatische Zahlung. Nicht angekündigte digitale Kurse verbrauchen keine Berliner Kursplätze.

Die Bildungsregistrierung benutzt eigene Einmaltokens (`academy_token`, 24 Stunden), die keine App-Sitzung eröffnen können. Ein bloßer Linkaufruf bestätigt keine Anmeldung; dafür ist ein ausdrücklicher Klick nötig. Mailfehler erscheinen in der Teilnehmerverwaltung und können durch erneutes Speichern des Status wiederholt werden. Neue Datenobjekte verwenden den bestehenden MySQL/SQLite-Store, es ist keine manuelle Migration erforderlich. Test: `npm test` und `npm run check`.

### SMS-Verifizierung und Zwei-Faktor-Anmeldung (2.5)

Optionaler Versand über seven: `SMS_PROVIDER=seven`, `SEVEN_API_KEY` und ein unabhängig erzeugtes `PORTAL_OTP_SECRET` mit mindestens 32 zufälligen Zeichen ausschließlich in Hostinger setzen. Ohne vollständige Konfiguration bleibt der Versand deaktiviert; bisherige Konten werden nicht gesperrt. Die Einrichtung erfordert ein freigeschaltetes Anbieter-Konto, einen passenden AV-Vertrag, einen SMS-API-Key und Versandguthaben. Zum Start sind ausschließlich deutsche Mobilnummern zugelassen. Keine Schlüssel im Repository oder in Supportnachrichten speichern.

Nach der E-Mail-Bestätigung: Einstellungen → Mobilnummer bestätigen → optional Zwei-Faktor-Anmeldung aktivieren. Aktivierung benötigt einen frischen SMS-Nachweis, das aktuelle Passwort und eine höchstens 15 Minuten alte Anmeldung. Acht einmalige Wiederherstellungscodes werden nur einmal angezeigt. Google-/Apple-, Passwort- und E-Mail-Link-Anmeldungen durchlaufen denselben zweiten Schritt. Ein Passwort-Reset lässt die zusätzliche Absicherung bestehen. Telefonnummernwechsel erfordern bei aktiver 2FA zuerst deren abgesicherte Deaktivierung. Ohne SMS-Zugriff können Wiederherstellungscodes genutzt werden; es gibt keinen öffentlichen Administrator-Bypass.

SMS-Codes: kryptografischer Zufall, HMAC-Prüfwert, fünf Minuten Gültigkeit, fünf Fehlversuche, an Benutzer und Sitzung gebunden. Versand nur aus bestätigten Konten, 60 Sekunden Abstand, maximal fünf Versuche je Konto/Nummer/Stunde. Globale Limits standardmäßig `SMS_DAILY_LIMIT=100` und `SMS_MONTHLY_LIMIT=1000` (feste 24-Stunden-/30-Tage-Fenster). Ein unklarer Versand zählt mit; keine automatischen kostenpflichtigen Wiederholungen. Beim Anbieter zusätzlich Ausgabenlimits und minimale Protokollaufbewahrung setzen. Produktiv-SMS erst nach einem ausdrücklich abgestimmten Zustelltest aktivieren.

Prüfung: `npm run check`, `npm test`. SMS-Tests injizieren einen lokalen Simulator; sie versenden keine echten SMS oder E-Mails. `PORTAL_LOCAL_DB` ist ausschließlich unter `NODE_ENV=test` nutzbar. SMS- und Wiederherstellungscodes dürfen nicht geloggt werden. Private Fall-PDFs werden nur als Downloads ausgeliefert; eine Formatprüfung ersetzt keinen Malware-Scanner auf den Arbeitsgeräten.
