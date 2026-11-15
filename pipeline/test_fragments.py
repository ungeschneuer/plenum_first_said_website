import unittest

from fragments import FragmentDetector

CORPUS = {'Bildungsplanung': 40, 'europäischen': 500, 'Interpellation': 30, 'Wärmepumpe': 25}


class FragmentDetectorTest(unittest.TestCase):
    def setUp(self):
        self.detector = FragmentDetector(CORPUS)

    def test_rare_ending_of_a_frequent_word_is_a_fragment(self):
        self.assertTrue(self.detector.is_fragment('dungsplanung', 1))
        self.assertTrue(self.detector.is_fragment('pellation', 2))

    def test_rare_beginning_of_a_frequent_word_is_a_fragment(self):
        self.assertTrue(self.detector.is_fragment('europä', 1))

    def test_frequent_forms_are_no_fragments(self):
        self.assertFalse(self.detector.is_fragment('dungsplanung', 3))

    def test_capitalised_ending_is_a_word_of_its_own(self):
        self.assertFalse(self.detector.is_fragment('Pumpe', 1))

    def test_dictionary_words_are_no_fragments(self):
        self.assertFalse(self.detector.is_fragment('planung', 1))


if __name__ == '__main__':
    unittest.main()
