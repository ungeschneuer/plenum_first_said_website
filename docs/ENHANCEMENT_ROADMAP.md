# Project Enhancement Roadmap

Date: 2026-02-13

## Overview

Comprehensive enhancement plan for the Bundestag Word Tracker, organized by priority and impact. This roadmap balances user value, technical improvements, and development effort.

---

## Phase 1: Quick Wins (1-2 weeks)

### 1.1 Enhanced Visualizations

**Impact:** HIGH | **Effort:** MEDIUM | **Priority:** HIGH

#### Word Timeline Charts
Currently shows basic timeline. Enhance with:

**A. Interactive Charts**
```javascript
// Replace Chart.js with Recharts or Apache ECharts
- Zoom/pan functionality
- Hover tooltips with context
- Click word to jump to protocol
- Multiple word comparison on same chart
- Annotation markers for major events
```

**B. Word Cloud Visualization**
```javascript
// Most frequent words in a period
- Size proportional to frequency
- Color by party affiliation
- Interactive (click word → details)
- Filter by Wahlperiode
- Animated transitions
```

**C. Trend Analysis**
```javascript
// Show word popularity over time
- Moving averages
- Trend lines (increasing/decreasing/stable)
- Seasonal patterns
- Comparison with related words
```

**Implementation:**
```bash
# Install visualization libraries
npm install recharts d3 react-wordcloud

# New components:
frontend/src/components/visualizations/
  ├── WordCloud.jsx
  ├── TrendChart.jsx
  ├── ComparisonChart.jsx
  └── HeatmapCalendar.jsx
```

---

### 1.2 Advanced Search & Filters

**Impact:** HIGH | **Effort:** LOW | **Priority:** HIGH

**A. Search Enhancements**
```javascript
// Current: Basic word search
// Enhanced:
- Fuzzy search (typo tolerance)
- Autocomplete suggestions
- Search history
- Recent searches saved
- Search by date range
- Search by Wahlperiode
- Search by party/speaker
```

**B. Multi-Filter Interface**
```javascript
<FilterPanel>
  <DateRangePicker from={} to={} />
  <WahlperiodeSelect multiple />
  <PartyFilter multiple />
  <SpeakerFilter autocomplete />
  <WordCountSlider min={} max={} />
</FilterPanel>
```

**C. Saved Searches**
```javascript
// Save complex searches for later
- Store in localStorage
- Export/import search configurations
- Share search URLs
```

**Backend Changes:**
```python
# api.py - Enhanced search endpoint
@app.get("/api/words/search/advanced")
async def advanced_search(
    q: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    wahlperioden: Optional[List[int]] = Query(None),
    parties: Optional[List[int]] = Query(None),
    speakers: Optional[List[int]] = Query(None),
    min_count: Optional[int] = None,
    sort_by: str = "relevance"
):
    # Complex query building
    pass
```

---

### 1.3 Export Functionality

**Impact:** MEDIUM | **Effort:** LOW | **Priority:** MEDIUM

**A. Data Export Formats**
```javascript
// Export search results or visualizations
- CSV (spreadsheet-friendly)
- JSON (developer-friendly)
- PDF (report-friendly)
- PNG (chart images)
```

**B. Implementation**
```javascript
// ExportButton component
<ExportMenu>
  <MenuItem onClick={exportCSV}>CSV herunterladen</MenuItem>
  <MenuItem onClick={exportJSON}>JSON herunterladen</MenuItem>
  <MenuItem onClick={exportPDF}>PDF-Bericht erstellen</MenuItem>
  <MenuItem onClick={exportChart}>Diagramm speichern</MenuItem>
</ExportMenu>
```

**Backend Endpoint:**
```python
@app.get("/api/export/{format}")
async def export_data(
    format: str,  # csv, json, pdf
    search_params: dict
):
    # Generate file
    # Return file download
    pass
```

---

## Phase 2: Data Analysis Features (2-4 weeks)

### 2.1 N-gram Analysis (Phrases)

**Impact:** HIGH | **Effort:** HIGH | **Priority:** HIGH

