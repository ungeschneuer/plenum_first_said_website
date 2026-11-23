import json
import tempfile
import unittest
from pathlib import Path

import word_statistics
from month_highlights import build_highlights, months_before, write_highlights


def protocol(index: int, day: str, term: int = 21, words: int = 1000) -> dict:
    return {'id': str(index), 'wahlperiode': term, 'nummer': f'{term:02d}/{index}', 'datum': day, 'woerter': words}


# 1990: three sessions; 2025-09 to 2025-12: one session each month, the last one twice as long.
PROTOCOLS = [protocol(0, '1990-01-10', 11), protocol(1, '1990-02-10', 11), protocol(2, '1990-03-10', 11),
             protocol(3, '2025-09-10'), protocol(4, '2025-10-10'), protocol(5, '2025-11-10'),
             protocol(6, '2025-12-10', words=2000), protocol(7, '2025-12-11', words=500)]


def entry(series: list[int], **fields) -> dict:
    return {'reihe': series, 'formen': {}, **fields}


class MonthHighlightsTest(unittest.TestCase):
    def setUp(self):
        previous = word_statistics.LEFT_OUT_MOST_FREQUENT
        word_statistics.LEFT_OUT_MOST_FREQUENT = 0
        self.addCleanup(setattr, word_statistics, 'LEFT_OUT_MOST_FREQUENT', previous)

    def build(self, lemmas: dict) -> list:
        return build_highlights(PROTOCOLS, lambda: iter(lemmas.items()))['monate']

    def test_counts_sessions_and_words_newest_month_first(self):
        months = self.build({'Haushalt': entry([3, 1])})
        self.assertEqual([month['monat'] for month in months][:2], ['2025-12', '2025-11'])
        self.assertEqual(months[0]['sitzungen'], 2)
        self.assertEqual(months[0]['woerter'], 2500)
        self.assertEqual(months[0]['laengste_sitzung'], 6)

    def test_lists_new_words_by_later_use_and_their_speakers(self):
        speaker = {'name': 'Anna Beispiel', 'fraktion': 'SPD'}
        months = self.build({
            'Klimageld': entry([6, 3, 1, 4], erste=speaker),
            'Wärmepumpe': entry([6, 1], erste=speaker),
            'Haushalt': entry([3, 1, 3, 1]),
        })
        december = months[0]
        self.assertEqual(december['neue_woerter']['anzahl'], 2)
        self.assertEqual([example[0] for example in december['neue_woerter']['beispiele']], ['Klimageld', 'Wärmepumpe'])
        self.assertEqual(december['neue_woerter']['beispiele'][0][2], 7)
        self.assertEqual(december['erste_personen'], [['Anna Beispiel', 'SPD', 2]])

    def test_finds_words_said_again_after_a_long_pause(self):
        months = self.build({'Kriegsanleihe': entry([0, 1, 1, 1, 1, 1, 4, 2])})
        december = months[0]
        self.assertEqual(december['wiederkehrer'], [['Kriegsanleihe', 2, 6]])

    def test_marks_the_hundredth_mention(self):
        months = self.build({'Rentenpaket': entry([3, 60, 1, 30, 2, 20])})
        self.assertEqual(months[0]['jubilaeen'], [['Rentenpaket', 100, 6, 3]])
        self.assertEqual(months[1]['jubilaeen'], [])

    def test_finds_words_much_more_frequent_than_before(self):
        months = self.build({'Zollstreit': entry([3, 1, 3, 40]), 'Haushalt': entry([3, 20, 1, 20, 1, 20, 1, 40])})
        self.assertEqual([trend[0] for trend in months[0]['trend']], ['Zollstreit'])
        self.assertEqual(months[0]['haeufigste'][0], ['Haushalt', 40])

    def test_leaves_out_names_and_abbreviations(self):
        months = self.build({'Merkel': entry([6, 30]), 'CDU': entry([6, 30]), 'Name (Name)': entry([6, 30])})
        self.assertEqual(months[0]['haeufigste'], [])
        self.assertEqual(months[0]['neue_woerter']['beispiele'], [])

    def test_counts_months_back_over_the_new_year(self):
        self.assertEqual(months_before('2025-02', 3), ['2025-01', '2024-12', '2024-11'])

    def test_writes_the_file(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder / 'words').mkdir()
            (folder / 'protocols.json').write_text(json.dumps(PROTOCOLS))
            (folder / 'shards.json').write_text(json.dumps(['k']))
            (folder / 'words' / 'k.json').write_text(json.dumps({'Klimageld': entry([6, 1])}))
            write_highlights(folder)
            self.assertEqual(json.loads((folder / 'monate.json').read_text())['monate'][0]['monat'], '2025-12')


if __name__ == '__main__':
    unittest.main()
