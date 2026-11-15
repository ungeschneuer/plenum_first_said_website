import unittest
import xml.etree.ElementTree as ElementTree

from speakers import first_speakers, protocol_key, spoken_passages

STRUCTURED_PROTOCOL = '''<dbtplenarprotokoll>
  <vorspann><p klasse="J">Inhaltsverzeichnis mit Wärmepumpe</p></vorspann>
  <sitzungsverlauf>
    <name>Präsidentin Julia Klöckner:</name>
    <p klasse="J_1">Ich eröffne die Sitzung.</p>
    <rede id="r1">
      <p klasse="redner"><redner id="1"><name><vorname>Anna</vorname><nachname>Muster</nachname>
        <fraktion>SPD</fraktion></name></redner>Anna Muster (SPD):</p>
      <p klasse="J_1">Wir brauchen die Wärmepumpe.</p>
      <kommentar>(Zuruf: Doppelwumms!)</kommentar>
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
        self.assertIsNone(passages[2][0], 'Zwischenrufe haben keinen Redner')

    def test_first_speaker_per_lemma(self):
        wanted = {'Wärmepumpe', 'Doppelwumms', 'Deutschlandtakt', 'eröffnen', 'Sondervermögen', 'Bernd'}
        speakers = first_speakers(self.root, wanted, LEMMA_OF_FORM)
        self.assertEqual(speakers['Wärmepumpe'], {'name': 'Anna Muster', 'fraktion': 'SPD'})
        self.assertEqual(speakers['Deutschlandtakt'], {'name': 'Anna Muster', 'fraktion': 'SPD'})
        self.assertEqual(speakers['eröffnen'], {'name': 'Julia Klöckner', 'rolle': 'Präsidentin'})
        self.assertIsNone(speakers['Doppelwumms'], 'nur im Zwischenruf')
        self.assertIsNone(speakers['Sondervermögen'], 'schriftliche Erklärung in der Anlage')
        self.assertIsNone(speakers['Bernd'], 'Namenslisten sind nicht gesprochen')

    def test_protocol_key_matches_file_names(self):
        self.assertEqual(protocol_key(19, 7), '19007')
        self.assertEqual(protocol_key(21, 108), '21108')


if __name__ == '__main__':
    unittest.main()
