import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getGroupTotals, getWordDetails, getWordTimeline } from '../utils/staticData';
import Chart from './Chart';
import { SpeakerName } from './SpeakerName';
import { formatGermanDate, formatLongDate, formatNumber } from '../utils/german';
import { Skeleton } from './ui/skeleton';
import { ShareImages } from './ShareImages';
import { wordImageName } from '../pageMeta';
import { Alert, AlertDescription } from './ui/alert';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

const VISIBLE_FORM_COUNT = 15;
const NAME_SUFFIX = ' (Name)';
const WORDS_PER_RATE = 10000;
const AGGREGATIONS = [
  ['protocol', 'Sitzung'],
  ['month', 'Monat'],
  ['year', 'Jahr'],
  ['legislature', 'Wahlperiode'],
];

// Texts taken from the PDF or kept from an incomplete DIP text are marked; the other sources are complete.
const SOURCE_NOTES = { PDF: 'Text aus dem PDF', 'DIP, unvollständig': 'Text möglicherweise unvollständig' };

function SpeakerDescription({ speaker }) {
  const lead = speaker.zitat ? 'in einem Zitat, vorgelesen von ' : speaker.zwischenruf ? 'in einem Zwischenruf von ' : 'gesagt von ';
  return <>{lead}<SpeakerName speaker={speaker} /></>;
}

