"""Statistics over all lemmas of a finished export: returning words, words said only once, typical words of groups.

Reads protocols.json, fraktionen.json and the word shards below the given directory and writes statistik.json:
  {"wiederkehrer": {"laengste": [...], "zuletzt": [...]},
   "einmalwoerter": {"wahlperioden": {term: [first said, said only once]}, "beispiele": {term: [...]}},
   "typisch": {term: {parliamentary group: [[lemma, count, ratio], ...]}}}

wiederkehrer   lemmas with the longest gap between two consecutive protocols they occur in, as
               {"lemma", "vorher": protocol index, "wieder": protocol index, "anzahl_vorher", "anzahl_nachher"};
               "laengste" by gap, "zuletzt" those that returned within RECENT_DAYS before the latest protocol
einmalwoerter  per electoral term the lemmas first said in it and how many of them were never said again;
               "beispiele" holds a few of the latter as {"lemma", "protokoll", "beleg"}
typisch        per electoral term from the 19th on and per group, the lemmas the group uses most often relative to the
               other groups, as the ratio of the shares of all words said in speeches

Names are left out: lemmas marked as names, surnames and first names of members, and parts of speaker names.
Like speaker_statistics.py, the script is not part of the counting rules and runs after every export.
"""

import argparse
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

PIPELINE_DIRECTORY = Path(__file__).parent
NAME_SUFFIX = ' (Name)'

LONGEST_RETURNS = 100
RECENT_RETURNS = 50
RECENT_DAYS = 365
MINIMUM_GAP_DAYS = 10 * 365
# A returning word must have been said in this many protocols before and after its gap, which leaves out
# misread words and words that happen to be spelt like a name.
MINIMUM_PROTOCOLS_AROUND_GAP = 3
ABBREVIATION = re.compile(r'^[A-ZÄÖÜ]{1,5}$')

EXAMPLES_PER_TERM = 12
EXAMPLE_LENGTH = range(8, 31)
MAXIMUM_EVIDENCE_LENGTH = 200

TYPICAL_WORDS = 25
MINIMUM_GROUP_WORDS = 40_000
LEFT_OUT_GROUPS = {'Bundesregierung', 'fraktionslos'}
# The most frequent lemmas of the whole corpus are function words and forms of address.
LEFT_OUT_MOST_FREQUENT = 500
# A group must have said a lemma this often per 1.5 million words of its speeches, and at least MINIMUM_TYPICAL_COUNT.
TYPICAL_COUNT_PER_WORDS = (30, 1_500_000)
MINIMUM_TYPICAL_COUNT = 10
MINIMUM_SCORE = 3.0
PARTY_NAMES = re.compile(r'AfD|SPD|CDU|CSU|FDP|BSW|Linke|Grüne|Bündnis|(?i:sozialdemokrat)|^Demokrat|^Freie$|^Liberale|'
                         r'Unionsfraktion|^Union$')


def read_names(file_name: str) -> set[str]:
    lines = (PIPELINE_DIRECTORY / file_name).read_text().splitlines()
    return {line.strip() for line in lines if line.strip() and not line.startswith('#')}


def decode_series(series: list[int]) -> list[tuple[int, int]]:
    occurrences, index = [], 0
    for position in range(0, len(series), 2):
        index += series[position]
        occurrences.append((index, series[position + 1]))
    return occurrences


def read_lemmas(directory: Path):
    for key in json.loads((directory / 'shards.json').read_text()):
        yield from json.loads((directory / 'words' / f'{key}.json').read_text()).items()


def longest_gap(occurrences: list[tuple[int, int]], dates: list[date]) -> dict | None:
    if len(occurrences) < 2 * MINIMUM_PROTOCOLS_AROUND_GAP:
        return None
    candidates = range(MINIMUM_PROTOCOLS_AROUND_GAP - 1, len(occurrences) - MINIMUM_PROTOCOLS_AROUND_GAP)
    position = max(candidates, key=lambda at: dates[occurrences[at + 1][0]] - dates[occurrences[at][0]])
    before, after = occurrences[position][0], occurrences[position + 1][0]
    days = (dates[after] - dates[before]).days
    if days < MINIMUM_GAP_DAYS:
        return None
    return {'tage': days, 'vorher': before, 'wieder': after,
            'anzahl_vorher': sum(count for _, count in occurrences[:position + 1]),
            'anzahl_nachher': sum(count for _, count in occurrences[position + 1:])}


def returning_words(returns: list[dict], dates: list[date]) -> dict:
    latest = max(dates)
    recent = [entry for entry in returns if (latest - dates[entry['wieder']]).days <= RECENT_DAYS]
    longest = sorted(returns, key=lambda entry: (-entry['tage'], entry['lemma']))[:LONGEST_RETURNS]
    recent = sorted(recent, key=lambda entry: (-entry['wieder'], -entry['tage'], entry['lemma']))[:RECENT_RETURNS]
    return {'laengste': [without_days(entry) for entry in longest], 'zuletzt': [without_days(entry) for entry in recent]}


def without_days(entry: dict) -> dict:
    return {key: value for key, value in entry.items() if key != 'tage'}


def example_order(lemma: str) -> str:
    """A fixed order that is not alphabetical, so examples do not all start with the same letters."""
    return hashlib.sha256(lemma.encode()).hexdigest()


