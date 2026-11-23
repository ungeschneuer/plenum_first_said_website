// Local share tool (npm run teilen): single slides and monthly reviews for Instagram and LinkedIn. Reads the
// published data; renders and posts through the local server (tools/teilen/server.mjs).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '../../src/components/ui/button';
import { Input } from '../../src/components/ui/input';
import { Alert, AlertDescription } from '../../src/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../src/components/ui/tabs';
import { SHARE_FORMATS } from '../../src/pageMeta';
import { fitOptions, fitText } from '../../src/share/card';
import {
  CAPTION_LIMITS, SHAREABLE_PAGES, newWordShare, pageShare, personShare, returnShare, wordShare,
} from '../../src/share/content';
import { monthCaption, monthName, monthSlides } from '../../src/share/month';
import {
  getMonths, getPersons, getProtocols, getRecentlyFirstSaid, getStatistics, getWordDetails, getWordTimeline,
} from '../../src/utils/staticData';
import { formatGermanDate } from '../../src/utils/german';
import { previewHtml } from './browserCard';

const PREVIEW_WIDTH = 260;
const SINGLE_TARGETS = [
  { key: 'instagram-post', label: 'Instagram-Post', platform: 'instagram' },
  { key: 'instagram-story', label: 'Instagram-Story', platform: 'instagram' },
  { key: 'linkedin', label: 'LinkedIn', platform: 'linkedin' },
];
const SERIES_TARGETS = [
  { key: 'instagram-carousel', label: 'Instagram-Karussell', platform: 'instagram' },
  { key: 'linkedin-carousel', label: 'LinkedIn mit mehreren Bildern', platform: 'linkedin' },
];
const FORMAT_OF = { 'instagram-post': 'post', 'instagram-story': 'story', linkedin: 'link', 'instagram-carousel': 'post', 'linkedin-carousel': 'post' };

