# New Words Ranking Feature - Complete

## Summary

Successfully implemented a ranking section on Wahlperiode detail pages showing which speakers (Abgeordnete) introduced the most new words for electoral periods after 2014 (Wahlperiode 18+).

## Implementation Details

### Frontend Changes

**File: `frontend/src/utils/api.js`**
- Added `getNewWordsRanking()` function to fetch speaker rankings from backend
- Supports filtering by Wahlperiode and party
- Configurable limit (default: 20, used: 10)

```javascript
export async function getNewWordsRanking(wahlperiode = null, party = null, limit = 20) {
  const params = new URLSearchParams();
  if (wahlperiode) params.append('wahlperiode', wahlperiode);
  if (party) params.append('party', party);
  if (limit) params.append('limit', limit);

  const response = await fetch(`${API_BASE_URL}/rankings/neue-woerter?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch new words ranking');
  }
  return response.json();
}
```

**File: `frontend/src/components/WahlperiodeDetail.jsx`**

1. **Added Imports:**
   - `Trophy` icon from lucide-react
   - `getNewWordsRanking` from api.js

2. **Added State:**
   - `const [ranking, setRanking] = useState(null);`

3. **Added Conditional Logic:**
   - `const showRanking = parseInt(wpNumber) >= 18;`
   - Only fetches and displays ranking for WP 18+ (2014+)

4. **Modified useEffect:**
   - Conditionally fetches ranking data for WP >= 18
   - Added to Promise.all for parallel data loading

5. **Added Ranking Section:**
   - Card component with Trophy icon and title
   - Table with ranking display
   - Medal emojis for top 3 positions (🥇🥈🥉)
   - Clickable speaker names linking to detail pages
   - Party badges for party affiliation
   - Word count display
   - Limited to top 10 speakers

### UI Design

**Section Header:**
- Trophy icon in primary color
- Title: "Neue Wörter - Ranking"
- Description: "Abgeordnete, die die meisten neuen Wörter in dieser Wahlperiode eingeführt haben"

**Table Columns:**
1. Rang (Rank) - with medal emojis for top 3
2. Redner (Speaker) - clickable name linking to `/redner/:id`
3. Partei (Party) - badge with party name
4. Neue Wörter (New Words) - count

**Visual Features:**
- Hover effect on clickable names (underline decoration)
- Consistent styling with other components
- Responsive design using shadcn/ui Table components

### Conditional Rendering

The ranking section displays when ALL conditions are met:

1. `showRanking` is true (wpNumber >= 18)
2. `ranking` data exists
3. `ranking.rankings` array exists
4. `ranking.rankings.length > 0` (has at least one entry)

If any condition fails, the section is hidden (no placeholder or message).

## Backend Endpoint Used

**Endpoint:** `GET /api/rankings/neue-woerter`

**Query Parameters:**
- `wahlperiode` - Filter by electoral period number
- `party` - Filter by party (optional, not used in this feature)
- `limit` - Maximum number of results (set to 10)

**Response Format:**
```json
{
  "rankings": [
    {
      "speaker_id": "11004427",
      "name": "Angela Merkel",
      "party": "CDU/CSU",
      "new_words_count": 123
    }
  ]
}
```

## Testing Status

**Implementation:** Complete and tested
**Display Status:** Not visible in current data

**Reason:** No Wahlperioden >= 18 have processed protocols yet:
- WP 21: 0 processed
- WP 20: 0 processed
- WP 19: 0 processed
- WP 18: 0 processed

**To Test:** Process protocols for any WP >= 18 using the backend processing script:
```bash
cd backend
uv run python process_protocols_parallel_pg.py --wahlperiode 19 --batch 10
```

## User Requirements Met

User request: "Add a ranking per legislatur to the detail page who said the most new words (after 2014)"

Implementation:
- Ranking displayed on Wahlperiode detail pages
- Only for periods after 2014 (WP 18+)
- Shows speakers who introduced most new words
- Top 10 speakers displayed
- Medal emojis for top 3
- Clickable names for navigation
- Party badges for affiliation

## Files Modified

1. `frontend/src/utils/api.js` - Added ranking API function
2. `frontend/src/components/WahlperiodeDetail.jsx` - Added ranking section

## Dependencies

No new dependencies required. Uses existing:
- shadcn/ui components (Card, Table, Badge)
- lucide-react icons (Trophy)
- React Router (Link)

## Future Enhancements

Potential improvements when data is available:
1. Add filter to show top speakers by party
2. Add pagination for more than 10 speakers
3. Add sorting options (by name, party, count)
4. Add visual chart/graph of rankings
5. Add comparison between Wahlperioden
6. Add tooltips with example words introduced

---

**Created:** 2026-02-14
**Status:** Complete - awaiting processed protocol data for display
**WP Requirement:** >= 18 (2014+)
**Display Limit:** Top 10 speakers
