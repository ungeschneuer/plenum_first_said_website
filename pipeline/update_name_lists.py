"""Write the lists of first names and surnames used to recognise names (pipeline/protocol_text.py).

The master data of all members of the Bundestag since 1949 (MdB-Stammdaten, open data of the Bundestag) give
their first names and surnames. First names already in first_names.txt (for example of members of the government
who were not members) are kept. Run by hand when a new electoral term begins.
"""

import io
import xml.etree.ElementTree as ElementTree
import zipfile
from pathlib import Path

from http_retry import fetch_bytes
from speakers import USER_AGENT
import urllib.request

MASTER_DATA_URL = 'https://www.bundestag.de/resource/blob/472878/MdB-Stammdaten.zip'
FIRST_NAMES_FILE = Path(__file__).with_name('first_names.txt')
SURNAMES_FILE = Path(__file__).with_name('member_surnames.txt')


def read_names_file(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {line for line in path.read_text().splitlines() if line and not line.startswith('#')}


def write_names_file(path: Path, header: str, names: set[str]) -> None:
    path.write_text(f'# {header}\n' + '\n'.join(sorted(names)) + '\n')


def name_parts(text: str) -> set[str]:
    return {part for part in text.replace('-', ' ').split() if part[:1].isupper() and part.replace('.', '').isalpha()}


def main() -> None:
    archive = zipfile.ZipFile(io.BytesIO(fetch_bytes(urllib.request.Request(MASTER_DATA_URL,
                                                                          headers={'User-Agent': USER_AGENT}))))
    root = ElementTree.fromstring(archive.read(next(name for name in archive.namelist() if name.endswith('.XML'))))
    first_names, surnames = read_names_file(FIRST_NAMES_FILE), set()
    for name in root.iter('NAME'):
        first_names |= name_parts(name.findtext('VORNAME') or '')
        surname = (name.findtext('NACHNAME') or '').strip()
        if surname[:1].isupper():
            surnames.add(surname)
    write_names_file(FIRST_NAMES_FILE, 'Vornamen aller Abgeordneten seit 1949 (MdB-Stammdaten) und weiterer Rednerinnen '
                     'und Redner; erzeugt von update_name_lists.py', first_names)
    write_names_file(SURNAMES_FILE, 'Nachnamen aller Abgeordneten seit 1949 (MdB-Stammdaten); erzeugt von '
                     'update_name_lists.py', surnames)
    print(f'{len(first_names)} Vornamen, {len(surnames)} Nachnamen')


if __name__ == '__main__':
    main()
