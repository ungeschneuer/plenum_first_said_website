"""The line that opens a speech: it names the speaker and ends with a colon, in all decades alike.

  members        "Dr. Schellenberg (SPD): Herr Präsident!"   "Britta Haßelmann (BÜNDNIS 90/DIE GRÜNEN):"
  the chair      "Vizepräsidentin Petra Pau:"                 "Präsident D. Dr. Gerstenmaier: Die Sitzung ist eröffnet."
  the government "Dr. Erhard, Bundesminister für Wirtschaft:"  "Bundesminister Dr. Erhard:"

The line is printed, not spoken: it is not counted (pipeline/protocol_text.py) but splits the text into speeches
(pipeline/text_speakers.py).
"""

import re

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
