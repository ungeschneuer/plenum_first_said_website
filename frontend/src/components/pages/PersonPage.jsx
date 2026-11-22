import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPerson, getPersons } from '../../utils/staticData';
import { formatGermanDate, formatNumber } from '../../utils/german';
import { Skeleton } from '../ui/skeleton';
import { Input } from '../ui/input';
import { BarChart } from '../home/BarChart';
import { ALL_TERMS, rankPersons } from '../../utils/persons';
import { pageTitle } from '../../pageMeta';
import { ShareImages } from '../ShareImages';

const PAGE_SIZE = 100;
const SHOWN_ATTRIBUTIONS = 4;

function StatTile({ label, value, detail }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{value}</dd>
      {detail && <dd className="mt-1 text-sm text-muted-foreground">{detail}</dd>}
    </div>
  );
}

function wordsPerYear(words) {
  const counts = new Map();
  for (const word of words) {
    const year = Number(word.date.slice(0, 4));
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  const years = [...counts.keys()];
  const bars = [];
  for (let year = Math.min(...years); year <= Math.max(...years); year++) {
    const value = counts.get(year) ?? 0;
    bars.push({ key: year, label: String(year), value, tooltip: `${formatNumber(value)} neue Wörter` });
  }
  return bars;
}

function TermTable({ summary, persons }) {
  const rows = Object.entries(summary.wahlperioden)
    .map(([term, [count, asChair, attribution]]) => {
      const ranking = rankPersons(persons, term, false);
      const row = ranking.find((entry) => entry.person.id === summary.id);
      return { term, count, asChair, attribution, rank: row?.rank, of: ranking.length };
    })
    .reverse();
  return (
    <section className="space-y-4" aria-labelledby="wahlperioden-heading">
      <h2 id="wahlperioden-heading" className="text-xl font-semibold">Nach Wahlperiode</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-normal">Wahlperiode</th>
              <th scope="col" className="hidden py-2 pr-3 font-normal sm:table-cell">Fraktion oder Rolle</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">Neue Wörter</th>
              <th scope="col" className="py-2 text-right font-normal">Rang</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.term} className="border-b border-border/60">
                <td className="py-2 pr-3">
                  <Link to={`/personen?wp=${row.term}`} className="underline-offset-2 hover:underline">
                    {row.term}.
                  </Link>
                </td>
                <td className="hidden py-2 pr-3 text-muted-foreground sm:table-cell">{row.attribution}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatNumber(row.count)}
                  {row.asChair > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      davon {formatNumber(row.asChair)} in der Sitzungsleitung
                    </span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {row.rank ? `${formatNumber(row.rank)} von ${formatNumber(row.of)}` : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        Der Rang zählt ohne die Wörter aus der Sitzungsleitung.
      </p>
    </section>
  );
}

function WordList({ words }) {
  const [query, setQuery] = useState('');
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery ? words.filter((word) => word.lemma.toLowerCase().includes(normalizedQuery)) : words;
  return (
    <section className="space-y-4" aria-labelledby="woerter-heading">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <h2 id="woerter-heading" className="text-xl font-semibold">Wörter</h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {formatNumber(filtered.length)} {filtered.length === 1 ? 'Wort' : 'Wörter'}, die neuesten zuerst
          </p>
        </div>
        <Input
          type="search"
          placeholder="Wörter filtern"
          aria-label="Wörter filtern"
          className="sm:w-64"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShownCount(PAGE_SIZE);
          }}
        />
      </div>
      <ul className="divide-y divide-border/60 border-y border-border/60">
        {filtered.slice(0, shownCount).map((word) => (
          <li key={word.lemma} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
            <span className="min-w-0 break-words [hyphens:auto]">
              <Link to={`/wort/${encodeURIComponent(word.lemma)}`} className="font-medium underline-offset-2 hover:underline">
                {word.lemma}
              </Link>
              {word.interjection && <span className="ml-2 text-xs text-muted-foreground">Zwischenruf</span>}
            </span>
            <a
              href={word.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-sm tabular-nums text-muted-foreground underline-offset-2 hover:underline"
            >
              {formatGermanDate(word.date)}, {word.wahlperiode}/{word.protokollnummer}
            </a>
          </li>
        ))}
      </ul>
      {filtered.length > shownCount && (
        <button
          type="button"
          className="underline underline-offset-2"
          onClick={() => setShownCount((count) => count + PAGE_SIZE)}
        >
          Weitere {formatNumber(Math.min(PAGE_SIZE, filtered.length - shownCount))} anzeigen
        </button>
      )}
    </section>
  );
}

