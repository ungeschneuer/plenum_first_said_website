"""Write the lemma series of all plenary protocols as static JSON files.

Output layout (below --output):
  protocols.json      ordered list of protocols; a protocol's position is its index in every series
  shards.json         list of shard keys; a lemma lives in the longest key that prefixes its folded form
  words/<key>.json    {lemma: {"reihe": [index gap, count, ...], "formen": {form: count, ...}, "erste": {...}}}
                      reihe: the lemma's count per protocol it occurs in, formen: the word forms it brings together,
                      erste: who said it first ({"name", "fraktion" or "rolle", "zwischenruf"}, null if unknown),
                      beleg: the sentence of the first occurrence (pipeline/first_occurrence.py),
                      fraktionen: {electoral term: {parliamentary group: count}} in speeches from the 19th term on
  fraktionen.json     {electoral term: {parliamentary group: words in its speeches}}, the base for shares
  search/<prefix>.json  [[lemma, total count], [form, total count of its lemma, lemma], ...] by descending count,
                        for lemmas and forms whose folded spelling starts with the prefix (its first
                        SEARCH_PREFIX_LENGTH characters, or the whole word if shorter)

  neue-woerter.json   lemmas first said in the protocols of the last NEW_WORDS_DAYS days before the latest one,
                      newest first: [{"lemma", "formen", "protokoll": {...}, "anzahl", "erste"}]; read by the bot

A series stores one entry per protocol in which the lemma occurs. The first entry is the absolute
protocol index, every further entry the gap to the previous one, which keeps the numbers small.
Protocol texts are split into word forms by pipeline/protocol_text.py, words glued together by text recognition
are split (pipeline/ocr_repair.py), fragments of words divided by line breaks are left out (pipeline/fragments.py),
and word forms are lemmatised by pipeline/lemmatizer.py.

Runs are incremental: --previous reads an earlier output, so only protocols it does not contain yet
are counted, and only forms it does not contain yet are lemmatised; a form keeps its lemma once assigned.
New protocols come from a folder of DIP XML files (--input) or from the DIP API (--fetch-dip,
key in the environment variable DIP_API_KEY). The output always holds every protocol, sorted by date.
"""

import argparse
import gzip
import json
import multiprocessing
import multiprocessing.pool
import os
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ElementTree
import zlib
from array import array
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

from first_occurrence import first_occurrences, is_before_structured_protocols, needs_details
from fragments import FragmentDetector
from http_retry import fetch_bytes, fetch_json
from lemmatizer import Lemmatizer
from ocr_repair import split_glued_forms
from protocol_sources import SESSION_NUMBER, ProtocolArchives, complete_text, has_text
from protocol_text import extract_words, is_multiword_term
from speakers import (download_structured_protocol, protocol_key, read_structured_protocols, structured_protocol_urls,
                      USER_AGENT)

TARGET_SHARD_BYTES = 1_000_000
INITIAL_SHARD_KEY_LENGTH = 2
SEARCH_PREFIX_LENGTH = 3
LETTER_REPLACEMENTS = {'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss'}
DIP_PROTOCOLS_URL = 'https://search.dip.bundestag.de/api/v1/plenarprotokoll'
DIP_PROTOCOL_TEXT_URL = 'https://search.dip.bundestag.de/api/v1/plenarprotokoll-text'
# DIP sometimes publishes the text of a session days after its date, so each fetch looks back this far.
DIP_LOOKBACK_DAYS = 60
# Protocols from this date on are written in reformed spelling; they decide between ß and ss in lemmas.
REFORMED_SPELLING_SINCE = '2007-01-01'
NEW_WORDS_DAYS = 90
# A protocol yields about 120 counted words per 1000 characters; far fewer means its text was cut wrongly.
MINIMUM_WORDS_PER_THOUSAND_CHARACTERS = 30
MINIMUM_CHARACTERS_FOR_PLAUSIBILITY_CHECK = 50000


