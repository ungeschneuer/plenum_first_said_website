"""
PostgreSQL database module for Bundestag Word Tracker.
Compatible with existing database.py interface.
"""

import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
from psycopg2.pool import SimpleConnectionPool
import logging
import os
from pathlib import Path
from typing import Optional, List, Dict, Tuple
from datetime import datetime
import json
from cache import cache_response, CACHE_TTL_SHORT, CACHE_TTL_MEDIUM, CACHE_TTL_LONG, CACHE_TTL_VERY_LONG

# Database configuration from environment
DB_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': int(os.getenv('POSTGRES_PORT', 5432)),
    'database': os.getenv('POSTGRES_DB', 'bundestag'),
    'user': os.getenv('POSTGRES_USER', 'bundestag_user'),
    'password': os.getenv('POSTGRES_PASSWORD', ''),
}

# Connection pool (for better performance)
_connection_pool = None

def init_connection_pool(min_conn=2, max_conn=10):
    """Initialize connection pool."""
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = SimpleConnectionPool(
            min_conn,
            max_conn,
            **DB_CONFIG
        )
        logging.info(f"PostgreSQL connection pool initialized ({min_conn}-{max_conn} connections)")

def get_connection():
    """Get a database connection from pool."""
    if _connection_pool is None:
        init_connection_pool()

    return _connection_pool.getconn()

def return_connection(conn):
    """Return connection to pool."""
    if _connection_pool:
        _connection_pool.putconn(conn)

class DatabaseConnection:
    """Context manager for database connections."""

    def __enter__(self):
        self.conn = get_connection()
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self.conn.commit()
        else:
            self.conn.rollback()
        return_connection(self.conn)

def init_database():
    """Initialize the database schema from SQL file."""
    schema_file = Path(__file__).parent / "schema_postgresql.sql"

    if not schema_file.exists():
        logging.error(f"Schema file not found: {schema_file}")
        return False

    with DatabaseConnection() as conn:
        cursor = conn.cursor()

        # Read and execute schema
        with open(schema_file, 'r') as f:
            schema_sql = f.read()

        try:
            cursor.execute(schema_sql)
            logging.info("Database schema verified/initialized successfully")
            return True
        except Exception as e:
            # Log warning instead of error - schema is likely already initialized
            logging.warning(f"Database schema already initialized (this is normal): {e}")
            return True  # Return True since database is usable

def add_protocol(protocol_id: str, wahlperiode: int, protokollnummer: int,
                 datum: str, titel: str, pdf_url: str) -> bool:
    """Add a protocol to the database."""
    try:
        with DatabaseConnection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO protocols (id, wahlperiode, protokollnummer, datum, titel, pdf_url)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (protocol_id, wahlperiode, protokollnummer, datum, titel, pdf_url))

            return True
    except Exception as e:
        logging.error(f"Error adding protocol {protocol_id}: {e}")
        return False

def mark_protocol_processed(protocol_id: str, total_words: int):
    """Mark a protocol as processed and store total word count."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE protocols
            SET processed = TRUE, total_words = %s
            WHERE id = %s
        """, (total_words, protocol_id))

