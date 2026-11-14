"""
Bundestag Personenstammdaten API integration.
Fetches detailed information about members of parliament.

API Documentation: https://search.dip.bundestag.de/api/v1/swagger-ui/#/Personenstammdaten
"""

import json
import logging
import os
from typing import Optional, Dict, List
from dotenv import load_dotenv
from xml_processing import get_url_content

load_dotenv()

API_KEY = os.environ.get('BUNDESTAG_API_KEY')
PERSON_API_BASE = "https://search.dip.bundestag.de/api/v1/person"


def search_person_by_name(name: str) -> Optional[List[Dict]]:
    """
    Search for a person by name in the Bundestag database.

    Args:
        name: Full name of the person (e.g., "Angela Merkel")

    Returns:
        List of matching persons with their IDs
    """
    try:
        # For exact name matching, we'll fetch and filter client-side
        # The API doesn't support good name filtering
        name_parts = name.split()
        lastname = name_parts[-1] if name_parts else name

        url = f"{PERSON_API_BASE}?apikey={API_KEY}&format=json"

        logging.debug(f"Searching person: {url}")
        response = get_url_content(url)

        if not response or response.status_code != 200:
            logging.error(f"Person search failed: {response.status_code if response else 'No response'}")
            return None

        data = json.loads(response.text)

        if data.get('documents'):
            persons = []
            for doc in data['documents']:
                # Filter by name on client side
                doc_lastname = doc.get('nachname', '').lower()
                doc_firstname = doc.get('vorname', '').lower()

                if lastname.lower() in doc_lastname:
                    # If we have a firstname, check that too
                    if len(name_parts) > 1:
                        if name_parts[0].lower() in doc_firstname:
                            persons.append({
                                'id': doc.get('id'),
                                'nachname': doc.get('nachname'),
                                'vorname': doc.get('vorname'),
                                'titel': doc.get('titel'),
                                'namenszusatz': doc.get('namenszusatz'),
                            })
                    else:
                        persons.append({
                            'id': doc.get('id'),
                            'nachname': doc.get('nachname'),
                            'vorname': doc.get('vorname'),
                            'titel': doc.get('titel'),
                            'namenszusatz': doc.get('namenszusatz'),
                        })

            return persons if persons else None

        return None

    except Exception as e:
        logging.error(f"Error searching person '{name}': {e}")
        return None


def get_person_details(person_id: str) -> Optional[Dict]:
    """
    Get detailed information about a person by their Bundestag ID.

    Args:
        person_id: Bundestag person ID

    Returns:
        Dictionary with person details including:
        - Basic info (name, birth date, birth place)
        - Party affiliations over time
        - Electoral districts
        - Positions/mandates
    """
    try:
        url = f"{PERSON_API_BASE}/{person_id}?apikey={API_KEY}"

        logging.debug(f"Fetching person details: {url}")
        response = get_url_content(url)

        if not response or response.status_code != 200:
            logging.error(f"Person details fetch failed: {response.status_code if response else 'No response'}")
            return None

        data = json.loads(response.text)

        # Handle both single result and array response
        if isinstance(data, list):
            if not data:
                return None
            person_doc = data[0]
        elif 'documents' in data and data['documents']:
            person_doc = data['documents'][0]
        else:
            person_doc = data

        # Extract relevant information
        person_data = {
            'id': person_doc.get('id'),
            'vorname': person_doc.get('vorname'),
            'nachname': person_doc.get('nachname'),
            'titel': person_doc.get('titel'),
            'namenszusatz': person_doc.get('namenszusatz'),
            'geburtsdatum': person_doc.get('geburtsdatum'),
            'geburtsort': person_doc.get('geburtsort'),
            'sterbedatum': person_doc.get('sterbedatum'),
            'geschlecht': person_doc.get('geschlecht'),
            'beruf': person_doc.get('beruf'),
            'partei': person_doc.get('aktualisiert', {}).get('partei') if isinstance(person_doc.get('aktualisiert'), dict) else None,
            'wahlperioden': [],
            'raw_data': person_doc  # Store full response for reference
        }

        # Extract Wahlperioden information
        if 'wahlperioden' in person_doc:
            for wp in person_doc['wahlperioden']:
                wp_data = {
                    'wp_nummer': wp.get('wp'),
                    'mandatsart': wp.get('mandatsart'),
                    'wahlkreis_nummer': wp.get('wkr_nummer'),
                    'wahlkreis_name': wp.get('wkr_name'),
                    'liste': wp.get('liste'),
                    'partei': wp.get('partei'),
                    'fraktion': wp.get('fraktion'),
                    'institutionen': wp.get('ins_wps', [])
                }
                person_data['wahlperioden'].append(wp_data)

        return person_data

    except Exception as e:
        logging.error(f"Error fetching person details for ID {person_id}: {e}")
        return None


