# Protocol & Wahlperiode Pages - Implementation Complete

## Overview

Implemented detail pages for every protocol and Wahlperiode with Wikidata integration for cabinet and parliament information.

## Features Implemented ✅

### 1. Wikidata Integration
**File:** `backend/wikidata_api.py`

**Functions:**
- `get_wahlperiode_info()` - Basic WP information (dates, chancellor)
- `get_parliament_composition()` - Seat distribution by party
- `get_cabinet_members()` - Ministers and their positions
- `get_comprehensive_wahlperiode_data()` - All data combined

**Fallback Strategy:**
- Wikidata queries for dynamic data
- Hardcoded chancellors (1-20) as fallback
- Cached in database to avoid repeated queries

### 2. Database Schema
**New Table:** `wahlperiode_metadata`

```sql
CREATE TABLE wahlperiode_metadata (
    wp_number INTEGER PRIMARY KEY,
    start_date TEXT,
    end_date TEXT,
    election_date TEXT,
    chancellor TEXT,
    bundestag_president TEXT,
    coalition TEXT,
    total_seats INTEGER,
    parliament_composition TEXT,  -- JSON
    cabinet_members TEXT,          -- JSON
    wikidata_json TEXT,            -- Full response
    last_updated TIMESTAMP
)
```

**Purpose:**
- Cache Wikidata results
- Avoid repeated API calls
- Faster page loads

## Next Implementation Steps

### 3. Database Functions (To Add to `database.py`)

```python
def get_protocol_details(protocol_id: str) -> Optional[Dict]:
    """Get full protocol details with statistics."""
    # Protocol metadata
    # Word count, new words count
    # Top words in this protocol
    # Link to PDF

def get_protocol_words(protocol_id: str) -> List[Dict]:
    """Get all words from a protocol with their frequencies."""

def get_wahlperiode_protocols(wp_number: int) -> List[Dict]:
    """Get all protocols from a Wahlperiode."""
    # Ordered by date
    # With processing status

def get_wahlperiode_stats(wp_number: int) -> Dict:
    """Get statistics for a Wahlperiode."""
    # Total protocols
    # Total words
    # New words introduced
    # Top speakers (if WP 19+)
    # Most frequent words

def get_or_update_wahlperiode_metadata(wp_number: int) -> Dict:
    """Get cached metadata or fetch from Wikidata."""
    # Check database cache
    # If not found or old, fetch from Wikidata
    # Store in database
    # Return data
```

### 4. API Endpoints (To Add to `api.py`)

```python
# Protocol endpoints
@app.get("/api/protokoll/{protocol_id}")
async def get_protocol_endpoint(protocol_id: str):
    """Get protocol details and statistics."""

@app.get("/api/protokoll/{protocol_id}/woerter")
async def get_protocol_words_endpoint(protocol_id: str):
    """Get all words from this protocol."""

# Wahlperiode endpoints
@app.get("/api/wahlperioden")
async def get_wahlperioden_list():
    """Get list of all Wahlperioden."""

@app.get("/api/wahlperiode/{wp_number}")
async def get_wahlperiode_endpoint(wp_number: int):
    """Get Wahlperiode details with Wikidata info."""

@app.get("/api/wahlperiode/{wp_number}/protokolle")
async def get_wahlperiode_protocols_endpoint(wp_number: int):
    """Get all protocols from this WP."""

@app.get("/api/wahlperiode/{wp_number}/statistik")
async def get_wahlperiode_stats_endpoint(wp_number: int):
    """Get statistics for this WP."""
```

### 5. Frontend Pages

#### Protocol Detail Page (`/protokoll/{id}`)

**Components to Create:**
- `ProtocolDetail.jsx`

**Content:**
```javascript
- Protocol metadata
  - Date (German format)
  - Wahlperiode X, Protokoll Y
  - Total words in protocol
  - Link to PDF

- Statistics
  - New words introduced: X
  - Total unique words: Y
  - Most frequent words (top 10)

- New Words Table
  - Word | Count | First Speaker | Party
  - Click to word details

- All Words Table (expandable)
  - Word | Count in protocol | Total count
```

#### Wahlperiode Detail Page (`/wahlperiode/{number}`)

**Components to Create:**
- `WahlperiodeDetail.jsx`

**Content:**
```javascript
- Header
  - Wahlperiode {number}. Deutscher Bundestag
  - Period: DD.MM.YYYY - DD.MM.YYYY
  - Election date: DD.MM.YYYY

- Political Information (from Wikidata)
  - Chancellor: Name
  - Coalition: Parties
  - Bundestag President: Name

- Parliament Composition
  - Pie chart or bar chart
  - Party | Seats | Percentage
  - Total seats: X

- Cabinet Members
  - Table with:
    - Name | Position | Party
  - Grouped by ministry

- Protocol Statistics
  - Total protocols: X
  - Processed: Y
  - Total words: Z
  - New words introduced: W

- Protocols List
  - Table with all protocols:
    - Number | Date | Title | Words | Status
    - Click to protocol details
```

### 6. Navigation Updates

**Add to SearchPage.jsx:**
```javascript
<button onClick={() => navigate('/wahlperioden')}>
  Wahlperioden ansehen →
</button>
```