# Counting and the search for evidence run in parallel; the workers share read-only data through fork.
WORKERS = os.cpu_count() or 1
TASKS_PER_WORKER_CHUNK = 4
STARTED = time.monotonic()
lemma_of_form_for_workers: dict[str, str] = {}


def log(message: str) -> None:
    minutes, seconds = divmod(int(time.monotonic() - STARTED), 60)
    print(f'[{minutes:3d}:{seconds:02d}] {message}', file=sys.stderr)


def worker_pool() -> multiprocessing.pool.Pool:
    return multiprocessing.get_context('fork').Pool(WORKERS)


@dataclass
class NewProtocol:
    entry: dict
    text: str
    compressed_text: bytes = b''


@dataclass
class Corpus:
    entries: list[dict] = field(default_factory=list)
    occurrences_by_lemma: dict[str, array] = field(default_factory=dict)
    form_counts: Counter = field(default_factory=Counter)
    lemma_of_form: dict[str, str] = field(default_factory=dict)
    first_speaker_of_lemma: dict[str, dict | None] = field(default_factory=dict)
    evidence_of_lemma: dict[str, str] = field(default_factory=dict)
    group_counts: dict[str, dict[str, Counter]] = field(default_factory=dict)
    group_totals: dict[str, Counter] = field(default_factory=dict)


def protocol_entry(document_id, wahlperiode, document_number, session_date, pdf_url) -> dict:
    return {
        'id': str(document_id),
        'wahlperiode': int(wahlperiode or 0),
        'nummer': document_number or '',
        'datum': session_date or '',
        'pdf': pdf_url or '',
        'woerter': 0,
    }


def protocol_from_xml(path: Path) -> NewProtocol | None:
    root = ElementTree.parse(path).getroot()
    text = root.findtext('text') or ''
    if not text.strip():
        return None
    entry = protocol_entry(root.findtext('id') or path.stem, root.findtext('wahlperiode'),
                           root.findtext('dokumentnummer'), root.findtext('datum'),
                           root.findtext('fundstelle/pdf_url'))
    return NewProtocol(entry, text)


def protocol_from_dip_document(document: dict) -> NewProtocol | None:
    """A protocol listed by DIP; its text comes from the sources in pipeline/protocol_sources.py."""
    if document.get('herausgeber') != 'BT':
        return None
    entry = protocol_entry(document['id'], document.get('wahlperiode'), document.get('dokumentnummer'),
                           document.get('datum'), (document.get('fundstelle') or {}).get('pdf_url'))
    return NewProtocol(entry, '')


def read_xml_protocols(input_directory: Path) -> list[NewProtocol]:
    protocols = [protocol_from_xml(path) for path in sorted(input_directory.glob('*.xml'))]
    return [protocol for protocol in protocols if protocol is not None]


def fetch_dip_page(api_key: str, start_date: str, cursor: str | None) -> dict:
    parameters = {'f.zuordnung': 'BT', 'f.datum.start': start_date, 'format': 'json'}
    if cursor:
        parameters['cursor'] = cursor
    request = urllib.request.Request(f'{DIP_PROTOCOLS_URL}?{urllib.parse.urlencode(parameters)}',
                                     headers={'Authorization': f'ApiKey {api_key}'})
    return fetch_json(request)


def fetch_dip_protocols(api_key: str, start_date: str) -> list[NewProtocol]:
    protocols, cursor = [], None
    while True:
        page = fetch_dip_page(api_key, start_date, cursor)
        documents = page.get('documents') or []
        protocols += [protocol for protocol in map(protocol_from_dip_document, documents) if protocol]
        if not documents or page.get('cursor') in (None, cursor):
            return protocols
        cursor = page['cursor']


def dip_start_date(entries: list[dict]) -> str:
    if not entries:
        return '1949-01-01'
    latest = max(date.fromisoformat(entry['datum']) for entry in entries if entry['datum'])
    return (latest - timedelta(days=DIP_LOOKBACK_DAYS)).isoformat()


