"""Find who said a lemma first, from the structured protocols of the Bundestag (19th electoral term onwards).

The open data page of the Bundestag lists one XML file per session; the lists are found on the page itself, so a
new electoral term needs no change here. In such a file every speech names its speaker, remarks of the chair follow
a <name> element, and interjections are <kommentar> elements. The text is read in document order; the first speech
or remark of the chair that contains a form of the lemma names the speaker. A lemma that first occurs only in an
interjection has no speaker.
"""

import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ElementTree
from collections.abc import Iterator, Mapping
from pathlib import Path

from protocol_text import extract_words

OPEN_DATA_PAGE = 'https://www.bundestag.de/services/opendata'
LISTING_URL = 'https://www.bundestag.de/ajax/filterlist/de/services/opendata/{listing_id}-{listing_id}'
LISTING_PAGE_SIZE = 20
FIRST_TERM_WITH_SPEAKERS = 19
USER_AGENT = 'plenum-first-said-website (https://github.com/ungeschneuer/plenum_first_said_website)'
SECONDS_BETWEEN_REQUESTS = 0.5
LISTING_ID = re.compile(r'ajax/filterlist/de/services/opendata/(\d+)-\1')
PROTOCOL_LINK = re.compile(r'href="(https://www\.bundestag\.de/resource/blob/\d+/(\d{5})\.xml)"')
SPOKEN_PARTS = ('sitzungsverlauf', 'anlagen')
# Paragraph classes of spoken text and quotations read out; lists of names, vote tables and agenda titles are not.
SPOKEN_PARAGRAPH_CLASSES = {'J', 'J_1', 'O', 'Z'}


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read()
    time.sleep(SECONDS_BETWEEN_REQUESTS)
    return body


def protocol_key(wahlperiode: int, session: int) -> str:
    return f'{wahlperiode:02d}{session:03d}'


def structured_protocol_urls() -> dict[str, str]:
    page = fetch(OPEN_DATA_PAGE).decode('utf-8', 'replace')
    urls: dict[str, str] = {}
    for listing_id in sorted(set(LISTING_ID.findall(page))):
        offset = 0
        while True:
            listing = fetch(LISTING_URL.format(listing_id=listing_id)
                            + f'?limit={LISTING_PAGE_SIZE}&noFilterSet=true&offset={offset}').decode('utf-8', 'replace')
            links_on_page = {key: url for url, key in PROTOCOL_LINK.findall(listing)}
            if not links_on_page.keys() - urls.keys():
                break
            urls.update(links_on_page)
            offset += len(links_on_page)
    return urls


def load_structured_protocol(url: str, cache_directory: Path) -> ElementTree.Element:
    cached = cache_directory / url.rsplit('/', 1)[-1]
    if not cached.exists():
        cache_directory.mkdir(parents=True, exist_ok=True)
        cached.write_bytes(fetch(url))
    return ElementTree.parse(cached).getroot()


def speaker_of_speech(redner: ElementTree.Element) -> dict:
    name = redner.find('name')
    speaker = {'name': ' '.join(filter(None, (name.findtext('vorname'), name.findtext('nachname'))))}
    party = name.findtext('fraktion')
    role = name.findtext('rolle/rolle_lang')
    if party:
        speaker['fraktion'] = party
    if role:
        speaker['rolle'] = role
    return speaker


def speaker_of_chair(name: ElementTree.Element) -> dict:
    words = ''.join(name.itertext()).strip().rstrip(':').split()
    return {'name': ' '.join(words[1:]), 'rolle': words[0]} if len(words) > 1 else {'name': ' '.join(words)}


def spoken_passages(root: ElementTree.Element) -> Iterator[tuple[dict | None, str]]:
    """Yield (speaker, text) in document order; interjections have no speaker."""
    for part in (root.find(name) for name in SPOKEN_PARTS):
        if part is None:
            continue
        names_of_speakers = {id(name) for redner in part.iter('redner') for name in redner.iter('name')}
        speaker = None
        for element in part.iter():
            if element.tag == 'p' and element.get('klasse') == 'redner' and element.find('redner') is not None:
                speaker = speaker_of_speech(element.find('redner'))
            elif element.tag == 'name' and id(element) not in names_of_speakers:
                speaker = speaker_of_chair(element)
            elif element.tag == 'kommentar':
                yield None, ''.join(element.itertext())
            elif element.tag == 'p' and (element.get('klasse') or '').startswith('Anlage'):
                speaker = None
            elif element.tag == 'p' and element.get('klasse') in SPOKEN_PARAGRAPH_CLASSES:
                yield speaker, ''.join(element.itertext())


def first_speakers(root: ElementTree.Element, wanted_lemmas: set[str],
                   lemma_of_form: Mapping[str, str]) -> dict[str, dict | None]:
    found: dict[str, dict | None] = {}
    for speaker, text in spoken_passages(root):
        for form in extract_words(text):
            lemma = lemma_of_form.get(form)
            if lemma in wanted_lemmas and lemma not in found:
                found[lemma] = speaker
        if len(found) == len(wanted_lemmas):
            break
    return {lemma: found.get(lemma) for lemma in wanted_lemmas}


def attach_first_speakers(entries: list[dict], first_protocol_of_lemma: Mapping[str, int],
                          first_speaker_of_lemma: dict[str, dict | None], lemma_of_form: Mapping[str, str],
                          cache_directory: Path) -> None:
    """Fill first_speaker_of_lemma for lemmas first said from the 19th term on that have no entry yet."""
    wanted_by_protocol: dict[int, set[str]] = {}
    for lemma, protocol_index in first_protocol_of_lemma.items():
        if entries[protocol_index]['wahlperiode'] >= FIRST_TERM_WITH_SPEAKERS and lemma not in first_speaker_of_lemma:
            wanted_by_protocol.setdefault(protocol_index, set()).add(lemma)
    if not wanted_by_protocol:
        return
    urls = structured_protocol_urls()
    print(f'Redner für {len(wanted_by_protocol)} Protokolle suchen, {len(urls)} strukturierte Protokolle gelistet',
          file=sys.stderr)
    for protocol_index, lemmas in sorted(wanted_by_protocol.items()):
        entry = entries[protocol_index]
        wahlperiode, session = entry['nummer'].split('/')
        url = urls.get(protocol_key(int(wahlperiode), int(session)))
        if url is None:
            continue
        root = load_structured_protocol(url, cache_directory)
        first_speaker_of_lemma.update(first_speakers(root, lemmas, lemma_of_form))
