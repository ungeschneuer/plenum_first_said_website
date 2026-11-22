import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { SHARE_FORMATS } from '../../pageMeta';
import { fitOptions, fitText } from '../../share/card';
import { previewHtml } from '../../share/browserCard';
import {
  CAPTION_LIMITS, SHAREABLE_PAGES, newWordShare, pageShare, personShare, returnShare, wordShare,
} from '../../share/content';
import { listShareRuns, startShareRun } from '../../share/github';
import { getPersons, getRecentlyFirstSaid, getStatistics, getWordDetails, getWordTimeline } from '../../utils/staticData';
import { formatGermanDate } from '../../utils/german';

const TOKEN_KEY = 'share-admin-token';
const TARGETS = [
  { key: 'instagram-post', label: 'Instagram-Post', format: 'post' },
  { key: 'instagram-story', label: 'Instagram-Story', format: 'story' },
  { key: 'linkedin', label: 'LinkedIn', format: 'link' },
];
const PREVIEW_WIDTH = 260;

function readToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked: the token stays for this visit only
  }
}

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function TokenSection({ token, onChange }) {
  const [draft, setDraft] = useState('');
  if (token) {
    return (
      <Section title="Zugang">
        <p className="text-sm text-muted-foreground">
          Ein GitHub-Token ist in diesem Browser gespeichert.{' '}
          <button type="button" className="underline underline-offset-2" onClick={() => onChange('')}>
            Token entfernen
          </button>
        </p>
      </Section>
    );
  }
  return (
    <Section title="Zugang">
      <p className="max-w-2xl text-sm leading-relaxed">
        Die Ansicht startet den Workflow „Bild teilen“ im Repository. Dafür braucht sie einen fein granularen
        GitHub-Token, der nur für dieses Repository die Berechtigung „Actions: Read and write“ hat. Der Token bleibt in
        diesem Browser; die Zugangsdaten für Instagram und LinkedIn liegen als Secrets im Repository.
      </p>
      <form
        className="flex max-w-xl gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onChange(draft.trim());
          setDraft('');
        }}
      >
        <Input
          type="password"
          autoComplete="off"
          placeholder="github_pat_…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="GitHub-Token"
        />
        <Button type="submit" disabled={!draft.trim()}>Speichern</Button>
      </form>
    </Section>
  );
}

const SHOWN_EVENTS = 15;