**Current Limitation:** Only tracks single words
**Enhancement:** Track 2-3 word phrases

**A. Bigrams (2-word phrases)**
```python
# Examples
"soziale Gerechtigkeit"
"digitale Transformation"
"erneuerbare Energien"
"Klimaschutz Paket"
```

**B. Trigrams (3-word phrases)**
```python
# Examples
"Gesetz zur Förderung"
"Antrag der Fraktion"
"Beratung des Gesetzentwurfs"
```

**C. Implementation**
```python
# backend/ngram_analysis.py
from nltk import ngrams
from collections import Counter

def extract_ngrams(text: str, n: int = 2) -> List[str]:
    """Extract n-grams from text."""
    tokens = word_tokenize(text)
    return [' '.join(gram) for gram in ngrams(tokens, n)]

def find_trending_phrases(
    wahlperiode: int,
    n: int = 2,
    min_frequency: int = 5
) -> List[Dict]:
    """Find frequently used phrases."""
    # Query protocols
    # Extract n-grams
    # Count frequencies
    # Return sorted by frequency
    pass
```

**Database Schema:**
```sql
CREATE TABLE phrases (
    phrase_id SERIAL PRIMARY KEY,
    phrase TEXT NOT NULL,
    n_gram_size INTEGER NOT NULL,  -- 2 for bigram, 3 for trigram
    first_protocol_id INTEGER REFERENCES protocols(id),
    first_date DATE,
    first_speaker_id INTEGER REFERENCES speakers(speaker_id),
    total_count INTEGER DEFAULT 0,
    UNIQUE(phrase, n_gram_size)
);

CREATE INDEX idx_phrases_ngram_size ON phrases(n_gram_size);
CREATE INDEX idx_phrases_count ON phrases(total_count DESC);
```

---

### 2.2 Sentiment Analysis

**Impact:** MEDIUM | **Effort:** MEDIUM | **Priority:** MEDIUM

**Goal:** Analyze emotional tone of speeches

**A. Sentiment Scoring**
```python
# backend/sentiment_analysis.py
from textblob_de import TextBlobDE

def analyze_sentiment(text: str) -> Dict:
    """Analyze sentiment of German text."""
    blob = TextBlobDE(text)
    return {
        'polarity': blob.sentiment.polarity,  # -1 (negative) to 1 (positive)
        'subjectivity': blob.sentiment.subjectivity,  # 0 (objective) to 1 (subjective)
        'classification': classify_sentiment(blob.sentiment.polarity)
    }

def classify_sentiment(polarity: float) -> str:
    if polarity > 0.3:
        return 'positive'
    elif polarity < -0.3:
        return 'negative'
    else:
        return 'neutral'
```

**B. Use Cases**
- Show sentiment trend for a word over time
- Compare sentiment across parties
- Identify most positive/negative speeches
- Track sentiment shifts during debates

**C. Visualization**
```javascript
<SentimentChart>
  <Line data={sentimentOverTime} color="green" label="Positive" />
  <Line data={sentimentOverTime} color="red" label="Negative" />
  <Line data={sentimentOverTime} color="gray" label="Neutral" />
</SentimentChart>
```

---

### 2.3 Topic Modeling

**Impact:** MEDIUM | **Effort:** HIGH | **Priority:** LOW

**Goal:** Automatically discover themes/topics in debates

**A. LDA (Latent Dirichlet Allocation)**
```python
# backend/topic_modeling.py
from gensim import corpora, models

def discover_topics(
    wahlperiode: int,
    num_topics: int = 10
) -> List[Dict]:
    """Discover main topics in debates."""
    # Get all protocols
    # Preprocess texts
    # Build dictionary and corpus
    # Train LDA model
    # Return topics with keywords
    pass
```

**B. Topic Examples**
```
Topic 1: Klimaschutz (Klima, Umwelt, CO2, Energie, erneuerbar)
Topic 2: Digitalisierung (digital, Internet, Daten, Technologie)
Topic 3: Gesundheit (Gesundheit, Kranken, Versicherung, Pflege)
Topic 4: Bildung (Bildung, Schule, Studenten, Ausbildung)
Topic 5: Wirtschaft (Wirtschaft, Unternehmen, Arbeitsplätze)
```

