# MP Ranking Testing Guide

Quick guide to test the MP new words ranking feature.

## Test All Endpoints

```bash
# 1. Statistics
curl http://localhost:8000/api/rankings/statistik | python3 -m json.tool

# 2. Per-Wahlperiode ranking
curl "http://localhost:8000/api/rankings/neue-woerter?limit=10" | python3 -m json.tool

# 3. Overall ranking
curl "http://localhost:8000/api/rankings/neue-woerter/gesamt?limit=10" | python3 -m json.tool

# 4. With filters
curl "http://localhost:8000/api/rankings/neue-woerter?wahlperiode=19&party=SPD" | python3 -m json.tool
```

## Expected Results (No Data Yet)

All endpoints should return HTTP 200 with empty results:
- `total_mps: 0`
- `total_new_words: 0`
- `rankings: []`

## Populate Speaker Data

```bash
cd backend
uv run python check_speakers.py 100
```

This will check OPTV API for speaker information on the first 100 words from WP 19+.

## After Populating Data

Rankings will show MPs with new words count, sorted by count descending.

## Query Parameters

- `wahlperiode` - Filter by legislature (e.g., 19)
- `party` - Filter by party (e.g., SPD, CDU, GRÜNE)
- `limit` - Max results (default 100, max 500)
