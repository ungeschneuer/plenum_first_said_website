"""Find speakers in the plain text of a protocol, for the years before the structured protocols (19th term).

A speech starts with a line that names the speaker and ends with a colon, in all decades alike:
  members        "Dr. Schellenberg (SPD): Herr Präsident!"   "Britta Haßelmann (BÜNDNIS 90/DIE GRÜNEN):"
  the chair      "Vizepräsidentin Petra Pau:"                 "Präsident D. Dr. Gerstenmaier: Die Sitzung ist eröffnet."
  the government "Dr. Erhard, Bundesminister für Wirtschaft:"  "Bundesminister Dr. Erhard:"
Text in parentheses (applause, interjections, printed matter) has no speaker.
"""

import re
from collections.abc import Iterator

from speakers import parliamentary_group

SPACE = r'[ \t\xa0]'
NAME_PART = (r"(?:Frau|Herr|Dr\.|D\.|Prof\.|h\.\s?c\.|[A-ZÄÖÜ]\.|von|van|vom|de|der|den|dos|da|del|di|in|le|la|ten|ter|zu"
             r"|[A-ZÄÖÜ][\w'’\-]*!?)")
NAME = rf'(?:{NAME_PART}{SPACE}+){{0,5}}[A-ZÄÖÜ][\w\'’\-]*!?(?:{SPACE}*\([A-ZÄÖÜ][^()\n:]{{1,30}}\))?'
PARTY = r'(?:[A-ZÄÖÜ][\w/ .\-\xa0]{1,40}|fraktionslos)'
CHAIR_ROLE = r'(?:Alters|Vize)?[Pp]räsident(?:in)?'
GOVERNMENT_ROLE = (r'(?:Bundes(?:kanzler|minister)(?:in)?|(?:Parl\.|Parlamentarische[rn]?)?' + SPACE
                   + r'*Staatssekretär(?:in)?|Staatsminister(?:in)?)')
SPEAKER_LINE = re.compile(
    rf'^{SPACE}*(?:'
    rf'(?P<chair_role>{CHAIR_ROLE}){SPACE}+(?P<chair_name>{NAME})'
    rf'|(?P<role_first>{GOVERNMENT_ROLE}(?:{SPACE}+(?:für|der|des|im|beim)[^:\n]{{0,80}}?)?){SPACE}+(?P<role_first_name>{NAME})'
    rf'|(?P<member_name>{NAME}){SPACE}*\((?P<party>{PARTY})\)'
    rf'|(?P<official_name>{NAME}),{SPACE}*(?P<official_role>{GOVERNMENT_ROLE}[^:\n]{{0,120}}?)'
    rf'){SPACE}*:(?:{SPACE}|$)', re.MULTILINE)
WHITESPACE = re.compile(r'[\s\xa0]+')
NOT_A_NAME = re.compile(r'\d|Tagesordnung|Drucksache|Anlage|Beratung|Fortsetzung|Fragestunde', re.IGNORECASE)
FORM_OF_ADDRESS = re.compile(r'^(?:Frau|Herr)\s+')
CONSTITUENCY = re.compile(r'\s*\([^()]*\)$')
NOT_A_PARTY = re.compile(r'Fortsetzung|Drucksache|Tagesordnung|Anlage|Ausschuss|Ausschuß|Seite|Punkt', re.IGNORECASE)


def tidy(text: str) -> str:
    return WHITESPACE.sub(' ', text).strip().rstrip('!')


def without_constituency(name: str) -> str:
    """Members with the same name are told apart by their constituency: "Detlef Müller (Chemnitz)"."""
    return FORM_OF_ADDRESS.sub('', CONSTITUENCY.sub('', name)).strip()


def speaker_from_line(match: re.Match) -> dict | None:
    groups = match.groupdict()
    if groups['chair_name']:
        speaker = {'name': without_constituency(tidy(groups['chair_name'])), 'rolle': tidy(groups['chair_role'])}
    elif groups['role_first_name']:
        speaker = {'name': without_constituency(tidy(groups['role_first_name'])), 'rolle': tidy(groups['role_first'])}
    elif groups['member_name']:
        speaker = {'name': without_constituency(tidy(groups['member_name'])), 'fraktion': parliamentary_group(groups['party'])}
    else:
        speaker = {'name': without_constituency(tidy(groups['official_name'])), 'rolle': tidy(groups['official_role'])}
    if NOT_A_NAME.search(speaker['name']) or NOT_A_PARTY.search(speaker.get('fraktion', '')):
        return None
    return speaker


def outside_parentheses(text: str) -> Iterator[tuple[bool, str]]:
    """Yield (in_parentheses, text) pieces; parentheses may span lines and nest."""
    depth, start = 0, 0
    for position, character in enumerate(text):
        if character == '(':
            if depth == 0 and position > start:
                yield False, text[start:position]
                start = position
            depth += 1
        elif character == ')' and depth:
            depth -= 1
            if depth == 0:
                yield True, text[start:position + 1]
                start = position + 1
    if start < len(text):
        yield depth > 0, text[start:]


def spoken_passages(text: str) -> Iterator[tuple[dict | None, str]]:
    """Yield (speaker, text) in reading order; text in parentheses and before the first speaker has no speaker."""
    speaker, position = None, 0
    for match in SPEAKER_LINE.finditer(text):
        yield from passages_of_section(speaker, text[position:match.start()])
        speaker = speaker_from_line(match) or speaker
        position = match.end()
    yield from passages_of_section(speaker, text[position:])


def passages_of_section(speaker: dict | None, section: str) -> Iterator[tuple[dict | None, str]]:
    for in_parentheses, piece in outside_parentheses(section):
        yield (None if in_parentheses else speaker), piece
