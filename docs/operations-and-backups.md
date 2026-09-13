# UNFALLX: Betrieb, Verbindungen und Wiederherstellung

Stand: 14.09.2026. Hostinger/MySQL und der bestehende private S3-Speicher werden weiterverwendet. Es wird kein neuer Dienst gebucht.

## System & Verbindungen

Nur Administratoren können `/admin/system`, `/admin/system/check`, `/admin/system/backups` und den Kontakt-Eingang aufrufen. Die Oberfläche ist unter Verwaltung erreichbar. Sie zeigt **konfiguriert** getrennt von **geprüft**, den Prüfumfang und die Zeitpunkte. Historische Erfolge sind keine Garantie für aktuelle Erreichbarkeit. Ein aktueller Datenbankausfall kann auch den Abruf der internen Übersicht verhindern; hierfür ist `/ready` unabhängig vom globalen Metadaten-Lock vorgesehen.

- `/health`: Prozess antwortet, keine Anbieterprüfung. HTTP 200 bedeutet nur Liveness.
- `/ready`: frische `SELECT 1`-Abfrage, Antwort nach höchstens drei Sekunden, bei fehlender Bestätigung HTTP 503. Keine Zugangsdaten, Firmennamen oder Speicherkennungen in der öffentlichen Antwort. Dies prüft nur die Datenbank.
- Originalspeicher testen: 64 zufällige Bytes schreiben, vollständig lesen, vergleichen und zur Bereinigung freigeben. Regelmäßige Dateiaktionen aktualisieren zusätzlich den beobachteten Zustand.
- SMTP prüfen: Verbindungsaufbau und Authentifizierung, keine Test-E-Mail. Nachrichtenannahme wird bei tatsächlichem Versand separat festgehalten. Posteingang, Spamablage und Lesestatus lassen sich daraus nicht ableiten.
- Google: Konfiguration und künftig beobachtete erfolgreiche Anbieteranmeldung. Erfolg in einem Bereich ersetzt den separaten Test des anderen Portals nicht.
- Apple/SMS: optional, keine Aktivierung oder kostenpflichtiger Test durch diese Übersicht.
- autoiXpert: Konfiguration und letzte in der Anwendung vollständig bestätigte Übergabe; kein neuer kostenpflichtiger API-Aufruf für die Übersicht.

Die Zeitlimits des SMTP-Transports und der AWS-Anfragen bleiben erhalten. Ein externer Verfügbarkeitsmonitor ist mit diesem Release **nicht neu eingerichtet**. Die Administration prüft die Übersicht und offene Zustellungen; ein bestehender externer Monitor kann `/health` und `/ready` getrennt verwenden.

## Kontaktanfragen und Versand

Anfragen werden vor dem Versand in `contact_request` persistiert. Anhänge erhalten opaque Speicher-IDs; Zugriff auf `contact_file` erfolgt nur nach aktueller Administratorprüfung, vor und nach dem Download. Quoten gelten auch für neue Kontaktanhänge. Bei teilweise fehlgeschlagenen Anhängen bleiben Text und bereits bestätigte Dateien erhalten. Abgebrochene Übernahmen werden nach Ablauf ihrer zehnminütigen Frist als unvollständig erkennbar abgeschlossen und zur Benachrichtigung eingereiht.

Die Benachrichtigung verwendet die vorhandene persistente Versandliste und die gemeinsame Logo-Vorlage. Es gibt eine feste interne Empfängeradresse. Bei eindeutig nicht angenommenem Versand erfolgen maximal vier Versuche mit Wartezeit; `uncertain` wird nur nach manueller Bestätigung wiederholt. Der Eingang bleibt unabhängig von E-Mail bearbeitbar. Alte `data/anfragen`-Dateien werden weder gelöscht noch automatisch importiert. Vor einem manuellen Import müssen Herkunft und bereits erfolgte Bearbeitung geprüft werden.

## Sicherungsstand und Verantwortung

Am 14.09.2026 im angemeldeten Hostinger-Konto gelesen:

- Tägliche automatische Website-Sicherung wird angezeigt.
- Letzte Datei- und Datenbanksicherung: **13.09.2026 19:27**, entsprechend der hPanel-Anzeige; Zeitzone dort nicht ausgewiesen.
- Die ausgewählte produktive Portal-Datenbank besitzt sichtbare Sicherungen vom **09. bis 13.09.2026**, jeweils 19:27.
- hPanel bietet Datenbank herunterladen und wiederherstellen an. Diese Aktionen wurden nicht ausgeführt; vorhandene Sicherungen bleiben unverändert.
- Die vertraglich garantierte Aufbewahrungsdauer wurde nicht bestätigt. Fünf sichtbare Sicherungsstände beweisen keine generelle Fünf-Tage-Aufbewahrung.

