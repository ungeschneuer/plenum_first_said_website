"""Turn the text of a plenary protocol into the word forms that are counted.

The text starts at the opening of the session; the table of contents before it is dropped. Older texts mark the
opening with "Beginn: 9.00 Uhr", texts in DIP's current format start with the first line of the chair
("Präsidentin Bärbel Bas:"); whichever comes first counts.
Parts that are print layout rather than speech are removed: the running head of every printed page, the list of
excused members in the appendix and the printer's imprint at the end. Words split at the end of a line are joined,
also across a removed running head. Numbers, single letters, glued words with capitals inside and fragments of
enumerations ("Bundes- und Landesrecht") are not counted; abbreviations such as AfD or CSU-Fraktion are.
"""

import re

# A session start marker found later than this share of the text is the old format's closing note, not the start.
MINIMUM_TEXT_AFTER_SESSION_START = 500
MAXIMUM_ABBREVIATION_LENGTH = 6
# Printers' imprints are found within the last characters of a protocol.
IMPRINT_SEARCH_WINDOW = 3000

SESSION_START_MARKER = re.compile(r'Beginn\s*:\s*\d')
FIRST_LINE_OF_CHAIR = re.compile(
    r'^(?:Alters|Vize)?[Pp]räsident(?:in)?(?:[ \t\xa0]+(?:Dr\.|D\.|Prof\.|[A-ZÄÖÜ][\w\-]*)){1,6}:(?:[ \t]|$)',
    re.MULTILINE)
# The table of contents is short; a first line of the chair found later belongs to a text without one.
MAXIMUM_SHARE_BEFORE_FIRST_LINE_OF_CHAIR = 0.3
SESSION_END = re.compile(r'\(Schluss\s*:')
# The list of excused members is a short appendix; a longer match would mean the heading stood somewhere else.
MAXIMUM_EXCUSED_LIST_LENGTH = 30000
DASH = r'[-–—]'
WEEKDAY = r'(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag)'
RUNNING_HEAD = re.compile(
    rf'[ \t]*Deutscher Bundestag\s*{DASH}\s*\d+\.\s*Wahlperiode\s*{DASH}\s*\d+\.\s*Sitzung\.?\s*'
    rf'(?:Bonn|Berlin)?\s*,?\s*(?:den\s+)?(?:{WEEKDAY}\s*,?\s*)?(?:den\s+)?\d{{1,2}}\.\s*[A-Za-zÄÖÜäöü]+\s+\d{{4}}'
    r'[ \t]*\d*\s*\*?[ \t]*\n?')
EXCUSED_MEMBERS = re.compile(
    r'(?:Liste der (?:entschuldigten|beurlaubten) Abgeordneten|Entschuldigte Abgeordnete|Beurlaubte Abgeordnete)'
    rf'.{{0,{MAXIMUM_EXCUSED_LIST_LENGTH}}}?(?=\n\s*Anlage\s*\d*\s*\n|\Z)', re.DOTALL)
IMPRINT_START = re.compile(r'(?:Gesamtherstellung|Druck und Vertrieb|Druck|Vertrieb)\s*:')
URL = re.compile(r'(?:https?|ftp)://\S+|www\.\S+')
# Text recognition sometimes puts the hyphen on a line of its own ("Euro\n-\npäer").
HYPHEN_AT_LINE_END = re.compile(r'(\w+)(?:[ \t]*\n)?[ \t]*-[ \t]*\n\s*(\w+)')
# "Außen-" before "und Innenpolitik" at a line break is an enumeration, not a split word.
ENUMERATION_CONJUNCTIONS = {'und', 'oder', 'bzw', 'sowie', 'bis', 'wie'}
SEPARATORS = re.compile('[#"!$%&\'()*+,‚.:;<=>?@\\[\\]^_`{|}~„“”‘’«»‹›–—…/ʼ\xa0\\s]+')
REPEATED_LETTER = re.compile(r'([A-Za-z])\1{4,}')
HAS_LETTER = re.compile(r'[A-Za-zÄÖÜäöüß]')


def session_start(text: str) -> int:
    candidates = []
    marker = SESSION_START_MARKER.search(text)
    if marker and len(text) - marker.start() >= MINIMUM_TEXT_AFTER_SESSION_START:
        candidates.append(marker.start())
    chair = FIRST_LINE_OF_CHAIR.search(text)
    if chair and chair.start() <= len(text) * MAXIMUM_SHARE_BEFORE_FIRST_LINE_OF_CHAIR:
        candidates.append(chair.start())
    return min(candidates, default=0)


def from_session_start(text: str) -> str:
    return text[session_start(text):]


def without_imprint(text: str) -> str:
    window_start = max(0, len(text) - IMPRINT_SEARCH_WINDOW)
    match = IMPRINT_START.search(text, window_start)
    return text[:match.start()] if match else text


def without_excused_members(text: str) -> str:
    """The list stands in the appendix after the end of the session; the table of contents mentions it too."""
    session_ends = list(SESSION_END.finditer(text))
    appendix_start = session_ends[-1].end() if session_ends else 0
    return text[:appendix_start] + EXCUSED_MEMBERS.sub('', text[appendix_start:])


def without_print_layout(text: str) -> str:
    text = RUNNING_HEAD.sub('', text)
    return without_imprint(without_excused_members(text))


def join_line_end_hyphenation(text: str) -> str:
    def join(match: re.Match) -> str:
        beginning, continuation = match.groups()
        if continuation in ENUMERATION_CONJUNCTIONS:
            return match.group(0)
        split_word = continuation[0].islower() or (beginning.isupper() and continuation.isupper())
        return f'{beginning}{"" if split_word else "-"}{continuation}\n'
    return HYPHEN_AT_LINE_END.sub(join, text)


def looks_like_abbreviation(part: str) -> bool:
    capitals = sum(character.isupper() for character in part)
    return part[:1].isupper() and capitals >= 2 and len(part) <= MAXIMUM_ABBREVIATION_LENGTH


def has_capital_inside_word(word: str) -> bool:
    """Capitals inside a word mark glued words or OCR errors, except in abbreviations (AfD, CSU-Fraktion)."""
    return any(any(character.isupper() for character in part[1:])
               for part in word.split('-') if not looks_like_abbreviation(part))


def is_countable(word: str) -> bool:
    if len(word) < 2 or (len(word) == 2 and word[0].islower()):
        return False
    if word.startswith('-') or word.endswith('-') or not HAS_LETTER.search(word):
        return False
    if any(character.isdigit() or character in '§' for character in word):
        return False
    return not (REPEATED_LETTER.search(word) or has_capital_inside_word(word))


def extract_words(text: str) -> list[str]:
    text = without_print_layout(from_session_start(text))
    text = join_line_end_hyphenation(URL.sub(' ', text))
    return [word for word in SEPARATORS.split(text) if is_countable(word)]
