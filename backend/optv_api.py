"""
OpenParliamentTV API integration for speaker tracking.
Adapted from the original plenum_first_said bot.
"""

import json
import logging
import requests
from datetime import datetime
from typing import Optional, Dict

OPTV_API_BASE = "https://de.openparliament.tv/api/v1"
OPTV_SEARCH_ENDPOINT = f"{OPTV_API_BASE}/search/media/"

# Only track speakers for protocols from WP 19 onwards (October 2017).
MIN_WAHLPERIODE = 19


def get_optv_response(url: str) -> Optional[Dict]:
    """Fetch data from OpenParliamentTV API."""
    try:
        response = requests.get(url, timeout=10, allow_redirects=True)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logging.error(f"OPTV API request failed: {e}")
        return None
    except json.JSONDecodeError as e:
        logging.error(f"OPTV API response parsing failed: {e}")
        return None


def does_word_exist(document_data: Dict) -> bool:
    """Check if word exists in search results."""
    if not document_data:
        return False

    try:
        return document_data.get('meta', {}).get('results', {}).get('count', 0) > 0
    except (KeyError, TypeError):
        return False


def should_check_speaker(wahlperiode: int) -> bool:
    """
    Determine if we should check OPTV for this protocol.
    Only check for WP 19+ (October 2017 onwards).
    """
    return wahlperiode >= MIN_WAHLPERIODE


def find_main_speaker_name(media_item: Dict) -> Optional[str]:
    """
    Extract the main speaker's name from the textContents of a media item.
    Looks for a textBody entry with speakerstatus == 'main-speaker'.
    """
    try:
        text_contents = media_item.get('attributes', {}).get('textContents', [])
        for content in text_contents:
            for body_entry in content.get('textBody', []):
                if body_entry.get('speakerstatus') == 'main-speaker':
                    name = body_entry.get('speaker')
                    if name:
                        return name
    except (KeyError, TypeError):
        pass
    return None


def find_person_by_name(people_data: list, speaker_name: str) -> Optional[Dict]:
    """
    Find a person in the OPTV people array by matching their label against
    the speaker name from textContents.
    """
    for person in people_data:
        label = person.get('attributes', {}).get('label', '')
        if label == speaker_name:
            return person
    return None


def get_speaker_info(word: str, date: str, wahlperiode: int) -> Optional[Dict]:
    """
    Get speaker information for a word from OpenParliamentTV.

    Args:
        word: The word to search for
        date: Date in format YYYY-MM-DD
        wahlperiode: Legislature period number

    Returns:
        Dictionary with speaker, party, and link, or None if not found
    """
    # Only check for WP 19+
    if not should_check_speaker(wahlperiode):
        logging.debug(f"Skipping OPTV check for WP {wahlperiode} (< {MIN_WAHLPERIODE})")
        return None

    try:
        # Search for the word on the specific date
        url = f"{OPTV_SEARCH_ENDPOINT}?q={word}&dateTo={date}&dateFrom={date}"

        logging.debug(f"Querying OPTV: {url}")
        document_data = get_optv_response(url)

        if not document_data or not does_word_exist(document_data):
            logging.info(f"Word '{word}' not found in OPTV for date {date}")
            return None

        # Extract metadata from first result
        return extract_metadata(document_data, word)

    except Exception as e:
        logging.error(f"Error getting speaker info for '{word}': {e}")
        return None


def extract_metadata(document_data: Dict, word: str) -> Optional[Dict]:
    """
    Extract speaker and party information from OPTV response.

    Uses the 'main-speaker' speakerstatus from textContents to identify the
    actual speaker, then matches against the people relationship to get party
    info.  Falls back to people.data[0] if no main-speaker entry is found.

    Returns:
        Dictionary with:
        - speaker: Full name of speaker
        - party: Party name/abbreviation
        - link: Link to video on OpenParliamentTV
    """
    try:
        first_result = document_data['data'][0]

        # Extract type and ID for building link
        media_type = first_result['type']
        media_id = first_result['id']

        # Build link to video
        link = f"https://de.openparliament.tv/{media_type}/{media_id}?q={word}"

        people_list = first_result.get('relationships', {}).get('people', {}).get('data', [])

        # Step 1: find main speaker name from textContents
        main_speaker_name = find_main_speaker_name(first_result)

        if main_speaker_name:
            # Step 2: match against people array to get party
            person_data = find_person_by_name(people_list, main_speaker_name)
        else:
            # Fallback: use first person in array (original behaviour)
            logging.debug("No main-speaker in textContents, falling back to people[0]")
            person_data = people_list[0] if people_list else None

        if not person_data:
            logging.warning(f"Could not identify speaker for '{word}' in OPTV result {media_id}")
            return None

        attrs = person_data.get('attributes', {})
        speaker = attrs.get('label', '')

        # Prefer faction label (e.g. "DIE GRÜNEN") as stored party; fall back to
        # party label (e.g. "GRÜNE") if faction absent.
        faction_label = attrs.get('faction', {}).get('label')
        party_label = attrs.get('party', {}).get('label')
        party = faction_label or party_label

        metadata = {
            'speaker': speaker,
            'party': party,
            'link': link,
        }

        logging.info(f"Found speaker for '{word}': {speaker} ({party})")
        return metadata

    except (KeyError, IndexError, TypeError) as e:
        logging.error(f"Failed to extract OPTV metadata: {e}")
        logging.debug(f"Response data: {document_data}")
        return None


def verify_word_is_new(word: str, date: str) -> bool:
    """
    Verify that a word is truly new by checking if it existed before the given date.

    Args:
        word: The word to check
        date: Date to check against (YYYY-MM-DD)

    Returns:
        True if word is new (didn't exist before), False otherwise
    """
    try:
        # Convert to datetime and subtract one day
        date_obj = datetime.strptime(date, '%Y-%m-%d')

        # Search for word before this date
        url = f"{OPTV_SEARCH_ENDPOINT}?q={word}&dateTo={date_obj.strftime('%Y-%m-%d')}"

        document_data = get_optv_response(url)

        # If word exists before this date, it's not new
        if does_word_exist(document_data):
            logging.info(f"Word '{word}' already existed before {date}")
            return False

        return True

    except Exception as e:
        logging.error(f"Error verifying word newness: {e}")
        return False


if __name__ == "__main__":
    # Test the API
    logging.basicConfig(level=logging.INFO)

    # Test with a known word from recent years
    test_word = "Klimakrise"
    test_date = "2019-09-11"
    test_wp = 19

    print(f"Testing OPTV API with word '{test_word}' on {test_date}")
    print("=" * 70)

    result = get_speaker_info(test_word, test_date, test_wp)

    if result:
        print(f"Speaker found!")
        print(f"  Speaker: {result['speaker']}")
        print(f"  Party: {result['party']}")
        print(f"  Link: {result['link']}")
    else:
        print("No speaker information found")
