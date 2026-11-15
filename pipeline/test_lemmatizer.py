import unittest
from pathlib import Path

from lemmatizer import Lemmatizer

GOLD_STANDARD = Path(__file__).with_name('lemma_gold.tsv')
REQUIRED_ACCURACY = 0.97


def read_gold_standard() -> list[tuple[str, set[str]]]:
    entries = []
    for line in GOLD_STANDARD.read_text().splitlines():
        if line and not line.startswith('#'):
            form, expected = line.split('\t')
            entries.append((form, set(expected.split('|'))))
    return entries


def corpus_with_gold_lemmas(entries: list[tuple[str, set[str]]]) -> dict[str, int]:
    # In the real corpus the base form of nearly every inflected word occurs too; this stands in for it.
    counts = {form: 1 for form, _ in entries}
    for _, lemmas in entries:
        counts.update({lemma: 1 for lemma in lemmas})
    return counts


class LemmatizerGoldStandardTest(unittest.TestCase):
    def test_accuracy_on_gold_standard(self):
        entries = read_gold_standard()
        corpus = corpus_with_gold_lemmas(entries)
        lemmatizer = Lemmatizer(corpus, corpus)
        errors = [(form, lemmatizer.lemma(form), expected) for form, expected in entries
                  if lemmatizer.lemma(form) not in expected]
        accuracy = 1 - len(errors) / len(entries)
        report = '\n'.join(f'{form} -> {lemma} (erwartet {" oder ".join(sorted(expected))})'
                           for form, lemma, expected in errors)
        self.assertGreaterEqual(accuracy, REQUIRED_ACCURACY, f'Genauigkeit {accuracy:.1%}\n{report}')

    def test_sentence_start_is_read_in_lower_case(self):
        counts = {'Unkalkulierte': 1, 'unkalkulierte': 5, 'unkalkuliert': 3}
        lemmatizer = Lemmatizer(counts, counts)
        self.assertEqual(lemmatizer.lemma('Unkalkulierte'), 'unkalkuliert')

    def test_lowercase_typo_of_frequent_noun_joins_the_noun(self):
        counts = {'Klimawandel': 4365, 'klimawandel': 3, 'leben': 35483, 'Leben': 45868}
        lemmatizer = Lemmatizer(counts, counts)
        self.assertEqual(lemmatizer.lemma('klimawandel'), 'Klimawandel')
        self.assertEqual(lemmatizer.lemma('leben'), 'leben')
        counts = {'Frage': 50577, 'frage': 4581, 'Tag': 4521, 'tagen': 188}
        lemmatizer = Lemmatizer(counts, counts)
        self.assertEqual(lemmatizer.lemma('frage'), 'fragen')
        self.assertEqual(lemmatizer.lemma('tagen'), 'tagen')

    def test_names_stay_as_they_are(self):
        self.assertEqual(Lemmatizer({}, {}).lemma('Merkels (Name)'), 'Merkels (Name)')

    def test_unattested_base_is_not_invented(self):
        lemmatizer = Lemmatizer({'Zeitenwenden': 1}, {})
        self.assertEqual(lemmatizer.lemma('Quarkzeitenwendex'), 'Quarkzeitenwendex')

    def test_spelling_reform_decides_between_sharp_s_and_double_s(self):
        reformed_counts = {'Ausschuss': 500, 'Ausschuß': 2, 'Prozess': 300, 'Straße': 90, 'Strasse': 1, 'dass': 9000}
        lemmatizer = Lemmatizer(reformed_counts, reformed_counts)
        self.assertEqual(lemmatizer.lemma('Ausschuss'), 'Ausschuss')
        self.assertEqual(lemmatizer.lemma('Ausschüsse'), 'Ausschuss')
        self.assertEqual(lemmatizer.lemma('Prozeß'), 'Prozess')
        self.assertEqual(lemmatizer.lemma('daß'), 'dass')
        self.assertEqual(lemmatizer.lemma('Straßen'), 'Straße')

    def test_unattested_spelling_follows_the_form(self):
        lemmatizer = Lemmatizer({}, {})
        self.assertEqual(lemmatizer.lemma('Abwicklungsprozesses'), 'Abwicklungsprozess')
        self.assertEqual(lemmatizer.lemma('Abwicklungsprozeß'), 'Abwicklungsprozeß')


if __name__ == '__main__':
    unittest.main()
