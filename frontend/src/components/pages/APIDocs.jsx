import { ExternalLink, Code, Database, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export default function APIDocs() {
  const swaggerUrl = `${window.location.protocol}//${window.location.hostname}:8000/docs`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent rounded-lg">
            <Code className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-4xl font-bold">API Dokumentation</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          REST API für Entwickler — Zugriff auf Wortsuche, Zeitreihen und Statistiken
        </p>
      </div>

      {/* API Overview */}
      <div className="grid gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Verfügbare Endpunkte
            </CardTitle>
            <CardDescription>
              Die API bietet umfassenden Zugriff auf alle Daten des Bundestag Wortschatz-Trackers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">Wortsuche & Zeitreihen</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• GET /api/search - Wortsuche mit Autocomplete</li>
                  <li>• GET /api/word/{`{word}`}/timeline - Häufigkeitsverlauf eines Wortes</li>
                  <li>• GET /api/word/{`{word}`}/details - Detailinformationen zu einem Wort</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-1">Redner & Parteien</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• GET /api/speakers - Alle Redner/innen</li>
                  <li>• GET /api/speaker/{`{id}`} - Redner-Details</li>
                  <li>• GET /api/parties - Alle Parteien</li>
                  <li>• GET /api/party/{`{id}`} - Partei-Details</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-1">Protokolle & Wahlperioden</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• GET /api/protocols - Protokollübersicht</li>
                  <li>• GET /api/protocol/{`{id}`} - Protokoll-Details</li>
                  <li>• GET /api/wahlperioden - Wahlperioden-Übersicht</li>
                  <li>• GET /api/wahlperiode/{`{number}`} - Wahlperiode-Details</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-1">Statistiken</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• GET /api/stats - System-Statistiken</li>
                  <li>• GET /api/protocol/{`{id}`}/new-words - Neue Wörter pro Protokoll</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" aria-hidden="true" />
              Admin-Endpunkte
              <Badge variant="secondary">Bearer Token erforderlich</Badge>
            </CardTitle>
            <CardDescription>
              Authentifizierung via POST /api/admin/login (gibt JWT-Token zurück)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">Authentifizierung</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• POST /api/admin/login — Token anfordern (Body: {`{ "password": "..." }`})</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Statistiken</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• GET /api/admin/stats/system — System- und Prozess-Metriken</li>
                  <li>• GET /api/admin/stats/database — Datenbankstatistiken</li>
                  <li>• GET /api/admin/stats/queue — Verarbeitungswarteschlange</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Datenqualität</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• GET /api/admin/data-quality — PATTERN_FALLBACK-Wörter (paginiert, filterbar)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Datenbank</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• GET /api/admin/database/backups — Backup-Liste</li>
                  <li>• POST /api/admin/database/backup — Neues Backup erstellen</li>
                  <li>• POST /api/admin/database/vacuum — VACUUM ANALYZE ausführen</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Logs</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• GET /api/admin/logs?lines=100 — Server-Logs abrufen</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Vollständige OpenAPI 3.0 Spezifikation (Swagger/OpenAPI)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Interaktive Dokumentation mit Try-it-out Funktion</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>JSON Response-Format</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>CORS-aktiviert für Cross-Origin-Anfragen</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Paginierung und Sortierung für große Datenmengen</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>GZip-Komprimierung für schnelle Antworten</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Swagger Link */}
      <div className="text-center">
        <Button asChild size="lg">
          <a href={swaggerUrl} target="_blank" rel="noopener noreferrer"
             aria-label="Interaktive API-Dokumentation (Swagger UI) öffnen (öffnet in neuem Tab)">
            <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
            Interaktive API-Dokumentation (Swagger UI)
          </a>
        </Button>
      </div>
    </div>
  );
}
