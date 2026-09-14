# Datenschutzprüfung: technischer Nachtrag und offene Entscheidungen

Stand: 14.09.2026. Grundlage: übermittelter Bericht `UnfallX-Datenschutzpruefung-2026-09-14.md` und dessen Belegdatei. Die Befunde werden zusammen mit [Betrieb und Sicherungen](operations-and-backups.md) geführt. Dies ist keine rechtliche Datenschutzfreigabe.

## In diesem Nachtrag behoben

- Lokale Entwurfscontroller werden bei Sitzungsende gesperrt. Bereits laufende Speicheraufträge werden abgewartet, noch wartende Aufträge verworfen und erst danach die lokalen Entwürfe dieses Kontos entfernt. Auch Controller aus zuvor verlassenen Ansichten werden erfasst.
- Ein abgebrochener IndexedDB-Löschvorgang wird nicht mehr still übergangen. Die gesperrte Oberfläche zeigt die fehlgeschlagene Bereinigung, bietet einen Wiederholungsversuch und verweist bei fortbestehendem Browserfehler auf das Entfernen der Websitedaten.
- Nach einer HTTP-401-Antwort werden sichtbare Falldaten, Bilder, Dialoge und Navigation unmittelbar entfernt. Laufende Anfragen werden abgebrochen; verspätete Antworten können den alten Arbeitsbereich nicht wiederherstellen. Foto-/PDF-Uploadbatches stoppen nach einem Sitzungsfehler.
- Abmelden funktioniert auch während einer laufenden Übertragung. Bereits serverseitig bestätigte Originale bleiben erhalten. Andere Tabs derselben Browsersitzung werden, sofern BroadcastChannel verfügbar ist, ebenfalls gesperrt. Nachrichten sind auf das gleiche Konto und dieselbe Sitzung begrenzt.
- Die Sitzung wird bei Rückkehr in einen sichtbaren Tab und alle 60 Sekunden im sichtbaren Portal nachgeprüft. Eine wiederhergestellte Seite aus dem Browser-Zurück-Cache wird gesperrt und verlangt erneute Anmeldung.

Die lokale Wiederaufnahme bleibt grundsätzlich erhalten. Ein Browser kann eine Bereinigung verweigern; in diesem Fall wird kein erfolgreicher Löschstatus behauptet. Die bisherige zugriffsabhängige Siebentagesbereinigung ist kein geräteunabhängiger Löschdienst. Eine gesonderte Option für gemeinsam genutzte Geräte und organisatorische Geräteabsicherung bleiben zu planen.

## Offene Prioritäten

| Priorität | Thema | Stand und nächster Schritt |
|---|---|---|
| Hoch | Vollständige Endlöschung | Der Papierkorb ist weiterhin keine Endlöschung. Zuerst Aufbewahrungsgründe, Sperren und Fristen je Datenart festlegen. Danach ein kontrolliertes Verfahren für MySQL, aktuelle und historische S3-Objekte, Exporte, Mailkopien und Backups entwickeln. Keine pauschale Löschung oder neue automatische Löschfrist aktiviert. |
| Hoch | Interne Mehrfaktor-Anmeldung | Im geprüften Konto war keine zusätzliche App-MFA eingerichtet; Google-MFA wurde nicht nachgewiesen. Geeignetes Verfahren und Wiederherstellung für alle internen Anmeldewege festlegen, mit sicherem Enrollment und ohne unvorbereitete Aussperrung. Keine Zugangsdaten oder Kontoeinstellungen geändert. |
| Hoch | Anbieter- und Rollenunterlagen | Tatsächlich geltende Verträge, Zwecke, Datenarten, Rollen, Speicherorte, Drittlandgrundlagen, Löschwege und Verantwortliche belegen. Fehlende Belege bedeuten nicht, dass Verträge im Unternehmen fehlen. Keine Verträge angenommen. |
| Hoch | Betroffenenanfragen und Aufbewahrung | Zuständigkeit, Identitätsprüfung, Fristenkontrolle und Suche über alle Kopien dokumentieren. Der bestehende Kontoexport allein bildet keinen vollständigen Auskunftsprozess ab. |
| Hoch | Wiederherstellung | Hostinger-Sicherungen inzwischen im Firmenkonto nachgewiesen; synthetischer Restore bestanden. Isolierter Restore aus echten MySQL-/S3-Sicherungen bleibt offen. Siehe Betriebsdokumentation. |
| Mittel | IBAN und weitere Pflichtangaben | Die IBAN-Pflicht entspricht einer ausdrücklichen fachlichen Vorgabe des Auftraggebers und wurde nicht still entfernt. Erforderlichkeit je Auftragsart abstimmen; danach gegebenenfalls optional oder erst im passenden Regulierungsschritt erheben. |
| Mittel | Gutachten per E-Mail | SMTP-Verbindung getestet, aber kein Nachweis für den gesamten Übertragungsweg bis zum Empfänger. Schutzbedarf, Empfängeranforderungen und geeigneten Abruf-/Verschlüsselungsweg festlegen. Versandfunktion unverändert. |
| Mittel | Indirekt betroffene Personen und sensible Unterlagen | Informationsablauf für Halter, Unfallgegner und weitere Personen sowie konkrete Hinweise an Freitext/Upload und gegebenenfalls getrennte Abläufe festlegen. Keine pauschale zusätzliche Einwilligungscheckbox ergänzt. |
| Offen | MySQL-Transport und Hostinglogs | Tatsächliche Providerarchitektur, Schutz des Datenbanktransportes und Log-Aufbewahrung nachweisen. Keine TLS-Option ohne passenden Provider-Nachweis blind aktiviert. |

## Prüfgrenzen und aktuelle Einordnung

Die im externen Bericht genannten acht S3-Dateien sind eine historische Beobachtung. Im späteren Betriebsnachtest wurden weitere produktive Originale angezeigt; der Altwert wird nicht als aktuelle Bestandszahl weitergeführt. Es liegen echte Fallangaben in den Portalen vor, daher wird die Anwendung nicht als reine Demo behandelt.

Der Nachtest dieser Fehler verwendet ausschließlich fiktive lokale Daten. Bestehende produktive Akten, Originaldateien, Kontozugänge und Anbietervereinbarungen bleiben unverändert. Eine nachgewiesene Funktionskorrektur ersetzt weder einen vollständigen Penetrationstest noch die offenen rechtlichen und organisatorischen Entscheidungen.
