import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TextPage, ExternalLink } from '../layout/TextPage';
import { getStatus } from '../../utils/staticData';
import { formatGermanDate } from '../../utils/german';
import { BOT_ACCOUNT, BOT_REPOSITORY, DATA_DOWNLOAD_URL, DATA_SOURCE, SOURCE_REPOSITORY } from '../../siteConfig';

function DataStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    getStatus().then(setStatus).catch(() => setStatus(null));
  }, []);
  if (!status) return null;
  return (
    <p>
      Derzeit enthält die Seite {status.total_protocols.toLocaleString('de-DE')} Plenarprotokolle vom{' '}
      {formatGermanDate(status.first_date)} bis zum {formatGermanDate(status.last_date)}.
    </p>
  );
}

export default function About() {
  return (
    <TextPage title="Über das Projekt">
      <p>
        Bundestag Wortschatz zeigt für jedes Wort, wie oft es in den Plenarsitzungen des Deutschen Bundestages seit 1949
        gesagt wurde: Sitzung für Sitzung, mit dem ersten Vorkommen und dem Anteil an allen Wörtern der Sitzung. So
        lässt sich verfolgen, wann ein Begriff in die Debatten kam, wann er häufiger wurde und wann er wieder verschwand.
      </p>
      <DataStatus />

      <h2>Woher die Texte kommen</h2>
      <p>
        Grundlage sind die Plenarprotokolle aus dem{' '}
        <ExternalLink href={DATA_SOURCE.url}>Dokumentations- und Informationssystem für Parlamentsmaterialien</ExternalLink>{' '}
        (DIP) des Bundestages. Neue Protokolle werden jeden Tag abgefragt und aufgenommen, sobald ihr Text vorliegt; das
        dauert nach einer Sitzung meist einige Tage.
      </p>

      <h2>Wie gezählt wird</h2>
      <p>
        Gezählt wird der Text ab Beginn der Sitzung, einschließlich der Anlagen wie zu Protokoll gegebener Reden.
        Kopfzeilen der Druckseiten, die Liste der entschuldigten Abgeordneten, das Druckimpressum und die Zeilen, die
        eine Rede eröffnen („Dr. Schellenberg (SPD):“), werden herausgenommen; sie sind gedruckt, nicht gesprochen.
        Ein großgeschriebenes Wort direkt nach einem Titel oder einer Anrede zählt als Name, ebenso Vor- und Nachname
        eines Mitglieds des Bundestages: „General Handy“ zählt bei „Handy (Name)“, „Helmut Kohl“ bei „Kohl (Name)“, nicht
        bei den Wörtern „Handy“ und „Kohl“. Namenslisten namentlicher Abstimmungen werden nicht gezählt. Der Text wird in Wörter zerlegt; Silbentrennungen am Zeilenende werden zusammengefügt, Zahlen
        und einzelne Buchstaben fallen weg.
      </p>
      <p>
        Jedes Wort wird auf seine Grundform zurückgeführt, sein Lemma: „Gesetzentwürfen“ zählt bei „Gesetzentwurf“,
        „sagte“ bei „sagen“. Weibliche Formen bleiben eigene Wörter, „Bundeskanzlerin“ steht also neben „Bundeskanzler“.
        Alte und neue Rechtschreibung werden zusammengefasst, „Ausschuß“ zählt bei „Ausschuss“. Auf jeder Wortseite
        steht, welche Formen zusammengefasst sind. Groß- und Kleinschreibung bleibt erhalten, damit das Substantiv
        „Leben“ und das Verb „leben“ getrennt bleiben.
      </p>
      <p>
        Der Anteil eines Wortes ist seine Anzahl geteilt durch alle gezählten Wörter der Sitzung. Er macht kurze und
        lange Sitzungen vergleichbar.
      </p>

      <h2>Grenzen</h2>
      <p>
        Die Protokolle bis etwa 1990 beruhen auf Texterkennung alter Drucke. Dort entstehen Lesefehler und
        Wortbruchstücke, und manches erste Vorkommen ist in Wahrheit ein Lesefehler. Bitte prüfen Sie ein auffälliges
        erstes Vorkommen am verlinkten PDF.
      </p>
      <p>
        Die Grundformen werden ohne Satzzusammenhang bestimmt. In einer Stichprobe aktueller Protokolle waren etwa 97
        von 100 Wortformen richtig zugeordnet. Partizipien zählen beim Verb („bestimmt“ bei „bestimmen“), auch wenn sie
        als Adjektiv gemeint sind.
      </p>
      <p>
        Fehler können Sie im <ExternalLink href={`${SOURCE_REPOSITORY}/issues`}>Issue-Tracker</ExternalLink> melden.
        Weitere Antworten stehen in den <Link to="/faq">häufigen Fragen</Link>.
      </p>

      <h2>Herkunft</h2>
      <p>
        Die Seite ist aus dem Bot <ExternalLink href={BOT_REPOSITORY}>Plenum First Said</ExternalLink> entstanden, der
        unter <ExternalLink href={BOT_ACCOUNT.url}>{BOT_ACCOUNT.name}</ExternalLink> Wörter postet, die zum ersten Mal
        im Bundestag gesagt wurden. Er geht auf{' '}
        <ExternalLink href="https://github.com/MaxBittker/nyt-first-said">NYT First Said</ExternalLink> von Max Bittker
        zurück.
      </p>

      <h2>Daten und Quellcode</h2>
      <p>
        Alle Zählungen stehen als <ExternalLink href={DATA_DOWNLOAD_URL}>Datenpaket zum Herunterladen</ExternalLink>{' '}
        bereit ({DATA_SOURCE.licenseName}, Quelle: Deutscher Bundestag). Der{' '}
        <ExternalLink href={SOURCE_REPOSITORY}>Quellcode</ExternalLink> steht unter der GNU General Public License,
        Version 3.
      </p>
    </TextPage>
  );
}
