"""Turn the text of a plenary protocol into the word forms that are counted.

The text starts at the opening of the session; the table of contents before it is dropped. Older texts mark the
opening with "Beginn: 9.00 Uhr", texts in DIP's current format start with the first line of the chair
("Präsidentin Bärbel Bas:"); whichever comes first counts.
Parts that are print layout rather than speech are removed: the running head of every printed page, the list of
excused members in the appendix and the printer's imprint at the end. Words split at the end of a line are joined,
also across a removed running head. Numbers, single letters, glued words with capitals inside and fragments of
enumerations ("Bundes- und Landesrecht") are not counted; abbreviations such as AfD or CSU-Fraktion are.

Lists of roll-call votes are not counted either: older texts print them as lines "Glüsing ja Nellen ja", current
ones as a block of names after "Endgültiges Ergebnis".

Lines that open a speech ("Dr. Schellenberg (SPD):") are printed, not spoken, and are not counted. A capitalised
word right after a title or form of address ("General Handy", "Frau Klein", "Dr. Wolfgang Schäuble") is a name
and counted as "Handy (Name)", so that it does not count for the word Handy. A second capitalised word belongs to
the name only after a first name ("Dr. Wolfgang Schäuble"; "Frau Merkel Recht gegeben" keeps Recht). Without a
title, a first name followed by the surname of a member of the Bundestag is a name too ("Oskar Müller, Rudolf Kohl").
"""

import re
from collections.abc import Iterator
from dataclasses import dataclass

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
DASH = r'[-–—]'
WEEKDAY = r'(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag)'
RUNNING_HEAD = re.compile(
    rf'[ \t]*Deutscher Bundestag\s*{DASH}\s*\d+\.\s*Wahlperiode\s*{DASH}\s*\d+\.\s*Sitzung\.?\s*'
    rf'(?:Bonn|Berlin)?\s*,?\s*(?:den\s+)?(?:{WEEKDAY}\s*,?\s*)?(?:den\s+)?\d{{1,2}}\.\s*[A-Za-zÄÖÜäöü]+\s+\d{{4}}'
    r'[ \t]*\d*\s*\*?[ \t]*\n?')
# The list holds names, groups, dates and a header; it ends with the first other line or the next appendix.
EXCUSED_LIST_WORD = (r"(?:[A-ZÄÖÜ0-9(\[][^\s\xa0]*|von|van|vom|de|der|den|zu|dos|da|am|an|im|in|bei|bis|einschließlich"
                     r"|entschuldigt|beurlaubt|und|[*,.–-]+)")
EXCUSED_LIST_LINE = rf'(?![ \t\xa0]*Anlage)[ \t\xa0]*(?:{EXCUSED_LIST_WORD}[ \t\xa0]*)*'
EXCUSED_MEMBERS = re.compile(
    r'(?:Liste der (?:entschuldigten|beurlaubten) Abgeordneten|Entschuldigte Abgeordnete|Beurlaubte Abgeordnete)'
    rf'[^\n]*\n(?:{EXCUSED_LIST_LINE}\n)*')
IMPRINT_START = re.compile(r'(?:Gesamtherstellung|Druck und Vertrieb|Druck|Vertrieb)\s*:')
VOTE = r'(?:ja|nein|enthalten|entschuldigt|beurlaubt|krank|—|--|-)'
VOTER = r"(?:Frau[ \t]+)?(?:Dr\.[ \t]*)?(?:[A-ZÄÖÜ][\w’'\-]*\.?[ \t]*){1,3}(?:\([^)\n]{1,30}\)[ \t]*)?"
OLD_VOTE_LINE = re.compile(rf'^[ \t]*(?:{VOTER}[ \t.]+{VOTE}[ \t]*){{1,2}}$|^[ \t]*Name[ \t]+Abstimmung.*$',
                           re.MULTILINE)
# Under a result follow lines of names, groups and figures; the first line with ordinary lower-case words ends it.
LIST_LINE_WORD = (r"(?:[A-ZÄÖÜ0-9(\[][^\s\xa0]*|von|van|vom|de|der|den|zu|dos|da|am|an|im|in|bei|ob|a\.|d\.|"
                  r"(?:ja|nein|enthalten|davon|ungültig|gültig):?)")
LIST_LINE = rf'[ \t\xa0]*(?:{LIST_LINE_WORD}[ \t\xa0]*)*'
CURRENT_VOTE_LIST = re.compile(rf'(?:Endgültiges|Vorläufiges) Ergebnis[ \t]*\n(?:{LIST_LINE}\n)*')
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


