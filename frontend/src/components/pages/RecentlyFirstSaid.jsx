import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRecentlyFirstSaid } from '../../utils/staticData';
import { formatLongDate, formatNumber } from '../../utils/german';
import { BOT_ACCOUNT } from '../../siteConfig';
import { speakerOf } from '../../utils/speaker';
import { Skeleton } from '../ui/skeleton';

const INITIALLY_SHOWN_SESSIONS = 5;

function groupBySession(words) {
  const sessions = new Map();
  for (const word of words) {
    const key = word.protokoll.nummer;
    if (!sessions.has(key)) sessions.set(key, { protocol: word.protokoll, words: [] });
    sessions.get(key).words.push(word);
  }
  return [...sessions.values()];
}

function Session({ session }) {
  const [wahlperiode, number] = session.protocol.nummer.split('/');
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">
        {Number(number)}. Sitzung der {Number(wahlperiode)}. Wahlperiode, {formatLongDate(session.protocol.datum)}
      </h2>
      <p className="text-sm text-muted-foreground">
        {formatNumber(session.words.length)} Wörter zum ersten Mal.{' '}
        <a href={session.protocol.pdf} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          Protokoll als PDF
        </a>
      </p>
      <ul className="space-y-3 break-words [hyphens:auto]">
        {session.words.map((word) => (
          <li key={word.lemma}>
            <Link to={`/wort/${encodeURIComponent(word.lemma)}`} className="font-semibold underline underline-offset-2">
              {word.lemma}
            </Link>
            {speakerOf(word) && <span className="text-muted-foreground">, {speakerOf(word)}</span>}
            {word.beleg && <p className="mt-1 text-sm italic leading-relaxed">„{word.beleg}“</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function RecentlyFirstSaid() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    getRecentlyFirstSaid()
      .then((words) => setSessions(groupBySession(words)))
      .catch((loadError) => setError(loadError.message));
  }, []);

  const shownSessions = sessions && (showAll ? sessions : sessions.slice(0, INITIALLY_SHOWN_SESSIONS));
  return (
    <article className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold sm:text-4xl">Neu im Bundestag</h1>
        <p className="leading-relaxed">
          Diese Wörter kamen in den Sitzungen der letzten 90 Tage zum ersten Mal seit 1949 in einem Plenarprotokoll
          vor. Gezählt werden Grundformen; eine neue Beugung eines bekannten Wortes zählt nicht. Viele sind
          Zusammensetzungen, manche Zitate in anderen Sprachen. Eine Auswahl postet{' '}
          <a href={BOT_ACCOUNT.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {BOT_ACCOUNT.name}
          </a>{' '}
          auf Mastodon.
        </p>
      </header>
      {error && <p role="alert">{error}</p>}
      {!sessions && !error && <Skeleton className="h-64 w-full" />}
      {shownSessions?.map((session) => (
        <Session key={session.protocol.nummer} session={session} />
      ))}
      {sessions && !showAll && sessions.length > INITIALLY_SHOWN_SESSIONS && (
        <button type="button" className="underline underline-offset-2" onClick={() => setShowAll(true)}>
          Ältere Sitzungen zeigen ({formatNumber(sessions.length - INITIALLY_SHOWN_SESSIONS)})
        </button>
      )}
    </article>
  );
}
