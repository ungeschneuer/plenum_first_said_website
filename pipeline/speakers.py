"""Find who said a lemma first, from the structured protocols of the Bundestag (19th electoral term onwards).

The open data page of the Bundestag lists one XML file per session; the lists are found on the page itself, so a
new electoral term needs no change here. In such a file every speech names its speaker, remarks of the chair follow
a <name> element, and interjections are <kommentar> elements. The text is read in document order; the first speech,
remark of the chair or named interjection ("Dr. Alice Weidel [AfD]: Das ist unfassbar!") that contains a form of
the lemma names the speaker; applause and anonymous interjections have none.

The same files give the counts per parliamentary group: every word of a speech counts for the group of its speaker,
words of members of the government for "Bundesregierung"; the chair and interjections are not counted.
"""

import multiprocessing
import re
import sys
from collections import Counter
import time
import urllib.request
import xml.etree.ElementTree as ElementTree
from collections.abc import Iterator, Mapping
from pathlib import Path

from http_retry import fetch_bytes
from protocol_text import words_of

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
INTERJECTION_SEPARATOR = re.compile(r'\s[–—-]\s')
NAMED_INTERJECTION = re.compile(
    r'^\(?(?:(?:Zuruf|Gegenruf)e? (?:des|der) Abg\. )?(?P<name>[A-ZÄÖÜ][^\[\]:()]{2,80}?)\s*(?:\[[^\]]{2,40}\]\s*)?'
    r'\[(?P<party>[^\]]{1,40})\]:\s*(?P<text>.+?)\)?$',
    re.DOTALL)
WHITESPACE = re.compile(r'[\s\xa0]+')
GROUP_NAMES = {'BÜNDNIS 90/DIE GRÜNEN': 'Bündnis 90/Die Grünen', 'DIE LINKE': 'Die Linke', 'DIE LINKE.': 'Die Linke',
               'Fraktionslos': 'fraktionslos'}
# The structured protocols of the 19th term on name these groups; a name made of two of them is a data error.
KNOWN_GROUPS = ('CDU/CSU', 'SPD', 'AfD', 'FDP', 'Bündnis 90/Die Grünen', 'Die Linke', 'BSW', 'fraktionslos')
GOVERNMENT = 'Bundesregierung'
GOVERNMENT_ROLES = re.compile(r'minister|kanzler|staatssekretär|beauftragt', re.IGNORECASE)


def fetch(url: str) -> bytes:
    body = fetch_bytes(urllib.request.Request(url, headers={'User-Agent': USER_AGENT}))
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


def download_structured_protocol(url: str, cache_directory: Path) -> Path:
    cached = cache_directory / url.rsplit('/', 1)[-1]
    if not cached.exists():
        cache_directory.mkdir(parents=True, exist_ok=True)
        cached.write_bytes(fetch(url))
    return cached


def tidy(text: str) -> str:
    return WHITESPACE.sub(' ', text).strip()


def parliamentary_group(party: str) -> str:
    party = tidy(party).replace('/ ', '/')
    return GROUP_NAMES.get(party, party)


def speaker_of_speech(redner: ElementTree.Element) -> dict:
    name = redner.find('name')
    speaker = {'name': ' '.join(filter(None, (name.findtext('vorname'), name.findtext('nachname'))))}
    party = name.findtext('fraktion')
    role = name.findtext('rolle/rolle_lang')
    if party:
        speaker['fraktion'] = parliamentary_group(party)
    if role:
        speaker['rolle'] = tidy(role)
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
                yield from interjections(''.join(element.itertext()))
            elif element.tag == 'p' and (element.get('klasse') or '').startswith('Anlage'):
                speaker = None
            elif element.tag == 'p' and element.get('klasse') in SPOKEN_PARAGRAPH_CLASSES:
                yield speaker, ''.join(element.itertext())


def interjections(comment: str) -> Iterator[tuple[dict | None, str]]:
    """Split "(Beifall bei der SPD – Dr. Alice Weidel [AfD]: Das ist unfassbar!)" into its parts."""
    for part in INTERJECTION_SEPARATOR.split(comment.strip()):
        match = NAMED_INTERJECTION.match(part.strip())
        if match:
            speaker = {'name': tidy(match['name']), 'fraktion': parliamentary_group(match['party']), 'zwischenruf': True}
            yield speaker, match['text']
        else:
            yield None, part


def is_two_groups_glued(group: str) -> bool:
    return any(group.startswith(first) and group[len(first):] in KNOWN_GROUPS
               for first in KNOWN_GROUPS if group != first)