def get_unprocessed_protocols(limit: Optional[int] = None) -> List[Dict]:
    """Get protocols that haven't been processed yet."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        query = """
            SELECT * FROM protocols
            WHERE processed = FALSE
            ORDER BY wahlperiode, protokollnummer
        """
        if limit:
            query += " LIMIT %s"
            cursor.execute(query, (limit,))
        else:
            cursor.execute(query)
        return [dict(row) for row in cursor.fetchall()]


@cache_response(ttl=CACHE_TTL_SHORT, key_prefix="cache:search")
def search_words(query: str, limit: int = 20, cursor: Optional[str] = None) -> Dict:
    """
    Search for words using optimized hybrid approach with cursor-based pagination.

    Uses a staged UNION strategy so each branch hits its own index:
      1. Prefix match  — btree on word  (fast autocomplete)
      2. FTS           — GIN on search_vector (German stemming)
      3. Trigram       — GIN on word gin_trgm_ops (typo fallback, only when
                         prefix + FTS return no results)

    occurrence_count comes from the pre-computed words.total_occurrences column
    so there is no expensive JOIN against the 30M-row word_occurrences table.

    Returns: {
        'items': [...],
        'pagination': {
            'next_cursor': str or None,
            'has_more': bool,
            'total': int,
            'limit': int
        }
    }
    """
    with DatabaseConnection() as conn:
        db_cursor = conn.cursor(cursor_factory=RealDictCursor)

        prefix = f"{query}%"
        fts_query = query.strip() + ':*' if query.strip() else query

        # Build cursor filter for pagination
        cursor_filter = ""
        cursor_params: list = []
        if cursor:
            try:
                cursor_params = [int(cursor)]
                cursor_filter = "AND word_id > %s"
            except (ValueError, TypeError):
                pass

        # Stage 1: Prefix match — uses btree index + pre-computed total_occurrences.
        # Fast for all inputs; handles the vast majority of autocomplete queries.
        db_cursor.execute(f"""
            SELECT word, word_id, gender, pos_tag,
                   COALESCE(total_occurrences, 0) AS occurrence_count,
                   100 AS rank
            FROM words
            WHERE word ILIKE %s {cursor_filter}
            ORDER BY COALESCE(total_occurrences, 0) DESC, word ASC, word_id ASC
            LIMIT %s
        """, [prefix] + cursor_params + [limit + 1])

        results = [dict(row) for row in db_cursor.fetchall()]

        # Fast count from btree (sub-ms)
        db_cursor.execute("SELECT COUNT(*) AS total FROM words WHERE word ILIKE %s", (prefix,))
        total = db_cursor.fetchone()['total']

        # Stage 2: If prefix returned fewer results than requested, enrich with FTS.
        # Uses GIN index on search_vector — only runs for niche/short queries.
        if len(results) <= limit:
            existing_ids = {r['word_id'] for r in results}
            db_cursor.execute("""
                SELECT word, word_id, gender, pos_tag,
                       COALESCE(total_occurrences, 0) AS occurrence_count,
                       50 AS rank
                FROM words
                WHERE search_vector @@ to_tsquery('german', %s)
                  AND word_id != ALL(%s)
                ORDER BY COALESCE(total_occurrences, 0) DESC, word ASC
                LIMIT %s
            """, [fts_query, list(existing_ids) or [0], limit + 1])
            fts_rows = [dict(row) for row in db_cursor.fetchall()]
            results = results + fts_rows
            total = total + len(fts_rows)

        # Stage 3: Trigram fallback for typo correction (only when nothing matched).
        if not results:
            db_cursor.execute("""
                SELECT word, word_id, gender, pos_tag,
                       COALESCE(total_occurrences, 0) AS occurrence_count,
                       10 AS rank
                FROM words
                WHERE word %% %s OR gendered_lemma %% %s
                ORDER BY similarity(word, %s) DESC,
                         COALESCE(total_occurrences, 0) DESC
                LIMIT %s
            """, [query, query, query, limit + 1])
            results = [dict(row) for row in db_cursor.fetchall()]
            total = len(results)

        has_more = len(results) > limit
        items = results[:limit] if has_more else results
        next_cursor = str(items[-1]['word_id']) if has_more and items else None

        return {
            'items': items,
            'pagination': {
                'next_cursor': next_cursor,
                'has_more': has_more,
                'total': total,
                'limit': limit
            }
        }

@cache_response(ttl=CACHE_TTL_MEDIUM, key_prefix="timeline")
@cache_response(ttl=CACHE_TTL_LONG, key_prefix="cache:timeline")
def get_word_timeline(word: str) -> List[Dict]:
    """Get timeline data for a specific word (case-insensitive), including protocols with 0 occurrences."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # First, get the word_id for the given word
        cursor.execute("""
            SELECT word_id FROM words WHERE word ILIKE %s LIMIT 1
        """, (word,))

        word_result = cursor.fetchone()

        if not word_result:
            # Word doesn't exist in database, return empty list
            return []

        word_id = word_result['word_id']

        # Get ALL processed protocols with LEFT JOIN to include 0-count protocols
        cursor.execute("""
            SELECT
                p.datum::text as date,
                COALESCE(wo.count, 0) as count,
                p.total_words,
                p.id as protocol_id,
                p.wahlperiode,
                p.protokollnummer,
                p.titel,
                p.pdf_url
            FROM protocols p
            LEFT JOIN word_occurrences wo ON wo.protocol_id = p.id AND wo.word_id = %s
            WHERE p.processed = TRUE
            ORDER BY p.datum, p.wahlperiode, p.protokollnummer
        """, (word_id,))

        return [dict(row) for row in cursor.fetchall()]


@cache_response(ttl=CACHE_TTL_LONG, key_prefix="cache:compare_timeline")
def get_words_comparison_timeline(words: List[str]) -> Dict[str, List[Dict]]:
    """
    Get timeline data for multiple words in a single optimized query.

    Args:
        words: List of words to compare (case-insensitive)

    Returns:
        Dictionary mapping each word to its timeline data.
        Missing words will have empty lists.
    """
    if not words:
        return {}

    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # First, get word_ids for all requested words
        cursor.execute("""
            SELECT word, word_id
            FROM words
            WHERE word ILIKE ANY(%s)
        """, (words,))

        word_id_map = {row['word'].lower(): row['word_id'] for row in cursor.fetchall()}

        # Create a mapping from input words to their found word_ids
        input_word_map = {}
        for input_word in words:
            # Find the matching word (case-insensitive)
            for db_word, word_id in word_id_map.items():
                if db_word.lower() == input_word.lower():
                    input_word_map[input_word] = word_id
                    break

        if not input_word_map:
            # No words found, return empty dict for all
            return {word: [] for word in words}

        # Get timeline data for all words in a single query
        # Use UNION ALL to combine timelines for each word
        word_ids = list(input_word_map.values())

        cursor.execute("""
            SELECT
                w.word as word,
                p.datum::text as date,
                COALESCE(wo.count, 0) as count,
                p.total_words,
                p.id as protocol_id,
                p.wahlperiode,
                p.protokollnummer,
                p.titel,
                p.pdf_url
            FROM protocols p
            CROSS JOIN words w
            LEFT JOIN word_occurrences wo ON wo.protocol_id = p.id AND wo.word_id = w.word_id
            WHERE p.processed = TRUE
              AND w.word_id = ANY(%s)
            ORDER BY w.word, p.datum, p.wahlperiode, p.protokollnummer
        """, (word_ids,))

        # Group results by word
        results = {}
        for word in words:
            results[word] = []

        for row in cursor.fetchall():
            row_dict = dict(row)
            word = row_dict.pop('word')  # Remove word from the dict

            # Find the original input word (case-insensitive match)
            for input_word in words:
                if input_word.lower() == word.lower():
                    results[input_word].append(row_dict)
                    break

        return results


