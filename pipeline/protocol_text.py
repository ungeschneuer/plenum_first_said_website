"""Turn the text of a plenary protocol into the word forms that are counted.

The text starts at the opening of the session; the table of contents before it is dropped. Older texts mark the
opening with "Beginn: 9.00 Uhr", texts in DIP's current format start with the first line of the chair
("Präsidentin Bärbel Bas:"); whichever comes first counts.
Parts that are print layout rather than speech are removed: the running head of every printed page, the list of
excused members in the appendix and the printer's imprint at the end. Words split at the end of a line are joined,
also across a removed running head. Numbers, single letters, glued words with capitals inside and fragments of
enumerations ("Bundes- und Landesrecht") are not counted; abbreviations such as AfD or CSU-Fraktion are.

Lines that open a speech ("Dr. Schellenberg (SPD):") are printed, not spoken, and are not counted. A capitalised
word right after a title or form of address ("General Handy", "Frau Klein", "Dr. Wolfgang Schäuble") is a name
and counted as "Handy (Name)", so that it does not count for the word Handy. A second capitalised word belongs to
the name only after a first name ("Dr. Wolfgang Schäuble"; "Frau Merkel Recht gegeben" keeps Recht).
"""

import re
from collections.abc import Iterator

from pathlib import Path

from speaker_lines import SPEAKER_LINE

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
SEPARATOR_CHARACTERS = '#"!$%&\'()*+,‚.:;<=>?@\\[\\]^_`{|}~„“”‘’«»‹›–—…/ʼ\xa0\\s'
SEPARATORS = re.compile(f'[{SEPARATOR_CHARACTERS}]+')
TOKEN = re.compile(f'[^{SEPARATOR_CHARACTERS}]+')
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


def clean_text(text: str) -> str:
    """The spoken part of a protocol, without print layout and with words joined across line breaks."""
    return join_line_end_hyphenation(URL.sub(' ', without_print_layout(from_session_start(text))))


def words_of(passage: str) -> list[str]:
    return [word for word, _, _ in words_with_positions(passage)]


def without_speaker_lines(text: str) -> str:
    return SPEAKER_LINE.sub('', text)


NAME_SUFFIX = ' (Name)'
TITLES = frozenset({
    'Herr', 'Herrn', 'Frau', 'Fräulein', 'Dr', 'Prof', 'Professor', 'Professorin', 'Abg',
    'Kollege', 'Kollegin', 'Kollegen', 'Abgeordneter', 'Abgeordnete', 'Abgeordneten',
    'Minister', 'Ministerin', 'Bundesminister', 'Bundesministerin', 'Staatsminister', 'Staatsministerin',
    'Staatssekretär', 'Staatssekretärin', 'Parlamentarischer', 'Parlamentarische', 'Parl', 'Präsident', 'Präsidentin', 'Vizepräsident', 'Vizepräsidentin',
    'Bundespräsident', 'Bundespräsidentin', 'Bundeskanzler', 'Bundeskanzlerin', 'Kanzler', 'Kanzlerin',
    'Ministerpräsident', 'Ministerpräsidentin', 'Bürgermeister', 'Bürgermeisterin', 'Senator', 'Senatorin',
    'General', 'Generalin', 'Oberst', 'Admiral', 'Botschafter', 'Botschafterin', 'Graf', 'Gräfin', 'Freiherr',
    'Baron', 'Bischof', 'Pfarrer', 'Papst', 'König', 'Königin',
})
# Abbreviated titles are followed by a point: "Dr. Schäuble", "Abg. Wehner".
ABBREVIATED_TITLES = frozenset({'Dr', 'Prof', 'Abg', 'Parl'})
# After these, Frau and Herr are nouns, not forms of address: "jede Frau Kinder".
DETERMINERS = frozenset({
    'der', 'die', 'das', 'dem', 'den', 'des', 'ein', 'eine', 'einer', 'einem', 'einen', 'eines', 'jede', 'jeder',
    'jedem', 'jeden', 'keine', 'keiner', 'diese', 'dieser', 'diesem', 'jene', 'jener', 'welche', 'welcher', 'manche',
})
NOUNS_AS_FORM_OF_ADDRESS = frozenset({'Frau', 'Herr', 'Herrn'})
FIRST_NAMES = frozenset(line for line in Path(__file__).with_name('first_names.txt').read_text().splitlines()
                        if line and not line.startswith('#'))


def is_capitalised(word: str) -> bool:
    return word[:1].isupper() and not word.isupper()


def directly_follows(passage: str, previous_word: str, previous_end: int, start: int) -> bool:
    gap = passage[previous_end:start].strip()
    return gap == '' or (gap == '.' and previous_word in ABBREVIATED_TITLES)


def acts_as_title(word: str, word_before: str | None) -> bool:
    return word in TITLES and not (word in NOUNS_AS_FORM_OF_ADDRESS and word_before in DETERMINERS)


def words_with_positions(passage: str) -> Iterator[tuple[str, int, int]]:
    """Countable words with their position; names after titles carry NAME_SUFFIX."""
    previous_word, previous_end, previous_is_title, name_parts, word_before = None, 0, False, 0, None
    for match in TOKEN.finditer(passage):
        word = match.group(0)
        if not is_countable(word):
            continue
        follows = previous_word is not None and directly_follows(passage, previous_word, previous_end, match.start())
        starts_name = follows and previous_is_title and is_capitalised(word) and word not in TITLES
        continues_name = (follows and name_parts == 1 and previous_word in FIRST_NAMES and is_capitalised(word)
                          and word not in TITLES)
        name_parts = name_parts + 1 if starts_name or continues_name else 0
        is_title = name_parts == 0 and acts_as_title(word, previous_word if follows else None)
        yield (word + NAME_SUFFIX if name_parts else word), match.start(), match.end()
        word_before, previous_word, previous_end, previous_is_title = previous_word, word, match.end(), is_title


def extract_words(text: str) -> list[str]:
    return words_of(without_speaker_lines(clean_text(text)))
