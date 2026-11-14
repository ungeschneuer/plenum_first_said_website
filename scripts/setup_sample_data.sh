#!/bin/bash
# Setup sample data for testing the application

echo "================================================"
echo "Bundestag Word Tracker - Sample Data Setup"
echo "================================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and add your API key."
    exit 1
fi

# Check if API key is set
if grep -q "your_api_key_here" .env; then
    echo "Error: Please set your BUNDESTAG_API_KEY in .env file"
    exit 1
fi

echo "Step 1: Discovering protocols..."
echo "This will discover the first 50 protocol IDs from the Bundestag API"
echo ""
uv run python backend/process_protocols.py discover 1 50

echo ""
echo "Step 2: Processing protocols..."
echo "This will process the first 5 protocols to extract word frequencies"
echo ""
uv run python backend/process_protocols.py process 5

echo ""
echo "Step 3: Checking status..."
uv run python backend/process_protocols.py status

echo ""
echo "================================================"
echo "Sample data setup complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Start the backend:  ./start_backend.sh"
echo "2. Start the frontend: ./start_frontend.sh"
echo "3. Open browser to:    http://localhost:5173"
echo ""
