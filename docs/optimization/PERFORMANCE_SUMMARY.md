# Performance Optimization Summary

Quick reference for improving Bundestag Word Tracker performance.

## Current Performance (Baseline)

**Database:**
- 94 protocols processed
- 94,175 unique words
- 477,995 word occurrences
- SQLite database (~500 MB)

**Speed:**
- Protocol processing: 5-10 minutes per protocol
- Word search: 100-500ms
- Timeline query: 200-800ms
- API response: 300-1000ms

## Performance Goals

### Phase 1: Quick Wins (1-2 hours)
**Target:** 5-10x faster search, 2-3x faster API

- Add FTS5 full-text search index
- Add composite indexes for common queries
- Implement response caching
- Optimize timeline queries
- Run VACUUM and ANALYZE

### Phase 2: Processing Optimization (2-3 days)
**Target:** 5-10x faster protocol processing

- Batch NLP processing (process unique words once)
- Bulk database inserts (batch transactions)
- NLP result caching (in-memory cache)
- Connection pooling

### Phase 3: Advanced Features (1 week)
**Target:** 2-4x additional speedup, support for larger datasets

- Parallel protocol processing (multiprocessing)
- Virtual scrolling in frontend
- Data aggregation for large timelines
- Database partitioning

## Key Bottlenecks Identified

### 1. Search Performance
**Problem:** `LIKE '%query%'` scans entire table
**Solution:** FTS5 full-text search index
**Impact:** 10-100x faster search

### 2. NLP Processing
**Problem:** Per-word spaCy analysis (inefficient)
**Solution:** Batch processing of unique words
**Impact:** 5-10x faster processing

### 3. Database Writes
**Problem:** Individual INSERT for each word
**Solution:** Bulk INSERT with executemany()
**Impact:** 3-5x faster writes

### 4. Repeated Queries
**Problem:** Same queries executed multiple times
**Solution:** In-memory caching with TTL
**Impact:** Near-instant repeated queries

### 5. JOIN Performance
**Problem:** Missing composite indexes
**Solution:** Add word_id+date, wp+protocol indexes
**Impact:** 2-5x faster JOINs

## Quick Start

### 1. Run Current Benchmarks

```bash
# Benchmark search performance
uv run python backend/benchmark_search.py > results_before.txt

# Benchmark processing (if XML files available)
uv run python backend/benchmark_processing.py
```

### 2. Implement Quick Wins

Follow the checklist in `QUICK_WINS.md`:

```bash
# 1. Add FTS5 search
uv run python backend/migrate_fts5.py

# 2. Add composite indexes
uv run python backend/add_indexes.py

# 3. Optimize database
uv run python backend/vacuum.py

# 4. Add caching (code changes in database.py)
# See QUICK_WINS.md for details
```

### 3. Verify Improvements

```bash
# Run benchmarks again
uv run python backend/benchmark_search.py > results_after.txt

# Compare
diff results_before.txt results_after.txt
```

Expected: 5-10x improvement in search speed

## Implementation Priority

### Immediate (High Impact, Low Effort)
1. FTS5 full-text search - 30 min
2. Composite indexes - 10 min
3. VACUUM/ANALYZE - 5 min
4. Response caching - 20 min
5. Timeline query optimization - 10 min

**Total time:** ~1.5 hours
**Expected improvement:** 5-10x faster search, 2-3x faster API

### Short Term (High Impact, Medium Effort)
1. Batch NLP processing - 4 hours
2. Bulk database inserts - 2 hours
3. NLP result caching - 2 hours
4. Connection pooling - 2 hours

**Total time:** 1-2 days
**Expected improvement:** 5-10x faster processing

### Medium Term (Medium Impact, High Effort)
1. Parallel processing - 1 week
2. PostgreSQL migration - 1-2 weeks
3. Redis caching layer - 1 week
4. Background job queue - 1 week

**Total time:** 1-2 months
**Expected improvement:** Production-ready, scales to millions of words

## Expected Results by Phase

### After Phase 1 (Quick Wins)
- Protocol processing: 5-10 min/protocol (unchanged)
- Word search: **10-50ms** (10x faster)
- Timeline query: **50-200ms** (4x faster)
- API response: **50-200ms** (5x faster)

### After Phase 2 (Processing)
- Protocol processing: **30-60 sec/protocol** (10x faster)
- Word search: 10-50ms
- Timeline query: 50-200ms
- API response: 50-200ms

### After Phase 3 (Advanced)
- Protocol processing: **10-20 sec/protocol** (30x faster)
- Word search: **5-20ms** (20x faster)
- Timeline query: **20-100ms** (10x faster)
- API response: **20-100ms** (15x faster)

## Resource Requirements

### Current
- CPU: 1-2 cores
- RAM: 200-500 MB
- Disk: 500 MB

### After Optimizations
- CPU: 4-8 cores (if using parallel processing)
- RAM: 1-2 GB (caching + connection pool)
- Disk: 1-2 GB (indexes + FTS)

### Production (PostgreSQL)
- CPU: 4-8 cores
- RAM: 4-8 GB
- Disk: 5-10 GB

## Files Reference

- **PERFORMANCE_OPTIMIZATIONS.md** - Complete technical details and implementation
- **QUICK_WINS.md** - Step-by-step guide for high-priority optimizations
- **backend/benchmark_search.py** - Search performance benchmarking tool
- **backend/benchmark_processing.py** - Processing performance benchmarking tool

## Common Issues

### FTS5 not available
SQLite version too old. Upgrade to 3.9.0+ or use FTS4 instead.

### Memory usage increasing
Cache is growing. Add periodic cache clearing or reduce TTL.

### Indexes not used
Run ANALYZE to update query planner statistics:
```bash
sqlite3 backend/bundestag.db 'ANALYZE'
```

### Slow processing after optimization
Check spaCy is installed correctly:
```bash
uv pip list | grep spacy
uv run python -c "import spacy; nlp = spacy.load('de_core_news_sm'); print('OK')"
```

## Monitoring Recommendations

After implementing optimizations:

1. **Log slow queries** - Track queries taking > 1 second
2. **Monitor cache hit rate** - Should be 60-80% for good caching
3. **Track processing throughput** - Protocols/hour, words/second
4. **Database size growth** - Monitor disk usage over time
5. **API response times** - p50, p95, p99 percentiles

## Next Steps

1. Read **QUICK_WINS.md** for immediate improvements
2. Run benchmarks to establish baseline
3. Implement Phase 1 optimizations
4. Measure and verify improvements
5. Review **PERFORMANCE_OPTIMIZATIONS.md** for Phase 2

## Questions?

Check the detailed documentation:
- Technical details: PERFORMANCE_OPTIMIZATIONS.md
- Implementation guide: QUICK_WINS.md
- Architecture overview: ARCHITECTURE.md
- Project memory: .claude/projects/.../memory/MEMORY.md