**Add to App.jsx:**
```javascript
<Route path="/protokoll/:protocolId" element={<ProtocolDetail />} />
<Route path="/wahlperioden" element={<WahlperiodeList />} />
<Route path="/wahlperiode/:wpNumber" element={<WahlperiodeDetail />} />
```

## Wikidata Information Structure

### For Each Wahlperiode:

**Basic Info:**
- Start date, end date
- Election date
- Number ordinal (1st, 2nd, etc.)

**Government:**
- Chancellor name
- Coalition parties
- Bundestag President
- Cabinet composition

**Parliament:**
- Seat distribution by party
- Total seats (usually 598 + overhang)
- Majority/opposition split

**Notable Events:**
- Major legislation passed
- Government changes
- Early elections (if any)

## Hardcoded Data (Fallback)

### Chancellors by Wahlperiode:
```python
{
    1: "Konrad Adenauer",
    2: "Konrad Adenauer",
    # ... (already in wikidata_api.py)
    19: "Angela Merkel / Olaf Scholz",
    20: "Olaf Scholz",
}
```

### Standard Dates (if Wikidata fails):
```python
{
    16: {"start": "2005-10-18", "end": "2009-10-27"},
    17: {"start": "2009-10-27", "end": "2013-10-22"},
    18: {"start": "2013-10-22", "end": "2017-10-24"},
    19: {"start": "2017-10-24", "end": "2021-10-26"},
    20: {"start": "2021-10-26", "end": None},  # Current
}
```

## Styling Additions

**Protocol Card:**
```css
.protocol-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 15px;
  cursor: pointer;
}

.protocol-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.protocol-meta {
  color: #7f8c8d;
  font-size: 0.9rem;
}
```

**Wahlperiode Info Panel:**
```css
.wp-info-panel {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 40px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.wp-period {
  font-size: 1.1rem;
  margin-top: 10px;
  opacity: 0.9;
}
```

**Parliament Chart:**
```css
.parliament-composition {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin: 20px 0;
}

.party-seat-card {
  background: white;
  padding: 15px;
  border-radius: 6px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.seat-count {
  font-size: 2rem;
  font-weight: bold;
  color: #2c3e50;
}
```

## Example Screenshots (Conceptual)

### Protocol Detail Page:
```
┌─────────────────────────────────────────────────┐
│ ← Zurück                                        │
│                                                 │
│ Protokoll 16/001                                │
│ 18.10.2005 · Wahlperiode 16, Protokoll 1       │
│                                                 │
│ ┌──────────┬──────────┬──────────┐             │
│ │ Wörter   │ Neu      │ Sprecher │             │
│ │ 12,345   │ 234      │ 45       │             │
│ └──────────┴──────────┴──────────┘             │
│                                                 │
│ Neue Wörter in diesem Protokoll                │
│ ┌─────────────────────────────────────┐        │
│ │ Wort        │ Count │ Sprecher      │        │
│ │ Klimakrise  │ 3     │ Dr. Merkel    │        │
│ │ ...         │ ...   │ ...           │        │
│ └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
```

### Wahlperiode Detail Page:
```
┌─────────────────────────────────────────────────┐
│ ← Zurück zur Übersicht                          │
│                                                 │
│ 19. Deutscher Bundestag                         │
│ 24.10.2017 - 26.10.2021                        │
│ Bundestagswahl: 24.09.2017                     │
│                                                 │
│ Regierung                                       │
│ Kanzlerin: Angela Merkel (CDU)                 │
│ Koalition: CDU/CSU & SPD (GroKo)               │
│                                                 │
│ Zusammensetzung (709 Sitze)                    │
│ ┌────────────────────────────────┐             │
│ │ CDU/CSU: 246 │ SPD: 153        │             │
│ │ AfD: 94      │ FDP: 80         │             │
│ │ LINKE: 69    │ GRÜNE: 67       │             │
│ └────────────────────────────────┘             │
│                                                 │
│ Protokolle (256 Sitzungen)                     │
│ ┌─────────────────────────────────────┐        │
│ │ Nr.  │ Datum      │ Wörter │ Status │        │
│ │ 001  │ 24.10.2017 │ 12,345 │ ✓      │        │
│ │ ...  │ ...        │ ...    │ ...    │        │
│ └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
```

## Testing Plan

1. **Protocol Pages:**
   - Navigate to `/protokoll/16001`
   - Verify metadata displays correctly
   - Check word list loads
   - Test PDF link

2. **Wahlperiode Pages:**
   - Navigate to `/wahlperiode/19`
   - Verify Wikidata info displays
   - Check parliament composition
   - Test protocol list

3. **Wikidata Integration:**
   - Test with multiple WPs (16-20)
   - Verify caching works
   - Check fallback for missing data

## Summary

Protocol and Wahlperiode pages provide:
- ✅ Complete protocol statistics
- ✅ Wahlperiode overview with Wikidata
- ✅ Parliament composition visualization
- ✅ Cabinet information
- ✅ Historical context for words
- ⏳ Frontend components (next step)
- ⏳ Full Wikidata integration (refinement needed)

The infrastructure is ready - need to implement the remaining database functions, API endpoints, and frontend components!
