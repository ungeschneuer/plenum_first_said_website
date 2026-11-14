"""
Complete database rebuild script.

Scans all XML files in the backend/archive/ folder, extracts metadata, registers
protocols, and processes them to build the word frequency database from scratch.

Usage:
    # Full rebuild (register + process all)
    uv run python rebuild_database.py --all

    # Register protocols only (no word processing)
    uv run python rebuild_database.py --register-only

    # Process already registered protocols
    uv run python rebuild_database.py --process-only

    # Include speaker checking (WP 19+)
    uv run python rebuild_database.py --all --check-speakers
"""

import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional, Dict, List
import os
import sys
from dotenv import load_dotenv
import argparse
import time
import threading

# Load environment variables
load_dotenv()

# Paths
BACKEND_DIR = Path(__file__).parent
XML_DIR = BACKEND_DIR / "archive"

# Database imports
from database import (
    get_connection, add_protocol,
    get_protocol_count, get_processed_protocol_count
)


def extract_metadata_from_xml(xml_file: Path) -> Optional[Dict]:
    """
    Extract protocol metadata from XML file.

    Returns dict with:
        - id: Protocol ID
        - wahlperiode: Legislature period
        - protokollnummer: Protocol number
        - datum: Date (YYYY-MM-DD)
        - titel: Title
        - pdf_url: PDF URL
    """
    try:
        tree = ET.parse(xml_file)
        root = tree.getroot()

        # Extract basic fields
        protocol_id = root.findtext('id')
        wahlperiode = root.findtext('wahlperiode')
        datum = root.findtext('datum')
        titel = root.findtext('titel', '')

        if not protocol_id or not wahlperiode:
            logging.warning(f"Missing required fields in {xml_file.name}")
            return None

        # Extract PDF URL from fundstelle
        pdf_url = ''
        fundstelle = root.find('fundstelle')
        if fundstelle is not None:
            pdf_url = fundstelle.findtext('pdf_url', '')

        # Extract protocol number from dokumentnummer (e.g., "16/1" -> 1)
        protokollnummer = 0
        dokumentnummer = root.findtext('dokumentnummer', '')
        if '/' in dokumentnummer:
            parts = dokumentnummer.split('/')
            if len(parts) >= 2:
                try:
                    protokollnummer = int(parts[1])
                except ValueError:
                    pass

        # Validate it's a Bundestag protocol
        herausgeber = root.findtext('herausgeber')
        if herausgeber != 'BT':
            logging.debug(f"Skipping non-Bundestag document: {xml_file.name}")
            return None

        return {
            'id': protocol_id,
            'wahlperiode': int(wahlperiode),
            'protokollnummer': protokollnummer,
            'datum': datum,
            'titel': titel,
            'pdf_url': pdf_url,
            'xml_file': xml_file
        }

    except Exception as e:
        logging.error(f"Error extracting metadata from {xml_file.name}: {e}")
        return None


def scan_xml_directory(xml_dir: Path) -> List[Dict]:
    """
    Scan XML directory and extract metadata from all files.

    Returns list of metadata dicts sorted by date.
    """
    logging.info(f"Scanning {xml_dir} for XML files...")

    xml_files = sorted(xml_dir.glob('*.xml'))
    total_files = len(xml_files)

    logging.info(f"Found {total_files} XML files")

    protocols = []
    errors = 0

    for i, xml_file in enumerate(xml_files, 1):
        if i % 100 == 0:
            logging.info(f"Scanning... {i}/{total_files} ({i/total_files*100:.1f}%)")

        metadata = extract_metadata_from_xml(xml_file)
        if metadata:
            protocols.append(metadata)
        else:
            errors += 1

    logging.info(f"Successfully extracted metadata from {len(protocols)} protocols")
    if errors > 0:
        logging.warning(f"Failed to extract metadata from {errors} files")

    # Sort by date (earliest first)
    protocols.sort(key=lambda p: (p['datum'] or '9999-99-99', p['id']))

    return protocols


