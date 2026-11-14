# Get Started in 5 Minutes

This is the fastest way to get the Bundestag Word Tracker running.

## Prerequisites

You need:
- Python 3.12+
- Node.js 18+
- uv (Python package manager)
- Bundestag API key

## Quick Setup

### 1. Get API Key (2 minutes)

Visit: https://dip.bundestag.de/uber-dip/hilfe/api

Request a free API key.

### 2. Configure Environment (30 seconds)

```bash
cp .env.example .env
# Edit .env and paste your API key
```

### 3. Install Dependencies (1 minute)

```bash
# Python dependencies
uv sync

# Frontend dependencies
cd frontend
npm install
cd ..
```

### 4. Load Sample Data (2 minutes)

```bash
./setup_sample_data.sh
```

This will discover and process 5 sample protocols.

### 5. Start the Application (30 seconds)

Open two terminal windows:

**Terminal 1:**
```bash
./start_backend.sh
```

**Terminal 2:**
```bash
./start_frontend.sh
```

### 6. Use the App

Open browser to: http://localhost:5173

Search for common words like:
- bundestag
- deutschland
- regierung
- europa

## That's It!

You now have a working word frequency tracker.

## Next Steps

Want more data?

```bash
# Discover more protocols
uv run python backend/process_protocols.py discover 50 100

# Process them
uv run python backend/process_protocols.py process

# Check progress
uv run python backend/process_protocols.py status
```

## Need Help?

- Full documentation: `README.md`
- Architecture overview: `ARCHITECTURE.md`
- Troubleshooting: `QUICKSTART.md`
- Verify setup: `./verify_setup.sh`

## Common Issues

**"Word not found"**
- You need more protocols processed
- Try common words first

**"API error"**
- Check your API key in .env
- Verify internet connection

**Port already in use**
- Backend uses port 8000
- Frontend uses port 5173
- Change in respective config files if needed

## Features to Try

1. Search for a word
2. View the timeline chart
3. Toggle between raw counts and percentages
4. Click "View PDF" to see original protocols
5. Check the protocol details table

Enjoy tracking Bundestag word trends!
