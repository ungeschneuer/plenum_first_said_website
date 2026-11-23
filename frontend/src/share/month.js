// A monthly review as a series of slides (an Instagram carousel or a LinkedIn post with several images), from one
// month of monate.json (pipeline/month_highlights.py) and the protocol list.

import { SITE_URL } from '../siteConfig.js';

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober',
  'November', 'Dezember'];
const ITEMS_PER_SLIDE = 5;
const DAYS_PER_YEAR = 365.25;

export function monthName(month) {
  return `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

function number(value) {
  return value.toLocaleString('de-DE');
}

function formatDate(isoDate) {
  const [year, month, day] = String(isoDate ?? '').split('-');
  return day ? `${Number(day)}.${Number(month)}.${year}` : '';
}

// dative: "mit 120.000 Wörtern"
function wordCount(words, dative = false) {
  const noun = dative ? 'Wörtern' : 'Wörter';
  if (words >= 1_000_000) {
    return `${(words / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. ${noun}`;
  }
  return `${number(words)} ${noun}`;
}

function speakerText(speaker) {
  if (!speaker) return '';
  return speaker[1] ? `${speaker[0]} (${speaker[1]})` : speaker[0];
}

function years(protocols, before, after) {
  return Math.floor((Date.parse(protocols[after].datum) - Date.parse(protocols[before].datum)) / (DAYS_PER_YEAR * 86400000));
}

// Every slide has a key, a title for the list in the tool and the card (src/share/card.js).
export function monthSlides(month, protocols) {
  const name = monthName(month.monat);
  const slides = [];
  const longest = protocols[month.laengste_sitzung];
  const sessions = protocols
    .map((protocol, index) => ({ protocol, index }))
    .filter(({ protocol }) => protocol.datum.startsWith(month.monat) && !protocol.gemeinsam_mit);
  slides.push({
    key: 'titel',
    title: 'Titel',
    card: {
      label: 'Monatsrückblick',
      heading: `${name} im Bundestag`,
      caption: `${number(month.sitzungen)} ${month.sitzungen === 1 ? 'Sitzung' : 'Sitzungen'}, ${wordCount(month.woerter)}`,
      details: longest ? [`Längste Sitzung: ${longest.nummer} am ${formatDate(longest.datum)} mit ${wordCount(longest.woerter, true)}`] : [],
      motif: sessions.length > 1 ? sessions.map(({ protocol }) => protocol.woerter) : null,
      highlight: sessions.findIndex(({ index }) => index === month.laengste_sitzung),
      chartLabel: sessions.length > 1 ? 'Wörter je Sitzung' : '',
    },
  });

  const newWords = month.neue_woerter;
  if (newWords.anzahl > 0) {
    slides.push({
      key: 'neu',
      title: 'Neue Wörter',
      card: {
        label: 'Neu im Bundestag',
        heading: `${number(newWords.anzahl)} neue ${newWords.anzahl === 1 ? 'Wort' : 'Wörter'}`,
        caption: 'zum ersten Mal seit 1949 in einem Plenarprotokoll',
        items: newWords.beispiele.slice(0, ITEMS_PER_SLIDE).map(([lemma, , , speaker]) => ({
          text: lemma, value: speakerText(speaker),
        })),
        motif: null,
      },
    });
  }

  if (month.erste_personen.length) {
    slides.push({
      key: 'personen',
      title: 'Wer neue Wörter sagte',
      card: {
        label: 'Zuerst gesagt',
        heading: 'Wer neue Wörter sagte',
        caption: 'Personen mit den meisten Wörtern, die sie als erste gesagt haben',
        items: month.erste_personen.slice(0, ITEMS_PER_SLIDE).map(([person, group, count]) => ({
          text: group ? `${person} (${group})` : person, value: `${number(count)} ${count === 1 ? 'Wort' : 'Wörter'}`,
        })),
        motif: null,
      },
    });
  }

  if (month.wiederkehrer.length) {
    slides.push({
      key: 'wieder',
      title: 'Wieder im Bundestag',
      card: {
        label: 'Wieder im Bundestag',
        heading: 'Nach langer Pause wieder gesagt',
        caption: 'Wörter, die mindestens zehn Jahre in keiner Sitzung vorkamen',
        items: month.wiederkehrer.slice(0, ITEMS_PER_SLIDE).map(([lemma, before, again]) => ({
          text: lemma, value: `nach ${number(years(protocols, before, again))} Jahren`,
        })),
        motif: null,
      },
    });
  }

  if (month.jubilaeen.length) {
    slides.push({
      key: 'jubilaeen',
      title: 'Runde Zahlen',
      card: {
        label: 'Runde Zahlen',
        heading: 'Zum 100., 1.000. oder 10.000. Mal',
        caption: 'Wörter, die in diesem Monat eine runde Zahl an Nennungen erreichten',
        items: month.jubilaeen.slice(0, ITEMS_PER_SLIDE).map(([lemma, mark, , first]) => ({
          text: lemma, value: `zum ${number(mark)}. Mal, zuerst ${protocols[first].datum.slice(0, 4)}`,
        })),
        motif: null,
      },
    });
  }

  if (month.trend.length) {
    slides.push({
      key: 'trend',
      title: 'Im Aufwind',
      card: {
        label: 'Trend',
        heading: 'Im Aufwind',
        caption: 'Häufiger als in den zwölf Monaten davor, gemessen an allen gesagten Wörtern',
        items: month.trend.slice(0, ITEMS_PER_SLIDE).map(([lemma, count, ratio]) => ({
          text: lemma, value: `${ratio.toLocaleString('de-DE')}-mal so oft, ${number(count)} Nennungen`,
        })),
        motif: null,
      },
    });
  }

  if (month.haeufigste.length) {
    slides.push({
      key: 'haeufigste',
      title: 'Am häufigsten gesagt',
      card: {
        label: 'Am häufigsten',
        heading: 'Am häufigsten gesagt',
        caption: 'ohne Namen und die häufigsten Wörter aller Sitzungen seit 1949',
        items: month.haeufigste.slice(0, ITEMS_PER_SLIDE).map(([lemma, count]) => ({ text: lemma, value: `${number(count)}-mal` })),
        motif: null,
      },
    });
  }
  return slides;
}

export function monthCaption(month) {
  const parts = [`Der Bundestag im ${monthName(month.monat)}: ${number(month.sitzungen)} ` +
    `${month.sitzungen === 1 ? 'Sitzung' : 'Sitzungen'}, ${wordCount(month.woerter)}.`];
  if (month.neue_woerter.anzahl) {
    const examples = month.neue_woerter.beispiele.slice(0, 3).map(([lemma]) => `„${lemma}“`);
    parts.push(`${number(month.neue_woerter.anzahl)} Wörter kamen zum ersten Mal vor${examples.length ? `, darunter ${examples.join(', ')}` : ''}.`);
  }
  if (month.wiederkehrer.length) parts.push(`„${month.wiederkehrer[0][0]}“ wurde nach langer Pause wieder gesagt.`);
  if (month.trend.length) parts.push(`Deutlich häufiger als im Jahr davor: „${month.trend[0][0]}“.`);
  return `${parts.join(' ')}\n\nAlle Zahlen: ${SITE_URL}\n\n#Bundestag #Sprache #OpenData #Monatsrückblick`;
}
