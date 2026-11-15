"""Split words that text recognition glued together in old printed protocols.

Text recognition of old prints sometimes loses the space before a short word: "Bundeskanzler in seiner" becomes
"Bundeskanzlerin seiner". The glued form then seems to be said decades before it really was. A form of an
old protocol is split if it is rare among the old protocols, ends in a short frequent word, and the part before it
is frequent there: Bundeskanzler occurs thousands of times before 1991, Bundeskanzlerin hardly ever.
"""

from array import array
from collections import Counter
from collections.abc import Sequence

# Protocols up to the end of the 11th electoral term were printed and recognised; later ones were typeset digitally.
RECOGNISED_TEXT_UNTIL = '1990-12-31'
MAXIMUM_COUNT_OF_GLUED_FORM = 2
MINIMUM_COUNT_OF_WORD_BEFORE = 100
MINIMUM_LENGTH_OF_WORD_BEFORE = 4
# Short words that often lose their space; endings such as -es or -er are left out, they are inflections.
SHORT_WORDS = ('und', 'der', 'die', 'das', 'den', 'dem', 'auf', 'mit', 'von', 'für', 'in', 'im', 'an', 'am', 'zu')


def is_recognised_text(entry: dict) -> bool:
    return entry['datum'] <= RECOGNISED_TEXT_UNTIL


def glued_parts(form: str, counts: Counter) -> tuple[str, str] | None:
    if counts[form] > MAXIMUM_COUNT_OF_GLUED_FORM:
        return None
    for short_word in SHORT_WORDS:
        word_before = form[:-len(short_word)]
        if (form.endswith(short_word) and len(word_before) >= MINIMUM_LENGTH_OF_WORD_BEFORE
                and counts[word_before] >= MINIMUM_COUNT_OF_WORD_BEFORE):
            return word_before, short_word
    return None


def split_glued_forms(entries: Sequence[dict], counts_per_protocol: list[array], form_ids: dict[str, int]) -> int:
    """Rewrite the (form id, count) pairs of recognised protocols; return the number of split occurrences."""
    forms = list(form_ids)
    recognised = [index for index, entry in enumerate(entries) if is_recognised_text(entry)]
    counts = Counter()
    for index in recognised:
        pairs = counts_per_protocol[index]
        for position in range(0, len(pairs), 2):
            counts[forms[pairs[position]]] += pairs[position + 1]

    split_occurrences = 0
    for index in recognised:
        pairs, repaired = counts_per_protocol[index], Counter()
        for position in range(0, len(pairs), 2):
            form, count = forms[pairs[position]], pairs[position + 1]
            parts = glued_parts(form, counts)
            if parts:
                split_occurrences += count
            for part in parts or (form,):
                repaired[form_ids.setdefault(part, len(form_ids))] += count
        counts_per_protocol[index] = array('I', (number for pair in repaired.items() for number in pair))
    return split_occurrences
