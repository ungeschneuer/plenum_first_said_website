"""
Static Wahlperiode reference data for the Bundestag (WP 1–21).

Replaces the former Wikidata SPARQL integration with curated, hardcoded data.
"""

from typing import Dict, List, Optional

_WP_DATA: Dict[int, Dict] = {
    1: {
        'start_date': '1949-09-07',
        'end_date': '1953-09-07',
        'election_date': '1949-08-14',
        'chancellor': 'Konrad Adenauer',
        'bundestag_president': 'Erich Köhler',
        'coalition': 'CDU/CSU, FDP, DP',
    },
    2: {
        'start_date': '1953-10-06',
        'end_date': '1957-10-14',
        'election_date': '1953-09-06',
        'chancellor': 'Konrad Adenauer',
        'bundestag_president': 'Eugen Gerstenmaier',
        'coalition': 'CDU/CSU, FDP, DP, GB/BHE',
    },
    3: {
        'start_date': '1957-10-15',
        'end_date': '1961-10-04',
        'election_date': '1957-09-15',
        'chancellor': 'Konrad Adenauer',
        'bundestag_president': 'Eugen Gerstenmaier',
        'coalition': 'CDU/CSU, DP',
    },
    4: {
        'start_date': '1961-10-05',
        'end_date': '1965-10-05',
        'election_date': '1961-09-17',
        'chancellor': 'Konrad Adenauer / Ludwig Erhard',
        'bundestag_president': 'Eugen Gerstenmaier',
        'coalition': 'CDU/CSU, FDP',
    },
    5: {
        'start_date': '1965-10-19',
        'end_date': '1969-10-19',
        'election_date': '1965-09-19',
        'chancellor': 'Ludwig Erhard / Kurt Georg Kiesinger',
        'bundestag_president': 'Eugen Gerstenmaier',
        'coalition': 'CDU/CSU, SPD',
    },
    6: {
        'start_date': '1969-10-20',
        'end_date': '1972-11-12',
        'election_date': '1969-09-28',
        'chancellor': 'Willy Brandt',
        'bundestag_president': 'Kai-Uwe von Hassel',
        'coalition': 'SPD, FDP',
    },
    7: {
        'start_date': '1972-12-13',
        'end_date': '1976-12-13',
        'election_date': '1972-11-19',
        'chancellor': 'Willy Brandt / Helmut Schmidt',
        'bundestag_president': 'Annemarie Renger',
        'coalition': 'SPD, FDP',
    },
    8: {
        'start_date': '1976-12-14',
        'end_date': '1980-11-03',
        'election_date': '1976-10-03',
        'chancellor': 'Helmut Schmidt',
        'bundestag_president': 'Karl Carstens',
        'coalition': 'SPD, FDP',
    },
    9: {
        'start_date': '1980-11-04',
        'end_date': '1983-03-28',
        'election_date': '1980-10-05',
        'chancellor': 'Helmut Schmidt / Helmut Kohl',
        'bundestag_president': 'Richard Stücklen',
        'coalition': 'SPD, FDP',
    },
    10: {
        'start_date': '1983-03-29',
        'end_date': '1987-02-17',
        'election_date': '1983-03-06',
        'chancellor': 'Helmut Kohl',
        'bundestag_president': 'Rainer Barzel / Philipp Jenninger',
        'coalition': 'CDU/CSU, FDP',
    },
    11: {
        'start_date': '1987-02-18',
        'end_date': '1990-12-19',
        'election_date': '1987-01-25',
        'chancellor': 'Helmut Kohl',
        'bundestag_president': 'Philipp Jenninger / Rita Süssmuth',
        'coalition': 'CDU/CSU, FDP',
    },
    12: {
        'start_date': '1990-12-20',
        'end_date': '1994-11-09',
        'election_date': '1990-12-02',
        'chancellor': 'Helmut Kohl',
        'bundestag_president': 'Rita Süssmuth',
        'coalition': 'CDU/CSU, FDP',
    },
    13: {
        'start_date': '1994-11-10',
        'end_date': '1998-10-25',
        'election_date': '1994-10-16',
        'chancellor': 'Helmut Kohl',
        'bundestag_president': 'Rita Süssmuth',
        'coalition': 'CDU/CSU, FDP',
    },
    14: {
        'start_date': '1998-10-26',
        'end_date': '2002-10-16',
        'election_date': '1998-09-27',
        'chancellor': 'Gerhard Schröder',
        'bundestag_president': 'Wolfgang Thierse',
        'coalition': 'SPD, Bündnis 90/Die Grünen',
    },
    15: {
        'start_date': '2002-10-17',
        'end_date': '2005-10-17',
        'election_date': '2002-09-22',
        'chancellor': 'Gerhard Schröder',
        'bundestag_president': 'Wolfgang Thierse',
        'coalition': 'SPD, Bündnis 90/Die Grünen',
    },
    16: {
        'start_date': '2005-10-18',
        'end_date': '2009-10-26',
        'election_date': '2005-09-18',
        'chancellor': 'Angela Merkel',
        'bundestag_president': 'Norbert Lammert',
        'coalition': 'CDU/CSU, SPD',
    },
    17: {
        'start_date': '2009-10-27',
        'end_date': '2013-10-21',
        'election_date': '2009-09-27',
        'chancellor': 'Angela Merkel',
        'bundestag_president': 'Norbert Lammert',
        'coalition': 'CDU/CSU, FDP',
    },
    18: {
        'start_date': '2013-10-22',
        'end_date': '2017-10-23',
        'election_date': '2013-09-22',
        'chancellor': 'Angela Merkel',
        'bundestag_president': 'Norbert Lammert',
        'coalition': 'CDU/CSU, SPD',
    },
    19: {
        'start_date': '2017-10-24',
        'end_date': '2021-10-25',
        'election_date': '2017-09-24',
        'chancellor': 'Angela Merkel',
        'bundestag_president': 'Wolfgang Schäuble',
        'coalition': 'CDU/CSU, SPD',
    },
    20: {
        'start_date': '2021-10-26',
        'end_date': '2025-03-24',
        'election_date': '2021-09-26',
        'chancellor': 'Olaf Scholz',
        'bundestag_president': 'Bärbel Bas',
        'coalition': 'SPD, Bündnis 90/Die Grünen, FDP',
    },
    21: {
        'start_date': '2025-03-25',
        'end_date': None,
        'election_date': '2025-02-23',
        'chancellor': 'Friedrich Merz',
        'bundestag_president': 'Julia Klöckner',
        'coalition': 'CDU/CSU, SPD',
    },
}


def get_wahlperiode_info(wp_number: int) -> Optional[Dict]:
    """
    Get static reference data for a Wahlperiode.

    Returns a dict with wahlperiode, start_date, end_date, election_date,
    chancellor, bundestag_president, coalition, parliament_composition,
    cabinet_members, total_seats — or None if the WP is unknown.
    """
    data = _WP_DATA.get(wp_number)
    if not data:
        return None
    return {
        'wahlperiode': wp_number,
        **data,
        'parliament_composition': [],
        'cabinet_members': [],
        'total_seats': 0,
    }


def list_wahlperioden() -> List[int]:
    """Return all known Wahlperiode numbers in ascending order."""
    return sorted(_WP_DATA.keys())
