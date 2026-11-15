"""Write the word series of all plenary protocols as static JSON files.

Output layout (below --output):
  protocols.json      ordered list of protocols; a protocol's position is its index in every series
  shards.json         list of shard keys; a word lives in the longest key that prefixes its folded form
  words/<key>.json    {word: [index gap, count, index gap, count, ...]} per protocol the word occurs in
  search/<prefix>.json  [[word, total count], ...] by descending count, for words whose folded form starts with
                        the prefix (its first SEARCH_PREFIX_LENGTH characters, or the whole word if shorter)

A series stores one entry per protocol in which the word occurs. The first entry is the absolute
protocol index, every further entry the gap to the previous one, which keeps the numbers small.
"""

import argparse
import gzip
import json
import sys
import xml.etree.ElementTree as ElementTree
from array import array
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'backend'))
from text_processing import extract_words, normalize_word  # noqa: E402

TARGET_SHARD_BYTES = 1_000_000
INITIAL_SHARD_KEY_LENGTH = 2
SEARCH_PREFIX_LENGTH = 3
LETTER_REPLACEMENTS = {'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss'}


@dataclass
class Protocol:
    document_id: str
    wahlperiode: int
    document_number: str
    date: str
    pdf_url: str
    text: str


def read_protocol(path: Path) -> Protocol | None:
    root = ElementTree.parse(path).getroot()
    text = root.findtext('text') or ''
    if not text.strip():
        return None
    return Protocol(
        document_id=root.findtext('id') or path.stem,
        wahlperiode=int(root.findtext('wahlperiode') or 0),
        document_number=root.findtext('dokumentnummer') or '',
        date=root.findtext('datum') or '',
        pdf_url=root.findtext('fundstelle/pdf_url') or '',
        text=text,
    )


def session_number(protocol: Protocol) -> int:
    return int(protocol.document_number.split('/')[-1] or 0)


def read_protocols(input_directory: Path, wahlperioden: set[int]) -> tuple[list[Protocol], list[Path]]:
    protocols, without_text = [], []
    for path in input_directory.glob('*.xml'):
        protocol = read_protocol(path)
        if protocol is None:
            without_text.append(path)
        elif not wahlperioden or protocol.wahlperiode in wahlperioden:
            protocols.append(protocol)
    protocols.sort(key=lambda protocol: (protocol.date, protocol.wahlperiode, session_number(protocol)))
    return protocols, without_text


def count_words_per_protocol(protocols: list[Protocol]) -> tuple[dict[str, array], list[int]]:
    occurrences_by_word: dict[str, array] = {}
    total_words_per_protocol = []
    for protocol_index, protocol in enumerate(protocols):
        words = [normalize_word(word) for word in extract_words(protocol.text)]
        total_words_per_protocol.append(len(words))
        counts: dict[str, int] = {}
        for word in words:
            counts[word] = counts.get(word, 0) + 1
        for word, count in counts.items():
            occurrences_by_word.setdefault(word, array('I')).extend((protocol_index, count))
        if protocol_index % 250 == 0:
            print(f'  {protocol_index}/{len(protocols)} Protokolle gezählt', file=sys.stderr)
    return occurrences_by_word, total_words_per_protocol


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


def serialize(shard: dict[str, list[int]]) -> bytes:
    return json.dumps(shard, ensure_ascii=False, separators=(',', ':')).encode()


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


def protocol_entry(protocol: Protocol, total_words: int) -> dict:
    return {
        'id': protocol.document_id,
        'wahlperiode': protocol.wahlperiode,
        'nummer': protocol.document_number,
        'datum': protocol.date,
        'pdf': protocol.pdf_url,
        'woerter': total_words,
    }


def write_output(output_directory: Path, protocols: list[Protocol], total_words: list[int],
                 shards: dict[str, dict[str, list[int]]], search_index: dict[str, list[list]]) -> None:
    words_directory = output_directory / 'words'
    search_directory = output_directory / 'search'
    for directory in (words_directory, search_directory):
        directory.mkdir(parents=True, exist_ok=True)
        for stale_file in directory.glob('*.json'):
            stale_file.unlink()
    entries = [protocol_entry(protocol, total) for protocol, total in zip(protocols, total_words)]
    (output_directory / 'protocols.json').write_text(json.dumps(entries, ensure_ascii=False, separators=(',', ':')))
    (output_directory / 'shards.json').write_text(json.dumps(sorted(shards)))
    for key, shard in shards.items():
        (words_directory / f'{key}.json').write_bytes(serialize(shard))
    for prefix, entries in search_index.items():
        (search_directory / f'{prefix}.json').write_text(json.dumps(entries, ensure_ascii=False, separators=(',', ':')))


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
    pair_count = sum(len(occurrences) // 2 for occurrences in occurrences_by_word.values())
    raw_total = sum(raw_sizes.values())
    print(f'Protokolle: {protocol_count}')
    print(f'Wörter: {len(occurrences_by_word)}, Paare aus Protokoll und Anzahl: {pair_count}')
    print(f'Gesamt: {raw_total / 1e6:.1f} MB roh, {gzip_total / 1e6:.1f} MB gzip '
          f'({raw_total / pair_count:.1f} bzw. {gzip_total / pair_count:.1f} Byte pro Paar)')
    print(f'Teildateien: {len(shard_sizes)}, größte {max(shard_sizes) / 1e6:.2f} MB, '
          f'Mittel {sum(shard_sizes) / len(shard_sizes) / 1e3:.0f} KB')
    search_sizes = [size for path, size in raw_sizes.items() if path.parent.name == 'search']
    print(f'Suchindex: {len(search_sizes)} Dateien, {sum(search_sizes) / 1e6:.1f} MB, '
          f'größte {max(search_sizes) / 1e6:.2f} MB')
    print(f'protocols.json: {raw_sizes[output_directory / "protocols.json"] / 1e3:.0f} KB roh')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--input', type=Path, default=Path('xml'), help='Ordner mit den DIP-Protokoll-XML')
    parser.add_argument('--output', type=Path, default=Path('static-data'))
    parser.add_argument('--wahlperiode', type=int, action='append', default=[],
                        help='nur diese Wahlperiode(n); ohne Angabe alle')
    arguments = parser.parse_args()

    protocols, without_text = read_protocols(arguments.input, set(arguments.wahlperiode))
    print(f'{len(protocols)} Protokolle gelesen, {len(without_text)} ohne Text übersprungen', file=sys.stderr)
    occurrences_by_word, total_words = count_words_per_protocol(protocols)
    series_by_word = {word: encode_series(occurrences) for word, occurrences in occurrences_by_word.items()}
    shards = split_into_shards(series_by_word, INITIAL_SHARD_KEY_LENGTH)
    del series_by_word
    write_output(arguments.output, protocols, total_words, shards, build_search_index(occurrences_by_word))
    verify_round_trip(arguments.output, occurrences_by_word)
    report_sizes(arguments.output, occurrences_by_word, len(protocols))


if __name__ == '__main__':
    main()
