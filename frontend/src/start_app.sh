#!/bin/bash

echo "========================================================================"
echo "Bundestag Word Tracker - Application Startup"
echo "========================================================================"
echo

# Check if backend is running
if curl -s http://localhost:8000/api/status > /dev/null 2>&1; then
    echo "✓ Backend API is already running on http://localhost:8000"
else
    echo "Starting backend API server..."
    cd backend
    uv run uvicorn api:app --reload --port 8000 > /tmp/bundestag_api.log 2>&1 &
    cd ..
    sleep 3
    
    if curl -s http://localhost:8000/api/status > /dev/null 2>&1; then
        echo "✓ Backend API started successfully"
    else
        echo "✗ Failed to start backend API"
        echo "  Check logs: tail -f /tmp/bundestag_api.log"
        exit 1
    fi
fi

# Check if frontend is running
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✓ Frontend is already running on http://localhost:5173"
else
    echo "Starting frontend development server..."
    cd frontend
    npm run dev > /tmp/bundestag_frontend.log 2>&1 &
    cd ..
    sleep 5
    
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "✓ Frontend started successfully"
    else
        echo "✗ Failed to start frontend"
        echo "  Check logs: tail -f /tmp/bundestag_frontend.log"
        exit 1
    fi
fi

echo
echo "========================================================================"
echo "Application is running!"
echo "========================================================================"
echo
echo "Frontend:  http://localhost:5173"
echo "Backend:   http://localhost:8000"
echo "API Docs:  http://localhost:8000/docs"
echo
echo "Logs:"
echo "  Backend:  tail -f /tmp/bundestag_api.log"
echo "  Frontend: tail -f /tmp/bundestag_frontend.log"
echo
echo "To stop:"
echo "  pkill -f 'uvicorn api:app'"
echo "  pkill -f 'vite'"
echo