def load_previous(directory: Path) -> Corpus:
    corpus = Corpus(entries=json.loads((directory / 'protocols.json').read_text()))
    for key in json.loads((directory / 'shards.json').read_text()):
        shard = json.loads((directory / 'words' / f'{key}.json').read_text())
        for lemma, content in shard.items():
            corpus.occurrences_by_lemma[lemma] = array(
                'I', (number for pair in decode_series(content['reihe']) for number in pair))
            for form, count in content['formen'].items():
                corpus.form_counts[form] += count
                corpus.lemma_of_form[form] = lemma
            if 'erste' in content:
                corpus.first_speaker_of_lemma[lemma] = content['erste']
            if 'beleg' in content:
                corpus.evidence_of_lemma[lemma] = content['beleg']
            if 'fraktionen' in content:
                corpus.group_counts[lemma] = {term: Counter(groups) for term, groups in content['fraktionen'].items()}
    group_totals_file = directory / 'fraktionen.json'
    if group_totals_file.exists():
        corpus.group_totals = {term: Counter(groups) for term, groups in json.loads(group_totals_file.read_text()).items()}
    return corpus


INCOMPLETE_DIP = 'DIP, unvollständig'


def complete_texts(protocols: list[NewProtocol], cache_directory: Path, api_key: str | None) -> list[NewProtocol]:
    """Fill each protocol's text from the most reliable source (pipeline/protocol_sources.py). A recent protocol
    without a final text yet is left out to be tried again; an older one keeps the DIP text, marked as such."""
    archives = ProtocolArchives(cache_directory / 'archives')
    urls: dict[str, str] | None = None

    def structured_protocol(entry: dict) -> Path | None:
        nonlocal urls
        urls = structured_protocol_urls() if urls is None else urls
        number = SESSION_NUMBER.fullmatch(entry['nummer'].strip())
        if number is None:
            return None
        url = urls.get(protocol_key(int(number.group(1)), int(number.group(2))))
        return download_structured_protocol(url, cache_directory / 'structured-protocols') if url else None

    def dip_text(entry: dict) -> str:
        if not api_key:
            return ''
        request = urllib.request.Request(f"{DIP_PROTOCOL_TEXT_URL}/{entry['id']}?format=json",
                                         headers={'Authorization': f'ApiKey {api_key}'})
        return fetch_json(request).get('text') or ''

    def pdf(entry: dict) -> Path | None:
        if not entry['pdf']:
            return None
        path = cache_directory / 'pdf' / entry['pdf'].rsplit('/', 1)[-1]
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(fetch_bytes(urllib.request.Request(entry['pdf'], headers={'User-Agent': USER_AGENT})))
        return path

    retry_after = (date.today() - timedelta(days=DIP_LOOKBACK_DAYS)).isoformat()
    kept, sources = [], Counter()
    for protocol in protocols:
        result = complete_text(protocol.entry, archives.text, structured_protocol, dip_text, pdf)
        if result is None and protocol.entry['datum'] >= retry_after:
            log(f"{protocol.entry['nummer']}: noch kein endgültiger Text, später erneut")
            continue
        protocol.text, source = result if result else (dip_text(protocol.entry), INCOMPLETE_DIP)
        if not has_text(protocol.text):
            log(f"{protocol.entry['nummer']}: kein Text in Archiv, DIP oder PDF, ausgelassen")
            continue
        protocol.entry['quelle'] = source
        sources[source] += 1
        kept.append(protocol)
    log('Quellen: ' + ', '.join(f'{source} {count}' for source, count in sources.most_common()))
    return kept


def unknown_protocols(candidates: list[NewProtocol], entries: list[dict], wahlperioden: set[int]) -> list[NewProtocol]:
    known_ids = {entry['id'] for entry in entries}
    unknown = []
    for protocol in candidates:
        wanted = not wahlperioden or protocol.entry['wahlperiode'] in wahlperioden
        if wanted and protocol.entry['id'] not in known_ids:
            known_ids.add(protocol.entry['id'])
            unknown.append(protocol)
    return unknown


