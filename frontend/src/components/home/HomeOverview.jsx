import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getOverview, getRecentlyFirstSaid } from '../../utils/staticData';
import { formatGermanDate, formatLongDate, formatNumber } from '../../utils/german';
import { SpeakerName, speakerPrefix } from '../SpeakerName';
import { Skeleton } from '../ui/skeleton';
import { BarChart } from './BarChart';

const SHOWN_NEW_WORDS = 6;
const MAXIMUM_EVIDENCE_LENGTH = 220;
const MAXIMUM_LEMMA_LENGTH = 28;

const EXAMPLE_WORDS = [
  'Wiedervereinigung', 'Wirtschaftswunder', 'Gastarbeiter', 'Waldsterben', 'Internet', 'Digitalisierung',
  'Energiewende', 'Schuldenbremse', 'Pandemie', 'Zeitenwende', 'Fachkräftemangel', 'Bürokratieabbau',
];

const EXAMPLE_COMPARISONS = [
  ['Bonn', 'Berlin'],
  ['Kernenergie', 'Atomkraft'],
  ['Umweltschutz', 'Klimaschutz'],
  ['Computer', 'Internet', 'Digitalisierung'],
];

const linkClass = 'underline underline-offset-2 hover:text-foreground';

function formatMillions(number) {
  return `${(number / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio.`;
}

function sessionLabel(protocol) {
  const [wahlperiode, number] = protocol.nummer.split('/');
  return { wahlperiode: Number(wahlperiode), number: Number(number) };
}

function groupBySession(words) {
  const sessions = new Map();
  for (const word of words) {
    const key = word.protokoll.nummer;
    if (!sessions.has(key)) sessions.set(key, { protocol: word.protokoll, words: [] });
    sessions.get(key).words.push(word);
  }
  return [...sessions.values()].sort((a, b) => a.protocol.datum.localeCompare(b.protocol.datum)
    || sessionLabel(a.protocol).number - sessionLabel(b.protocol).number);
}

// The selection on the home page leaves out words first said by members of the AfD group.
const EXCLUDED_GROUPS = new Set(['AfD']);

function shownWords(words) {
  const candidates = words.filter((word) => !EXCLUDED_GROUPS.has(word.erste?.fraktion));
  const readable = candidates.filter((word) => word.beleg && word.beleg.length <= MAXIMUM_EVIDENCE_LENGTH
    && word.lemma.length <= MAXIMUM_LEMMA_LENGTH);
  return (readable.length >= SHOWN_NEW_WORDS ? readable : candidates).slice(0, SHOWN_NEW_WORDS);
}

function SectionHeading({ title, children }) {
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      {children && <p className="text-muted-foreground">{children}</p>}
    </div>
  );
}

function StatTile({ value, label, detail }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{value}</dd>
      {detail && <dd className="mt-1 text-sm text-muted-foreground">{detail}</dd>}
    </div>
  );
}

function Figures({ overview, newWordCount }) {
  if (!overview) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-28" />)}
      </div>
    );
  }
  const currentTerm = overview.terms.at(-1);
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Sitzungen"
        value={formatNumber(overview.sessions)}
        detail={`${formatGermanDate(overview.first_date)} bis ${formatGermanDate(overview.last_date)}`}
      />
      <StatTile
        label="Gezählte Wörter"
        value={formatMillions(overview.words)}
        detail={`im Mittel ${formatNumber(Math.round(overview.words / overview.sessions))} je Sitzung`}
      />
      <StatTile
        label="Wahlperioden"
        value={formatNumber(overview.terms.length)}
        detail={currentTerm && `die ${currentTerm.wahlperiode}. seit ${formatGermanDate(currentTerm.first_date)}`}
      />
      <StatTile
        label="Zum ersten Mal gesagt"
        value={newWordCount === null ? '…' : formatNumber(newWordCount)}
        detail="Wörter in den Sitzungen der letzten 90 Tage"
      />
    </dl>
  );
}

function NewWordCard({ word }) {
  return (
    <li className="flex flex-col rounded-lg border bg-card p-5">
      <Link
        to={`/wort/${encodeURIComponent(word.lemma)}`}
        className="break-words text-lg font-semibold underline-offset-2 [hyphens:auto] hover:underline"
      >
        {word.lemma}
      </Link>
      {word.beleg && <p className="mt-2 flex-1 text-sm italic leading-relaxed">„{word.beleg}“</p>}
      {word.erste && (
        <p className="mt-3 text-sm text-muted-foreground">
          {speakerPrefix(word.erste)}<SpeakerName speaker={word.erste} />
        </p>
      )}
    </li>
  );
}

