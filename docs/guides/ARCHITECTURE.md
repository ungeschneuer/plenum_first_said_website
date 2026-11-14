# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│                    http://localhost:5173                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ HTTP Requests
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                  │
├─────────────────────────────────────────────────────────────┤
│  Components:                                                 │
│  ├─ SearchPage.jsx      (Search interface)                  │
│  ├─ WordTimeline.jsx    (Detail page with chart)            │
│  └─ Chart.jsx           (Reusable Chart.js wrapper)         │
│                                                              │
│  Utilities:                                                  │
│  └─ api.js              (API client)                         │
│                                                              │
│  Routing: React Router                                       │
│  Visualization: Chart.js                                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ REST API Calls
                            │ /api/*
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                          │
│                 http://localhost:8000                        │
├─────────────────────────────────────────────────────────────┤
│  Endpoints:                                                  │
│  ├─ GET /api/status                                          │
│  ├─ GET /api/words/search?q=<term>                          │
│  ├─ GET /api/words/<word>/timeline                          │
│  └─ GET /api/words/<word>/details                           │
│                                                              │
│  Features:                                                   │
│  ├─ CORS middleware                                          │
│  ├─ Pydantic validation                                      │
│  └─ Error handling                                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ SQL Queries
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (SQLite)                         │
│                   backend/bundestag.db                       │
├─────────────────────────────────────────────────────────────┤
│  Tables:                                                     │
│  ├─ protocols           (Protocol metadata)                 │
│  ├─ words               (Unique words)                       │
│  └─ word_occurrences    (Time-series data)                  │
│                                                              │
│  Indexes:                                                    │
│  ├─ idx_word_occurrences_word_id                            │
│  ├─ idx_word_occurrences_date                               │
│  ├─ idx_word_occurrences_protocol_id                        │
│  ├─ idx_words_word                                           │
│  └─ idx_protocols_date                                       │
└─────────────────────────────────────────────────────────────┘


                            ▲
                            │
                            │ Populates
                            │
┌─────────────────────────────────────────────────────────────┐
│              Protocol Processor (Python Script)              │
│           backend/process_protocols.py                       │
├─────────────────────────────────────────────────────────────┤
│  Functions:                                                  │
│  ├─ discover_protocols()     (Find new protocols)           │
│  └─ process_single_protocol() (Extract & store words)       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Downloads & Parses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Bundestag API + XML Files                   │
│         https://search.dip.bundestag.de/api/v1/              │
├─────────────────────────────────────────────────────────────┤
│  Provides:                                                   │
│  ├─ Protocol metadata (JSON)                                │
│  ├─ Protocol XML files                                       │
│  └─ PDF links                                                │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Initial Data Loading

```
Bundestag API
    │
    ├─ Fetch Protocol Metadata (JSON)
    │       │
    │       └─> Store in protocols table
    │
    └─ Download XML
            │
            ├─> Parse XML (extract text)
            │
            ├─> Process Text (normalize, extract words)
            │
            └─> Count Frequencies
                    │
                    └─> Store in word_occurrences table
```

### 2. User Search Flow

```
User enters search term
    │
    └─> SearchPage.jsx
            │
            └─> api.searchWords(query)
                    │
                    └─> GET /api/words/search?q=<term>
                            │
                            └─> Database query
                                    │
                                    └─> Return results
                                            │
                                            └─> Display in UI
```

### 3. View Timeline Flow

```
User clicks word
    │
    └─> Navigate to /word/:word
            │
            └─> WordTimeline.jsx
                    │
                    ├─> api.getWordTimeline(word)
                    │       │
                    │       └─> GET /api/words/<word>/timeline
                    │               │
                    │               └─> Database query
                    │                       │
                    │                       └─> Return time-series data
                    │
                    └─> api.getWordDetails(word)
                            │
                            └─> GET /api/words/<word>/details
                                    │
                                    └─> Database query
                                            │
                                            └─> Return metadata
                                                    │
                                                    └─> Render Chart + Details
```

## Component Hierarchy

```
App.jsx
├─ Router
│   ├─ Route "/" → SearchPage.jsx
│   │   ├─ Search Input
│   │   ├─ Status Bar
│   │   └─ Results List
│   │
│   └─ Route "/word/:word" → WordTimeline.jsx
│       ├─ Back Button
│       ├─ Word Info Panel
│       ├─ Chart Controls
│       ├─ Chart.jsx (Chart.js Line Chart)
│       └─ Protocol Details Table
```

## Technology Stack

### Frontend Layer
```
Browser
  └─ React 19
      ├─ React Router (Navigation)
      ├─ Chart.js (Visualization)
      └─ Vite (Build Tool)
```

### Backend Layer
```
FastAPI Server
  ├─ Uvicorn (ASGI Server)
  ├─ Pydantic (Validation)
  └─ SQLite (Database)
```

### Processing Layer
```
Python Scripts
  ├─ xml_processing.py (XML Parser)
  ├─ text_processing.py (Text Normalizer)
  └─ database.py (DB Operations)
```

## File Organization

```
plenum_first_said_website/
│
├── backend/                    # Python Backend
│   ├── api.py                 # FastAPI server
│   ├── database.py            # Database layer
│   ├── process_protocols.py   # Data processor
│   ├── text_processing.py     # Text utilities
│   ├── xml_processing.py      # XML parser
│   ├── archive/               # XML cache (gitignored)
│   └── bundestag.db           # SQLite database (gitignored)
│
├── frontend/                   # React Frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── utils/             # API client
│   │   ├── App.jsx            # Main app
│   │   ├── App.css            # Styles
│   │   └── main.jsx           # Entry point
│   ├── index.html             # HTML template
│   ├── vite.config.js         # Vite config
│   └── package.json           # Dependencies
│
├── repo_source/               # Original bot code
│
├── pyproject.toml             # Python deps
├── .env                       # API keys (gitignored)
├── .env.example               # Template
├── README.md                  # Documentation
└── *.sh                       # Helper scripts
```

## Key Design Decisions

### 1. SQLite Database
- Single file database
- No server setup required
- Fast for read-heavy workloads
- Easy backup and migration

### 2. Word Normalization
- All words stored in lowercase
- Preserves original casing in display
- Enables case-insensitive search
- Reduces duplicate entries

### 3. Percentage Calculation
- Store total_words per protocol
- Calculate percentage on-demand
- Allows both views (raw & %)
- No data duplication

### 4. Local Asset Bundling
- No CDN dependencies
- Works offline
- Faster load times
- Version control

### 5. API Design
- RESTful endpoints
- JSON responses
- Clear resource hierarchy
- Stateless server

## Security Considerations

### Current Implementation
- Read-only API (no writes)
- No authentication required
- CORS enabled for localhost
- Environment variables for secrets

### Production Considerations
- Add authentication
- Restrict CORS origins
- Rate limiting
- HTTPS only
- Input validation

## Performance Optimizations

### Database
- Indexes on frequent queries
- Normalized schema
- Connection pooling (SQLite default)

### Frontend
- Debounced search (300ms)
- React component memoization
- Lazy loading potential
- Code splitting via Vite

### API
- Efficient SQL queries
- Pagination support (limit parameter)
- No N+1 queries
- Response caching potential

## Scalability Path

### Current (Local Development)
- SQLite database
- Single server
- No caching
- ~1-10 users

### Future (Production)
- PostgreSQL database
- Multiple API servers
- Redis caching
- Load balancer
- ~100-1000 users

## Deployment Options

### Option 1: Docker
```
docker-compose.yml
  ├─ Backend container
  ├─ Frontend container (nginx)
  └─ Shared volume for DB
```

### Option 2: Traditional
```
Server
  ├─ Nginx (reverse proxy)
  ├─ Uvicorn (backend)
  └─ Static files (frontend build)
```

### Option 3: Cloud Platform
```
Platform (Heroku, Railway, etc.)
  ├─ Backend dyno
  ├─ Frontend static hosting
  └─ Database addon
```

## Monitoring & Logging

### Current
- Console logs
- Error messages
- Status endpoint

### Production Ready
- Structured logging
- Error tracking (Sentry)
- Performance monitoring
- Database metrics
- API analytics

## Extension Points

### Easy Additions
- More search filters
- Date range selection
- CSV export
- Word comparison charts

### Medium Complexity
- Speaker attribution
- Party analysis
- Trending words
- Full-text search

### Advanced Features
- Real-time updates
- User accounts
- Saved searches
- Custom dashboards
- ML-powered insights
