import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from export_static_data import decode_series, encode_series, fold_for_shard_key

EXPORT_SCRIPT = Path(__file__).with_name('export_static_data.py')
TABLE_OF_CONTENTS = 'Inhalt ' * 120


def protocol_xml(document_id: int, number: str, session_date: str, body: str) -> str:
    return f'''<document><id>{document_id}</id><wahlperiode>{number.split('/')[0]}</wahlperiode>
<dokumentnummer>{number}</dokumentnummer><datum>{session_date}</datum>
<fundstelle><pdf_url>https://example.org/{document_id}.pdf</pdf_url></fundstelle>
<text>{TABLE_OF_CONTENTS}\nBeginn: 9.00 Uhr\n{body}</text></document>'''


def run_export(*arguments: str) -> None:
    subprocess.run([sys.executable, str(EXPORT_SCRIPT), '--skip-speakers', *arguments], check=True,
                   capture_output=True)


def read_words(directory: Path) -> dict:
    words = {}
    for key in json.loads((directory / 'shards.json').read_text()):
        words.update(json.loads((directory / 'words' / f'{key}.json').read_text()))
    return words


class ExportTest(unittest.TestCase):
    def setUp(self):
        self.directory = Path(tempfile.mkdtemp())
        self.input = self.directory / 'xml'
        self.input.mkdir()

    def write_protocol(self, document_id: int, number: str, session_date: str, body: str) -> None:
        (self.input / f'{document_id}.xml').write_text(protocol_xml(document_id, number, session_date, body))

    def test_series_encoding_round_trip(self):
        occurrences = [(0, 3), (4, 1), (9, 12)]
        flat = [number for pair in occurrences for number in pair]
        self.assertEqual(encode_series(flat), [0, 3, 4, 1, 5, 12])
        self.assertEqual(decode_series(encode_series(flat)), occurrences)

    def test_shard_key_folding(self):
        self.assertEqual(fold_for_shard_key('Ärztin'), 'aerztin')
        self.assertEqual(fold_for_shard_key('Know-how'), 'know_how')

    def test_export_counts_lemmas_per_protocol_in_date_order(self):
        self.write_protocol(2, '01/2', '1949-09-08', 'Die Gesetzentwürfe und der Gesetzentwurf.')
        self.write_protocol(1, '01/1', '1949-09-07', 'Ein Gesetzentwurf liegt vor.')
        output = self.directory / 'out'
        run_export('--input', str(self.input), '--output', str(output))

        protocols = json.loads((output / 'protocols.json').read_text())
        self.assertEqual([protocol['nummer'] for protocol in protocols], ['01/1', '01/2'])
        entry = read_words(output)['Gesetzentwurf']
        self.assertEqual(decode_series(entry['reihe']), [(0, 1), (1, 2)])
        self.assertEqual(entry['formen'], {'Gesetzentwurf': 2, 'Gesetzentwürfe': 1})
        self.assertNotIn('erste', entry)

    def test_rerun_without_new_protocols_changes_nothing(self):
        self.write_protocol(1, '01/1', '1949-09-07', 'Ein Gesetzentwurf liegt vor.')
        first, second = self.directory / 'first', self.directory / 'second'
        run_export('--input', str(self.input), '--output', str(first))
        run_export('--previous', str(first), '--output', str(second))
        for path in first.rglob('*.json'):
            self.assertEqual(path.read_bytes(), (second / path.relative_to(first)).read_bytes(), path.name)

    def test_search_index_leads_from_forms_to_lemmas(self):
        self.write_protocol(1, '01/1', '1949-09-07', 'Die Gesetzentwürfe.')
        output = self.directory / 'out'
        run_export('--input', str(self.input), '--output', str(output))
        entries = json.loads((output / 'search' / 'ges.json').read_text())
        self.assertIn(['Gesetzentwürfe', 1, 'Gesetzentwurf'], entries)


if __name__ == '__main__':
    unittest.main()
