# MP ID Consistency & New Words Ranking Implementation Plan

Date: 2026-02-13

## Problem Statement

Currently, speakers are identified only by name from OpenParliamentTV API. This creates duplicate entries when:
- Same MP serves across multiple Wahlperioden
- Names have slight variations (e.g., "Dr. Name" vs "Name")
- MPs change parties between periods

**Goal:** Implement consistent MP identification across all protocols and Wahlperioden, then create rankings showing which MPs introduced the most new words (after 2015).

---

## Research Findings

### 1. OpenParliamentTV API (Currently Used)

**Status:** Already integrated

**Data Provided:**
- Speaker name
- Party (at time of speaking)
- Video link
- **Wikidata ID** (Q-number) - Available via person endpoint

**Pros:**
- Already integrated
- Wikidata IDs are globally unique and consistent
- Good coverage for WP 19+ (2017+)

**Cons:**
- Our current implementation doesn't extract Wikidata ID
- API seems to have intermittent availability

**API Structure:**
```
https://de.openparliament.tv/person/Q567
```

### 2. Abgeordnetenwatch API (Recommended Addition)

**Status:** Not integrated, recommended

**Official Documentation:** [Abgeordnetenwatch API](https://www.abgeordnetenwatch.de/api)

**Data Provided:**
- `id` - Internal Abgeordnetenwatch ID (35,802 politicians)
- `ext_id_bundestagsverwaltung` - Official Bundestag administration ID
- `qid_wikidata` - Wikidata ID (Q-number)
- `first_name`, `last_name`, `year_of_birth`
- Party affiliations and changes
- Electoral mandates across multiple periods

**Pros:**
- Free API with CC0 1.0 license
- Comprehensive data (35,802 politicians)
- Provides THREE types of IDs (internal, Bundestag, Wikidata)
- Tracks party changes over time
- Tracks candidacies/mandates per period

**Cons:**
- Requires integration
- Not all politicians have all ID types populated

**API Endpoints:**
```bash
# Get politician by name
https://www.abgeordnetenwatch.de/api/v2/politicians?last_name=Scholz

# Get candidacies/mandates
https://www.abgeordnetenwatch.de/api/v2/candidacies-mandates?politician[id]=180765
```

### 3. Bundestag Official APIs

**Options:**
- bundestag.io API ([GitHub](https://github.com/demokratie-live/bundestag.io))
- DIP API ([PublicAPI](https://publicapi.dev/deutscher-bundestag-dip-api))

**Status:** Not researched in depth, likely overkill for this use case

---

## Recommended Solution

### Phase 1: Extract Wikidata IDs from OpenParliamentTV (Quick Win)

**Implementation:**
1. Enhance OPTV API integration to extract Wikidata ID when fetching speaker info
2. Store in `speakers.qid_wikidata` column
3. Use Wikidata ID as primary deduplication key

**Pros:**
- Minimal changes (enhance existing integration)
- Wikidata IDs are stable and consistent
- Works for WP 19+ where we have OPTV data

**Cons:**
- Only works for protocols from 2017+ (WP 19+)
- Relies on OPTV API availability

### Phase 2: Add Abgeordnetenwatch Integration (Comprehensive)

**Implementation:**
1. Create `abgeordnetenwatch_api.py` module
2. For each speaker name:
   - Query Abgeordnetenwatch API by name
   - Match using name + birth year if available
   - Extract `ext_id_bundestagsverwaltung` and `qid_wikidata`
   - Store in speakers table
3. Use Bundestag ID as primary key for deduplication

**Pros:**
- Most comprehensive solution
- Works for all time periods (not just WP 19+)
- Provides official Bundestag IDs
- Can enrich existing speaker data retroactively

**Cons:**
- More complex integration
- Name matching may have false positives
- Requires careful validation

---

## Database Schema Changes

### Current `speakers` Table

```sql
speaker_id         SERIAL PRIMARY KEY
name               TEXT NOT NULL UNIQUE
party_id           INTEGER (current/latest party)
optv_link          TEXT
bundestag_id       TEXT (currently unused)
birth_date         TEXT
birth_place        TEXT
profession         TEXT
electoral_district TEXT
metadata_json      JSONB
created_at         TIMESTAMP
```

### Proposed Changes

```sql
-- Add new columns for MP identification
ALTER TABLE speakers ADD COLUMN IF NOT EXISTS qid_wikidata TEXT;
ALTER TABLE speakers ADD COLUMN IF NOT EXISTS abgeordnetenwatch_id INTEGER;
ALTER TABLE speakers ADD COLUMN IF NOT EXISTS year_of_birth INTEGER;

-- Rename bundestag_id for clarity
ALTER TABLE speakers RENAME COLUMN bundestag_id TO ext_id_bundestagsverwaltung;

-- Create indexes for lookups
CREATE INDEX IF NOT EXISTS idx_speakers_wikidata ON speakers(qid_wikidata);
CREATE INDEX IF NOT EXISTS idx_speakers_bundestag_id ON speakers(ext_id_bundestagsverwaltung);
CREATE INDEX IF NOT EXISTS idx_speakers_abgeordnetenwatch ON speakers(abgeordnetenwatch_id);

-- Make name non-unique (same person may have multiple entries if needed)
ALTER TABLE speakers DROP CONSTRAINT speakers_name_key;

-- Create unique constraint on Wikidata ID (primary deduplication key)
CREATE UNIQUE INDEX idx_speakers_wikidata_unique ON speakers(qid_wikidata) WHERE qid_wikidata IS NOT NULL;
```

### Deduplication Strategy

**Primary Key:** `qid_wikidata` (when available)
**Fallback:** `ext_id_bundestagsverwaltung` (when available)
**Last Resort:** Name matching

```sql
-- Query to find same person across entries
SELECT
    COALESCE(qid_wikidata, ext_id_bundestagsverwaltung, name::text) as canonical_id,
    COUNT(*) as entries,
    array_agg(speaker_id) as speaker_ids
FROM speakers
GROUP BY canonical_id
HAVING COUNT(*) > 1;
```

---

## New Words Ranking Feature

### Database Query

Create a materialized view for performance:

```sql
CREATE MATERIALIZED VIEW mp_new_words_ranking AS
SELECT
    COALESCE(s.qid_wikidata, s.ext_id_bundestagsverwaltung, s.speaker_id::text) as canonical_mp_id,
    s.name as mp_name,
    p_current.name as current_party,
    wp.wahlperiode,
    COUNT(DISTINCT w.word_id) as new_words_count,
    MIN(w.first_date) as first_word_date,
    MAX(w.first_date) as last_word_date,
    array_agg(DISTINCT p_at_time.name) as parties_during_period
FROM words w
JOIN speakers s ON w.first_speaker_id = s.speaker_id
JOIN protocols wp ON w.first_protocol_id = wp.id
LEFT JOIN parties p_current ON s.party_id = p_current.party_id
LEFT JOIN parties p_at_time ON w.party_at_time_id = p_at_time.party_id
WHERE
    w.first_date >= '2015-01-01'  -- After 2015
    AND w.first_speaker_id IS NOT NULL
GROUP BY
    canonical_mp_id,
    s.name,
    p_current.name,
    wp.wahlperiode
ORDER BY
    wp.wahlperiode DESC,
    new_words_count DESC;

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_mp_rankings()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mp_new_words_ranking;
END;
$$ LANGUAGE plpgsql;
```

### API Endpoints

```python
# GET /api/rankings/new-words
# Returns overall ranking across all Wahlperioden

# GET /api/rankings/new-words?wahlperiode=19
# Returns ranking for specific Wahlperiode

# GET /api/rankings/new-words?wahlperiode=19&party=SPD
# Returns ranking filtered by party

# Response format:
{
    "wahlperiode": 19,
    "rankings": [
        {
            "rank": 1,
            "canonical_mp_id": "Q567",
            "mp_name": "Angela Merkel",
            "current_party": "CDU",
            "new_words_count": 142,
            "first_word_date": "2017-10-24",
            "last_word_date": "2021-09-26",
            "parties_during_period": ["CDU"]
        },
        ...
    ],
    "total_mps": 245,
    "total_new_words": 12543
}
```

---

## Implementation Steps

### Step 1: Enhance OPTV Integration (Immediate)

**Files to modify:**
- `backend/optv_api.py` - Add Wikidata ID extraction
- `backend/database_postgresql_impl.py` - Store qid_wikidata

**Code changes:**

```python
# In optv_api.py
def extract_metadata(document_data: Dict, word: str) -> Optional[Dict]:
    try:
        first_result = document_data['data'][0]
        people_data = first_result['relationships']['people']['data'][0]

        # Extract Wikidata ID from person data
        person_id = people_data.get('id')  # This is the Wikidata Q-ID

        metadata = {
            'speaker': people_data['attributes']['label'],
            'party': people_data['attributes']['party']['label'],
            'link': f"https://de.openparliament.tv/...",
            'qid_wikidata': person_id  # NEW
        }
        return metadata
    except ...
```

### Step 2: Add Abgeordnetenwatch Integration (Week 1)

**New file:** `backend/abgeordnetenwatch_api.py`

```python
"""
Abgeordnetenwatch API integration for comprehensive MP data.
"""

import requests
from typing import Optional, Dict, List

ABGEORDNETENWATCH_API = "https://www.abgeordnetenwatch.de/api/v2"

def search_politician(last_name: str, first_name: Optional[str] = None) -> List[Dict]:
    """Search for politicians by name."""
    url = f"{ABGEORDNETENWATCH_API}/politicians"
    params = {'last_name': last_name}
    if first_name:
        params['first_name'] = first_name

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    return response.json()['data']

def get_politician_by_id(politician_id: int) -> Optional[Dict]:
    """Get detailed politician data by ID."""
    url = f"{ABGEORDNETENWATCH_API}/politicians/{politician_id}"
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return response.json()['data']

def enrich_speaker_data(speaker_name: str, year_of_birth: Optional[int] = None) -> Optional[Dict]:
    """
    Enrich speaker data with Abgeordnetenwatch info.
    Returns dict with bundestag_id, wikidata_id, etc.
    """
    # Split name
    parts = speaker_name.split()
    last_name = parts[-1]
    first_name = ' '.join(parts[:-1])

    # Search for politician
    results = search_politician(last_name, first_name)

    if not results:
        return None

    # Match by year of birth if available
    if year_of_birth:
        for result in results:
            if result.get('year_of_birth') == year_of_birth:
                return {
                    'abgeordnetenwatch_id': result['id'],
                    'ext_id_bundestagsverwaltung': result.get('ext_id_bundestagsverwaltung'),
                    'qid_wikidata': result.get('qid_wikidata'),
                    'year_of_birth': result.get('year_of_birth')
                }

    # Otherwise return first match (may need validation)
    result = results[0]
    return {
        'abgeordnetenwatch_id': result['id'],
        'ext_id_bundestagsverwaltung': result.get('ext_id_bundestagsverwaltung'),
        'qid_wikidata': result.get('qid_wikidata'),
        'year_of_birth': result.get('year_of_birth')
    }
```

### Step 3: Database Migration (Week 1)

**New file:** `backend/migrate_mp_ids.py`

```python
"""
Migrate speaker data to add MP identification fields.
"""

import logging
from database import get_connection

def migrate_speaker_ids():
    """Add new columns for MP identification."""
    conn = get_connection()
    cursor = conn.cursor()

    # Add new columns
    migrations = [
        "ALTER TABLE speakers ADD COLUMN IF NOT EXISTS qid_wikidata TEXT",
        "ALTER TABLE speakers ADD COLUMN IF NOT EXISTS abgeordnetenwatch_id INTEGER",
        "ALTER TABLE speakers ADD COLUMN IF NOT EXISTS year_of_birth INTEGER",
        "CREATE INDEX IF NOT EXISTS idx_speakers_wikidata ON speakers(qid_wikidata)",
        "CREATE INDEX IF NOT EXISTS idx_speakers_abgeordnetenwatch ON speakers(abgeordnetenwatch_id)",
    ]

    for migration in migrations:
        try:
            cursor.execute(migration)
            logging.info(f"✓ {migration[:50]}...")
        except Exception as e:
            logging.error(f"✗ Migration failed: {e}")

    conn.commit()
    cursor.close()

def deduplicate_speakers():
    """Find and merge duplicate speakers based on Wikidata ID."""
    conn = get_connection()
    cursor = conn.cursor()

    # Find duplicates by Wikidata ID
    cursor.execute("""
        SELECT qid_wikidata, array_agg(speaker_id) as speaker_ids
        FROM speakers
        WHERE qid_wikidata IS NOT NULL
        GROUP BY qid_wikidata
        HAVING COUNT(*) > 1
    """)

    duplicates = cursor.fetchall()

    for qid, speaker_ids in duplicates:
        # Keep first ID, merge others
        primary_id = speaker_ids[0]
        secondary_ids = speaker_ids[1:]

        logging.info(f"Merging {len(secondary_ids)} duplicates for {qid} into speaker {primary_id}")

        # Update words to point to primary speaker
        for secondary_id in secondary_ids:
            cursor.execute("""
                UPDATE words
                SET first_speaker_id = %s
                WHERE first_speaker_id = %s
            """, (primary_id, secondary_id))

        # Delete secondary speaker entries
        cursor.execute("""
            DELETE FROM speakers
            WHERE speaker_id = ANY(%s)
        """, (secondary_ids,))

    conn.commit()
    cursor.close()
    logging.info(f"✓ Merged {len(duplicates)} duplicate speaker groups")
```

### Step 4: Create Ranking Queries (Week 2)

**New file:** `backend/database_rankings.py`

```python
"""
Database functions for MP new words rankings.
"""

from typing import List, Dict, Optional
from database import get_connection
from psycopg2.extras import RealDictCursor

def get_new_words_ranking(
    wahlperiode: Optional[int] = None,
    party: Optional[str] = None,
    limit: int = 100
) -> List[Dict]:
    """
    Get ranking of MPs by new words introduced.

    Args:
        wahlperiode: Filter by specific Wahlperiode (None = all)
        party: Filter by party abbreviation
        limit: Max results to return

    Returns:
        List of dicts with ranking data
    """
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT
            COALESCE(s.qid_wikidata, s.ext_id_bundestagsverwaltung, s.speaker_id::text) as canonical_mp_id,
            s.name as mp_name,
            p_current.name as current_party,
            wp.wahlperiode,
            COUNT(DISTINCT w.word_id) as new_words_count,
            MIN(w.first_date) as first_word_date,
            MAX(w.first_date) as last_word_date,
            json_agg(DISTINCT jsonb_build_object(
                'word', w.word,
                'date', w.first_date,
                'protocol_id', w.first_protocol_id
            ) ORDER BY w.first_date DESC) FILTER (WHERE w.word_id IS NOT NULL) as sample_words
        FROM words w
        JOIN speakers s ON w.first_speaker_id = s.speaker_id
        JOIN protocols wp ON w.first_protocol_id = wp.id
        LEFT JOIN parties p_current ON s.party_id = p_current.party_id
        WHERE
            w.first_date >= '2015-01-01'
            AND w.first_speaker_id IS NOT NULL
    """

    params = []

    if wahlperiode:
        query += " AND wp.wahlperiode = %s"
        params.append(wahlperiode)

    if party:
        query += " AND p_current.short_name = %s"
        params.append(party)

    query += """
        GROUP BY canonical_mp_id, s.name, p_current.name, wp.wahlperiode
        ORDER BY new_words_count DESC
    """

    if limit:
        query += " LIMIT %s"
        params.append(limit)

    cursor.execute(query, params)
    results = cursor.fetchall()

    # Add ranking
    for i, result in enumerate(results, 1):
        result['rank'] = i

    cursor.close()
    return [dict(r) for r in results]
```

### Step 5: Add API Endpoints (Week 2)

**In `backend/api.py`:**

```python
# Pydantic models
class NewWordsRanking(BaseModel):
    rank: int
    canonical_mp_id: str
    mp_name: str
    current_party: Optional[str]
    wahlperiode: int
    new_words_count: int
    first_word_date: str
    last_word_date: str
    sample_words: List[Dict]

class RankingResponse(BaseModel):
    wahlperiode: Optional[int]
    party: Optional[str]
    rankings: List[NewWordsRanking]
    total_mps: int
    total_new_words: int

# Endpoint
@app.get("/api/rankings/new-words", response_model=RankingResponse)
async def get_new_words_ranking_endpoint(
    wahlperiode: Optional[int] = None,
    party: Optional[str] = None,
    limit: int = Query(default=100, le=1000)
):
    """
    Ranking der Abgeordneten nach neuen Wörtern.

    - **wahlperiode**: Optional - Filter nach Wahlperiode
    - **party**: Optional - Filter nach Partei
    - **limit**: Maximale Anzahl Ergebnisse (max 1000)
    """
    from database_rankings import get_new_words_ranking

    rankings = get_new_words_ranking(wahlperiode, party, limit)

    total_mps = len(rankings)
    total_new_words = sum(r['new_words_count'] for r in rankings)

    return RankingResponse(
        wahlperiode=wahlperiode,
        party=party,
        rankings=rankings,
        total_mps=total_mps,
        total_new_words=total_new_words
    )
```

### Step 6: Frontend Integration (Week 3)

**New file:** `frontend/src/components/NewWordsRanking.jsx`

Display ranking table with:
- Rank
- MP name (link to speaker page)
- Party
- New words count
- Sample words (expandable)
- Filters for Wahlperiode and party

---

## Testing Plan

1. Test Wikidata ID extraction from OPTV
2. Test Abgeordnetenwatch API integration
3. Test deduplication logic
4. Verify ranking calculations
5. Performance test with materialized views

---

## Timeline

**Week 1:**
- Days 1-2: Enhance OPTV to extract Wikidata IDs
- Days 3-5: Integrate Abgeordnetenwatch API
- Days 6-7: Database migration and deduplication

**Week 2:**
- Days 1-3: Implement ranking queries
- Days 4-5: Create API endpoints
- Days 6-7: Testing and optimization

**Week 3:**
- Days 1-4: Frontend implementation
- Days 5-7: End-to-end testing and documentation

---

## Alternative Approaches Considered

### 1. Name Matching Only
**Rejected:** Too many false positives, doesn't handle name changes

### 2. Bundestag Official API Only
**Rejected:** Complex integration, may not cover all historical data

### 3. Manual ID Mapping
**Rejected:** Not scalable, requires ongoing maintenance

---

## Sources

- [OpenParliamentTV API Documentation](https://de.openparliament.tv/api/)
- [Abgeordnetenwatch API Documentation](https://www.abgeordnetenwatch.de/api)
- [Abgeordnetenwatch Entity: Politician](https://www.abgeordnetenwatch.de/api/entitaeten/politician)
- [GitHub - demokratie-live/bundestag.io](https://github.com/demokratie-live/bundestag.io)
- [PublicAPI - Deutscher Bundestag DIP API](https://publicapi.dev/deutscher-bundestag-dip-api)

---

## Next Steps

1. Review and approve this plan
2. Begin Phase 1 (OPTV Wikidata extraction)
3. Set up Abgeordnetenwatch API integration
4. Implement database migrations
5. Create ranking queries and API endpoints
6. Build frontend components

**Estimated Total Time:** 3 weeks full implementation
**Quick Win (Phase 1 only):** 2-3 days
