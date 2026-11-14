# Performance Optimizations

Comprehensive recommendations for improving processing and search performance in the Bundestag Word Tracker.

## Current System State

**Database:**
- 94 protocols processed
- 94,175 unique words (lemmatized)
- 477,995 word occurrences
- SQLite database: ~200-500 MB (estimated)
- Comprehensive indexes on key columns

**Architecture:**
- FastAPI backend (Python)
- SQLite database
- Enhanced NLP pipeline (spaCy + custom dictionary + compound splitting)
- React frontend with Chart.js

---

## 1. Processing Performance

### 1.1 NLP Pipeline Optimization

**Current Bottleneck:** Processing is slow due to per-word spaCy analysis.

**Problem:** Each word is analyzed individually with `nlp(word)`, which is inefficient for spaCy designed for batch processing.

**Solution: Batch Processing**

```python
# backend/text_processing.py - Optimized version

def count_word_frequencies_enhanced(text: str) -> Tuple[Dict[str, int], Dict[str, Dict]]:
    """Extract words with batched NLP analysis."""
    words = extract_words(text)

    if not NLP_AVAILABLE:
        normalized_words = [normalize_word(word) for word in words]
        word_counts = Counter(normalized_words)
        return dict(word_counts), {}

    # Get unique words only
    unique_words = list(set(words))

    # Batch analyze unique words (MUCH faster than one-by-one)
    nlp_data = {}

    # Process in chunks of 1000 words (spaCy optimal batch size)
    BATCH_SIZE = 1000
    for i in range(0, len(unique_words), BATCH_SIZE):
        batch = unique_words[i:i + BATCH_SIZE]

        # Join with delimiter that won't appear in text
        batch_text = "\n\n".join(batch)

        # Single spaCy call for entire batch
        doc = nlp(batch_text)

        # Process results
        for word, token in zip(batch, doc):
            analysis = analyze_word_from_token(token, word)
            nlp_data[word] = analysis

    # Count with lemmatization
    word_counts = defaultdict(int)
    for word in words:
        analysis = nlp_data.get(word, {'gendered_lemma': word.lower()})
        key = analysis.get('gendered_lemma', word.lower())
        word_counts[key] += 1

    return dict(word_counts), nlp_data
```

**Expected Improvement:** 5-10x faster processing (from ~5-10 min/protocol to ~30-60 sec/protocol)

### 1.2 Database Transaction Optimization

**Current Issue:** Individual inserts for each word occurrence.

**Solution: Batch Inserts**

```python
# backend/database.py - Add bulk insert function

def add_word_occurrences_bulk(occurrences: List[Tuple[str, str, int, str, Optional[Dict]]]):
    """
    Bulk insert word occurrences.

    Args:
        occurrences: List of (word, protocol_id, count, date, nlp_data) tuples
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Prepare all data first
    word_data = []
    occurrence_data = []

    for word, protocol_id, count, date, nlp_data in occurrences:
        word_id = get_or_create_word_id(word, protocol_id, nlp_data)
        occurrence_data.append((word_id, protocol_id, count, date))

    # Bulk insert (much faster than individual inserts)
    cursor.executemany("""
        INSERT OR REPLACE INTO word_occurrences (word_id, protocol_id, count, date)
        VALUES (?, ?, ?, ?)
    """, occurrence_data)

    conn.commit()
    conn.close()
```

**Expected Improvement:** 3-5x faster database writes

### 1.3 Parallel Protocol Processing

**Current Issue:** Sequential processing of protocols.

**Solution: Multiprocessing**

```python
# backend/process_protocols.py - Add parallel processing

from multiprocessing import Pool, cpu_count

def process_protocols_parallel(limit: Optional[int] = None):
    """Process protocols in parallel using all CPU cores."""
    protocols = get_unprocessed_protocols(limit=limit)

    # Use all CPU cores - 1 (leave one for system)
    num_workers = max(1, cpu_count() - 1)

    logging.info(f"Processing {len(protocols)} protocols with {num_workers} workers")

    with Pool(num_workers) as pool:
        results = pool.map(process_single_protocol, [p['id'] for p in protocols])

    success_count = sum(results)
    fail_count = len(results) - success_count

    logging.info(f"Complete: {success_count} successful, {fail_count} failed")
```

