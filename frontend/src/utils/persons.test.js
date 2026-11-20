import { describe, expect, it } from 'vitest';
import { ALL_TERMS, cleanName, personId, personPath, rankPersons } from './persons.js';

// The same cases as pipeline/test_speaker_statistics.py, so that links find the files the pipeline writes.
describe('persons', () => {
  it('folds umlauts, accents and punctuation', () => {
    expect(personId('Dr. Gerd Müller')).toBe('dr-gerd-mueller');
    expect(personId('Cem Özdemir')).toBe('cem-oezdemir');
    expect(personId('Renée Weiß')).toBe('renee-weiss');
  });

  it('removes titles and glued notes from names', () => {
    expect(cleanName('Abg. Dr. Schmid')).toBe('Dr. Schmid');
    expect(cleanName('Beifall bei der CDU/CSU \x96 Dr. Heinrich L. Kolb')).toBe('Dr. Heinrich L. Kolb');
    expect(cleanName('Dietmar Woidke, Ministerpräsident (Brandenburg)')).toBe('Dietmar Woidke');
    expect(cleanName('Beifall beim BÜNDNIS 90/DIE GRÜNEN')).toBe('');
  });

  it('builds the path of a person page', () => {
    expect(personPath('Abg. Dr. Schmid')).toBe('/person/dr-schmid');
    expect(personPath('Beifall beim BÜNDNIS 90/DIE GRÜNEN')).toBeNull();
  });
});

describe('rankPersons', () => {
  const persons = [
    { id: 'a', name: 'Anna', anzahl: 10, sitzungsleitung: 8, zuordnung: 'SPD', wahlperioden: { 21: [10, 8, 'SPD'] } },
    { id: 'b', name: 'Bert', anzahl: 5, sitzungsleitung: 0, zuordnung: 'FDP', wahlperioden: { 21: [5, 0, 'FDP'] } },
    { id: 'c', name: 'Cora', anzahl: 5, sitzungsleitung: 0, zuordnung: 'AfD', wahlperioden: { 20: [5, 0, 'AfD'] } },
  ];

  it('ranks without the chair and shares ranks on equal values', () => {
    const ranking = rankPersons(persons, ALL_TERMS, false);
    expect(ranking.map((row) => [row.person.id, row.value, row.rank])).toEqual([['b', 5, 1], ['c', 5, 1], ['a', 2, 3]]);
  });

  it('ranks one term and counts the chair on request', () => {
    const ranking = rankPersons(persons, '21', true);
    expect(ranking.map((row) => [row.person.id, row.value, row.rank, row.attribution])).toEqual([
      ['a', 10, 1, 'SPD'], ['b', 5, 2, 'FDP'],
    ]);
  });
});
