import unittest
import xml.etree.ElementTree as ElementTree

from speakers import count_by_group, first_speakers, interjections, protocol_key, spoken_passages

STRUCTURED_PROTOCOL = '''<dbtplenarprotokoll>
  <vorspann><p klasse="J">Inhaltsverzeichnis mit Wärmepumpe</p></vorspann>
  <sitzungsverlauf>
    <name>Präsidentin Julia Klöckner:</name>
    <p klasse="J_1">Ich eröffne die Sitzung.</p>
    <rede id="r1">
      <p klasse="redner"><redner id="1"><name><vorname>Anna</vorname><nachname>Muster</nachname>
        <fraktion>SPD</fraktion></name></redner>Anna Muster (SPD):</p>
      <p klasse="J_1">Wir brauchen die Wärmepumpe.</p>
      <kommentar>(Beifall bei der SPD – Bernd Beispiel [AfD]: Doppelwumms!)</kommentar>
      <p klasse="O">Und den Deutschlandtakt.</p>
    </rede>
    <p klasse="AL_Namen">Bernd Beispiel</p>
  </sitzungsverlauf>
  <anlagen>
    <p klasse="Anlage_3">Erklärung der Abgeordneten X und Y</p>
    <p klasse="J">Wir lehnen die Sondervermögen ab.</p>
  </anlagen>
</dbtplenarprotokoll>'''

LEMMA_OF_FORM = {'Wärmepumpe': 'Wärmepumpe', 'Doppelwumms': 'Doppelwumms', 'Deutschlandtakt': 'Deutschlandtakt',
                 'eröffne': 'eröffnen', 'Sondervermögen': 'Sondervermögen', 'Bernd': 'Bernd'}


class SpeakersTest(unittest.TestCase):
    def setUp(self):
        self.root = ElementTree.fromstring(STRUCTURED_PROTOCOL)

    def test_passages_follow_speakers_and_chair(self):
        passages = list(spoken_passages(self.root))
        self.assertEqual(passages[0], ({'name': 'Julia Klöckner', 'rolle': 'Präsidentin'}, 'Ich eröffne die Sitzung.'))
        self.assertEqual(passages[1][0], {'name': 'Anna Muster', 'fraktion': 'SPD'})
        self.assertIsNone(passages[2][0], 'Beifall hat keinen Redner')
        self.assertEqual(passages[3][0], {'name': 'Bernd Beispiel', 'fraktion': 'AfD', 'zwischenruf': True})

    def test_first_speaker_per_lemma(self):
        wanted = {'Wärmepumpe', 'Doppelwumms', 'Deutschlandtakt', 'eröffnen', 'Sondervermögen', 'Bernd'}
        speakers = first_speakers(self.root, wanted, LEMMA_OF_FORM)
        self.assertEqual(speakers['Wärmepumpe'], {'name': 'Anna Muster', 'fraktion': 'SPD'})
        self.assertEqual(speakers['Deutschlandtakt'], {'name': 'Anna Muster', 'fraktion': 'SPD'})
        self.assertEqual(speakers['eröffnen'], {'name': 'Julia Klöckner', 'rolle': 'Präsidentin'})
        self.assertEqual(speakers['Doppelwumms'], {'name': 'Bernd Beispiel', 'fraktion': 'AfD', 'zwischenruf': True})
        self.assertIsNone(speakers['Sondervermögen'], 'schriftliche Erklärung in der Anlage')
        self.assertIsNone(speakers['Bernd'], 'Namenslisten sind nicht gesprochen')

    def test_counts_per_group_leave_out_chair_and_interjections(self):
        lemma_counts, word_counts = count_by_group(self.root, LEMMA_OF_FORM)
        self.assertEqual(lemma_counts['Wärmepumpe', 'SPD'], 1)
        self.assertEqual(lemma_counts['Deutschlandtakt', 'SPD'], 1)
        self.assertNotIn(('Doppelwumms', 'AfD'), lemma_counts)
        self.assertNotIn(('eröffnen', 'Präsidentin'), lemma_counts)
        self.assertEqual(set(word_counts), {'SPD'})

    def test_group_names_are_tidied(self):
        parts = list(interjections('(Dr.\xa0Anna Muster [BÜNDNIS\xa090/DIE GRÜNEN]: Ja!)'))
        self.assertEqual(parts[0][0]['fraktion'], 'Bündnis 90/Die Grünen')

    def test_glued_group_names_are_not_counted(self):
        from speakers import group_of
        self.assertIsNone(group_of({'name': 'X', 'fraktion': 'SPDCDU/CSU'}))
        self.assertEqual(group_of({'name': 'X', 'fraktion': 'SPD'}), 'SPD')
        self.assertEqual(group_of({'name': 'X', 'rolle': 'Bundesminister der Finanzen'}), 'Bundesregierung')

    def test_protocol_key_matches_file_names(self):
        self.assertEqual(protocol_key(19, 7), '19007')
        self.assertEqual(protocol_key(21, 108), '21108')


if __name__ == '__main__':
    unittest.main()