def group_of(speaker: dict | None) -> str | None:
    if not speaker or speaker.get('zwischenruf'):
        return None
    if speaker.get('fraktion'):
        return None if is_two_groups_glued(speaker['fraktion']) else speaker['fraktion']
    if GOVERNMENT_ROLES.search(speaker.get('rolle', '')):
        return GOVERNMENT
    return None


def count_by_group(root: ElementTree.Element, lemma_of_form: Mapping[str, str]) -> tuple[Counter, Counter]:
    """Count lemmas per (lemma, group) and words per group in the speeches of one protocol."""
    lemma_counts, word_counts = Counter(), Counter()
    for speaker, text in spoken_passages(root):
        group = group_of(speaker)
        if group is None:
            continue
        for form in words_of(text):
            lemma = lemma_of_form.get(form)
            if lemma:
                lemma_counts[lemma, group] += 1
                word_counts[group] += 1
    return lemma_counts, word_counts


def first_speakers(root: ElementTree.Element, wanted_lemmas: set[str],
                   lemma_of_form: Mapping[str, str]) -> dict[str, dict | None]:
    found: dict[str, dict | None] = {}
    for speaker, text in spoken_passages(root):
        for form in words_of(text):
            lemma = lemma_of_form.get(form)
            if lemma in wanted_lemmas and lemma not in found:
                found[lemma] = speaker
        if len(found) == len(wanted_lemmas):
            break
    return {lemma: found.get(lemma) for lemma in wanted_lemmas}


# Read by the worker processes, filled before they are forked.
lemma_of_form_for_workers: dict[str, str] = {}


def analyse_structured_protocol(task: tuple[Path, set[str], bool]) -> tuple[dict, Counter, Counter]:
    path, wanted, count_groups = task
    root = ElementTree.parse(path).getroot()
    speakers = first_speakers(root, wanted, lemma_of_form_for_workers) if wanted else {}
    lemma_counts, word_counts = count_by_group(root, lemma_of_form_for_workers) if count_groups else (Counter(), Counter())
    return speakers, lemma_counts, word_counts


def read_structured_protocols(entries: list[dict], first_protocol_of_lemma: Mapping[str, int],
                              new_protocol_indices: set[int], lemma_of_form: Mapping[str, str],
                              first_speaker_of_lemma: dict[str, dict | None],
                              group_counts: dict[str, dict[str, Counter]], group_totals: dict[str, Counter],
                              cache_directory: Path, workers: int) -> None:
    """Fill the first speakers of lemmas first said from the 19th term on that have none yet, and add the counts per
    parliamentary group of new protocols from the 19th term on. Files are downloaded one by one, then analysed in
    parallel."""
    wanted_by_protocol: dict[int, set[str]] = {}
    for lemma, protocol_index in first_protocol_of_lemma.items():
        if entries[protocol_index]['wahlperiode'] >= FIRST_TERM_WITH_SPEAKERS and lemma not in first_speaker_of_lemma:
            wanted_by_protocol.setdefault(protocol_index, set()).add(lemma)
    to_count = {index for index in new_protocol_indices if entries[index]['wahlperiode'] >= FIRST_TERM_WITH_SPEAKERS}
    to_read = sorted(wanted_by_protocol.keys() | to_count)
    if not to_read:
        return
    urls = structured_protocol_urls()
    print(f'{len(to_read)} strukturierte Protokolle lesen, {len(urls)} gelistet', file=sys.stderr)
    tasks, task_indices = [], []
    for protocol_index in to_read:
        wahlperiode, session = entries[protocol_index]['nummer'].split('/')
        url = urls.get(protocol_key(int(wahlperiode), int(session)))
        if url is None:
            continue
        tasks.append((download_structured_protocol(url, cache_directory), wanted_by_protocol.get(protocol_index, set()),
                      protocol_index in to_count))
        task_indices.append(protocol_index)

    lemma_of_form_for_workers.clear()
    lemma_of_form_for_workers.update(lemma_of_form)
    with multiprocessing.get_context('fork').Pool(workers) as pool:
        for protocol_index, (speakers, lemma_counts, word_counts) in zip(task_indices,
                                                                          pool.imap(analyse_structured_protocol, tasks)):
            first_speaker_of_lemma.update(speakers)
            term = str(entries[protocol_index]['wahlperiode'])
            for (lemma, group), count in lemma_counts.items():
                group_counts.setdefault(lemma, {}).setdefault(term, Counter())[group] += count
            if word_counts:
                group_totals.setdefault(term, Counter()).update(word_counts)
    lemma_of_form_for_workers.clear()