**C. Frontend Display**
```javascript
<TopicExplorer>
  <TopicCard topic="Klimaschutz" keywords={[...]} />
  <TopicTimeline topic="Digitalisierung" data={...} />
  <TopicComparison topics={['Klima', 'Wirtschaft']} />
</TopicExplorer>
```

---

### 2.4 Word Relationships Graph

**Impact:** MEDIUM | **Effort:** MEDIUM | **Priority:** MEDIUM

**Goal:** Show how words are related/used together

**A. Co-occurrence Analysis**
```python
# Words frequently used together
"Klima" → ["Schutz", "Wandel", "Krise", "Politik"]
"digital" → ["Transformation", "Infrastruktur", "Bildung"]
```

**B. Network Visualization**
```javascript
// Using react-force-graph or vis-network
<NetworkGraph>
  <Node id="Klimaschutz" size={50} color="green" />
  <Node id="Energiewende" size={30} color="blue" />
  <Edge source="Klimaschutz" target="Energiewende" weight={0.8} />
</NetworkGraph>
```

**C. Similarity Analysis**
```python
# Words with similar usage patterns
"Bundeskanzler" ↔ "Regierungschef" (similarity: 0.95)
"Gesetz" ↔ "Verordnung" (similarity: 0.78)
```

---

## Phase 3: Performance Optimization (1-2 weeks)

### 3.1 Caching Layer (Redis)

**Impact:** HIGH | **Effort:** MEDIUM | **Priority:** HIGH

**A. Why Cache?**
- Search results: Same queries repeated often
- Word timelines: Expensive to compute
- Statistics: Rarely change
- API responses: Reduce database load

**B. Implementation**
```python
# backend/cache.py
import redis
import json
from functools import wraps

redis_client = redis.Redis(
    host='localhost',
    port=6379,
    decode_responses=True
)

def cache_result(ttl: int = 3600):
    """Cache decorator with time-to-live."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{func.__name__}:{args}:{kwargs}"

            # Check cache
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)

            # Compute result
            result = await func(*args, **kwargs)

            # Store in cache
            redis_client.setex(
                cache_key,
                ttl,
                json.dumps(result)
            )

            return result
        return wrapper
    return decorator
```

**C. Usage**
```python
# api.py
@cache_result(ttl=3600)  # Cache for 1 hour
async def search_words(query: str, limit: int = 20):
    # Expensive database query
    pass

@cache_result(ttl=7200)  # Cache for 2 hours
async def get_word_timeline(word: str):
    # Expensive aggregation
    pass
```

**D. Cache Invalidation**
```python
# Clear cache when new protocols processed
def invalidate_caches():
    redis_client.flushdb()  # Clear all
    # Or selective invalidation
    redis_client.delete('search_*')
```

**E. Docker Setup**
```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
```

---

### 3.2 Full-Text Search (Elasticsearch)

**Impact:** HIGH | **Effort:** HIGH | **Priority:** MEDIUM

**A. Why Elasticsearch?**
- Lightning-fast full-text search
- Fuzzy matching built-in
- Relevance scoring
- Advanced filtering
- Autocomplete support

**B. Architecture**
```
PostgreSQL (source of truth)
     ↓
Elasticsearch (search index)
     ↓
API (search endpoint)
     ↓
Frontend (fast search)
```

