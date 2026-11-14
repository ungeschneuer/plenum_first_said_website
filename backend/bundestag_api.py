"""
Bundestag MdB Stammdaten integration.

Downloads the official MdB Stammdaten XML from bundestag.de and provides
name-based lookup for biographical data (birth date, birth place, profession,
Bundestag ID).  The XML is fetched once per process and cached in memory.
"""

import difflib
import io
import logging
import os
import re
import requests
import zipfile
from typing import Dict, List, Optional

# Academic/honorary titles to strip before fuzzy matching
_TITLE_RE = re.compile(
    r'\b(Dr\.?|Prof\.?|h\.c\.?|mult\.?|rer\.?|pol\.?|jur\.?|nat\.?|med\.?|'
    r'phil\.?|ing\.?|habil\.?|Dipl\.?-?\w*\.?)\s*',
    re.IGNORECASE,
)
from xml.etree import ElementTree as ET

STAMMDATEN_URL = (
    "https://www.bundestag.de/resource/blob/472878"
    "/e207ab4b38c93187e6b6to8ae1a1df9e/MdB-Stammdaten-data.zip"
)

# In-memory index: normalised "nachname vorname" -> dict
_mdb_index: Dict[str, Dict] = {}
# Flat list of all normalised name keys (for difflib fuzzy matching)
_mdb_name_list: List[str] = []
_loaded = False


def _normalise(text: str) -> str:
    """Lowercase and collapse whitespace for fuzzy matching."""
    return re.sub(r'\s+', ' ', text.strip().lower())


def _load_stammdaten() -> None:
    """Download and parse the MdB Stammdaten XML, build name index."""
    global _loaded

    logging.info("Downloading MdB Stammdaten XML from bundestag.de …")
    try:
        resp = requests.get(STAMMDATEN_URL, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        logging.error(f"Could not download Stammdaten: {e}")
        return

    try:
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            xml_name = next(n for n in zf.namelist() if n.lower().endswith('.xml'))
            xml_bytes = zf.read(xml_name)
    except (zipfile.BadZipFile, StopIteration) as e:
        logging.error(f"Could not read Stammdaten ZIP: {e}")
        return

    # The XML has a DTD declaration that ET cannot resolve; strip it.
    xml_text = xml_bytes.decode('utf-8', errors='replace')
    xml_text = re.sub(r'<!DOCTYPE[^>]*>', '', xml_text)

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logging.error(f"Could not parse Stammdaten XML: {e}")
        return

    count = 0
    for mdb in root.findall('MDB'):
        mdb_id = (mdb.findtext('ID') or '').strip()

        name_el = mdb.find('NAMEN/NAME')
        if name_el is None:
            continue
        nachname = (name_el.findtext('NACHNAME') or '').strip()
        vorname = (name_el.findtext('VORNAME') or '').strip()
        if not nachname or not vorname:
            continue

        bio = mdb.find('BIOGRAFISCHE_ANGABEN')
        birth_date = (bio.findtext('GEBURTSDATUM') or '').strip() if bio is not None else ''
        birth_place = (bio.findtext('GEBURTSORT') or '').strip() if bio is not None else ''
        profession = (bio.findtext('BERUF') or '').strip() if bio is not None else ''
        party_short = (bio.findtext('PARTEI_KURZ') or '').strip() if bio is not None else ''

        # Index by "nachname vorname" (normalised)
        key = _normalise(f"{nachname} {vorname}")
        entry = {
            'bundestag_id': mdb_id,
            'nachname': nachname,
            'vorname': vorname,
            'birth_date': birth_date or None,
            'birth_place': birth_place or None,
            'profession': profession or None,
            'party_short': party_short or None,
        }
        _mdb_index[key] = entry

        # Also index "vorname nachname" for flexible matching
        key2 = _normalise(f"{vorname} {nachname}")
        _mdb_index.setdefault(key2, entry)

        count += 1

    # Build flat key list for difflib fuzzy matching
    _mdb_name_list.clear()
    _mdb_name_list.extend(_mdb_index.keys())

    _loaded = True
    logging.info(f"Loaded {count} MdB entries from Stammdaten")


def _ensure_loaded() -> None:
    if not _loaded:
        _load_stammdaten()


def _strip_titles(name: str) -> str:
    """Remove academic and honorary titles from a name string."""
    return _TITLE_RE.sub('', name).strip()


def get_mdb_info(speaker_name: str) -> Optional[Dict]:
    """
    Look up an MdB by full name (either 'Vorname Nachname' or 'Nachname Vorname').

    Returns a dict with keys:
        bundestag_id, birth_date, birth_place, profession, party_short
    or None if no match is found.
    """
    _ensure_loaded()
    key = _normalise(speaker_name)
    result = _mdb_index.get(key)
    if result:
        logging.debug(f"Stammdaten match for '{speaker_name}': {result['bundestag_id']}")
    else:
        logging.debug(f"No Stammdaten match for '{speaker_name}'")
    return result


def get_mdb_info_fuzzy(speaker_name: str, cutoff: float = 0.85) -> Optional[Dict]:
    """
    Look up an MdB by name with fuzzy matching as fallback.

    First tries exact normalised lookup, then strips academic titles and retries,
    then uses difflib.get_close_matches() with the given cutoff.

    Args:
        speaker_name: Speaker name as returned by OPTV (e.g. 'Dr. Angela Merkel')
        cutoff:       Minimum similarity ratio for difflib (0.0–1.0, default 0.85)

    Returns:
        Same dict as get_mdb_info(), or None if no close match found.
    """
    _ensure_loaded()

    # 1. Exact match
    key = _normalise(speaker_name)
    result = _mdb_index.get(key)
    if result:
        logging.debug(f"Stammdaten exact match for '{speaker_name}': {result['bundestag_id']}")
        return result

    # 2. Strip titles and retry exact match
    stripped = _strip_titles(speaker_name)
    if stripped != speaker_name:
        key2 = _normalise(stripped)
        result = _mdb_index.get(key2)
        if result:
            logging.debug(
                f"Stammdaten title-stripped match for '{speaker_name}' -> '{stripped}': "
                f"{result['bundestag_id']}"
            )
            return result

    # 3. Fuzzy match against all normalised keys
    query = _normalise(stripped) if stripped != speaker_name else key
    matches = difflib.get_close_matches(query, _mdb_name_list, n=1, cutoff=cutoff)
    if matches:
        result = _mdb_index[matches[0]]
        logging.info(
            f"Stammdaten fuzzy match for '{speaker_name}' -> '{matches[0]}': "
            f"{result['bundestag_id']} (cutoff={cutoff})"
        )
        return result

    logging.debug(f"No Stammdaten match for '{speaker_name}' (fuzzy cutoff={cutoff})")
    return None