function FirstOccurrence({ details, timeline }) {
  const sessions = timeline.filter((point) => point.count > 0).length;
  return (
    <section className="space-y-4">
      <p className="text-lg leading-relaxed">
        Zum ersten Mal fiel das Wort am {formatLongDate(details.first_date)} in der {details.protokollnummer}. Sitzung
        der {details.wahlperiode}. Wahlperiode{details.first_speaker && <>, <SpeakerDescription speaker={details.first_speaker} /></>}.
        Seitdem kam es {formatNumber(details.total_count)}-mal in {formatNumber(sessions)} von{' '}
        {formatNumber(timeline.length)} Sitzungen vor.
      </p>
      {details.evidence && (
        <figure className="border-l-2 border-border pl-4">
          <blockquote className="italic leading-relaxed">„{details.evidence}“</blockquote>
          <figcaption className="mt-2 text-sm text-muted-foreground">
            Plenarprotokoll {details.wahlperiode}/{details.protokollnummer},{' '}
            <a href={details.pdf_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              als PDF
            </a>
          </figcaption>
        </figure>
      )}
      {!details.evidence && details.pdf_url && (
        <p className="text-sm text-muted-foreground">
          <a href={details.pdf_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            Protokoll der ersten Sitzung als PDF
          </a>
        </p>
      )}
    </section>
  );
}

function WordForms({ forms, lemma }) {
  const otherForms = forms.filter(([form]) => form !== lemma);
  if (otherForms.length === 0) return null;
  const visibleForms = forms.slice(0, VISIBLE_FORM_COUNT);
  const hiddenCount = forms.length - visibleForms.length;
  return (
    <p className="text-sm text-muted-foreground">
      Zusammengefasst sind die Formen{' '}
      {visibleForms.map(([form, count], index) => (
        <span key={form}>
          {index > 0 && (index === visibleForms.length - 1 && hiddenCount === 0 ? ' und ' : ', ')}
          <span className="font-medium text-foreground">{form}</span> ({formatNumber(count)})
        </span>
      ))}
      {hiddenCount > 0 && <> und {formatNumber(hiddenCount)} weitere</>}.
    </p>
  );
}

function FrequencyChart({ timeline }) {
  const chartRef = useRef(null);
  const [showPercentage, setShowPercentage] = useState(false);
  const [aggregation, setAggregation] = useState('protocol');
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Verlauf</h2>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <ToggleGroup
          type="single"
          value={aggregation}
          onValueChange={(value) => value && setAggregation(value)}
          aria-label="Zeitraum zusammenfassen"
        >
          {AGGREGATIONS.map(([value, label]) => (
            <ToggleGroupItem key={value} value={value}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showPercentage} onChange={(event) => setShowPercentage(event.target.checked)} />
          Anteil an allen Wörtern
        </label>
        <button type="button" className="underline underline-offset-2" onClick={() => chartRef.current?.resetZoom()}>
          Ausschnitt zurücksetzen
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Jede Sitzung ist ein Punkt, auch ohne Vorkommen. Mausrad oder zwei Finger zoomen, Ziehen verschiebt, ein Klick
        auf einen Punkt öffnet das Protokoll.
      </p>
      <Chart ref={chartRef} timelineData={timeline} showPercentage={showPercentage} aggregation={aggregation} />
    </section>
  );
}

function GroupTable({ groupCounts, groupTotals }) {
  const terms = Object.keys(groupCounts).sort((first, second) => Number(second) - Number(first));
  if (terms.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Nach Fraktion</h2>
      <p className="text-sm text-muted-foreground">
        Wie oft Abgeordnete einer Fraktion und Mitglieder der Bundesregierung das Wort in ihren Reden gebraucht haben,
        ab der 19. Wahlperiode. Der Anteil bezieht sich auf alle Wörter, die die Fraktion in der Wahlperiode gesagt hat;
        er macht große und kleine Fraktionen vergleichbar. Zwischenrufe und die Sitzungsleitung zählen nicht.
      </p>
      {terms.map((term) => {
        const rows = Object.entries(groupCounts[term]).sort((first, second) => second[1] - first[1]);
        return (
          <div key={term} className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="mb-2 text-left font-medium">{term}. Wahlperiode</caption>
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1 pr-4 font-normal">Fraktion</th>
                  <th className="py-1 pr-4 text-right font-normal">Anzahl</th>
                  <th className="py-1 text-right font-normal">je {formatNumber(WORDS_PER_RATE)} Wörter</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([group, count]) => {
                  const total = groupTotals[term]?.[group];
                  return (
                    <tr key={group} className="border-b border-border/50">
                      <td className="py-1 pr-4">{group}</td>
                      <td className="py-1 pr-4 text-right tabular-nums">{formatNumber(count)}</td>
                      <td className="py-1 text-right tabular-nums">
                        {total ? ((count / total) * WORDS_PER_RATE).toLocaleString('de-DE', { maximumFractionDigits: 2 }) : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </section>
  );
}

function SessionList({ timeline }) {
  const sessions = timeline.filter((point) => point.count > 0).reverse();
  return (
    <section>
      <details>
        <summary className="cursor-pointer text-xl font-semibold">
          Alle {formatNumber(sessions.length)} Sitzungen mit diesem Wort
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-1 pr-4 font-normal">Datum</th>
                <th className="py-1 pr-4 font-normal">Sitzung</th>
                <th className="py-1 pr-4 text-right font-normal">Anzahl</th>
                <th className="py-1 text-right font-normal">Anteil</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((point) => (
                <tr key={point.protocol_id} className="border-b border-border/50">
                  <td className="py-1 pr-4">{formatGermanDate(point.date)}</td>
                  <td className="py-1 pr-4">
                    <a href={point.pdf_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {point.wahlperiode}/{point.protokollnummer}
                    </a>
                    {SOURCE_NOTES[point.source] && (
                      <span className="ml-2 text-xs text-muted-foreground">({SOURCE_NOTES[point.source]})</span>
                    )}
                  </td>
                  <td className="py-1 pr-4 text-right tabular-nums">{formatNumber(point.count)}</td>
                  <td className="py-1 text-right tabular-nums">{point.percentage.toFixed(4)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export default function WordTimeline() {
  const { word } = useParams();
  const navigate = useNavigate();
  const [timeline, setTimeline] = useState([]);
  const [details, setDetails] = useState(null);
  const [groupTotals, setGroupTotals] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setError(null);
    Promise.all([getWordTimeline(word), getWordDetails(word), getGroupTotals()])
      .then(([loadedTimeline, loadedDetails, loadedTotals]) => {
        if (cancelled) return;
        if (loadedDetails.word !== word) {
          navigate(`/wort/${encodeURIComponent(loadedDetails.word)}`, { replace: true });
          return;
        }
        setTimeline(loadedTimeline);
        setDetails(loadedDetails);
        setGroupTotals(loadedTotals);
      })
      .catch((loadError) => !cancelled && setError(loadError.message));
    return () => {
      cancelled = true;
    };
  }, [word, navigate]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <p className="mt-4">
          <Link to="/" className="underline underline-offset-2">
            Zur Suche
          </Link>
        </p>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm">
          <Link to="/" className="underline underline-offset-2">
            Suche
          </Link>
        </p>
        <h1 className="text-4xl font-bold">{details.word}</h1>
        {details.word.endsWith(NAME_SUFFIX) && (
          <p className="text-sm text-muted-foreground">
            Gezählt wird der Name, wo er direkt nach einem Titel oder einer Anrede steht, etwa „Frau“, „Dr.“ oder
            „Kollege“. Ohne Titel zählt das Wort bei{' '}
            <Link to={`/wort/${encodeURIComponent(details.word.slice(0, -NAME_SUFFIX.length))}`} className="underline underline-offset-2">
              {details.word.slice(0, -NAME_SUFFIX.length)}
            </Link>
            .
          </p>
        )}
      </header>
      <ShareImages image={`wort/${wordImageName(details.word)}`} fileName={wordImageName(details.word)} />
      <FirstOccurrence details={details} timeline={timeline} />
      <WordForms forms={details.forms} lemma={details.word} />
      <FrequencyChart timeline={timeline} />
      <GroupTable groupCounts={details.group_counts} groupTotals={groupTotals} />
      <SessionList timeline={timeline} />
      <p className="text-sm">
        <Link to={`/vergleich?words=${encodeURIComponent(details.word)}`} className="underline underline-offset-2">
          Mit anderen Wörtern vergleichen
        </Link>
      </p>
    </article>
  );
}
