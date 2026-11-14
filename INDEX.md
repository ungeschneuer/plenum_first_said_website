# Bundestag Word Intensity Tracker - Documentation Index

## Start Here

**New to the project?** Read these in order:

1. **[GET_STARTED.md](GET_STARTED.md)** - 5-minute quick start guide
2. **[QUICKSTART.md](QUICKSTART.md)** - Detailed quick start with examples
3. **[README.md](README.md)** - Complete project documentation

## Reference Documentation

### Understanding the Project
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - What we built and why
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design and data flow
- **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)** - Implementation details

### Configuration Files
- **[.env.example](.env.example)** - Environment template (copy to `.env`)
- **[pyproject.toml](pyproject.toml)** - Python dependencies
- **[frontend/package.json](frontend/package.json)** - Frontend dependencies

## Helper Scripts

### Setup & Verification
```bash
./verify_setup.sh        # Check if everything is installed correctly
./setup_sample_data.sh   # Load 5 sample protocols for testing
```

### Running the Application
```bash
./start_backend.sh       # Start the API server (port 8000)
./start_frontend.sh      # Start the web interface (port 5173)
```

### Data Management
```bash
# Discover protocols
uv run python backend/process_protocols.py discover [start_id] [count]

# Process protocols
uv run python backend/process_protocols.py process [limit]

# Check status
uv run python backend/process_protocols.py status
```

## Code Organization

### Backend (Python)
```
backend/
├── api.py                  # FastAPI server with REST endpoints
├── database.py             # SQLite database operations
├── process_protocols.py    # Protocol discovery and processing
├── text_processing.py      # Word extraction and normalization
└── xml_processing.py       # XML parsing from Bundestag API
```

### Frontend (React)
```
frontend/src/
├── components/
│   ├── SearchPage.jsx      # Search interface
│   ├── WordTimeline.jsx    # Word detail page with chart
│   └── Chart.jsx           # Chart.js wrapper component
├── utils/
│   └── api.js              # API client functions
├── App.jsx                 # Main app with routing
├── App.css                 # All styles (responsive design)
└── main.jsx                # React entry point
```

## Quick Reference

### API Endpoints
- `GET /api/status` - Database statistics
- `GET /api/words/search?q=<term>` - Search for words
- `GET /api/words/<word>/timeline` - Get word frequency timeline
- `GET /api/words/<word>/details` - Get word metadata

### Common Commands
```bash
# Setup
cp .env.example .env        # Create environment file
uv sync                     # Install Python dependencies
cd frontend && npm install  # Install frontend dependencies

# Development
./start_backend.sh          # Start backend (port 8000)
./start_frontend.sh         # Start frontend (port 5173)

# Testing
./verify_setup.sh           # Verify installation
./setup_sample_data.sh      # Load sample data

# Data loading
uv run python backend/process_protocols.py discover 1 50   # Find protocols
uv run python backend/process_protocols.py process 5       # Process 5
uv run python backend/process_protocols.py status          # Check status
```

### URLs
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs (FastAPI auto-generated)

## Troubleshooting Guide

### Setup Issues
1. Run `./verify_setup.sh` to check installation
2. Make sure you have Python 3.12+, Node.js 18+, and uv installed
3. Verify `.env` file exists with valid API key

### Runtime Issues
1. Check both backend and frontend are running
2. Verify ports 8000 and 5173 are not in use
3. Look for errors in terminal output
4. Check browser console for frontend errors

### Data Issues
1. Make sure you've run `./setup_sample_data.sh` or processed protocols
2. Verify database exists: `ls backend/bundestag.db`
3. Check status: `uv run python backend/process_protocols.py status`

## Features Implemented

- [x] Word search with autocomplete
- [x] Time-series visualization (Google Trends style)
- [x] Toggle between raw counts and percentages
- [x] First occurrence tracking
- [x] Links to original PDF protocols
- [x] Protocol detail tables
- [x] Responsive design
- [x] Real-time search with debouncing
- [x] Database status display
- [x] Error handling and loading states

## Technology Stack

**Backend:**
- Python 3.12+
- FastAPI (REST API)
- SQLite (Database)
- uvicorn (ASGI Server)

**Frontend:**
- React 19 (UI Framework)
- Vite (Build Tool)
- React Router (Navigation)
- Chart.js (Visualization)

**Tools:**
- uv (Python Package Manager)
- npm (Node Package Manager)

## Getting Help

1. Check the relevant documentation file above
2. Run `./verify_setup.sh` for setup issues
3. Read the error messages carefully
4. Check that all dependencies are installed
5. Verify your API key is correct

## Project Status

**Status:** ✓ COMPLETE AND READY TO USE

All components implemented:
- Backend API with 4 endpoints
- SQLite database with optimized schema
- React frontend with 3 main components
- Word processing pipeline
- Chart visualization
- Helper scripts and documentation

**Next Steps for You:**
1. Get Bundestag API key
2. Configure `.env` file
3. Run `./setup_sample_data.sh`
4. Start backend and frontend
5. Open http://localhost:5173

Enjoy tracking word trends in the Bundestag!
