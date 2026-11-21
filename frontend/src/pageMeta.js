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
    heading: 'Wie oft sagt der Bundestag …?',
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

export function wordPage(word) {
  const protocol = word.protokoll?.nummer ? ` in der Sitzung ${word.protokoll.nummer}` : '';
  const speaker = word.erste?.name ? ` von ${word.erste.name}` : '';
  return {
    path: `/wort/${encodeURIComponent(word.lemma)}`,
    title: `„${word.lemma}“ im Bundestag`,
    description: `„${word.lemma}“ wurde${protocol}${speaker} zum ersten Mal im Bundestag gesagt. ` +
      'Häufigkeit und erstes Vorkommen in den Plenarprotokollen seit 1949.',
    image: 'wort',
  };
}

export function personPage(person) {
  const count = Number(person.anzahl) || 0;
  const words = count === 1 ? 'ein Wort' : `${count.toLocaleString('de-DE')} Wörter`;
  return {
    path: `/person/${encodeURIComponent(person.id)}`,
    title: person.name,
    description: `${person.name} hat ${words} als erste Person im Bundestag gesagt.`,
    image: 'person',
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
