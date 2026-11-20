"""Count per person the lemmas they were the first to say, from a finished export.

Reads protocols.json and the word shards below the given directory and writes next to them:
  personen.json       {"personen": [{"id", "name", "anzahl", "zwischenrufe", "sitzungsleitung",
                                     "zuordnung", "wahlperioden": {term: [count, as chair, attribution]}}, ...],
                       "fraktionen": {term: {parliamentary group: count}}}
                      persons by descending count; "zuordnung" is the most frequent group or role, the chair
                      only for a person who never spoke otherwise
  personen/<id>.json  {"id", "name", "zuordnungen": [[attribution, count], ...],
                       "woerter": [[lemma, protocol index, 1 if interjection else 0], ...]} by protocol index

A person is identified by the folded spelling of the name (person_id), so the same name with and without a
group or role is one person. Protocols before the 19th electoral term often give only the surname, so one name
there can stand for several people. Words that were part of a quotation read out are not counted for the reader.

The script is separate from export_static_data.py so that it can change without a rebuild of the counts; the
publishing workflow runs it after every export.
"""

import argparse
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

LETTER_REPLACEMENTS = {'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss'}
# Group names that occur this rarely are misread headings, not parliamentary groups.
MINIMUM_GROUP_WORDS = 10
CHAIR_ROLES = {'Präsident', 'Präsidentin', 'Vizepräsident', 'Vizepräsidentin', 'Alterspräsident',
               'Alterspräsidentin'}


# Text recognition sometimes glues the last applause note or the introduction of an interjection to a name.
NOISE_BEFORE_NAME = re.compile(r'^(?:.*\b(?:Beifall|Gegenruf|Zuruf)\b.*?[-–\x96]\s*|(?:Weiterer )?Gegenruf des Abg\.\s*)')
TITLE_BEFORE_NAME = re.compile(r'^(?:Abg\.|Ministerpräsident(?:in)?|Minister(?:in)?|Senator(?:in)?|Staatsminister(?:in)?'
                               r'|Regierende[r]? Bürgermeister(?:in)?)\s+')
ROLE_AFTER_NAME = re.compile(r',\s.*$')


def clean_name(name: str) -> str:
    """The name without titles of office, glued notes and a role after a comma; empty if nothing is left."""
    name = NOISE_BEFORE_NAME.sub('', name.replace('\xad', '')).strip()
    name = ROLE_AFTER_NAME.sub('', TITLE_BEFORE_NAME.sub('', name)).strip()
    if not name[:1].isupper() or re.search(r'\b(?:Beifall|Zuruf|Gegenruf)\b', name):
        return ''
    return name


def person_id(name: str) -> str:
    folded = ''.join(LETTER_REPLACEMENTS.get(character, character) for character in name.lower())
    folded = ''.join(character for character in unicodedata.normalize('NFKD', folded)
                     if not unicodedata.combining(character))
    return re.sub(r'[^a-z0-9]+', '-', folded).strip('-')


# Notes on applause after a role, such as "Bundeskanzler (mit Beifall der Regierungsparteien begrüßt)".
APPLAUSE_AFTER_ROLE = re.compile(r'\s*\([^)]*(?:Beifall|begrüßt)[^)]*\)')


def attribution(speaker: dict) -> str:
    return (speaker.get('fraktion') or APPLAUSE_AFTER_ROLE.sub('', speaker.get('rolle') or '')).strip()


def main_attribution(attributions: Counter) -> str:
    """The most frequent group or role; the chair only for a person who never spoke otherwise."""
    candidates = [(count, label) for label, count in attributions.items() if label not in CHAIR_ROLES]
    candidates = candidates or [(count, label) for label, count in attributions.items()]
    return max(candidates)[1] if candidates else ''


def first_said_words(directory: Path):
    """Yields (lemma, first protocol index, speaker) for every lemma whose first speaker is known."""
    for key in json.loads((directory / 'shards.json').read_text()):
        for lemma, entry in json.loads((directory / 'words' / f'{key}.json').read_text()).items():
            speaker = entry.get('erste')
            if speaker and speaker.get('name') and not speaker.get('zitat'):
                yield lemma, entry['reihe'][0], speaker


def build_statistics(protocols: list[dict], words) -> tuple[dict, dict[str, dict]]:
    names: dict[str, Counter] = defaultdict(Counter)
    attributions: dict[str, Counter] = defaultdict(Counter)
    attributions_by_term: dict[str, dict[int, Counter]] = defaultdict(lambda: defaultdict(Counter))
    chair_by_term: dict[str, Counter] = defaultdict(Counter)
    interjections: Counter = Counter()
    words_of_person: dict[str, list] = defaultdict(list)
    group_counts: dict[int, Counter] = defaultdict(Counter)

    for lemma, protocol_index, speaker in words:
        name = clean_name(speaker['name'])
        identifier = person_id(name)
        if not identifier:
            continue
        term = protocols[protocol_index]['wahlperiode']
        label = attribution(speaker)
        names[identifier][name] += 1
        attributions[identifier][label] += 1
        attributions_by_term[identifier][term][label] += 1
        if speaker.get('rolle') in CHAIR_ROLES:
            chair_by_term[identifier][term] += 1
        if speaker.get('zwischenruf'):
            interjections[identifier] += 1
        words_of_person[identifier].append([lemma, protocol_index, 1 if speaker.get('zwischenruf') else 0])
        if speaker.get('fraktion'):
            group_counts[term][label] += 1

    persons, details = [], {}
    for identifier, spellings in names.items():
        name = max(spellings.items(), key=lambda pair: (pair[1], pair[0]))[0]
        terms = attributions_by_term[identifier]
        persons.append({
            'id': identifier,
            'name': name,
            'anzahl': len(words_of_person[identifier]),
            'zwischenrufe': interjections[identifier],
            'sitzungsleitung': sum(chair_by_term[identifier].values()),
            'zuordnung': main_attribution(attributions[identifier]),
            'wahlperioden': {str(term): [sum(counts.values()), chair_by_term[identifier][term], main_attribution(counts)]
                             for term, counts in sorted(terms.items())},
        })
        details[identifier] = {
            'id': identifier,
            'name': name,
            'zuordnungen': [[label, count] for label, count in attributions[identifier].most_common() if label],
            'woerter': sorted(words_of_person[identifier], key=lambda word: (word[1], word[0])),
        }
    persons.sort(key=lambda person: (-person['anzahl'], person['name']))
    summary = {
        'personen': persons,
        'fraktionen': {str(term): {label: count for label, count in counts.most_common() if count >= MINIMUM_GROUP_WORDS}
                       for term, counts in sorted(group_counts.items())},
    }
    return summary, details


def serialize(content) -> bytes:
    return json.dumps(content, ensure_ascii=False, separators=(',', ':')).encode()


def write_statistics(directory: Path) -> None:
    protocols = json.loads((directory / 'protocols.json').read_text())
    summary, details = build_statistics(protocols, first_said_words(directory))
    person_directory = directory / 'personen'
    person_directory.mkdir(exist_ok=True)
    for stale_file in person_directory.glob('*.json'):
        stale_file.unlink()
    for identifier, content in details.items():
        (person_directory / f'{identifier}.json').write_bytes(serialize(content))
    (directory / 'personen.json').write_bytes(serialize(summary))
    print(f'{len(details)} Personen, {sum(person["anzahl"] for person in summary["personen"])} erste Vorkommen')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('directory', type=Path, help='Ordner eines Exports (static-data)')
    write_statistics(parser.parse_args().directory)
