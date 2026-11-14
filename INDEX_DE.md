# Bundestag Wort-Häufigkeits-Tracker - Dokumentationsindex

## Hier beginnen

**Neu im Projekt?** Lesen Sie diese in der Reihenfolge:

1. **[SCHNELLSTART.md](SCHNELLSTART.md)** - 5-Minuten-Schnellstartanleitung
2. **[README_DE.md](README_DE.md)** - Vollständige Projektdokumentation

## Hilfsskripte

### Einrichtung & Überprüfung
```bash
./verify_setup.sh                 # Prüfen, ob alles korrekt installiert ist
./beispieldaten_einrichten.sh     # 5 Beispielprotokolle zum Testen laden
```

### Anwendung ausführen
```bash
./backend_starten.sh              # API-Server starten (Port 8000)
./frontend_starten.sh             # Weboberfläche starten (Port 5173)
```

### Datenverwaltung
```bash
# Protokolle entdecken
uv run python backend/process_protocols.py discover [start_id] [anzahl]

# Protokolle verarbeiten
uv run python backend/process_protocols.py process [limit]

# Status überprüfen
uv run python backend/process_protocols.py status
```

## Code-Organisation

### Backend (Python)
```
backend/
├── api.py                  # FastAPI-Server mit REST-Endpunkten
├── database.py             # SQLite-Datenbankoperationen
├── process_protocols.py    # Protokollentdeckung und -verarbeitung
├── text_processing.py      # Wortextraktion und Normalisierung
└── xml_processing.py       # XML-Parsing von der Bundestags-API
```

### Frontend (React)
```
frontend/src/
├── components/
│   ├── SearchPage.jsx      # Suchoberfläche
│   ├── WordTimeline.jsx    # Wortdetailseite mit Diagramm
│   └── Chart.jsx           # Chart.js-Wrapper-Komponente
├── utils/
│   └── api.js              # API-Client-Funktionen
├── App.jsx                 # Haupt-App mit Routing
├── App.css                 # Alle Styles (responsives Design)
└── main.jsx                # React-Einstiegspunkt
```

## Schnellreferenz

### API-Endpunkte
- `GET /api/status` - Datenbankstatistiken
- `GET /api/words/search?q=<begriff>` - Nach Wörtern suchen
- `GET /api/words/<wort>/timeline` - Häufigkeits-Zeitachse abrufen
- `GET /api/words/<wort>/details` - Wort-Metadaten abrufen

### Häufige Befehle
```bash
# Einrichtung
cp .env.example .env        # Umgebungsdatei erstellen
uv sync                     # Python-Abhängigkeiten installieren
cd frontend && npm install  # Frontend-Abhängigkeiten installieren

# Entwicklung
./backend_starten.sh        # Backend starten (Port 8000)
./frontend_starten.sh       # Frontend starten (Port 5173)

# Testen
./verify_setup.sh           # Installation überprüfen
./beispieldaten_einrichten.sh  # Beispieldaten laden

# Daten laden
uv run python backend/process_protocols.py discover 1 50   # Protokolle finden
uv run python backend/process_protocols.py process 5       # 5 verarbeiten
uv run python backend/process_protocols.py status          # Status prüfen
```

### URLs
- Frontend: http://localhost:5173
- Backend-API: http://localhost:8000
- API-Dokumentation: http://localhost:8000/docs (FastAPI auto-generiert)

## Fehlerbehebungsanleitung

### Einrichtungsprobleme
1. Führen Sie `./verify_setup.sh` aus, um die Installation zu überprüfen
2. Stellen Sie sicher, dass Python 3.12+, Node.js 18+ und uv installiert sind
3. Überprüfen Sie, ob die `.env`-Datei mit gültigem API-Schlüssel existiert

### Laufzeitprobleme
1. Prüfen Sie, ob sowohl Backend als auch Frontend laufen
2. Überprüfen Sie, ob die Ports 8000 und 5173 nicht belegt sind
3. Suchen Sie nach Fehlern in der Terminal-Ausgabe
4. Überprüfen Sie die Browser-Konsole auf Frontend-Fehler

### Datenprobleme
1. Stellen Sie sicher, dass Sie `./beispieldaten_einrichten.sh` ausgeführt oder Protokolle verarbeitet haben
2. Überprüfen Sie, ob die Datenbank existiert: `ls backend/bundestag.db`
3. Status prüfen: `uv run python backend/process_protocols.py status`

## Implementierte Funktionen

- [x] Wortsuche mit Autovervollständigung
- [x] Zeitreihenvisualisierung (Google Trends-Stil)
- [x] Umschaltung zwischen absoluten Zahlen und Prozentsätzen
- [x] Verfolgung des ersten Vorkommens
- [x] Links zu Original-PDF-Protokollen
- [x] Protokolldetail-Tabellen
- [x] Responsives Design
- [x] Echtzeit-Suche mit Verzögerung
- [x] Datenbank-Statusanzeige
- [x] Fehlerbehandlung und Ladezustände

## Technologie-Stack

**Backend:**
- Python 3.12+
- FastAPI (REST-API)
- SQLite (Datenbank)
- uvicorn (ASGI-Server)

**Frontend:**
- React 19 (UI-Framework)
- Vite (Build-Tool)
- React Router (Navigation)
- Chart.js (Visualisierung)

**Werkzeuge:**
- uv (Python-Paketmanager)
- npm (Node-Paketmanager)

## Hilfe erhalten

1. Überprüfen Sie die relevante Dokumentationsdatei oben
2. Führen Sie `./verify_setup.sh` bei Einrichtungsproblemen aus
3. Lesen Sie die Fehlermeldungen sorgfältig
4. Überprüfen Sie, ob alle Abhängigkeiten installiert sind
5. Überprüfen Sie, ob Ihr API-Schlüssel korrekt ist

## Projektstatus

**Status:** ✓ VOLLSTÄNDIG UND EINSATZBEREIT

Alle Komponenten implementiert:
- Backend-API mit 4 Endpunkten
- SQLite-Datenbank mit optimiertem Schema
- React-Frontend mit 3 Hauptkomponenten
- Wortverarbeitungspipeline
- Diagrammvisualisierung
- Hilfsskripte und Dokumentation

**Nächste Schritte für Sie:**
1. Bundestag-API-Schlüssel erhalten
2. `.env`-Datei konfigurieren
3. `./beispieldaten_einrichten.sh` ausführen
4. Backend und Frontend starten
5. http://localhost:5173 öffnen

Viel Spaß beim Verfolgen von Worttrends im Bundestag!
