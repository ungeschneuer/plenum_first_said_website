# Quick Start: Implement MP New Words Ranking

This is a condensed version focusing on the fastest path to getting MP rankings working.

## Decision: Use Wikidata IDs from OpenParliamentTV

**Why:**
- Already integrated
- Globally unique and consistent across Wahlperioden
- No additional API needed
- Works for WP 19+ (2017+) where speaker data exists

**Trade-off:** Won't work for older Wahlperioden (pre-2017), but those don't have speaker data anyway.

---

## Implementation Steps (2-3 Days)

### Step 1: Extract Wikidata IDs from OPTV (4 hours)

**Modify `backend/optv_api.py`:**

```python
def extract_metadata(document_data: Dict, word: str) -> Optional[Dict]:
    """Extract speaker and party information from OPTV response."""
    try:
        first_result = document_data['data'][0]

        # Extract person data
        people_data = first_result['relationships']['people']['data'][0]

        # The person ID is the Wikidata QID
        wikidata_qid = people_data.get('id', '').split('/')[-1]  # Extract Q-number

        # Build link to video
        media_type = first_result['type']
        media_id = first_result['id']
        link = f"https://de.openparliament.tv/{media_type}/{media_id}?q={word}"

        # Extract speaker information
        speaker = people_data['attributes']['label']
        party = people_data['attributes']['party']['label']

        metadata = {
            'speaker': speaker,
            'party': party,
            'link': link,
            'qid_wikidata': wikidata_qid if wikidata_qid.startswith('Q') else None  # NEW
        }

        logging.info(f"Found speaker for '{word}': {speaker} ({party}) [Wikidata: {wikidata_qid}]")
        return metadata

    except (KeyError, IndexError, TypeError) as e:
        logging.error(f"Failed to extract OPTV metadata: {e}")
        return None
```

**Modify `backend/database_postgresql_impl.py`:**

```python
def get_or_create_speaker(speaker_name: str, party_name: str = None,
                          optv_link: str = None, qid_wikidata: str = None) -> int:
    """Get or create speaker, using Wikidata ID for deduplication."""
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # First try to find by Wikidata ID
        if qid_wikidata:
            cursor.execute("""
                SELECT speaker_id FROM speakers WHERE qid_wikidata = %s
            """, (qid_wikidata,))

            result = cursor.fetchone()
            if result:
                logging.debug(f"Found existing speaker by Wikidata ID: {speaker_name} ({qid_wikidata})")
                return result['speaker_id']

        # Otherwise check by name (legacy behavior)
        cursor.execute("""
            SELECT speaker_id FROM speakers WHERE name = %s
        """, (speaker_name,))

        result = cursor.fetchone()
        if result:
            # Update with Wikidata ID if we have it
            if qid_wikidata:
                cursor.execute("""
                    UPDATE speakers SET qid_wikidata = %s WHERE speaker_id = %s
                """, (qid_wikidata, result['speaker_id']))
                conn.commit()
            return result['speaker_id']

        # Create new speaker
        party_id = get_or_create_party(party_name) if party_name else None

        cursor.execute("""
            INSERT INTO speakers (name, party_id, optv_link, qid_wikidata)
            VALUES (%s, %s, %s, %s)
            RETURNING speaker_id
        """, (speaker_name, party_id, optv_link, qid_wikidata))

        speaker_id = cursor.fetchone()['speaker_id']
        conn.commit()

        logging.info(f"Created new speaker: {speaker_name} (ID: {speaker_id}, Wikidata: {qid_wikidata})")
        return speaker_id
```

**Update speaker tracking calls:**

```python
# In speaker_check_module.py, line 75-79
if speaker_info:
    speaker_id = get_or_create_speaker(
        speaker_name=speaker_info['speaker'],
        party_name=speaker_info['party'],
        optv_link=speaker_info['link'],
        qid_wikidata=speaker_info.get('qid_wikidata')  # NEW
    )
```

### Step 2: Database Migration (1 hour)

```bash
uv run python backend/migrate_mp_ids.py
```

**Create `backend/migrate_mp_ids.py`:**