function LatestNewWords({ sessions, error }) {
  if (error) return null;
  if (!sessions) return <Skeleton className="h-72 w-full" />;
  const latest = sessions.at(-1);
  if (!latest) return null;
  const { wahlperiode, number } = sessionLabel(latest.protocol);
  return (
    <section className="space-y-6" aria-labelledby="neu-heading">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <h2 id="neu-heading" className="text-2xl font-bold tracking-tight">Zum ersten Mal gesagt</h2>
          <p className="text-muted-foreground">
            {formatNumber(latest.words.length)} Wörter kamen in der {number}. Sitzung der {wahlperiode}. Wahlperiode
            am {formatLongDate(latest.protocol.datum)} zum ersten Mal seit 1949 vor. Eine Auswahl:
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1 sm:items-end">
          <Link to="/neu" className="inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline">
            Alle neuen Wörter <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link to="/personen" className="inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline">
            Rangliste nach Personen <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {shownWords(latest.words).map((word) => <NewWordCard key={word.lemma} word={word} />)}
      </ul>
    </section>
  );
}

function NewWordsChart({ sessions }) {
  if (!sessions) return <Skeleton className="h-60 w-full" />;
  const bars = sessions.map(({ protocol, words }) => {
    const { number } = sessionLabel(protocol);
    return {
      key: protocol.nummer,
      label: `${number}. Sitzung, ${formatGermanDate(protocol.datum)}`,
      axisLabel: String(number),
      value: words.length,
      tooltip: `${formatNumber(words.length)} neue Wörter`,
    };
  });
  return (
    <BarChart
      bars={bars}
      labelHeader="Sitzung"
      valueHeader="Neue Wörter"
      caption="Wörter, die in einer Sitzung zum ersten Mal vorkamen, je Sitzung der letzten 90 Tage"
    />
  );
}

function WordsPerTermChart({ overview }) {
  if (!overview) return <Skeleton className="h-60 w-full" />;
  const bars = overview.terms.map((term) => ({
    key: term.wahlperiode,
    label: `${term.wahlperiode}. Wahlperiode, ${term.first_date.slice(0, 4)} bis ${term.last_date.slice(0, 4)}`,
    axisLabel: String(term.wahlperiode),
    value: Math.round(term.words / term.sessions),
    tooltip: `${formatNumber(Math.round(term.words / term.sessions))} Wörter je Sitzung, ${formatNumber(term.sessions)} Sitzungen`,
  }));
  return (
    <BarChart
      bars={bars}
      labelHeader="Wahlperiode"
      valueHeader="Wörter je Sitzung"
      caption="Gezählte Wörter je Sitzung im Mittel, nach Wahlperiode"
    />
  );
}

function Examples() {
  return (
    <section className="space-y-6" aria-label="Zum Ausprobieren">
      <SectionHeading title="Zum Ausprobieren">
        Wörter mit ihrem Verlauf seit 1949 und Vergleiche mehrerer Wörter in einem Diagramm.
      </SectionHeading>
      <ul className="flex flex-wrap gap-2">
        {EXAMPLE_WORDS.map((word) => (
          <li key={word}>
            <Link
              to={`/wort/${encodeURIComponent(word)}`}
              className="inline-block rounded-full border bg-card px-4 py-1.5 text-sm transition-colors hover:border-foreground"
            >
              {word}
            </Link>
          </li>
        ))}
      </ul>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {EXAMPLE_COMPARISONS.map((words) => (
          <li key={words.join()}>
            <Link
              to={`/vergleich?words=${words.map(encodeURIComponent).join(',')}`}
              className="flex h-full items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground"
            >
              <span>{words.join(' und ')}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HomeOverview() {
  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [newWordsError, setNewWordsError] = useState(null);

  useEffect(() => {
    getOverview().then(setOverview).catch(() => {});
    getRecentlyFirstSaid()
      .then((words) => setSessions(groupBySession(words)))
      .catch((loadError) => setNewWordsError(loadError.message));
  }, []);

  const newWordCount = sessions ? sessions.reduce((sum, session) => sum + session.words.length, 0) : null;

  return (
    <div className="space-y-16">
      <Figures overview={overview} newWordCount={newWordsError ? 0 : newWordCount} />
      <LatestNewWords sessions={sessions} error={newWordsError} />
      <section className="grid grid-cols-1 gap-10 lg:grid-cols-2" aria-label="Diagramme">
        {!newWordsError && (
          <div className="space-y-4">
            <SectionHeading title="Neue Wörter je Sitzung" />
            <NewWordsChart sessions={sessions} />
          </div>
        )}
        <div className="space-y-4">
          <SectionHeading title="Länge der Sitzungen" />
          <WordsPerTermChart overview={overview} />
        </div>
      </section>
      <Examples />
      <p className="text-sm text-muted-foreground">
        Gebeugte Formen führen zur Grundform. Wie gezählt wird, steht unter{' '}
        <Link to="/about" className={linkClass}>Über das Projekt</Link>, Antworten auf häufige Fragen unter{' '}
        <Link to="/faq" className={linkClass}>Häufige Fragen</Link>.
      </p>
    </div>
  );
}
