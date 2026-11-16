import unittest

from protocol_text import extract_words

TABLE_OF_CONTENTS = 'Inhalt: Tagesordnungspunkt 1 Haushaltsgesetz ' * 20
# Single letters are not counted; they make the text after the session start long enough to be cut there.
UNCOUNTED_FILLER = ' x' * 300


def protocol(body: str) -> str:
    return f'{TABLE_OF_CONTENTS}\nBeginn: 9.00 Uhr\n{body}\n{UNCOUNTED_FILLER}'


class ProtocolTextTest(unittest.TestCase):
    def test_table_of_contents_before_session_start_is_not_counted(self):
        words = extract_words(protocol('Präsident: Die Sitzung ist eröffnet.'))
        self.assertNotIn('Haushaltsgesetz', words)
        self.assertIn('eröffnet', words)

    def test_current_dip_format_starts_with_the_chair(self):
        text = ('Inhalt:\nHaushaltsgesetz 2023\nNächste Sitzung\nAnlage\nEntschuldigte Abgeordnete\n'
                'Präsidentin Bärbel Bas:\nIch eröffne die Sitzung und rufe das Deutschlandticket auf.\n'
                + 'Wenn der Herr Präsident erlaubt:\nweiter im Text. ' * 40 + '\n(Schluss: 16.01 Uhr)\n'
                'Anlage\nEntschuldigte Abgeordnete\nAmtsberg, Luise\n')
        words = extract_words(text)
        self.assertNotIn('Haushaltsgesetz', words)
        self.assertIn('Deutschlandticket', words)
        self.assertIn('erlaubt', words)
        self.assertNotIn('Amtsberg', words)

    def test_old_format_with_speech_after_the_colon_and_no_start_marker(self):
        text = ('Inhalt: Rentenreform\nVizepräsident Dr. Jaeger \t 10414 A\n'
                'Präsident D. Dr. Gerstenmaier: Die Sitzung ist eröffnet.\n' + 'Wir beraten die Sozialreform. ' * 40
                + '\nPräsident D. Dr. Gerstenmaier:\nÄnderungsantrag.')
        words = extract_words(text)
        self.assertNotIn('Rentenreform', words)
        self.assertIn('eröffnet', words)
        self.assertIn('Sozialreform', words)

    def test_running_head_is_removed_and_word_across_it_joined(self):
        text = protocol('Wir sprechen über die Organisa-\n'
                        'Deutscher Bundestag – 16. Wahlperiode – 18. Sitzung. Berlin, Mittwoch, den 15. Februar 2006 1234\n'
                        'tionsform des Bundestages.')
        words = extract_words(text)
        self.assertIn('Organisationsform', words)
        self.assertNotIn('Wahlperiode', words)
        self.assertNotIn('Mittwoch', words)

    def test_excused_members_and_imprint_are_removed(self):
        text = protocol('Die Sitzung ist geschlossen.\nAnlage 1\nEntschuldigte Abgeordnete\nMüller, Anna SPD\n'
                        'Anlage 2\nZu Protokoll gegebene Rede zur Wärmepumpe\n'
                        'Gesamtherstellung: Druckerei GmbH, Berlin')
        words = extract_words(text)
        self.assertNotIn('Müller', words)
        self.assertNotIn('Druckerei', words)
        self.assertIn('Wärmepumpe', words)

    def test_line_break_hyphenation(self):
        words = extract_words(protocol('BÜND-\nNIS 90/DIE GRÜ- \nNEN, Außen-\nund Innenpolitik, CDU/CSU-\nFraktion'))
        self.assertEqual(words, ['Beginn', 'Uhr', 'DIE', 'GRÜNEN', 'und', 'Innenpolitik', 'CDU', 'CSU-Fraktion'])

    def test_hyphen_on_a_line_of_its_own(self):
        words = extract_words(protocol('aller guten Euro\n-\npäer und\n- Aufzählungen'))
        self.assertIn('Europäer', words)
        self.assertIn('Aufzählungen', words)

    def test_enumeration_fragment_is_dropped_but_following_words_kept(self):
        words = extract_words(protocol('Bundes- und Landesrecht'))
        self.assertEqual(words[-2:], ['und', 'Landesrecht'])

    def test_abbreviations_are_kept_and_glued_words_dropped(self):
        words = extract_words(protocol('Die AfD, die SPD und das BAföG; BürgerInnen und wordsGlued nicht.'))
        self.assertIn('AfD', words)
        self.assertIn('BAföG', words)
        self.assertNotIn('BürgerInnen', words)
        self.assertNotIn('wordsGlued', words)

    def test_names_after_titles_are_counted_as_names(self):
        words = extract_words(protocol('Wir schrieben an Herrn General Handy. Herr Dr. Wolfgang Schäuble hat '
                                       'Frau Merkel Recht gegeben, sagte Kollege Wolf. Herr Präsident! Meine Damen, '
                                       'dass jede Frau Kinder bekommt.'))
        for name in ('Handy (Name)', 'Wolfgang (Name)', 'Schäuble (Name)', 'Merkel (Name)', 'Wolf (Name)'):
            self.assertIn(name, words)
        for word in ('Recht', 'Präsident', 'Meine', 'Kinder'):
            self.assertIn(word, words)
        self.assertNotIn('Handy', words)

    def test_roll_call_vote_lists_are_not_counted(self):
        words = extract_words(protocol('Wir stimmen ab.\nName Abstimmung Name Abstimmung\nGlüsing  ja Nellen  ja\n'
                                       'Frau Dr. Gröwel \t -- Frau Niggemeyer \t ja\nGockeln \t  entschuldigt\n'
                                       'Endgültiges Ergebnis\nAbgegebene Stimmen:\t643;\nJa\nCDU/CSU\n'
                                       'Stephan Albani\nPeter Altmaier\n'
                                       'Der nächste Redner ist der Kollege Otto Fricke, und er spricht jetzt zur Rentenreform.\n'
                                       'Ich sage ja'))
        for name in ('Glüsing', 'Nellen', 'Gröwel', 'Gockeln', 'Albani', 'Altmaier', 'Abstimmung'):
            self.assertNotIn(name, words)
        for word in ('stimmen', 'Rentenreform', 'sage'):
            self.assertIn(word, words)

    def test_glued_title_after_herr_is_split(self):
        words = extract_words(protocol('Nun hat der Herr Bundeskanzlerin seiner Regierungserklärung gesagt.'))
        self.assertNotIn('Bundeskanzlerin', words)
        self.assertIn('Bundeskanzler', words)

    def test_member_names_without_title(self):
        words = extract_words(protocol('Ilk, Oskar Müller, Rudolf Kohl. Kohl ist ein Gemüse, der Ernst der Lage.'))
        for name in ('Oskar (Name)', 'Müller (Name)', 'Rudolf (Name)', 'Kohl (Name)'):
            self.assertIn(name, words)
        self.assertIn('Kohl', words)
        self.assertIn('Ernst', words)

    def test_speaker_lines_are_not_counted(self):
        words = extract_words(protocol('Dr. Schellenberg (SPD): Herr Präsident! Die Rentenreform.\n'
                                       'Vizepräsidentin Petra Pau:\nDas Wort hat der Kollege.'))
        self.assertNotIn('Schellenberg', words)
        self.assertNotIn('SPD', words)
        self.assertNotIn('Pau', words)
        self.assertEqual(words.count('Präsident'), 1)
        self.assertIn('Rentenreform', words)

    def test_typographic_quotes_and_dashes_separate_words(self):
        words = extract_words(protocol('„Wohnungsmangel“ – so die –Beifall… «Perestroika»'))
        for word in ('Wohnungsmangel', 'Beifall', 'Perestroika'):
            self.assertIn(word, words)


if __name__ == '__main__':
    unittest.main()
