# Quick Start Guide

This guide will get you up and running quickly with sample data.

## Step 1: Setup

1. Copy the environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your Bundestag API key:
```
BUNDESTAG_API_KEY=your_key_here
```

Get a free API key from: https://dip.bundestag.de/uber-dip/hilfe/api

## Step 2: Install Dependencies

```bash
# Backend (Python)
uv sync

# Frontend (Node.js)
cd frontend
npm install
cd ..
```

## Step 3: Get Sample Data

Let's discover and process a small set of protocols for testing:

```bash
# Discover first 50 protocols
uv run python backend/process_protocols.py discover 1 50

# Process the first 5 protocols
uv run python backend/process_protocols.py process 5

# Check status
uv run python backend/process_protocols.py status
```

This will take a few minutes depending on your internet connection.

## Step 4: Start the Application

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
./start_backend.sh
# Or: uv run python backend/api.py
```

**Terminal 2 - Frontend:**
```bash
./start_frontend.sh
# Or: cd frontend && npm run dev
```

## Step 5: Use the Application

1. Open your browser to: http://localhost:5173
2. Search for a word that you know exists in the protocols
3. Click on a result to see the timeline

## Common Words to Try

Some common German political terms you can search for:
- bundestag
- regierung
- deutschland
- europa
- politik
- gesetz

## Next Steps

Once you verify everything works with sample data:

1. Discover more protocols:
```bash
# Discover protocols in batches
uv run python backend/process_protocols.py discover 50 100
uv run python backend/process_protocols.py discover 150 100
```

2. Process all discovered protocols:
```bash
uv run python backend/process_protocols.py process
```

Note: Processing all historical protocols can take several hours. Start with smaller batches to test.

## Troubleshooting

### "Word not found"
- You need to process more protocols
- Try searching for more common words like "bundestag" or "deutschland"

### API errors
- Make sure your API key is correct in `.env`
- Check that you have internet connectivity
- Some protocol IDs may not exist - this is normal

### Frontend won't start
- Make sure you ran `npm install` in the frontend directory
- Check that port 5173 is not already in use

### Backend won't start
- Make sure you ran `uv sync`
- Check that port 8000 is not already in use
- Verify the database was created: `ls backend/bundestag.db`

## Development Tips

- The backend will auto-reload when you change Python files (thanks to uvicorn --reload)
- The frontend will hot-reload when you change React files (thanks to Vite)
- Database is stored in `backend/bundestag.db`
- XML files are cached in `backend/archive/`
