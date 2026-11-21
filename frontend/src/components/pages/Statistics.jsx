import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStatistics } from '../../utils/staticData';
import { formatGermanDate, formatNumber } from '../../utils/german';
import { Skeleton } from '../ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { BarChart } from '../home/BarChart';

const DAYS_PER_YEAR = 365.25;
const INITIALLY_SHOWN_RETURNS = 25;
const SECTIONS = [
  ['wiederkehrer', 'Wiederkehrer'],
  ['einmalwoerter', 'Einmalwörter'],
  ['typisch', 'Typische Wörter der Fraktionen'],
];

const wordLink = (lemma) => `/wort/${encodeURIComponent(lemma)}`;
const linkClass = 'font-medium underline-offset-2 hover:underline';

function yearsBetween(first, second) {
  return (new Date(second) - new Date(first)) / (DAYS_PER_YEAR * 24 * 60 * 60 * 1000);
}

function formatYears(years) {
  const rounded = Math.floor(years);
  return `${formatNumber(rounded)} ${rounded === 1 ? 'Jahr' : 'Jahre'}`;
}

function formatShare(share) {
  return share.toLocaleString('de-DE', { style: 'percent', maximumFractionDigits: 0 });
}

function TermSelect({ terms, value, onChange, label = 'Wahlperiode' }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select
        className="h-10 w-48 rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {[...terms].reverse().map((term) => (
          <option key={term} value={term}>{term}. Wahlperiode</option>
        ))}
      </select>
    </label>
  );
}

function SectionHeading({ id, title, children }) {
  return (
    <div className="space-y-2">
      <h2 id={id} className="scroll-mt-24 text-2xl font-bold tracking-tight">{title}</h2>
      <p className="max-w-3xl leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function ReturningWords({ returns, protocols }) {
  const [view, setView] = useState('laengste');
  const [showAll, setShowAll] = useState(false);
  const all = returns[view];
  const rows = (showAll ? all : all.slice(0, INITIALLY_SHOWN_RETURNS)).map((word) => {
    const before = protocols[word.vorher];
    const again = protocols[word.wieder];
    return { ...word, before, again, years: yearsBetween(before.datum, again.datum) };
  });
  return (
    <section className="space-y-5" aria-labelledby="wiederkehrer">
      <SectionHeading id="wiederkehrer" title="Wiederkehrer">
        Wörter, die mindestens zehn Jahre in keiner Sitzung vorkamen und dann wieder gesagt wurden. Gezeigt wird die
        längste Pause eines Wortes. Davor und danach muss es in mindestens drei Sitzungen vorgekommen sein; Namen und
        Abkürzungen sind ausgenommen.
      </SectionHeading>
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(value) => {
          if (!value) return;
          setView(value);
          setShowAll(false);
        }}
        aria-label="Auswahl der Wiederkehrer"
        className="justify-start"
      >
        <ToggleGroupItem value="laengste">Längste Pausen</ToggleGroupItem>
        <ToggleGroupItem value="zuletzt">Im letzten Jahr zurück</ToggleGroupItem>
      </ToggleGroup>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-normal">Wort</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">Pause</th>
              <th scope="col" className="hidden py-2 pr-3 font-normal sm:table-cell">Zuletzt davor</th>
              <th scope="col" className="py-2 pr-3 font-normal">Wieder am</th>
              <th scope="col" className="hidden py-2 text-right font-normal md:table-cell">Vorkommen davor / danach</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.lemma} className="border-b border-border/60">
                <td className="break-words py-2 pr-3 [hyphens:auto]">
                  <Link to={wordLink(row.lemma)} className={linkClass}>{row.lemma}</Link>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{formatYears(row.years)}</td>
                <td className="hidden py-2 pr-3 tabular-nums text-muted-foreground sm:table-cell">
                  {formatGermanDate(row.before.datum)}
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  <a href={row.again.pdf} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                    {formatGermanDate(row.again.datum)}
                  </a>
                </td>
                <td className="hidden py-2 text-right tabular-nums text-muted-foreground md:table-cell">
                  {formatNumber(row.anzahl_vorher)} / {formatNumber(row.anzahl_nachher)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!showAll && all.length > INITIALLY_SHOWN_RETURNS && (
        <button type="button" className="underline underline-offset-2" onClick={() => setShowAll(true)}>
          Alle {formatNumber(all.length)} anzeigen
        </button>
      )}
    </section>
  );
}