**Expected Improvement:** Near-linear speedup with CPU cores (4x on 4-core, 8x on 8-core)

### 1.4 Caching Strategy

**Add in-memory caching for frequently accessed data:**

```python
# backend/nlp_cache.py - NEW FILE

from functools import lru_cache

@lru_cache(maxsize=10000)
def analyze_word_cached(word: str) -> Dict:
    """Cache NLP analysis results for repeated words."""
    return analyze_word_enhanced(word)
```

**Expected Improvement:** 2-3x faster for protocols with repeated vocabulary

---

## 2. Search Performance

### 2.1 Full-Text Search Index

**Current Issue:** `LIKE '%query%'` is slow and doesn't use indexes efficiently.

**Solution: SQLite FTS5 (Full-Text Search)**

```sql
-- Create FTS5 virtual table for word search
CREATE VIRTUAL TABLE words_fts USING fts5(
    word,
    gendered_lemma,
    content='words',
    content_rowid='word_id'
);

-- Populate from words table
INSERT INTO words_fts(rowid, word, gendered_lemma)
SELECT word_id, word, gendered_lemma FROM words;

-- Create trigger to keep in sync
CREATE TRIGGER words_fts_insert AFTER INSERT ON words BEGIN
    INSERT INTO words_fts(rowid, word, gendered_lemma)
    VALUES (new.word_id, new.word, new.gendered_lemma);
END;
```

**Updated search function:**

```python
def search_words(query: str, limit: int = 20) -> List[Dict]:
    """Search using FTS5 for better performance."""
    conn = get_connection()
    cursor = conn.cursor()

    # FTS5 query syntax: "word*" for prefix match
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

**Expected Improvement:** 10-100x faster search, especially for large datasets

### 2.2 Query Optimization

**Composite Indexes for Common Queries:**

```sql
-- For word timeline queries (frequently joined)
CREATE INDEX idx_word_occurrences_word_date
ON word_occurrences(word_id, date);

-- For protocol queries with date range
CREATE INDEX idx_protocols_processed_date
ON protocols(processed, datum);

-- For speaker queries
CREATE INDEX idx_words_speaker_protocol
ON words(first_speaker_id, first_protocol_id);
```

**Optimized Timeline Query:**

```python
def get_word_timeline(word: str) -> List[Dict]:
    """Optimized timeline query with better join order."""
    conn = get_connection()
    cursor = conn.cursor()

    # Use EXPLAIN QUERY PLAN to verify index usage
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
        JOIN word_occurrences wo
        INDEXED BY idx_word_occurrences_word_date
        ON w.word_id = wo.word_id
        JOIN protocols p ON wo.protocol_id = p.id
        WHERE w.word = ?
        ORDER BY wo.date
    """, (word,))

    results = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return results
```

**Expected Improvement:** 2-5x faster timeline queries

### 2.3 API Response Caching

**Add caching for frequently requested data:**

```python
# backend/api.py - Add caching with TTL

from functools import lru_cache
from time import time

# Simple in-memory cache with TTL
_cache = {}
_cache_ttl = {}
CACHE_TTL = 300  # 5 minutes

def cached_query(key: str, ttl: int = CACHE_TTL):
    """Decorator for caching API responses."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            cache_key = f"{key}:{args}:{kwargs}"

            # Check cache
            if cache_key in _cache:
                if time() - _cache_ttl[cache_key] < ttl:
                    return _cache[cache_key]

            # Execute and cache
            result = func(*args, **kwargs)
            _cache[cache_key] = result
            _cache_ttl[cache_key] = time()

            return result
        return wrapper
    return decorator

@app.get("/api/words/search")
@cached_query("search", ttl=60)  # Cache searches for 1 minute
async def search_words_endpoint(q: str, limit: int = 20):
    # ... existing code
```

**Expected Improvement:** Near-instant responses for repeated queries

### 2.4 Database Connection Pooling

**Current Issue:** Creating new connection for each query.

**Solution: Connection Pool**

```python
# backend/database.py - Add connection pooling

