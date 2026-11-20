import tempfile
import time
import unittest
from pathlib import Path

from first_occurrence import first_occurrences
from protocol_sources import ARCHIVE, DIP, PDF, STRUCTURED, complete_text, is_final_report

FULL_TEXT = 'Die Sitzung ist eröffnet. ' * 10
PRELIMINARY_TEXT = FULL_TEXT + ('Der vom Redner autorisierte endgültige Stenografische Bericht dieser Sitzung wird am '
                                '20. Mai veröffentlicht.')
STRUCTURED_PROTOCOL = """<dbtplenarprotokoll><sitzungsverlauf><rede id="ID1">
<p klasse="redner"><redner id="1"><name><vorname>Anna</vorname><nachname>Muster</nachname>
<fraktion>SPD</fraktion></name></redner>Anna Muster (SPD):</p>
<p klasse="J_1">Wir beraten die Rentenreform.</p><kommentar>(Beifall bei der SPD)</kommentar>
</rede></sitzungsverlauf></dbtplenarprotokoll>"""


def entry(wahlperiode: int, nummer: str | None = None) -> dict:
    return {'wahlperiode': wahlperiode, 'nummer': nummer or f'{wahlperiode}/1'}


def nothing(_entry: dict):
    return None


def no_text(_entry: dict) -> str:
    return ''


class CompleteTextTest(unittest.TestCase):
    def test_archive_comes_before_dip(self):
        result = complete_text(entry(14), lambda _: FULL_TEXT, nothing, lambda _: 'DIP ' * 50, nothing)
        self.assertEqual(result, (FULL_TEXT, ARCHIVE))

    def test_final_dip_text_is_taken_without_archive(self):
        self.assertEqual(complete_text(entry(14), no_text, nothing, lambda _: FULL_TEXT, nothing), (FULL_TEXT, DIP))

    def test_preliminary_dip_text_is_not_taken(self):
        self.assertFalse(is_final_report(PRELIMINARY_TEXT))
        self.assertIsNone(complete_text(entry(14), no_text, nothing, lambda _: PRELIMINARY_TEXT, nothing))

    def test_pdf_is_the_last_source(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, 'protocol.pdf')
            path.write_bytes(b'')
            import protocol_sources
            original = protocol_sources.text_of_pdf
            protocol_sources.text_of_pdf = lambda _path: FULL_TEXT
            try:
                result = complete_text(entry(14), no_text, nothing, no_text, lambda _: path)
            finally:
                protocol_sources.text_of_pdf = original
        self.assertEqual(result, (FULL_TEXT, PDF))

    def test_from_the_19th_term_only_the_structured_protocol_counts(self):
        self.assertIsNone(complete_text(entry(20), lambda _: FULL_TEXT, nothing, lambda _: FULL_TEXT, nothing))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, 'protocol.xml')
            path.write_text(STRUCTURED_PROTOCOL)
            text, source = complete_text(entry(20), no_text, lambda _: path, no_text, nothing)
        self.assertEqual(source, STRUCTURED)
        self.assertIn('Anna Muster (SPD):', text)
        self.assertIn('Wir beraten die Rentenreform.', text)
        self.assertIn('(Beifall bei der SPD)', text)


class QuotationTest(unittest.TestCase):
    def test_first_occurrence_in_a_quotation_is_marked(self):
        text = 'Anna Muster (SPD):\nEr schrieb: „Die Zeitenwende ist da.“ Dem stimme ich zu. ' * 3
        found = first_occurrences(text, {'Zeitenwende', 'stimmen'}, {'Zeitenwende': 'Zeitenwende', 'stimme': 'stimmen'})
        self.assertTrue(found['Zeitenwende'][0]['zitat'])
        self.assertNotIn('zitat', found['stimmen'][0])

    def test_unclosed_quotation_mark_ends_after_a_while(self):
        text = 'Anna Muster (SPD):\nEr schrieb: „Die Zeitenwende ist da. ' + 'Wir reden weiter. ' * 40 + 'Dem stimme ich zu.'
        found = first_occurrences(text, {'Zeitenwende', 'stimmen'}, {'Zeitenwende': 'Zeitenwende', 'stimme': 'stimmen'})
        self.assertTrue(found['Zeitenwende'][0]['zitat'])
        self.assertNotIn('zitat', found['stimmen'][0])

    def test_many_first_occurrences_in_a_long_passage_are_found_quickly(self):
        words = [f'Wort{chr(97 + index % 26)}{chr(97 + index // 26 % 26)}{chr(97 + index // 676)}' for index in range(15000)]
        text = 'Anna Muster (SPD):\n' + ' „Zitat“ '.join(words)
        started = time.monotonic()
        found = first_occurrences(text, set(words), {word: word for word in words})
        self.assertLess(time.monotonic() - started, 5)
        self.assertEqual(len(found), len(words))


if __name__ == '__main__':
    unittest.main()
