"""
Parallel protocol processor with deferred speaker tracking.
Processes protocols in parallel, then checks speakers for WP 19+ words after completion.

Performance: Near-linear speedup with number of cores
- 4 cores: ~4x faster than sequential
- 8 cores: ~7-8x faster than sequential
"""

import logging
import os
import random
import sys
from pathlib import Path
from typing import Optional, List, Dict, Tuple
from dotenv import load_dotenv
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from datetime import datetime
import psycopg2
import psycopg2.errors
from psycopg2.extras import execute_values
import json

DEADLOCK_MAX_RETRIES = 5

# Load environment variables
load_dotenv()

ARCHIVE_DIR = Path(__file__).parent / "archive"

# PostgreSQL configuration
DB_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': int(os.getenv('POSTGRES_PORT', 5432)),
    'database': os.getenv('POSTGRES_DB', 'bundestag'),
    'user': os.getenv('POSTGRES_USER', 'bundestag_user'),
    'password': os.getenv('POSTGRES_PASSWORD', ''),
}

# Global progress tracking
progress_lock = Lock()
progress_data = {
    'processed': 0,
    'total': 0,
    'errors': 0,
    'start_time': 0
}


def get_db_connection():
    """Get a new PostgreSQL connection (thread-safe)."""
    return psycopg2.connect(**DB_CONFIG)


def process_single_protocol(protocol_data: dict) -> dict:
    """
    Worker function to process a single protocol.
    Returns result dict with statistics.
    """
    protocol_id = protocol_data['id']
    start_time = time.perf_counter()

    try:
        # Import here to avoid issues with multiprocessing
        from xml_processing import process_protocol_xml
        from text_processing import count_word_frequencies_enhanced, get_total_word_count

        # Check if XML exists in archive
        xml_file = ARCHIVE_DIR / f"{protocol_id}.xml"

        if not xml_file.exists():
            return {
                'protocol_id': protocol_id,
                'success': False,
                'error': 'XML not found in archive',
                'time': 0,
                'words': 0
            }

        # Extract text
        text = process_protocol_xml(str(xml_file))
        if not text:
            return {
                'protocol_id': protocol_id,
                'success': False,
                'error': 'Text extraction failed',
                'time': 0,
                'words': 0
            }

        # Count words with NLP
        word_freq, nlp_data = count_word_frequencies_enhanced(text)
        total_words = get_total_word_count(text)

        # Get protocol date from database (read-only, outside retry loop)
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT datum FROM protocols WHERE id = %s", (protocol_id,))
            result = cursor.fetchone()
            cursor.close()
        finally:
            conn.close()

        if not result:
            return {
                'protocol_id': protocol_id,
                'success': False,
                'error': 'Protocol not found in database',
                'time': 0,
                'words': 0
            }

        protocol_date = result[0]

        # Insert with retry on deadlock
        for attempt in range(DEADLOCK_MAX_RETRIES):
            conn = get_db_connection()
            try:
                cursor = conn.cursor()

                insert_word_occurrences_bulk(
                    conn, cursor, protocol_id, protocol_date, word_freq, nlp_data
                )

                cursor.execute(
                    "UPDATE protocols SET processed = TRUE, total_words = %s WHERE id = %s",
                    (total_words, protocol_id)
                )

                conn.commit()
                cursor.close()
                conn.close()
                break  # success

            except psycopg2.errors.DeadlockDetected:
                conn.rollback()
                conn.close()
                if attempt < DEADLOCK_MAX_RETRIES - 1:
                    delay = (2 ** attempt) * 0.1 + random.uniform(0, 0.1)
                    logging.warning(
                        f"Deadlock on {protocol_id} (attempt {attempt + 1}), "
                        f"retrying in {delay:.2f}s"
                    )
                    time.sleep(delay)
                else:
                    raise
            except Exception:
                conn.rollback()
                conn.close()
                raise

        elapsed = time.perf_counter() - start_time

        # Update global progress
        with progress_lock:
            progress_data['processed'] += 1
            processed = progress_data['processed']
            total = progress_data['total']
            elapsed_total = time.perf_counter() - progress_data['start_time']
            rate = processed / elapsed_total if elapsed_total > 0 else 0
            eta = (total - processed) / rate if rate > 0 else 0

            logging.info(
                f"[{processed}/{total}] {protocol_id}: {len(word_freq)} unique words, "
                f"{total_words} total ({elapsed:.1f}s) | "
                f"Rate: {rate:.1f}/s, ETA: {eta/60:.1f}min"
            )

        return {
            'protocol_id': protocol_id,
            'success': True,
            'error': None,
            'time': elapsed,
            'words': len(word_freq),
            'total_words': total_words
        }

    except Exception as e:
        logging.error(f"Error processing {protocol_id}: {e}", exc_info=True)

        with progress_lock:
            progress_data['errors'] += 1

        return {
            'protocol_id': protocol_id,
            'success': False,
            'error': str(e),
            'time': time.perf_counter() - start_time,
            'words': 0
        }


