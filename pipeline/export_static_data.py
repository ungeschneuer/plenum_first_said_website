"""Write the word series of all plenary protocols as static JSON files.

Output layout (below --output):
  protocols.json      ordered list of protocols; a protocol's position is its index in every series
  shards.json         list of shard keys; a word lives in the longest key that prefixes its folded form
  words/<key>.json    {word: [index gap, count, index gap, count, ...]} per protocol the word occurs in
  search/<prefix>.json  [[word, total count], ...] by descending count, for words whose folded form starts with
                        the prefix (its first SEARCH_PREFIX_LENGTH characters, or the whole word if shorter)

A series stores one entry per protocol in which the word occurs. The first entry is the absolute
protocol index, every further entry the gap to the previous one, which keeps the numbers small.

Runs are incremental: --previous reads an earlier output, so only protocols it does not contain yet
are counted. New protocols come from a folder of DIP XML files (--input) or from the DIP API (--fetch-dip,
key in the environment variable DIP_API_KEY). The output always holds every protocol, sorted by date.
"""

import argparse
import gzip
import json
import os
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ElementTree
from array import array
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'backend'))
from text_processing import extract_words, normalize_word  # noqa: E402

TARGET_SHARD_BYTES = 1_000_000
INITIAL_SHARD_KEY_LENGTH = 2
SEARCH_PREFIX_LENGTH = 3
LETTER_REPLACEMENTS = {'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss'}
DIP_PROTOCOL_TEXT_URL = 'https://search.dip.bundestag.de/api/v1/plenarprotokoll-text'
# DIP sometimes publishes the text of a session days after its date, so each fetch looks back this far.
DIP_LOOKBACK_DAYS = 60


@dataclass
class NewProtocol:
    entry: dict
    text: str


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
    text = document.get('text') or ''
    if document.get('herausgeber') != 'BT' or not text.strip():
        return None
    entry = protocol_entry(document['id'], document.get('wahlperiode'), document.get('dokumentnummer'),
                           document.get('datum'), (document.get('fundstelle') or {}).get('pdf_url'))
    return NewProtocol(entry, text)


def read_xml_protocols(input_directory: Path) -> list[NewProtocol]:
    protocols = [protocol_from_xml(path) for path in sorted(input_directory.glob('*.xml'))]
    return [protocol for protocol in protocols if protocol is not None]


