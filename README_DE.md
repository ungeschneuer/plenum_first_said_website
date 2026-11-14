# Bundestag Wort-Häufigkeits-Tracker

Eine Webanwendung, die Worthäufigkeiten in deutschen Bundestagsdebatten im Zeitverlauf verfolgt und eine Google Trends-ähnliche Analyse bietet, wie oft bestimmte Wörter in Parlamentsprotokollen erscheinen.

## Funktionen

- Suche nach jedem in Bundestagsdebatten verwendeten Wort
- Zeitreihendiagramme zeigen Worthäufigkeit über Protokolle hinweg
- Umschaltung zwischen absoluten Zahlen und Prozentsätzen der Gesamtwörter
- Informationen zum ersten Vorkommen jedes Wortes
- Zugriff auf Original-PDF-Protokolle
- Detaillierte Protokoll-für-Protokoll-Aufschlüsselung

## Projektstruktur

```
.
├── backend/
│   ├── api.py              # FastAPI-Server
│   ├── database.py         # SQLite-Datenbankoperationen
│   ├── process_protocols.py  # Protokollverarbeitungsskript
│   ├── text_processing.py  # Wortextraktion und Normalisierung
│   └── xml_processing.py   # XML-Parsing-Hilfsprogramme
├── frontend/
│   ├── src/
│   │   ├── components/     # React-Komponenten
│   │   ├── utils/          # API-Client
│   │   ├── App.jsx         # Haupt-App-Komponente
│   │   ├── App.css         # Styles
│   │   └── main.jsx        # Einstiegspunkt
│   ├── index.html
│   └── vite.config.js
├── repo_source/            # Original plenum_first_said Bot-Code
├── pyproject.toml          # Python-Abhängigkeiten
├── package.json            # Frontend-Abhängigkeiten
└── .env                    # API-Schlüssel (aus .env.example erstellen)
```

## Einrichtung

### Voraussetzungen

- Python 3.12+
- Node.js 18+
- uv (Python-Paketmanager)
- Bundestag-API-Schlüssel

### 1. API-Schlüssel erhalten

Holen Sie sich einen kostenlosen API-Schlüssel von der Bundestags-API:
https://dip.bundestag.de/uber-dip/hilfe/api

### 2. Umgebung konfigurieren

```bash
cp .env.example .env
# Bearbeiten Sie .env und fügen Sie Ihren API-Schlüssel hinzu
```

### 3. Backend-Abhängigkeiten installieren

```bash
uv sync
```

### 4. Frontend-Abhängigkeiten installieren

```bash
cd frontend
npm install
```

### 5. Datenbank initialisieren

```bash
uv run python backend/database.py
```

## Verwendung

### Schritt 1: Protokolle entdecken und herunterladen

Protokolle von der Bundestags-API entdecken und zur Datenbank hinzufügen:

```bash
# Erste 100 Protokolle entdecken (IDs 1-100)
uv run python backend/process_protocols.py discover 1 100

# Weitere Protokolle entdecken (IDs 100-500)
uv run python backend/process_protocols.py discover 100 400

# Aktuellen Status überprüfen
uv run python backend/process_protocols.py status
```

Der Discover-Befehl holt Protokoll-Metadaten von der Bundestags-API und fügt gültige Protokolle zur Datenbank hinzu. Nicht alle IDs sind gültig (einige fehlen möglicherweise oder sind keine Bundestagsprotokolle).

### Schritt 2: Protokolle verarbeiten

Protokolle verarbeiten, um Worthäufigkeiten zu extrahieren:

```bash
# Erste 10 Protokolle verarbeiten (zum Testen)
uv run python backend/process_protocols.py process 10

# Alle unverarbeiteten Protokolle verarbeiten
uv run python backend/process_protocols.py process

# Status überprüfen
uv run python backend/process_protocols.py status
```

Dieser Schritt:
1. Lädt Protokoll-XML-Dateien herunter (falls nicht bereits zwischengespeichert)
2. Extrahiert Text aus XML
3. Zählt Worthäufigkeiten
4. Speichert Ergebnisse in der Datenbank

