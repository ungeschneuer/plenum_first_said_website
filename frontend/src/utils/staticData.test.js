import { beforeEach, describe, expect, it, vi } from 'vitest';

const FILES = {
  'protocols.json': [
    { id: '1', wahlperiode: 1, nummer: '01/1', datum: '1949-09-07', pdf: 'a.pdf', woerter: 100 },
    { id: '2', wahlperiode: 20, nummer: '20/50', datum: '2022-09-07', pdf: 'b.pdf', woerter: 200 },
    { id: '3', wahlperiode: 20, nummer: '20/51', datum: '2022-09-07', pdf: 'c.pdf', woerter: 0, gemeinsam_mit: '20/50' },
  ],
  'shards.json': ['kl', 'le'],
  'words/kl.json': {
    Klimawandel: { reihe: [1, 40], formen: { Klimawandel: 30, Klimawandels: 10 }, erste: { name: 'Anna Muster', fraktion: 'SPD' } },
    klimawandel: { reihe: [0, 1], formen: { klimawandel: 1 } },
  },
  'words/le.json': {
    Leben: { reihe: [0, 50, 1, 50], formen: { Leben: 100 } },
    leben: { reihe: [0, 30], formen: { leben: 25, lebt: 5 } },
  },
  'search/kli.json': [['Klimawandel', 40], ['Klimawandels', 40, 'Klimawandel'], ['klimawandel', 1]],
  'search/leb.json': [['Leben', 100], ['leben', 30], ['lebt', 30, 'leben']],
};

async function loadModule() {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const path = url.replace(/^.*\/data\//, '');
    const body = FILES[path];
    return body ? { ok: true, json: async () => body } : { ok: false, status: 404 };
  }));
  return import('./staticData.js');
}

describe('staticData', () => {
  let staticData;
  beforeEach(async () => {
    staticData = await loadModule();
  });

  it('folds umlauts and other characters for shard keys', () => {
    expect(staticData.foldForShardKey('Ärztin')).toBe('aerztin');
    expect(staticData.foldForShardKey('Know-how')).toBe('know_how');
  });

  it('decodes gap-encoded series', () => {
    expect(staticData.decodeSeries([0, 3, 4, 1])).toEqual([
      { protocolIndex: 0, count: 3 },
      { protocolIndex: 4, count: 1 },
    ]);
  });

  it('leads a lower-case link to the far more frequent capitalised lemma', async () => {
    const details = await staticData.getWordDetails('klimawandel');
    expect(details.word).toBe('Klimawandel');
    expect(details.first_speaker).toEqual({ name: 'Anna Muster', fraktion: 'SPD' });
    expect(details.forms).toEqual([['Klimawandel', 30], ['Klimawandels', 10]]);
  });

  it('keeps an exact spelling that is not a rarity', async () => {
    expect((await staticData.getWordDetails('leben')).word).toBe('leben');
    expect((await staticData.getWordDetails('Leben')).word).toBe('Leben');
  });

  it('resolves an inflected form to its lemma', async () => {
    expect((await staticData.getWordDetails('lebt')).word).toBe('leben');
  });

  it('gives a timeline point for every protocol, including those without the word', async () => {
    const timeline = await staticData.getWordTimeline('Klimawandel');
    expect(timeline.map((point) => point.count)).toEqual([0, 40]);
    expect(timeline.map((point) => point.protokollnummer)).not.toContain('51');
    expect(timeline[1].percentage).toBeCloseTo(20);
  });

  it('finds lemmas through forms and lists each lemma once', async () => {
    const { items } = await staticData.searchWords('klimawandel');
    expect(items.map((item) => item.word)).toEqual(['Klimawandel', 'klimawandel']);
    expect(items[0].matched_form).toBeNull();
  });

  it('reports unknown words', async () => {
    await expect(staticData.getWordDetails('Gibtsnicht')).rejects.toThrow('kommt in keinem Protokoll vor');
  });
});
