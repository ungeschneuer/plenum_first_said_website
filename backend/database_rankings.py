"""
Database functions for MP new words rankings.

Provides ranking queries showing which MPs introduced the most new words,
using Bundestag MdB IDs for consistent MP identification across Wahlperioden.
"""

from typing import List, Dict, Optional
from database import get_connection
from psycopg2.extras import RealDictCursor
from cache import cache_response, CACHE_TTL_LONG
import logging


@cache_response(ttl=CACHE_TTL_LONG, key_prefix="cache:ranking")
def get_new_words_ranking(
    wahlperiode: Optional[int] = None,
    party: Optional[str] = None,
    limit: int = 100
) -> List[Dict]:
    """
    Get ranking of MPs by new words introduced (after 2015).

    Uses Bundestag MdB ID as canonical MP identifier to track same person
    across multiple Wahlperioden.

    Args:
        wahlperiode: Filter by specific Wahlperiode (None = all periods)
        party: Filter by party name/abbreviation
        limit: Max results to return (default 100)

    Returns:
        List of dicts with ranking data:
        - rank: Position in ranking
        - canonical_id: Bundestag MdB ID (prefixed bt:) or speaker_id as fallback
        - mp_name: Name of MP
        - current_party: Current/most recent party affiliation
        - wahlperiode: Legislature period
        - new_words_count: Number of new words introduced
        - first_word_date: Date of first new word
        - last_word_date: Date of most recent new word
        - sample_words: List of example words (max 10)
    """
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Build query with canonical MP identification using Wikidata QID
        query = """
            WITH mp_canonical AS (
                -- Canonicalize MP identity: prefer Wikidata QID, fallback to speaker_id
                SELECT
                    COALESCE('bt:' || s.bundestag_id, s.speaker_id::text) as canonical_id,
                    MIN(s.speaker_id) as primary_speaker_id,
                    MIN(s.name) as mp_name,
                    MIN(p.name) as current_party,
                    MIN(p.short_name) as party_abbrev
                FROM speakers s
                LEFT JOIN parties p ON s.party_id = p.party_id
                GROUP BY canonical_id
            )
            SELECT
                mc.canonical_id,
                mc.primary_speaker_id,
                mc.mp_name,
                mc.current_party,
                mc.party_abbrev,
                prot.wahlperiode,
                COUNT(DISTINCT w.word_id) as new_words_count,
                MIN(prot.datum)::text as first_word_date,
                MAX(prot.datum)::text as last_word_date,
                json_agg(
                    json_build_object(
                        'word', w.word,
                        'date', prot.datum::text,
                        'protocol_id', w.first_protocol_id
                    )
                    ORDER BY prot.datum DESC
                ) FILTER (WHERE w.word_id IS NOT NULL) as sample_words
            FROM mp_canonical mc
            -- Join to all speaker records that map to this canonical MP
            JOIN speakers s ON (
                (mc.canonical_id LIKE 'bt:%' AND s.bundestag_id = substring(mc.canonical_id FROM 4))
                OR (mc.canonical_id NOT LIKE 'bt:%' AND s.speaker_id::text = mc.canonical_id)
            )
            JOIN words w ON w.first_speaker_id = s.speaker_id
            JOIN protocols prot ON w.first_protocol_id = prot.id
            WHERE
                prot.datum >= '2015-01-01'
                AND w.first_speaker_id IS NOT NULL
        """

        params = ()

        # Add filters
        if wahlperiode:
            query += " AND prot.wahlperiode = %s"
            params = params + (wahlperiode,)

        if party:
            query += " AND (mc.current_party ILIKE %s OR mc.party_abbrev ILIKE %s)"
            params = params + (f"%{party}%", f"%{party}%")

        # Group and order
        query += """
            GROUP BY mc.canonical_id, mc.primary_speaker_id, mc.mp_name, mc.current_party, mc.party_abbrev, prot.wahlperiode
            ORDER BY new_words_count DESC, mc.mp_name
        """

        if limit:
            query += " LIMIT %s"
            params = params + (limit,)

        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        results = cursor.fetchall()

        # Post-process results
        for i, result in enumerate(results, 1):
            result['rank'] = i

            # Limit sample words to top 10
            if result.get('sample_words'):
                result['sample_words'] = result['sample_words'][:10]
            else:
                result['sample_words'] = []

        return [dict(r) for r in results]

    except Exception as e:
        logging.error(f"Error getting new words ranking: {e}")
        raise
    finally:
        cursor.close()