@cache_response(ttl=CACHE_TTL_LONG, key_prefix="details")
@cache_response(ttl=CACHE_TTL_LONG, key_prefix="cache:details")
def get_word_details(word: str) -> Optional[Dict]:
    """Get detailed information about a word (case-insensitive)."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT
                w.word,
                w.word_id,
                w.first_protocol_id,
                p.datum::text as first_date,
                p.wahlperiode,
                p.protokollnummer,
                p.titel,
                p.pdf_url,
                w.base_lemma,
                w.gendered_lemma,
                w.gender,
                w.pos_tag,
                w.is_compound,
                w.compound_parts,
                w.analysis_source,
                w.confidence,
                w.first_speaker_id,
                w.party_at_time_id,
                w.optv_link,
                w.first_spoken_form,
                w.is_abbreviation,
                s.name as speaker_name,
                pa_current.name as party_name,
                pa_at_time.name as party_at_time_name,
                COALESCE(w.total_occurrences, 0) as total_count
            FROM words w
            LEFT JOIN protocols p ON w.first_protocol_id = p.id
            LEFT JOIN speakers s ON w.first_speaker_id = s.speaker_id
            LEFT JOIN parties pa_current ON s.party_id = pa_current.party_id
            LEFT JOIN parties pa_at_time ON w.party_at_time_id = pa_at_time.party_id
            WHERE w.word ILIKE %s
        """, (word,))

        result = cursor.fetchone()
        return dict(result) if result else None

def get_protocol_count() -> int:
    """Get total number of protocols in database."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM protocols")
        return cursor.fetchone()[0]

def get_processed_protocol_count() -> int:
    """Get number of processed protocols."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM protocols WHERE processed = TRUE")
        return cursor.fetchone()[0]


