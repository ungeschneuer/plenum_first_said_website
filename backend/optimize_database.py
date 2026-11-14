"""
Database optimization script.

Adds indexes and materialized views for performance improvement.
Run this after initial data load or when performance degrades.
"""

import logging
import psycopg2
from database import get_db_connection

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def create_indexes():
    """Create missing indexes for common queries."""
    conn = get_db_connection()
    cursor = conn.cursor()

    indexes = [
        # Words table indexes
        ("idx_words_first_date", "words", "first_date"),
        ("idx_words_total_count_desc", "words", "total_count DESC"),
        ("idx_words_speaker_date", "words", "first_speaker_id, first_date"),
        ("idx_words_party_count", "words", "party_at_time_id, total_count DESC"),
        ("idx_words_gendered_lemma", "words", "gendered_lemma"),
        ("idx_words_base_lemma", "words", "base_lemma"),

        # Word occurrences indexes
        ("idx_occurrences_word_protocol", "word_occurrences", "word_id, protocol_id"),
        ("idx_occurrences_protocol", "word_occurrences", "protocol_id"),

        # Protocols indexes
        ("idx_protocols_date", "protocols", "datum"),
        ("idx_protocols_wp_processed", "protocols", "wahlperiode, processed"),
        ("idx_protocols_wp_datum", "protocols", "wahlperiode, datum"),

        # Speakers indexes
        ("idx_speakers_party", "speakers", "party_id"),
        ("idx_speakers_name", "speakers", "name"),

        # Parties indexes
        ("idx_parties_name", "parties", "name"),
    ]

    logger.info("Creating database indexes...")
    created = 0
    skipped = 0

    for index_name, table, columns in indexes:
        try:
            cursor.execute(f"""
                CREATE INDEX IF NOT EXISTS {index_name}
                ON {table}({columns})
            """)
            logger.info(f"  ✓ Created index: {index_name}")
            created += 1
        except psycopg2.Error as e:
            logger.warning(f"  ⊘ Index {index_name} exists or error: {e}")
            skipped += 1

    conn.commit()
    logger.info(f"Indexes: {created} created, {skipped} skipped")


