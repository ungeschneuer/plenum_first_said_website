"""Compare a new data release with the previous one before it replaces it.

A rebuild may change counts a little when rules change; a large change means a text source or the splitting of
texts failed, as when 185 protocols kept only a few hundred words. The check fails if protocols are missing, if the
total of counted words changes by more than MAXIMUM_TOTAL_CHANGE, or if more than MAXIMUM_SHARE_OF_SHRUNK_PROTOCOLS
of the protocols in both releases lose more than MAXIMUM_PROTOCOL_LOSS of their words.

Usage: python pipeline/compare_data.py PREVIOUS_DIRECTORY NEW_DIRECTORY
"""

import json
import sys
from pathlib import Path

MAXIMUM_TOTAL_CHANGE = 0.05
MAXIMUM_PROTOCOL_LOSS = 0.3
MAXIMUM_SHARE_OF_SHRUNK_PROTOCOLS = 0.01
EXAMPLES_SHOWN = 10


def words_by_protocol(directory: Path) -> dict[str, tuple[str, int]]:
    entries = json.loads((directory / 'protocols.json').read_text())
    return {entry['id']: (entry['nummer'], entry['woerter']) for entry in entries}


def problems(previous: dict[str, tuple[str, int]], new: dict[str, tuple[str, int]]) -> list[str]:
    found = []
    missing = [previous[key][0] for key in previous.keys() - new.keys()]
    if missing:
        found.append(f'{len(missing)} Protokolle fehlen: ' + ', '.join(sorted(missing)[:EXAMPLES_SHOWN]))

    previous_total = sum(words for _, words in previous.values())
    new_total = sum(words for _, words in new.values())
    if previous_total and abs(new_total - previous_total) > MAXIMUM_TOTAL_CHANGE * previous_total:
        found.append(f'Gesamtwörter {previous_total} → {new_total} ({(new_total / previous_total - 1):+.1%})')

    common = previous.keys() & new.keys()
    shrunk = sorted(previous[key][0] for key in common
                    if new[key][1] < (1 - MAXIMUM_PROTOCOL_LOSS) * previous[key][1])
    if common and len(shrunk) > MAXIMUM_SHARE_OF_SHRUNK_PROTOCOLS * len(common):
        found.append(f'{len(shrunk)} Protokolle verlieren mehr als {MAXIMUM_PROTOCOL_LOSS:.0%} ihrer Wörter: '
                     + ', '.join(shrunk[:EXAMPLES_SHOWN]))
    return found


def main() -> None:
    previous_directory, new_directory = map(Path, sys.argv[1:3])
    previous, new = words_by_protocol(previous_directory), words_by_protocol(new_directory)
    previous_total = sum(words for _, words in previous.values())
    new_total = sum(words for _, words in new.values())
    print(f'Protokolle {len(previous)} → {len(new)}, Wörter {previous_total} → {new_total}')
    found = problems(previous, new)
    for problem in found:
        print(f'::error::{problem}')
    if found:
        raise SystemExit('Der neue Datenstand weicht zu stark vom bisherigen ab.')


if __name__ == '__main__':
    main()
