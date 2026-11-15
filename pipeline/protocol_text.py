"""Turn the text of a plenary protocol into the word forms that are counted.

The text starts at the opening of the session ("Beginn: 9.00 Uhr"); the table of contents before it is dropped.
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

SESSION_START = re.compile(r'Beginn\s*:\s*\d')
DASH = r'[-–—]'
WEEKDAY = r'(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag)'
RUNNING_HEAD = re.compile(
    rf'[ \t]*Deutscher Bundestag\s*{DASH}\s*\d+\.\s*Wahlperiode\s*{DASH}\s*\d+\.\s*Sitzung\.?\s*'
    rf'(?:Bonn|Berlin)?\s*,?\s*(?:den\s+)?(?:{WEEKDAY}\s*,?\s*)?(?:den\s+)?\d{{1,2}}\.\s*[A-Za-zÄÖÜäöü]+\s+\d{{4}}'
    r'[ \t]*\d*\s*\*?[ \t]*\n?')
EXCUSED_MEMBERS = re.compile(
    r'(?:Liste der (?:entschuldigten|beurlaubten) Abgeordneten|Entschuldigte Abgeordnete|Beurlaubte Abgeordnete)'
    r'.*?(?=\n\s*Anlage\s*\d*\s*\n|\Z)', re.DOTALL)
IMPRINT_START = re.compile(r'(?:Gesamtherstellung|Druck und Vertrieb|Druck|Vertrieb)\s*:')
URL = re.compile(r'(?:https?|ftp)://\S+|www\.\S+')
# Text recognition sometimes puts the hyphen on a line of its own ("Euro\n-\npäer").
HYPHEN_AT_LINE_END = re.compile(r'(\w+)(?:[ \t]*\n)?[ \t]*-[ \t]*\n\s*(\w+)')
# "Außen-" before "und Innenpolitik" at a line break is an enumeration, not a split word.
ENUMERATION_CONJUNCTIONS = {'und', 'oder', 'bzw', 'sowie', 'bis', 'wie'}
SEPARATORS = re.compile('[#"!$%&\'()*+,‚.:;<=>?@\\[\\]^_`{|}~„“”‘’«»‹›–—…/ʼ\xa0\\s]+')
REPEATED_LETTER = re.compile(r'([A-Za-z])\1{4,}')
HAS_LETTER = re.compile(r'[A-Za-zÄÖÜäöüß]')


def from_session_start(text: str) -> str:
    match = SESSION_START.search(text)
    if match and len(text) - match.start() >= MINIMUM_TEXT_AFTER_SESSION_START:
        return text[match.start():]
    return text


def without_imprint(text: str) -> str:
    window_start = max(0, len(text) - IMPRINT_SEARCH_WINDOW)
    match = IMPRINT_START.search(text, window_start)
    return text[:match.start()] if match else text


def without_print_layout(text: str) -> str:
    text = RUNNING_HEAD.sub('', text)
    text = EXCUSED_MEMBERS.sub('', text)
    return without_imprint(text)


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