from queue import Queue
from threading import Lock

class ConnectionPool:
    def __init__(self, db_path: str, pool_size: int = 5):
        self.db_path = db_path
        self.pool = Queue(maxsize=pool_size)
        self.lock = Lock()

        # Pre-create connections
        for _ in range(pool_size):
            conn = sqlite3.connect(db_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            self.pool.put(conn)

    def get_connection(self):
        """Get connection from pool."""
        return self.pool.get()

    def return_connection(self, conn):
        """Return connection to pool."""
        self.pool.put(conn)

    def __enter__(self):
        self.conn = self.get_connection()
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.return_connection(self.conn)

# Global pool instance
_pool = ConnectionPool(DB_PATH, pool_size=10)

def get_connection():
    """Get a database connection from pool."""
    return _pool.get_connection()
```

**Expected Improvement:** 20-30% faster API response times

---

## 3. Frontend Performance

### 3.1 API Request Debouncing

**Current:** Already implemented (300ms debounce)

**Optimization:** Add request cancellation for rapid typing:

```javascript
// frontend/src/utils/api.js

let abortController = null;

export const searchWords = async (query, limit = 20) => {
    // Cancel previous request if still pending
    if (abortController) {
        abortController.abort();
    }

    abortController = new AbortController();

    try {
        const response = await fetch(
            `${API_URL}/words/search?q=${query}&limit=${limit}`,
            { signal: abortController.signal }
        );

        abortController = null;
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            return null; // Request was cancelled
        }
        throw error;
    }
};
```

### 3.2 Virtual Scrolling for Large Result Sets

**For displaying 1000+ results efficiently:**

```javascript
// Use react-window for virtual scrolling
import { FixedSizeList } from 'react-window';

const ResultsList = ({ results }) => {
    const Row = ({ index, style }) => (
        <div style={style}>
            {results[index].word}
        </div>
    );

    return (
        <FixedSizeList
            height={600}
            itemCount={results.length}
            itemSize={40}
            width="100%"
        >
            {Row}
        </FixedSizeList>
    );
};
```

### 3.3 Chart Data Optimization

**Current Issue:** Sending all data points for every chart.

**Solution: Data point reduction for large datasets:**

```python
# backend/api.py - Add data aggregation

@app.get("/api/words/{word}/timeline")
async def get_word_timeline_endpoint(
    word: str,
    resolution: str = Query("auto", regex="^(auto|day|week|month|year)$")
):
    """
    Get timeline with optional aggregation for better performance.

    - resolution: Data point density (auto adjusts based on data)
    """
    timeline_data = get_word_timeline(word)

    if not timeline_data:
        raise HTTPException(status_code=404, detail=f"Wort '{word}' nicht gefunden")

    # If too many data points, aggregate by week/month
    if len(timeline_data) > 200 and resolution == "auto":
        timeline_data = aggregate_by_week(timeline_data)

    # ... rest of processing
```

---

## 4. Database Maintenance

### 4.1 Regular VACUUM

**Add periodic database optimization:**

```python
# backend/maintenance.py - NEW FILE

import schedule
import time
from database import get_connection

def vacuum_database():
    """Optimize database by reclaiming space and rebuilding indexes."""
    conn = get_connection()
    conn.execute("VACUUM")
    conn.execute("ANALYZE")
    conn.close()
    logging.info("Database vacuumed and analyzed")

def run_maintenance():
    """Run maintenance tasks."""
    # Schedule weekly VACUUM
    schedule.every().sunday.at("03:00").do(vacuum_database)

    while True:
        schedule.run_pending()
        time.sleep(3600)  # Check every hour
```

### 4.2 Database Statistics

**Update SQLite statistics for query optimizer:**

```sql
-- Run after bulk data changes
ANALYZE;
```

**Expected Improvement:** Better query plans, 10-20% faster queries

---

## 5. Migration to PostgreSQL (Future)

**When to Migrate:** When dataset exceeds 1M words or 10,000 protocols.

**Benefits:**
- Better concurrency
- Advanced indexing (GiST, GIN for full-text)
- Materialized views
- Better performance at scale

**Migration Strategy:**

```python
# backend/database_postgres.py - Future implementation

