// Title, description and preview image of each page, for the head of the HTML files written after the build
// (scripts/page-html.mjs) and for the preview images (scripts/og-images.mjs). Images lie in public/og/.

import { SITE_NAME } from './siteConfig.js';

export { SITE_NAME };

export const DEFAULT_DESCRIPTION =
  'Wie oft wurde ein Wort im Deutschen Bundestag gesagt? Jedes Wort aus den Plenarprotokollen seit 1949, ' +
  'Sitzung für Sitzung, mit seinem ersten Vorkommen.';

// path: route without the base path; image: file name in public/og/ without extension;
// heading and caption: the text on the image.
export const PAGES = [
  {
    path: '/',
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    image: 'start',
    heading: 'Wie oft sagt der Bundestag\u00a0…?',
    caption: 'Jedes Wort aus den Plenarprotokollen seit 1949',
  },
  {
    path: '/neu',
    title: 'Neu im Bundestag',
    description: 'Wörter, die in den Sitzungen der letzten 90 Tage zum ersten Mal seit 1949 in einem ' +
      'Plenarprotokoll vorkamen, mit der Person, die sie gesagt hat.',
    image: 'neu',
    heading: 'Neu im Bundestag',
    caption: 'Wörter, die zum ersten Mal seit 1949 gesagt wurden',
  },
  {
    path: '/personen',
    title: 'Neue Wörter nach Personen',
    description: 'Rangliste der Personen nach der Zahl der Wörter, die sie als erste im Bundestag gesagt haben.',
    image: 'personen',
    heading: 'Neue Wörter nach Personen',
    caption: 'Wer hat ein Wort als erste Person im Bundestag gesagt?',
  },
  {
    path: '/statistik',
    title: 'Statistik',
    description: 'Auswertungen über alle Wörter aus den Plenarprotokollen seit 1949: Wiederkehrer, ' +
      'Einmalwörter und typische Wörter der Fraktionen.',
    image: 'statistik',
    heading: 'Statistik',
    caption: 'Wiederkehrer, Einmalwörter und typische Wörter der Fraktionen',
  },
  {
    path: '/vergleich',
    title: 'Wortvergleich',
    description: 'Die Häufigkeit mehrerer Wörter in den Plenarprotokollen des Bundestages seit 1949 vergleichen.',
    image: 'vergleich',
    heading: 'Wortvergleich',
    caption: 'Mehrere Wörter im Bundestag seit 1949 im Vergleich',
  },
  {
    path: '/faq',
    title: 'Häufige Fragen',
    description: 'Fragen und Antworten zur Zählung der Wörter in den Plenarprotokollen des Bundestages.',
    image: 'faq',
    heading: 'Häufige Fragen',
    caption: 'Wie die Wörter in den Plenarprotokollen gezählt werden',
  },
  {
    path: '/about',
    title: 'Über das Projekt',
    description: 'Herkunft der Daten, Zählregeln und Quellcode von Bundestag Wortschatz.',
    image: 'about',
    heading: 'Über das Projekt',
    caption: 'Daten, Zählregeln und Quellcode',
  },
  {
    path: '/impressum',
    title: 'Impressum',
    description: 'Impressum von Bundestag Wortschatz.',
    image: 'start',
  },
  {
    path: '/datenschutz',
    title: 'Datenschutz',
    description: 'Datenschutzerklärung von Bundestag Wortschatz.',
    image: 'start',
  },
];

// Formats of the share images; each image name in og/ exists in every format, with the suffix before .png.
// The link format is also the preview image of the page (og:image) and fits LinkedIn.
export const SHARE_FORMATS = [
  { key: 'link', suffix: '', width: 1200, height: 630, label: 'LinkedIn und Link-Vorschau' },
  { key: 'post', suffix: '-post', width: 1080, height: 1350, label: 'Instagram-Post' },
  { key: 'story', suffix: '-story', width: 1080, height: 1920, label: 'Instagram-Story' },
];

// Images for pages that exist once per word or person; they are written from the data after each build.
export const TEMPLATE_IMAGES = [
  {
    image: 'wort',
    heading: 'Ein Wort im Bundestag',
    caption: 'Wie oft es gesagt wurde, Sitzung für Sitzung seit 1949',
  },
  {
    image: 'person',
    heading: 'Zuerst gesagt',
    caption: 'Wörter, die eine Person als erste im Bundestag gesagt hat',
  },
];

function formatCount(count, singular, plural) {
  return count === 1 ? `ein ${singular}` : `${count.toLocaleString('de-DE')} ${plural}`;
}

function formatDate(isoDate) {
  const [year, month, day] = String(isoDate ?? '').split('-');
  return day ? `${Number(day)}.${Number(month)}.${year}` : '';
}

