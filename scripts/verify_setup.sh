#!/bin/bash
# Verify that the project is set up correctly

echo "================================================"
echo "Bundestag Word Tracker - Setup Verification"
echo "================================================"
echo ""

EXIT_CODE=0

# Check Python version
echo "Checking Python version..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✓ Python found: $PYTHON_VERSION"
else
    echo "✗ Python not found"
    EXIT_CODE=1
fi

# Check uv
echo "Checking uv..."
if command -v uv &> /dev/null; then
    UV_VERSION=$(uv --version)
    echo "✓ uv found: $UV_VERSION"
else
    echo "✗ uv not found - install from: https://github.com/astral-sh/uv"
    EXIT_CODE=1
fi

# Check Node.js
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✓ Node.js found: $NODE_VERSION"
else
    echo "✗ Node.js not found"
    EXIT_CODE=1
fi

# Check npm
echo "Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✓ npm found: $NPM_VERSION"
else
    echo "✗ npm not found"
    EXIT_CODE=1
fi

echo ""
echo "Checking project files..."

# Check backend files
BACKEND_FILES=("backend/api.py" "backend/database.py" "backend/process_protocols.py" "backend/text_processing.py" "backend/xml_processing.py")
for file in "${BACKEND_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file missing"
        EXIT_CODE=1
    fi
done

# Check frontend files
FRONTEND_FILES=("frontend/src/App.jsx" "frontend/src/main.jsx" "frontend/index.html" "frontend/vite.config.js")
for file in "${FRONTEND_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file missing"
        EXIT_CODE=1
    fi
done

# Check configuration files
CONFIG_FILES=("pyproject.toml" "frontend/package.json" ".env.example" ".gitignore")
for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file missing"
        EXIT_CODE=1
    fi
done

echo ""
echo "Checking dependencies..."

# Check if Python venv exists
if [ -d ".venv" ]; then
    echo "✓ Python virtual environment exists"
else
    echo "⚠ Python virtual environment not found - run: uv sync"
fi

# Check if node_modules exists
if [ -d "frontend/node_modules" ]; then
    echo "✓ Node.js dependencies installed"
else
    echo "⚠ Node.js dependencies not installed - run: cd frontend && npm install"
fi

# Check if .env exists
if [ -f ".env" ]; then
    echo "✓ .env file exists"
    if grep -q "your_api_key_here" .env; then
        echo "⚠ .env file needs API key"
    else
        echo "✓ .env file configured"
    fi
else
    echo "⚠ .env file missing - copy from .env.example"
fi

# Check if database exists
if [ -f "backend/bundestag.db" ]; then
    echo "✓ Database exists"
else
    echo "⚠ Database not initialized - it will be created on first run"
fi

echo ""
echo "================================================"

if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ All checks passed!"
    echo ""
    echo "Next steps:"
    echo "1. If not done: uv sync"
    echo "2. If not done: cd frontend && npm install"
    echo "3. If not done: cp .env.example .env (and add API key)"
    echo "4. Run: ./setup_sample_data.sh"
    echo "5. Run: ./start_backend.sh (in one terminal)"
    echo "6. Run: ./start_frontend.sh (in another terminal)"
else
    echo "✗ Some checks failed - please fix the issues above"
fi

echo "================================================"

exit $EXIT_CODE
