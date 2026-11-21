import { describe, expect, it } from 'vitest';
import { documentTitle, personPage, wordImageName, wordPage } from './pageMeta.js';

describe('pageMeta', () => {
  it('gives each route its browser title', () => {
    expect(documentTitle('/')).toBe('Bundestag Wortschatz');
    expect(documentTitle('/statistik/')).toBe('Statistik · Bundestag Wortschatz');
    expect(documentTitle('/wort/Kl%C3%BCger')).toBe('„Klüger“ im Bundestag · Bundestag Wortschatz');
    expect(documentTitle('/person/x')).toBe('Bundestag Wortschatz');
  });

  it('describes persons and new words', () => {
    expect(personPage({ id: 'a-b', name: 'A B', anzahl: 1 }).description).toBe(
      'A B hat ein Wort als erste Person im Bundestag gesagt.');
    expect(personPage({ id: 'a-b', name: 'A B', anzahl: 1200 }).description).toContain('1.200 Wörter');
    expect(wordPage({ lemma: 'Foo' }).description).toMatch(/^„Foo“ wurde zum ersten Mal/);
  });

  it('names word images by folded spelling and a hash of the exact spelling', () => {
    expect(wordImageName('Grüne')).toMatch(/^gruene-[0-9a-z]+$/);
    expect(wordImageName('Grüne')).not.toBe(wordImageName('grüne'));
    expect(wordImageName('§')).toMatch(/^wort-[0-9a-z]+$/);
  });

  it('draws a person with the words per electoral term', () => {
    const card = personPage({ id: 'a', name: 'A', anzahl: 5, wahlperioden: { 19: [2, 0, 'x'], 21: [3, 0, 'x'] } }).card;
    expect(card.motif).toEqual([2, 0, 3]);
    expect(card.details).toEqual(['19. bis 21. Wahlperiode']);
  });
});
