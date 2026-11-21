import unittest
from datetime import date

from check_freshness import MAXIMUM_AGE_DAYS, MAXIMUM_AGE_DAYS_IN_SUMMER, maximum_age


class CheckFreshnessTest(unittest.TestCase):
    def test_summer_break_allows_older_protocols(self):
        self.assertEqual(maximum_age(date(2026, 8, 20)), MAXIMUM_AGE_DAYS_IN_SUMMER)
        self.assertEqual(maximum_age(date(2026, 11, 20)), MAXIMUM_AGE_DAYS)


if __name__ == '__main__':
    unittest.main()
