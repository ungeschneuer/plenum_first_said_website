import json
import tempfile
import unittest
from pathlib import Path

import word_statistics
from word_statistics import build_statistics, write_statistics


def protocol(index: int, day: str, term: int) -> dict:
    return {'id': str(index), 'wahlperiode': term, 'nummer': f'{term:02d}/{index}', 'datum': day, 'woerter': 1000}


# Three protocols in 1950, three in 2020: a gap of 70 years between protocols 2 and 3.
PROTOCOLS = [protocol(0, '1950-01-10', 1), protocol(1, '1950-02-10', 1), protocol(2, '1950-03-10', 1),
             protocol(3, '2020-01-10', 19), protocol(4, '2020-02-10', 19), protocol(5, '2020-03-10', 19)]


def entry(series: list[int], **fields) -> dict:
    return {'reihe': series, 'formen': {}, **fields}


class WordStatisticsTest(unittest.TestCase):
    def setUp(self):
        # The tiny corpus has no function words; leaving out the most frequent lemmas would leave out everything.
        previous = word_statistics.LEFT_OUT_MOST_FREQUENT
        word_statistics.LEFT_OUT_MOST_FREQUENT = 0
        self.addCleanup(setattr, word_statistics, 'LEFT_OUT_MOST_FREQUENT', previous)

    def build(self, lemmas: dict, group_totals: dict | None = None) -> dict:
        return build_statistics(PROTOCOLS, lambda: iter(lemmas.items()), group_totals or {})

    def test_finds_words_that_return_after_a_long_gap(self):
        statistics = self.build({
            'Kriegsanleihe': entry([0, 2, 1, 1, 1, 1, 1, 4, 1, 1, 1, 1]),
            'Haushalt': entry([0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
            'Kurzwort': entry([0, 1, 1, 1, 3, 1]),
            'Merkel': entry([0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        })
        returns = statistics['wiederkehrer']
        self.assertEqual([word['lemma'] for word in returns['laengste']], ['Haushalt', 'Kriegsanleihe'])
        self.assertEqual(returns['laengste'][1],
                         {'lemma': 'Kriegsanleihe', 'vorher': 2, 'wieder': 3, 'anzahl_vorher': 4,
                          'anzahl_nachher': 6})
        self.assertEqual(len(returns['zuletzt']), 2)

    def test_counts_words_said_only_once_per_term(self):
        statistics = self.build({
            'Einmalwortbildung': entry([3, 1], beleg='Eine Einmalwortbildung.'),
            'Zweimal': entry([3, 2]),
            'Altwort': entry([0, 1]),
            'Mehrmals': entry([3, 1, 1, 1]),
        })
        said_once = statistics['einmalwoerter']
        self.assertEqual(said_once['wahlperioden'], {'1': [1, 1], '19': [3, 1]})
        self.assertEqual(said_once['beispiele']['19'],
                         [{'lemma': 'Einmalwortbildung', 'protokoll': 3, 'beleg': 'Eine Einmalwortbildung.'}])

    def test_finds_words_typical_of_a_group(self):
        totals = {'19': {'A-Partei': 1_000_000, 'B-Partei': 1_000_000, 'Bundesregierung': 500_000}}
        statistics = self.build({
            'Steuerlast': entry([3, 60], fraktionen={'19': {'A-Partei': 50, 'B-Partei': 10}}),
            'Gemeinwohl': entry([3, 60], fraktionen={'19': {'A-Partei': 30, 'B-Partei': 30}}),
            'AfD-Antrag': entry([3, 60], fraktionen={'19': {'A-Partei': 60}}),
            'sozialdemokratisch': entry([3, 60], fraktionen={'19': {'A-Partei': 60}}),
        }, totals)
        self.assertEqual(statistics['typisch'], {'19': {'A-Partei': [['Steuerlast', 50, 4.6]], 'B-Partei': []}})

    def test_writes_statistik_json(self):
        directory = Path(tempfile.mkdtemp())
        (directory / 'words').mkdir()
        (directory / 'protocols.json').write_text(json.dumps(PROTOCOLS))
        (directory / 'shards.json').write_text(json.dumps(['ei']))
        (directory / 'words' / 'ei.json').write_text(json.dumps({'Einwurf': entry([4, 1])}))
        write_statistics(directory)
        statistics = json.loads((directory / 'statistik.json').read_text())
        self.assertEqual(statistics['einmalwoerter']['wahlperioden'], {'19': [1, 1]})


if __name__ == '__main__':
    unittest.main()
