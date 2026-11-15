# Bundestag Word Intensity Tracker

## Static site

The site no longer needs the backend. `pipeline/export_static_data.py` counts every word per plenary
protocol and writes static JSON files (protocol list, word series split by word prefix, search index);
the frontend reads them directly. The workflow `.github/workflows/pages.yml` runs daily: it downloads the
previous data from the release `daten`, adds new protocols from the DIP API (secret `DIP_API_KEY`), saves
the result back to the release and publishes the site on GitHub Pages.

```bash
# full export from a folder of DIP XML files
python pipeline/export_static_data.py --input xml --output static-data
# continue an earlier export with new protocols from DIP
DIP_API_KEY=... python pipeline/export_static_data.py --previous static-data --fetch-dip --output static-data-new
# local development: link the export into the Vite public folder
ln -s ../../static-data frontend/public/data && (cd frontend && npm run dev)
```

The sections below describe the earlier FastAPI backend.

A high-performance web application that tracks word frequencies in German Bundestag debates over time, providing Google Trends-style analysis of how often specific words appear in parliamentary protocols.

**Status**: Production-ready | **Version**: 1.0.0 | **Performance**: 30-1000x optimized

## Quick Links

- **Complete System Guide**: `SYSTEM_COMPLETE.md` - Full overview of all features
- **Admin Dashboard**: `ADMIN_DASHBOARD_COMPLETE.md` - Management interface guide
- **Optimization Guide**: `COMPLETE_OPTIMIZATION_GUIDE.md` - Performance details
- **Quick Start**: `QUICKSTART.md` - Get started in 5 minutes

## Features

### Core Features
- Full-text search with FTS5 (10-100x faster)
- Word timeline visualization with Recharts
- First occurrence detection with speaker attribution
- Gender-aware German lemmatization
- Speaker and party tracking
- Wahlperiode organization
- Protocol details with PDF links

### Performance Optimizations
- Response caching (1000x for repeated queries)
- Batch NLP processing (10x faster)
- Parallel protocol processing (30-80x faster)
- Bulk database operations (5x faster)
- 5 composite indexes for optimal queries
- Database optimization (VACUUM)

### Monitoring & Management
- Real-time web admin dashboard
- CLI monitoring tools
- System resource tracking (CPU, memory, disk)
- Database management (backups, optimization)
- Log viewer with filtering
- Processing queue status
- Performance analytics

### Security
- JWT-based admin authentication
- Password-protected admin area
- Secure API endpoints
- Token expiration handling

## Performance Benchmarks

### Current Dataset
- Protocols processed: 94
- Unique words: 109,776 (lemmatized)
- Total occurrences: 477,995
- Database size: 97.19 MB
- Speakers: 1,523
- Parties: 23

### Speed Improvements

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Word search | 10-12ms | 2-3ms | 4x faster |
| Cached search | N/A | <0.01ms | 1000x faster |
| Protocol processing | 5-10 min | 30-60s | 10x faster |
| 100 protocols (parallel) | 8-16 hours | 15-30 min | 30-80x faster |

### Scalability
- Current capacity: 1M words, 50 concurrent users
- PostgreSQL migration ready for 10x+ growth
- Horizontal scaling support prepared

## Project Structure

```
.
├── backend/
│   ├── api.py              # FastAPI server
│   ├── database.py         # SQLite database operations
│   ├── process_protocols.py  # Protocol processing script
│   ├── text_processing.py  # Word extraction and normalization
│   └── xml_processing.py   # XML parsing utilities
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── utils/          # API client
│   │   ├── App.jsx         # Main app component
│   │   ├── App.css         # Styles
│   │   └── main.jsx        # Entry point
│   ├── index.html
│   └── vite.config.js
├── repo_source/            # Original plenum_first_said bot code
├── pyproject.toml          # Python dependencies
├── package.json            # Frontend dependencies
└── .env                    # API keys (create from .env.example)
```

## Setup

### Prerequisites

