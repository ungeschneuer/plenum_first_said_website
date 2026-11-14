"""
Check OpenParliamentTV for speaker information on existing words from WP 19+.
This script retroactively adds speaker information to words that were processed
before the speaker tracking feature was implemented.
"""

import logging
import time
from database import (
    get_connection, get_or_create_speaker,
    update_word_speaker, mark_word_speaker_checked
)
from optv_api import get_speaker_info, should_check_speaker

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Rate limiting: wait between API calls
API_DELAY = 1.0  # seconds


def get_words_needing_speaker_check(limit=None):
    """Get words from WP 19+ that haven't been checked for speakers yet."""
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT w.word, w.word_id, p.datum, p.wahlperiode, p.protokollnummer
        FROM words w
        JOIN protocols p ON w.first_protocol_id = p.id
        WHERE p.wahlperiode >= 19
          AND (w.speaker_checked IS NULL OR w.speaker_checked = 0)
        ORDER BY p.datum DESC
    """

    if limit:
        query += f" LIMIT {limit}"

    cursor.execute(query)
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return results


def check_word_speaker(word_data):
    """Check OPTV for speaker info for a single word."""
    word = word_data['word']
    date = word_data['datum']
    wahlperiode = word_data['wahlperiode']
    protokollnummer = word_data['protokollnummer']

    logging.info(f"Checking '{word}' from WP {wahlperiode}/{protokollnummer} ({date})")

    try:
        # Get speaker info from OPTV
        speaker_info = get_speaker_info(word, date, wahlperiode)

        if speaker_info:
            # Create or get speaker (with current/most recent party)
            speaker_id = get_or_create_speaker(
                speaker_name=speaker_info['speaker'],
                party_name=speaker_info['party'],
                optv_link=speaker_info['link']
            )

            # Also create/get the party at time of speaking
            from database import get_or_create_party
            party_at_time_id = get_or_create_party(speaker_info['party'])

            # Update word with speaker info and historical party
            update_word_speaker(word, speaker_id, speaker_info['link'], party_at_time_id)

            logging.info(f"  ✓ Added speaker: {speaker_info['speaker']} ({speaker_info['party']})")
            return True
        else:
            # Mark as checked even if not found
            mark_word_speaker_checked(word)
            logging.info(f"  ⊘ No speaker found in OPTV")
            return False

    except Exception as e:
        logging.error(f"  ✗ Error checking speaker for '{word}': {e}")
        return False


def process_batch(limit=None, delay=API_DELAY):
    """Process a batch of words to check for speakers."""
    words = get_words_needing_speaker_check(limit)

    if not words:
        logging.info("No words need speaker checking!")
        return

    logging.info(f"Found {len(words)} words to check")
    print()

    success_count = 0
    not_found_count = 0
    error_count = 0

    for i, word_data in enumerate(words, 1):
        logging.info(f"[{i}/{len(words)}] Processing...")

        try:
            result = check_word_speaker(word_data)

            if result:
                success_count += 1
            else:
                not_found_count += 1

            # Rate limiting
            if i < len(words):
                time.sleep(delay)

        except KeyboardInterrupt:
            logging.warning("Interrupted by user")
            break
        except Exception as e:
            logging.error(f"Unexpected error: {e}")
            error_count += 1

    print()
    print("=" * 70)
    logging.info("Processing complete!")
    logging.info(f"  Success: {success_count}")
    logging.info(f"  Not found: {not_found_count}")
    logging.info(f"  Errors: {error_count}")
    print("=" * 70)


if __name__ == "__main__":
    import sys

    print("=" * 70)
    print("SPEAKER CHECK - OpenParliamentTV Integration")
    print("=" * 70)
    print()

    # Get limit from command line
    limit = None
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
            print(f"Processing up to {limit} words...")
        except ValueError:
            print("Invalid limit, processing all words")
    else:
        print("Processing all words needing speaker check...")

    print()
    process_batch(limit=limit)
