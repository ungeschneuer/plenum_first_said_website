# Optimierungsmöglichkeiten - PostgreSQL Stack

Stand: 2026-02-09
Datenbank: 109.776 Wörter, 607.594 Vorkommen, 84 verarbeitete Protokolle

## 1. Processing-Optimierungen

### 1.1 Parallele Protokoll-Verarbeitung
**Status:** Nicht implementiert
**Potential:** 3-5x schneller bei Multi-Core CPUs

**Implementierung:**
```python
# backend/process_protocols_parallel.py
from multiprocessing import Pool
import os

def process_protocol_worker(protocol):
    """Worker function für parallele Verarbeitung"""
    return process_single_protocol(protocol)

def process_protocols_parallel(protocols, workers=None):
    """Verarbeite mehrere Protokolle parallel"""
    if workers is None:
        workers = os.cpu_count() - 1  # Einen Core freilassen

    with Pool(workers) as pool:
        results = pool.map(process_protocol_worker, protocols)

    return results
```

**Vorteile:**
- 4 Protokolle parallel statt sequenziell
- CPU-Auslastung von ~25% auf ~100%
- Geschätzte Zeit für 100 Protokolle: 15 Min. statt 60 Min.

### 1.2 Batch-Insert mit COPY
**Status:** Nutzt execute_values (gut), aber COPY wäre schneller
**Potential:** 2-3x schneller für bulk inserts

**Implementierung:**
```python
import io
import csv

def bulk_insert_with_copy(words_data):
    """Nutze PostgreSQL COPY für maximum speed"""
    with DatabaseConnection() as conn:
        cursor = conn.cursor()

        # Erstelle CSV in-memory
        output = io.StringIO()
        writer = csv.writer(output)
        for word_data in words_data:
            writer.writerow(word_data)

        output.seek(0)
        cursor.copy_from(output, 'word_occurrences',
                        columns=['word_id', 'protocol_id', 'count', 'date'],
                        sep=',')
```

**Vorteile:**
- COPY ist PostgreSQL's schnellster Insert-Mechanismus
- Vermeidet Query-Parsing Overhead
- Ideal für große Datenmengen (>1000 Zeilen)

### 1.3 Connection Pooling Optimization
**Status:** Implementiert (2-10 Connections)
**Verbesserung:** Pool-Size an Workload anpassen

**Empfehlung:**
```python
# Für Processing: Mehr Connections
init_connection_pool(min_conn=5, max_conn=20)

# Für API: Moderate Connections
init_connection_pool(min_conn=2, max_conn=10)
```

### 1.4 NLP Pipeline Caching
**Status:** Nicht implementiert
**Potential:** 50% schneller bei Reprocessing

**Implementierung:**
```python
from functools import lru_cache

@lru_cache(maxsize=10000)
def analyze_word_cached(word: str):
    """Cache NLP analysis results"""
    return analyze_word_nlp(word)
```

**Vorteile:**
- Wiederholte Wörter werden nicht neu analysiert
- Besonders effektiv bei Compounds und häufigen Wörtern

---

## 2. Such-Optimierungen

### 2.1 Full-Text Search Index
**Status:** Basis vorhanden (search_vector), aber nicht genutzt
**Potential:** 10-50x schneller für komplexe Suchen

**Aktuell:** Trigram-Suche mit ILIKE
```sql
WHERE w.word ILIKE %s OR w.gendered_lemma %% %s
```

**Optimiert:** Full-Text Search
```sql
WHERE w.search_vector @@ to_tsquery('german', %s)
```

**Implementierung:**
```sql
-- Trigger für automatische Updates
CREATE OR REPLACE FUNCTION words_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('german', COALESCE(NEW.word, '')), 'A') ||
        setweight(to_tsvector('german', COALESCE(NEW.gendered_lemma, '')), 'B') ||
        setweight(to_tsvector('german', COALESCE(NEW.base_lemma, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER words_search_vector_trigger
    BEFORE INSERT OR UPDATE ON words
    FOR EACH ROW
    EXECUTE FUNCTION words_search_vector_update();
```

**Performance-Vergleich:**
- ILIKE: ~32ms (aktuell)
- Trigram: ~15ms (mit Index)
- Full-Text: ~2-5ms (optimal)

### 2.2 Materialized View für häufige Suchen
**Status:** Views vorhanden, aber nicht für Suche genutzt
**Potential:** Instant results für Top-Queries