def said_once_summary(first_said: Counter, said_once: Counter, candidates: dict[int, list]) -> dict:
    examples = {str(term): sorted(sorted(words, key=lambda word: example_order(word['lemma']))[:EXAMPLES_PER_TERM],
                                  key=lambda word: word['lemma'].lower())
                for term, words in sorted(candidates.items())}
    return {'wahlperioden': {str(term): [first_said[term], said_once[term]] for term in sorted(first_said)},
            'beispiele': examples}


def is_example(lemma: str, sentence: str | None) -> bool:
    return bool(sentence and len(sentence) <= MAXIMUM_EVIDENCE_LENGTH and len(lemma) in EXAMPLE_LENGTH
                and not any(character.isdigit() for character in lemma))


def typical_words(group_counts: dict[str, dict[str, dict]], group_totals: dict[str, dict], left_out: set[str]) -> dict:
    typical = {}
    for term, counts_by_lemma in sorted(group_counts.items(), key=lambda item: int(item[0])):
        groups = [group for group, words in group_totals.get(term, {}).items()
                  if words >= MINIMUM_GROUP_WORDS and group not in LEFT_OUT_GROUPS]
        all_words = sum(group_totals[term][group] for group in groups)
        typical[term] = {}
        for group in groups:
            group_words = group_totals[term][group]
            other_words = all_words - group_words
            minimum = max(MINIMUM_TYPICAL_COUNT,
                          round(TYPICAL_COUNT_PER_WORDS[0] * group_words / TYPICAL_COUNT_PER_WORDS[1]))
            scored = []
            for lemma, counts in counts_by_lemma.items():
                count = counts.get(group, 0)
                if count < minimum or lemma in left_out or PARTY_NAMES.search(lemma):
                    continue
                others = sum(counts.get(other, 0) for other in groups) - count
                # Log ratio of the two rates, with its standard error; only clear differences count.
                score = ((math.log((count + 0.5) / group_words) - math.log((others + 0.5) / other_words))
                         / math.sqrt(1 / (count + 0.5) + 1 / (others + 0.5)))
                if score < MINIMUM_SCORE:
                    continue
                ratio = ((count + 1) / group_words) / ((others + 1) / other_words)
                scored.append((ratio, lemma, count))
            scored.sort(key=lambda item: (-item[0], item[1]))
            typical[term][group] = [[lemma, count, round(ratio, 1)] for ratio, lemma, count in scored[:TYPICAL_WORDS]]
    return typical


def build_statistics(protocols: list[dict], read_lemmas, group_totals: dict[str, dict]) -> dict:
    """read_lemmas() yields (lemma, entry) pairs; it is called twice, so only one shard is held at a time."""
    names = read_names('member_surnames.txt') | read_names('first_names.txt')
    totals = {}
    for lemma, entry in read_lemmas():
        totals[lemma] = sum(entry['reihe'][1::2])
        speaker = entry.get('erste')
        if speaker and speaker.get('name'):
            names.update(part for part in re.split(r'[\s.,()-]+', speaker['name']) if len(part) > 2)
    most_frequent = set(sorted(totals, key=lambda lemma: (-totals[lemma], lemma))[:LEFT_OUT_MOST_FREQUENT])
    del totals

    dates = [date.fromisoformat(protocol['datum']) for protocol in protocols]
    returns, group_counts = [], defaultdict(dict)
    first_said, said_once, candidates = Counter(), Counter(), defaultdict(list)
    for lemma, entry in read_lemmas():
        if lemma.endswith(NAME_SUFFIX) or lemma in names:
            continue
        occurrences = decode_series(entry['reihe'])
        first_index = occurrences[0][0]
        term = protocols[first_index]['wahlperiode']
        first_said[term] += 1
        if len(occurrences) == 1 and occurrences[0][1] == 1:
            said_once[term] += 1
            if is_example(lemma, entry.get('beleg')):
                candidates[term].append({'lemma': lemma, 'protokoll': first_index, 'beleg': entry['beleg']})
        if not ABBREVIATION.match(lemma):
            gap = longest_gap(occurrences, dates)
            if gap:
                returns.append({'lemma': lemma, **gap})
        for counts_term, counts in entry.get('fraktionen', {}).items():
            group_counts[counts_term][lemma] = counts
    return {
        'wiederkehrer': returning_words(returns, dates),
        'einmalwoerter': said_once_summary(first_said, said_once, candidates),
        'typisch': typical_words(group_counts, group_totals, most_frequent),
    }


def write_statistics(directory: Path) -> None:
    protocols = json.loads((directory / 'protocols.json').read_text())
    group_totals_file = directory / 'fraktionen.json'
    group_totals = json.loads(group_totals_file.read_text()) if group_totals_file.exists() else {}
    statistics = build_statistics(protocols, lambda: read_lemmas(directory), group_totals)
    (directory / 'statistik.json').write_bytes(
        json.dumps(statistics, ensure_ascii=False, separators=(',', ':')).encode())
    print(f'Wiederkehrer: {len(statistics["wiederkehrer"]["laengste"])}, '
          f'zuletzt {len(statistics["wiederkehrer"]["zuletzt"])}; '
          f'typische Wörter für {len(statistics["typisch"])} Wahlperioden')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('directory', type=Path, help='Ordner eines Exports (static-data)')
    write_statistics(parser.parse_args().directory)
