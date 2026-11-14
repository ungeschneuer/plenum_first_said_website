import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';

export default function Datenschutz() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent rounded-lg">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-bold">Datenschutzerklärung</h1>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datenschutz auf einen Blick</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Allgemeine Hinweise</h3>
              <p>
                Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren
                personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene
                Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datenerfassung auf dieser Website</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <div>
              <h3 className="font-semibold text-foreground mb-2">
                Wer ist verantwortlich für die Datenerfassung?
              </h3>
              <p>
                Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen
                Kontaktdaten können Sie dem Impressum dieser Website entnehmen.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-foreground mb-2">Wie erfassen wir Ihre Daten?</h3>
              <p>
                Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Andere Daten
                werden automatisch beim Besuch der Website durch unsere IT-Systeme erfasst. Das sind vor
                allem technische Daten (z.B. Internetbrowser, Betriebssystem oder Uhrzeit des
                Seitenaufrufs).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hosting</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>
              Diese Website wird lokal gehostet. Die Server befinden sich in [Ort/Land].
              Es werden keine externen Hosting-Dienste verwendet.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Server-Log-Dateien</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>
              Der Provider der Seiten erhebt und speichert automatisch Informationen in sogenannten
              Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt. Dies sind:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-1">
              <li>Browsertyp und Browserversion</li>
              <li>Verwendetes Betriebssystem</li>
              <li>Referrer URL</li>
              <li>Hostname des zugreifenden Rechners</li>
              <li>Uhrzeit der Serveranfrage</li>
              <li>IP-Adresse</li>
            </ul>
            <p className="mt-3">
              Eine Zusammenführung dieser Daten mit anderen Datenquellen wird nicht vorgenommen. Die
              Erfassung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analyse-Tools und Werbung</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>
              Diese Website verwendet keine Tracking- oder Analyse-Tools von Drittanbietern.
              Es werden keine Cookies für Werbezwecke gesetzt.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verwendete Datenquellen</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>
              Diese Anwendung verarbeitet öffentlich zugängliche Daten aus den Plenarprotokollen
              des Deutschen Bundestages. Diese Daten unterliegen der Datenlizenz Deutschland –
              Namensnennung – Version 2.0.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ihre Rechte</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>
              Sie haben jederzeit das Recht auf unentgeltliche Auskunft über Ihre gespeicherten
              personenbezogenen Daten, deren Herkunft und Empfänger und den Zweck der Datenverarbeitung
              sowie ein Recht auf Berichtigung oder Löschung dieser Daten.
            </p>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center mt-8">
          Stand: {new Date().toLocaleDateString('de-DE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>
    </div>
  );
}
