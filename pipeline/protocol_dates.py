"""Correct session dates that DIP lists with a typing error.

Within an electoral term the sessions are numbered in the order they were held, so a session's date lies between
the dates of the sessions before and after it. DIP lists a few dates one year or one month off (01/195 on
21.02.1951 between sessions of 20.02.1952 and 28.02.1952). Such a date is replaced when exactly one date with the
year or the month moved by one fits between the neighbours; the listed date stays in "datum_dip".
"""

import sys
from datetime import date

from protocol_sources import SESSION_NUMBER


def moved_by_one(day: date) -> list[date]:
    candidates = []
    for year, month in ((day.year - 1, day.month), (day.year + 1, day.month),
                        (day.year - (day.month == 1), (day.month - 2) % 12 + 1),
                        (day.year + (day.month == 12), day.month % 12 + 1)):
        try:
            candidates.append(day.replace(year=year, month=month))
        except ValueError:
            pass
    return candidates


def corrected_date(previous: str, listed: str, following: str) -> str | None:
    """The single date moved by one that fits between the neighbours, if the listed date does not."""
    if not previous <= following or previous <= listed <= following:
        return None
    fitting = [candidate.isoformat() for candidate in moved_by_one(date.fromisoformat(listed))
               if previous <= candidate.isoformat() <= following]
    return fitting[0] if len(fitting) == 1 else None


def correct_dates(entries: list[dict]) -> None:
    """Correct the dates of entries that lie outside the dates of their neighbouring sessions."""
    sessions: dict[int, list[tuple[int, dict]]] = {}
    for entry in entries:
        number = SESSION_NUMBER.fullmatch(entry['nummer'].strip())
        if number and entry['datum']:
            sessions.setdefault(int(number.group(1)), []).append((int(number.group(2)), entry))
    for term_sessions in sessions.values():
        term_sessions.sort(key=lambda session: session[0])
        for (_, previous), (_, entry), (_, following) in zip(term_sessions, term_sessions[1:], term_sessions[2:]):
            correction = corrected_date(previous['datum'], entry['datum'], following['datum'])
            if correction:
                print(f"{entry['nummer']}: Datum {entry['datum']} passt nicht zwischen {previous['nummer']} und "
                      f"{following['nummer']}, korrigiert auf {correction}", file=sys.stderr)
                entry.setdefault('datum_dip', entry['datum'])
                entry['datum'] = correction