**Hinweis:** Die Verarbeitung aller historischen Protokolle kann mehrere Stunden dauern, abhängig von:
- Anzahl der Protokolle
- Netzwerkgeschwindigkeit
- API-Ratenbegrenzungen

### Schritt 3: Backend-API starten

In einem Terminal:

```bash
uv run python backend/api.py
```

Die API ist verfügbar unter http://localhost:8000

### Schritt 4: Frontend starten

In einem anderen Terminal:

```bash
cd frontend
npm run dev
```

Das Frontend ist verfügbar unter http://localhost:5173

### Schritt 5: Anwendung verwenden

1. Öffnen Sie http://localhost:5173 in Ihrem Browser
2. Suchen Sie nach einem Wort (z.B. "klimawandel", "digitalisierung")
3. Klicken Sie auf ein Wort, um seine Zeitachse anzuzeigen
4. Wechseln Sie zwischen absoluten Zahlen und Prozentsätzen
5. Sehen Sie sich Protokolldetails und PDF-Links an

## API-Endpunkte

- `GET /api/status` - Datenbankstatus
- `GET /api/words/search?q=<Begriff>` - Nach Wörtern suchen
- `GET /api/words/<wort>/timeline` - Worthäufigkeits-Zeitachse abrufen
- `GET /api/words/<wort>/details` - Wortdetails abrufen

## Entwicklung

### Backend-Entwicklung

Das Backend verwendet:
- FastAPI für die REST-API
- SQLite für Datenspeicherung
- Textverarbeitung adaptiert vom plenum_first_said Bot

Um das Backend zu ändern:
1. Bearbeiten Sie Dateien in `backend/`
2. Starten Sie den API-Server neu

### Frontend-Entwicklung

Das Frontend verwendet:
- React mit Vite
- React Router für Navigation
- Chart.js für Visualisierungen

Um das Frontend zu ändern:
1. Bearbeiten Sie Dateien in `frontend/src/`
2. Vite lädt automatisch neu

## Datenbankschema

### protocols
- id (TEXT, PRIMARY KEY)
- wahlperiode (INTEGER)
- protokollnummer (INTEGER)
- datum (DATE)
- titel (TEXT)
- pdf_url (TEXT)
- total_words (INTEGER)
- processed (BOOLEAN)

### words
- word_id (INTEGER, PRIMARY KEY)
- word (TEXT, UNIQUE)
- first_protocol_id (TEXT, FOREIGN KEY)

### word_occurrences
- id (INTEGER, PRIMARY KEY)
- word_id (INTEGER, FOREIGN KEY)
- protocol_id (TEXT, FOREIGN KEY)
- count (INTEGER)
- date (DATE)

## Leistungshinweise

- Die Datenbank verwendet Indizes auf word, date und protocol_id für schnelle Abfragen
- Zeitachsenabfragen sind für Zeitreihendaten optimiert
- Frontend implementiert verzögerte Suche, um API-Aufrufe zu reduzieren

## Fehlerbehebung

### Keine Protokolle gefunden
- Überprüfen Sie Ihren API-Schlüssel in .env
- Überprüfen Sie, ob die API erreichbar ist: https://search.dip.bundestag.de/api/v1/

### Verarbeitung schlägt fehl
- Einige Protokolle können fehlerhaftes XML enthalten
- Netzwerkprobleme können Downloads unterbrechen
- Führen Sie den process-Befehl erneut aus, um von der Stelle fortzufahren, wo er gestoppt wurde

### Frontend zeigt Fehler
- Stellen Sie sicher, dass das Backend auf Port 8000 läuft
- Überprüfen Sie die Browser-Konsole auf detaillierte Fehler
- Überprüfen Sie die CORS-Einstellungen in backend/api.py

## Credits

Basierend auf dem [plenum_first_said](https://github.com/bundestagsplenum/plenum_first_said) Bot von bundestagsplenum.

## Lizenz

ISC