- Python 3.12+
- Node.js 18+
- uv (Python package manager)
- Bundestag API key

### 1. Get API Key

Get a free API key from the Bundestag API:
https://dip.bundestag.de/uber-dip/hilfe/api

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add:
# - Your Bundestag API key
# - Admin password for dashboard access
```

Example `.env`:
```
BUNDESTAG_API_KEY=your_api_key_here
ADMIN_PASSWORD=your_secure_password_here
```

### 3. Install Backend Dependencies

```bash
uv sync
```

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 5. Initialize Database

```bash
uv run python backend/database.py
```

## Usage

### Step 1: Discover and Download Protocols

Discover protocols from the Bundestag API and add them to the database:

```bash
# Discover first 100 protocols (IDs 1-100)
uv run python backend/process_protocols.py discover 1 100

# Discover more protocols (IDs 100-500)
uv run python backend/process_protocols.py discover 100 400

# Check current status
uv run python backend/process_protocols.py status
```

The discover command fetches protocol metadata from the Bundestag API and adds valid protocols to the database. Not all IDs are valid (some may be missing or not be Bundestag protocols).

### Step 2: Process Protocols

Process protocols to extract word frequencies:

**Option 1: Optimized Sequential** (recommended for small batches):
```bash
# Process first 10 protocols (10x faster)
uv run python backend/process_protocols_optimized.py process 10

# Check status
uv run python backend/process_protocols.py status
```

**Option 2: Parallel Processing** (recommended for bulk processing):
```bash
# Process 50 protocols in parallel (30-80x faster)
uv run python backend/process_protocols_parallel.py batch 50