def is_in_reformed_spelling(entry: dict) -> bool:
    return entry['datum'] >= REFORMED_SPELLING_SINCE


def reformed_spelling_counts_of_lemmas(corpus: Corpus) -> Counter:
    reformed_indices = {index for index, entry in enumerate(corpus.entries) if is_in_reformed_spelling(entry)}
    counts = Counter()
    for lemma, occurrences in corpus.occurrences_by_lemma.items():
        counts[lemma] = sum(occurrences[position + 1] for position in range(0, len(occurrences), 2)
                            if occurrences[position] in reformed_indices)
    return counts


def has_implausibly_few_words(text: str, word_count: int) -> bool:
    return (len(text) >= MINIMUM_CHARACTERS_FOR_PLAUSIBILITY_CHECK
            and word_count * 1000 < len(text) * MINIMUM_WORDS_PER_THOUSAND_CHARACTERS)


def count_forms_of_text(text: str) -> tuple[Counter, int, bool, bytes]:
    forms = extract_words(text)
    return Counter(forms), len(forms), has_implausibly_few_words(text, len(forms)), zlib.compress(text.encode())


def count_forms_per_protocol(protocols: list[NewProtocol], form_ids: dict[str, int]) -> list[array]:
    counts_per_protocol = []
    implausible = []
    texts = (protocol.text for protocol in protocols)
    with worker_pool() as pool:
        results = pool.imap(count_forms_of_text, texts, chunksize=TASKS_PER_WORKER_CHUNK)
        for number, (protocol, (counts, word_count, is_implausible, compressed)) in enumerate(zip(protocols, results)):
            if is_implausible:
                implausible.append(f"{protocol.entry['nummer']} ({word_count} Wörter aus {len(protocol.text)} Zeichen)")
            protocol.entry['woerter'] = word_count
            protocol.compressed_text = compressed
            protocol.text = ''
            pairs = array('I')
            for form, count in counts.items():
                pairs.extend((form_ids.setdefault(form, len(form_ids)), count))
            counts_per_protocol.append(pairs)
            if number % 500 == 0:
                log(f'{number}/{len(protocols)} Protokolle gezählt')
    if implausible:
        raise SystemExit('Zu wenige Wörter, die Zerlegung passt nicht zum Text: ' + ', '.join(implausible))
    return counts_per_protocol


def add_protocols(corpus: Corpus, protocols: list[NewProtocol]) -> None:
    form_ids: dict[str, int] = {}
    counts_per_protocol = count_forms_per_protocol(protocols, form_ids)
    split_occurrences = split_glued_forms([protocol.entry for protocol in protocols], counts_per_protocol, form_ids)
    print(f'{split_occurrences} verklebte Wörter in alten Protokollen getrennt', file=sys.stderr)
    forms = list(form_ids)

    reformed_spelling_counts = reformed_spelling_counts_of_lemmas(corpus)
    for protocol, pairs in zip(protocols, counts_per_protocol):
        for position in range(0, len(pairs), 2):
            form, count = forms[pairs[position]], pairs[position + 1]
            corpus.form_counts[form] += count
            if is_in_reformed_spelling(protocol.entry):
                reformed_spelling_counts[form] += count

    new_forms = [form for form in forms if form not in corpus.lemma_of_form and corpus.form_counts[form] > 0]
    fragment_detector = FragmentDetector(corpus.form_counts)
    fragments = {form for form in new_forms if fragment_detector.is_fragment(form, corpus.form_counts[form])}
    for fragment in fragments:
        del corpus.form_counts[fragment]
    lemmatizer = Lemmatizer(corpus.form_counts, reformed_spelling_counts)
    for form in new_forms:
        if form not in fragments:
            corpus.lemma_of_form[form] = lemmatizer.lemma(form)
    print(f'{len(new_forms) - len(fragments)} neue Wortformen lemmatisiert, {len(fragments)} Bruchstücke ausgelassen',
          file=sys.stderr)

    for protocol, pairs in zip(protocols, counts_per_protocol):
        protocol_index = len(corpus.entries)
        corpus.entries.append(protocol.entry)
        counts_per_lemma = Counter()
        for position in range(0, len(pairs), 2):
            form = forms[pairs[position]]
            if form not in fragments:
                counts_per_lemma[corpus.lemma_of_form[form]] += pairs[position + 1]
        protocol.entry['woerter'] = sum(count for lemma, count in counts_per_lemma.items() if not is_multiword_term(lemma))
        for lemma, count in counts_per_lemma.items():
            corpus.occurrences_by_lemma.setdefault(lemma, array('I')).extend((protocol_index, count))


