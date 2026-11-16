"""Choose the text of each protocol from the most reliable source.

  1st to 18th electoral term: the open data archives of the Bundestag (pp01.zip ... pp18.zip), one XML file per
                              session with the full text; complete and unchanged since publication
  from the 19th term on:      the structured protocol of the Bundestag, written out with speaker lines as the plain
                              texts have them
  otherwise:                  the text of DIP, unless it is the preliminary report ("Der ... endgültige
                              Stenografische Bericht ... wird am ... veröffentlicht"), and last the text of the PDF

DIP texts are not the first choice: since DIP changed its format, some are cut off within the appendix (18/20 lost a
third) or are the preliminary report (19/55 lost a fifth), and in the current format a cut text cannot be told from
a complete one by its ending. A recent protocol of the 19th term or later without a structured protocol yet is left
out and tried again in a later run, so that no preliminary text stays in the data.
"""

import io
import re
import sys
import urllib.request
import xml.etree.ElementTree as ElementTree
import zipfile
from collections.abc import Callable
from pathlib import Path

from http_retry import fetch_bytes
from speakers import (FIRST_TERM_WITH_SPEAKERS, LISTING_ID, LISTING_PAGE_SIZE, LISTING_URL, OPEN_DATA_PAGE,
                      SPOKEN_PARTS, USER_AGENT, speaker_of_speech)

ARCHIVE_LINK = re.compile(r'href="(https://www\.bundestag\.de/resource/blob/\d+/pp(\d{2})\.zip)"')
MINIMUM_TEXT_LENGTH = 100
# Special sessions (for example "SDr 2000") have other numbers and are not in the archives.
SESSION_NUMBER = re.compile(r'(\d+)/(\d+)')
PRELIMINARY_REPORT = re.compile(r'endgültige\s+Stenografische\s+Bericht.{0,120}?wird\s+am', re.DOTALL)
PRELIMINARY_SEARCH_WINDOW = 4000
# Some PDFs use a font whose characters text extraction returns as (cid:n); n + 29 is ASCII, the rest is mapped here.
CID_OFFSET = 29
CID_CHARACTERS = {108: 'ä', 124: 'ö', 129: 'ü', 98: 'Ä', 103: 'Ö', 104: 'Ü', 137: 'ß', 177: '–', 196: '„', 179: '“',
                  182: '’', 181: '’', 134: '§', 112: 'é', 105: 'á'}
CID = re.compile(r'\(cid:(\d+)\)')

ARCHIVE = 'Archiv'
STRUCTURED = 'XML'
DIP = 'DIP'
PDF = 'PDF'


def has_text(text: str) -> bool:
    return len(text.strip()) >= MINIMUM_TEXT_LENGTH


def is_final_report(text: str) -> bool:
    return has_text(text) and not PRELIMINARY_REPORT.search(text[-PRELIMINARY_SEARCH_WINDOW:])


def character_of_cid(match: re.Match) -> str:
    code = int(match.group(1))
    if code in CID_CHARACTERS:
        return CID_CHARACTERS[code]
    character = chr(code + CID_OFFSET)
    return character if ' ' <= character <= '~' else ''


def text_of_pdf(path: Path) -> str:
    from pdfminer.high_level import extract_text
    return CID.sub(character_of_cid, extract_text(path))


def speaker_line(redner: ElementTree.Element) -> str:
    speaker = speaker_of_speech(redner)
    if speaker.get('fraktion'):
        return f"{speaker['name']} ({speaker['fraktion']}):"
    return f"{speaker['name']}, {speaker['rolle']}:" if speaker.get('rolle') else f"{speaker['name']}:"


def text_of_structured_protocol(path: Path) -> str:
    """The structured protocol written out like a plain text: speaker lines, paragraphs and interjections in order."""
    root = ElementTree.parse(path).getroot()
    lines = []
    for part in (root.find(name) for name in SPOKEN_PARTS):
        if part is None:
            continue
        names_of_speakers = {id(name) for redner in part.iter('redner') for name in redner.iter('name')}
        for element in part.iter():
            if element.tag == 'p' and element.get('klasse') == 'redner' and element.find('redner') is not None:
                lines.append(speaker_line(element.find('redner')))
            elif element.tag == 'name' and id(element) not in names_of_speakers:
                lines.append(''.join(element.itertext()).strip())
            elif element.tag in ('p', 'kommentar'):
                lines.append(''.join(element.itertext()).strip())
    return '\n'.join(lines)


class ProtocolArchives:
    """The open data archives of the 1st to 18th term, downloaded once per term and kept in the cache."""

    def __init__(self, cache_directory: Path):
        self.cache_directory = cache_directory
        self.urls: dict[int, str] | None = None
        self.opened: dict[int, zipfile.ZipFile] = {}

    def archive_urls(self) -> dict[int, str]:
        page = fetch_bytes(urllib.request.Request(OPEN_DATA_PAGE, headers={'User-Agent': USER_AGENT})).decode()
        urls = {}
        for listing_id in sorted(set(LISTING_ID.findall(page))):
            for offset in range(0, 40, LISTING_PAGE_SIZE // 2):
                listing = fetch_bytes(urllib.request.Request(
                    LISTING_URL.format(listing_id=listing_id) + f'?limit=10&noFilterSet=true&offset={offset}',
                    headers={'User-Agent': USER_AGENT})).decode()
                urls.update({int(term): url for url, term in ARCHIVE_LINK.findall(listing)})
        return urls

    def archive(self, wahlperiode: int) -> zipfile.ZipFile | None:
        if wahlperiode not in self.opened:
            path = self.cache_directory / f'pp{wahlperiode:02d}.zip'
            if not path.exists():
                self.urls = self.archive_urls() if self.urls is None else self.urls
                if wahlperiode not in self.urls:
                    return None
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(fetch_bytes(urllib.request.Request(self.urls[wahlperiode],
                                                                    headers={'User-Agent': USER_AGENT})))
                print(f'  Archiv der {wahlperiode}. Wahlperiode geladen', file=sys.stderr)
            self.opened[wahlperiode] = zipfile.ZipFile(path)
        return self.opened[wahlperiode]

    def text(self, entry: dict) -> str:
        number = SESSION_NUMBER.fullmatch(entry['nummer'].strip())
        if number is None:
            return ''
        wahlperiode, session = int(number.group(1)), int(number.group(2))
        archive = self.archive(wahlperiode)
        name = f'{wahlperiode:02d}{session:03d}.xml'
        if archive is None or name not in archive.namelist():
            return ''
        return ElementTree.parse(io.BytesIO(archive.read(name))).getroot().findtext('TEXT') or ''


def complete_text(entry: dict, archive_text: Callable[[dict], str], structured_protocol: Callable[[dict], Path | None],
                  dip_text: Callable[[dict], str], pdf: Callable[[dict], Path | None]) -> tuple[str, str] | None:
    """(text, source) from the most reliable source that has the protocol, or None if none has a final text yet."""
    if entry['wahlperiode'] >= FIRST_TERM_WITH_SPEAKERS:
        path = structured_protocol(entry)
        if path is not None:
            return text_of_structured_protocol(path), STRUCTURED
        return None
    text = archive_text(entry)
    if has_text(text):
        return text, ARCHIVE
    text = dip_text(entry)
    if is_final_report(text):
        return text, DIP
    path = pdf(entry)
    if path is not None and has_text(text := text_of_pdf(path)):
        return text, PDF
    return None
