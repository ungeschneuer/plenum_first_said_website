"""Highlights of the last months, from a finished export, for monthly reviews on social media.

Reads protocols.json and the word shards below the given directory and writes monate.json:
  {"monate": [{"monat": "2026-10", ...}, ...]} for the last MONTHS calendar months with sessions, newest first.

Per month:
  sitzungen          number of sessions with their own protocol
  woerter            words counted in them
  laengste_sitzung   protocol index of the session with the most words
  neue_woerter       {"anzahl": lemmas first said in the month,
                      "beispiele": [[lemma, protocol index, total count, first speaker or null], ...]}
                     the examples are the lemmas said most often since
  erste_personen     [[name, group or role, lemmas first said in the month], ...] most first, from the 19th term on
  wiederkehrer       [[lemma, protocol index before, protocol index again], ...] lemmas said again in the month
                     after at least MINIMUM_GAP_DAYS, longest pause first
  jubilaeen          [[lemma, mark, protocol index, protocol index of the first occurrence], ...] lemmas whose total
                     reached a mark (100, 1000, ...) in the month; higher marks first, then those first said latest
  trend              [[lemma, count in the month, ratio to the twelve months before], ...] by ratio
  haeufigste         [[lemma, count], ...] the lemmas said most often in the month

Names, abbreviations and the most frequent lemmas of the whole corpus (function words, forms of address) are left out
of all lists, as in word_statistics.py. Like that script, this one is not part of the counting rules.
"""

import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from word_statistics import (ABBREVIATION, MINIMUM_GAP_DAYS, MINIMUM_PROTOCOLS_AROUND_GAP, NAME_SUFFIX, PARTY_NAMES,
                             decode_series, read_lemmas, read_names)
import word_statistics

MONTHS = 12
BASELINE_MONTHS = 12
LISTED = 10
MARKS = (100, 1_000, 10_000, 100_000)
# A trend needs this many mentions in the month; fewer are chance.
MINIMUM_TREND_COUNT = 15
MINIMUM_TREND_RATIO = 3.0
MINIMUM_WORD_LENGTH = 4


def month_of(protocol: dict) -> str:
    return protocol['datum'][:7]


def months_before(month: str, count: int) -> list[str]:
    year, number = int(month[:4]), int(month[5:7])
    result = []
    for _ in range(count):
        number -= 1
        if number == 0:
            year, number = year - 1, 12
        result.append(f'{year:04d}-{number:02d}')
    return result


def left_out_lemmas(read) -> tuple[set[str], set[str]]:
    """Names of speakers and members, and the most frequent lemmas of the whole corpus."""
    names = read_names('member_surnames.txt') | read_names('first_names.txt')
    totals = {}
    for lemma, entry in read():
        totals[lemma] = sum(entry['reihe'][1::2])
        speaker = entry.get('erste')
        if speaker and speaker.get('name'):
            names.update(part for part in re.split(r'[\s.,()-]+', speaker['name']) if len(part) > 2)
    most_frequent = set(sorted(totals, key=lambda lemma: (-totals[lemma], lemma))[:word_statistics.LEFT_OUT_MOST_FREQUENT])
    return names, most_frequent


def is_listed(lemma: str, names: set[str], most_frequent: set[str]) -> bool:
    return not (lemma.endswith(NAME_SUFFIX) or lemma in names or lemma in most_frequent or ABBREVIATION.match(lemma)
                or PARTY_NAMES.search(lemma) or len(lemma) < MINIMUM_WORD_LENGTH)


def speaker_of(entry: dict) -> list | None:
    speaker = entry.get('erste')
    if not speaker or not speaker.get('name'):
        return None
    return [speaker['name'], speaker.get('fraktion') or speaker.get('rolle') or '']


