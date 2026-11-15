import { Link } from 'react-router-dom';
import { BookOpen, Code, Database, Sparkles, Users, Calendar, TrendingUp, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent rounded-lg">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-bold">Über das Projekt</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Der Bundestag Wortschatz-Tracker dokumentiert die Evolution der politischen
          Sprache im Deutschen Bundestag seit 1949.
        </p>
      </div>

      {/* Mission Statement */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Unsere Mission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Dieses Projekt macht die sprachliche Entwicklung politischer Debatten im
            Deutschen Bundestag transparent und nachvollziehbar. Durch die systematische
            Analyse von über 4.600 Plenarprotokollen seit der ersten Wahlperiode können
            wir verfolgen, wann bestimmte Begriffe erstmals auftraten, wie sich ihre
            Verwendung entwickelte und welche neuen Wörter in den politischen Diskurs
            eingeführt wurden.
          </p>
          <p>
            Der Wortschatz-Tracker ermöglicht es Forschenden, Journalistinnen und
            Journalisten sowie politisch Interessierten, sprachliche Trends zu
            identifizieren, den Wandel politischer Themen nachzuverfolgen und die
            Entwicklung der deutschen Demokratie durch ihre Sprache zu verstehen.
          </p>
        </CardContent>
      </Card>

      {/* Key Features */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Kernfunktionen</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Wortsuche</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Durchsuchen Sie den gesamten Wortschatz des Bundestages und finden Sie
                heraus, wann ein Wort erstmals verwendet wurde.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Häufigkeitsverlauf</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Visualisieren Sie die zeitliche Entwicklung der Worthäufigkeit über
                alle Wahlperioden hinweg.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Redner & Parteien</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Erkunden Sie, welche Abgeordneten bestimmte Begriffe als erste
                verwendeten und wie Parteien Sprache nutzen.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Neue Wörter</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Entdecken Sie Neologismen und verfolgen Sie, wie neue Begriffe in den
                politischen Diskurs eingeführt werden.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Technology Stack */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Technologie
          </CardTitle>
          <CardDescription>
            Ein moderner Tech-Stack für umfassende Sprachanalyse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Backend</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Python</Badge>
                <Badge variant="secondary">FastAPI</Badge>
                <Badge variant="secondary">PostgreSQL</Badge>
                <Badge variant="secondary">Redis</Badge>
                <Badge variant="secondary">spaCy NLP</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Das Backend verarbeitet XML-Protokolle, führt NLP-Analysen durch
                (Lemmatisierung, POS-Tagging) und stellt eine performante REST-API
                bereit.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Frontend</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">React 19</Badge>
                <Badge variant="secondary">Vite</Badge>
                <Badge variant="secondary">Tailwind CSS v4</Badge>
                <Badge variant="secondary">shadcn/ui</Badge>
                <Badge variant="secondary">Chart.js</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Eine moderne, responsive Benutzeroberfläche mit interaktiven
                Visualisierungen und optimierter Performance.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">NLP-Verarbeitung</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">spaCy de_core_news_lg</Badge>
                <Badge variant="secondary">Lemmatisierung</Badge>
                <Badge variant="secondary">POS-Tagging</Badge>
                <Badge variant="secondary">Compound-Splitting</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Geschlechtergerechte Lemmatisierung, die feminine und maskuline Formen
                (z.B. Bundeskanzler/Bundeskanzlerin) getrennt erfasst, um sprachlichen
                Wandel sichtbar zu machen.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Datenquellen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Plenarprotokolle</h3>
            <p className="text-sm text-muted-foreground">
              Die Protokolle stammen aus der offiziellen Open-Data-Plattform des
              Deutschen Bundestages und sind unter der Datenlizenz Deutschland –
              Zero – Version 2.0 verfügbar. Die XML-Dateien enthalten vollständige
              Wortbeiträge aller Rednerinnen und Redner sowie Metadaten zu Sitzungen
              und Abstimmungen.
            </p>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-2">Zusätzliche Metadaten</h3>
            <p className="text-sm text-muted-foreground">
              Informationen zu Abgeordneten und Parteizugehörigkeiten werden aus der
              Bundestag-API und Wikidata bezogen, um eine zeitlich korrekte Zuordnung
              zu gewährleisten.
            </p>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-2">Umfang der Datenbank</h3>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">4.614</div>
                <div className="text-xs text-muted-foreground">Protokolle</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">21</div>
                <div className="text-xs text-muted-foreground">Wahlperioden</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">1949-2026</div>
                <div className="text-xs text-muted-foreground">Zeitspanne</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">111.993</div>
                <div className="text-xs text-muted-foreground">Eindeutige Wörter</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Use Cases */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Anwendungsbereiche</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-primary/10 rounded mt-0.5">
                <span className="text-primary font-bold text-sm">1</span>
              </div>
              <div>
                <h4 className="font-semibold">Politikwissenschaft & Forschung</h4>
                <p className="text-sm text-muted-foreground">
                  Analyse sprachlicher Trends, Diskursverschiebungen und politischer
                  Themensetzung über Jahrzehnte hinweg.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-primary/10 rounded mt-0.5">
                <span className="text-primary font-bold text-sm">2</span>
              </div>
              <div>
                <h4 className="font-semibold">Journalismus & Medien</h4>
                <p className="text-sm text-muted-foreground">
                  Recherche zur Entstehung und Entwicklung politischer Begriffe,
                  Fact-Checking historischer Aussagen.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-primary/10 rounded mt-0.5">
                <span className="text-primary font-bold text-sm">3</span>
              </div>
              <div>
                <h4 className="font-semibold">Sprachwissenschaft</h4>
                <p className="text-sm text-muted-foreground">
                  Untersuchung des Sprachwandels, Neologismen und geschlechtergerechter
                  Sprache in der Politik.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-primary/10 rounded mt-0.5">
                <span className="text-primary font-bold text-sm">4</span>
              </div>
              <div>
                <h4 className="font-semibold">Bildung & Demokratievermittlung</h4>
                <p className="text-sm text-muted-foreground">
                  Veranschaulichung demokratischer Prozesse und politischer Geschichte
                  durch Sprache.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Open Source & Contribution */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Open Source & Mitarbeit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Dieses Projekt wird als Open-Source-Software entwickelt und steht der
            Öffentlichkeit zur Verfügung. Wir glauben an Transparenz, offene Daten
            und die Demokratisierung des Zugangs zu politischen Informationen.
          </p>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Wie Sie beitragen können:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Code-Beiträge über GitHub Pull Requests</li>
              <li>• Fehlerberichte und Feature-Vorschläge im Issue-Tracker</li>
              <li>• Verbesserung der Dokumentation</li>
              <li>• Teilen von Forschungsergebnissen basierend auf den Daten</li>
            </ul>
          </div>

          <p className="text-sm text-muted-foreground">
            Weitere Informationen zur Mitarbeit finden Sie im{' '}
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GitHub-Repository
            </a>
            .
          </p>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Projektentwicklung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-primary rounded-full" />
                <div className="w-0.5 h-full bg-border" />
              </div>
              <div className="pb-6">
                <div className="font-semibold">2024 - Projektstart</div>
                <p className="text-sm text-muted-foreground">
                  Konzeption und erste Prototypen für die Wortanalyse
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-primary rounded-full" />
                <div className="w-0.5 h-full bg-border" />
              </div>
              <div className="pb-6">
                <div className="font-semibold">2025 - Backend-Entwicklung</div>
                <p className="text-sm text-muted-foreground">
                  Aufbau der Datenbank, NLP-Integration, API-Entwicklung
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-primary rounded-full" />
                <div className="w-0.5 h-full bg-border" />
              </div>
              <div className="pb-6">
                <div className="font-semibold">2026 - Frontend-Redesign</div>
                <p className="text-sm text-muted-foreground">
                  Moderne UI mit shadcn/ui, interaktive Visualisierungen
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-secondary rounded-full" />
              </div>
              <div>
                <div className="font-semibold">Zukunft - Erweiterungen</div>
                <p className="text-sm text-muted-foreground">
                  Erweiterte Analysen, maschinelles Lernen, Sentiment-Analyse
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact & Links */}
      <Card>
        <CardHeader>
          <CardTitle>Weitere Informationen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Häufig gestellte Fragen</span>
              <Link to="/faq" className="text-sm text-primary hover:underline">
                Zur FAQ →
              </Link>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm">Impressum & Kontakt</span>
              <Link to="/impressum" className="text-sm text-primary hover:underline">
                Zum Impressum →
              </Link>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm">Datenschutzerklärung</span>
              <Link to="/datenschutz" className="text-sm text-primary hover:underline">
                Zum Datenschutz →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
