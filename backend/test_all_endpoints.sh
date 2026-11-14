#!/bin/bash

echo "Testing All API Endpoints"
echo "========================================================================"
echo

# Test 1: Search words
echo "1. Search words (query: klima)"
curl -s "http://localhost:8000/api/words/search?q=klima&limit=3" | python3 -m json.tool | head -30
echo

# Test 2: Word timeline
echo "2. Word timeline (word: Deutschem)"
curl -s "http://localhost:8000/api/words/Deutschem/timeline" | python3 -m json.tool | head -20
echo

# Test 3: Word details
echo "3. Word details (word: Deutschem)"
curl -s "http://localhost:8000/api/words/Deutschem/details" | python3 -m json.tool | head -30
echo

# Test 4: Wahlperioden list
echo "4. Wahlperioden list"
curl -s "http://localhost:8000/api/wahlperioden" | python3 -m json.tool
echo

# Test 5: Wahlperiode details
echo "5. Wahlperiode details (WP 16)"
curl -s "http://localhost:8000/api/wahlperiode/16" | python3 -m json.tool | head -30
echo

# Test 6: Wahlperiode protocols
echo "6. Wahlperiode protocols (WP 16, limit 3)"
curl -s "http://localhost:8000/api/wahlperiode/16/protocols?limit=3" | python3 -m json.tool | head -40
echo

# Test 7: Speakers list
echo "7. Speakers list"
curl -s "http://localhost:8000/api/speakers" | python3 -m json.tool | head -30
echo

# Test 8: Parties list
echo "8. Parties list"
curl -s "http://localhost:8000/api/parties" | python3 -m json.tool | head -30
echo

# Test 9: Protocol details
echo "9. Protocol details (protocol 4)"
curl -s "http://localhost:8000/api/protocol/4" | python3 -m json.tool | head -40
echo

echo "========================================================================"
echo "All endpoint tests complete"