def session_number(entry: dict) -> int:
    digits = ''.join(character for character in entry['nummer'].split('/')[-1] if character.isdigit())
    return int(digits or 0)


def chronological_order(entries: list[dict]) -> list[int]:
    return sorted(range(len(entries)),
                  key=lambda index: (entries[index]['datum'], entries[index]['wahlperiode'],
                                     session_number(entries[index]), entries[index]['id']))


def sort_chronologically(corpus: Corpus) -> None:
    order = chronological_order(corpus.entries)
    if order == list(range(len(corpus.entries))):
        return
    new_index_of = array('I', [0]) * len(corpus.entries)
    for new_index, old_index in enumerate(order):
        new_index_of[old_index] = new_index
    for lemma, occurrences in corpus.occurrences_by_lemma.items():
        pairs = sorted((new_index_of[occurrences[position]], occurrences[position + 1])
                       for position in range(0, len(occurrences), 2))
        corpus.occurrences_by_lemma[lemma] = array('I', (number for pair in pairs for number in pair))
    corpus.entries = [corpus.entries[old_index] for old_index in order]


def encode_series(occurrences: array) -> list[int]:
    series, previous_index = [], 0
    for position in range(0, len(occurrences), 2):
        protocol_index, count = occurrences[position], occurrences[position + 1]
        series += [protocol_index - previous_index, count]
        previous_index = protocol_index
    return series


def decode_series(series: list[int]) -> list[tuple[int, int]]:
    occurrences, protocol_index = [], 0
    for position in range(0, len(series), 2):
        protocol_index += series[position]
        occurrences.append((protocol_index, series[position + 1]))
    return occurrences


def forms_by_lemma(corpus: Corpus) -> dict[str, dict[str, int]]:
    forms: dict[str, dict[str, int]] = {}
    for form, lemma in corpus.lemma_of_form.items():
        forms.setdefault(lemma, {})[form] = corpus.form_counts[form]
    return {lemma: dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))
            for lemma, counts in forms.items()}


def word_entry(corpus: Corpus, lemma: str, forms: dict[str, int]) -> dict:
    entry = {'reihe': encode_series(corpus.occurrences_by_lemma[lemma]), 'formen': forms}
    if lemma in corpus.first_speaker_of_lemma:
        entry['erste'] = corpus.first_speaker_of_lemma[lemma]
    if lemma in corpus.evidence_of_lemma:
        entry['beleg'] = corpus.evidence_of_lemma[lemma]
    if lemma in corpus.group_counts:
        entry['fraktionen'] = {term: dict(sorted(groups.items()))
                               for term, groups in sorted(corpus.group_counts[lemma].items())}
    return entry


def word_entries(corpus: Corpus) -> dict[str, dict]:
    forms = forms_by_lemma(corpus)
    return {lemma: word_entry(corpus, lemma, forms[lemma]) for lemma in corpus.occurrences_by_lemma}


def first_protocol_of_lemma(corpus: Corpus) -> dict[str, int]:
    return {lemma: occurrences[0] for lemma, occurrences in corpus.occurrences_by_lemma.items()}


def fold_for_shard_key(word: str) -> str:
    folded = ''.join(LETTER_REPLACEMENTS.get(character, character) for character in word.lower())
    return ''.join(character if 'a' <= character <= 'z' else '_' for character in folded)