Nach dem Einrichtungsprotokoll vom 13.09.2026 hat S3 Versionierung und 30 Tage Aufbewahrung nicht aktueller Versionen. Dies wurde für diesen Nachtest nicht erneut über die AWS-Konsole bestätigt. Versionierung schützt nicht die MySQL-Zuordnungen. Die Applikations-IAM-Zugangsdaten besitzen bewusst keine Rechte zur Wiederherstellung oder Löschung einzelner historischer S3-Versionen.

Verantwortung: UNFALLX Administration, Providerzugang über das Firmenkonto. Eine namentlich benannte Vertretung und eine verbindliche Frist für die Wiederherstellung sind noch betrieblich festzulegen. **Vorschlag, keine Zusage:** RPO höchstens 24 Stunden und RTO vier Stunden; erst nach Providerprüfung und realistischer Restore-Messung verbindlich festhalten. Manuelle Angaben lassen sich im Systembereich pflegen.

## Nachgewiesener Test und offene Produktionsabnahme

`scripts/restore-drill.js` erstellt ausschließlich eine fiktive Akte in einem frischen temporären Verzeichnis. Es nutzt SQLite als lokalen Datenbankersatz und einen simulierten privaten S3-Speicher. Die Datenbank wird vor der Kopie geschlossen; eine getrennte Ziel-Datenbank wird aus der Kopie aufgebaut. Fehlende und manipulierte Originalobjekte werden erkannt. Nach Wiederherstellung des passenden Objekt-Snapshots werden Fallzuordnung, Größe, Bytes und SHA-256 verglichen. Der Test löscht nur sein eigenes temporäres Verzeichnis.

Dieser Test ist bestanden. Er ist **kein** Nachweis, dass ein echtes Hostinger-MySQL-Backup erfolgreich zurückgespielt wurde. Produktive Backups wurden nicht heruntergeladen oder überschrieben. Für die Freigabe eines belastbaren Notfallplans bleibt dieser isolierte Provider-Test offen:

1. Backupdatum, Datenbankname, Versionen und benötigte S3-Schlüssel inventarisieren. Abweichungen durch zeitversetzte Sicherungen dokumentieren.
2. Eine separate Test-Datenbank und einen privaten Test-Dateibereich mit minimalen Berechtigungen bereitstellen. Produktive SMTP-, OAuth- und autoiXpert-Zugänge nicht übernehmen; automatischen Nachrichtenversand ausschalten.
3. Ein abgestimmtes Backup in die neue Datenbank importieren. Benötigte historische S3-Versionen durch einen berechtigten Betreiber in den Testbereich kopieren; Referenzen nur in der Test-Datenbank anpassen.
4. Mindestens eine fiktive Testakte plus Originalfoto und PDF prüfen: Zuordnung, Dateianzahl, Größe und SHA-256. Anmeldung und Betriebstrennung mit fiktiven Konten testen.
5. Wiederherstellungsdauer und nachgewiesenen Datenverlust messen. Datum, zuständige Person, Backup-IDs und Prüfergebnis protokollieren. Erst dann RPO/RTO und Aufbewahrung bestätigen.
6. Testumgebung und temporäre Daten nach dokumentierter Abnahme gezielt entfernen. Keine pauschalen Löschbefehle gegen Produktiv-Bucket oder Originaldatenbank verwenden.

## OAuth-Adressen

Im **bestehenden Google-OAuth-Webclient** müssen beide Adressen exakt eingetragen sein:

```
https://app.unfallx.com/api/portal/oauth/google/callback
https://admin.unfallx.com/api/portal/oauth/google/callback
```

Die Anwendung bildet die Rücksprungadresse anhand des aktuellen Arbeitsbereichs. Die Hauptdomain `unfallx.com` ist nicht der produktive Partner-/Admin-Callback. Der aktuelle Client-Eintrag in Google Cloud wurde bei diesem Nachtest nicht administrativ eingesehen. Eine Schaltfläche allein bestätigt keine erfolgreiche Anmeldung.

Apple ist derzeit nicht als freigeschalteter Login nachgewiesen. Falls später tatsächlich angeboten, nur die benötigten Arbeitsbereiche konfigurieren: analog `/api/portal/oauth/apple/callback`, mit Services ID und zugehöriger Primary App ID. Keine zusätzlichen Anbieter oder Secrets für diesen Release anlegen.