def get_party_at_wahlperiode(person_data: Dict, wahlperiode: int) -> Optional[str]:
    """
    Get the party a person belonged to during a specific Wahlperiode.

    Args:
        person_data: Person data from get_person_details()
        wahlperiode: Wahlperiode number

    Returns:
        Party name/abbreviation for that Wahlperiode
    """
    if not person_data or 'wahlperioden' not in person_data:
        return None

    for wp in person_data['wahlperioden']:
        if wp['wp_nummer'] == wahlperiode:
            # Prefer Fraktion, fallback to Partei
            return wp.get('fraktion') or wp.get('partei')

    return None


def match_speaker_to_bundestag(speaker_name: str) -> Optional[str]:
    """
    Try to match a speaker name to a Bundestag person ID.

    Args:
        speaker_name: Name from OpenParliamentTV

    Returns:
        Bundestag person ID if found, None otherwise
    """
    # Search for the person
    results = search_person_by_name(speaker_name)

    if not results:
        logging.info(f"No Bundestag match found for '{speaker_name}'")
        return None

    if len(results) == 1:
        # Exact match
        logging.info(f"Found Bundestag match for '{speaker_name}': {results[0]['id']}")
        return results[0]['id']

    # Multiple matches - try to find exact name match
    for person in results:
        full_name = f"{person.get('vorname', '')} {person.get('nachname', '')}".strip()
        if full_name.lower() == speaker_name.lower():
            logging.info(f"Found exact Bundestag match for '{speaker_name}': {person['id']}")
            return person['id']

    # Return first match if no exact match
    logging.warning(f"Multiple matches for '{speaker_name}', using first: {results[0]['id']}")
    return results[0]['id']


if __name__ == "__main__":
    # Test the API
    logging.basicConfig(level=logging.INFO)

    # Test with a known person
    test_name = "Angela Merkel"

    print(f"Testing Bundestag Person API with '{test_name}'")
    print("=" * 70)

    # Search for person
    results = search_person_by_name(test_name)

    if results:
        print(f"✓ Found {len(results)} result(s):")
        for person in results:
            print(f"  - {person['vorname']} {person['nachname']} (ID: {person['id']})")

        # Get details for first result
        person_id = results[0]['id']
        print(f"\nFetching details for ID {person_id}...")
        details = get_person_details(person_id)

        if details:
            print(f"✓ Person details:")
            print(f"  Name: {details['vorname']} {details['nachname']}")
            print(f"  Geboren: {details['geburtsdatum']} in {details['geburtsort']}")
            print(f"  Beruf: {details['beruf']}")
            print(f"  Aktuelle Partei: {details['partei']}")
            print(f"\n  Wahlperioden ({len(details['wahlperioden'])}):")
            for wp in details['wahlperioden'][:5]:  # Show first 5
                print(f"    WP {wp['wp_nummer']}: {wp['partei']} / {wp['fraktion']}")
                if wp['wahlkreis_name']:
                    print(f"      Wahlkreis: {wp['wahlkreis_name']}")
    else:
        print("✗ No results found")