def serialize(content) -> bytes:
    return json.dumps(content, ensure_ascii=False, separators=(',', ':')).encode()


def split_into_shards(entries_by_lemma: dict[str, dict], key_length: int) -> dict[str, dict[str, dict]]:
    groups: dict[str, dict[str, dict]] = {}
    for lemma, content in entries_by_lemma.items():
        groups.setdefault(fold_for_shard_key(lemma)[:key_length], {})[lemma] = content

    shards = {}
    for key, group in groups.items():
        cannot_split_further = all(len(fold_for_shard_key(lemma)) <= key_length for lemma in group)
        if len(serialize(group)) <= TARGET_SHARD_BYTES or cannot_split_further:
            shards[key] = group
        else:
            shards.update(split_into_shards(group, key_length + 1))
    return shards


def shard_key_for(word: str, shard_keys: set[str]) -> str | None:
    folded = fold_for_shard_key(word)
    for length in range(len(folded), 0, -1):
        if folded[:length] in shard_keys:
            return folded[:length]
    return None


def lemma_total(corpus: Corpus, lemma: str) -> int:
    return sum(corpus.occurrences_by_lemma[lemma][1::2])


def build_search_index(corpus: Corpus) -> dict[str, list[list]]:
    totals = {lemma: lemma_total(corpus, lemma) for lemma in corpus.occurrences_by_lemma}
    entries = [[lemma, total] for lemma, total in totals.items()]
    entries += [[form, totals[lemma], lemma] for form, lemma in corpus.lemma_of_form.items()
                if form.lower() != lemma.lower()]
    index: dict[str, list[list]] = {}
    for entry in entries:
        index.setdefault(fold_for_shard_key(entry[0])[:SEARCH_PREFIX_LENGTH], []).append(entry)
    for prefix_entries in index.values():
        prefix_entries.sort(key=lambda entry: (-entry[1], len(entry), entry[0]))
    return index


def attach_first_occurrence_details(corpus: Corpus, new_protocols: list[NewProtocol]) -> None:
    """Evidence for lemmas first said in the new protocols, and the speaker from the text before the 19th term."""
    index_of_protocol = {entry['id']: index for index, entry in enumerate(corpus.entries)}
    wanted_by_protocol: dict[int, set[str]] = {}
    for lemma, occurrences in corpus.occurrences_by_lemma.items():
        protocol_index = occurrences[0]
        if lemma in corpus.evidence_of_lemma:
            continue
        if needs_details(lemma_total(corpus, lemma), corpus.entries[protocol_index]['wahlperiode']):
            wanted_by_protocol.setdefault(protocol_index, set()).add(lemma)
    tasks = [(protocol, wanted_by_protocol[index_of_protocol[protocol.entry['id']]]) for protocol in new_protocols
             if index_of_protocol[protocol.entry['id']] in wanted_by_protocol]
    lemma_of_form_for_workers.clear()
    lemma_of_form_for_workers.update(corpus.lemma_of_form)
    with worker_pool() as pool:
        results = pool.imap(first_occurrences_of_task, ((protocol.compressed_text, wanted) for protocol, wanted in tasks),
                            chunksize=TASKS_PER_WORKER_CHUNK)
        for (protocol, _), found in zip(tasks, results):
            for lemma, (speaker, evidence) in found.items():
                corpus.evidence_of_lemma[lemma] = evidence
                if is_before_structured_protocols(protocol.entry['wahlperiode']):
                    corpus.first_speaker_of_lemma.setdefault(lemma, speaker)
    lemma_of_form_for_workers.clear()


def first_occurrences_of_task(task: tuple[bytes, set[str]]) -> dict[str, tuple[dict | None, str]]:
    compressed_text, wanted = task
    return first_occurrences(zlib.decompress(compressed_text).decode(), wanted, lemma_of_form_for_workers)