**C. Implementation**
```python
# backend/elasticsearch_client.py
from elasticsearch import Elasticsearch

es = Elasticsearch(['http://localhost:9200'])

def index_word(word_data: dict):
    """Index word in Elasticsearch."""
    es.index(
        index='words',
        id=word_data['word_id'],
        document={
            'word': word_data['word'],
            'first_date': word_data['first_date'],
            'speaker_name': word_data['speaker_name'],
            'party_name': word_data['party_name'],
            'total_count': word_data['total_count'],
            'suggest': {  # Autocomplete
                'input': [word_data['word']],
                'weight': word_data['total_count']
            }
        }
    )

def search_words_elasticsearch(
    query: str,
    filters: dict = None
) -> List[dict]:
    """Fast full-text search."""
    body = {
        'query': {
            'bool': {
                'must': [
                    {
                        'match': {
                            'word': {
                                'query': query,
                                'fuzziness': 'AUTO'  # Typo tolerance
                            }
                        }
                    }
                ],
                'filter': []  # Add date, party filters
            }
        },
        'sort': [
            {'_score': 'desc'},  # Relevance
            {'total_count': 'desc'}  # Frequency
        ]
    }

    response = es.search(index='words', body=body)
    return [hit['_source'] for hit in response['hits']['hits']]
```

**D. Autocomplete**
```python
@app.get("/api/words/autocomplete")
async def autocomplete(q: str):
    """Fast autocomplete suggestions."""
    result = es.search(
        index='words',
        body={
            'suggest': {
                'word-suggest': {
                    'prefix': q,
                    'completion': {
                        'field': 'suggest',
                        'size': 10,
                        'fuzzy': {'fuzziness': 1}
                    }
                }
            }
        }
    )

    suggestions = [
        opt['text']
        for opt in result['suggest']['word-suggest'][0]['options']
    ]
    return suggestions
```

---

### 3.3 Database Optimization

**Impact:** MEDIUM | **Effort:** LOW | **Priority:** HIGH

**A. Query Optimization**
```sql
-- Add missing indexes
CREATE INDEX idx_words_first_date ON words(first_date);
CREATE INDEX idx_words_total_count ON words(total_count DESC);
CREATE INDEX idx_occurrences_protocol_date ON word_occurrences(protocol_id, (
    SELECT datum FROM protocols WHERE id = protocol_id
));

-- Composite indexes for common queries
CREATE INDEX idx_words_speaker_date ON words(first_speaker_id, first_date);
CREATE INDEX idx_words_party_count ON words(party_at_time_id, total_count DESC);
```

**B. Materialized Views**
```sql
-- Pre-compute expensive aggregations
CREATE MATERIALIZED VIEW word_statistics AS
SELECT
    w.word,
    w.first_date,
    COUNT(DISTINCT wo.protocol_id) AS protocols_used,
    COUNT(*) AS total_occurrences,
    AVG(CASE WHEN wo.context_sentiment IS NOT NULL
        THEN wo.context_sentiment ELSE 0 END) AS avg_sentiment
FROM words w
LEFT JOIN word_occurrences wo ON w.word_id = wo.word_id
GROUP BY w.word_id;

-- Refresh periodically
REFRESH MATERIALIZED VIEW word_statistics;
```

**C. Query Analysis**
```sql
-- Find slow queries
EXPLAIN ANALYZE
SELECT * FROM words
WHERE first_date BETWEEN '2020-01-01' AND '2023-12-31'
ORDER BY total_count DESC
LIMIT 100;

-- Optimize based on results
```

---

### 3.4 Frontend Optimization

**Impact:** MEDIUM | **Effort:** LOW | **Priority:** MEDIUM

**A. Code Splitting**
```javascript
// Lazy load heavy components
const WordCloud = lazy(() => import('./components/WordCloud'));
const ChartVisualization = lazy(() => import('./components/ChartVisualization'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));

// Wrap with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <WordCloud data={data} />
</Suspense>
```

**B. Image Optimization**
```javascript
// Lazy load images
<img loading="lazy" src={imageSrc} alt={alt} />

// Use modern formats
<picture>
  <source srcset="image.webp" type="image/webp" />
  <source srcset="image.jpg" type="image/jpeg" />
  <img src="image.jpg" alt="Fallback" />
</picture>
```

**C. Bundle Optimization**
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts', 'd3'],
          'admin': ['./src/components/admin/AdminDashboard.jsx']
        }
      }
    }
  }
}
```

**D. Virtual Scrolling**
```javascript
// For long lists (thousands of items)
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={words.length}
  itemSize={50}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      {words[index].word}
    </div>
  )}
