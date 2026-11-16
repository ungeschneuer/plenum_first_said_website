import { Link } from 'react-router-dom';
import { TextPage, ExternalLink } from '../layout/TextPage';
import { ISSUES_URL } from '../../siteConfig';

const QUESTIONS = [
  {
    question: 'Warum soll ein Wort schon vor Jahrzehnten gesagt worden sein?',
    answer: (
      <>
        Die Protokolle bis etwa 1990 beruhen auf Texterkennung alter Drucke. Ein Lesefehler kann ein Wort ergeben, das
        so nie gesagt wurde, oder ein späteres Wort scheinbar vorwegnehmen. Das verlinkte PDF zeigt, was tatsächlich im
        Protokoll steht.
      </>
    ),
  },
  {
    question: 'Warum finde ich eine bestimmte Form nicht?',
    answer: (
      <>
        Die Seite zählt Grundformen. Wenn Sie eine gebeugte Form wie „Anträgen“ eingeben, führt die Suche zur Grundform
        „Antrag“. Auf der Wortseite steht, welche Formen dort zusammengefasst sind.
      </>
    ),
  },
  {
    question: 'Warum stehen „Bundeskanzlerin“ und „Bundeskanzler“ getrennt?',
    answer: (
      <>
        Weibliche und männliche Formen sind eigene Wörter. Zusammengefasst werden nur Beugungsformen eines Wortes, also
        Fall, Zahl und bei Verben die Zeitformen.
      </>
    ),
  },
  {
    question: 'Warum zählt „Bank“ auch die Sitzbank?',
    answer: (
      <>
        Die Seite unterscheidet Wörter nach ihrer Schreibung, nicht nach ihrer Bedeutung. Gleich geschriebene Wörter wie
        „Bank“, „Schloss“ oder „Steuer“ stehen deshalb zusammen. Nur Groß- und Kleinschreibung trennt, etwa „Leben“ und
        „leben“.
      </>
    ),
  },
  {
    question: 'Was bedeutet der Anteil?',
    answer: (
      <>
        Der Anteil ist die Anzahl eines Wortes geteilt durch alle gezählten Wörter der Sitzung. Er macht kurze und lange
        Sitzungen vergleichbar. Fasst man Sitzungen zu Monaten, Jahren oder Wahlperioden zusammen, werden Anzahl und
        Wörter der Sitzungen jeweils addiert.
      </>
    ),
  },
  {
    question: 'Wie aktuell sind die Zahlen?',
    answer: (
      <>
        Neue Protokolle werden jeden Tag abgefragt. Der Bundestag veröffentlicht den Text einer Sitzung meist einige
        Tage nach der Sitzung.
      </>
    ),
  },
  {
    question: 'Wer hat ein Wort zuerst gesagt?',
    answer: (
      <>
        Die Wortseite nennt die Rednerin oder den Redner des ersten Vorkommens. Ab der 19. Wahlperiode (2017) stammt die
        Angabe aus den strukturierten Protokollen des Bundestages, davor aus den Zeilen, die im Protokoll eine Rede
        eröffnen. Wo beide vorliegen, stimmen sie bei 98 von 100 Wörtern überein. Steht ein Wort zuerst in einem
        Zwischenruf oder einem vorgelesenen Zitat, steht das dabei; im Beifall oder in schriftlichen Anlagen gibt es keine Rednerin und keinen Redner.
      </>
    ),
  },
  {
    question: 'Ich habe einen Fehler gefunden. Wohin damit?',
    answer: (
      <>
        Am besten in den <ExternalLink href={ISSUES_URL}>Issue-Tracker</ExternalLink>, mit dem Wort und der Sitzung. Wie
        gezählt wird, steht unter <Link to="/about">Über das Projekt</Link>.
      </>
    ),
  },
];

export default function FAQ() {
  return (
    <TextPage title="Häufige Fragen">
      {QUESTIONS.map(({ question, answer }) => (
        <section key={question}>
          <h2>{question}</h2>
          <p>{answer}</p>
        </section>
      ))}
    </TextPage>
  );
}