def register_protocols(protocols: List[Dict]) -> Dict:
    """
    Register protocols in the database.

    Returns dict with statistics:
        - registered: Number of newly registered protocols
        - skipped: Number already in database
        - errors: Number of errors
    """
    logging.info(f"Registering {len(protocols)} protocols in database...")

    conn = get_connection()
    cursor = conn.cursor()

    stats = {
        'registered': 0,
        'skipped': 0,
        'errors': 0
    }

    for i, metadata in enumerate(protocols, 1):
        if i % 100 == 0:
            logging.info(f"Registering... {i}/{len(protocols)} ({i/len(protocols)*100:.1f}%)")

        try:
            # Check if already exists
            cursor.execute(
                "SELECT id FROM protocols WHERE id = %s",
                (metadata['id'],)
            )

            if cursor.fetchone():
                stats['skipped'] += 1
                continue

            # Insert protocol
            success = add_protocol(
                protocol_id=metadata['id'],
                wahlperiode=metadata['wahlperiode'],
                protokollnummer=metadata['protokollnummer'],
                datum=metadata.get('datum'),
                titel=metadata.get('titel', ''),
                pdf_url=metadata.get('pdf_url', '')
            )

            if success:
                stats['registered'] += 1
            else:
                stats['errors'] += 1

        except Exception as e:
            logging.error(f"Error registering protocol {metadata['id']}: {e}")
            stats['errors'] += 1

    cursor.close()
    conn.close()

    logging.info(f"Registration complete: {stats['registered']} new, {stats['skipped']} skipped, {stats['errors']} errors")

    return stats


def process_all_protocols(
    batch_size: int = 0,
    max_workers: Optional[int] = None,
    check_speakers: bool = False
) -> Dict:
    """
    Process all unprocessed protocols using parallel processor.

    Args:
        batch_size: Number to process (0 = all)
        max_workers: Number of parallel workers
        check_speakers: Whether to check speakers after processing

    Returns:
        Processing statistics from parallel processor
    """
    from process_protocols_parallel_pg import process_protocols_parallel

    logging.info("Starting protocol processing...")

    stats = process_protocols_parallel(
        max_workers=max_workers,
        batch_size=batch_size
    )

    # Check speakers if requested
    if check_speakers and stats['processed'] > 0:
        logging.info("Processing complete. Starting speaker check...")

        from speaker_check_module import check_speakers_for_batch
        speaker_stats = check_speakers_for_batch()

        if speaker_stats['found'] > 0:
            logging.info(f"Found speakers for {speaker_stats['found']} words")

    return stats


def start_status_reporter(start_time: float, stop_event: threading.Event, interval_seconds: int = 600):
    """
    Background thread that prints processing progress every `interval_seconds`.
    Runs until stop_event is set.
    """
    import psycopg2
    from database_postgresql_impl import DB_CONFIG

    def _query():
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM protocols")
        total = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM protocols WHERE processed = TRUE")
        processed = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM words")
        words = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        return total, processed, words

    def _print_status(total, processed, words, done_at_start):
        elapsed = time.time() - start_time
        pct = processed / total * 100 if total else 0
        this_run = processed - done_at_start
        rate = this_run / elapsed if elapsed > 0 and this_run > 0 else 0
        remaining = total - processed
        eta_str = f"{remaining / rate / 60:.0f} min" if rate > 0 else "unknown"
        print(
            f"\n{'='*60}\n"
            f"  STATUS  {time.strftime('%H:%M:%S')}\n"
            f"  Elapsed:   {elapsed/60:.1f} min\n"
            f"  Progress:  {processed}/{total} ({pct:.1f}%)\n"
            f"  This run:  +{this_run} protocols\n"
            f"  Rate:      {rate:.2f} protocols/s\n"
            f"  Words:     {words:,}\n"
            f"  ETA:       {eta_str}\n"
            f"{'='*60}",
            flush=True
        )

    def _report():
        try:
            total, processed, words = _query()
            done_at_start = processed
            _print_status(total, processed, words, done_at_start)
        except Exception as e:
            print(f"[STATUS] Could not query initial status: {e}", flush=True)
            done_at_start = 0

        while not stop_event.wait(timeout=interval_seconds):
            try:
                total, processed, words = _query()
                _print_status(total, processed, words, done_at_start)
            except Exception as e:
                print(f"[STATUS] Could not query status: {e}", flush=True)

    t = threading.Thread(target=_report, daemon=True, name="status-reporter")
    t.start()
    return t