// Name of the preview image of a word below og/wort/: the folded spelling for readability and a hash of the exact
// spelling, so that words differing only in case or umlauts get their own image.
export function wordImageName(lemma) {
  let hash = 0x811c9dc5;
  for (const character of lemma) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const folded = lemma.toLowerCase().replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${folded || 'wort'}-${hash.toString(36)}`;
}

function speakerOf(first) {
  if (!first?.name) return '';
  const group = first.fraktion || first.rolle;
  return group ? `${first.name} (${group})` : first.name;
}

// card: the content of the page's own preview image (scripts/og-images.mjs); fallbackImage: the image used when
// the own one has not been rendered.
export function wordPage(word) {
  const protocol = word.protokoll?.nummer ? ` in der Sitzung ${word.protokoll.nummer}` : '';
  const speaker = word.erste?.name ? ` von ${word.erste.name}` : '';
  const date = formatDate(word.protokoll?.datum);
  const count = Number(word.anzahl) || 0;
  const details = [
    speakerOf(word.erste) && `von ${speakerOf(word.erste)}${word.erste?.zwischenruf ? ', als Zwischenruf' : ''}`,
    count > 1 ? `seitdem ${count.toLocaleString('de-DE')}-mal gesagt` : '',
  ].filter(Boolean);
  return {
    path: `/wort/${encodeURIComponent(word.lemma)}`,
    title: `„${word.lemma}“ im Bundestag`,
    description: `„${word.lemma}“ wurde${protocol}${speaker} zum ersten Mal im Bundestag gesagt. ` +
      'Häufigkeit und erstes Vorkommen in den Plenarprotokollen seit 1949.',
    image: `wort/${wordImageName(word.lemma)}`,
    fallbackImage: 'wort',
    card: {
      label: 'Neu im Bundestag',
      heading: word.lemma,
      caption: date
        ? `Zum ersten Mal gesagt am ${date}${word.protokoll?.nummer ? ` in der Sitzung ${word.protokoll.nummer}` : ''}`
        : 'Zum ersten Mal im Bundestag gesagt',
      details,
      motif: 'neu',
      chartLabel: '1949 bis heute',
    },
  };
}

// Counts per electoral term from 1 to the last one with words, for the bars on a person's image.
function countsPerTerm(terms) {
  const numbers = Object.keys(terms ?? {}).map(Number).filter((term) => term > 0);
  if (!numbers.length) return [];
  const first = Math.min(...numbers);
  const last = Math.max(...numbers);
  const values = [];
  for (let term = first; term <= last; term += 1) values.push(Number(terms[term]?.[0]) || 0);
  return values;
}

function termRange(terms) {
  const numbers = Object.keys(terms ?? {}).map(Number).filter((term) => term > 0).sort((a, b) => a - b);
  if (!numbers.length) return '';
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  return first === last ? `${first}. Wahlperiode` : `${first}. bis ${last}. Wahlperiode`;
}

export function personPage(person) {
  const count = Number(person.anzahl) || 0;
  const words = formatCount(count, 'Wort', 'Wörter');
  const interjections = Number(person.zwischenrufe) || 0;
  const bars = countsPerTerm(person.wahlperioden);
  return {
    path: `/person/${encodeURIComponent(person.id)}`,
    title: person.name,
    description: `${person.name} hat ${words} als erste Person im Bundestag gesagt.`,
    image: `person/${person.id}`,
    fallbackImage: 'person',
    card: {
      label: 'Zuerst gesagt',
      heading: person.name,
      caption: `hat ${words} als erste Person im Bundestag gesagt`,
      details: [
        person.zuordnung,
        [termRange(person.wahlperioden),
          interjections ? `darunter ${formatCount(interjections, 'Zwischenruf', 'Zwischenrufe')}` : '']
          .filter(Boolean).join(', '),
      ].filter(Boolean),
      motif: bars.length > 1 ? bars : 'person',
      chartLabel: bars.length > 1 ? 'Wörter je Wahlperiode' : '',
    },
  };
}

export function pageTitle(title) {
  return title === SITE_NAME ? SITE_NAME : `${title} · ${SITE_NAME}`;
}

// The browser title of a route; a person page sets its own once the name is loaded.
export function documentTitle(pathname) {
  const route = pathname.replace(/(.)\/$/, '$1');
  const word = route.match(/^\/wort\/([^/]+)$/);
  if (word) {
    try {
      return pageTitle(`„${decodeURIComponent(word[1])}“ im Bundestag`);
    } catch {
      return SITE_NAME;
    }
  }
  const page = PAGES.find((candidate) => candidate.path === route);
  return page ? pageTitle(page.title) : SITE_NAME;
}
