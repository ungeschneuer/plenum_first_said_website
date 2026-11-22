import { describe, expect, it } from 'vitest';
import { countsPerYear, newWordShare, pageShare, personShare, returnShare, SHAREABLE_PAGES, wordShare } from './content.js';

const details = {
  word: 'Klimageld', wahlperiode: 21, protokollnummer: '49', first_date: '2026-11-12', total_count: 3,
  first_speaker: { name: 'Max Muster', fraktion: 'AfD', zwischenruf: false },
};

describe('share content', () => {
  it('sums counts per year from the first year with the word', () => {
    expect(countsPerYear([
      { date: '1999-01-01', count: 0 }, { date: '2000-03-01', count: 2 }, { date: '2000-05-01', count: 1 },
      { date: '2002-01-01', count: 4 },
    ])).toEqual({ values: [3, 0, 4], first: 2000, last: 2002 });
  });

  it('labels a recent word as new and an old one by its first occurrence', () => {
    const recent = wordShare(details, [{ date: '2026-11-12', count: 3 }], '2026-11-22');
    expect(recent.card.label).toBe('Neu im Bundestag');
    expect(recent.name).toMatch(/^wort-klimageld-/);
    expect(recent.caption).toContain('„Klimageld“ wurde am 12.11.2026 von Max Muster zum ersten Mal im Bundestag gesagt.');
    expect(recent.url).toBe('https://ungeschneuer.github.io/plenum_first_said_website/wort/Klimageld/');
    const old = wordShare({ ...details, first_date: '1990-01-01' },
      [{ date: '1990-01-01', count: 1 }, { date: '2026-01-01', count: 2 }], '2026-11-22');
    expect(old.card.label).toBe('Erstes Vorkommen');
    expect(old.card.details).toContain('insgesamt 3-mal gesagt');
    expect(old.card.motif).toHaveLength(37);
  });

  it('shares persons and pages', () => {
    const person = personShare({ id: 'a-b', name: 'A B', anzahl: 2, wahlperioden: {} });
    expect(person.name).toBe('person-a-b');
    expect(person.caption).toContain('/person/a-b/');
    const start = pageShare(SHAREABLE_PAGES[0]);
    expect(start.name).toBe('seite-start');
    expect(start.url).toBe('https://ungeschneuer.github.io/plenum_first_said_website/');
  });

  it('names the session with its electoral term', () => {
    expect(wordShare(details, [], '2026-11-22').card.caption).toBe('Zum ersten Mal gesagt am 12.11.2026 in der Sitzung 21/49');
  });

  it('describes a word said again after a long pause', () => {
    const protocols = [
      { datum: '1992-05-03', nummer: '12/89' },
      { datum: '2026-11-12', nummer: '21/49' },
    ];
    const share = returnShare({ lemma: 'Rinderwahn', vorher: 0, wieder: 1, anzahl_vorher: 14, anzahl_nachher: 1 }, protocols,
      [{ date: '1990-01-01', count: 10 }, { date: '1992-05-03', count: 4 }, { date: '2026-11-12', count: 1 }]);
    expect(share.card.label).toBe('Wieder im Bundestag');
    expect(share.card.caption).toBe('Nach 34 Jahren wieder gesagt am 12.11.2026 in der Sitzung 21/49');
    expect(share.card.details).toEqual([
      'Davor zuletzt am 3.5.1992 in der Sitzung 12/89',
      'Vor der Pause 14-mal gesagt, seitdem einmal',
    ]);
    expect(share.card.motif).toHaveLength(37);
    expect(share.card.highlight).toBe(36);
    expect(share.name).toMatch(/^wieder-rinderwahn-/);
    expect(share.caption).toContain('zum ersten Mal seit 34 Jahren wieder im Bundestag gesagt');
  });

  it('shares a new word from the list of new words', () => {
    const share = newWordShare({ lemma: 'Klimageld', protokoll: { nummer: '21/49', datum: '2026-11-12' }, anzahl: 1,
      erste: { name: 'Max Muster', fraktion: 'AfD' } });
    expect(share.card.label).toBe('Neu im Bundestag');
    expect(share.caption).toContain('von Max Muster zum ersten Mal im Bundestag gesagt');
  });
});
