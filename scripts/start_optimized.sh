#!/bin/bash

# Quick start script for optimized setup with Redis caching

set -e

echo "=========================================="
echo "  Starting Bundestag Tracker (Optimized)"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found${NC}"
    echo "  Install Docker from: https://www.docker.com/get-started"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ docker-compose not found${NC}"
    echo "  Install docker-compose or use Docker Desktop"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker is installed"
echo ""

# Start Redis
echo "Starting Redis..."
if docker ps | grep -q bundestag_redis; then
    echo -e "${YELLOW}⊘${NC} Redis already running"
else
    docker-compose up -d redis
    echo -e "${GREEN}✓${NC} Redis started"
fi
echo ""

# Wait for Redis to be ready
echo "Waiting for Redis..."
for i in {1..10}; do
    if docker exec bundestag_redis redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✓${NC} Redis is ready"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}✗${NC} Redis failed to start"
        exit 1
    fi
    sleep 1
done
echo ""

# Check if database optimization has been run
echo "Checking database optimization..."
if psql -d bundestag -c "\d word_stats" &> /dev/null; then
    echo -e "${YELLOW}⊘${NC} Database already optimized"
else
    echo -e "${YELLOW}!${NC} Running database optimization..."
    uv run python backend/optimize_database.py
    echo -e "${GREEN}✓${NC} Database optimized"
fi
echo ""

# Start the backend
echo "Starting backend API..."
echo -e "${YELLOW}→${NC} Running on http://localhost:8000"
echo ""

cd backend
uv run uvicorn api:app --reload --host 0.0.0.0 --port 8000
