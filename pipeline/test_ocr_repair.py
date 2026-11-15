import unittest
from array import array

from ocr_repair import split_glued_forms

OLD = {'datum': '1957-12-12'}
NEW = {'datum': '2010-03-04'}


class OcrRepairTest(unittest.TestCase):
    def split(self, entries, protocol_forms):
        form_ids: dict[str, int] = {}
        counts = [array('I', (number for form, count in forms.items()
                               for number in (form_ids.setdefault(form, len(form_ids)), count)))
                  for forms in protocol_forms]
        split_occurrences = split_glued_forms(entries, counts, form_ids)
        names = list(form_ids)
        result = [{names[pairs[i]]: pairs[i + 1] for i in range(0, len(pairs), 2)} for pairs in counts]
        return split_occurrences, result

    def test_rare_glued_form_of_an_old_protocol_is_split(self):
        split_occurrences, result = self.split([OLD], [{'Bundeskanzler': 500, 'Bundeskanzlerin': 1, 'in': 300}])
        self.assertEqual(split_occurrences, 1)
        self.assertEqual(result[0], {'Bundeskanzler': 501, 'in': 301})

    def test_newer_protocols_are_left_alone(self):
        _, result = self.split([OLD, NEW], [{'Bundeskanzler': 500}, {'Bundeskanzlerin': 1}])
        self.assertEqual(result[1], {'Bundeskanzlerin': 1})

    def test_forms_that_are_common_in_old_protocols_stay(self):
        _, result = self.split([OLD], [{'Bundeskanzler': 500, 'Kollegin': 40, 'Kolleg': 200}])
        self.assertEqual(result[0]['Kollegin'], 40)

    def test_inflection_endings_are_not_short_words(self):
        _, result = self.split([OLD], [{'Haushaltsausschuß': 500, 'Haushaltsausschußes': 1}])
        self.assertEqual(result[0]['Haushaltsausschußes'], 1)


if __name__ == '__main__':
    unittest.main()
