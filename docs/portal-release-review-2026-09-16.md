# Portalprüfung – 16. September 2026

## Umfang und Ergebnis

Partnerportal und internes Dashboard wurden anhand des veröffentlichten Stands `2f8fc14e35a8715e7f72392b47aae941383e4d3e` erneut geprüft. Die bestehenden Korrekturen an der Dateiverwaltung und der Kommunikation bleiben enthalten. Für Änderungen und Bedienprüfungen wurden ausschließlich fiktive Daten in einer getrennten lokalen Datenbank genutzt. Keine produktiven Akten oder Originaldateien wurden geändert, keine echten E-Mails verschickt und keine kostenpflichtigen Gutachten angelegt.

## Zusätzlich behobene Fehler

1. **Dateien nach einem Teilfehler des Mehrfachuploads nicht entfernbar:** Bereits gespeicherte Fotos und PDFs können nun auch direkt in der Upload-Auswahl entfernt werden. Das gilt bei der neuen Aufnahme, beim Ergänzen einer Fallakte und für die Firmen-PDF-Ablage. Erst nach Bestätigung und erfolgreicher serverseitiger Papierkorb-Aktion verschwindet der Eintrag. Nicht hochgeladene Dateien und bearbeitete Formularfelder bleiben erhalten. Doppelklicks führen nicht zu doppelten Löschanfragen.
2. **Veraltete Dateibestätigung nach Änderungen im anderen Portal:** Uploadbestätigungen berücksichtigen nur noch aktive Dateien der aktuellen Akte. Zwischenzeitlich entfernte Dateien werden weder erneut bestätigt noch automatisch hochgeladen. Die serverseitige Prüfung der Pflichtunterlagen bleibt maßgeblich für die Einreichung.
3. **Offene Ansicht bei einem inzwischen gesperrten Konto:** Verweigert die Identitätsprüfung den Zugang mit 403, sperrt die Oberfläche den Arbeitsbereich und bereinigt lokale Entwürfe wie bei einer abgelaufenen Sitzung. Ein vorübergehender Serverfehler (503) löst keine fälschliche Kontosperre oder Entwurfsbereinigung aus. Prüfung beim Wechsel zurück in einen sichtbaren Tab und periodisch im sichtbaren Portal; keine sofortige Fernlöschung bereits exportierter Kopien.
4. **Veralteter Firmenstatus in der Navigation:** Bei erfolgreicher Prüfung vor einem Ansichtswechsel übernimmt die Oberfläche den aktuellen Kontodatensatz. Eine zwischenzeitliche Firmenfreigabe wird damit ohne erneutes Anmelden berücksichtigt.

## Dateiaktionen und Schutzregeln

- Einzeldatei: Fall öffnen → „PDFs & Dokumente“ bzw. „Fotos“ → „Entfernen“. Wiederherstellung unter „Entfernte Dateien“.
- Teilweise übertragene Auswahl: × an der gespeicherten Datei. Nicht gespeicherte Dateien werden nur aus der Auswahl entfernt; gespeicherte Originale erst nach Bestätigung in den Papierkorb verschoben.
- Nach Einreichung dürfen Partner nicht beliebig ihre Nachweise verändern. UNFALLX kann eine Rückfrage eröffnen. Geschützte Exportoriginale, versandte Gutachten und freigegebene Rechnungen bleiben geschützt; der konkrete Grund wird angezeigt.
- Der Dateipapierkorb gehört zur gemeinsamen Akte. Die separate Fallablage (Archiv/Papierkorb) bleibt je Arbeitsbereich unabhängig.
- Papierkorb bedeutet wiederherstellbares Entfernen und gibt noch keinen Speicherplatz frei.

## Prüfung

**174 automatisierte Tests bestanden, keine Fehler oder übersprungenen Tests. 56 Syntaxprüfungen bestanden.**

| Bereich | Geprüft |
|---|---|
| Zugang | Registrierung, Passwort, Einladungen, Login-Link, OAuth-Validierung, MFA-Grenzen, Sitzungsende, Kontowechsel, Rechte und getrennte Arbeitsbereiche |
| Aufnahme | Entwurf, Pflichtfelder, Einreichen, Rückfragen, Statuswechsel, Bearbeiter und Versionskonflikte |
| Dateien | 35 Fotos und PDFs, Dateien über 6 MB, Originalbytes, Mehrfachauswahl, Teilfehler, Wiederholen, Entfernen/Wiederherstellen, ZIP, verborgene/geschützte Dateien |
| Datenspeicher | Datenbank und kontrollierter S3-Testanbieter, langsame Zugriffe, Rechteentzug, Quoten, Fehlerbereinigung und synthetische Wiederherstellung |
| Kommunikation | Empfänger, einheitliche Mailvorlage, dauerhafte Warteschlange, Nachrichten, Kundenstatuslinks und Versandfehler |
| Abrechnung | Honorar-/Prozentrechnung, Bestätigung, Teilzahlung, vollständiger Eingang, Rechnungsfreigabe und erfasste Auszahlung |
| Übergabe | autoiXpert-Berechtigungen, Exportschnappschüsse und Fehlerbehandlung mit Testanbieter |

Browserprüfung: Ein Partner entfernt eine fiktive PDF, die Administration findet und restauriert sie, anschließend sieht der Partner die wiederhergestellte Datei einschließlich Verlauf. Neue mobile Aufnahme als unvollständigen Entwurf gespeichert; fehlende Mindestangaben wurden zuvor verständlich abgewiesen. Admin-Dateiansicht bei 390 Pixeln und Partnerakte/Neuaufnahme bei 320 Pixeln ohne horizontalen Seitenüberlauf. Keine JavaScript-Fehler in den geprüften lokalen Ansichten.

Die Chromium-Erweiterung blockierte das Befüllen des nativen Dateidialogs mit „Not allowed“. Die Mehrfachauswahl ist vorhanden. Serverseitige Originaluploads und Fehlerpfade sowie die Änderung der Upload-Oberfläche wurden unabhängig automatisiert geprüft. Ein tatsächlicher Kamera-/Dateiauswahltest auf dem vorgesehenen iPhone bleibt offen.

Die offizielle npm-Registry lieferte bei der Bulk-Sicherheitsabfrage für die 71 Produktionspaketnamen keine gemeldeten Advisories. Dies ist eine Prüfung bekannter Meldungen, keine vollständige Sicherheitsgarantie.

## Freigabegrenzen

Die getesteten Funktionskorrekturen sind zur Veröffentlichung geeignet. Eine uneingeschränkte Gesamtfreigabe ist damit nicht belegt. Weiter offen sind die bereits dokumentierten Punkte in [Datenschutz-Nacharbeit](privacy-review-followup.md) und [Betrieb und Sicherungen](operations-and-backups.md), besonders interne MFA, Aufbewahrung/Endlöschung, Anbieter- und Rollenunterlagen sowie ein echter isolierter Restore aus Anbietersicherungen.

Apple-Login, SMS-Verifikation und echte Zustellung in einen Empfänger-Posteingang werden mit diesem Test nicht als funktionsfähig bestätigt. Ebenso erfolgte kein neuer kostenpflichtiger autoiXpert-Livetest. Ein nativer iPhone-Login ist ein eigener Integrationsumfang und gehört nicht zu dieser Portaländerung.
