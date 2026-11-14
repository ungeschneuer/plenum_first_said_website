"""
Cross-Wahlperiode speaker continuity check.

Samples words from WP 19, 20, 21, runs OPTV speaker lookup for each,
then reports which speakers appear across multiple Wahlperioden and whether
their party affiliation is consistent (party_at_time vs current party).
"""

import logging
import os
import sys
import time
from collections import defaultdict

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')

DB_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': int(os.getenv('POSTGRES_PORT', 5432)),
    'database': os.getenv('POSTGRES_DB', 'bundestag'),
    'user': os.getenv('POSTGRES_USER', 'bundestag_user'),
    'password': os.getenv('POSTGRES_PASSWORD', ''),
}

TARGET_WPS = [19, 20, 21]
WORDS_PER_WP = 30
DELAY = 0.8  # seconds between OPTV calls


def get_db():
    return psycopg2.connect(**DB_CONFIG)


def get_sample_words(wp: int, n: int) -> list:
    """Fetch n unchecked words from a specific Wahlperiode."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT w.word, w.word_id, p.datum::text as datum,
               p.wahlperiode, p.protokollnummer, p.id as protocol_id
        FROM words w
        JOIN protocols p ON w.first_protocol_id = p.id
        WHERE p.wahlperiode = %s
          AND (w.speaker_checked IS NULL OR w.speaker_checked = FALSE)
        ORDER BY p.datum DESC, w.word
        LIMIT %s
    """, (wp, n))
    results = [dict(r) for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    return results


def report_continuity():
    """Print speaker × Wahlperiode × party matrix for all checked words."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT
            s.name              AS speaker,
            s.bundestag_id,
            p.wahlperiode       AS wp,
            pa_time.name        AS party_at_time,
            pa_now.name         AS party_now,
            COUNT(w.word_id)    AS words_in_wp,
            CASE WHEN pa_time.party_id <> pa_now.party_id
                 THEN 'PARTY CHANGED' ELSE '' END AS note
        FROM words w
        JOIN protocols p      ON w.first_protocol_id = p.id
        JOIN speakers s       ON w.first_speaker_id  = s.speaker_id
        LEFT JOIN parties pa_time ON w.party_at_time_id = pa_time.party_id
        LEFT JOIN parties pa_now  ON s.party_id         = pa_now.party_id
        WHERE w.first_speaker_id IS NOT NULL
        GROUP BY s.name, s.bundestag_id, p.wahlperiode,
                 pa_time.party_id, pa_time.name,
                 pa_now.party_id,  pa_now.name
        ORDER BY s.name, p.wahlperiode
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    by_speaker = defaultdict(list)
    for row in rows:
        by_speaker[row['speaker']].append(row)

    multi_wp = {s: r for s, r in by_speaker.items() if len(r) > 1}
    single_wp = {s: r for s, r in by_speaker.items() if len(r) == 1}

    print()
    print("=" * 72)
    print("CONTINUITY REPORT — Speaker × Wahlperiode × Party")
    print("=" * 72)

    if multi_wp:
        print(f"\nSpeakers spanning multiple Wahlperioden ({len(multi_wp)}):\n")
        for speaker, speaker_rows in sorted(multi_wp.items()):
            bt_id = speaker_rows[0]['bundestag_id'] or '-'
            print(f"  {speaker}  [BT-ID: {bt_id}]")
            for row in speaker_rows:
                note = f"  <-- {row['note']}" if row['note'] else ""
                print(
                    f"    WP {row['wp']:2d}  "
                    f"party at time: {str(row['party_at_time']):20s}  "
                    f"party now: {str(row['party_now']):20s}  "
                    f"({row['words_in_wp']} word{'s' if row['words_in_wp'] > 1 else ''})"
                    f"{note}"
                )
            print()
    else:
        print("\nNo speakers found across multiple Wahlperioden yet.")

    print(f"Speakers in single WP only : {len(single_wp)}")
    print(f"Speakers across multiple WPs: {len(multi_wp)}")
    print("=" * 72)


def run():
    from database import (
        get_or_create_party,
        get_or_create_speaker,
        mark_word_speaker_checked,
        update_word_speaker,
    )
    from optv_api import get_speaker_info

    # Collect stratified sample across WPs
    all_words = []
    for wp in TARGET_WPS:
        words = get_sample_words(wp, WORDS_PER_WP)
        logging.info(f"WP {wp}: {len(words)} words queued")
        all_words.extend(words)

    if not all_words:
        logging.info("No unchecked words found for WP 19/20/21.")
        report_continuity()
        return

    total = len(all_words)
    logging.info(f"Checking {total} words across WPs {TARGET_WPS}")
    print()

    found = 0
    for i, wd in enumerate(all_words, 1):
        word = wd['word']
        date = wd['datum']
        wp = wd['wahlperiode']

        logging.info(f"[{i}/{total}] WP{wp} '{word}' ({date})")

        try:
            info = get_speaker_info(word, date, wp)
            if info:
                speaker_id = get_or_create_speaker(
                    speaker_name=info['speaker'],
                    party_name=info['party'],
                    optv_link=info['link'],
                )
                party_at_time_id = get_or_create_party(info['party'])
                update_word_speaker(word, speaker_id, info['link'], party_at_time_id)
                logging.info(f"  -> {info['speaker']} ({info['party']})")
                found += 1
            else:
                mark_word_speaker_checked(word)
                logging.info("  -> not found in OPTV")
        except Exception as e:
            logging.error(f"  ERROR: {e}")

        if i < total:
            time.sleep(DELAY)

    print()
    logging.info(f"Batch done: {found}/{total} speakers found")

    report_continuity()


if __name__ == "__main__":
    run()
