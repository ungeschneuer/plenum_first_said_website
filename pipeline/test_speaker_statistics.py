import json
import tempfile
import unittest
from pathlib import Path

from speaker_statistics import attribution, build_statistics, clean_name, person_id, write_statistics

PROTOCOLS = [
    {'wahlperiode': 1, 'nummer': '01/1', 'datum': '1949-09-07'},
    {'wahlperiode': 21, 'nummer': '21/1', 'datum': '2025-03-25'},
]


class SpeakerStatisticsTest(unittest.TestCase):
    def test_person_id_folds_umlauts_accents_and_punctuation(self):
        self.assertEqual(person_id('Dr. Gerd Müller'), 'dr-gerd-mueller')
        self.assertEqual(person_id('Cem Özdemir'), 'cem-oezdemir')
        self.assertEqual(person_id('Renée Weiß'), 'renee-weiss')

    def test_clean_name_removes_titles_and_glued_notes(self):
        self.assertEqual(clean_name('Abg. Dr. Schmid'), 'Dr. Schmid')
        self.assertEqual(clean_name('Beifall bei der CDU/CSU \x96 Dr. Heinrich L. Kolb'), 'Dr. Heinrich L. Kolb')
        self.assertEqual(clean_name('Dietmar Woidke, Ministerpräsident (Brandenburg)'), 'Dietmar Woidke')
        self.assertEqual(clean_name('Beifall beim BÜNDNIS 90/DIE GRÜNEN'), '')

    def test_attribution_drops_applause_notes(self):
        self.assertEqual(attribution({'rolle': 'Bundeskanzler (mit Beifall der Regierungsparteien begrüßt)'}),
                         'Bundeskanzler')
        self.assertEqual(attribution({'fraktion': 'SPD', 'rolle': 'Präsident'}), 'SPD')

    def test_counts_per_person_and_term_without_quotations(self):
        words = [
            ('Klimageld', 1, {'name': 'Anna Muster', 'fraktion': 'SPD'}),
            ('Wärmewende', 1, {'name': 'Anna Muster', 'rolle': 'Bundesministerin', 'zwischenruf': True}),
            ('Bundesgrenzschutz', 0, {'name': 'Dr. Ehlers', 'rolle': 'Präsident'}),
            ('Zitatwort', 1, {'name': 'Anna Muster', 'fraktion': 'SPD', 'zitat': True}),
        ]
        summary, details = build_statistics(PROTOCOLS, [word for word in words if not word[2].get('zitat')])
        anna = summary['personen'][0]
        self.assertEqual(anna['id'], 'anna-muster')
        self.assertEqual(anna['anzahl'], 2)
        self.assertEqual(anna['zwischenrufe'], 1)
        self.assertEqual(anna['zuordnung'], 'SPD')
        self.assertEqual(anna['wahlperioden'], {'21': [2, 0, 'SPD']})
        ehlers = summary['personen'][1]
        self.assertEqual(ehlers['wahlperioden'], {'1': [1, 1, 'Präsident']})
        self.assertEqual(details['anna-muster']['woerter'], [['Klimageld', 1, 0], ['Wärmewende', 1, 1]])

    def test_write_statistics_reads_an_export(self):
        directory = Path(tempfile.mkdtemp())
        (directory / 'words').mkdir()
        (directory / 'protocols.json').write_text(json.dumps(PROTOCOLS))
        (directory / 'shards.json').write_text(json.dumps(['kl']))
        (directory / 'words' / 'kl.json').write_text(json.dumps({
            'Klimageld': {'reihe': [1, 3], 'formen': {'Klimageld': 3}, 'erste': {'name': 'Anna Muster', 'fraktion': 'SPD'}},
            'Klima': {'reihe': [0, 1], 'formen': {'Klima': 1}, 'erste': {'name': 'Zitat', 'fraktion': 'SPD', 'zitat': True}},
            'Klee': {'reihe': [0, 1], 'formen': {'Klee': 1}, 'erste': None},
        }, ensure_ascii=False))
        (directory / 'personen').mkdir()
        (directory / 'personen' / 'alt.json').write_text('{}')
        write_statistics(directory)
        summary = json.loads((directory / 'personen.json').read_text())
        self.assertEqual([person['id'] for person in summary['personen']], ['anna-muster'])
        self.assertEqual(sorted(path.name for path in (directory / 'personen').iterdir()), ['anna-muster.json'])


if __name__ == '__main__':
    unittest.main()