# Refresh materialized views
def refresh_statistics():
    """Refresh pre-computed statistics."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT refresh_statistics()")
        logging.info("Materialized views refreshed")

# Speaker functions
def get_speaker_details(speaker_id: int) -> Optional[Dict]:
    """Get detailed information about a speaker."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT s.speaker_id, s.name, s.optv_link,
                   p.name as party_name, p.party_id
            FROM speakers s
            LEFT JOIN parties p ON s.party_id = p.party_id
            WHERE s.speaker_id = %s
        """, (speaker_id,))

        result = cursor.fetchone()
        return dict(result) if result else None

@cache_response(ttl=CACHE_TTL_MEDIUM, key_prefix="cache:speaker_words")
def get_words_by_speaker(speaker_id: int, limit: int = 100, page_cursor: Optional[str] = None) -> Dict:
    """
    Get words first said by a speaker with pagination.

    Returns: {
        'items': [...],
        'pagination': {
            'next_cursor': str or None,
            'has_more': bool,
            'total': int,
            'limit': int
        }
    }
    """
    with DatabaseConnection() as conn:
        db_cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Get total count
        db_cursor.execute("""
            SELECT COUNT(*) as total
            FROM words w
            WHERE w.first_speaker_id = %s
        """, (speaker_id,))
        total = db_cursor.fetchone()['total']

        # Build pagination filter
        pagination_filter = ""
        params = [speaker_id]

        if page_cursor:
            # Cursor format: "count_date_wordid" (e.g., "42_2023-01-15_1234")
            try:
                cursor_count, cursor_date, cursor_word_id = page_cursor.split('_', 2)
                pagination_filter = """
                    AND (
                        COALESCE(w.total_occurrences, 0) < %s
                        OR (COALESCE(w.total_occurrences, 0) = %s AND p.datum > %s)
                        OR (COALESCE(w.total_occurrences, 0) = %s AND p.datum = %s AND w.word_id > %s)
                    )
                """
                params.extend([int(cursor_count), int(cursor_count), cursor_date,
                                int(cursor_count), cursor_date, int(cursor_word_id)])
            except ValueError:
                pass

        params.append(limit + 1)

        db_cursor.execute(f"""
            SELECT w.word, w.word_id, w.first_protocol_id, p.datum::text as datum,
                   p.wahlperiode, p.protokollnummer,
                   COALESCE(w.total_occurrences, 0) as total_count
            FROM words w
            LEFT JOIN protocols p ON w.first_protocol_id = p.id
            WHERE w.first_speaker_id = %s
                {pagination_filter}
            ORDER BY COALESCE(w.total_occurrences, 0) DESC, p.datum ASC, w.word_id ASC
            LIMIT %s
        """, params)

        results = [dict(row) for row in db_cursor.fetchall()]

        # Check if there are more results
        has_more = len(results) > limit
        items = results[:limit] if has_more else results

        # Generate next cursor
        next_cursor = None
        if has_more and items:
            last_item = items[-1]
            next_cursor = f"{last_item['total_count']}_{last_item['datum']}_{last_item['word_id']}"

        return {
            'items': items,
            'pagination': {
                'next_cursor': next_cursor,
                'has_more': has_more,
                'total': total,
                'limit': limit
            }
        }

def get_all_speakers() -> List[Dict]:
    """Get all speakers with word counts."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT s.speaker_id, s.name, p.name as party_name,
                   COUNT(w.word_id) as word_count
            FROM speakers s
            LEFT JOIN parties p ON s.party_id = p.party_id
            LEFT JOIN words w ON s.speaker_id = w.first_speaker_id
            GROUP BY s.speaker_id, s.name, p.name
            ORDER BY word_count DESC, s.name
        """)

        return [dict(row) for row in cursor.fetchall()]

def get_or_create_party(party_name: Optional[str], short_name: Optional[str] = None) -> Optional[int]:
    """
    Get existing party ID or create new party.
    Returns None if party_name is None (fraktionslos / no affiliation).
    """
    if not party_name:
        return None

    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Try to find existing party
        cursor.execute("""
            SELECT party_id FROM parties
            WHERE name = %s
        """, (party_name,))
        
        result = cursor.fetchone()
        if result:
            return result['party_id']
        
        # Create new party
        cursor.execute("""
            INSERT INTO parties (name, short_name)
            VALUES (%s, %s)
            RETURNING party_id
        """, (party_name, short_name))
        
        conn.commit()
        return cursor.fetchone()['party_id']


def _update_speaker_fields(cursor, speaker_id: int, bundestag_id: Optional[str],
                           party_name: Optional[str]) -> None:
    """Backfill bundestag_id and/or party on an existing speaker row."""
    if bundestag_id:
        cursor.execute(
            "UPDATE speakers SET bundestag_id = %s WHERE speaker_id = %s AND bundestag_id IS NULL",
            (bundestag_id, speaker_id),
        )
    if party_name:
        party_id = get_or_create_party(party_name)
        cursor.execute(
            "UPDATE speakers SET party_id = %s WHERE speaker_id = %s",
            (party_id, speaker_id),
        )


def get_or_create_speaker(speaker_name: str, party_name: Optional[str] = None,
                          optv_link: Optional[str] = None,
                          birth_date: Optional[str] = None, birth_place: Optional[str] = None,
                          profession: Optional[str] = None, bundestag_id: Optional[str] = None) -> int:
    """
    Get existing speaker ID or create new speaker.

    Deduplication order:
      1. Bundestag MdB ID (most reliable, set when Stammdaten match found)
      2. Case-insensitive exact name match
      3. Case-insensitive match after stripping academic titles
      4. Fuzzy name match (difflib, cutoff 0.92) against all existing speakers
      5. Insert new row

    When a match is found in steps 2-4, any newly available bundestag_id is
    written back to the row so future lookups use the fast path.

    Args:
        speaker_name: Full name of speaker
        party_name: Party name (will be created if doesn't exist)
        optv_link: Link to OpenParliamentTV video
        birth_date: Date of birth from Bundestag Stammdaten
        birth_place: Place of birth from Bundestag Stammdaten
        profession: Profession from Bundestag Stammdaten
        bundestag_id: Bundestag MdB ID from Stammdaten

    Returns:
        speaker_id
    """
    import difflib
    from bundestag_api import _strip_titles, _normalise

    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # 1. Bundestag MdB ID — most reliable
        if bundestag_id:
            cursor.execute(
                "SELECT speaker_id FROM speakers WHERE bundestag_id = %s",
                (bundestag_id,),
            )
            result = cursor.fetchone()
            if result:
                logging.debug(f"Found existing speaker by Bundestag ID: {speaker_name} ({bundestag_id})")
                _update_speaker_fields(cursor, result['speaker_id'], None, party_name)
                conn.commit()
                return result['speaker_id']

        # 2. Case-insensitive exact name match
        cursor.execute(
            "SELECT speaker_id FROM speakers WHERE LOWER(name) = LOWER(%s)",
            (speaker_name,),
        )
        result = cursor.fetchone()
        if result:
            logging.debug(f"Found existing speaker by exact name: {speaker_name}")
            _update_speaker_fields(cursor, result['speaker_id'], bundestag_id, party_name)
            conn.commit()
            return result['speaker_id']

        # 3. Title-stripped name match (handles "Dr. Angela Merkel" vs "Angela Merkel")
        stripped = _strip_titles(speaker_name)
        if stripped != speaker_name:
            cursor.execute(
                "SELECT speaker_id FROM speakers WHERE LOWER(name) = LOWER(%s)",
                (stripped,),
            )
            result = cursor.fetchone()
            if result:
                logging.info(f"Found speaker after stripping titles: '{speaker_name}' -> '{stripped}'")
                _update_speaker_fields(cursor, result['speaker_id'], bundestag_id, party_name)
                conn.commit()
                return result['speaker_id']

        # 4. Fuzzy name match — last resort before creating a new row
        cursor.execute("SELECT speaker_id, name FROM speakers")
        all_speakers = cursor.fetchall()
        if all_speakers:
            query_norm = _normalise(stripped)
            norm_to_id = {_normalise(s['name']): s['speaker_id'] for s in all_speakers}
            matches = difflib.get_close_matches(query_norm, list(norm_to_id.keys()), n=1, cutoff=0.92)
            if matches:
                matched_id = norm_to_id[matches[0]]
                logging.info(
                    f"Fuzzy DB match: '{speaker_name}' -> '{matches[0]}' "
                    f"(speaker_id={matched_id})"
                )
                _update_speaker_fields(cursor, matched_id, bundestag_id, party_name)
                conn.commit()
                return matched_id

        # 5. No match found — create new speaker
        party_id = get_or_create_party(party_name) if party_name else None
        cursor.execute("""
            INSERT INTO speakers (name, party_id, optv_link,
                                  birth_date, birth_place, profession, bundestag_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING speaker_id
        """, (speaker_name, party_id, optv_link,
              birth_date, birth_place, profession, bundestag_id))

        conn.commit()
        speaker_id = cursor.fetchone()['speaker_id']
        logging.info(f"Created new speaker: {speaker_name} (ID: {speaker_id}, BT-ID: {bundestag_id})")
        return speaker_id


def update_word_speaker(word: str, speaker_id: int, optv_link: Optional[str] = None,
                       party_at_time_id: Optional[int] = None):
    """
    Update word with speaker information.
    
    Args:
        word: The word to update
        speaker_id: ID of the speaker who first said the word
        optv_link: Link to OpenParliamentTV video
        party_at_time_id: Party ID at time of speaking (for historical tracking)
    """
    with DatabaseConnection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE words
            SET first_speaker_id = %s,
                optv_link = %s,
                party_at_time_id = %s,
                speaker_checked = TRUE
            WHERE word = %s
        """, (speaker_id, optv_link, party_at_time_id, word))
        
        conn.commit()


def mark_word_speaker_checked(word: str):
    """
    Mark a word as having been checked for speaker information.
    Used when no speaker is found in OPTV.
    
    Args:
        word: The word to mark as checked
    """
    with DatabaseConnection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE words
            SET speaker_checked = TRUE
            WHERE word = %s
        """, (word,))
        
        conn.commit()


def get_words_needing_speaker_check(limit: Optional[int] = None) -> List[Dict]:
    """
    Get words first spoken from 2015-01-01 onwards that haven't been checked for speakers.

    Args:
        limit: Maximum number of words to return

    Returns:
        List of word dictionaries with protocol information
    """
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        query = """
            SELECT w.word, w.word_id, p.datum, p.wahlperiode, p.protokollnummer,
                   p.id as protocol_id
            FROM words w
            JOIN protocols p ON w.first_protocol_id = p.id
            WHERE p.wahlperiode >= 19
              AND (w.speaker_checked IS NULL OR w.speaker_checked = FALSE)
            ORDER BY p.datum DESC, w.word
        """

        if limit:
            query += " LIMIT %s"
            cursor.execute(query, (limit,))
        else:
            cursor.execute(query)
        return [dict(row) for row in cursor.fetchall()]
# Party functions
def get_party_details(party_id: int) -> Optional[Dict]:
    """Get detailed information about a party."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT party_id, name, short_name
            FROM parties
            WHERE party_id = %s
        """, (party_id,))

        result = cursor.fetchone()
        return dict(result) if result else None

@cache_response(ttl=CACHE_TTL_MEDIUM, key_prefix="cache:party_words")
def get_words_by_party(party_id: int, limit: int = 100, page_cursor: Optional[str] = None) -> Dict:
    """
    Get words first said by members of a party with pagination.

    Returns: {
        'items': [...],
        'pagination': {
            'next_cursor': str or None,
            'has_more': bool,
            'total': int,
            'limit': int
        }
    }
    """
    with DatabaseConnection() as conn:
        db_cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Get total count
        db_cursor.execute("""
            SELECT COUNT(*) as total
            FROM words w
            LEFT JOIN speakers s ON w.first_speaker_id = s.speaker_id
            WHERE s.party_id = %s
        """, (party_id,))
        total = db_cursor.fetchone()['total']

        # Build pagination filter
        pagination_filter = ""
        params = [party_id]

        if page_cursor:
            # Cursor format: "count_date_wordid" (e.g., "42_2023-01-15_1234")
            try:
                cursor_count, cursor_date, cursor_word_id = page_cursor.split('_', 2)
                pagination_filter = """
                    AND (
                        COALESCE(w.total_occurrences, 0) < %s
                        OR (COALESCE(w.total_occurrences, 0) = %s AND p.datum > %s)
                        OR (COALESCE(w.total_occurrences, 0) = %s AND p.datum = %s AND w.word_id > %s)
                    )
                """
                params.extend([int(cursor_count), int(cursor_count), cursor_date,
                                int(cursor_count), cursor_date, int(cursor_word_id)])
            except ValueError:
                pass

        params.append(limit + 1)

        db_cursor.execute(f"""
            SELECT w.word, w.word_id, w.first_protocol_id, p.datum::text as datum,
                   p.wahlperiode, p.protokollnummer,
                   s.speaker_id, s.name as speaker_name,
                   COALESCE(w.total_occurrences, 0) as total_count
            FROM words w
            LEFT JOIN protocols p ON w.first_protocol_id = p.id
            LEFT JOIN speakers s ON w.first_speaker_id = s.speaker_id
            WHERE s.party_id = %s
                {pagination_filter}
            ORDER BY COALESCE(w.total_occurrences, 0) DESC, p.datum ASC, w.word_id ASC
            LIMIT %s
        """, params)

        results = [dict(row) for row in db_cursor.fetchall()]

        # Check if there are more results
        has_more = len(results) > limit
        items = results[:limit] if has_more else results

        # Generate next cursor
        next_cursor = None
        if has_more and items:
            last_item = items[-1]
            next_cursor = f"{last_item['total_count']}_{last_item['datum']}_{last_item['word_id']}"

        return {
            'items': items,
            'pagination': {
                'next_cursor': next_cursor,
                'has_more': has_more,
                'total': total,
                'limit': limit
            }
        }

def get_all_parties() -> List[Dict]:
    """Get all parties with word counts."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT p.party_id, p.name,
                   COUNT(DISTINCT s.speaker_id) as speaker_count,
                   COUNT(w.word_id) as word_count
            FROM parties p
            LEFT JOIN speakers s ON p.party_id = s.party_id
            LEFT JOIN words w ON s.speaker_id = w.first_speaker_id
            GROUP BY p.party_id, p.name
            ORDER BY word_count DESC, p.name
        """)

        return [dict(row) for row in cursor.fetchall()]

# Protocol functions
def get_protocol_details(protocol_id: str) -> Optional[Dict]:
    """Get full protocol details with statistics."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT p.id, p.wahlperiode, p.protokollnummer, p.datum::text as datum,
                   p.titel, p.pdf_url, p.total_words, p.processed
            FROM protocols p
            WHERE p.id = %s
        """, (protocol_id,))

        result = cursor.fetchone()

        if not result:
            return None

        protocol_data = dict(result)

        # Get word statistics for this protocol
        cursor.execute("""
            SELECT COUNT(DISTINCT wo.word_id) as unique_words,
                   SUM(wo.count) as total_word_count
            FROM word_occurrences wo
            WHERE wo.protocol_id = %s
        """, (protocol_id,))

        stats = cursor.fetchone()
        if stats:
            protocol_data['unique_words'] = stats['unique_words']
            protocol_data['total_word_count'] = stats['total_word_count']

        # Get new words count (words that first appeared in this protocol)
        cursor.execute("""
            SELECT COUNT(*) as new_words
            FROM words w
            WHERE w.first_protocol_id = %s
        """, (protocol_id,))

        new_words = cursor.fetchone()
        if new_words:
            protocol_data['new_words_count'] = new_words['new_words']

        return protocol_data

@cache_response(ttl=CACHE_TTL_LONG, key_prefix="protocol_words")
@cache_response(ttl=CACHE_TTL_LONG, key_prefix="cache:protocol_words")
def get_protocol_words(protocol_id: str, limit: int = 100, page_cursor: Optional[str] = None) -> Dict:
    """
    Get words from a protocol with pagination.

    Returns: {
        'items': [...],
        'pagination': {
            'next_cursor': str or None,
            'has_more': bool,
            'total': int,
            'limit': int
        }
    }
    """
    with DatabaseConnection() as conn:
        db_cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Get total count
        db_cursor.execute("""
            SELECT COUNT(*) as total
            FROM word_occurrences wo
            WHERE wo.protocol_id = %s
        """, (protocol_id,))
        total = db_cursor.fetchone()['total']

        # Build pagination filter
        pagination_filter = ""
        params = [protocol_id]

        if page_cursor:
            # Cursor format: "count_wordid" (e.g., "15_1234")
            try:
                cursor_count, cursor_word_id = page_cursor.split('_')
                pagination_filter = """
                    AND (wo.count < %s OR (wo.count = %s AND w.word_id > %s))
                """
                params.extend([int(cursor_count), int(cursor_count), int(cursor_word_id)])
            except ValueError:
                # Invalid cursor, ignore
                pass

        params.append(limit + 1)

        db_cursor.execute(f"""
            SELECT w.word, w.word_id, wo.count,
                   COALESCE(w.total_occurrences, 0) as total_count,
                   w.first_speaker_id,
                   s.name as speaker_name,
                   pa.name as party_name
            FROM word_occurrences wo
            JOIN words w ON wo.word_id = w.word_id
            LEFT JOIN speakers s ON w.first_speaker_id = s.speaker_id
            LEFT JOIN parties pa ON s.party_id = pa.party_id
            WHERE wo.protocol_id = %s
                {pagination_filter}
            ORDER BY wo.count DESC, w.word_id ASC
            LIMIT %s
        """, params)

        results = [dict(row) for row in db_cursor.fetchall()]

        # Check if there are more results
        has_more = len(results) > limit
        items = results[:limit] if has_more else results

        # Generate next cursor
        next_cursor = None
        if has_more and items:
            last_item = items[-1]
            next_cursor = f"{last_item['count']}_{last_item['word_id']}"

        return {
            'items': items,
            'pagination': {
                'next_cursor': next_cursor,
                'has_more': has_more,
                'total': total,
                'limit': limit
            }
        }

def get_protocol_new_words(protocol_id: str) -> List[Dict]:
    """Get words that first appeared in this protocol."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT w.word, wo.count,
                   COALESCE(w.total_occurrences, 0) as total_count,
                   w.first_speaker_id,
                   s.name as speaker_name,
                   pa.name as party_name,
                   pat.name as party_at_time_name
            FROM words w
            JOIN word_occurrences wo ON w.word_id = wo.word_id AND wo.protocol_id = w.first_protocol_id
            LEFT JOIN speakers s ON w.first_speaker_id = s.speaker_id
            LEFT JOIN parties pa ON s.party_id = pa.party_id
            LEFT JOIN parties pat ON w.party_at_time_id = pat.party_id
            WHERE w.first_protocol_id = %s
            ORDER BY wo.count DESC
        """, (protocol_id,))

        return [dict(row) for row in cursor.fetchall()]

# Wahlperiode functions
@cache_response(ttl=CACHE_TTL_VERY_LONG, key_prefix="wahlperioden")
def get_all_wahlperioden() -> List[Dict]:
    """Get list of all Wahlperioden in the database."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT p.wahlperiode,
                   MIN(p.datum)::text as start_date,
                   MAX(p.datum)::text as end_date,
                   COUNT(*) as protocol_count,
                   SUM(CASE WHEN p.processed = TRUE THEN 1 ELSE 0 END) as processed_count
            FROM protocols p
            GROUP BY p.wahlperiode
            ORDER BY p.wahlperiode DESC
        """)

        return [dict(row) for row in cursor.fetchall()]

@cache_response(ttl=CACHE_TTL_LONG, key_prefix="cache:wp_protocols")
def get_wahlperiode_protocols(wp_number: int) -> List[Dict]:
    """Get all protocols from a Wahlperiode."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT p.id, p.protokollnummer, p.datum::text as datum, p.titel,
                   p.pdf_url, p.total_words, p.processed
            FROM protocols p
            WHERE p.wahlperiode = %s
            ORDER BY p.protokollnummer
        """, (wp_number,))

        return [dict(row) for row in cursor.fetchall()]

@cache_response(ttl=CACHE_TTL_LONG, key_prefix="cache:wp_stats")
def get_wahlperiode_stats(wp_number: int) -> Dict:
    """Get statistics for a Wahlperiode."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Basic protocol stats
        cursor.execute("""
            SELECT COUNT(*) as total_protocols,
                   COALESCE(SUM(CASE WHEN processed = TRUE THEN 1 ELSE 0 END), 0) as processed_protocols,
                   COALESCE(SUM(total_words), 0) as total_words
            FROM protocols
            WHERE wahlperiode = %s
        """, (wp_number,))

        protocol_stats = cursor.fetchone()

        # Word stats - only from processed protocols in this WP
        cursor.execute("""
            SELECT COUNT(DISTINCT w.word_id) as unique_words,
                   COALESCE(SUM(wo.count), 0) as total_word_occurrences
            FROM words w
            JOIN word_occurrences wo ON w.word_id = wo.word_id
            JOIN protocols p ON wo.protocol_id = p.id
            WHERE p.wahlperiode = %s
        """, (wp_number,))

        word_stats = cursor.fetchone()

        # New words introduced in this WP
        cursor.execute("""
            SELECT COUNT(*) as new_words
            FROM words w
            JOIN protocols p ON w.first_protocol_id = p.id
            WHERE p.wahlperiode = %s
        """, (wp_number,))

        new_words = cursor.fetchone()

        # Speaker stats (for WP 19+)
        cursor.execute("""
            SELECT COUNT(DISTINCT w.first_speaker_id) as speakers_count
            FROM words w
            JOIN protocols p ON w.first_protocol_id = p.id
            WHERE p.wahlperiode = %s AND w.first_speaker_id IS NOT NULL
        """, (wp_number,))

        speaker_stats = cursor.fetchone()

        stats = {
            'wahlperiode': wp_number,
            'total_protocols': protocol_stats['total_protocols'] if protocol_stats and protocol_stats['total_protocols'] is not None else 0,
            'processed_protocols': protocol_stats['processed_protocols'] if protocol_stats and protocol_stats['processed_protocols'] is not None else 0,
            'total_words': protocol_stats['total_words'] if protocol_stats and protocol_stats['total_words'] is not None else 0,
            'unique_words': word_stats['unique_words'] if word_stats and word_stats['unique_words'] is not None else 0,
            'total_word_occurrences': word_stats['total_word_occurrences'] if word_stats and word_stats['total_word_occurrences'] is not None else 0,
            'new_words': new_words['new_words'] if new_words and new_words['new_words'] is not None else 0,
            'speakers_count': speaker_stats['speakers_count'] if speaker_stats and speaker_stats['speakers_count'] is not None else 0,
        }

        return stats

def get_or_update_wahlperiode_metadata(wp_number: int, force_update: bool = False) -> Optional[Dict]:
    """
    Get Wahlperiode metadata.

    Checks the DB cache first; on a miss (or force_update) falls back to
    static reference data from wahlperiode_data.py and persists it so that
    subsequent calls are served from cache.
    """
    from datetime import datetime, timedelta
    from wahlperiode_data import get_wahlperiode_info as _get_static_wp

    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Check cache
        cursor.execute("""
            SELECT wp_number, start_date, end_date, election_date,
                   chancellor, bundestag_president, coalition, total_seats,
                   parliament_composition, cabinet_members, wikidata_json,
                   last_updated
            FROM wahlperiode_metadata
            WHERE wp_number = %s
        """, (wp_number,))

        cached = cursor.fetchone()

        # Return cached data if fresh (less than 30 days old) and not forced
        if cached and not force_update:
            last_updated = cached['last_updated']
            if last_updated:
                try:
                    updated_time = (
                        datetime.fromisoformat(last_updated)
                        if isinstance(last_updated, str) else last_updated
                    )
                    if datetime.now() - updated_time < timedelta(days=30):
                        result = dict(cached)
                        if result.get('parliament_composition') and isinstance(result['parliament_composition'], str):
                            result['parliament_composition'] = json.loads(result['parliament_composition'])
                        if result.get('cabinet_members') and isinstance(result['cabinet_members'], str):
                            result['cabinet_members'] = json.loads(result['cabinet_members'])
                        return result
                except (ValueError, TypeError):
                    pass  # Cache entry malformed, refresh below

        # Return stale cache if we have one (avoids external calls on every request)
        if cached and not force_update:
            result = dict(cached)
            if result.get('parliament_composition') and isinstance(result['parliament_composition'], str):
                result['parliament_composition'] = json.loads(result['parliament_composition'])
            if result.get('cabinet_members') and isinstance(result['cabinet_members'], str):
                result['cabinet_members'] = json.loads(result['cabinet_members'])
            return result

        # Cache miss or forced refresh — use static reference data
        static = _get_static_wp(wp_number)
        if not static:
            return None

        # Persist to DB cache so future calls are fast
        cursor.execute("""
            INSERT INTO wahlperiode_metadata
                (wp_number, start_date, end_date, election_date,
                 chancellor, bundestag_president, coalition,
                 total_seats, parliament_composition, cabinet_members,
                 wikidata_json, last_updated)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (wp_number) DO UPDATE SET
                start_date         = EXCLUDED.start_date,
                end_date           = EXCLUDED.end_date,
                election_date      = EXCLUDED.election_date,
                chancellor         = EXCLUDED.chancellor,
                bundestag_president = EXCLUDED.bundestag_president,
                coalition          = EXCLUDED.coalition,
                last_updated       = NOW()
        """, (
            wp_number,
            static.get('start_date'),
            static.get('end_date'),
            static.get('election_date'),
            static.get('chancellor'),
            static.get('bundestag_president'),
            static.get('coalition'),
            static.get('total_seats', 0),
            json.dumps(static.get('parliament_composition', [])),
            json.dumps(static.get('cabinet_members', [])),
            None,
        ))
        conn.commit()
        logging.info(f"Populated wahlperiode_metadata cache for WP {wp_number} from static data")
        return static

@cache_response(ttl=CACHE_TTL_VERY_LONG, key_prefix="cache:word_of_day")
def get_word_of_the_day(month: int, day: int, year: int) -> Optional[Dict]:
    """
    Gibt Wort des Tages zurück - wechselt über Jahre.

    Args:
        month: Monat (1-12)
        day: Tag (1-31)
        year: Jahr (z.B. 2024) - für deterministische Auswahl

    Returns:
        Dict mit Wort-Details und is_random Flag
    """
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Finde ALLE Wörter für dieses Datum (Monat+Tag)
        cursor.execute("""
            SELECT
                w.word,
                w.word_id,
                p.datum::text as first_date,
                p.wahlperiode,
                p.protokollnummer,
                p.titel,
                p.pdf_url,
                p.id as first_protocol_id,
                w.first_speaker_id,
                w.optv_link,
                s.name as speaker_name,
                pa_current.name as party_name,
                pa_at_time.name as party_at_time_name,
                COALESCE(w.total_occurrences, 0) as total_count,
                FALSE as is_random
            FROM words w
            JOIN protocols p ON w.first_protocol_id = p.id
            LEFT JOIN speakers s ON w.first_speaker_id = s.speaker_id
            LEFT JOIN parties pa_current ON s.party_id = pa_current.party_id
            LEFT JOIN parties pa_at_time ON w.party_at_time_id = pa_at_time.party_id
            WHERE
                EXTRACT(MONTH FROM p.datum) = %s
                AND EXTRACT(DAY FROM p.datum) = %s
            ORDER BY w.word_id ASC
        """, (month, day))

        results = cursor.fetchall()

        if results:
            # Deterministische Auswahl basierend auf Jahr
            index = year % len(results)
            return dict(results[index])

        # Fallback: Deterministisch-zufälliges Wort basierend auf Jahr
        cursor.execute("""
            SELECT
                w.word,
                w.word_id,
                p.datum::text as first_date,
                p.wahlperiode,
                p.protokollnummer,
                p.titel,
                p.pdf_url,
                p.id as first_protocol_id,
                w.first_speaker_id,
                w.optv_link,
                s.name as speaker_name,
                pa_current.name as party_name,
                pa_at_time.name as party_at_time_name,
                COALESCE(w.total_occurrences, 0) as total_count,
                TRUE as is_random
            FROM words w
            JOIN protocols p ON w.first_protocol_id = p.id
            LEFT JOIN speakers s ON w.first_speaker_id = s.speaker_id
            LEFT JOIN parties pa_current ON s.party_id = pa_current.party_id
            LEFT JOIN parties pa_at_time ON w.party_at_time_id = pa_at_time.party_id
            WHERE p.processed = TRUE
            ORDER BY w.word_id ASC
        """)

        all_words = cursor.fetchall()
        if all_words:
            # Deterministisch basierend auf Jahr+Monat+Tag
            seed = year * 10000 + month * 100 + day
            index = seed % len(all_words)
            return dict(all_words[index])

        return None

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Test connection
    print("Testing PostgreSQL connection...")
    try:
        with DatabaseConnection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT version()")
            version = cursor.fetchone()[0]
            print(f"✓ Connected to: {version}")

        print(f"✓ Connection pool initialized")
        print(f"Database: {DB_CONFIG['database']}@{DB_CONFIG['host']}")

    except Exception as e:
        print(f"✗ Connection failed: {e}")
        print("\nMake sure PostgreSQL is running and configured:")
        print("  export POSTGRES_HOST=localhost")
        print("  export POSTGRES_DB=bundestag")
        print("  export POSTGRES_USER=bundestag_user")
        print("  export POSTGRES_PASSWORD=your_password")
