import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getPersons } from '../../utils/staticData';
import { formatNumber } from '../../utils/german';
import { ALL_TERMS, rankPersons } from '../../utils/persons';
import { Skeleton } from '../ui/skeleton';
import { Input } from '../ui/input';

const PAGE_SIZE = 50;
const MAXIMUM_GROUP_BARS = 12;

const controlClass = 'h-10 rounded-md border border-input bg-background px-3 text-sm';

function groupTotals(groups, term) {
  const totals = new Map();
  const terms = term === ALL_TERMS ? Object.keys(groups) : [term];
  for (const key of terms) {
    for (const [group, count] of Object.entries(groups[key] ?? {})) {
      totals.set(group, (totals.get(group) ?? 0) + count);
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function GroupBars({ groups, term }) {
  const totals = groupTotals(groups, term);
  if (totals.length === 0) return null;
  const shown = totals.slice(0, MAXIMUM_GROUP_BARS);
  const sum = totals.reduce((total, [, count]) => total + count, 0);
  const maximum = shown[0][1];
  return (
    <section className="space-y-4" aria-labelledby="fraktionen-heading">
      <div className="space-y-1">
        <h2 id="fraktionen-heading" className="text-xl font-semibold">Nach Fraktion</h2>
        <p className="text-sm text-muted-foreground">
          Neue Wörter, die zuerst von Mitgliedern einer Fraktion gesagt wurden, in Reden und Zwischenrufen. Ohne
          Mitglieder der Bundesregierung und die Sitzungsleitung.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">Fraktion</th>
            <th scope="col">Neue Wörter</th>
            <th scope="col">Anteil</th>
          </tr>
        </thead>
        <tbody>
          {shown.map(([group, count]) => (
            <tr key={group}>
              <th scope="row" className="w-40 py-1 pr-3 text-left font-normal sm:w-56">{group}</th>
              <td className="py-1">
                <div className="flex items-center gap-3">
                  <div className="h-4 flex-1">
                    <div
                      className="h-full rounded-r-[4px]"
                      style={{ width: `${(count / maximum) * 100}%`, backgroundColor: 'var(--chart-bar)' }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right tabular-nums">
                    {formatNumber(count)}{' '}
                    <span className="text-muted-foreground">
                      ({(count / sum).toLocaleString('de-DE', { style: 'percent', maximumFractionDigits: 1 })})
                    </span>
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function PersonRanking() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [shownCount, setShownCount] = useState(PAGE_SIZE);

  useEffect(() => {
    getPersons().then(setData).catch((loadError) => setError(loadError.message));
  }, []);

  const terms = useMemo(() => (data ? Object.keys(data.fraktionen).map(Number).sort((a, b) => a - b) : []), [data]);
  const term = searchParams.get('wp') ?? (terms.length ? String(terms.at(-1)) : ALL_TERMS);
  const includeChair = searchParams.get('sitzungsleitung') === 'ja';

  const ranking = useMemo(() => (data ? rankPersons(data.personen, term, includeChair) : []), [data, term, includeChair]);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? ranking.filter((row) => row.person.name.toLowerCase().includes(normalizedQuery))
    : ranking;

  const updateParameter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
    setShownCount(PAGE_SIZE);
  };

  return (
    <article className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold sm:text-4xl">Neue Wörter nach Personen</h1>
        <p className="max-w-3xl leading-relaxed">
          Die Rangliste zählt für jede Person die Wörter, die sie als erste im Bundestag gesagt hat: jedes Wort, dessen
          erstes Vorkommen seit 1949 ihr zugeordnet ist, in Reden wie in Zwischenrufen. Wörter in vorgelesenen
          Zitaten zählen nicht. Vor der 19. Wahlperiode nennen die Protokolle oft nur den Nachnamen; ein Name kann
          dort für mehrere Personen stehen. In der 1. Wahlperiode ist fast jedes Wort neu, weil die Zählung 1949
          beginnt.
        </p>
      </header>

      {error && <p role="alert">{error}</p>}
      {!data && !error && <Skeleton className="h-96 w-full" />}

      {data && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex flex-col gap-1 text-sm">
              Wahlperiode
              <select
                className={controlClass}
                value={term}
                onChange={(event) => updateParameter('wp', event.target.value)}
              >
                {[...terms].reverse().map((value) => (
                  <option key={value} value={String(value)}>{value}. Wahlperiode</option>
                ))}
                <option value={ALL_TERMS}>Alle Wahlperioden</option>
              </select>
            </label>
            <label className="flex h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={includeChair}
                onChange={(event) => updateParameter('sitzungsleitung', event.target.checked ? 'ja' : null)}
              />
              Sitzungsleitung mitzählen
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm sm:min-w-56">
              Name
              <Input
                type="search"
                placeholder="Name filtern"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setShownCount(PAGE_SIZE);
                }}
              />
            </label>
          </div>

          <GroupBars groups={data.fraktionen} term={term} />

          <section className="space-y-4" aria-labelledby="rangliste-heading">
            <div className="space-y-1">
              <h2 id="rangliste-heading" className="text-xl font-semibold">Rangliste</h2>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {formatNumber(filtered.length)} {filtered.length === 1 ? 'Person' : 'Personen'}
                {term === ALL_TERMS ? ' in allen Wahlperioden' : ` in der ${term}. Wahlperiode`}
                {includeChair ? ', mit Sitzungsleitung' : ', ohne Sitzungsleitung'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="w-14 py-2 pr-3 font-normal">Rang</th>
                    <th scope="col" className="py-2 pr-3 font-normal">Name</th>
                    <th scope="col" className="hidden py-2 pr-3 font-normal sm:table-cell">Fraktion oder Rolle</th>
                    <th scope="col" className="py-2 text-right font-normal">Neue Wörter</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, shownCount).map((row) => (
                    <tr key={row.person.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 tabular-nums text-muted-foreground">{row.rank}</td>
                      <td className="py-2 pr-3">
                        <Link to={`/person/${row.person.id}`} className="font-medium underline-offset-2 hover:underline">
                          {row.person.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground sm:hidden">{row.attribution}</span>
                      </td>
                      <td className="hidden py-2 pr-3 text-muted-foreground sm:table-cell">{row.attribution}</td>
                      <td className="py-2 text-right tabular-nums">{formatNumber(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        </>
      )}
    </article>
  );
}