# Use PostgreSQL-specific features:
# 1. COPY for bulk inserts (10x faster than INSERT)
# 2. pg_trgm for fuzzy search
# 3. Materialized views for aggregated stats
# 4. Partitioning by wahlperiode

CREATE INDEX words_trgm_idx ON words USING gin (word gin_trgm_ops);
```

---

## 6. Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. Add FTS5 for word search
2. Implement API response caching
3. Add composite indexes
4. Optimize timeline query

**Expected Result:** 5-10x faster search, 2-3x faster API

### Phase 2: Processing Optimization (2-3 days)
1. Batch NLP processing
2. Bulk database inserts
3. Add NLP result caching

**Expected Result:** 5-10x faster protocol processing

### Phase 3: Advanced Features (1 week)
1. Parallel processing
2. Connection pooling
3. Frontend virtual scrolling
4. Data aggregation for charts

**Expected Result:** 2-4x faster overall, supports larger datasets

### Phase 4: Infrastructure (1-2 weeks, optional)
1. PostgreSQL migration
2. Redis caching layer
3. Background job queue
4. Monitoring and metrics

**Expected Result:** Production-ready, scales to millions of words

---

## 7. Monitoring & Profiling

### 7.1 Add Performance Logging

```python
# backend/performance.py - NEW FILE

import time
import logging
from functools import wraps

def timing_decorator(func):
    """Log execution time of functions."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        duration = time.perf_counter() - start

        logging.info(f"{func.__name__} took {duration:.2f}s")
        return result

    return wrapper

# Apply to slow functions
@timing_decorator
def process_single_protocol(protocol_id: str):
    # ... existing code
```

### 7.2 Query Profiling

```python
# Enable SQLite query logging
import sqlite3

def dict_factory(cursor, row):
    """Row factory that also logs slow queries."""
    duration = ...  # Track query time
    if duration > 1.0:  # Log queries > 1 second
        logging.warning(f"Slow query: {duration:.2f}s")

    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d
```

---

## 8. Estimated Performance Improvements

### Current Performance (Baseline)
- Protocol processing: ~5-10 min/protocol
- Word search: 100-500ms
- Timeline query: 200-800ms
- API response: 300-1000ms

### After Phase 1 (Quick Wins)
- Protocol processing: ~5-10 min/protocol (unchanged)
- Word search: **10-50ms** (10x faster)
- Timeline query: **50-200ms** (4x faster)
- API response: **50-200ms** (5x faster)

### After Phase 2 (Processing)
- Protocol processing: **30-60 sec/protocol** (10x faster)
- Word search: 10-50ms
- Timeline query: 50-200ms
- API response: 50-200ms

### After Phase 3 (Advanced)
- Protocol processing: **10-20 sec/protocol** (30x faster with parallel)
- Word search: **5-20ms** (20x faster)
- Timeline query: **20-100ms** (10x faster)
- API response: **20-100ms** (15x faster)

---

## 9. Resource Requirements

### Current Setup
- CPU: 1-2 cores utilized
- RAM: ~200-500 MB
- Disk: ~500 MB (database + XML archive)

### After Optimizations
- CPU: 4-8 cores utilized (parallel processing)
- RAM: ~1-2 GB (caching + connection pool)
- Disk: ~1-2 GB (indexes + FTS)

### Production Setup (PostgreSQL)
- CPU: 4-8 cores
- RAM: 4-8 GB
- Disk: 5-10 GB (with backups)

---

## 10. Next Steps

1. **Benchmark current performance** - Establish baseline metrics
2. **Implement Phase 1** - Quick wins for immediate improvement
3. **Profile and measure** - Verify improvements
4. **Iterate** - Continue through phases based on needs
5. **Monitor in production** - Track performance over time

Run benchmarks with:
```bash
# Test protocol processing
uv run python backend/benchmark_processing.py

# Test search performance
uv run python backend/benchmark_search.py
```