def recently_first_said(corpus: Corpus) -> list[dict]:
    latest = max(date.fromisoformat(entry['datum']) for entry in corpus.entries if entry['datum'])
    since = (latest - timedelta(days=NEW_WORDS_DAYS)).isoformat()
    forms = forms_by_lemma(corpus)
    new_words = []
    for lemma, occurrences in corpus.occurrences_by_lemma.items():
        protocol = corpus.entries[occurrences[0]]
        if protocol['datum'] >= since:
            new_words.append({'lemma': lemma, 'formen': list(forms[lemma]), 'protokoll': protocol,
                              'anzahl': occurrences[1], 'erste': corpus.first_speaker_of_lemma.get(lemma),
                              'beleg': corpus.evidence_of_lemma.get(lemma)})
    return sorted(new_words, key=lambda word: (word['protokoll']['datum'], word['lemma']), reverse=True)


def write_output(output_directory: Path, entries: list[dict], shards: dict[str, dict[str, dict]],
                 search_index: dict[str, list[list]], new_words: list[dict], group_totals: dict[str, Counter]) -> None:
    words_directory = output_directory / 'words'
    search_directory = output_directory / 'search'
    for directory in (words_directory, search_directory):
        directory.mkdir(parents=True, exist_ok=True)
        for stale_file in directory.glob('*.json'):
            stale_file.unlink()
    (output_directory / 'protocols.json').write_bytes(serialize(entries))
    (output_directory / 'shards.json').write_bytes(serialize(sorted(shards)))
    (output_directory / 'neue-woerter.json').write_bytes(serialize(new_words))
    (output_directory / 'fraktionen.json').write_bytes(serialize(
        {term: dict(sorted(groups.items())) for term, groups in sorted(group_totals.items())}))
    for key, shard in shards.items():
        (words_directory / f'{key}.json').write_bytes(serialize(dict(sorted(shard.items()))))
    for prefix, search_entries in search_index.items():
        (search_directory / f'{prefix}.json').write_bytes(serialize(search_entries))


def verify_round_trip(output_directory: Path, corpus: Corpus) -> None:
    shard_keys = set(json.loads((output_directory / 'shards.json').read_text()))
    loaded_shards: dict[str, dict] = {}
    for lemma, occurrences in corpus.occurrences_by_lemma.items():
        key = shard_key_for(lemma, shard_keys)
        if key not in loaded_shards:
            loaded_shards[key] = json.loads((output_directory / 'words' / f'{key}.json').read_text())
        expected = list(zip(occurrences[0::2], occurrences[1::2]))
        if decode_series(loaded_shards[key][lemma]['reihe']) != expected:
            raise AssertionError(f'Reihe von „{lemma}“ stimmt nach dem Lesen nicht')


