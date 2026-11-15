"""Recognise word fragments left by line breaks in printed protocols.

Older protocols come from text recognition of printed pages. A word divided at a page or column break leaves
pieces such as "dungsplanung" (from Bil-dungsplanung) or "europä" (from europä-ischen). A form counts as such a
fragment if it is rare, not in the dictionary, and exactly the beginning or the end of a frequent word of the
corpus. Endings are only fragments in lower case; a capitalised ending is usually a word of its own.
"""

from collections.abc import Mapping

import simplemma

MINIMUM_COUNT_OF_WHOLE_WORD = 20
MAXIMUM_COUNT_OF_FRAGMENT = 2
MINIMUM_FRAGMENT_LENGTH = 4
MINIMUM_MISSING_LENGTH = 2


class FragmentDetector:
    def __init__(self, form_counts: Mapping[str, int]):
        whole_words = [form.lower() for form, count in form_counts.items() if count >= MINIMUM_COUNT_OF_WHOLE_WORD]
        self.beginnings = {word[:end] for word in whole_words
                           for end in range(MINIMUM_FRAGMENT_LENGTH, len(word) - MINIMUM_MISSING_LENGTH + 1)}
        self.endings = {word[start:] for word in whole_words
                        for start in range(MINIMUM_MISSING_LENGTH, len(word) - MINIMUM_FRAGMENT_LENGTH + 1)}

    def is_fragment(self, form: str, count: int) -> bool:
        if count > MAXIMUM_COUNT_OF_FRAGMENT or len(form) < MINIMUM_FRAGMENT_LENGTH:
            return False
        if simplemma.is_known(form, lang='de'):
            return False
        lowercase = form.lower()
        return lowercase in self.beginnings or (form[0].islower() and lowercase in self.endings)