def rebuild_database(
    register_only: bool = False,
    process_only: bool = False,
    batch_size: int = 0,
    max_workers: Optional[int] = None,
    check_speakers: bool = False
) -> Dict:
    """
    Complete database rebuild process.

    Args:
        register_only: Only register protocols, don't process
        process_only: Only process already registered protocols
        batch_size: Number of protocols to process (0 = all)
        max_workers: Number of parallel workers for processing
        check_speakers: Whether to check speakers (WP 19+)

    Returns:
        Dict with complete statistics
    """
    start_time = time.time()

    overall_stats = {
        'scan': None,
        'register': None,
        'process': None,
        'total_time': 0
    }

    # Step 1: Scan and register protocols (unless process-only)
    if not process_only:
        logging.info("=" * 70)
        logging.info("STEP 1: SCANNING XML FILES")
        logging.info("=" * 70)

        protocols = scan_xml_directory(XML_DIR)
        overall_stats['scan'] = {
            'total_files': len(protocols)
        }

        logging.info("")
        logging.info("=" * 70)
        logging.info("STEP 2: REGISTERING PROTOCOLS")
        logging.info("=" * 70)

        register_stats = register_protocols(protocols)
        overall_stats['register'] = register_stats

    # Step 2: Process protocols (unless register-only)
    if not register_only:
        logging.info("")
        logging.info("=" * 70)
        logging.info("STEP 3: PROCESSING PROTOCOLS")
        logging.info("=" * 70)

        process_stats = process_all_protocols(
            batch_size=batch_size,
            max_workers=max_workers,
            check_speakers=check_speakers
        )
        overall_stats['process'] = process_stats

    # Final summary
    overall_stats['total_time'] = time.time() - start_time

    print()
    print("=" * 70)
    print("DATABASE REBUILD COMPLETE")
    print("=" * 70)

    if overall_stats['scan']:
        print(f"XML files found: {overall_stats['scan']['total_files']}")

    if overall_stats['register']:
        reg = overall_stats['register']
        print(f"Protocols registered: {reg['registered']} new, {reg['skipped']} existing")

    if overall_stats['process']:
        proc = overall_stats['process']
        print(f"Protocols processed: {proc['processed']}/{proc['total']}")
        print(f"Processing failed: {proc['failed']}")
        print(f"Total words extracted: {proc.get('total_words', 0):,}")

    # Current database state
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM protocols")
    total_protocols = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM protocols WHERE processed = TRUE")
    processed_protocols = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM words")
    total_words = cursor.fetchone()[0]
    cursor.close()
    conn.close()

    print()
    print("Current database state:")
    print(f"  Total protocols: {total_protocols}")
    print(f"  Processed protocols: {processed_protocols}")
    print(f"  Unprocessed protocols: {total_protocols - processed_protocols}")
    print(f"  Unique words: {total_words:,}")
    print()
    print(f"Total time: {overall_stats['total_time']/60:.1f} minutes")
    print("=" * 70)

    return overall_stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Rebuild Bundestag word frequency database from XML files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full rebuild (register + process all)
  uv run python rebuild_database.py --all

  # Register all protocols (no processing)
  uv run python rebuild_database.py --register-only

  # Process already registered protocols
  uv run python rebuild_database.py --process-only

  # Process in batches
  uv run python rebuild_database.py --batch 100

  # Include speaker checking
  uv run python rebuild_database.py --all --check-speakers

  # Custom worker count
  uv run python rebuild_database.py --all --workers 4
        """
    )

    parser.add_argument(
        '--all',
        action='store_true',
        help='Complete rebuild (register + process all protocols)'
    )
    parser.add_argument(
        '--register-only',
        action='store_true',
        help='Only register protocols in database (no word processing)'
    )
    parser.add_argument(
        '--process-only',
        action='store_true',
        help='Only process already registered protocols'
    )
    parser.add_argument(
        '--batch',
        type=int,
        default=0,
        help='Number of protocols to process (0 = all, default: 0)'
    )
    parser.add_argument(
        '--workers',
        type=int,
        default=None,
        help='Number of parallel workers (default: CPU count, max 8)'
    )
    parser.add_argument(
        '--check-speakers',
        action='store_true',
        help='Check OPTV for speakers after processing (WP 19+ only)'
    )

    args = parser.parse_args()

    # Validate arguments
    if sum([args.all, args.register_only, args.process_only]) == 0:
        parser.error("Must specify one of: --all, --register-only, or --process-only")

    if sum([args.all, args.register_only, args.process_only]) > 1:
        parser.error("Cannot combine --all, --register-only, and --process-only")

    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

    # Check archive directory exists
    if not XML_DIR.exists():
        logging.error(f"Archive directory not found: {XML_DIR}")
        sys.exit(1)

    # Start periodic status reporter (every 10 minutes)
    _stop_reporter = threading.Event()
    _rebuild_start = time.time()
    start_status_reporter(_rebuild_start, _stop_reporter, interval_seconds=600)

    # Run rebuild
    try:
        stats = rebuild_database(
            register_only=args.register_only,
            process_only=args.process_only,
            batch_size=args.batch,
            max_workers=args.workers,
            check_speakers=args.check_speakers
        )

        # Check for failures in process stats (if processing was done)
        if stats and stats.get('process'):
            sys.exit(0 if stats['process'].get('failed', 0) == 0 else 1)
        else:
            sys.exit(0)

    except KeyboardInterrupt:
        logging.warning("Interrupted by user")
        sys.exit(130)
    except Exception as e:
        logging.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        _stop_reporter.set()
