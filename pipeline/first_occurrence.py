"""Record where a lemma was said first: the sentence around it, and before the 19th term also the speaker.

The text of the protocol with the first occurrence is read in order (pipeline/text_speakers.py). The sentence
around the first form of the lemma becomes its evidence ("beleg"), shortened to EVIDENCE_LENGTH characters around
the word. From the 19th term on the speaker comes from the structured protocols (pipeline/speakers.py), before that
from the speaker lines of the text. To keep the data small, evidence and text speakers are only kept for lemmas
said at least MINIMUM_TOTAL_FOR_DETAILS times or first said from the 19th term on.
"""

import re
from bisect import bisect_left
from collections.abc import Mapping

from protocol_text import clean_text, words_with_positions
from text_speakers import spoken_passages

EVIDENCE_LENGTH = 180
MINIMUM_TOTAL_FOR_DETAILS = 5
FIRST_TERM_WITH_STRUCTURED_PROTOCOLS = 19
# An opening quotation mark without a closing one within this many characters is taken for a recognition error.
MAXIMUM_QUOTATION_LENGTH = 600
SENTENCE_END = re.compile(r'[.!?]["“”»]?\s')
SENTENCE_END_LENGTH = 3
WHITESPACE = re.compile(r'[\s\xa0]+')


def sentence_around(passage: str, start: int, end: int) -> str:
    """The sentence around passage[start:end], cut at word boundaries to about EVIDENCE_LENGTH characters."""
    # Only sentence ends within reach of the cut matter; searching the whole passage made long passages slow.
    window_start = max(0, start - EVIDENCE_LENGTH)
    sentence_start = max((match.end() for match in SENTENCE_END.finditer(passage, window_start, start)),
                         default=window_start)
    cut_start = max(sentence_start, start - EVIDENCE_LENGTH // 2)
    cut_limit = max(end + EVIDENCE_LENGTH // 2, cut_start + EVIDENCE_LENGTH)
    following_end = SENTENCE_END.search(passage, end, cut_limit + SENTENCE_END_LENGTH)
    sentence_end = following_end.start() + 1 if following_end else len(passage)
    cut_end = min(sentence_end, cut_limit)
    if cut_start > sentence_start:
        cut_start = passage.find(' ', cut_start, start) + 1 or cut_start
    if cut_end < sentence_end:
        cut_end = passage.rfind(' ', end, cut_end) if passage.rfind(' ', end, cut_end) > end else cut_end

    evidence = WHITESPACE.sub(' ', passage[cut_start:cut_end]).strip()
    prefix = '…' if cut_start > sentence_start else ''
    suffix = '…' if cut_end < sentence_end else ''
    return f'{prefix}{evidence}{suffix}'


class Quotations:
    """Whether a position of a passage lies within a quotation („…“), looked up in the positions of the marks."""

    def __init__(self, passage: str):
        self.openings = [match.start() for match in re.finditer('„', passage)]
        self.closings = [match.start() for match in re.finditer('“', passage)]

    def contain(self, position: int) -> bool:
        opening_index = bisect_left(self.openings, position)
        if opening_index == 0:
            return False
        last_opening = self.openings[opening_index - 1]
        closing_index = bisect_left(self.closings, position)
        last_closing = self.closings[closing_index - 1] if closing_index else -1
        return last_closing < last_opening and position - last_opening <= MAXIMUM_QUOTATION_LENGTH


def quoting(speaker: dict | None) -> dict | None:
    """A quotation read out is the speaker's word only in reading it; the evidence says so."""
    return {**speaker, 'zitat': True} if speaker else None


def first_occurrences(text: str, wanted_lemmas: set[str],
                      lemma_of_form: Mapping[str, str]) -> dict[str, tuple[dict | None, str]]:
    """Map each wanted lemma found in the text to (speaker, evidence) of its first occurrence."""
    found: dict[str, tuple[dict | None, str]] = {}
    for speaker, passage in spoken_passages(clean_text(text)):
        quotations = None
        for form, start, end in words_with_positions(passage):
            lemma = lemma_of_form.get(form)
            if lemma in wanted_lemmas and lemma not in found:
                quotations = quotations or Quotations(passage)
                quoted = quotations.contain(start)
                found[lemma] = (quoting(speaker) if quoted else speaker, sentence_around(passage, start, end))
        if len(found) == len(wanted_lemmas):
            break
    return found


def needs_details(lemma_total: int, wahlperiode: int) -> bool:
    return lemma_total >= MINIMUM_TOTAL_FOR_DETAILS or wahlperiode >= FIRST_TERM_WITH_STRUCTURED_PROTOCOLS


def is_before_structured_protocols(wahlperiode: int) -> bool:
    return wahlperiode < FIRST_TERM_WITH_STRUCTURED_PROTOCOLS
