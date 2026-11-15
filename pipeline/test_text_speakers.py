import unittest

from first_occurrence import first_occurrences, sentence_around
from text_speakers import spoken_passages

OLD_PROTOCOL = '''Präsident D. Dr. Gerstenmaier: Die Sitzung ist eröffnet.
Frau Kalinke (DP): Herr Präsident! Die Rentenreform ist dringend.
(Zuruf von der SPD: Sehr richtig!)
Meyer (Wanne-Eickel) (SPD): Wir lehnen den Entwurf ab.
Dr. Erhard, Bundesminister für Wirtschaft: Die Konjunktur ist stabil.
Tagesordnungspunkt 1 (Fortsetzung):
Dr. Alice Weidel (AfD): Das Deutschlandticket ist teuer.
'''


class TextSpeakersTest(unittest.TestCase):
    def test_speaker_lines_of_all_decades(self):
        speakers = {text.strip()[:20]: speaker for speaker, text in spoken_passages(OLD_PROTOCOL) if text.strip()}
        self.assertEqual(speakers['Die Sitzung ist eröf'], {'name': 'D. Dr. Gerstenmaier', 'rolle': 'Präsident'})
        self.assertEqual(speakers['Herr Präsident! Die '], {'name': 'Kalinke', 'fraktion': 'DP'})
        self.assertIsNone(speakers['(Zuruf von der SPD: '])
        self.assertEqual(speakers['Wir lehnen den Entwu'], {'name': 'Meyer', 'fraktion': 'SPD'})
        self.assertEqual(speakers['Die Konjunktur ist s'], {'name': 'Dr. Erhard', 'rolle': 'Bundesminister für Wirtschaft'})
        self.assertEqual(speakers['Das Deutschlandticke'], {'name': 'Dr. Alice Weidel', 'fraktion': 'AfD'})

    def test_evidence_is_the_sentence_around_the_word(self):
        passage = 'Vorher war alles gut. Wir brauchen ein digitales Deutschlandticket bundesweit. Danach nicht.'
        start = passage.index('Deutschlandticket')
        self.assertEqual(sentence_around(passage, start, start + 17),
                         'Wir brauchen ein digitales Deutschlandticket bundesweit.')

    def test_long_sentences_are_cut_with_ellipsis(self):
        passage = 'Und ' + 'sehr ' * 60 + 'mit Wärmepumpe und ' + 'viel ' * 60 + 'Text.'
        start = passage.index('Wärmepumpe')
        evidence = sentence_around(passage, start, start + 10)
        self.assertTrue(evidence.startswith('…') and evidence.endswith('…'))
        self.assertIn('Wärmepumpe', evidence)
        self.assertLess(len(evidence), 200)

    def test_first_occurrence_gives_speaker_and_evidence(self):
        text = OLD_PROTOCOL + 'x ' * 300
        found = first_occurrences(text, {'Rentenreform', 'Deutschlandticket'},
                                  {'Rentenreform': 'Rentenreform', 'Deutschlandticket': 'Deutschlandticket'})
        self.assertEqual(found['Rentenreform'], ({'name': 'Kalinke', 'fraktion': 'DP'}, 'Die Rentenreform ist dringend.'))
        self.assertEqual(found['Deutschlandticket'][0]['name'], 'Dr. Alice Weidel')


if __name__ == '__main__':
    unittest.main()
