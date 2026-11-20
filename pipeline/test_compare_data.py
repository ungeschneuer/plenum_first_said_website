import unittest

from compare_data import problems
from rules_version import rules_version


def protocols(*word_counts: int) -> dict[str, tuple[str, int]]:
    return {str(index): (f'01/{index}', words) for index, words in enumerate(word_counts)}


class CompareDataTest(unittest.TestCase):
    def test_small_changes_pass(self):
        self.assertEqual(problems(protocols(*[1000] * 200), protocols(*[990] * 200)), [])

    def test_missing_protocols_fail(self):
        self.assertTrue(any('fehlen' in problem for problem in problems(protocols(1000, 1000), protocols(1000))))

    def test_large_change_of_the_total_fails(self):
        self.assertTrue(problems(protocols(*[1000] * 200), protocols(*[900] * 200)))

    def test_many_shrunk_protocols_fail(self):
        previous = protocols(*[1000] * 200)
        new = protocols(*[1000] * 195, *[100] * 5)
        self.assertTrue(any('verlieren' in problem for problem in problems(previous, new)))


class RulesVersionTest(unittest.TestCase):
    def test_fingerprint_is_stable(self):
        self.assertEqual(rules_version(), rules_version())
        self.assertEqual(len(rules_version()), 16)


if __name__ == '__main__':
    unittest.main()