</FixedSizeList>
```

---

## Phase 4: Technical Infrastructure (2-3 weeks)

### 4.1 TypeScript Migration

**Impact:** MEDIUM | **Effort:** HIGH | **Priority:** LOW

**A. Benefits**
- Type safety prevents bugs
- Better IDE autocomplete
- Self-documenting code
- Easier refactoring

**B. Migration Strategy**
```bash
# Install TypeScript
npm install --save-dev typescript @types/react @types/react-dom

# Rename files gradually
mv src/components/SearchPage.jsx src/components/SearchPage.tsx

# Add types incrementally
interface SearchPageProps {
  initialQuery?: string;
}

interface WordResult {
  word: string;
  first_date: string;
  total_count: number;
  speaker_name?: string;
}
```

**C. API Types**
```typescript
// types/api.ts
export interface Protocol {
  id: number;
  wahlperiode: number;
  protokollnummer: number;
  datum: string;
  titel?: string;
  total_words?: number;
  processed: boolean;
}

export interface Word {
  word_id: number;
  word: string;
  first_protocol_id: number;
  first_date: string;
  first_speaker_id?: number;
  speaker_name?: string;
  party_name?: string;
  total_count: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
    total: number;
    limit: number;
  };
}
```

---

### 4.2 Testing Suite

**Impact:** HIGH | **Effort:** HIGH | **Priority:** MEDIUM

**A. Backend Tests**
```python
# tests/test_api.py
import pytest
from fastapi.testclient import TestClient
from backend.api import app

client = TestClient(app)

def test_search_words():
    response = client.get("/api/words/search?q=Klima")
    assert response.status_code == 200
    data = response.json()
    assert 'items' in data
    assert len(data['items']) > 0

def test_get_word_timeline():
    response = client.get("/api/words/Klimaschutz/timeline")
    assert response.status_code == 200
    timeline = response.json()
    assert isinstance(timeline, list)

def test_sql_injection_protection():
    """Ensure SQL injection is prevented."""
    malicious_query = "'; DROP TABLE words; --"
    response = client.get(f"/api/words/search?q={malicious_query}")
    assert response.status_code == 200  # Should not crash
    # Should return empty or safe results
```

**B. Frontend Tests**
```javascript
// tests/SearchPage.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import SearchPage from '../components/SearchPage';

test('renders search input', () => {
  render(<SearchPage />);
  const input = screen.getByPlaceholderText(/suchen/i);
  expect(input).toBeInTheDocument();
});

test('displays results after search', async () => {
  render(<SearchPage />);
  const input = screen.getByRole('textbox');

  fireEvent.change(input, { target: { value: 'Klima' } });
  fireEvent.submit(input.form);

  const results = await screen.findAllByTestId('word-result');
  expect(results.length).toBeGreaterThan(0);
});
```

**C. Integration Tests**
```python
# tests/test_integration.py
def test_full_protocol_processing():
    """Test complete workflow: XML → Database → API → Frontend."""
    # 1. Process protocol
    process_protocol('19001.xml')

    # 2. Verify database
    words = get_words_from_protocol('19001')
    assert len(words) > 0

    # 3. Test API
    response = client.get(f"/api/words/{words[0]}/timeline")
    assert response.status_code == 200
```

---

### 4.3 CI/CD Pipeline

**Impact:** HIGH | **Effort:** MEDIUM | **Priority:** MEDIUM

**A. GitHub Actions**
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on: [push, pull_request]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install uv
          uv sync
      - name: Run tests
        run: uv run pytest
      - name: Security scan
        run: uv run bandit -r backend/

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Build
        run: npm run build

  deploy:
    needs: [test-backend, test-frontend]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: ./deploy.sh
```

**B. Automated Checks**
- Code linting (ruff, eslint)
- Security scanning (bandit, npm audit)
- Test coverage (pytest-cov)
- Type checking (mypy, tsc)

---