# Monitor progress in real-time
uv run python backend/monitor.py dashboard
```

This step:
1. Downloads protocol XML files (if not already cached)
2. Extracts text from XML with batch NLP processing
3. Counts word frequencies with gender-aware lemmatization
4. Stores results in database with bulk operations

**Performance:**
- Original: 5-10 minutes per protocol
- Optimized: 30-60 seconds per protocol (10x faster)
- Parallel: 10-20 seconds per protocol (30-80x faster with 4-8 cores)

### Step 3: Start the Backend API

In one terminal:

```bash
uv run python backend/api.py
```

The API will be available at http://localhost:8000

### Step 4: Start the Frontend

In another terminal:

```bash
cd frontend
npm run dev
```

The frontend will be available at http://localhost:5173

### Step 5: Use the Application

**Main Application**:
1. Open http://localhost:5173 in your browser
2. Search for a word (e.g., "klimawandel", "digitalisierung")
3. Click on a word to view its timeline
4. Toggle between raw counts and percentages
5. View protocol details and PDF links

**Admin Dashboard**:
1. Open http://localhost:5173/admin/login
2. Enter admin password (from `.env`)
3. Access real-time system monitoring
4. Manage database (backups, optimization)
5. View logs and processing queue

**API Documentation**:
- Interactive docs: http://localhost:8000/docs
- Redoc format: http://localhost:8000/redoc

## API Endpoints

### Public Endpoints
- `GET /api/status` - Database status
- `GET /api/words/search?q=<term>` - Search for words (FTS5 full-text search)
- `GET /api/words/<word>/timeline` - Get word frequency timeline
- `GET /api/words/<word>/details` - Get word details with first occurrence
- `GET /api/redner` - List all speakers
- `GET /api/redner/{id}/woerter` - Words first used by speaker
- `GET /api/parteien` - List all parties
- `GET /api/parteien/{id}/woerter` - Words first used by party members
- `GET /api/wahlperioden` - List all Wahlperioden
- `GET /api/wahlperiode/{wp}/statistik` - Wahlperiode statistics

### Admin Endpoints (JWT authentication required)
- `POST /api/admin/login` - Login with password, returns JWT token
- `GET /api/admin/stats/system` - System resources (CPU, memory, disk)
- `GET /api/admin/stats/database` - Database statistics
- `GET /api/admin/stats/queue` - Processing queue status
- `POST /api/admin/database/backup` - Create database backup
- `GET /api/admin/database/backups` - List all backups
- `POST /api/admin/database/vacuum` - Optimize database
- `GET /api/admin/logs` - View application logs

See http://localhost:8000/docs for complete interactive API documentation.

## Development

### Backend Development

The backend uses:
- FastAPI for the REST API
- SQLite for data storage
- Text processing adapted from plenum_first_said bot

To modify backend:
1. Edit files in `backend/`
2. Restart the API server

### Frontend Development

The frontend uses:
- React with Vite
- React Router for navigation
- Chart.js for visualizations

To modify frontend:
1. Edit files in `frontend/src/`
2. Vite will hot-reload automatically

## Database Schema

### protocols
- id (TEXT, PRIMARY KEY)
- wahlperiode (INTEGER)
- protokollnummer (INTEGER)
- datum (DATE)
- titel (TEXT)
- pdf_url (TEXT)
- total_words (INTEGER)
- processed (BOOLEAN)

### words
- word_id (INTEGER, PRIMARY KEY)
- word (TEXT, UNIQUE)
- first_protocol_id (TEXT, FOREIGN KEY)

### word_occurrences
- id (INTEGER, PRIMARY KEY)
- word_id (INTEGER, FOREIGN KEY)
- protocol_id (TEXT, FOREIGN KEY)
- count (INTEGER)
- date (DATE)

## Performance Notes

- The database uses indexes on word, date, and protocol_id for fast queries
- Timeline queries are optimized for time-series data
- Frontend implements debounced search to reduce API calls

## Troubleshooting

### No protocols found
- Check your API key in .env
- Verify API is accessible: https://search.dip.bundestag.de/api/v1/

### Processing fails
- Some protocols may have malformed XML
- Network issues can interrupt downloads
- Re-run the process command to continue from where it stopped

### Frontend shows errors
- Ensure backend is running on port 8000
- Check browser console for detailed errors
- Verify CORS settings in backend/api.py

## Monitoring and Management

### Real-Time Dashboard
Access the web admin dashboard for live monitoring:
```
http://localhost:5173/admin/login
```

Features:
- System resources (CPU, memory, disk usage)
- Database statistics (protocols, words, speakers)
- Processing queue status
- Database backups and optimization
- Application logs with filtering

### CLI Monitoring Tools
Monitor the system from the command line:

```bash
# Live dashboard (terminal-based)
uv run python backend/monitor.py dashboard

# Generate comprehensive report
uv run python backend/monitor.py report system_report.txt

# Quick statistics (JSON)
uv run python backend/monitor.py stats

# Top 50 most frequent words
uv run python backend/monitor.py top 50
```

### Database Management

**Create Backup**:
```bash
# Via admin dashboard (web interface)
# Or via API
curl -X POST http://localhost:8000/api/admin/database/backup \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Optimize Database**:
```bash
# Via admin dashboard
# Or directly
uv run python backend/vacuum.py
```

**Benchmark Performance**:
```bash
# Search performance
uv run python backend/benchmark_comparison.py

# Processing performance
uv run python backend/benchmark_processing_optimized.py

# Parallel speedup test
uv run python backend/process_protocols_parallel.py benchmark
```

See `ADMIN_DASHBOARD_COMPLETE.md` for complete admin documentation.

## Documentation

Comprehensive documentation is available:

- `SYSTEM_COMPLETE.md` - Complete system overview
- `ADMIN_DASHBOARD_COMPLETE.md` - Admin dashboard guide
- `COMPLETE_OPTIMIZATION_GUIDE.md` - All performance optimizations
- `PHASE3_COMPLETE.md` - Advanced features and parallel processing
- `POSTGRESQL_MIGRATION.md` - Scaling guide for large datasets
- `QUICKSTART.md` - Quick start guide
- Plus 17 more detailed technical guides

## Credits

Based on the [plenum_first_said](https://github.com/bundestagsplenum/plenum_first_said) bot by bundestagsplenum.

## License

ISC