def insert_word_occurrences_bulk(
    conn, cursor, protocol_id: str, protocol_date: str,
    word_freq: dict, nlp_data: dict
):
    """
    Bulk insert word occurrences with NLP data.
    Thread-safe for PostgreSQL.
    """
    if not word_freq:
        return

    occurrence_data = []

    # Sort alphabetically so all workers acquire word locks in the same order,
    # which prevents circular lock waits (deadlocks).
    for word, count in sorted(word_freq.items()):
        # Get NLP data for this word
        nlp = nlp_data.get(word, {})

        # Convert compound_parts to JSON if it's a list
        compound_parts = nlp.get('compound_parts')
        if isinstance(compound_parts, list):
            compound_parts = json.dumps(compound_parts)

        # Atomic upsert: avoids deadlocks caused by concurrent SELECT + INSERT
        # across parallel workers processing the same vocabulary.
        # ON CONFLICT updates first_protocol_id only when the new protocol is older.
        cursor.execute("""
            INSERT INTO words (
                word, first_protocol_id,
                gender, pos_tag, base_lemma, gendered_lemma,
                is_compound, compound_parts, analysis_source, confidence,
                is_abbreviation
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (word) DO UPDATE
            SET first_protocol_id = CASE
                WHEN words.first_protocol_id IS NULL
                     OR (SELECT datum FROM protocols WHERE id = EXCLUDED.first_protocol_id)
                        < (SELECT datum FROM protocols WHERE id = words.first_protocol_id)
                THEN EXCLUDED.first_protocol_id
                ELSE words.first_protocol_id
            END,
            first_speaker_id = CASE
                WHEN words.first_protocol_id IS NULL
                     OR (SELECT datum FROM protocols WHERE id = EXCLUDED.first_protocol_id)
                        < (SELECT datum FROM protocols WHERE id = words.first_protocol_id)
                THEN NULL
                ELSE words.first_speaker_id
            END,
            speaker_checked = CASE
                WHEN words.first_protocol_id IS NULL
                     OR (SELECT datum FROM protocols WHERE id = EXCLUDED.first_protocol_id)
                        < (SELECT datum FROM protocols WHERE id = words.first_protocol_id)
                THEN FALSE
                ELSE words.speaker_checked
            END
            RETURNING word_id
        """, (
            word, protocol_id,
            nlp.get('gender'),
            nlp.get('pos'),           # analysis dict key is 'pos', not 'pos_tag'
            nlp.get('base_lemma'),
            nlp.get('gendered_lemma'),
            nlp.get('is_compound', False),
            compound_parts,
            nlp.get('source'),        # analysis dict key is 'source', not 'analysis_source'
            nlp.get('confidence'),
            nlp.get('is_abbreviation', False)
        ))

        word_id = cursor.fetchone()[0]

        # Add to occurrence data
        occurrence_data.append((word_id, protocol_id, protocol_date, count))

    # Deduplicate occurrence_data by (word_id, protocol_id) and sum counts
    # This prevents "cannot affect row a second time" error
    if occurrence_data:
        occurrence_dict = {}
        for word_id, prot_id, date, cnt in occurrence_data:
            key = (word_id, prot_id)
            if key in occurrence_dict:
                # Same word in same protocol - sum the counts
                occurrence_dict[key] = (word_id, prot_id, date, occurrence_dict[key][3] + cnt)
            else:
                occurrence_dict[key] = (word_id, prot_id, date, cnt)

        occurrence_data_dedup = list(occurrence_dict.values())

        # Bulk insert occurrences
        execute_values(
            cursor,
            """
            INSERT INTO word_occurrences (word_id, protocol_id, date, count)
            VALUES %s
            ON CONFLICT (word_id, protocol_id) DO UPDATE
            SET count = EXCLUDED.count
            """,
            occurrence_data_dedup,
            page_size=1000
        )

        # Keep total_occurrences in sync so search stays fast without a JOIN.
        # Recalculate from word_occurrences rather than incrementing, so the value
        # stays correct even when a protocol is reprocessed (ON CONFLICT replaces
        # the count, but a naive increment would double-count it).
        word_ids = [word_id for word_id, _, _, _ in occurrence_data_dedup]
        cursor.execute("""
            UPDATE words w
            SET total_occurrences = sub.total
            FROM (
                SELECT word_id, SUM(count) AS total
                FROM word_occurrences
                WHERE word_id = ANY(%s)
                GROUP BY word_id
            ) sub
            WHERE w.word_id = sub.word_id
        """, (word_ids,))


