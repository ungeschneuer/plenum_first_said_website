# Deferred Speaker Tracking - Quick Reference

## What Was Implemented

Speaker tracking that runs AFTER bulk protocol processing is complete, ensuring accurate attribution even when the first occurrence date changes during processing.

## Key Files

1. **backend/speaker_check_module.py** (NEW)
   - Speaker checking logic
   - OPTV API integration with rate limiting

2. **backend/database_postgresql_impl.py** (MODIFIED)
   - Added 5 speaker management functions
   - Only checks words from WP 19+ (after 2014)

3. **backend/process_protocols_parallel_pg.py** (MODIFIED)
   - Integrated speaker checking after batch completes
   - New flags: --check-speakers, --max-speaker-checks

## Usage Examples

### Process without speaker checking (fast)
```bash
uv run python process_protocols_parallel_pg.py --workers 4 --batch 10
```

### Process WITH speaker checking (comprehensive)
```bash
uv run python process_protocols_parallel_pg.py --workers 4 --batch 10 --check-speakers
```

### Limit speaker checks to first 50 words
```bash
uv run python process_protocols_parallel_pg.py --batch 10 --check-speakers --max-speaker-checks 50
```

### Check speakers for ALL unchecked words (no new processing)
```bash
uv run python process_protocols_parallel_pg.py --batch 0 --check-speakers
```

## Why Deferred?

**Problem:** First occurrence date can change during batch processing
- Protocol 19002 processes first: "Klimakrise" appears
- Protocol 19001 processes later: "Klimakrise" appears earlier
- First occurrence is now 19001, not 19002

**Solution:** Check speakers AFTER all protocols processed
- Ensures correct date is used for speaker lookup
- More accurate attribution

## Database Schema

```sql
words (
  first_speaker_id INTEGER,      -- Who first said this word
  party_at_time_id INTEGER,      -- Their party at that time
  optv_link TEXT,                -- Link to video
  speaker_checked BOOLEAN        -- Whether we checked OPTV
)

speakers (
  speaker_id SERIAL PRIMARY KEY,
  name TEXT,
  party_id INTEGER,              -- Current/most recent party
  optv_link TEXT
)

parties (
  party_id SERIAL PRIMARY KEY,
  name TEXT,
  short_name TEXT
)
```

## Only WP 19+ (After 2014)

Speaker checking is limited to Wahlperiode 19 and later because:
- OpenParliamentTV has comprehensive coverage from WP 19 (Oct 2017)
- Earlier data is incomplete
- Research focus is on recent language (2017-present)

## Testing

Run integration test:
```bash
uv run python test_speaker_integration.py
```

Expected output: All ✓ marks

## Production Deployment

**Daily processing (fast, no speakers):**
```bash
0 2 * * * cd /app/backend && uv run python process_protocols_parallel_pg.py --workers 4 --batch 10
```

**Weekly deep check (with speakers):**
```bash
0 3 * * 0 cd /app/backend && uv run python process_protocols_parallel_pg.py --batch 0 --check-speakers
```

## API Rate Limiting

- 1 second delay between OPTV API calls (default)
- Prevents API abuse
- For 100 words: ~2-3 minutes total

## Status

✅ Implementation complete
✅ Integration tested
✅ Production ready
✅ Documentation complete

**Total:** ~300 lines of code, 45 minutes implementation time