export default function PersonPage() {
  const { id } = useParams();
  const [person, setPerson] = useState(null);
  const [persons, setPersons] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPerson(null);
    setError(null);
    getPerson(id).then(setPerson).catch(() => setError('Zu dieser Person gibt es keine Daten.'));
    getPersons().then((data) => setPersons(data.personen)).catch(() => setPersons([]));
  }, [id]);

  useEffect(() => {
    if (person) document.title = pageTitle(person.name);
  }, [person]);

  const summary = useMemo(() => persons?.find((entry) => entry.id === id), [persons, id]);
  const bars = useMemo(() => (person?.words.length ? wordsPerYear(person.words) : []), [person]);

  if (error) {
    return (
      <article className="mx-auto max-w-5xl space-y-4 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold">Person nicht gefunden</h1>
        <p>
          {error} Zur <Link to="/personen" className="underline underline-offset-2">Rangliste</Link>.
        </p>
      </article>
    );
  }
  if (!person) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const interjections = person.words.filter((word) => word.interjection).length;
  const first = person.words.at(-1);
  const last = person.words[0];
  const allRank = persons && summary ? rankPersons(persons, ALL_TERMS, false).find((row) => row.person.id === id) : null;

  return (
    <article className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <Link to="/personen" className="underline-offset-2 hover:underline">Neue Wörter nach Personen</Link>
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">{person.name}</h1>
        {person.attributions.length > 0 && (
          <p className="text-muted-foreground">
            {person.attributions.slice(0, SHOWN_ATTRIBUTIONS).map(([label]) => label).join(', ')}
          </p>
        )}
      </header>

      <ShareImages image={`person/${id}`} fileName={id} />

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Zum ersten Mal gesagt" value={formatNumber(person.words.length)} detail="Wörter" />
        <StatTile
          label="Davon in Zwischenrufen"
          value={formatNumber(interjections)}
          detail={person.words.length ? `${Math.round((interjections / person.words.length) * 100)} Prozent` : null}
        />
        <StatTile
          label="Zeitraum"
          value={first.date.slice(0, 4) === last.date.slice(0, 4) ? first.date.slice(0, 4) : `${first.date.slice(0, 4)} bis ${last.date.slice(0, 4)}`}
          detail={`${formatGermanDate(first.date)} bis ${formatGermanDate(last.date)}`}
        />
        <StatTile
          label="Rang über alle Wahlperioden"
          value={allRank ? formatNumber(allRank.rank) : '–'}
          detail={allRank ? 'ohne Sitzungsleitung' : 'nur Sitzungsleitung'}
        />
      </dl>

      {bars.length > 1 && (
        <section className="space-y-4" aria-labelledby="jahre-heading">
          <h2 id="jahre-heading" className="text-xl font-semibold">Neue Wörter je Jahr</h2>
          <BarChart
            bars={bars}
            labelHeader="Jahr"
            valueHeader="Neue Wörter"
            caption={`Wörter, die ${person.name} als erste Person im Bundestag gesagt hat, je Jahr`}
          />
        </section>
      )}

      {summary && persons && <TermTable summary={summary} persons={persons} />}

      <WordList words={person.words} />

      <p className="text-sm text-muted-foreground">
        Vor der 19. Wahlperiode nennen die Protokolle oft nur den Nachnamen. Ein Name kann dort für mehrere Personen
        stehen, und eine Person kann unter verschiedenen Schreibweisen erscheinen.
      </p>
    </article>
  );
}
