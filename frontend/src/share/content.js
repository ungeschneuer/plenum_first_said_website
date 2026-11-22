// What the admin view shares: the content of the image (card, see src/share/card.js), the address of the page and a
// suggested text for the post. Built from the data the pages show.

import { PAGES, personPage, wordImageName, wordPage } from '../pageMeta.js';
import { SITE_URL } from '../siteConfig.js';

const NEW_WORD_DAYS = 90;
// Instagram allows 2,200 characters in a caption, LinkedIn 3,000 in a post.
export const CAPTION_LIMITS = { instagram: 2200, linkedin: 3000 };

function pageAddress(path) {
  return SITE_URL + path.replace(/^\//, '').replace(/([^/])$/, '$1/');
}

function formatDate(isoDate) {
  const [year, month, day] = String(isoDate ?? '').split('-');
  return day ? `${Number(day)}.${Number(month)}.${year}` : '';
}

// Counts per calendar year from the first year with the word to the last protocol, for the bars of a word.
export function countsPerYear(timeline) {
  const byYear = new Map();
  for (const point of timeline) {
    const year = Number(String(point.date).slice(0, 4));
    if (year) byYear.set(year, (byYear.get(year) ?? 0) + point.count);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const first = years.find((year) => byYear.get(year) > 0);
  if (first === undefined) return { values: [], first: null, last: null };
  const last = years[years.length - 1];
  const values = [];
  for (let year = first; year <= last; year += 1) values.push(byYear.get(year) ?? 0);
  return { values, first, last };
}

// details: result of getWordDetails, timeline: result of getWordTimeline; today: ISO date.
export function wordShare(details, timeline, today) {
  const word = {
    lemma: details.word,
    // getWordDetails gives the session number without the electoral term.
    protokoll: { nummer: `${details.wahlperiode}/${details.protokollnummer}`, datum: details.first_date },
    anzahl: details.total_count,
    erste: details.first_speaker,
  };
  const page = wordPage(word);
  const ageInDays = (Date.parse(today) - Date.parse(details.first_date)) / 86400000;
  const isNew = ageInDays >= 0 && ageInDays <= NEW_WORD_DAYS;
  const years = countsPerYear(timeline);
  const card = {
    ...page.card,
    label: isNew ? 'Neu im Bundestag' : 'Erstes Vorkommen',
    details: page.card.details.map((line) => (isNew ? line : line.replace(/^seitdem /, 'insgesamt '))),
  };
  if (years.values.length > 1) {
    card.motif = years.values;
    card.chartLabel = `Häufigkeit je Jahr, ${years.first} bis ${years.last}`;
  }
  const url = pageAddress(page.path);
  const speaker = details.first_speaker?.name ? ` von ${details.first_speaker.name}` : '';
  const first = `„${details.word}“ wurde am ${formatDate(details.first_date)}${speaker} zum ersten Mal im Bundestag gesagt.`;
  const count = details.total_count > 1
    ? ` Seitdem kam es ${details.total_count.toLocaleString('de-DE')}-mal in den Plenarprotokollen vor.`
    : '';
  return {
    name: page.image.replace(/^wort\//, 'wort-'),
    title: details.word,
    card,
    url,
    caption: `${first}${count}\n\nVerlauf seit 1949: ${url}\n\n#Bundestag #Sprache #OpenData`,
  };
}

// person: an entry of personen.json.
export function personShare(person) {
  const page = personPage(person);
  const url = pageAddress(page.path);
  return {
    name: `person-${person.id}`,
    title: person.name,
    card: page.card,
    url,
    caption: `${page.description}\n\nAlle Wörter: ${url}\n\n#Bundestag #Sprache #OpenData`,
  };
}

const DAYS_PER_YEAR = 365.25;

function wholeYears(first, second) {
  return Math.floor((Date.parse(second) - Date.parse(first)) / (DAYS_PER_YEAR * 86400000));
}

function times(count) {
  return count === 1 ? 'einmal' : `${count.toLocaleString('de-DE')}-mal`;
}

// A word said again after a long pause: an entry of statistik.json (wiederkehrer), the protocol list and the word's
// timeline (getWordTimeline) for the bars.
export function returnShare(entry, protocols, timeline) {
  const before = protocols[entry.vorher];
  const again = protocols[entry.wieder];
  const years = wholeYears(before.datum, again.datum);
  const yearsText = `${years.toLocaleString('de-DE')} ${years === 1 ? 'Jahr' : 'Jahren'}`;
  const counts = countsPerYear(timeline);
  const path = `/wort/${encodeURIComponent(entry.lemma)}`;
  const url = pageAddress(path);
  const card = {
    label: 'Wieder im Bundestag',
    heading: entry.lemma,
    caption: `Nach ${yearsText} wieder gesagt am ${formatDate(again.datum)} in der Sitzung ${again.nummer}`,
    details: [
      `Davor zuletzt am ${formatDate(before.datum)} in der Sitzung ${before.nummer}`,
      `Vor der Pause ${times(entry.anzahl_vorher)} gesagt, seitdem ${times(entry.anzahl_nachher)}`,
    ],
    motif: counts.values.length > 1 ? counts.values : 'wort',
    // The year of the return is gold, not the year with the most mentions.
    highlight: counts.values.length > 1 ? Number(again.datum.slice(0, 4)) - counts.first : undefined,
    chartLabel: counts.values.length > 1 ? `Häufigkeit je Jahr, ${counts.first} bis ${counts.last}` : '',
  };
  return {
    name: `wieder-${wordImageName(entry.lemma)}`,
    title: entry.lemma,
    card,
    url,
    caption: `„${entry.lemma}“ wurde am ${formatDate(again.datum)} zum ersten Mal seit ${yearsText} wieder im ` +
      `Bundestag gesagt. Davor zuletzt am ${formatDate(before.datum)}.\n\nVerlauf seit 1949: ${url}\n\n` +
      '#Bundestag #Sprache #OpenData',
  };
}

// A word from neue-woerter.json (first said in the last 90 days).
export function newWordShare(entry) {
  const page = wordPage(entry);
  const url = pageAddress(page.path);
  const speaker = entry.erste?.name ? ` von ${entry.erste.name}` : '';
  return {
    name: page.image.replace(/^wort\//, 'wort-'),
    title: entry.lemma,
    card: page.card,
    url,
    caption: `„${entry.lemma}“ wurde am ${formatDate(entry.protokoll?.datum)}${speaker} zum ersten Mal im Bundestag ` +
      `gesagt.\n\nVerlauf seit 1949: ${url}\n\n#Bundestag #Sprache #OpenData`,
  };
}

export const SHAREABLE_PAGES = PAGES.filter((page) => page.heading);

export function pageShare(page) {
  const url = pageAddress(page.path);
  return {
    name: `seite-${page.image}`,
    title: page.title,
    card: { heading: page.heading, caption: page.caption, motif: page.image },
    url,
    caption: `${page.description}\n\n${url}\n\n#Bundestag #Sprache #OpenData`,
  };
}
