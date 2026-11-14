# Schnellstart in 5 Minuten

Dies ist der schnellste Weg, den Bundestag Wort-Tracker zum Laufen zu bringen.

## Voraussetzungen

Sie benötigen:
- Python 3.12+
- Node.js 18+
- uv (Python-Paketmanager)
- Bundestag-API-Schlüssel

## Schnelleinrichtung

### 1. API-Schlüssel erhalten (2 Minuten)

Besuchen Sie: https://dip.bundestag.de/uber-dip/hilfe/api

Fordern Sie einen kostenlosen API-Schlüssel an.

### 2. Umgebung konfigurieren (30 Sekunden)

```bash
cp .env.example .env
# Bearbeiten Sie .env und fügen Sie Ihren API-Schlüssel ein
```

### 3. Abhängigkeiten installieren (1 Minute)

```bash
# Python-Abhängigkeiten
uv sync

# Frontend-Abhängigkeiten
cd frontend
npm install
cd ..
```

### 4. Beispieldaten laden (2 Minuten)

```bash
./setup_sample_data.sh
```

Dies entdeckt und verarbeitet 5 Beispielprotokolle.

### 5. Anwendung starten (30 Sekunden)

Öffnen Sie zwei Terminal-Fenster:

**Terminal 1:**
```bash
./start_backend.sh
```

**Terminal 2:**
```bash
./start_frontend.sh
```

### 6. Anwendung verwenden

Öffnen Sie Browser unter: http://localhost:5173

Suchen Sie nach häufigen Wörtern wie:
- bundestag
- deutschland
- regierung
- europa

## Das war's!

Sie haben jetzt einen funktionierenden Worthäufigkeits-Tracker.

## Nächste Schritte

Möchten Sie mehr Daten?

```bash
# Weitere Protokolle entdecken
uv run python backend/process_protocols.py discover 50 100

# Diese verarbeiten
uv run python backend/process_protocols.py process

# Fortschritt überprüfen
uv run python backend/process_protocols.py status
```

## Brauchen Sie Hilfe?

- Vollständige Dokumentation: `README_DE.md`
- Architekturübersicht: `ARCHITEKTUR.md`
- Fehlerbehebung: siehe `README_DE.md`
- Einrichtung überprüfen: `./verify_setup.sh`

## Häufige Probleme

**"Wort nicht gefunden"**
- Sie benötigen mehr verarbeitete Protokolle
- Versuchen Sie zunächst häufige Wörter

**"API-Fehler"**
- Überprüfen Sie Ihren API-Schlüssel in .env
- Überprüfen Sie die Internetverbindung

**Port bereits in Verwendung**
- Backend verwendet Port 8000
- Frontend verwendet Port 5173
- Bei Bedarf in den jeweiligen Konfigurationsdateien ändern

## Zu testende Funktionen

1. Nach einem Wort suchen
2. Das Zeitachsendiagramm anzeigen
3. Zwischen absoluten Zahlen und Prozentsätzen umschalten
4. Auf "PDF ansehen" klicken, um Originalprotokolle zu sehen
5. Die Protokolldetail-Tabelle überprüfen

Viel Spaß beim Verfolgen von Bundestag-Worttrends!
