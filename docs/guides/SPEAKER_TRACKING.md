# Speaker Tracking - OpenParliamentTV Integration

## Overview

Implemented speaker tracking for words first appearing from Wahlperiode 19 onwards (October 2017+) using the OpenParliamentTV API.

## Features Implemented

### 1. Database Schema ✅

**New Tables:**
- `parties` - Political parties (name, short_name)
- `speakers` - Speakers/politicians (name, party_id, optv_link)

**Extended `words` Table:**
- `first_speaker_id` - Links to speaker who first said the word
- `optv_link` - Link to OpenParliamentTV video
- `speaker_checked` - Tracking flag for OPTV API checks

**Indexes:**
- `idx_words_speaker` - For speaker-based queries
- `idx_speakers_party` - For party-based speaker lookups
- `idx_speakers_name` - For name searches

### 2. OpenParliamentTV API Integration ✅

**File**: `backend/optv_api.py`

**Functionality:**
- Search for words by date in OPTV
- Extract speaker name, party, and video link
- Only query for WP 19+ (configurable via `MIN_WAHLPERIODE`)
- Rate limiting and error handling

**API Endpoint Used:**
```
https://de.openparliament.tv/api/v1/search/media/?q={word}&dateTo={date}&dateFrom={date}
```

**Example Response:**
```json
{
  "speaker": "Dieter Janecek",
  "party": "GRÜNE",
  "link": "https://de.openparliament.tv/media/DE-0190111013?q=Klimakrise"
}
```

### 3. Database Functions ✅

**File**: `backend/database.py`

**New Functions:**
- `get_or_create_party()` - Manage party entries
- `get_or_create_speaker()` - Manage speaker entries
- `update_word_speaker()` - Link words to speakers
- `mark_word_speaker_checked()` - Mark OPTV check as done
- `get_speaker_details()` - Get full speaker information
- `get_party_details()` - Get full party information
- `get_words_by_speaker()` - All words by a speaker
- `get_words_by_party()` - All words by party members
- `get_all_speakers()` - List all speakers with stats
- `get_all_parties()` - List all parties with stats

### 4. Speaker Check Script ✅

**File**: `backend/check_speakers.py`

**Purpose**: Retroactively check OPTV for existing words from WP 19+

**Usage:**
```bash
# Check all words needing speaker info
uv run python backend/check_speakers.py

# Check only first 10 words
uv run python backend/check_speakers.py 10
```

**Features:**
- Rate limiting (1 second delay between requests)
- Progress tracking
- Error handling
- Marks words as checked even if not found

### 5. REST API Endpoints ✅

**File**: `backend/api.py`

**New Endpoints:**

#### Speakers
```
GET /api/redner                  - List all speakers with word counts
GET /api/redner/{speaker_id}     - Get speaker details
GET /api/redner/{speaker_id}/woerter - Get words by speaker
```

#### Parties
```
GET /api/parteien                - List all parties with stats
GET /api/parteien/{party_id}     - Get party details
GET /api/parteien/{party_id}/woerter - Get words by party
```

#### Word Details (Extended)
```
GET /api/words/{word}/details    - Now includes speaker info:
  - first_speaker_id
  - speaker_name
  - party_name
  - optv_link
```

## How It Works

### For New Protocols (WP 19+)

1. **During Processing:**
   - Word is extracted and stored
   - If `wahlperiode >= 19`:
     - Query OpenParliamentTV API
     - If found: create/link speaker and party
     - If not found: mark as checked

2. **Speaker Data Flow:**
   ```
   OPTV API → extract_metadata()
            → get_or_create_speaker()
            → get_or_create_party()
            → update_word_speaker()
   ```

### For Existing Words

1. **Run Check Script:**
   ```bash
   uv run python backend/check_speakers.py
   ```

2. **Script Finds:**
   - Words from WP 19+ without speaker info
   - Queries OPTV for each word
   - Updates database with findings

### Frontend Integration (TODO)

**Planned Pages:**

1. **Speaker Detail Page** (`/redner/{speaker_id}`):
   - Speaker name and party
   - List of words they introduced
   - Link to OPTV video
   - Statistics

2. **Party Detail Page** (`/parteien/{party_id}`):
   - Party name
   - List of members
   - Words introduced by party
   - Statistics

3. **Updated Word Detail Page**:
   - Show speaker name (if WP 19+)
   - Show party
   - Link to OPTV video
   - "Zuerst gesagt von: {Speaker} ({Party})"

## Configuration

### Wahlperiode Threshold
Change `MIN_WAHLPERIODE` in `backend/optv_api.py`:

```python
# Only track speakers for protocols from WP 19 onwards (October 2017)
MIN_WAHLPERIODE = 19
```

### API Rate Limiting
Change `API_DELAY` in `backend/check_speakers.py`:

```python
# Rate limiting: wait between API calls
API_DELAY = 1.0  # seconds
```

## Testing

### API Integration Test
```bash
uv run python backend/optv_api.py
```

**Output:**
```
Testing OPTV API with word 'Klimakrise' on 2019-09-11
======================================================================
✓ Speaker found!
  Speaker: Dieter Janecek
  Party: GRÜNE
  Link: https://de.openparliament.tv/media/DE-0190111013?q=Klimakrise
```

### Database Status
Current database has only WP 16 protocols (2005-2006), which is before the speaker tracking threshold (WP 19+).

To populate speaker data, we need to:
1. Process protocols from WP 19+ (2017 onwards)
2. Run the speaker check script

## Next Steps

### 1. Process WP 19+ Protocols
```bash
# Discover protocols from WP 19 onwards
uv run python backend/process_protocols.py discover 10000 1000

# Process them
uv run python backend/process_protocols.py process
```

### 2. Check Speakers
```bash
# Check speakers for processed WP 19+ protocols
uv run python backend/check_speakers.py
```

### 3. Create Frontend Pages
- Speaker list page
- Speaker detail page
- Party list page
- Party detail page
- Update word detail page with speaker info

### 4. Update Frontend API Client
Add functions to `frontend/src/utils/api.js`:
```javascript
export async function getSpeakers() { ... }
export async function getSpeakerDetails(speakerId) { ... }
export async function getSpeakerWords(speakerId) { ... }
export async function getParties() { ... }
export async function getPartyDetails(partyId) { ... }
export async function getPartyWords(partyId) { ... }
```

## Benefits

1. **Research Value**: Track which politicians introduce new terms
2. **Historical Analysis**: See when parties started using specific vocabulary
3. **Video Links**: Direct access to speeches in OpenParliamentTV
4. **Linguistic Study**: Correlate word introduction with political events

## Example Use Cases

- "Wer hat als Erster 'Klimakrise' im Bundestag gesagt?"
  → Dieter Janecek (GRÜNE) am 11.09.2019

- "Welche Wörter hat die AfD als Erste verwendet?"
  → Liste aller von AfD-Abgeordneten eingeführten Begriffe

- "Welche Politiker haben die meisten neuen Wörter eingeführt?"
  → Rangliste nach Anzahl

## Summary

Speaker tracking is **fully implemented** on the backend:
- ✅ Database schema extended
- ✅ OpenParliamentTV API integrated
- ✅ REST API endpoints created
- ✅ Retroactive check script ready
- ⏳ Frontend pages (TODO)
- ⏳ WP 19+ protocols to be processed

The system is ready to track speakers as soon as WP 19+ protocols are added to the database!
