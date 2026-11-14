import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';

const faqData = [
  {
    question: "Was ist der Bundestag Wort-Häufigkeits-Tracker?",
    answer: "Dieses Projekt analysiert die Plenarprotokolle des Deutschen Bundestages und verfolgt, wann bestimmte Wörter erstmals verwendet wurden und wie sich ihre Häufigkeit im Laufe der Zeit entwickelt hat. Es ermöglicht die Untersuchung sprachlicher Trends und politischer Diskurse."
  },
  {
    question: "Woher stammen die Daten?",
    answer: "Die Daten stammen aus den offiziellen Plenarprotokollen des Deutschen Bundestages, die als Open Data unter der Datenlizenz Deutschland zur Verfügung gestellt werden. Die Protokolle werden im XML-Format bereitgestellt und enthalten die vollständigen Wortbeiträge aller Rednerinnen und Redner."
  },
  {
    question: "Welche Wahlperioden sind verfügbar?",
    answer: "Die Datenbank enthält Protokolle verschiedener Wahlperioden des Bundestages. Die genaue Abdeckung hängt von der Verfügbarkeit der Daten ab. Sie können die verfügbaren Wahlperioden über die Wahlperioden-Übersicht einsehen."
  },
  {
    question: "Wie funktioniert die Wortsuche?",
    answer: "Die Suche durchsucht alle verarbeiteten Wörter aus den Plenarprotokollen. Sie können nach ganzen Wörtern oder Wortteilen suchen. Die Ergebnisse zeigen, wann das Wort erstmals verwendet wurde, wer es zuerst sagte, und wie sich die Verwendung im Zeitverlauf entwickelt hat."
  },
  {
    question: "Was bedeutet 'Erstverwendung'?",
    answer: "Die Erstverwendung bezieht sich auf das erste dokumentierte Auftreten eines Wortes in den verarbeiteten Plenarprotokollen. Beachten Sie, dass dies nicht bedeutet, dass das Wort vorher nicht existierte, sondern nur, dass es in den analysierten Bundestagsdebatten zu diesem Zeitpunkt erstmals auftauchte."
  },
  {
    question: "Wie wird die Worthäufigkeit berechnet?",
    answer: "Die Häufigkeit wird als absolute Anzahl der Verwendungen pro Plenarsitzung gezählt. Zusätzlich wird ein Prozentsatz berechnet, der die relative Häufigkeit im Verhältnis zur Gesamtwortzahl der jeweiligen Sitzung angibt. Dies ermöglicht einen fairen Vergleich zwischen Sitzungen unterschiedlicher Länge."
  },
  {
    question: "Was ist Lemmatisierung?",
    answer: "Lemmatisierung ist der Prozess, verschiedene grammatische Formen eines Wortes auf ihre Grundform zurückzuführen. Beispielsweise werden 'Bundeskanzler', 'Bundeskanzlers', 'Bundeskanzlern' zur Grundform 'Bundeskanzler' zusammengefasst. Dies ermöglicht eine sinnvollere Analyse der Wortverwendung, während geschlechtsspezifische Formen (z.B. 'Bundeskanzler' vs. 'Bundeskanzlerin') getrennt bleiben."
  },
  {
    question: "Warum werden geschlechtsspezifische Formen getrennt erfasst?",
    answer: "Die Unterscheidung zwischen maskulinen und femininen Formen (z.B. 'Bundeskanzler' und 'Bundeskanzlerin') ist für die Analyse des sprachlichen Wandels wichtig. Sie ermöglicht die Untersuchung von Fragen wie: Wann wurden feminine Berufsbezeichnungen eingeführt? Wie hat sich ihre Verwendung entwickelt?"
  },
  {
    question: "Was sind 'neue Wörter' in einem Protokoll?",
    answer: "Als 'neue Wörter' werden Wörter bezeichnet, die in einem bestimmten Protokoll zum ersten Mal in der gesamten analysierten Zeitreihe auftauchen. Dies können Neologismen, Fachbegriffe oder politische Schlagwörter sein, die zu einem bestimmten Zeitpunkt in den politischen Diskurs eingeführt wurden."
  },
  {
    question: "Wie werden Redner und Parteien zugeordnet?",
    answer: "Die Zuordnung erfolgt automatisch aus den XML-Metadaten der Plenarprotokolle. Wenn möglich, werden zusätzliche Informationen aus der Bundestags-API und Wikidata abgerufen. Die Parteizugehörigkeit wird zeitbasiert erfasst, da Politiker im Laufe der Zeit die Partei wechseln können."
  },
  {
    question: "Kann ich die Rohdaten herunterladen?",
    answer: "Die Plenarprotokolle sind öffentlich zugänglich über die Bundestag-Website. Die aufbereiteten Analysedaten aus dieser Anwendung können über die API abgerufen werden. Für umfangreiche Datenexporte kontaktieren Sie bitte den Betreiber."
  },
  {
    question: "Wie aktuell sind die Daten?",
    answer: "Die Aktualität hängt davon ab, wie oft neue Protokolle verarbeitet werden. Neue Plenarprotokolle werden in der Regel einige Tage nach der Sitzung vom Bundestag veröffentlicht. Die Verarbeitung in dieser Datenbank erfolgt manuell oder automatisiert in regelmäßigen Abständen."
  },
  {
    question: "Welche Technologien werden verwendet?",
    answer: "Das Projekt verwendet Python mit FastAPI für das Backend, React für das Frontend, PostgreSQL als Datenbank und spaCy für die NLP-Verarbeitung (Lemmatisierung, POS-Tagging, etc.). Die Visualisierungen werden mit Chart.js erstellt."
  },
  {
    question: "Kann ich zur Entwicklung beitragen?",
    answer: "Informationen zur Mitarbeit am Projekt finden Sie im GitHub-Repository (falls verfügbar) oder kontaktieren Sie den Projektbetreiber über die im Impressum angegebenen Kontaktdaten."
  },
  {
    question: "Gibt es eine API für Entwickler?",
    answer: "Ja, das Projekt bietet eine REST-API mit verschiedenen Endpunkten für Wortsuche, Zeitreihen, Redner- und Parteiinformationen. Die API-Dokumentation ist unter /docs (Swagger UI) verfügbar, wenn der Backend-Server läuft."
  }
];

export default function FAQ() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent rounded-lg" aria-hidden="true">
            <HelpCircle className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-bold">Häufig gestellte Fragen</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Hier finden Sie Antworten auf die häufigsten Fragen zum Bundestag
          Wort-Häufigkeits-Tracker.
        </p>
      </div>

      {/* FAQ Accordion */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <Accordion type="single" collapsible className="w-full">
            {faqData.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Contact Section */}
      <Card>
        <CardHeader>
          <CardTitle>Weitere Fragen?</CardTitle>
          <CardDescription>
            Wenn Ihre Frage hier nicht beantwortet wurde, kontaktieren Sie uns
            gerne über die im{' '}
            <Link to="/impressum" className="text-primary hover:underline">
              Impressum
            </Link>{' '}
            angegebenen Kontaktdaten.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