```python
"""Add Wikidata ID column and deduplicate speakers."""

import logging
from database import get_connection

logging.basicConfig(level=logging.INFO)

def add_wikidata_column():
    """Add qid_wikidata column if not exists."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        ALTER TABLE speakers
        ADD COLUMN IF NOT EXISTS qid_wikidata TEXT
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_speakers_wikidata
        ON speakers(qid_wikidata)
        WHERE qid_wikidata IS NOT NULL
    """)

    conn.commit()
    cursor.close()
    logging.info("✓ Added qid_wikidata column and index")

def deduplicate_speakers():
    """Merge speakers with same Wikidata ID."""
    conn = get_connection()
    cursor = conn.cursor()

    # Find duplicates
    cursor.execute("""
        SELECT qid_wikidata, array_agg(speaker_id ORDER BY speaker_id) as ids
        FROM speakers
        WHERE qid_wikidata IS NOT NULL
        GROUP BY qid_wikidata
        HAVING COUNT(*) > 1
    """)

    duplicates = cursor.fetchall()

    for qid, speaker_ids in duplicates:
        primary_id = speaker_ids[0]
        duplicate_ids = speaker_ids[1:]

        logging.info(f"Merging {len(duplicate_ids)} duplicates for {qid} into speaker {primary_id}")

        # Update words to point to primary speaker
        cursor.execute("""
            UPDATE words
            SET first_speaker_id = %s
            WHERE first_speaker_id = ANY(%s)
        """, (primary_id, duplicate_ids))

        # Delete duplicates
        cursor.execute("""
            DELETE FROM speakers WHERE speaker_id = ANY(%s)
        """, (duplicate_ids,))

    conn.commit()
    cursor.close()
    logging.info(f"✓ Merged {len(duplicates)} duplicate speaker groups")

if __name__ == "__main__":
    add_wikidata_column()
    deduplicate_speakers()
    print("\n✓ Migration complete!")
```

### Step 3: Create Ranking Query (2 hours)

**Create `backend/database_rankings.py`:**

```python
"""MP new words ranking queries."""

from typing import List, Dict, Optional
from database import get_connection
from psycopg2.extras import RealDictCursor
from cache import cache_response, CACHE_TTL_LONG

@cache_response(ttl=CACHE_TTL_LONG, key_prefix="cache:ranking")
def get_new_words_ranking(
    wahlperiode: Optional[int] = None,
    party: Optional[str] = None,
    limit: int = 100
) -> List[Dict]:
    """Get ranking of MPs by new words introduced (after 2015)."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        WITH mp_canonical AS (
            -- Canonicalize MP identity using Wikidata ID or speaker_id
            SELECT
                COALESCE(s.qid_wikidata, s.speaker_id::text) as canonical_id,
                MIN(s.speaker_id) as primary_speaker_id,
                MIN(s.name) as mp_name,
                MIN(p.name) as current_party
            FROM speakers s
            LEFT JOIN parties p ON s.party_id = p.party_id
            GROUP BY canonical_id
        )
        SELECT
            mc.canonical_id,
            mc.mp_name,
            mc.current_party,
            prot.wahlperiode,
            COUNT(DISTINCT w.word_id) as new_words_count,
            MIN(w.first_date)::text as first_word_date,
            MAX(w.first_date)::text as last_word_date,
            json_agg(
                json_build_object(
                    'word', w.word,
                    'date', w.first_date::text,
                    'protocol_id', w.first_protocol_id
                )
                ORDER BY w.first_date DESC
            ) FILTER (WHERE w.word_id IS NOT NULL) as sample_words
        FROM mp_canonical mc
        JOIN speakers s ON s.speaker_id = mc.primary_speaker_id OR s.qid_wikidata = mc.canonical_id
        JOIN words w ON w.first_speaker_id = s.speaker_id
        JOIN protocols prot ON w.first_protocol_id = prot.id
        WHERE
            w.first_date >= '2015-01-01'
            AND w.first_speaker_id IS NOT NULL
    """

    params = []

    if wahlperiode:
        query += " AND prot.wahlperiode = %s"
        params.append(wahlperiode)

    if party:
        query += " AND mc.current_party = %s"
        params.append(party)

    query += """
        GROUP BY mc.canonical_id, mc.mp_name, mc.current_party, prot.wahlperiode
        ORDER BY new_words_count DESC, mp_name
    """

    if limit:
        query += " LIMIT %s"
        params.append(limit)

    cursor.execute(query, params)
    results = cursor.fetchall()

    # Add ranking
    for i, result in enumerate(results, 1):
        result['rank'] = i
        # Limit sample words to top 10
        if result.get('sample_words'):
            result['sample_words'] = result['sample_words'][:10]

    cursor.close()
    return [dict(r) for r in results]
```

