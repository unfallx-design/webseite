# Privater Dateispeicher für UNFALLX

## Architektur

Hostinger betreibt weiterhin Website, Partnerportal, Administration und MySQL.
MySQL enthält Konten, Zugriffsrechte, Fälle, Dateinamen und Speicherreferenzen.
Amazon S3 Standard in Frankfurt (`eu-central-1`) speichert Originaldateien.
Browser und iPhone-App nutzen unverändert die authentifizierte Datei-API des
Portals. Es gibt keine öffentlichen S3-Links, keine Browser-Zugangsschlüssel und
keine CORS-Freigabe am Bucket. Vorschauen sind verkleinerte Ableitungen;
Originaldownloads bleiben unverändert. Die App prüft SHA-256 beim Upload und
bei jedem S3-Download.

## AWS einmalig bereitstellen

1. Firmenkonto mit eigenem Root-Passwort und MFA vervollständigen. Keine
   Root-Zugangsschlüssel erzeugen. Kostenlosen Basic-Support verwenden.
2. In der AWS-Konsole Frankfurt wählen. CloudFormation-Stack
   `unfallx-private-storage` mit `infra/aws-private-storage.json` erstellen.
   Die Vorlage enthält keine Geheimnisse. Sie erstellt den privaten Bucket,
   einen eingeschränkten IAM-Benutzer und einen monatlichen Kostenalarm.
3. Bucket prüfen: alle vier Sperren für öffentlichen Zugriff aktiv, ACLs
   deaktiviert, SSE-S3/AES256 aktiv, ausschließlich HTTPS. Der Bucket darf kein
   Website-Hosting und keine Replikation in andere Regionen erhalten.
4. Für `unfallx-hostinger-storage` einen Zugriffsschlüssel für eine Anwendung
   außerhalb von AWS erstellen. Dieser Benutzer hat nur Get/Put/DeleteObject
   unter `originals/` in diesem Bucket. Keine Administrator-, IAM-,
   Bucket-Policy-, ListAllBuckets- oder DeleteObjectVersion-Berechtigungen.
5. Schlüssel ausschließlich in der privaten Hostinger-Konfiguration speichern.
   Nicht in Git, Tickets, Screenshots oder Protokolle übernehmen.

Für die Hostinger-Laufzeit ohne Rollenföderation wird ein eingeschränkter
technischer IAM-Zugriffsschlüssel benötigt. Ihn regelmäßig rotieren. Bei einem
späteren Wechsel auf eine AWS-Laufzeit stattdessen kurzlebige IAM-Rollen verwenden.

## Hostinger-Konfiguration und Aktivierung

Die folgenden Werte zusammen in der privaten Umgebung hinterlegen:

| Variable | Wert |
| --- | --- |
| `PORTAL_FILE_STORAGE` | `s3` |
| `PORTAL_S3_BUCKET` | Bucket aus dem Stack-Output |
| `PORTAL_S3_REGION` | `eu-central-1` |
| `PORTAL_S3_ACCOUNT_ID` | eigene zwölfstellige AWS-Kontonummer |
| `PORTAL_S3_ACCESS_KEY_ID` | technischer IAM-Schlüssel |
| `PORTAL_S3_SECRET_ACCESS_KEY` | zugehöriges Geheimnis |
| `PORTAL_STORAGE_MB` | zunächst `102400` für 100 GiB |

`PORTAL_STORAGE_MB` begrenzt neu hochgeladene Fallfotos und PDFs gemeinsam.
Es reserviert keinen AWS-Speicher und ist kein AWS-Ausgabenlimit. Anfragen,
Downloads, zurückbehaltene Dateiversionen und weitere AWS-Dienste können
zusätzliche Kosten verursachen. Die Vorlage meldet bei 50 % und 100 % eines
monatlichen AWS-Budgets von 10 USD an info@unfallx.com; sie stoppt den Betrieb
nicht automatisch.

Der Hostinger-Loader liest ausschließlich die freigegebenen Speichervariablen
aus der privaten `hbuilds/config/.env`, falls sie bei den gemeinsam betriebenen
Subdomains nicht vollständig injiziert wurden. Injizierte Werte werden nicht
überschrieben; unterschiedliche Zugangsschlüssel werden nicht vermischt.
Vor dem Umschalten die Werte in hPanel und privater Datei konsistent halten.