**Implementierung:**
```sql
-- Top 1000 meistgesuchte Wörter
CREATE MATERIALIZED VIEW popular_words AS
SELECT
    w.word,
    w.word_id,
    COUNT(wo.id) as occurrence_count,
    SUM(wo.count) as total_mentions,
    MIN(p.datum) as first_use,
    MAX(p.datum) as last_use
FROM words w
JOIN word_occurrences wo ON w.word_id = wo.word_id
JOIN protocols p ON wo.protocol_id = p.id
GROUP BY w.word_id
ORDER BY total_mentions DESC
LIMIT 1000;

CREATE INDEX idx_popular_words_word ON popular_words(word);
```

**Refresh-Strategie:**
```sql
-- Täglich oder nach Processing
REFRESH MATERIALIZED VIEW CONCURRENTLY popular_words;
```

### 2.3 Partitionierung für große Datenmengen
**Status:** Nicht implementiert
**Potential:** Relevant bei >1M Wörtern

**Implementierung:**
```sql
-- Partitioniere word_occurrences nach Wahlperiode
CREATE TABLE word_occurrences_partitioned (
    id SERIAL,
    word_id INTEGER,
    protocol_id TEXT,
    count INTEGER,
    date DATE,
    wahlperiode INTEGER  -- Neues Feld
) PARTITION BY RANGE (wahlperiode);

-- Partitionen
CREATE TABLE word_occurrences_wp16 PARTITION OF word_occurrences_partitioned
    FOR VALUES FROM (16) TO (17);
CREATE TABLE word_occurrences_wp17 PARTITION OF word_occurrences_partitioned
    FOR VALUES FROM (17) TO (18);
-- etc.
```

**Vorteile:**
- Schnellere Queries pro Wahlperiode
- Einfacheres Archivieren alter Daten
- Bessere Maintenance

### 2.4 Query-Optimierung
**Status:** Queries funktional, aber nicht optimal

**Aktuell:**
```python
cursor.execute("""
    SELECT SUM(count) FROM word_occurrences
    WHERE word_id = (SELECT word_id FROM words WHERE word = %s)
""", (word,))
```

**Optimiert:**
```python
cursor.execute("""
    SELECT SUM(wo.count)
    FROM word_occurrences wo
    WHERE wo.word_id = %s
""", (word_id,))
```

**Weitere Optimierungen:**
- Vermeidung von Subqueries wo möglich
- Nutzung von JOINs statt IN-Clauses
- EXPLAIN ANALYZE für langsame Queries

---

## 3. Darstellungs-Optimierungen

### 3.1 API Pagination
**Status:** Nicht implementiert
**Potential:** 10-100x schnellere Ladezeiten für große Listen

**Aktuell:** Alle Protokolle auf einmal
```python
protocols = get_wahlperiode_protocols(16)  # 94 Protokolle
```

**Optimiert:** Pagination
```python
def get_wahlperiode_protocols(wp_number: int, page: int = 1, per_page: int = 20):
    offset = (page - 1) * per_page
    cursor.execute("""
        SELECT ... FROM protocols
        WHERE wahlperiode = %s
        ORDER BY protokollnummer
        LIMIT %s OFFSET %s
    """, (wp_number, per_page, offset))
```

**API Endpoint:**
```python
@app.get("/api/wahlperiode/{wp_number}/protokolle")
async def get_protocols(
    wp_number: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100)
):
    protocols = get_wahlperiode_protocols(wp_number, page, per_page)
    total = get_protocol_count_for_wp(wp_number)

    return {
        "data": protocols,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page
        }
    }
```

### 3.2 Response Caching
**Status:** Nicht implementiert
**Potential:** 100-1000x schneller für häufige Queries

**Option 1: Redis Cache**
```python
import redis
import json

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def get_word_timeline_cached(word: str):
    cache_key = f"timeline:{word}"

    # Check cache
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Fetch from DB
    timeline = get_word_timeline(word)

    # Cache for 1 hour
    redis_client.setex(cache_key, 3600, json.dumps(timeline))

    return timeline
```

**Option 2: HTTP Caching Headers**
```python
@app.get("/api/words/{word}/timeline")
async def get_timeline(word: str, response: Response):
    timeline = get_word_timeline(word)

    # Cache for 1 hour
    response.headers["Cache-Control"] = "public, max-age=3600"
    response.headers["ETag"] = hashlib.md5(
        json.dumps(timeline).encode()
    ).hexdigest()

    return timeline
```

### 3.3 API Response Compression
**Status:** Nicht implementiert
**Potential:** 5-10x kleinere Responses

**Implementierung:**
```python
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)
```

**Vorteile:**
- Timeline mit 84 Punkten: 15KB → 2KB
- Protokoll-Liste: 50KB → 5KB
- Schnellere Übertragung, besonders auf Mobile

### 3.4 Frontend: Virtual Scrolling
**Status:** Nicht implementiert
**Potential:** Smooth scrolling bei 1000+ Items

