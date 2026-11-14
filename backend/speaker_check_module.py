"""
Speaker tracking module for deferred speaker checking after bulk processing.
Only checks speakers for words from WP 19+ (after 2014).
"""

import logging
import time
from typing import Dict, List, Optional
from database import (
    get_words_needing_speaker_check,
    get_or_create_speaker,
    get_or_create_party,
    update_word_speaker,
    mark_word_speaker_checked,
    get_connection,
)
from optv_api import get_speaker_info, should_check_speaker
from bundestag_api import get_mdb_info_fuzzy

# Rate limiting between API calls
API_DELAY = 1.0  # seconds


def check_speakers_for_batch(max_words: Optional[int] = None, delay: float = API_DELAY) -> Dict:
    """
    Check OpenParliamentTV for speaker information on words from WP 19+.
    Enriches each found speaker with biographical data from the Bundestag
    MdB Stammdaten via bundestag_api.get_mdb_info().

    This should be called AFTER bulk protocol processing is complete,
    as the first occurrence date may change during processing.

    Args:
        max_words: Maximum number of words to check (None = all)
        delay: Delay between API calls for rate limiting

    Returns:
        Dictionary with statistics about speaker checking
    """
    logging.info("=" * 70)
    logging.info("Starting speaker check for words from WP 19+")
    logging.info("=" * 70)

    # Get words that need speaker checking
    words = get_words_needing_speaker_check(limit=max_words)

    if not words:
        logging.info("No words need speaker checking")
        return {
            'checked': 0,
            'found': 0,
            'not_found': 0,
            'errors': 0
        }

    logging.info(f"Found {len(words)} words to check for speakers")
    print()

    stats = {
        'checked': 0,
        'found': 0,
        'not_found': 0,
        'errors': 0
    }

    for i, word_data in enumerate(words, 1):
        word = word_data['word']
        date = word_data['datum']
        wahlperiode = word_data['wahlperiode']
        protokollnummer = word_data['protokollnummer']

        logging.info(f"[{i}/{len(words)}] Checking '{word}' from WP {wahlperiode}/{protokollnummer} ({date})")

        try:
            # Get speaker info from OPTV (uses main-speaker attribute)
            speaker_info = get_speaker_info(word, date, wahlperiode)

            if speaker_info:
                # Enrich with biographical data from Bundestag Stammdaten (fuzzy)
                mdb_info = get_mdb_info_fuzzy(speaker_info['speaker'])

                birth_date = mdb_info.get('birth_date') if mdb_info else None
                birth_place = mdb_info.get('birth_place') if mdb_info else None
                profession = mdb_info.get('profession') if mdb_info else None
                bundestag_id = mdb_info.get('bundestag_id') if mdb_info else None

                # Create or get speaker (with current/most recent party)
                speaker_id = get_or_create_speaker(
                    speaker_name=speaker_info['speaker'],
                    party_name=speaker_info['party'],
                    optv_link=speaker_info['link'],
                    birth_date=birth_date,
                    birth_place=birth_place,
                    profession=profession,
                    bundestag_id=bundestag_id,
                )

                # Also track the party at time of speaking
                party_at_time_id = get_or_create_party(speaker_info['party'])

                # Update word with speaker info
                update_word_speaker(word, speaker_id, speaker_info['link'], party_at_time_id)

                mdb_info_str = f" [BT-ID: {bundestag_id}]" if bundestag_id else ""
                logging.info(f"  Speaker found: {speaker_info['speaker']} ({speaker_info['party']}){mdb_info_str}")
                stats['found'] += 1
            else:
                # Mark as checked even if not found
                mark_word_speaker_checked(word)
                logging.info(f"  No speaker found in OPTV")
                stats['not_found'] += 1

            stats['checked'] += 1

            # Rate limiting
            if i < len(words):
                time.sleep(delay)

        except KeyboardInterrupt:
            logging.warning("Speaker check interrupted by user")
            break
        except Exception as e:
            logging.error(f"  Error checking speaker for '{word}': {e}")
            stats['errors'] += 1

    print()
    logging.info("=" * 70)
    logging.info("Speaker check complete!")
    logging.info(f"  Checked: {stats['checked']}")
    logging.info(f"  Found: {stats['found']}")
    logging.info(f"  Not found: {stats['not_found']}")
    logging.info(f"  Errors: {stats['errors']}")
    logging.info("=" * 70)
    print()

    return stats


def backfill_bundestag_ids() -> Dict:
    """
    Attempt to fill in missing bundestag_id for speakers identified by name only.

    Iterates over all speakers that have no bundestag_id and tries to find
    them in the Bundestag Stammdaten via fuzzy matching.  Should be run after
    bundestag.de publishes an updated Stammdaten XML (e.g. after a new
    Wahlperiode election).

    Returns:
        Dictionary with counts: total, updated, not_found
    """
    from psycopg2.extras import RealDictCursor

    logging.info("=" * 70)
    logging.info("Backfilling missing Bundestag IDs for speakers")
    logging.info("=" * 70)

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        "SELECT speaker_id, name FROM speakers WHERE bundestag_id IS NULL ORDER BY name"
    )
    speakers = cursor.fetchall()
    cursor.close()

    stats = {'total': len(speakers), 'updated': 0, 'not_found': 0}

    if not speakers:
        logging.info("All speakers already have a Bundestag ID.")
        return stats

    logging.info(f"Found {len(speakers)} speakers without Bundestag ID")

    update_cursor = conn.cursor()
    for row in speakers:
        mdb_info = get_mdb_info_fuzzy(row['name'])
        if mdb_info and mdb_info.get('bundestag_id'):
            bt_id = mdb_info['bundestag_id']
            update_cursor.execute(
                "UPDATE speakers SET bundestag_id = %s WHERE speaker_id = %s",
                (bt_id, row['speaker_id']),
            )
            logging.info(f"  Backfilled: {row['name']} -> BT-ID {bt_id}")
            stats['updated'] += 1
        else:
            logging.debug(f"  No match: {row['name']}")
            stats['not_found'] += 1

    conn.commit()
    update_cursor.close()

    logging.info("=" * 70)
    logging.info(f"Backfill complete: {stats['updated']} updated, {stats['not_found']} not found")
    logging.info("=" * 70)
    return stats
