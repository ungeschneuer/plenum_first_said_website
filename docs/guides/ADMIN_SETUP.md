# Admin Interface und Statische Seiten - Setup

Dieses Dokument beschreibt die neuen Funktionen für die Admin-Schnittstelle und statischen Seiten.

## Neue Funktionen

### 1. Statische Seiten

Drei neue statische Seiten wurden hinzugefügt:

- **Impressum** (`/impressum`) - Rechtliche Angaben und Kontaktinformationen
- **Datenschutzerklärung** (`/datenschutz`) - Datenschutz und DSGVO-Informationen
- **FAQ** (`/faq`) - Häufig gestellte Fragen zum Projekt

Diese Seiten sind als React-Komponenten implementiert und können einfach bearbeitet werden:
- `frontend/src/components/pages/Impressum.jsx`
- `frontend/src/components/pages/Datenschutz.jsx`
- `frontend/src/components/pages/FAQ.jsx`

**Wichtig:** Bitte ersetzen Sie die Platzhalter in Impressum und Datenschutz durch Ihre tatsächlichen Daten (Name, Adresse, E-Mail, etc.).

### 2. Admin-Schnittstelle

Eine vollständige Admin-Schnittstelle für System-Monitoring und Verwaltung wurde implementiert.

## Admin-Setup

### Schritt 1: Admin-Passwort festlegen

1. Kopieren Sie `.env.example` nach `.env`:
   ```bash
   cp .env.example .env
   ```

2. Bearbeiten Sie `.env` und setzen Sie ein sicheres Passwort:
   ```
   ADMIN_PASSWORD=Ihr_sicheres_Passwort_hier
   ```

**Wichtig:** Ändern Sie das Standard-Passwort `change_me_in_production` in der Produktionsumgebung!

### Schritt 2: Neue Abhängigkeiten installieren

Die Abhängigkeiten wurden bereits mit `uv sync` installiert. Falls nötig:

```bash
uv sync
```

### Schritt 3: Backend neu starten

```bash
./backend_starten.sh
# oder
uv run python backend/api.py
```

### Schritt 4: Frontend neu starten

```bash
./frontend_starten.sh
# oder
cd frontend && npm run dev
```

## Admin-Funktionen

### Login

- URL: `http://localhost:5173/admin/login`
- Geben Sie das in `.env` festgelegte Passwort ein
- Sie erhalten ein JWT-Token, das 24 Stunden gültig ist

### Dashboard

- URL: `http://localhost:5173/admin/dashboard`
- Echtzeit-System-Monitoring (aktualisiert alle 5 Sekunden)
- Zeigt an:
  - CPU- und Speicherauslastung
  - Datenbankgröße
  - Protokoll-Statistiken
  - Verarbeitungs-Warteschlange
  - Wort- und Redner-Statistiken

### Datenbank-Verwaltung

- URL: `http://localhost:5173/admin/database`
- Funktionen:
  - **Backup erstellen**: Erstellt eine Kopie der Datenbank in `backend/backups/`
  - **Datenbank optimieren**: Führt VACUUM aus, um Speicherplatz freizugeben
  - **Backup-Verlauf**: Liste aller erstellten Backups

### Logs anzeigen

- URL: `http://localhost:5173/admin/logs`
- Zeigt die letzten Log-Einträge aus `backend/app.log`
- Konfigurierbare Anzahl von Zeilen (50-1000)
- Auto-Aktualisierung alle 3 Sekunden (optional)

## API-Endpunkte

Die Admin-API ist unter folgenden Endpunkten verfügbar:

### Authentifizierung
- `POST /api/admin/login` - Admin-Login (öffentlich)

### System-Statistiken (authentifiziert)
- `GET /api/admin/stats/system` - System-Ressourcen
- `GET /api/admin/stats/database` - Datenbank-Statistiken
- `GET /api/admin/stats/queue` - Verarbeitungs-Warteschlange

### Datenbank-Operationen (authentifiziert)
- `POST /api/admin/database/backup` - Backup erstellen
- `GET /api/admin/database/backups` - Backups auflisten
- `POST /api/admin/database/vacuum` - Datenbank optimieren

### Logs (authentifiziert)
- `GET /api/admin/logs?lines=100` - Log-Einträge abrufen

## Sicherheitshinweise

1. **Passwort**: Verwenden Sie ein starkes, einzigartiges Passwort in der Produktion
2. **HTTPS**: Verwenden Sie in der Produktion immer HTTPS
3. **JWT-Secret**: Setzen Sie in `.env` ein eigenes `JWT_SECRET` für die Produktion
4. **Zugriffsbeschränkung**: Beschränken Sie den Zugriff auf Admin-Routen in der Produktionsumgebung
5. **Logs**: Logs können sensible Informationen enthalten - schützen Sie sie entsprechend

## Fehlerbehebung

### "401 Unauthorized" beim Admin-Zugriff
- Token ist abgelaufen (nach 24 Stunden) - erneut einloggen
- Falsches Passwort - prüfen Sie `.env`

### Backups werden nicht erstellt
- Prüfen Sie Schreibrechte auf `backend/backups/` Verzeichnis
- Verzeichnis wird automatisch erstellt, falls es nicht existiert

### System-Stats zeigen "0" oder fehlen
- `psutil` möglicherweise nicht installiert - führen Sie `uv sync` aus
- Berechtigungsprobleme beim Zugriff auf Systemressourcen

## Anpassung

### Statische Seiten bearbeiten

Die Inhalte der statischen Seiten können direkt in den JSX-Dateien bearbeitet werden:

```bash
# Impressum bearbeiten
nano frontend/src/components/pages/Impressum.jsx

# Datenschutz bearbeiten
nano frontend/src/components/pages/Datenschutz.jsx

# FAQ bearbeiten (FAQ-Daten im Array am Anfang der Datei)
nano frontend/src/components/pages/FAQ.jsx
```

Nach Änderungen wird das Frontend automatisch neu geladen (Vite Hot Reload).

### Admin-Interface anpassen

Das Admin-Interface kann über CSS angepasst werden:
- Styles sind in `frontend/src/App.css` unter "Admin Interface Styles"
- Komponenten sind in `frontend/src/components/admin/`

## Erweiterungsmöglichkeiten

Zukünftige Erweiterungen könnten umfassen:

- **Protokoll-Verarbeitung starten**: Button zum Starten der Verarbeitung neuer Protokolle
- **Benutzer-Verwaltung**: Mehrere Admin-Benutzer mit verschiedenen Rollen
- **Backup-Restore**: Funktion zum Wiederherstellen aus Backups
- **Automatische Backups**: Geplante Backups via Cron
- **Content-Editor**: Bearbeitung der FAQ direkt über die Admin-Oberfläche
- **API-Rate-Limiting**: Schutz vor Missbrauch
- **Audit-Log**: Protokollierung aller Admin-Aktionen

## Support

Bei Fragen oder Problemen:
1. Prüfen Sie die Logs unter `/admin/logs`
2. Prüfen Sie die Backend-Logs (`backend/app.log`)
3. Prüfen Sie die Browser-Konsole für Frontend-Fehler
