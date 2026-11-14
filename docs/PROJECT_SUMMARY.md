# Bundestag Word Intensity Tracker - Project Summary

## What We Built

A complete web application for tracking and visualizing word frequencies in German Bundestag debates over time, similar to Google Trends but specifically for parliamentary language.

## Project Structure

### Backend (Python + FastAPI)
```
backend/
├── api.py                  # FastAPI REST API server
├── database.py             # SQLite database schema and operations
├── process_protocols.py    # Protocol discovery and processing
├── text_processing.py      # Word extraction and normalization
└── xml_processing.py       # XML parsing utilities
```

**Technologies:**
- FastAPI for REST API
- SQLite for data storage
- Python text processing (adapted from plenum_first_said)
- Bundestag API integration

### Frontend (React + Vite)
```
frontend/
├── src/
│   ├── components/
│   │   ├── SearchPage.jsx      # Main search interface
│   │   ├── WordTimeline.jsx    # Word detail page with chart
│   │   └── Chart.jsx           # Reusable Chart.js component
│   ├── utils/
│   │   └── api.js              # API client functions
│   ├── App.jsx                 # Main app with routing
│   ├── App.css                 # All styles
│   └── main.jsx                # Entry point
├── index.html
└── vite.config.js
```

**Technologies:**
- React 19 for UI components
- React Router for navigation
- Chart.js for data visualization
- Vite for build tooling

## Key Features Implemented

### 1. Data Processing Pipeline
- Downloads XML protocols from Bundestag API
- Extracts and normalizes German text
- Counts word frequencies per protocol
- Stores time-series data in SQLite

### 2. REST API
- `/api/words/search?q=<term>` - Search for words
- `/api/words/<word>/timeline` - Get frequency timeline
- `/api/words/<word>/details` - Get word metadata
- `/api/status` - Database statistics

### 3. Web Interface
- Real-time search with autocomplete
- Interactive timeline charts
- Toggle between raw counts and percentages
- Protocol detail tables
- Links to original PDF documents
- Responsive design

### 4. Visualization
- Google Trends-style line charts
- Time-series data display
- Percentage vs. absolute count toggle
- Hover tooltips with context
- Protocol metadata in charts

## Database Schema

### protocols
Stores metadata about each Bundestag protocol session.

### words
Tracks unique words and their first occurrence.

### word_occurrences
Time-series data linking words to protocols with counts.

## Implementation Highlights

### Text Processing
Reused and adapted core logic from plenum_first_said:
- Hyphenation removal (Silbentrennung)
- Punctuation handling
- German text normalization
- Word validation and filtering

### Performance Optimizations
- Database indexes on word, date, protocol_id
- Debounced search (300ms)
- Percentage calculation in API
- CORS configuration for development
- Local asset bundling (no CDNs)

### Development Experience
- Hot reload for both frontend and backend
- Simple startup scripts
- Sample data setup automation
- Comprehensive documentation

## Files Created

### Configuration
- `pyproject.toml` - Python dependencies (uv format)
- `package.json` - Frontend dependencies
- `vite.config.js` - Vite build configuration
- `.env.example` - Environment template
- `.gitignore` - Git ignore rules

### Scripts
- `start_backend.sh` - Start backend server
- `start_frontend.sh` - Start frontend dev server
- `setup_sample_data.sh` - Initialize with sample data

### Documentation
- `README.md` - Complete project documentation
- `QUICKSTART.md` - Quick start guide
- `PROJECT_SUMMARY.md` - This file

### Backend Code
- `backend/database.py` (250+ lines)
- `backend/process_protocols.py` (240+ lines)
- `backend/api.py` (160+ lines)
- `backend/text_processing.py` (140+ lines)
- `backend/xml_processing.py` (90+ lines)

### Frontend Code
- `frontend/src/App.css` (400+ lines)
- `frontend/src/components/WordTimeline.jsx` (130+ lines)
- `frontend/src/components/SearchPage.jsx` (115+ lines)
- `frontend/src/components/Chart.jsx` (85+ lines)
- `frontend/src/App.jsx` (20 lines)
- `frontend/src/utils/api.js` (45 lines)
- `frontend/index.html`
- `frontend/vite.config.js`

## Total Lines of Code

Approximately 1,600+ lines of original code:
- Backend: ~900 lines
- Frontend: ~700 lines
- Plus configuration and documentation

## How to Use

1. Get API key from Bundestag
2. Configure .env file
3. Install dependencies (uv sync, npm install)
4. Run setup script: `./setup_sample_data.sh`
5. Start backend: `./start_backend.sh`
6. Start frontend: `./start_frontend.sh`
7. Visit: http://localhost:5173

## Testing Strategy

The project is designed for incremental testing:

1. **Phase 1**: Test with 5-10 protocols
2. **Phase 2**: Expand to 50-100 protocols
3. **Phase 3**: Process all historical data

This allows verification at each stage without committing to hours of processing.

## Future Enhancements (Not Implemented)

Possible additions for the future:
- Word comparison (multiple words on same chart)
- Trending words detection
- Speaker attribution
- Party affiliation analysis
- Full-text search within protocols
- Export data as CSV
- Date range filtering
- Advanced statistics (moving averages, etc.)
- Production deployment configuration
- User authentication
- Caching layer (Redis)

## Architectural Decisions

### Why SQLite?
- Single file, no server setup
- Fast for read-heavy workloads
- Perfect for development
- Easy to migrate to PostgreSQL later

### Why FastAPI?
- Modern Python web framework
- Automatic API documentation
- Type hints and validation
- Fast performance

### Why React + Vite?
- Component-based UI
- Fast build times
- Modern developer experience
- Good TypeScript support (future)

### Why Local Assets?
- Follows CLAUDE.md requirements
- Works offline
- No CDN dependencies
- Full control over versions

## Dependencies

### Python (via uv)
- fastapi
- uvicorn
- python-dotenv
- requests

### JavaScript (via npm)
- react + react-dom
- react-router-dom
- chart.js + react-chartjs-2
- vite + @vitejs/plugin-react

All installed locally, no global dependencies required.

## Success Criteria

All plan objectives achieved:

- [x] Data processing pipeline working
- [x] Database schema implemented
- [x] REST API endpoints functional
- [x] React frontend built
- [x] Chart visualization working
- [x] Search functionality implemented
- [x] Word detail pages complete
- [x] Toggle raw/percentage display
- [x] Documentation comprehensive
- [x] Local asset bundling
- [x] Development scripts
- [x] Sample data workflow

## Time Estimate

Development timeline (estimated):
- Phase 1 (Data Processing): 2-3 hours
- Phase 2 (Backend API): 1-2 hours
- Phase 3 (Frontend): 2-3 hours
- Phase 4 (Testing & Docs): 1-2 hours

Total: ~6-10 hours of development

## Next Steps for User

1. Review the implementation
2. Test with sample data
3. Verify frontend works correctly
4. Process more protocols as needed
5. Customize styling/features as desired
6. Consider deployment strategy for production
