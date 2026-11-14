"""Add composite indexes for common queries."""
import sqlite3
import logging
from database import DB_PATH

logging.basicConfig(level=logging.INFO)

def add_indexes():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("=" * 80)
    print("Adding Composite Indexes")
    print("=" * 80)

    indexes = [
        # Timeline queries (word + date) - speeds up ORDER BY date
        ("idx_word_occurrences_word_date", "word_occurrences(word_id, date)"),

        # Protocol queries (processed + date) - speeds up filtering
        ("idx_protocols_processed_date", "protocols(processed, datum)"),

        # Speaker + protocol lookups - speeds up word details
        ("idx_words_speaker_protocol", "words(first_speaker_id, first_protocol_id)"),

        # Wahlperiode + protocol number - common filter combination
        ("idx_protocols_wp_num", "protocols(wahlperiode, protokollnummer)"),

        # Protocol + count for fast occurrence lookups
        ("idx_word_occurrences_protocol_count", "word_occurrences(protocol_id, count)"),
    ]

    created_count = 0
    skipped_count = 0

    for idx_name, idx_columns in indexes:
        # Check if index already exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='index' AND name=?
        """, (idx_name,))

        if cursor.fetchone():
            print(f"✓ {idx_name} (already exists)")
            skipped_count += 1
            continue

        # Create index
        print(f"+ Creating {idx_name}...")
        cursor.execute(f"CREATE INDEX {idx_name} ON {idx_columns}")
        created_count += 1

    conn.commit()

    # Run ANALYZE to update query planner statistics
    print("\n" + "=" * 80)
    print("Running ANALYZE to update query planner...")
    cursor.execute("ANALYZE")
    conn.commit()

    conn.close()

    print("=" * 80)
    print("Index Creation Complete!")
    print("=" * 80)
    print(f"Created: {created_count} new indexes")
    print(f"Skipped: {skipped_count} existing indexes")
    print("\nQuery performance should now be improved!")

if __name__ == "__main__":
    add_indexes()