### Step 4: Add API Endpoint (1 hour)

**In `backend/api.py`:**

```python
# Add Pydantic models
class SampleWord(BaseModel):
    word: str
    date: str
    protocol_id: str

class NewWordsRankingItem(BaseModel):
    rank: int
    canonical_id: str
    mp_name: str
    current_party: Optional[str]
    wahlperiode: int
    new_words_count: int
    first_word_date: str
    last_word_date: str
    sample_words: List[SampleWord]

class NewWordsRankingResponse(BaseModel):
    wahlperiode: Optional[int]
    party: Optional[str]
    rankings: List[NewWordsRankingItem]
    total_mps: int
    total_new_words: int

# Add endpoint
@app.get("/api/rankings/neue-woerter", response_model=NewWordsRankingResponse)
async def get_new_words_ranking_endpoint(
    wahlperiode: Optional[int] = Query(None, description="Filter nach Wahlperiode"),
    party: Optional[str] = Query(None, description="Filter nach Partei"),
    limit: int = Query(100, le=500, description="Maximale Anzahl Ergebnisse")
):
    """
    Ranking der Abgeordneten nach Anzahl neuer Wörter (seit 2015).

    Zeigt welche Abgeordnete die meisten neuen Wörter in den Bundestag eingebracht haben.
    """
    try:
        from database_rankings import get_new_words_ranking

        rankings = get_new_words_ranking(wahlperiode, party, limit)

        total_mps = len(rankings)
        total_new_words = sum(r['new_words_count'] for r in rankings)

        return NewWordsRankingResponse(
            wahlperiode=wahlperiode,
            party=party,
            rankings=rankings,
            total_mps=total_mps,
            total_new_words=total_new_words
        )
    except Exception as e:
        logging.error(f"Error in ranking endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")
```

### Step 5: Test (2 hours)

```bash
# 1. Run migration
uv run python backend/migrate_mp_ids.py

# 2. Re-check speakers to populate Wikidata IDs
uv run python backend/check_speakers.py 10

# 3. Test ranking query directly
uv run python -c "
from database_rankings import get_new_words_ranking
rankings = get_new_words_ranking(wahlperiode=19, limit=10)
for r in rankings:
    print(f\"{r['rank']}. {r['mp_name']} ({r['current_party']}): {r['new_words_count']} Wörter\")
"

# 4. Test API endpoint
curl http://localhost:8000/api/rankings/neue-woerter?wahlperiode=19 | python3 -m json.tool
```

---

## Quick Usage After Implementation

```bash
# Get top 100 MPs by new words (all Wahlperioden since 2015)
curl "http://localhost:8000/api/rankings/neue-woerter"

# Get top 50 for Wahlperiode 19
curl "http://localhost:8000/api/rankings/neue-woerter?wahlperiode=19&limit=50"

# Get SPD ranking for WP 19
curl "http://localhost:8000/api/rankings/neue-woerter?wahlperiode=19&party=SPD"
```

---

## What This Gives You

1. **Consistent MP identification** across all protocols using Wikidata IDs
2. **Automatic deduplication** when same MP appears multiple times
3. **Fast ranking queries** (cached for 1 hour)
4. **Flexible filtering** by Wahlperiode and party
5. **Sample words** showing examples of new words each MP introduced

---

## Limitations

- Only works for WP 19+ (2017+) where OPTV has data
- Requires speaker data to have been checked via `check_speakers.py`
- MPs without Wikidata IDs will be treated as separate entities

---

## Next Steps (Optional Enhancements)

1. Add frontend component to display rankings
2. Integrate Abgeordnetenwatch API for historical data (pre-2017)
3. Create materialized view for faster queries
4. Add timeline showing new words over time per MP
5. Add export to CSV/Excel
