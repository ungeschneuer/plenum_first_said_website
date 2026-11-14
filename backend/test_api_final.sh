#!/bin/bash

# Start API in background
cd /Users/marcel/Developer/plenum_first_said_website/backend
uv run uvicorn api:app --host 127.0.0.1 --port 8000 > /tmp/api_final.log 2>&1 &
API_PID=$!

echo "API started with PID: $API_PID"
echo "Waiting for API to start..."
sleep 5

echo
echo "=== FINAL API TESTS (PostgreSQL + Case-Insensitive) ==="
echo

echo "1. Status Endpoint:"
curl -s "http://127.0.0.1:8000/api/status"
echo
echo

echo "2. Timeline für 'deutschland' (kleingeschrieben):"
curl -s "http://127.0.0.1:8000/api/words/deutschland/timeline" | head -c 500
echo
echo

echo "3. Details für 'deutschland' (kleingeschrieben):"
curl -s "http://127.0.0.1:8000/api/words/deutschland/details" | head -c 500
echo
echo

echo "4. Timeline für 'bundesregierung' (kleingeschrieben):"
curl -s "http://127.0.0.1:8000/api/words/bundesregierung/timeline" | head -c 300
echo
echo

# Stop API
echo "Stopping API..."
kill $API_PID 2>/dev/null
wait $API_PID 2>/dev/null

echo
echo "=== TESTS ABGESCHLOSSEN ==="