function EventList({ title, description, items, onPick }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      {items.length === 0 && <p className="text-sm text-muted-foreground">Zurzeit keine.</p>}
      <ul className="divide-y rounded-md border empty:hidden">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className="flex w-full flex-wrap justify-between gap-x-4 px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
              onClick={() => onPick(item)}
            >
              <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{item.lemma}</span>
              <span className="text-muted-foreground">{item.info}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Events worth a post: words said again after a pause of ten years or more, and words said for the first time.
function EventPicker({ onSelect }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState({ loading: null, error: null });

  useEffect(() => {
    Promise.all([getStatistics(), getRecentlyFirstSaid()])
      .then(([{ statistics, protocols }, newWords]) => setData({ statistics, protocols, newWords }))
      .catch((error) => setState({ loading: null, error: error.message }));
  }, []);

  if (state.error && !data) return <p className="text-sm text-destructive">{state.error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Ereignisse werden geladen …</p>;

  const { protocols } = data;
  const returns = data.statistics.wiederkehrer.zuletzt.slice(0, SHOWN_EVENTS).map((entry) => {
    const before = protocols[entry.vorher];
    const again = protocols[entry.wieder];
    const years = Math.floor((Date.parse(again.datum) - Date.parse(before.datum)) / (365.25 * 86400000));
    return {
      key: `wieder-${entry.lemma}`,
      lemma: entry.lemma,
      info: `nach ${years} Jahren am ${formatGermanDate(again.datum)}`,
      pick: async () => onSelect(returnShare(entry, protocols, await getWordTimeline(entry.lemma))),
    };
  });
  const newWords = data.newWords.slice(0, SHOWN_EVENTS).map((entry) => ({
    key: `neu-${entry.lemma}`,
    lemma: entry.lemma,
    info: `${formatGermanDate(entry.protokoll.datum)}${entry.erste?.name ? `, ${entry.erste.name}` : ''}`,
    pick: async () => onSelect(newWordShare(entry)),
  }));

  const pick = async (item) => {
    setState({ loading: item.key, error: null });
    try {
      await item.pick();
      setState({ loading: null, error: null });
    } catch (error) {
      setState({ loading: null, error: error.message });
    }
  };

  return (
    <div className="grid max-w-5xl gap-6 md:grid-cols-2">
      <EventList
        title="Wieder gesagt nach langer Pause"
        description="Wörter, die im letzten Jahr nach mindestens zehn Jahren ohne Vorkommen wieder gesagt wurden, neueste zuerst."
        items={returns}
        onPick={pick}
      />
      <EventList
        title="Neu im Bundestag"
        description="Wörter, die in den letzten 90 Tagen zum ersten Mal gesagt wurden, neueste zuerst."
        items={newWords}
        onPick={pick}
      />
      {state.loading && <p className="text-sm text-muted-foreground">Wird geladen …</p>}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  );
}

function WordPicker({ onSelect }) {
  const [word, setWord] = useState('');
  const [state, setState] = useState({ loading: false, error: null });
  return (
    <form
      className="flex max-w-xl gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setState({ loading: true, error: null });
        try {
          const [details, timeline] = await Promise.all([getWordDetails(word.trim()), getWordTimeline(word.trim())]);
          onSelect(wordShare(details, timeline, new Date().toISOString().slice(0, 10)));
          setState({ loading: false, error: null });
        } catch (error) {
          setState({ loading: false, error: error.message });
        }
      }}
    >
      <Input value={word} onChange={(event) => setWord(event.target.value)} placeholder="Wort, zum Beispiel Klimageld" aria-label="Wort" />
      <Button type="submit" disabled={!word.trim() || state.loading}>
        {state.loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        Laden
      </Button>
      {state.error && <p className="self-center text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

function PersonPicker({ onSelect }) {
  const [persons, setPersons] = useState(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    getPersons().then((data) => setPersons(data.personen)).catch(() => setPersons([]));
  }, []);
  const matches = useMemo(() => {
    const folded = query.trim().toLowerCase();
    if (!persons || folded.length < 2) return [];
    return persons.filter((person) => person.name.toLowerCase().includes(folded)).slice(0, 12);
  }, [persons, query]);
  return (
    <div className="max-w-xl space-y-2">
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name" aria-label="Person suchen" />
      {persons === null && <p className="text-sm text-muted-foreground">Personen werden geladen …</p>}
      <ul className="divide-y rounded-md border empty:hidden">
        {matches.map((person) => (
          <li key={person.id}>
            <button
              type="button"
              className="flex w-full justify-between gap-4 px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => onSelect(personShare(person))}
            >
              <span>{person.name}</span>
              <span className="text-muted-foreground">{person.anzahl.toLocaleString('de-DE')} Wörter</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PagePicker({ onSelect }) {
  return (
    <ul className="flex max-w-3xl flex-wrap gap-2">
      {SHAREABLE_PAGES.map((page) => (
        <li key={page.path}>
          <Button type="button" variant="outline" size="sm" onClick={() => onSelect(pageShare(page))}>
            {page.title}
          </Button>
        </li>
      ))}
    </ul>
  );
}

// The image as the workflow renders it: the same HTML document in an iframe, scaled down.
function Preview({ card, format }) {
  const frame = useRef(null);
  const html = useMemo(() => previewHtml(card, format.key), [card, format.key]);
  const scale = PREVIEW_WIDTH / format.width;

  const fit = useCallback(async () => {
    const doc = frame.current?.contentDocument;
    if (!doc?.querySelector('h1')) return;
    await doc.fonts.ready;
    fitText(fitOptions(format.key), doc);
  }, [format.key]);

  return (
    <figure className="space-y-1">
      <div
        className="overflow-hidden rounded-md border bg-white"
        style={{ width: PREVIEW_WIDTH, height: format.height * scale }}
      >
        <iframe
          ref={frame}
          title={`Vorschau ${format.label}`}
          srcDoc={html}
          onLoad={fit}
          sandbox="allow-same-origin"
          style={{ width: format.width, height: format.height, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        />
      </div>
      <figcaption className="text-xs text-muted-foreground">
        {format.label}, {format.width} × {format.height}
      </figcaption>
    </figure>
  );
}

function RunList({ token, refreshKey }) {
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    listShareRuns(token).then((list) => { setRuns(list); setError(null); }).catch((failure) => setError(failure.message));
  }, [token]);

  useEffect(load, [load, refreshKey]);
  const running = runs?.some((run) => run.status !== 'completed');
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [running, load]);

  return (
    <Section title="Letzte Läufe">
      <Button type="button" variant="outline" size="sm" onClick={load}>
        <RefreshCw aria-hidden="true" /> Aktualisieren
      </Button>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {runs && runs.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Läufe.</p>}
      <ul className="divide-y rounded-md border empty:hidden">
        {runs?.map((run) => (
          <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>{run.title}</span>
            <span className="flex items-center gap-3 text-muted-foreground">
              {formatGermanDate(run.createdAt.slice(0, 10))} {run.createdAt.slice(11, 16)} UTC
              <span className={run.conclusion === 'failure' ? 'text-destructive' : ''}>
                {run.status !== 'completed' ? 'läuft' : run.conclusion === 'success' ? 'erfolgreich' : 'fehlgeschlagen'}
              </span>
              <a href={run.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                Lauf <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Die erzeugten Bilder liegen bei jedem Lauf im Artefakt „bilder“.
      </p>
    </Section>
  );
}

export default function Admin() {
  const [token, setToken] = useState(readToken);
  const [share, setShare] = useState(null);
  const [caption, setCaption] = useState('');
  const [altText, setAltText] = useState('');
  const [targets, setTargets] = useState(['instagram-post', 'linkedin']);
  const [dryRun, setDryRun] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    document.title = 'Teilen · Admin';
    return () => robots.remove();
  }, []);

  const select = (next) => {
    setShare(next);
    setCaption(next.caption);
    setAltText(`${next.title}: Grafik von Bundestag Wortschatz`);
    setMessage(null);
  };

  const changeToken = (next) => {
    writeToken(next);
    setToken(next);
  };

  const toggleTarget = (key) => {
    setTargets((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const tooLong = targets.some((key) => caption.length > CAPTION_LIMITS[key.startsWith('instagram') ? 'instagram' : 'linkedin']);

  const submit = async () => {
    if (!dryRun && !window.confirm(`„${share.title}“ jetzt auf ${TARGETS.filter((t) => targets.includes(t.key)).map((t) => t.label).join(', ')} veröffentlichen?`)) {
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      await startShareRun(token, { name: share.name, card: share.card, caption, altText, targets }, dryRun);
      setMessage({ ok: true, text: dryRun ? 'Der Lauf erzeugt die Bilder.' : 'Der Lauf erzeugt die Bilder und veröffentlicht sie.' });
      setTimeout(() => setRefreshKey((key) => key + 1), 3000);
    } catch (error) {
      setMessage({ ok: false, text: error.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Teilen</h1>
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          Bilder für Instagram und LinkedIn erzeugen und veröffentlichen. Die Bilder entstehen im Workflow „Bild teilen“
          und sehen aus wie die Vorschau.
        </p>
      </header>

      <TokenSection token={token} onChange={changeToken} />

      <Section title="Inhalt">
        <Tabs defaultValue="ereignisse">
          <TabsList>
            <TabsTrigger value="ereignisse">Ereignisse</TabsTrigger>
            <TabsTrigger value="wort">Wort</TabsTrigger>
            <TabsTrigger value="person">Person</TabsTrigger>
            <TabsTrigger value="seite">Seite</TabsTrigger>
          </TabsList>
          <TabsContent value="ereignisse" className="pt-3"><EventPicker onSelect={select} /></TabsContent>
          <TabsContent value="wort" className="pt-3"><WordPicker onSelect={select} /></TabsContent>
          <TabsContent value="person" className="pt-3"><PersonPicker onSelect={select} /></TabsContent>
          <TabsContent value="seite" className="pt-3"><PagePicker onSelect={select} /></TabsContent>
        </Tabs>
      </Section>

      {share && (
        <>
          <Section title="Vorschau">
            <div className="flex flex-wrap items-start gap-4">
              {SHARE_FORMATS.map((format) => <Preview key={format.key} card={share.card} format={format} />)}
            </div>
          </Section>

          <Section title="Text">
            <label className="block max-w-2xl space-y-1">
              <span className="text-sm font-medium">Beitragstext</span>
              <textarea
                className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
              />
              <span className={`text-xs ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}>
                {caption.length} Zeichen; Instagram erlaubt {CAPTION_LIMITS.instagram}, LinkedIn {CAPTION_LIMITS.linkedin}.
                Die Story zeigt keinen Text.
              </span>
            </label>
            <label className="block max-w-2xl space-y-1">
              <span className="text-sm font-medium">Bildbeschreibung (LinkedIn)</span>
              <Input value={altText} onChange={(event) => setAltText(event.target.value)} />
            </label>
          </Section>

          <Section title="Ziele">
            <fieldset className="flex flex-wrap gap-4">
              <legend className="sr-only">Plattformen</legend>
              {TARGETS.map((target) => (
                <label key={target.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={targets.includes(target.key)} onChange={() => toggleTarget(target.key)} />
                  {target.label}
                </label>
              ))}
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} />
              Nur Bilder erzeugen, nichts veröffentlichen
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={submit}
                disabled={!token || sending || tooLong || (!dryRun && targets.length === 0)}
                variant={dryRun ? 'outline' : 'default'}
              >
                {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {dryRun ? 'Bilder erzeugen' : 'Veröffentlichen'}
              </Button>
              {!token && <span className="text-sm text-muted-foreground">Zuerst oben einen Token speichern.</span>}
            </div>
            {message && (
              <Alert variant={message.ok ? 'default' : 'destructive'}>
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}
          </Section>
        </>
      )}

      {token && <RunList token={token} refreshKey={refreshKey} />}
    </div>
  );
}