def fetch_dip_page(api_key: str, start_date: str, cursor: str | None) -> dict:
    parameters = {'f.zuordnung': 'BT', 'f.datum.start': start_date, 'format': 'json'}
    if cursor:
        parameters['cursor'] = cursor
    request = urllib.request.Request(f'{DIP_PROTOCOL_TEXT_URL}?{urllib.parse.urlencode(parameters)}',
                                     headers={'Authorization': f'ApiKey {api_key}'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


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


def load_previous(directory: Path) -> tuple[list[dict], dict[str, array]]:
    entries = json.loads((directory / 'protocols.json').read_text())
    occurrences_by_word: dict[str, array] = {}
    for key in json.loads((directory / 'shards.json').read_text()):
        shard = json.loads((directory / 'words' / f'{key}.json').read_text())
        for word, series in shard.items():
            occurrences_by_word[word] = array('I', (number for pair in decode_series(series) for number in pair))
    return entries, occurrences_by_word


def count_words(text: str) -> tuple[dict[str, int], int]:
    words = [normalize_word(word) for word in extract_words(text)]
    counts: dict[str, int] = {}
    for word in words:
        counts[word] = counts.get(word, 0) + 1
    return counts, len(words)


def unknown_protocols(candidates: list[NewProtocol], entries: list[dict], wahlperioden: set[int]) -> list[NewProtocol]:
    known_ids = {entry['id'] for entry in entries}
    unknown = []
    for protocol in candidates:
        wanted = not wahlperioden or protocol.entry['wahlperiode'] in wahlperioden
        if wanted and protocol.entry['id'] not in known_ids:
            known_ids.add(protocol.entry['id'])
            unknown.append(protocol)
    return unknown


def add_protocols(entries: list[dict], occurrences_by_word: dict[str, array], protocols: list[NewProtocol]) -> None:
    for protocol in protocols:
        protocol_index = len(entries)
        counts, protocol.entry['woerter'] = count_words(protocol.text)
        entries.append(protocol.entry)
        for word, count in counts.items():
            occurrences_by_word.setdefault(word, array('I')).extend((protocol_index, count))
        if protocol_index % 250 == 0:
            print(f'  {protocol_index} Protokolle gezählt', file=sys.stderr)


def session_number(entry: dict) -> int:
    digits = ''.join(character for character in entry['nummer'].split('/')[-1] if character.isdigit())
    return int(digits or 0)


def chronological_order(entries: list[dict]) -> list[int]:
    return sorted(range(len(entries)),
                  key=lambda index: (entries[index]['datum'], entries[index]['wahlperiode'],
                                     session_number(entries[index]), entries[index]['id']))


def sort_chronologically(entries: list[dict], occurrences_by_word: dict[str, array]) -> list[dict]:
    order = chronological_order(entries)
    if order == list(range(len(entries))):
        return entries
    new_index_of = array('I', [0]) * len(entries)
    for new_index, old_index in enumerate(order):
        new_index_of[old_index] = new_index
    for word, occurrences in occurrences_by_word.items():
        pairs = sorted((new_index_of[occurrences[position]], occurrences[position + 1])
                       for position in range(0, len(occurrences), 2))
        occurrences_by_word[word] = array('I', (number for pair in pairs for number in pair))
    return [entries[old_index] for old_index in order]


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


def fold_for_shard_key(word: str) -> str:
    folded = ''.join(LETTER_REPLACEMENTS.get(character, character) for character in word.lower())
    return ''.join(character if 'a' <= character <= 'z' else '_' for character in folded)


def serialize(content) -> bytes:
    return json.dumps(content, ensure_ascii=False, separators=(',', ':')).encode()


def split_into_shards(series_by_word: dict[str, list[int]], key_length: int) -> dict[str, dict[str, list[int]]]:
    groups: dict[str, dict[str, list[int]]] = {}
    for word, series in series_by_word.items():
        groups.setdefault(fold_for_shard_key(word)[:key_length], {})[word] = series

    shards = {}
    for key, group in groups.items():
        cannot_split_further = all(len(fold_for_shard_key(word)) <= key_length for word in group)
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


def build_search_index(occurrences_by_word: dict[str, array]) -> dict[str, list[list]]:
    index: dict[str, list[list]] = {}
    for word, occurrences in occurrences_by_word.items():
        total = sum(occurrences[1::2])
        index.setdefault(fold_for_shard_key(word)[:SEARCH_PREFIX_LENGTH], []).append([word, total])
    for entries in index.values():
        entries.sort(key=lambda entry: (-entry[1], entry[0]))
    return index


def write_output(output_directory: Path, entries: list[dict], shards: dict[str, dict[str, list[int]]],
                 search_index: dict[str, list[list]]) -> None:
    words_directory = output_directory / 'words'
    search_directory = output_directory / 'search'
    for directory in (words_directory, search_directory):
        directory.mkdir(parents=True, exist_ok=True)
        for stale_file in directory.glob('*.json'):
            stale_file.unlink()
    (output_directory / 'protocols.json').write_bytes(serialize(entries))
    (output_directory / 'shards.json').write_bytes(serialize(sorted(shards)))
    for key, shard in shards.items():
        (words_directory / f'{key}.json').write_bytes(serialize(dict(sorted(shard.items()))))
    for prefix, search_entries in search_index.items():
        (search_directory / f'{prefix}.json').write_bytes(serialize(search_entries))


def verify_round_trip(output_directory: Path, occurrences_by_word: dict[str, array]) -> None:
    shard_keys = set(json.loads((output_directory / 'shards.json').read_text()))
    loaded_shards: dict[str, dict] = {}
    for word, occurrences in occurrences_by_word.items():
        key = shard_key_for(word, shard_keys)
        if key not in loaded_shards:
            loaded_shards[key] = json.loads((output_directory / 'words' / f'{key}.json').read_text())
        expected = list(zip(occurrences[0::2], occurrences[1::2]))
        if decode_series(loaded_shards[key][word]) != expected:
            raise AssertionError(f'Reihe von „{word}“ stimmt nach dem Lesen nicht')


def report_sizes(output_directory: Path, occurrences_by_word: dict[str, array], protocol_count: int) -> None:
    files = list(output_directory.rglob('*.json'))
    raw_sizes = {path: path.stat().st_size for path in files}
    gzip_total = sum(len(gzip.compress(path.read_bytes())) for path in files)
    shard_sizes = [size for path, size in raw_sizes.items() if path.parent.name == 'words']
    search_sizes = [size for path, size in raw_sizes.items() if path.parent.name == 'search']
    pair_count = sum(len(occurrences) // 2 for occurrences in occurrences_by_word.values())
    raw_total = sum(raw_sizes.values())
    print(f'Protokolle: {protocol_count}')
    print(f'Wörter: {len(occurrences_by_word)}, Paare aus Protokoll und Anzahl: {pair_count}')
    print(f'Gesamt: {raw_total / 1e6:.1f} MB roh, {gzip_total / 1e6:.1f} MB gzip '
          f'({raw_total / pair_count:.1f} bzw. {gzip_total / pair_count:.1f} Byte pro Paar)')
    print(f'Teildateien: {len(shard_sizes)}, größte {max(shard_sizes) / 1e6:.2f} MB, '
          f'Mittel {sum(shard_sizes) / len(shard_sizes) / 1e3:.0f} KB')
    print(f'Suchindex: {len(search_sizes)} Dateien, {sum(search_sizes) / 1e6:.1f} MB, '
          f'größte {max(search_sizes) / 1e6:.2f} MB')
    print(f'protocols.json: {raw_sizes[output_directory / "protocols.json"] / 1e3:.0f} KB roh')


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--previous', type=Path, help='früherer Export, der fortgeschrieben wird')
    parser.add_argument('--input', type=Path, help='Ordner mit DIP-Protokoll-XML')
    parser.add_argument('--fetch-dip', action='store_true', help='neue Protokolle über die DIP-API holen')
    parser.add_argument('--output', type=Path, default=Path('static-data'))
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
    entries, occurrences_by_word = load_previous(arguments.previous) if arguments.previous else ([], {})
    print(f'{len(entries)} Protokolle aus dem vorigen Export', file=sys.stderr)

    candidates = read_xml_protocols(arguments.input) if arguments.input else []
    if arguments.fetch_dip:
        candidates += fetch_dip_protocols(os.environ['DIP_API_KEY'], dip_start_date(entries))
    new_protocols = unknown_protocols(candidates, entries, set(arguments.wahlperiode))
    print(f'{len(new_protocols)} neue Protokolle', file=sys.stderr)

    add_protocols(entries, occurrences_by_word, new_protocols)
    entries = sort_chronologically(entries, occurrences_by_word)
    series_by_word = {word: encode_series(occurrences) for word, occurrences in occurrences_by_word.items()}
    shards = split_into_shards(series_by_word, INITIAL_SHARD_KEY_LENGTH)
    del series_by_word
    write_output(arguments.output, entries, shards, build_search_index(occurrences_by_word))
    verify_round_trip(arguments.output, occurrences_by_word)
    report_sizes(arguments.output, occurrences_by_word, len(entries))


if __name__ == '__main__':
    main()