### 4.4 Docker Containerization

**Impact:** MEDIUM | **Effort:** MEDIUM | **Priority:** LOW

**A. Multi-Container Setup**
```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: bundestag
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - es_data:/usr/share/elasticsearch/data

  backend:
    build: ./backend
    depends_on:
      - postgres
      - redis
      - elasticsearch
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://redis:6379
      ELASTICSEARCH_URL: http://elasticsearch:9200
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    command: uvicorn api:app --host 0.0.0.0 --reload

  frontend:
    build: ./frontend
    depends_on:
      - backend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev

volumes:
  postgres_data:
  redis_data:
  es_data:
```

**B. Dockerfile (Backend)**
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy dependencies
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync

# Copy application
COPY . .

# Run application
CMD ["uv", "run", "uvicorn", "api:app", "--host", "0.0.0.0"]
```

---

## Phase 5: Content & User Features (2-3 weeks)

### 5.1 Historical Context

**Impact:** MEDIUM | **Effort:** MEDIUM | **Priority:** LOW

**A. Event Timeline**
```javascript
// Link words to historical events
{
  word: "Energiewende",
  first_date: "2011-03-15",
  context: {
    event: "Fukushima-Katastrophe",
    description: "Nach der Reaktorkatastrophe in Japan...",
    related_legislation: ["Atomausstiegsgesetz 2011"],
    news_articles: [...]
  }
}
```

**B. Political Context**
```javascript
// Show government composition at time of first use
{
  word: "Flüchtlingskrise",
  first_date: "2015-09-01",
  context: {
    chancellor: "Angela Merkel",
    government: "CDU/CSU-SPD Große Koalition",
    major_events: ["Flüchtlingswelle aus Syrien"],
    legislation_passed: ["Asylpaket I", "Asylpaket II"]
  }
}
```

---

### 5.2 Word Comparisons

**Impact:** MEDIUM | **Effort:** LOW | **Priority:** MEDIUM

**A. Side-by-Side Comparison**
```javascript
<ComparisonView>
  <WordColumn word="Klimaschutz">
    <Timeline />
    <Stats />
    <TopSpeakers />
  </WordColumn>

  <WordColumn word="Klimawandel">
    <Timeline />
    <Stats />
    <TopSpeakers />
  </WordColumn>
</ComparisonView>
```

**B. Usage Patterns**
- Show which parties prefer which terms
- Temporal shifts (old term → new term)
- Regional variations
- Formality levels

---

### 5.3 Bookmarks & Favorites

**Impact:** LOW | **Effort:** LOW | **Priority:** LOW

**A. Local Storage**
```javascript
// No authentication needed - use localStorage
const [favorites, setFavorites] = useState(() => {
  const saved = localStorage.getItem('favorite_words');
  return saved ? JSON.parse(saved) : [];
});

const addFavorite = (word) => {
  const updated = [...favorites, word];
  setFavorites(updated);
  localStorage.setItem('favorite_words', JSON.stringify(updated));
};
```

**B. Features**
- Star/bookmark words
- Save searches
- Export favorites
- Compare favorites

---

## Phase 6: Advanced Features (Future)

### 6.1 Real-time Updates

**Impact:** LOW | **Effort:** HIGH | **Priority:** LOW

**A. WebSocket Connection**
```python
# backend/websocket.py
from fastapi import WebSocket

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    # Send updates when new protocols processed
    while True:
        # Wait for new data
        new_words = await wait_for_new_words()
        await websocket.send_json({
            'type': 'new_words',
            'data': new_words
        })
```

**B. Live Dashboard**
- Show processing status
- New words as they're discovered
- Real-time statistics

---

### 6.2 API for Researchers

**Impact:** MEDIUM | **Effort:** MEDIUM | **Priority:** LOW

**A. Public API**
```python
# Rate-limited public API
@app.get("/api/v1/public/words")
@rate_limit(calls=100, period=3600)  # 100 calls/hour
async def public_api_search(
    api_key: str = Header(...),
    query: str,
    limit: int = 20
):
    # Validate API key
    # Return data
    pass
