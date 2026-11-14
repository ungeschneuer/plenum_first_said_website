"""
Database reset script for PostgreSQL.
Clears word data to allow reprocessing. Keeps protocol metadata.
"""

import logging
import os
import sys
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

DB_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': int(os.getenv('POSTGRES_PORT', 5432)),
    'database': os.getenv('POSTGRES_DB', 'bundestag'),
    'user': os.getenv('POSTGRES_USER', 'bundestag_user'),
    'password': os.getenv('POSTGRES_PASSWORD', ''),
}


def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)


def get_database_stats(conn):
    """Gets current database statistics."""
    cursor = conn.cursor()
    stats = {}

    cursor.execute("SELECT COUNT(*) FROM protocols")
    stats['total_protocols'] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM protocols WHERE processed = TRUE")
    stats['processed_protocols'] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM words")
    stats['total_words'] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM word_occurrences")
    stats['total_occurrences'] = cursor.fetchone()[0]

    cursor.close()
    return stats


def reset_word_data(conn):
    """
    Deletes all word and occurrence data.
    Keeps protocol metadata but resets processed flag.
    """
    cursor = conn.cursor()

    logging.info("Deleting old word data...")

    cursor.execute("DELETE FROM word_occurrences")
    deleted_occurrences = cursor.rowcount
    logging.info(f"  Deleted {deleted_occurrences} word occurrences")

    cursor.execute("DELETE FROM words")
    deleted_words = cursor.rowcount
    logging.info(f"  Deleted {deleted_words} words")

    cursor.execute("UPDATE protocols SET processed = FALSE, total_words = NULL")
    reset_protocols = cursor.rowcount
    logging.info(f"  Reset {reset_protocols} protocols to unprocessed")

    conn.commit()
    cursor.close()

    return {
        'deleted_occurrences': deleted_occurrences,
        'deleted_words': deleted_words,
        'reset_protocols': reset_protocols
    }


def delete_all_data(conn):
    """
    Deletes ALL data including protocols.
    Use this for a complete fresh start.
    """
    cursor = conn.cursor()

    logging.info("Deleting ALL database data...")

    cursor.execute("DELETE FROM word_occurrences")
    deleted_occurrences = cursor.rowcount
    logging.info(f"  Deleted {deleted_occurrences} word occurrences")

    cursor.execute("DELETE FROM words")
    deleted_words = cursor.rowcount
    logging.info(f"  Deleted {deleted_words} words")

    cursor.execute("DELETE FROM protocols")
    deleted_protocols = cursor.rowcount
    logging.info(f"  Deleted {deleted_protocols} protocols")

    conn.commit()
    cursor.close()

    return {
        'deleted_occurrences': deleted_occurrences,
        'deleted_words': deleted_words,
        'deleted_protocols': deleted_protocols
    }


def main():
    print("=" * 70)
    print("DATABASE RESET TOOL (PostgreSQL)")
    print("=" * 70)
    print()

    # Test connection
    try:
        conn = get_db_connection()
    except Exception as e:
        logging.error(f"Cannot connect to PostgreSQL: {e}")
        sys.exit(1)

    # Show current stats
    print("Current database status:")
    stats_before = get_database_stats(conn)
    print(f"  Protocols: {stats_before['total_protocols']} total, {stats_before['processed_protocols']} processed")
    print(f"  Words: {stats_before['total_words']}")
    print(f"  Word occurrences: {stats_before['total_occurrences']}")
    print()

    print("What do you want to delete?")
    print("  1) Only word data (keeps protocol metadata)")
    print("  2) Everything (complete fresh start)")
    print("  3) Cancel")
    print()

    choice = input("Enter choice (1-3): ").strip()

    if choice == "3":
        print("Cancelled.")
        conn.close()
        return

    if choice == "1":
        print()
        print("Resetting word data (keeping protocols)...")
        result = reset_word_data(conn)
        print()
        print("Reset complete!")
        print(f"  Deleted {result['deleted_words']} words")
        print(f"  Deleted {result['deleted_occurrences']} occurrences")
        print(f"  Reset {result['reset_protocols']} protocols")

    elif choice == "2":
        print()
        print("WARNING: This will delete EVERYTHING including protocol metadata!")
        confirm = input("Type 'DELETE ALL' to confirm: ").strip()

        if confirm == "DELETE ALL":
            result = delete_all_data(conn)
            print()
            print("Complete reset done!")
            print(f"  Deleted {result['deleted_protocols']} protocols")
            print(f"  Deleted {result['deleted_words']} words")
            print(f"  Deleted {result['deleted_occurrences']} occurrences")
        else:
            print("Confirmation failed. Cancelled.")
            conn.close()
            return
    else:
        print("Invalid choice. Cancelled.")
        conn.close()
        return

    # Show new stats
    print()
    print("New database status:")
    stats_after = get_database_stats(conn)
    print(f"  Protocols: {stats_after['total_protocols']} total, {stats_after['processed_protocols']} processed")
    print(f"  Words: {stats_after['total_words']}")
    print(f"  Word occurrences: {stats_after['total_occurrences']}")

    conn.close()

    print()
    print("=" * 70)
    print("Next steps:")
    print("  uv run python backend/process_protocols_parallel_pg.py --batch 0")
    print("=" * 70)


if __name__ == "__main__":
    main()
