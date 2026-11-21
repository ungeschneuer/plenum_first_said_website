"""Fail when the newest protocol of an export is older than the breaks between sitting weeks explain.

The Bundestag sits in about two of every four weeks, DIP publishes texts up to a week later, and the summer break
lasts from July to September. An older newest protocol means that new protocols no longer arrive (an expired API
key, a changed DIP interface). Run in the daily workflow after publishing, so that a failed run notifies.

Usage: python pipeline/check_freshness.py EXPORT_DIRECTORY
"""

import json
import sys
from datetime import date
from pathlib import Path

MAXIMUM_AGE_DAYS = 42
SUMMER_BREAK_MONTHS = (7, 8, 9)
MAXIMUM_AGE_DAYS_IN_SUMMER = 84


def maximum_age(today: date) -> int:
    return MAXIMUM_AGE_DAYS_IN_SUMMER if today.month in SUMMER_BREAK_MONTHS else MAXIMUM_AGE_DAYS


def main() -> None:
    entries = json.loads((Path(sys.argv[1]) / 'protocols.json').read_text())
    newest = max(date.fromisoformat(entry['datum']) for entry in entries if entry['datum'])
    today = date.today()
    age = (today - newest).days
    print(f'Jüngstes Protokoll vom {newest.isoformat()}, {age} Tage alt')
    if age > maximum_age(today):
        print(f'::error::Seit {age} Tagen kein neues Protokoll; DIP-Schlüssel und DIP-Schnittstelle prüfen.')
        raise SystemExit(1)


if __name__ == '__main__':
    main()