@cache_response(ttl=CACHE_TTL_LONG, key_prefix="cache:ranking_overall")
def get_overall_new_words_ranking(
    party: Optional[str] = None,
    limit: int = 100
) -> List[Dict]:
    """
    Get overall ranking aggregated across all Wahlperioden.

    Same MP appearing in multiple periods will be aggregated into one entry.

    Args:
        party: Filter by party name/abbreviation
        limit: Max results to return

    Returns:
        List of dicts with aggregated ranking data
    """
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        query = """
            WITH mp_canonical AS (
                SELECT
                    COALESCE('bt:' || s.bundestag_id, s.speaker_id::text) as canonical_id,
                    MIN(s.speaker_id) as primary_speaker_id,
                    MIN(s.name) as mp_name,
                    MIN(p.name) as current_party,
                    MIN(p.short_name) as party_abbrev
                FROM speakers s
                LEFT JOIN parties p ON s.party_id = p.party_id
                GROUP BY canonical_id
            )
            SELECT
                mc.canonical_id,
                mc.mp_name,
                mc.current_party,
                mc.party_abbrev,
                COUNT(DISTINCT w.word_id) as total_new_words,
                MIN(prot.datum)::text as first_word_date,
                MAX(prot.datum)::text as last_word_date,
                array_agg(DISTINCT prot.wahlperiode ORDER BY prot.wahlperiode) as wahlperioden,
                json_agg(
                    json_build_object(
                        'word', w.word,
                        'date', prot.datum::text,
                        'protocol_id', w.first_protocol_id,
                        'wahlperiode', prot.wahlperiode
                    )
                    ORDER BY prot.datum DESC
                ) FILTER (WHERE w.word_id IS NOT NULL) as sample_words
            FROM mp_canonical mc
            JOIN speakers s ON (
                (mc.canonical_id LIKE 'bt:%' AND s.bundestag_id = substring(mc.canonical_id FROM 4))
                OR (mc.canonical_id NOT LIKE 'bt:%' AND s.speaker_id::text = mc.canonical_id)
            )
            JOIN words w ON w.first_speaker_id = s.speaker_id
            JOIN protocols prot ON w.first_protocol_id = prot.id
            WHERE
                prot.datum >= '2015-01-01'
                AND w.first_speaker_id IS NOT NULL
        """

        params = ()

        if party:
            query += " AND (mc.current_party ILIKE %s OR mc.party_abbrev ILIKE %s)"
            params = params + (f"%{party}%", f"%{party}%")

        query += """
            GROUP BY mc.canonical_id, mc.mp_name, mc.current_party, mc.party_abbrev
            ORDER BY total_new_words DESC, mc.mp_name
        """

        if limit:
            query += " LIMIT %s"
            params = params + (limit,)

        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        results = cursor.fetchall()

        # Post-process
        for i, result in enumerate(results, 1):
            result['rank'] = i

            # Limit sample words
            if result.get('sample_words'):
                result['sample_words'] = result['sample_words'][:10]
            else:
                result['sample_words'] = []

        return [dict(r) for r in results]

    except Exception as e:
        logging.error(f"Error getting overall ranking: {e}")
        raise
    finally:
        cursor.close()


def get_ranking_statistics(wahlperiode: Optional[int] = None) -> Dict:
    """
    Get statistics about new words rankings.

    Args:
        wahlperiode: Optional filter by Wahlperiode

    Returns:
        Dict with statistics:
        - total_mps: Number of MPs with new words
        - total_new_words: Total number of new words
        - avg_words_per_mp: Average new words per MP
        - date_range: First and last word dates
    """
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        query = """
            WITH mp_canonical AS (
                SELECT
                    COALESCE('bt:' || s.bundestag_id, s.speaker_id::text) as canonical_id
                FROM speakers s
                GROUP BY canonical_id
            )
            SELECT
                COUNT(DISTINCT mc.canonical_id) as total_mps,
                COUNT(DISTINCT w.word_id) as total_new_words,
                COALESCE(ROUND(AVG(word_count)), 0) as avg_words_per_mp,
                MIN(prot.datum)::text as earliest_word_date,
                MAX(prot.datum)::text as latest_word_date
            FROM mp_canonical mc
            JOIN speakers s ON (
                (mc.canonical_id LIKE 'bt:%' AND s.bundestag_id = substring(mc.canonical_id FROM 4))
                OR (mc.canonical_id NOT LIKE 'bt:%' AND s.speaker_id::text = mc.canonical_id)
            )
            JOIN words w ON w.first_speaker_id = s.speaker_id
            JOIN protocols prot ON w.first_protocol_id = prot.id
            CROSS JOIN LATERAL (
                SELECT COUNT(DISTINCT w2.word_id) as word_count
                FROM words w2
                JOIN protocols p2 ON w2.first_protocol_id = p2.id
                WHERE w2.first_speaker_id = s.speaker_id
                AND p2.datum >= '2015-01-01'
            ) word_counts
            WHERE
                prot.datum >= '2015-01-01'
                AND w.first_speaker_id IS NOT NULL
        """

        params = ()

        if wahlperiode:
            query += " AND prot.wahlperiode = %s"
            params = (wahlperiode,)

        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        result = cursor.fetchone()

        return dict(result) if result else {
            'total_mps': 0,
            'total_new_words': 0,
            'avg_words_per_mp': 0,
            'earliest_word_date': None,
            'latest_word_date': None
        }

    except Exception as e:
        logging.error(f"Error getting ranking statistics: {e}")
        raise
    finally:
        cursor.close()


if __name__ == "__main__":
    # Test the ranking queries
    logging.basicConfig(level=logging.INFO)

    print("Testing ranking queries...")
    print("=" * 70)

    # Test overall ranking
    print("\nTop 10 MPs overall:")
    rankings = get_overall_new_words_ranking(limit=10)
    for r in rankings:
        print(f"{r['rank']:2}. {r['mp_name']:30} ({r['current_party'] or 'N/A':10}) - {r['total_new_words']:4} words")

    # Test statistics
    print("\nStatistics:")
    stats = get_ranking_statistics()
    for key, value in stats.items():
        print(f"  {key}: {value}")