def without_vote_lists(text: str) -> str:
    return CURRENT_VOTE_LIST.sub('', OLD_VOTE_LINE.sub('', text))


def join_line_end_hyphenation(text: str) -> str:
    def join(match: re.Match) -> str:
        beginning, continuation = match.groups()
        if continuation in ENUMERATION_CONJUNCTIONS:
            return match.group(0)
        split_word = continuation[0].islower() or (beginning.isupper() and continuation.isupper())
        return f'{beginning}{"" if split_word else "-"}{continuation}\n'
    return HYPHEN_AT_LINE_END.sub(join, text)


def looks_like_abbreviation(part: str) -> bool:
    """AfD, CSU, CO2, G20, 5G."""
    capitals = sum(character.isupper() for character in part)
    has_digit = any(character.isdigit() for character in part)
    starts_well = part[:1].isupper() or (part[:1].isdigit() and capitals >= 1)
    return starts_well and (capitals >= 2 or has_digit and capitals >= 1) and len(part) <= MAXIMUM_ABBREVIATION_LENGTH


def has_capital_inside_word(word: str) -> bool:
    """Capitals inside a word mark glued words or OCR errors, except in abbreviations (AfD, CSU-Fraktion)."""
    return any(any(character.isupper() for character in part[1:])
               for part in word.split('-') if not looks_like_abbreviation(part))


def has_enough_letters_beside_digits(word: str) -> bool:
    """CO2, G20, 5G and Covid-19 are words; 1990, 3a and page references are not."""
    letters = [character for character in word if character.isalpha()]
    return len(letters) >= 2 or any(character.isupper() for character in letters)


def is_countable(word: str) -> bool:
    """Two-letter words count only as capitalised abbreviations (EU, UN); zu, ja or Es do not count at all."""
    if len(word) < 2 or (len(word) == 2 and not word.isupper()):
        return False
    if word.startswith('-') or word.endswith('-') or not HAS_LETTER.search(word) or '§' in word:
        return False
    if any(character.isdigit() for character in word) and not has_enough_letters_beside_digits(word):
        return False
    return not (REPEATED_LETTER.search(word) or has_capital_inside_word(word))


def clean_text(text: str) -> str:
    """The spoken part of a protocol, without print layout and with words joined across line breaks."""
    return join_line_end_hyphenation(URL.sub(' ', without_vote_lists(without_print_layout(from_session_start(text)))))


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
def read_names(file_name: str) -> frozenset[str]:
    lines = Path(__file__).with_name(file_name).read_text().splitlines()
    return frozenset(line for line in lines if line and not line.startswith('#'))


FIRST_NAMES = read_names('first_names.txt')
MEMBER_SURNAMES = read_names('member_surnames.txt')
MULTIWORD_TERMS: dict[tuple[str, ...], str] = {}
MULTIWORD_TERM_LENGTHS: tuple[int, ...] = ()


def is_capitalised(word: str) -> bool:
    return word[:1].isupper() and not word.isupper()


def directly_follows(passage: str, previous_word: str, previous_end: int, start: int) -> bool:
    gap = passage[previous_end:start].strip()
    return gap == '' or (gap == '.' and previous_word in ABBREVIATED_TITLES)


def acts_as_title(word: str, word_before: str | None) -> bool:
    return word in TITLES and not (word in NOUNS_AS_FORM_OF_ADDRESS and word_before in DETERMINERS)


def glued_after_form_of_address(word: str, previous_word: str | None) -> bool:
    """Text recognition glues "Herr Bundeskanzler in seiner" into "Herr Bundeskanzlerin"; Herr never takes -in."""
    return previous_word in ('Herr', 'Herrn') and word.endswith('in') and word[:-2] in TITLES


ADJECTIVE_ENDINGS = ('en', 'em', 'er', 'es', 'e')
NOUN_ENDINGS = ('', 's', 'es', 'n', 'en')


def inflection_stem(word: str) -> str:
    lowercase = word.lower()
    for ending in ADJECTIVE_ENDINGS:
        if lowercase.endswith(ending) and len(lowercase) - len(ending) >= 3:
            return lowercase[:-len(ending)]
    return lowercase


def read_multiword_terms() -> dict[tuple[str, ...], str]:
    """Map the stems of a term's parts to the term: ("künstlich", "Intelligenz") -> "Künstliche Intelligenz"."""
    terms = {}
    for term in read_names('multiword_terms.txt'):
        *modifiers, head = term.split()
        terms[tuple(inflection_stem(modifier) for modifier in modifiers) + (head,)] = term
    return terms


