# Performance Quick Wins

Fast, high-impact optimizations you can implement in 1-2 hours.

## 1. Add FTS5 Full-Text Search (30 minutes)

### Why
- 10-100x faster search queries
- Supports prefix matching, ranking, and fuzzy search
- No code changes needed beyond database setup

### Implementation

**Step 1: Create migration script**

Create `backend/migrate_fts5.py`:

```python
"""Add FTS5 full-text search index for words."""
import sqlite3
from database import DB_PATH

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Creating FTS5 table...")

    # Create FTS5 virtual table
    cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS words_fts USING fts5(
            word,
            gendered_lemma,
            content='words',
            content_rowid='word_id',
            tokenize='unicode61'
        )
    """)

    # Populate from words table
    print("Populating FTS5 table...")
    cursor.execute("""
        INSERT INTO words_fts(rowid, word, gendered_lemma)
        SELECT word_id, word, COALESCE(gendered_lemma, word) FROM words
    """)

    # Create triggers to keep in sync
    print("Creating sync triggers...")

    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS words_fts_insert
        AFTER INSERT ON words BEGIN
            INSERT INTO words_fts(rowid, word, gendered_lemma)
            VALUES (new.word_id, new.word, COALESCE(new.gendered_lemma, new.word));
        END
    """)

    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS words_fts_update
        AFTER UPDATE ON words BEGIN
            UPDATE words_fts
            SET word = new.word,
                gendered_lemma = COALESCE(new.gendered_lemma, new.word)
            WHERE rowid = new.word_id;
        END
    """)

    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS words_fts_delete
        AFTER DELETE ON words BEGIN
            DELETE FROM words_fts WHERE rowid = old.word_id;
        END
    """)

    conn.commit()
    conn.close()

    print("FTS5 migration complete!")

if __name__ == "__main__":
    migrate()
```

**Step 2: Run migration**

```bash
uv run python backend/migrate_fts5.py
```

**Step 3: Update search function**

In `backend/database.py`, replace `search_words()`:

```python
def search_words(query: str, limit: int = 20) -> List[Dict]:
    """Search for words using FTS5."""
    conn = get_connection()
    cursor = conn.cursor()

    # Use FTS5 for fast prefix search
    cursor.execute("""
        SELECT w.word, w.word_id, w.gender, w.pos_tag,
               COUNT(wo.id) as occurrence_count
        FROM words_fts fts
        JOIN words w ON fts.rowid = w.word_id
        LEFT JOIN word_occurrences wo ON w.word_id = wo.word_id
        WHERE words_fts MATCH ?
        GROUP BY w.word_id
        ORDER BY w.word
        LIMIT ?
    """, (f"{query}*", limit))

    results = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return results
```

**Expected Result:** Search queries 10-100x faster

---

## 2. Add Composite Indexes (10 minutes)

### Why
- Speeds up JOIN queries by 2-5x
- Optimizes ORDER BY operations
- No code changes required

### Implementation

Create `backend/add_indexes.py`:

```python
"""Add composite indexes for common queries."""
import sqlite3
from database import DB_PATH

def add_indexes():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    indexes = [
        # Timeline queries (word + date)
        "CREATE INDEX IF NOT EXISTS idx_word_occurrences_word_date ON word_occurrences(word_id, date)",

        # Protocol queries (processed + date)
        "CREATE INDEX IF NOT EXISTS idx_protocols_processed_date ON protocols(processed, datum)",

        # Speaker + protocol lookups
        "CREATE INDEX IF NOT EXISTS idx_words_speaker_protocol ON words(first_speaker_id, first_protocol_id)",

        # Wahlperiode + protocol number (common filter)
        "CREATE INDEX IF NOT EXISTS idx_protocols_wp_num ON protocols(wahlperiode, protokollnummer)",
    ]

    for idx_sql in indexes:
        print(f"Creating index: {idx_sql.split('ON')[0].strip()}...")
        cursor.execute(idx_sql)

    conn.commit()
    conn.close()

    print("\nIndexes created successfully!")
    print("Run ANALYZE to update query planner statistics:")
    print("  sqlite3 backend/bundestag.db 'ANALYZE'")

if __name__ == "__main__":
    add_indexes()
```

Run:

```bash
uv run python backend/add_indexes.py
sqlite3 backend/bundestag.db 'ANALYZE'
```

**Expected Result:** 2-5x faster JOIN queries

---

## 3. Add Response Caching (20 minutes)

### Why
- Near-instant response for repeated queries
- Reduces database load by 50-80%
- Easy to implement with minimal code

### Implementation

Create `backend/cache.py`:

```python
"""Simple in-memory cache with TTL."""
from time import time
from functools import wraps
from typing import Any, Callable

_cache = {}
_cache_ttl = {}

def cached(ttl: int = 300):
    """
    Cache function results with TTL (time-to-live).

    Args:
        ttl: Time to live in seconds (default 300 = 5 minutes)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            # Create cache key from function name and arguments
            cache_key = f"{func.__name__}:{args}:{kwargs}"

            # Check if cached and not expired
            if cache_key in _cache:
                if time() - _cache_ttl[cache_key] < ttl:
                    return _cache[cache_key]

            # Execute function and cache result
            result = func(*args, **kwargs)
            _cache[cache_key] = result
            _cache_ttl[cache_key] = time()

            return result

        # Add cache clearing function
        wrapper.clear_cache = lambda: (_cache.clear(), _cache_ttl.clear())

        return wrapper
    return decorator

def clear_all_caches():
    """Clear all cached data."""
    _cache.clear()
    _cache_ttl.clear()
```

**Update database.py functions:**

```python
from cache import cached

@cached(ttl=60)  # Cache for 1 minute
def search_words(query: str, limit: int = 20) -> List[Dict]:
    # ... existing code

@cached(ttl=300)  # Cache for 5 minutes
def get_word_timeline(word: str) -> List[Dict]:
    # ... existing code

@cached(ttl=300)  # Cache for 5 minutes
def get_word_details(word: str) -> Optional[Dict]:
    # ... existing code
```

**Expected Result:** 10-100x faster for repeated queries

---

## 4. Run VACUUM and ANALYZE (5 minutes)

### Why
- Reclaims unused space
- Updates query planner statistics
- Can improve query performance by 10-20%

### Implementation

```bash
# Optimize database
sqlite3 backend/bundestag.db 'VACUUM'
sqlite3 backend/bundestag.db 'ANALYZE'
```

Or create `backend/vacuum.py`:

```python
"""Optimize database."""
import sqlite3
from database import DB_PATH

def optimize():
    conn = sqlite3.connect(DB_PATH)

    print("Running VACUUM (may take a few minutes)...")
    conn.execute("VACUUM")

    print("Running ANALYZE...")
    conn.execute("ANALYZE")

    conn.close()
    print("Database optimized!")

if __name__ == "__main__":
    optimize()
```

Run:

```bash
uv run python backend/vacuum.py
```

**Expected Result:** 10-20% faster queries, smaller database file

---

## 5. Optimize Timeline Query (10 minutes)

### Why
- Timeline is the most common query
- Current query does multiple table scans
- Can be 3-5x faster with better index hints

### Implementation

Replace `get_word_timeline()` in `backend/database.py`:

```python
def get_word_timeline(word: str) -> List[Dict]:
    """Get timeline data with optimized query plan."""
    conn = get_connection()
    cursor = conn.cursor()

    # Optimized query with explicit index hints
    cursor.execute("""
        SELECT
            wo.date,
            wo.count,
            p.total_words,
            p.id as protocol_id,
            p.wahlperiode,
            p.protokollnummer,
            p.titel,
            p.pdf_url
        FROM words w
        INDEXED BY idx_words_word
        JOIN word_occurrences wo ON w.word_id = wo.word_id
        JOIN protocols p ON wo.protocol_id = p.id
        WHERE w.word = ?
        ORDER BY wo.date
    """, (word,))

    results = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return results
```

**Expected Result:** 3-5x faster timeline queries

---

## Implementation Checklist

1. [ ] Add FTS5 full-text search
2. [ ] Add composite indexes
3. [ ] Add response caching
4. [ ] Run VACUUM and ANALYZE
5. [ ] Optimize timeline query
6. [ ] Run benchmarks to verify improvements

## Verification

Run benchmarks before and after:

```bash
# Before optimizations
uv run python backend/benchmark_search.py > before.txt

# After optimizations
uv run python backend/benchmark_search.py > after.txt

# Compare results
diff before.txt after.txt
```

Expected improvements:
- Search: 10-100x faster
- Timeline: 3-5x faster
- Overall API: 5-15x faster

---

## Troubleshooting

### FTS5 not available
```bash
# Check SQLite version (need 3.9.0+)
sqlite3 --version

# Check FTS5 support
sqlite3 backend/bundestag.db "SELECT * FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'"
```

If FTS5 is not available, use FTS4 instead (change `fts5` to `fts4` in migration).

### Cache using too much memory

Reduce TTL or clear cache periodically:

```python
# In api.py startup
from cache import clear_all_caches
import schedule

# Clear cache every hour
schedule.every().hour.do(clear_all_caches)
```

### Indexes not being used

Check query plan:

```sql
EXPLAIN QUERY PLAN
SELECT ... FROM words WHERE word LIKE 'bund%';
```

Look for "USING INDEX" in output.

---

## Next Steps

After implementing these quick wins:

1. Measure performance improvements
2. Review PERFORMANCE_OPTIMIZATIONS.md for Phase 2
3. Implement batch processing for protocol ingestion
4. Add parallel processing for multiple protocols

See PERFORMANCE_OPTIMIZATIONS.md for complete roadmap.