def build_highlights(protocols: list[dict], read) -> dict:
    """read() yields (lemma, entry) pairs; it is called twice, so only one shard is held at a time."""
    counted = [index for index, protocol in enumerate(protocols) if not protocol.get('gemeinsam_mit')]
    months = sorted({month_of(protocols[index]) for index in counted}, reverse=True)[:MONTHS]
    if not months:
        return {'monate': []}
    shown = set(months)
    baseline_of = {month: set(months_before(month, BASELINE_MONTHS)) for month in months}
    month_by_index = {index: month_of(protocols[index]) for index in counted}
    words_by_month = Counter()
    for index in counted:
        words_by_month[month_by_index[index]] += protocols[index].get('woerter', 0)
    first_counted_month = min(min(baseline_of[month]) for month in months)
    dates = [date.fromisoformat(protocol['datum']) for protocol in protocols]

    names, most_frequent = left_out_lemmas(read)
    new_words = defaultdict(list)
    first_speakers = defaultdict(Counter)
    returns = defaultdict(list)
    marks = defaultdict(list)
    counts_by_month = defaultdict(dict)
    for lemma, entry in read():
        occurrences = decode_series(entry['reihe'])
        last_index = occurrences[-1][0]
        if month_of(protocols[last_index]) < first_counted_month:
            continue
        listed = is_listed(lemma, names, most_frequent)
        first_index = occurrences[0][0]
        first_month = month_of(protocols[first_index])
        total = sum(count for _, count in occurrences)
        if first_month in shown and not lemma.endswith(NAME_SUFFIX):
            speaker = speaker_of(entry)
            if listed:
                new_words[first_month].append([lemma, first_index, total, speaker])
            else:
                new_words[first_month].append(None)
            if speaker and protocols[first_index]['wahlperiode'] >= 19:
                first_speakers[first_month][tuple(speaker)] += 1
        if not listed:
            continue
        running = 0
        for position, (index, count) in enumerate(occurrences):
            month = month_of(protocols[index])
            before = running
            running += count
            if month >= first_counted_month:
                monthly = counts_by_month[month]
                monthly[lemma] = monthly.get(lemma, 0) + count
            if month not in shown:
                continue
            for mark in MARKS:
                if before < mark <= running:
                    marks[month].append([lemma, mark, index, first_index])
            if position >= MINIMUM_PROTOCOLS_AROUND_GAP:
                previous = occurrences[position - 1][0]
                if (dates[index] - dates[previous]).days >= MINIMUM_GAP_DAYS:
                    returns[month].append([lemma, previous, index])

    result = []
    for month in months:
        indices = [index for index in counted if month_by_index[index] == month]
        examples = [example for example in new_words[month] if example]
        examples.sort(key=lambda example: (-example[2], example[0]))
        monthly = counts_by_month.get(month, {})
        baseline_words = sum(words_by_month[other] for other in baseline_of[month])
        trends = []
        if baseline_words and words_by_month[month]:
            for lemma, count in monthly.items():
                if count < MINIMUM_TREND_COUNT:
                    continue
                before = sum(counts_by_month.get(other, {}).get(lemma, 0) for other in baseline_of[month])
                ratio = (count / words_by_month[month]) / ((before + 1) / baseline_words)
                if ratio >= MINIMUM_TREND_RATIO:
                    trends.append([lemma, count, round(ratio, 1)])
        trends.sort(key=lambda trend: (-trend[2], trend[0]))
        month_returns = sorted(returns[month], key=lambda item: (dates[item[1]] - dates[item[2]], item[0]))
        month_marks = sorted(marks[month], key=lambda item: (-item[1], -item[3], item[0]))
        result.append({
            'monat': month,
            'sitzungen': len(indices),
            'woerter': words_by_month[month],
            'laengste_sitzung': max(indices, key=lambda index: protocols[index].get('woerter', 0)),
            'neue_woerter': {'anzahl': len(new_words[month]), 'beispiele': examples[:LISTED]},
            'erste_personen': [[name, group, count] for (name, group), count
                               in sorted(first_speakers[month].items(), key=lambda item: (-item[1], item[0]))[:LISTED]],
            'wiederkehrer': month_returns[:LISTED],
            'jubilaeen': month_marks[:LISTED],
            'trend': trends[:LISTED],
            'haeufigste': [[lemma, count] for lemma, count
                           in sorted(monthly.items(), key=lambda item: (-item[1], item[0]))[:LISTED]],
        })
    return {'monate': result}


def write_highlights(directory: Path) -> None:
    protocols = json.loads((directory / 'protocols.json').read_text())
    highlights = build_highlights(protocols, lambda: read_lemmas(directory))
    (directory / 'monate.json').write_bytes(json.dumps(highlights, ensure_ascii=False, separators=(',', ':')).encode())
    print(f'Monatsrückblicke: {len(highlights["monate"])} Monate')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('directory', type=Path, help='Ordner eines Exports (static-data)')
    write_highlights(parser.parse_args().directory)