def multiword_terms_in(passage: str, words: list[tuple[str, int, int, bool]]) -> Iterator[tuple[str, int, int]]:
    """Terms of multiword_terms.txt whose words follow each other directly, in any inflection of the modifiers."""
    for length in MULTIWORD_TERM_LENGTHS:
        for index in range(len(words) - length + 1):
            parts = words[index:index + length]
            if not all(passage[first[2]:second[1]].strip() == '' for first, second in zip(parts, parts[1:])):
                continue
            *modifiers, head = parts
            stems = tuple(inflection_stem(word) for word, _, _, _ in modifiers)
            for ending in NOUN_ENDINGS:
                if head[0].endswith(ending) and (term := MULTIWORD_TERMS.get(stems + (head[0][:len(head[0]) - len(ending)],))):
                    yield term, parts[0][1], head[2]
                    break


@dataclass(frozen=True)
class Token:
    word: str
    start: int
    end: int
    countable: bool


def tokens_of(passage: str) -> list[Token]:
    """Countable words, and titles that are not counted themselves but mark the name after them (Dr)."""
    tokens, previous_word = [], None
    for match in TOKEN.finditer(passage):
        word = match.group(0)
        countable = is_countable(word)
        if not countable and word not in TITLES:
            continue
        if countable and glued_after_form_of_address(word, previous_word):
            tokens.append(Token(word[:-2], match.start(), match.end() - 2, True))
            previous_word = 'in'
        else:
            tokens.append(Token(word, match.start(), match.end(), countable))
            previous_word = word
    return tokens


def separated_by_comma(passage: str, first: Token, second: Token) -> bool:
    return passage[first.end:second.start].strip() == ','


def name_flags(passage: str, tokens: list[Token]) -> list[bool]:
    """Which tokens are parts of names: after a title, a member's first name followed by the surname, or members'
    surnames listed with commas ("Frau Thiele, Kohl, Niebergall")."""
    flags = [False] * len(tokens)
    previous_is_title, name_parts = False, 0
    for index, token in enumerate(tokens):
        previous = tokens[index - 1] if index else None
        follows = previous is not None and directly_follows(passage, previous.word, previous.end, token.start)
        starts_name = follows and previous_is_title and is_capitalised(token.word) and token.word not in TITLES
        continues_name = (follows and name_parts == 1 and previous.word in FIRST_NAMES and is_capitalised(token.word)
                          and token.word not in TITLES)
        if starts_name or continues_name:
            flags[index] = True
        if not flags[index] and token.word in FIRST_NAMES and index + 1 < len(tokens):
            following = tokens[index + 1]
            if following.word in MEMBER_SURNAMES and directly_follows(passage, token.word, token.end, following.start):
                flags[index] = flags[index + 1] = True
        name_parts = name_parts + 1 if flags[index] else 0
        previous_is_title = not flags[index] and acts_as_title(token.word, previous.word if follows else None)
    def is_listed_name(index: int) -> bool:
        return tokens[index].word in MEMBER_SURNAMES or flags[index]

    for index, token in enumerate(tokens):
        if flags[index] or token.word not in MEMBER_SURNAMES:
            continue
        listed_before = index > 0 and separated_by_comma(passage, tokens[index - 1], token) and is_listed_name(index - 1)
        listed_after = (index + 1 < len(tokens) and separated_by_comma(passage, token, tokens[index + 1])
                        and is_listed_name(index + 1))
        flags[index] = listed_before or listed_after
    return flags


def words_with_positions(passage: str) -> Iterator[tuple[str, int, int]]:
    """Countable words with their position; names carry NAME_SUFFIX; multiword terms follow their last word."""
    tokens = tokens_of(passage)
    flags = name_flags(passage, tokens)
    words = [(token.word + NAME_SUFFIX if is_name else token.word, token.start, token.end, token.countable)
             for token, is_name in zip(tokens, flags)]
    for term, start, end in multiword_terms_in(passage, words):
        words.append((term, start, end, True))
    words.sort(key=lambda word: (word[1], word[2]))
    for word, start, end, countable in words:
        if countable:
            yield word, start, end


def is_multiword_term(form: str) -> bool:
    """Multiword terms are counted besides their words; they do not add to the number of words of a protocol."""
    return form in MULTIWORD_TERM_NAMES


def extract_words(text: str) -> list[str]:
    return words_of(without_speaker_lines(clean_text(text)))


MULTIWORD_TERMS.update(read_multiword_terms())
MULTIWORD_TERM_NAMES = frozenset(MULTIWORD_TERMS.values())
MULTIWORD_TERM_LENGTHS = tuple(sorted({len(key) for key in MULTIWORD_TERMS}, reverse=True))
