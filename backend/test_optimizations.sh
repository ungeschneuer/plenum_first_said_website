#!/bin/bash

# Comprehensive Test Suite für Optimierungen Phase 1 + 2
# Tests: Compression, Caching, Full-Text Search

echo "=================================="
echo "Optimierungs-Tests"
echo "=================================="
echo

# API Endpoint
API="http://127.0.0.1:8000"

echo "### Test 1: GZip Compression ###"
echo
echo "Timeline ohne Compression:"
SIZE_UNCOMPRESSED=$(curl -s "$API/api/words/deutschland/timeline" | wc -c)
echo "  Size: $SIZE_UNCOMPRESSED bytes"

echo "Timeline mit Compression (raw gzip):"
SIZE_COMPRESSED=$(curl -s -H "Accept-Encoding: gzip" "$API/api/words/deutschland/timeline" | wc -c)
echo "  Size: $SIZE_COMPRESSED bytes"

COMPRESSION_RATIO=$(echo "scale=1; $SIZE_UNCOMPRESSED / $SIZE_COMPRESSED" | bc)
SAVINGS=$(echo "scale=1; 100 - ($SIZE_COMPRESSED * 100 / $SIZE_UNCOMPRESSED)" | bc)
echo "  Compression: ${COMPRESSION_RATIO}x kleiner (${SAVINGS}% gespart)"
echo

echo "### Test 2: Cache Headers ###"
echo
echo "Timeline Cache Headers:"
curl -s -I "$API/api/words/deutschland/timeline" | grep -i "cache-control\|etag"
echo

echo "Details Cache Headers:"
curl -s -I "$API/api/words/deutschland/details" | grep -i "cache-control\|etag"
echo

echo "Wahlperioden Cache Headers:"
curl -s -I "$API/api/wahlperioden" | grep -i "cache-control"
echo

echo "### Test 3: Full-Text Search Qualität ###"
echo
echo "Suche: 'klima' (sollte Klimaschutz, Klimawandel finden)"
curl -s "$API/api/words/search?q=klima&limit=5" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data:
    print(f\"  - {item['word']} ({item['occurrence_count']}x)\")
"
echo

echo "Suche: 'deutsch' (sollte Deutschland, deutscher finden)"
curl -s "$API/api/words/search?q=deutsch&limit=5" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data:
    print(f\"  - {item['word']} ({item['occurrence_count']}x)\")
"
echo

echo "Suche: 'bundestag' (sollte Compound Words finden)"
curl -s "$API/api/words/search?q=bundestag&limit=5" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data:
    print(f\"  - {item['word']} ({item['occurrence_count']}x)\")
"
echo

echo "### Test 4: Performance (10 Requests) ###"
echo
echo "Timeline Performance:"
TOTAL_TIME=0
for i in {1..10}; do
    TIME=$(curl -s -w "%{time_total}" -o /dev/null "$API/api/words/deutschland/timeline")
    TOTAL_TIME=$(echo "$TOTAL_TIME + $TIME" | bc)
done
AVG_TIME=$(echo "scale=3; $TOTAL_TIME / 10" | bc)
echo "  Durchschnitt: ${AVG_TIME}s (10 Requests)"
echo

echo "Search Performance:"
TOTAL_TIME=0
for i in {1..10}; do
    TIME=$(curl -s -w "%{time_total}" -o /dev/null "$API/api/words/search?q=klima&limit=10")
    TOTAL_TIME=$(echo "$TOTAL_TIME + $TIME" | bc)
done
AVG_TIME=$(echo "scale=3; $TOTAL_TIME / 10" | bc)
echo "  Durchschnitt: ${AVG_TIME}s (10 Requests)"
echo

echo "### Test 5: Verschiedene Search-Strategien ###"
echo
echo "Prefix Match (kurze Query):"
curl -s "$API/api/words/search?q=bund&limit=3" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f\"  Ergebnisse: {len(data)}\")
for item in data[:3]:
    print(f\"    - {item['word']}\")
"
echo

echo "Fuzzy Match (Tippfehler):"
curl -s "$API/api/words/search?q=deutch&limit=3" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f\"  Ergebnisse: {len(data)}\")
for item in data[:3]:
    print(f\"    - {item['word']}\")
"
echo

echo "Stemming (deutsche Wortformen):"
curl -s "$API/api/words/search?q=klimaschutz&limit=5" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f\"  Ergebnisse: {len(data)}\")
for item in data[:5]:
    print(f\"    - {item['word']}\")
"
echo

echo "### Test 6: Edge Cases ###"
echo
echo "Leere Query:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/words/search?q=&limit=5")
if [ "$HTTP_CODE" = "422" ]; then
    echo "  Status: 422 (korrekt - Validierungsfehler)"
else
    echo "  Status: $HTTP_CODE (sollte 422 sein!)"
fi
echo

echo "Sehr kurze Query (1 Zeichen):"
RESULT=$(curl -s "$API/api/words/search?q=a&limit=5")
COUNT=$(echo "$RESULT" | python3 -c "import json, sys; print(len(json.load(sys.stdin)))")
echo "  Ergebnisse: $COUNT"
echo

echo "Nicht-existierendes Wort:"
RESULT=$(curl -s "$API/api/words/search?q=xyz123abc&limit=5")
COUNT=$(echo "$RESULT" | python3 -c "import json, sys; print(len(json.load(sys.stdin)))")
echo "  Ergebnisse: $COUNT (sollte 0 oder sehr wenig sein)"
echo

echo "### Test 7: Status Check ###"
echo
curl -s "$API/api/status" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f\"  Total Protocols: {data['total_protocols']}\")
print(f\"  Processed: {data['processed_protocols']}\")
print(f\"  Unprocessed: {data['unprocessed_protocols']}\")
"
echo

echo "=================================="
echo "Tests abgeschlossen!"
echo "=================================="