function WordsSaidOnce({ saidOnce, protocols }) {
  const terms = Object.keys(saidOnce.wahlperioden).map(Number).sort((a, b) => a - b);
  const [term, setTerm] = useState(String(terms.at(-1)));
  const bars = terms.map((value) => {
    const [firstSaid, once] = saidOnce.wahlperioden[value];
    return {
      key: value,
      label: `${value}. Wahlperiode`,
      axisLabel: String(value),
      value: Math.round((once / firstSaid) * 100),
      tooltip: `${formatNumber(once)} von ${formatNumber(firstSaid)} neuen Wörtern nur einmal gesagt`,
    };
  });
  const [firstSaid, once] = saidOnce.wahlperioden[term];
  const examples = saidOnce.beispiele[term] ?? [];
  return (
    <section className="space-y-5" aria-labelledby="einmalwoerter">
      <SectionHeading id="einmalwoerter" title="Einmalwörter">
        Wörter, die in genau einer Sitzung genau einmal gesagt wurden. Das Diagramm zeigt je Wahlperiode, welcher
        Anteil der dort zum ersten Mal gesagten Wörter danach nie wieder vorkam. Wörter aus den letzten Wahlperioden
        hatten weniger Zeit, wieder aufgegriffen zu werden. In der 1. Wahlperiode zählt fast jedes Wort als neu, weil
        die Zählung 1949 beginnt.
      </SectionHeading>
      <BarChart
        bars={bars}
        labelHeader="Wahlperiode"
        valueHeader="Anteil in Prozent"
        caption="Anteil der Einmalwörter an den neuen Wörtern einer Wahlperiode, in Prozent"
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm">
          In der {term}. Wahlperiode: {formatNumber(once)} von {formatNumber(firstSaid)} neuen Wörtern
          ({formatShare(once / firstSaid)}) kamen nur einmal vor. Eine Auswahl:
        </p>
        <TermSelect terms={terms.map(String)} value={term} onChange={setTerm} />
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {examples.map((word) => {
          const protocol = protocols[word.protokoll];
          return (
            <li key={word.lemma} className="flex flex-col rounded-lg border bg-card p-5">
              <Link to={wordLink(word.lemma)} className="break-words text-lg font-semibold underline-offset-2 [hyphens:auto] hover:underline">
                {word.lemma}
              </Link>
              <p className="mt-2 flex-1 text-sm italic leading-relaxed">„{word.beleg}“</p>
              <a
                href={protocol.pdf}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 text-sm text-muted-foreground underline-offset-2 hover:underline"
              >
                {formatGermanDate(protocol.datum)}, Protokoll {protocol.nummer}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TypicalWords({ typical }) {
  const terms = Object.keys(typical).map(Number).sort((a, b) => a - b).map(String);
  const [term, setTerm] = useState(terms.at(-1));
  const groups = Object.entries(typical[term] ?? {}).filter(([, words]) => words.length > 0);
  return (
    <section className="space-y-5" aria-labelledby="typisch">
      <SectionHeading id="typisch" title="Typische Wörter der Fraktionen">
        Wörter, die eine Fraktion in ihren Reden deutlich häufiger gebraucht als die übrigen Fraktionen, ab der 19.
        Wahlperiode. Die Zahl hinter dem Wort gibt an, wie viel häufiger, gemessen am Anteil an allen Wörtern der
        jeweiligen Reden. Ausgenommen sind die 500 häufigsten Wörter, Namen und Parteibezeichnungen; Zwischenrufe,
        Sitzungsleitung und Bundesregierung zählen nicht.
      </SectionHeading>
      <TermSelect terms={terms} value={term} onChange={setTerm} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map(([group, words]) => (
          <section key={group} className="rounded-lg border bg-card p-5" aria-label={group}>
            <h3 className="font-semibold">{group}</h3>
            <ol className="mt-3 space-y-1.5 text-sm">
              {words.map(([lemma, count, ratio]) => (
                <li key={lemma} className="flex items-baseline justify-between gap-3">
                  <Link to={wordLink(lemma)} className="min-w-0 break-words underline-offset-2 [hyphens:auto] hover:underline">
                    {lemma}
                  </Link>
                  <span className="shrink-0 tabular-nums text-muted-foreground" title={`${formatNumber(count)}-mal gesagt`}>
                    {ratio.toLocaleString('de-DE', { maximumFractionDigits: 1 })}-fach
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}

export default function Statistics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getStatistics().then(setData).catch((loadError) => setError(loadError.message));
  }, []);

  return (
    <article className="mx-auto max-w-5xl space-y-14 px-4 py-10 sm:px-6">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold sm:text-4xl">Statistik</h1>
        <p className="max-w-3xl leading-relaxed">
          Auswertungen über alle Wörter aus den Plenarprotokollen seit 1949. Die Zahlen werden bei jeder Aktualisierung
          der Daten neu berechnet. Wer wie viele Wörter zuerst gesagt hat, steht unter{' '}
          <Link to="/personen" className="underline underline-offset-2">Personen</Link>.
        </p>
        <nav aria-label="Abschnitte">
          <ul className="flex flex-wrap gap-2">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="inline-block rounded-full border bg-card px-4 py-1.5 text-sm hover:border-foreground">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {error && <p role="alert">{error}</p>}
      {!data && !error && <Skeleton className="h-96 w-full" />}
      {data && (
        <>
          <ReturningWords returns={data.statistics.wiederkehrer} protocols={data.protocols} />
          <WordsSaidOnce saidOnce={data.statistics.einmalwoerter} protocols={data.protocols} />
          <TypicalWords typical={data.statistics.typisch} />
        </>
      )}
    </article>
  );
}