def report_sizes(output_directory: Path, corpus: Corpus) -> None:
    files = list(output_directory.rglob('*.json'))
    raw_sizes = {path: path.stat().st_size for path in files}
    gzip_total = sum(len(gzip.compress(path.read_bytes())) for path in files)
    shard_sizes = [size for path, size in raw_sizes.items() if path.parent.name == 'words']
    search_sizes = [size for path, size in raw_sizes.items() if path.parent.name == 'search']
    pair_count = sum(len(occurrences) // 2 for occurrences in corpus.occurrences_by_lemma.values())
    print(f'Protokolle: {len(corpus.entries)}')
    print(f'Lemmata: {len(corpus.occurrences_by_lemma)} aus {len(corpus.lemma_of_form)} Wortformen, '
          f'Paare aus Protokoll und Anzahl: {pair_count}')
    print(f'Gesamt: {sum(raw_sizes.values()) / 1e6:.1f} MB roh, {gzip_total / 1e6:.1f} MB gzip')
    print(f'Teildateien: {len(shard_sizes)}, größte {max(shard_sizes) / 1e6:.2f} MB, '
          f'Mittel {sum(shard_sizes) / len(shard_sizes) / 1e3:.0f} KB')
    print(f'Suchindex: {len(search_sizes)} Dateien, {sum(search_sizes) / 1e6:.1f} MB, '
          f'größte {max(search_sizes) / 1e6:.2f} MB')
    print(f'protocols.json: {raw_sizes[output_directory / "protocols.json"] / 1e3:.0f} KB roh')
    known_speakers = sum(1 for speaker in corpus.first_speaker_of_lemma.values() if speaker)
    print(f'Erste Redner: {known_speakers} bekannt, {len(corpus.first_speaker_of_lemma) - known_speakers} unbekannt')
    print(f'Belege: {len(corpus.evidence_of_lemma)}, Lemmata mit Fraktionszählung: {len(corpus.group_counts)}')


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--previous', type=Path, help='früherer Export, der fortgeschrieben wird')
    parser.add_argument('--input', type=Path, help='Ordner mit DIP-Protokoll-XML')
    parser.add_argument('--fetch-dip', action='store_true', help='neue Protokolle über die DIP-API holen')
    parser.add_argument('--fetch-dip-from', help='DIP ab diesem Datum abfragen (JJJJ-MM-TT), für einen Neuaufbau')
    parser.add_argument('--output', type=Path, default=Path('static-data'))
    parser.add_argument('--speaker-cache', type=Path, default=Path('.cache/structured-protocols'),
                        help='Ordner für die strukturierten Protokolle des Bundestages')
    parser.add_argument('--skip-speakers', action='store_true', help='keine ersten Redner suchen (ohne Netz)')
    parser.add_argument('--wahlperiode', type=int, action='append', default=[],
                        help='nur neue Protokolle dieser Wahlperiode(n) aufnehmen; ohne Angabe alle')
    arguments = parser.parse_args()
    if not (arguments.previous or arguments.input or arguments.fetch_dip):
        parser.error('mindestens eine Quelle angeben: --previous, --input oder --fetch-dip')
    if arguments.fetch_dip and not os.environ.get('DIP_API_KEY'):
        parser.error('--fetch-dip braucht die Umgebungsvariable DIP_API_KEY')
    return arguments


def main() -> None:
    arguments = parse_arguments()
    corpus = load_previous(arguments.previous) if arguments.previous else Corpus()
    print(f'{len(corpus.entries)} Protokolle aus dem vorigen Export', file=sys.stderr)

    candidates = read_xml_protocols(arguments.input) if arguments.input else []
    if arguments.fetch_dip:
        start_date = arguments.fetch_dip_from or dip_start_date(corpus.entries)
        candidates += fetch_dip_protocols(os.environ['DIP_API_KEY'], start_date)
    new_protocols = unknown_protocols(candidates, corpus.entries, set(arguments.wahlperiode))
    if arguments.fetch_dip:
        new_protocols = complete_texts(new_protocols, arguments.speaker_cache.parent, os.environ.get('DIP_API_KEY'))
    print(f'{len(new_protocols)} neue Protokolle', file=sys.stderr)

    add_protocols(corpus, new_protocols)
    log('gezählt und lemmatisiert')
    sort_chronologically(corpus)
    new_ids = {protocol.entry['id'] for protocol in new_protocols}
    new_indices = {index for index, entry in enumerate(corpus.entries) if entry['id'] in new_ids}
    if not arguments.skip_speakers:
        read_structured_protocols(corpus.entries, first_protocol_of_lemma(corpus), new_indices, corpus.lemma_of_form,
                                  corpus.first_speaker_of_lemma, corpus.group_counts, corpus.group_totals,
                                  arguments.speaker_cache, WORKERS)
    log('strukturierte Protokolle gelesen')
    attach_first_occurrence_details(corpus, new_protocols)
    log('Belege gefunden')
    shards = split_into_shards(word_entries(corpus), INITIAL_SHARD_KEY_LENGTH)
    log('Teildateien gebildet')
    write_output(arguments.output, corpus.entries, shards, build_search_index(corpus), recently_first_said(corpus),
                 corpus.group_totals)
    log('geschrieben')
    verify_round_trip(arguments.output, corpus)
    log('geprüft')
    report_sizes(arguments.output, corpus)


if __name__ == '__main__':
    main()