Nach Neustart: Administration → Einstellungen → Fotos & Dokumente →
**Speicher prüfen**. Danach eine eigens erstellte Testdatei über das Portal
hochladen und herunterladen; Hash und Zugriffssperre für andere Partner prüfen.
Keinen Erfolg melden, bevor dieser Test gegen den echten AWS-Bucket gelingt.

## Bestandsdateien übertragen

Die Umstellung kopiert keine Dateien beim Start des Servers. Vorhandene
Datenbankdateien bleiben lesbar. Unter Einstellungen → Fotos & Dokumente kann
die Administration pro Durchlauf bis zu fünf Bestandsdateien übertragen.
Jede Datei wird nach dem Upload vollständig zurückgelesen und verglichen.
Erst danach werden ihre Speicherreferenz und das Entfernen der Datenbankkopie
gemeinsam in einer SQL-Transaktion bestätigt. Fehlgeschlagene Übertragungen
lassen die Datenbankkopie unverändert. Wiederholte Durchläufe überspringen
bereits umgestellte Dateien. Eine zweite Person kann währenddessen weiter
auf bestehende Dateien zugreifen, gegebenenfalls mit kurzer Wartezeit.

Bei Datenbankfehlern werden neu erzeugte S3-Dateien bereinigt. Ein unklarer
COMMIT-Ausgang löscht keine möglicherweise bereits referenzierte S3-Datei.
Fehlgeschlagene reguläre Löschungen werden als interne Aufträge gespeichert
und nach späteren erfolgreichen Transaktionen erneut versucht. Serverabbruch
oder unklarer COMMIT kann eine nicht referenzierte Datei hinterlassen: solche
Dateien anhand der Datenbankreferenzen prüfen, keinesfalls pauschal löschen.

## Aufbewahrung, Wiederherstellung und Datenschutz

Die Vorlage aktiviert S3-Versionierung. Es gibt keine automatische Löschung
aktueller Originaldateien. Nicht mehr aktuelle Versionen werden nach 30 Tagen
zur Löschung vorgesehen; abgebrochene Multipart-Uploads nach einem Tag.
AWS führt Lifecycle-Aktionen asynchron aus. Gelöschte Originale können deshalb
für diese begrenzte Zeit als geschützte frühere Version wiederherstellbar sein.
Eine vollständige vorzeitige Löschung aller Versionen ist eine gezielte
administrative AWS-Aktion, zu der der App-Schlüssel nicht berechtigt ist.

Vor produktiver Nutzung die AWS-Vertragsunterlagen einschließlich DPA sowie
Unterauftragsverarbeiter dokumentieren und Datenschutzhinweise aktualisieren.
Frankfurt als Speicherort ersetzt diese Betreiberpflichten nicht. Eine
Wiederherstellung benötigt passende S3-Dateien **und** eine MySQL-Sicherung:
die Datenbankreferenzen enthalten Zuordnung und Integritätsprüfwerte.

Rollback: Neue Uploads können mit `PORTAL_FILE_STORAGE=database` wieder in der
Datenbank gespeichert werden; dabei die S3-Zugangsvariablen erhalten, damit
bereits umgestellte Dateien weiterhin gelesen werden können. Datenbankkapazität
vorher prüfen. Alte Serverversionen ohne diesen Adapter dürfen nach der
Bestandsübertragung nicht wieder produktiv eingesetzt werden.

## Verifikation

`npm run check` und `npm test`. Die Tests verwenden einen injizierten S3-Simulator
und lokale SQLite-Datenbanken: Originalbytes, beschädigte Rückgaben, Fehler beim
Upload/Commit, Bereinigung, Migration, Neustart, Kontogrenzen, PDF-Bereich und
Admin-Endpunkte. Sie ersetzen nicht den abschließenden Test gegen echtes AWS.

Referenzen: [S3-Sicherheit](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html),
[Prüfsummen](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html),
[AWS-Datenschutz](https://aws.amazon.com/compliance/gdpr-center/),
[AWS-Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html).
