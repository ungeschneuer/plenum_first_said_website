import { Link } from 'react-router-dom';
import { FileText, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';

export default function Impressum() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent rounded-lg">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-bold">Impressum</h1>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Angaben gemäß § 5 TMG</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>
              [Ihr Name oder Organisation]<br />
              [Straße und Hausnummer]<br />
              [PLZ und Ort]
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kontakt</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>
              E-Mail: [ihre-email@example.com]<br />
              Telefon: [Ihre Telefonnummer]
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verantwortlich für den Inhalt</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>
              Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:<br />
              [Ihr Name]<br />
              [Ihre Adresse]
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Haftungsausschluss</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Haftung für Inhalte</h3>
              <p>
                Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt.
                Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte
                können wir jedoch keine Gewähr übernehmen. Als Diensteanbieter sind
                wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach
                den allgemeinen Gesetzen verantwortlich.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-foreground mb-2">Haftung für Links</h3>
              <p>
                Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren
                Inhalte wir keinen Einfluss haben. Deshalb können wir für diese
                fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
                verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
                der Seiten verantwortlich.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-foreground mb-2">Urheberrecht</h3>
              <p>
                Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen
                Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung,
                Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
                Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des
                jeweiligen Autors bzw. Erstellers.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datenquelle</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p className="mb-3">
              Die Daten für dieses Projekt stammen aus den öffentlich zugänglichen
              Plenarprotokollen des Deutschen Bundestages, die unter einer offenen
              Lizenz zur Verfügung gestellt werden.
            </p>
            <a
              href="https://www.bundestag.de/services/opendata"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              Bundestag Open Data
              <ExternalLink className="h-4 w-4" />
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