def create_materialized_views():
    """Create materialized views for expensive aggregations."""
    conn = get_db_connection()
    cursor = conn.cursor()

    logger.info("Creating materialized views...")

    # View 1: Word statistics with aggregations
    try:
        cursor.execute("""
            CREATE MATERIALIZED VIEW IF NOT EXISTS word_stats AS
            SELECT
                w.word_id,
                w.word,
                w.first_date,
                w.total_count,
                COUNT(DISTINCT wo.protocol_id) AS protocols_used,
                COUNT(DISTINCT DATE_TRUNC('month', p.datum)) AS months_active,
                MIN(p.datum) AS first_usage_date,
                MAX(p.datum) AS last_usage_date
            FROM words w
            LEFT JOIN word_occurrences wo ON w.word_id = wo.word_id
            LEFT JOIN protocols p ON wo.protocol_id = p.id
            GROUP BY w.word_id, w.word, w.first_date, w.total_count
        """)
        logger.info("  ✓ Created materialized view: word_stats")

        # Create index on materialized view
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_word_stats_word_id
            ON word_stats(word_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_word_stats_total_count
            ON word_stats(total_count DESC)
        """)
        logger.info("  ✓ Created indexes on word_stats")

    except psycopg2.Error as e:
        logger.warning(f"  ⊘ word_stats view error: {e}")

    # View 2: Wahlperiode statistics
    try:
        cursor.execute("""
            CREATE MATERIALIZED VIEW IF NOT EXISTS wahlperiode_stats AS
            SELECT
                p.wahlperiode,
                COUNT(*) AS total_protocols,
                COUNT(*) FILTER (WHERE p.processed) AS processed_protocols,
                COUNT(DISTINCT w.word_id) AS unique_words,
                SUM(p.total_words) AS total_word_count,
                MIN(p.datum) AS start_date,
                MAX(p.datum) AS end_date
            FROM protocols p
            LEFT JOIN word_occurrences wo ON p.id = wo.protocol_id
            LEFT JOIN words w ON wo.word_id = w.word_id
            GROUP BY p.wahlperiode
        """)
        logger.info("  ✓ Created materialized view: wahlperiode_stats")

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_wahlperiode_stats_wp
            ON wahlperiode_stats(wahlperiode)
        """)
        logger.info("  ✓ Created index on wahlperiode_stats")

    except psycopg2.Error as e:
        logger.warning(f"  ⊘ wahlperiode_stats view error: {e}")

    # View 3: Speaker word counts
    try:
        cursor.execute("""
            CREATE MATERIALIZED VIEW IF NOT EXISTS speaker_word_counts AS
            SELECT
                s.speaker_id,
                s.name,
                s.party_id,
                COUNT(DISTINCT w.word_id) AS word_count,
                SUM(w.total_count) AS total_word_occurrences
            FROM speakers s
            LEFT JOIN words w ON s.speaker_id = w.first_speaker_id
            GROUP BY s.speaker_id, s.name, s.party_id
        """)
        logger.info("  ✓ Created materialized view: speaker_word_counts")

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_speaker_word_counts_speaker
            ON speaker_word_counts(speaker_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_speaker_word_counts_count
            ON speaker_word_counts(word_count DESC)
        """)
        logger.info("  ✓ Created indexes on speaker_word_counts")

    except psycopg2.Error as e:
        logger.warning(f"  ⊘ speaker_word_counts view error: {e}")

    conn.commit()
    logger.info("Materialized views created successfully")


def refresh_materialized_views():
    """Refresh all materialized views with latest data."""
    conn = get_db_connection()
    cursor = conn.cursor()

    views = ['word_stats', 'wahlperiode_stats', 'speaker_word_counts']

    logger.info("Refreshing materialized views...")

    for view in views:
        try:
            cursor.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view}")
            logger.info(f"  ✓ Refreshed: {view}")
        except psycopg2.Error as e:
            logger.warning(f"  ⊘ Could not refresh {view}: {e}")
            # Try without CONCURRENTLY
            try:
                cursor.execute(f"REFRESH MATERIALIZED VIEW {view}")
                logger.info(f"  ✓ Refreshed: {view} (non-concurrent)")
            except psycopg2.Error as e2:
                logger.error(f"  ✗ Failed to refresh {view}: {e2}")

    conn.commit()
    logger.info("Materialized views refreshed")


def analyze_tables():
    """Run ANALYZE to update statistics for query planner."""
    conn = get_db_connection()
    cursor = conn.cursor()

    tables = ['words', 'word_occurrences', 'protocols', 'speakers', 'parties']

    logger.info("Analyzing tables...")

    for table in tables:
        try:
            cursor.execute(f"ANALYZE {table}")
            logger.info(f"  ✓ Analyzed: {table}")
        except psycopg2.Error as e:
            logger.error(f"  ✗ Failed to analyze {table}: {e}")

    conn.commit()
    logger.info("Table analysis complete")


def vacuum_tables():
    """Run VACUUM to reclaim storage and update statistics."""
    conn = get_db_connection()
    # VACUUM requires autocommit
    conn.autocommit = True
    cursor = conn.cursor()

    tables = ['words', 'word_occurrences', 'protocols', 'speakers', 'parties']

    logger.info("Vacuuming tables...")

    for table in tables:
        try:
            logger.info(f"  Vacuuming {table}...")
            cursor.execute(f"VACUUM ANALYZE {table}")
            logger.info(f"  ✓ Vacuumed: {table}")
        except psycopg2.Error as e:
            logger.error(f"  ✗ Failed to vacuum {table}: {e}")

    conn.autocommit = False
    logger.info("Vacuum complete")


def get_table_sizes():
    """Get size information for all tables."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
            pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    """)

    logger.info("\nTable sizes:")
    for row in cursor.fetchall():
        logger.info(f"  {row[1]}: {row[2]}")


def get_index_usage():
    """Get index usage statistics."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            schemaname,
            tablename,
            indexname,
            idx_scan,
            pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
        LIMIT 20
    """)

    logger.info("\nTop 20 most-used indexes:")
    for row in cursor.fetchall():
        logger.info(f"  {row[2]}: {row[3]} scans, {row[4]}")


def main():
    """Run full database optimization."""
    logger.info("=" * 60)
    logger.info("Database Optimization Script")
    logger.info("=" * 60)

    try:
        # Step 1: Create indexes
        create_indexes()
        print()

        # Step 2: Create materialized views
        create_materialized_views()
        print()

        # Step 3: Refresh materialized views
        refresh_materialized_views()
        print()

        # Step 4: Analyze tables
        analyze_tables()
        print()

        # Step 5: Get statistics
        get_table_sizes()
        print()
        get_index_usage()

        logger.info("\n" + "=" * 60)
        logger.info("Optimization complete!")
        logger.info("=" * 60)
        logger.info("\nNext steps:")
        logger.info("  1. Test API performance")
        logger.info("  2. Monitor slow queries with: EXPLAIN ANALYZE <query>")
        logger.info("  3. Refresh materialized views weekly: python backend/optimize_database.py --refresh")
        logger.info("  4. Run VACUUM monthly: python backend/optimize_database.py --vacuum")

    except Exception as e:
        logger.error(f"\nOptimization failed: {e}", exc_info=True)
        return 1

    return 0


if __name__ == "__main__":
    import sys

    # Handle command-line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "--refresh":
            refresh_materialized_views()
        elif sys.argv[1] == "--vacuum":
            vacuum_tables()
        elif sys.argv[1] == "--analyze":
            analyze_tables()
        elif sys.argv[1] == "--stats":
            get_table_sizes()
            print()
            get_index_usage()
        else:
            print("Usage: python optimize_database.py [--refresh|--vacuum|--analyze|--stats]")
            print()
            print("Options:")
            print("  (none)     Run full optimization (indexes + views + analyze)")
            print("  --refresh  Refresh materialized views only")
            print("  --vacuum   Vacuum tables only")
            print("  --analyze  Analyze tables only")
            print("  --stats    Show table sizes and index usage")
            sys.exit(1)
    else:
        sys.exit(main())