async function api(path, body) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
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
function Preview({ card, format, width = PREVIEW_WIDTH }) {
  const frame = useRef(null);
  const html = useMemo(() => previewHtml(card, format.key), [card, format.key]);
  const scale = width / format.width;

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
        style={{ width, height: format.height * scale }}
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

function MonthPicker({ onSelect }) {
  const [state, setState] = useState({ months: null, protocols: null, error: null });
  useEffect(() => {
    Promise.all([getMonths(), getProtocols()])
      .then(([data, protocols]) => setState({ months: data.monate, protocols, error: null }))
      .catch((error) => setState({ months: [], protocols: null, error: `monate.json fehlt oder ist nicht lesbar (${error.message}).` }));
  }, []);
  if (state.error) return <p className="text-sm text-destructive">{state.error}</p>;
  if (!state.months) return <p className="text-sm text-muted-foreground">Monate werden geladen …</p>;
  return (
    <ul className="flex max-w-3xl flex-wrap gap-2">
      {state.months.map((month) => (
        <li key={month.monat}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect({
              name: `monat-${month.monat}`,
              title: `Monatsrückblick ${monthName(month.monat)}`,
              slides: monthSlides(month, state.protocols),
              caption: monthCaption(month),
            })}
          >
            {monthName(month.monat)}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function SlideList({ slides, chosen, onToggle, format }) {
  return (
    <ul className="flex flex-wrap items-start gap-4">
      {slides.map((slide, index) => (
        <li key={slide.key} className="space-y-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={chosen.includes(slide.key)} onChange={() => onToggle(slide.key)} />
            {index + 1}. {slide.title}
          </label>
          <div className={chosen.includes(slide.key) ? '' : 'opacity-40'}>
            <Preview card={slide.card} format={format} width={200} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Targets({ targets, chosen, onToggle, config }) {
  return (
    <fieldset className="flex flex-wrap gap-4">
      <legend className="sr-only">Plattformen</legend>
      {targets.map((target) => (
        <label key={target.key} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={chosen.includes(target.key)} onChange={() => onToggle(target.key)} />
          {target.label}
          {config && !config[target.platform] && <span className="text-xs text-muted-foreground">(nicht eingerichtet)</span>}
        </label>
      ))}
    </fieldset>
  );
}

function Results({ outcome }) {
  if (!outcome) return null;
  return (
    <div className="space-y-2">
      {outcome.error && <Alert variant="destructive"><AlertDescription>{outcome.error}</AlertDescription></Alert>}
      {outcome.folder && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FolderOpen className="h-4 w-4" aria-hidden="true" /> Gespeichert in {outcome.folder}
        </p>
      )}
      {outcome.results?.map((result) => (
        <p key={result.target} className={`text-sm ${result.ok ? '' : 'text-destructive'}`}>{result.target}: {result.text}</p>
      ))}
      {outcome.files && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {outcome.files.map((file) => (
            <li key={file.url}><a href={file.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{file.url.split('/').pop()}</a></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [mode, setMode] = useState('einzeln');
  const [share, setShare] = useState(null);
  const [series, setSeries] = useState(null);
  const [chosenSlides, setChosenSlides] = useState([]);
  const [caption, setCaption] = useState('');
  const [altText, setAltText] = useState('');
  const [targets, setTargets] = useState(['instagram-post', 'linkedin']);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);

  useEffect(() => {
    api('/api/config').then(setConfig).catch(() => setConfig({ instagram: false, linkedin: false }));
  }, []);

  const selectSingle = (next) => {
    setShare(next);
    setCaption(next.caption);
    setAltText(`${next.title}: Grafik von Bundestag Wortschatz`);
    setOutcome(null);
  };
  const selectSeries = (next) => {
    setSeries(next);
    setChosenSlides(next.slides.map((slide) => slide.key));
    setCaption(next.caption);
    setOutcome(null);
  };
  const switchMode = (next) => {
    setMode(next);
    setTargets(next === 'einzeln' ? ['instagram-post', 'linkedin'] : ['instagram-carousel', 'linkedin-carousel']);
    setOutcome(null);
    const current = next === 'einzeln' ? share : series;
    if (current) setCaption(current.caption);
  };
  const toggle = (setter) => (key) => setter((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));

  const request = useMemo(() => {
    if (mode === 'einzeln') {
      return share && { name: share.name, slides: [share.card], altTexts: [altText] };
    }
    if (!series) return null;
    const slides = series.slides.filter((slide) => chosenSlides.includes(slide.key));
    return { name: series.name, slides: slides.map((slide) => slide.card), altTexts: slides.map((slide) => `${series.title}: ${slide.title}`) };
  }, [mode, share, series, chosenSlides, altText]);

  const tooLong = targets.some((key) => caption.length > CAPTION_LIMITS[key.startsWith('instagram') ? 'instagram' : 'linkedin']);
  const tooMany = mode === 'monat' && request && (request.slides.length < 2 || request.slides.length > 10);

  const save = async () => {
    setBusy(true);
    setOutcome(null);
    try {
      const formats = [...new Set(targets.map((key) => FORMAT_OF[key]))];
      setOutcome(await api('/api/render', { ...request, formats: formats.length ? formats : ['post'] }));
    } catch (error) {
      setOutcome({ error: error.message });
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    const labels = [...SINGLE_TARGETS, ...SERIES_TARGETS].filter((target) => targets.includes(target.key)).map((target) => target.label);
    if (!window.confirm(`Jetzt veröffentlichen: ${labels.join(', ')}?`)) return;
    setBusy(true);
    setOutcome(null);
    try {
      setOutcome(await api('/api/publish', { ...request, caption, targets }));
    } catch (error) {
      setOutcome({ error: error.message });
    } finally {
      setBusy(false);
    }
  };

  const ready = Boolean(request?.slides.length);
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Teilen</h1>
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          Lokales Werkzeug für Instagram und LinkedIn. Es liest die veröffentlichten Daten der Seite, speichert die Bilder
          im Ordner teilen-ausgabe und veröffentlicht mit den Zugangsdaten aus frontend/.env.teilen.
        </p>
        {config && (
          <p className="text-sm text-muted-foreground">
            Instagram {config.instagram ? 'eingerichtet' : 'nicht eingerichtet'}, LinkedIn {config.linkedin ? 'eingerichtet' : 'nicht eingerichtet'}.
          </p>
        )}
      </header>

      <Tabs value={mode} onValueChange={switchMode}>
        <TabsList>
          <TabsTrigger value="einzeln">Einzelnes Bild</TabsTrigger>
          <TabsTrigger value="monat">Monatsrückblick</TabsTrigger>
        </TabsList>

        <TabsContent value="einzeln" className="space-y-10 pt-6">
          <Section title="Inhalt">
            <Tabs defaultValue="ereignisse">
              <TabsList>
                <TabsTrigger value="ereignisse">Ereignisse</TabsTrigger>
                <TabsTrigger value="wort">Wort</TabsTrigger>
                <TabsTrigger value="person">Person</TabsTrigger>
                <TabsTrigger value="seite">Seite</TabsTrigger>
              </TabsList>
              <TabsContent value="ereignisse" className="pt-3"><EventPicker onSelect={selectSingle} /></TabsContent>
              <TabsContent value="wort" className="pt-3"><WordPicker onSelect={selectSingle} /></TabsContent>
              <TabsContent value="person" className="pt-3"><PersonPicker onSelect={selectSingle} /></TabsContent>
              <TabsContent value="seite" className="pt-3"><PagePicker onSelect={selectSingle} /></TabsContent>
            </Tabs>
          </Section>
          {share && (
            <Section title="Vorschau">
              <div className="flex flex-wrap items-start gap-4">
                {SHARE_FORMATS.map((format) => <Preview key={format.key} card={share.card} format={format} />)}
              </div>
            </Section>
          )}
        </TabsContent>

        <TabsContent value="monat" className="space-y-10 pt-6">
          <Section title="Monat">
            <MonthPicker onSelect={selectSeries} />
          </Section>
          {series && (
            <Section title={`Bilder: ${series.title}`}>
              <p className="text-sm text-muted-foreground">
                Ein Karussell hat zwei bis zehn Bilder im Format 1080 × 1350; abgewählte Bilder werden nicht veröffentlicht.
              </p>
              <SlideList
                slides={series.slides}
                chosen={chosenSlides}
                onToggle={toggle(setChosenSlides)}
                format={SHARE_FORMATS.find((format) => format.key === 'post')}
              />
            </Section>
          )}
        </TabsContent>
      </Tabs>

      {ready && (
        <>
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
              </span>
            </label>
            {mode === 'einzeln' && (
              <label className="block max-w-2xl space-y-1">
                <span className="text-sm font-medium">Bildbeschreibung (LinkedIn)</span>
                <Input value={altText} onChange={(event) => setAltText(event.target.value)} />
              </label>
            )}
          </Section>

          <Section title="Ziele">
            <Targets targets={mode === 'einzeln' ? SINGLE_TARGETS : SERIES_TARGETS} chosen={targets} onToggle={toggle(setTargets)} config={config} />
            {tooMany && <p className="text-sm text-destructive">Bitte zwei bis zehn Bilder auswählen.</p>}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={save} disabled={busy || tooMany}>
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Bilder speichern
              </Button>
              <Button type="button" onClick={publish} disabled={busy || tooLong || tooMany || targets.length === 0}>
                Veröffentlichen
              </Button>
            </div>
            <Results outcome={outcome} />
          </Section>
        </>
      )}
    </div>
  );
}
