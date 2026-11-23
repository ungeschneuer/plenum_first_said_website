import { describe, expect, it } from 'vitest';
import { monthCaption, monthName, monthSlides } from './month.js';

const protocols = [
  { nummer: '12/89', datum: '1992-05-03', woerter: 50000 },
  { nummer: '21/48', datum: '2026-10-15', woerter: 80000 },
  { nummer: '21/49', datum: '2026-10-16', woerter: 120000 },
  { nummer: '21/30', datum: '2001-03-01', woerter: 1000 },
];

const month = {
  monat: '2026-10',
  sitzungen: 2,
  woerter: 200000,
  laengste_sitzung: 2,
  neue_woerter: { anzahl: 37, beispiele: [['Klimageld', 2, 12, ['Anna Beispiel', 'SPD']], ['Zollstreit', 1, 3, null]] },
  erste_personen: [['Anna Beispiel', 'SPD', 4]],
  wiederkehrer: [['Rinderwahn', 0, 2]],
  jubilaeen: [['Rentenpaket', 1000, 1, 3]],
  trend: [['Zollstreit', 40, 6.2]],
  haeufigste: [['Haushalt', 812]],
};

describe('monthly review', () => {
  it('names the month', () => {
    expect(monthName('2026-10')).toBe('Oktober 2026');
  });

  it('makes a cover and one slide per highlight', () => {
    const slides = monthSlides(month, protocols);
    expect(slides.map((slide) => slide.key)).toEqual(['titel', 'neu', 'personen', 'wieder', 'jubilaeen', 'trend', 'haeufigste']);
    const [cover, newWords, , returns, marks, trend] = slides.map((slide) => slide.card);
    expect(cover.heading).toBe('Oktober 2026 im Bundestag');
    expect(cover.caption).toBe('2 Sitzungen, 200.000 Wörter');
    expect(cover.details[0]).toBe('Längste Sitzung: 21/49 am 16.10.2026 mit 120.000 Wörtern');
    expect(cover.motif).toEqual([80000, 120000]);
    expect(cover.highlight).toBe(1);
    expect(newWords.heading).toBe('37 neue Wörter');
    expect(newWords.items[0]).toEqual({ text: 'Klimageld', value: 'Anna Beispiel (SPD)' });
    expect(returns.items[0]).toEqual({ text: 'Rinderwahn', value: 'nach 34 Jahren' });
    expect(marks.items[0]).toEqual({ text: 'Rentenpaket', value: 'zum 1.000. Mal, zuerst 2001' });
    expect(trend.items[0].value).toBe('6,2-mal so oft, 40 Nennungen');
  });

  it('leaves out empty highlights', () => {
    const quiet = { ...month, neue_woerter: { anzahl: 0, beispiele: [] }, erste_personen: [], wiederkehrer: [], jubilaeen: [], trend: [], haeufigste: [] };
    expect(monthSlides(quiet, protocols).map((slide) => slide.key)).toEqual(['titel']);
  });

  it('suggests a caption', () => {
    const caption = monthCaption(month);
    expect(caption).toContain('Der Bundestag im Oktober 2026: 2 Sitzungen, 200.000 Wörter.');
    expect(caption).toContain('37 Wörter kamen zum ersten Mal vor, darunter „Klimageld“, „Zollstreit“.');
  });
});
