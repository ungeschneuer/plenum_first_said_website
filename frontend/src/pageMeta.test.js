import { describe, expect, it } from 'vitest';
import { documentTitle, personPage, wordPage } from './pageMeta.js';

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
});