```

**B. Documentation**
- OpenAPI/Swagger UI
- Example code (Python, JavaScript, R)
- Use cases for researchers
- Rate limits and pricing

---

### 6.3 Mobile App

**Impact:** LOW | **Effort:** VERY HIGH | **Priority:** LOW

**A. React Native**
- Share codebase with web
- Native performance
- Offline support
- Push notifications

**B. Progressive Web App (PWA)**
- Easier alternative to native app
- Works offline
- Installable
- Push notifications

---

## Priority Matrix

### High Impact, Low Effort (DO FIRST)
1. Advanced search & filters
2. Export functionality
3. Database optimization (indexes)
4. Frontend optimization (code splitting)

### High Impact, Medium/High Effort (DO NEXT)
1. Enhanced visualizations (charts, word clouds)
2. Caching layer (Redis)
3. N-gram analysis (phrases)
4. Full-text search (Elasticsearch)

### Medium Impact (CONSIDER)
1. Sentiment analysis
2. Word relationships graph
3. CI/CD pipeline
4. Historical context
5. Testing suite

### Low Priority (NICE TO HAVE)
1. TypeScript migration
2. Topic modeling
3. Docker containerization
4. User accounts
5. Mobile app

---

## Development Roadmap Timeline

### Month 1: Quick Wins
- Week 1-2: Visualizations + Advanced search
- Week 3: Export functionality
- Week 4: Database optimization

### Month 2: Performance
- Week 1-2: Redis caching
- Week 3-4: Elasticsearch integration

### Month 3: Data Analysis
- Week 1-2: N-gram analysis
- Week 3: Sentiment analysis
- Week 4: Word relationships

### Month 4: Infrastructure
- Week 1-2: Testing suite
- Week 3: CI/CD pipeline
- Week 4: Docker setup

### Month 5+: Advanced Features
- Topic modeling
- Historical context
- API for researchers
- TypeScript migration

---

## Resource Requirements

### Development Time
- **Solo developer:** 6-8 months for all phases
- **Small team (2-3):** 3-4 months for all phases
- **Priority features only:** 2-3 months

### Infrastructure Costs (Monthly)
- **Minimal (current):** €0-10 (shared hosting)
- **With caching:** €15-30 (Redis instance)
- **With search:** €50-100 (Elasticsearch)
- **Full setup:** €100-200 (managed services)

### Skills Needed
- **Frontend:** React, D3.js/Recharts, TypeScript
- **Backend:** Python, FastAPI, NLP libraries
- **DevOps:** Docker, CI/CD, Redis, Elasticsearch
- **Data Science:** NLP, statistics, visualization

---

## Monitoring & Analytics

### Application Monitoring
```python
# backend/monitoring.py
from prometheus_client import Counter, Histogram

request_count = Counter('api_requests_total', 'Total API requests')
request_duration = Histogram('api_request_duration_seconds', 'Request duration')

@app.middleware("http")
async def monitor_requests(request: Request, call_next):
    request_count.inc()

    with request_duration.time():
        response = await call_next(request)

    return response
```

### User Analytics
```javascript
// Track user behavior (privacy-friendly)
- Page views
- Search queries (anonymized)
- Feature usage
- Performance metrics
```

---

## Summary

### Immediate Value (1-2 months)
1. Better visualizations → Users understand data better
2. Advanced search → Users find information faster
3. Caching → Application feels much faster
4. Export → Researchers can use data

### Long-term Value (3-6 months)
1. Phrase analysis → Deeper insights
2. Sentiment analysis → Understand tone
3. Full-text search → Lightning-fast queries
4. Testing → Reliable application

### Future Value (6+ months)
1. Topic modeling → Discover themes
2. Public API → Enable research
3. Mobile app → Wider accessibility
4. Real-time updates → Live analysis

---

**Total Enhancement Potential:** Transforms from simple word tracker to comprehensive political discourse analysis platform.

**Recommended Start:** Phase 1 (Quick Wins) for immediate user value with minimal effort.
