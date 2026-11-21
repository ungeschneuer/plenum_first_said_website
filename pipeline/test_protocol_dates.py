import unittest

from protocol_dates import correct_dates, corrected_date


def entry(number: str, session_date: str) -> dict:
    return {'nummer': number, 'datum': session_date}


class ProtocolDatesTest(unittest.TestCase):
    def test_year_off_by_one_is_corrected(self):
        entries = [entry('01/194', '1952-02-20'), entry('01/195', '1951-02-21'), entry('01/196', '1952-02-28')]
        correct_dates(entries)
        self.assertEqual(entries[1]['datum'], '1952-02-21')
        self.assertEqual(entries[1]['datum_dip'], '1951-02-21')

    def test_month_off_by_one_is_corrected(self):
        self.assertEqual(corrected_date('1956-11-30', '1956-11-05', '1956-12-06'), '1956-12-05')

    def test_fitting_dates_stay(self):
        entries = [entry('01/1', '1949-09-07'), entry('01/2', '1949-09-08'), entry('01/3', '1949-09-15')]
        correct_dates(entries)
        self.assertNotIn('datum_dip', entries[1])

    def test_date_without_a_single_fitting_correction_stays(self):
        self.assertIsNone(corrected_date('1960-01-10', '1955-06-01', '1960-02-10'))


if __name__ == '__main__':
    unittest.main()
