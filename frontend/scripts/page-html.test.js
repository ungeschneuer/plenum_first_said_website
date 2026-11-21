import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileOfPath, headTags, writePages } from './page-html.mjs';

const SITE = 'https://example.org/site/';
const TEMPLATE = '<!DOCTYPE html><html><head><title>Alt</title></head><body><div id="root"></div></body></html>';

function distWithData(data) {
  const dist = mkdtempSync(path.join(tmpdir(), 'page-html-'));
  writeFileSync(path.join(dist, 'index.html'), TEMPLATE);
  mkdirSync(path.join(dist, 'data'));
  for (const [name, content] of Object.entries(data)) {
    writeFileSync(path.join(dist, 'data', name), JSON.stringify(content));
  }
  return dist;
}

describe('page-html', () => {
  it('writes title, description and the absolute image address', () => {
    const tags = headTags({ path: '/neu', title: 'Neu', description: 'A "b" <c>', image: 'neu' }, SITE);
    expect(tags).toContain('<title>Neu · Bundestag Wortschatz</title>');
    expect(tags).toContain('content="A &quot;b&quot; &lt;c&gt;"');
    expect(tags).toContain('<meta property="og:image" content="https://example.org/site/og/neu.png" />');
    expect(tags).toContain('<link rel="canonical" href="https://example.org/site/neu/" />');
  });

  it('gives the 404 page no address', () => {
    const tags = headTags({ path: null, title: 'Bundestag Wortschatz', description: 'x', image: 'start' }, SITE);
    expect(tags).toContain('<title>Bundestag Wortschatz</title>');
    expect(tags).not.toContain('canonical');
    expect(tags).not.toContain('og:url');
  });

  it('maps paths to files and refuses paths outside the directory', () => {
    expect(fileOfPath('/d', '/')).toBe(path.join('/d', 'index.html'));
    expect(fileOfPath('/d', '/wort/Kl%C3%BCger')).toBe(path.join('/d', 'wort', 'Klüger', 'index.html'));
    expect(fileOfPath('/d', '/wort/%2E%2E')).toBeNull();
    expect(fileOfPath('/d', '/wort/a%2Fb')).toBeNull();
    expect(fileOfPath('/d', `/wort/${encodeURIComponent('ä'.repeat(128))}`)).toBeNull();
    expect(fileOfPath('/d', `/wort/${encodeURIComponent('ä'.repeat(127))}`)).not.toBeNull();
  });

  it('writes pages for static routes, persons and new words', () => {
    const dist = distWithData({
      'personen.json': { personen: [{ id: 'cem-oezdemir', name: 'Cem Özdemir', anzahl: 3 }] },
      'neue-woerter.json': [{ lemma: 'Wortneuschöpfung', protokoll: { nummer: '21/50' }, erste: { name: 'X Y' } }],
    });
    writePages(dist, SITE);
    const read = (...parts) => readFileSync(path.join(dist, ...parts), 'utf8');
    expect(read('index.html')).toContain('og/start.png');
    expect(read('statistik', 'index.html')).toContain('<title>Statistik · Bundestag Wortschatz</title>');
    expect(read('person', 'cem-oezdemir', 'index.html')).toContain('hat 3 Wörter als erste Person');
    const word = read('wort', 'Wortneuschöpfung', 'index.html');
    expect(word).toContain('og/wort.png');
    expect(word).toContain('in der Sitzung 21/50 von X Y');
    expect(read('person', 'cem-oezdemir', 'index.html')).toContain('og/person.png');
    expect(read('404.html')).not.toContain('canonical');
    expect(read('404.html')).toContain('<div id="root"></div>');
  });

  it('uses the own image of a person once it is rendered', () => {
    const dist = distWithData({ 'personen.json': { personen: [{ id: 'a-b', name: 'A B', anzahl: 2 }] } });
    mkdirSync(path.join(dist, 'og', 'person'), { recursive: true });
    writeFileSync(path.join(dist, 'og', 'person', 'a-b.png'), '');
    writePages(dist, SITE);
    expect(readFileSync(path.join(dist, 'person', 'a-b', 'index.html'), 'utf8')).toContain('og/person/a-b.png');
  });

  it('leaves out persons whose id is not a safe file name', () => {
    const dist = distWithData({ 'personen.json': { personen: [{ id: '../x', name: 'X', anzahl: 1 }] } });
    writePages(dist, SITE);
    expect(existsSync(path.join(dist, 'x'))).toBe(false);
  });
});