**Aktuell:** Rendert alle 94 Protokolle auf einmal

**Optimiert:** react-virtual
```jsx
import { useVirtual } from 'react-virtual';

function ProtocolTable({ protocols }) {
  const parentRef = useRef();

  const rowVirtualizer = useVirtual({
    size: protocols.length,
    parentRef,
    estimateSize: useCallback(() => 50, []),
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${rowVirtualizer.totalSize}px` }}>
        {rowVirtualizer.virtualItems.map(virtualRow => (
          <ProtocolRow
            key={virtualRow.index}
            protocol={protocols[virtualRow.index]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

**Vorteile:**
- Rendert nur sichtbare Zeilen (10-20 statt 1000+)
- Konstante Performance unabhängig von Datenmenge
- Smooth Scrolling auch bei 10.000+ Items

### 3.5 Lazy Loading für Charts
**Status:** Nicht implementiert
**Potential:** 2-3x schnelleres Initial Page Load

**Implementierung:**
```jsx
import { lazy, Suspense } from 'react';

const Chart = lazy(() => import('./components/Chart'));

function WordTimeline({ word }) {
  return (
    <Suspense fallback={<div>Lade Chart...</div>}>
      <Chart data={timelineData} />
    </Suspense>
  );
}
```

### 3.6 Database Query Result Streaming
**Status:** Nicht implementiert
**Potential:** Keine Wartezeit auf große Ergebnismengen

**Implementierung:**
```python
from fastapi.responses import StreamingResponse
import json

async def stream_protocols(wp_number: int):
    with DatabaseConnection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT * FROM protocols
            WHERE wahlperiode = %s
            ORDER BY protokollnummer
        """, (wp_number,))

        yield "["
        first = True

        for row in cursor:
            if not first:
                yield ","
            yield json.dumps(dict(row))
            first = False

        yield "]"

@app.get("/api/wahlperiode/{wp_number}/protokolle/stream")
async def stream_wahlperiode_protocols(wp_number: int):
    return StreamingResponse(
        stream_protocols(wp_number),
        media_type="application/json"
    )
```

---

## 4. Monitoring & Analytics

### 4.1 Query Performance Monitoring
**Implementierung:**
```sql
-- Aktiviere pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Finde langsame Queries
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 4.2 Index Usage Analysis
```sql
-- Ungenutzte Indexes finden
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

### 4.3 Table Bloat Monitoring
```sql
-- Table/Index Bloat prüfen
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 5. Priorisierung

### Quick Wins (1-2 Stunden)
1. **API Response Compression** - GZipMiddleware hinzufügen
2. **HTTP Caching Headers** - Cache-Control für statische Daten
3. **Query Optimization** - Subqueries zu JOINs umschreiben

### Medium Impact (1 Tag)
4. **Pagination** - API und Frontend
5. **Full-Text Search** - Trigger + Index nutzen
6. **Connection Pool Tuning** - An Workload anpassen

### High Impact (2-3 Tage)
7. **Redis Caching** - Für häufige Queries
8. **Virtual Scrolling** - Für große Listen
9. **Parallele Processing** - Multi-Core Nutzung

### Long-term (1 Woche+)
10. **Partitionierung** - Bei >1M Wörtern
11. **Streaming API** - Für Echtzeit-Updates
12. **Materialized Views** - Für Analytics

---

## 6. Geschätzte Performance-Verbesserungen

### Processing
- **Aktuell:** ~1 Protokoll/Minute (~100 Min. für 100 Protokolle)
- **Mit Parallel Processing:** ~4 Protokolle/Minute (~25 Min. für 100 Protokolle)
- **Mit COPY + Parallel:** ~8 Protokolle/Minute (~13 Min. für 100 Protokolle)

### Suche
- **Aktuell:** 15-32ms (Trigram + ILIKE)
- **Mit Full-Text Search:** 2-5ms
- **Mit Redis Cache:** <1ms (bei Cache-Hit)

### Darstellung
- **Aktuell:** 200-500ms für Protokoll-Liste (94 Items)
- **Mit Pagination:** 20-50ms (20 Items)
- **Mit Cache + Compression:** 5-10ms
- **Mit Virtual Scrolling:** Konstant, auch bei 10.000+ Items

---

## 7. Empfohlene nächste Schritte

1. **Sofort:** Compression + HTTP Caching (30 Min.)
2. **Diese Woche:** Pagination + Query Optimization (1 Tag)
3. **Nächste Woche:** Redis + Full-Text Search (2 Tage)
4. **Bei Bedarf:** Parallel Processing wenn viele Protokolle verarbeitet werden

**ROI:** Die ersten 3 Schritte bringen ~80% der Performance-Verbesserung mit ~20% des Aufwands.