def process_protocols_parallel(
    max_workers: Optional[int] = None,
    batch_size: int = 10
) -> Dict:
    """
    Process unprocessed protocols in parallel using ThreadPoolExecutor.

    Args:
        max_workers: Number of parallel workers (default: CPU count)
        batch_size: Number of protocols to process at once

    Returns:
        Dictionary with processing statistics
    """
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

    # Determine number of workers
    if max_workers is None:
        max_workers = min(os.cpu_count() or 4, 8)  # Max 8 workers to avoid overwhelming DB

    logging.info(f"Starting parallel processing with {max_workers} workers")

    # Get unprocessed protocols
    from database import get_unprocessed_protocols

    protocols = get_unprocessed_protocols()

    if not protocols:
        logging.info("No unprocessed protocols found")
        return {
            'processed': 0,
            'failed': 0,
            'total_time': 0,
            'avg_time': 0
        }

    # Limit to batch size
    protocols = protocols[:batch_size] if batch_size else protocols

    total_protocols = len(protocols)
    logging.info(f"Processing {total_protocols} protocols")

    # Initialize progress tracking
    progress_data['processed'] = 0
    progress_data['total'] = total_protocols
    progress_data['errors'] = 0
    progress_data['start_time'] = time.perf_counter()

    # Process protocols in parallel
    results = []
    failed = []

    start_time = time.perf_counter()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_protocol = {
            executor.submit(process_single_protocol, protocol): protocol
            for protocol in protocols
        }

        # Collect results as they complete
        for future in as_completed(future_to_protocol):
            result = future.result()
            results.append(result)

            if not result['success']:
                failed.append(result)

    total_time = time.perf_counter() - start_time

    # Statistics
    successful = len(results) - len(failed)
    total_words = sum(r['words'] for r in results if r['success'])
    avg_time = sum(r['time'] for r in results if r['success']) / max(successful, 1)

    stats = {
        'processed': successful,
        'failed': len(failed),
        'total': total_protocols,
        'total_words': total_words,
        'total_time': total_time,
        'avg_time': avg_time,
        'rate': successful / total_time if total_time > 0 else 0,
        'errors': failed
    }

    # Print summary
    print()
    print("=" * 70)
    print("Processing Complete!")
    print("=" * 70)
    print(f"Processed: {successful}/{total_protocols} protocols")
    print(f"Failed: {len(failed)}")
    print(f"Total words: {total_words:,}")
    print(f"Total time: {total_time:.1f}s")
    print(f"Average time per protocol: {avg_time:.2f}s")
    print(f"Processing rate: {stats['rate']:.2f} protocols/sec")
    print()

    if failed:
        print("Failed protocols:")
        for error in failed[:10]:  # Show first 10 errors
            print(f"  - {error['protocol_id']}: {error['error']}")
        if len(failed) > 10:
            print(f"  ... and {len(failed)-10} more")
        print()

    return stats


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Process Bundestag protocols in parallel')
    parser.add_argument(
        '--workers',
        type=int,
        default=None,
        help='Number of parallel workers (default: CPU count, max 8)'
    )
    parser.add_argument(
        '--batch',
        type=int,
        default=10,
        help='Number of protocols to process (default: 10, 0 = all)'
    )
    parser.add_argument(
        '--check-speakers',
        action='store_true',
        help='Check OPTV for speakers after processing (WP 19+ only)'
    )
    parser.add_argument(
        '--max-speaker-checks',
        type=int,
        default=None,
        help='Maximum number of words to check for speakers (default: all new words)'
    )
    parser.add_argument(
        '--backfill-ids',
        action='store_true',
        help='Backfill missing Bundestag IDs for existing speakers using updated Stammdaten'
    )

    args = parser.parse_args()

    stats = process_protocols_parallel(
        max_workers=args.workers,
        batch_size=args.batch
    )

    # Check for speakers after processing (deferred until all protocols processed)
    # Only check words from WP 19+ (after 2014)
    if args.check_speakers and stats['processed'] > 0:
        print()
        logging.info("Protocol processing complete. Starting speaker check...")
        print()

        from speaker_check_module import check_speakers_for_batch
        speaker_stats = check_speakers_for_batch(max_words=args.max_speaker_checks)

        if speaker_stats['found'] > 0:
            logging.info(f"Successfully found speakers for {speaker_stats['found']} words")
        if speaker_stats['errors'] > 0:
            logging.warning(f"Speaker check had {speaker_stats['errors']} errors")

    if args.backfill_ids:
        print()
        logging.info("Starting Bundestag ID backfill for speakers without IDs...")
        print()

        from speaker_check_module import backfill_bundestag_ids
        backfill_bundestag_ids()

    sys.exit(0 if stats['failed'] == 0 else 1)
