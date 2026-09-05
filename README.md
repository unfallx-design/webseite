# UNFALLX – Webseite

Schlanke Node.js-Anwendung, die die Startseite von UNFALLX ausliefert.
Ohne externe Abhängigkeiten – nur die Node-Standardbibliothek.

## Lokal starten

```bash
npm start
# http://localhost:3000
```

## Konfiguration

| Variable | Standard | Bedeutung |
|----------|----------|-----------|
| `PORT`   | `3000`   | Port, auf dem der Server lauscht (wird von Hostinger gesetzt) |
| `HOST`   | `0.0.0.0`| Interface |

`GET /health` liefert `{"status":"ok"}` für Healthchecks.

## Struktur

- `server.js` – HTTP-Server, liefert statische Dateien aus dem Projektverzeichnis
- `index.html` – Startseite
- `package.json` – enthält das von Hostinger benötigte `start`-Skript

## Offene Punkte

- Impressum und Datenschutzerklärung ergänzen (in Deutschland Pflicht)
- Telefonnummer und Anschrift im Kontaktbereich eintragen
