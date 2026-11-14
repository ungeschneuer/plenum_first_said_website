-- Full-Text Search Setup für Bundestag Word Tracker
-- Optimiert für deutsche Sprache
--
-- Funktionsweise:
-- 1. search_vector Spalte wird automatisch befüllt
-- 2. Gewichtung: word (A) > gendered_lemma (B) > base_lemma (C)
-- 3. Deutsche Stemming mit 'german' dictionary

-- 1. Trigger-Funktion für automatische Updates
CREATE OR REPLACE FUNCTION words_search_vector_update() RETURNS trigger AS $$
BEGIN
    -- Erstelle search_vector mit Gewichtung
    -- A = höchste Priorität (exakte Wortform)
    -- B = mittlere Priorität (gendered lemma)
    -- C = niedrige Priorität (base lemma)
    NEW.search_vector :=
        setweight(to_tsvector('german', COALESCE(NEW.word, '')), 'A') ||
        setweight(to_tsvector('german', COALESCE(NEW.gendered_lemma, '')), 'B') ||
        setweight(to_tsvector('german', COALESCE(NEW.base_lemma, '')), 'C');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger erstellen (für INSERT und UPDATE)
DROP TRIGGER IF EXISTS words_search_vector_trigger ON words;
CREATE TRIGGER words_search_vector_trigger
    BEFORE INSERT OR UPDATE OF word, gendered_lemma, base_lemma
    ON words
    FOR EACH ROW
    EXECUTE FUNCTION words_search_vector_update();

-- 3. Bestehende Wörter aktualisieren
-- (Kann bei großen Datenmengen lange dauern)
UPDATE words
SET search_vector =
    setweight(to_tsvector('german', COALESCE(word, '')), 'A') ||
    setweight(to_tsvector('german', COALESCE(gendered_lemma, '')), 'B') ||
    setweight(to_tsvector('german', COALESCE(base_lemma, '')), 'C')
WHERE search_vector IS NULL;

-- 4. Index optimieren (falls noch nicht optimal)
-- GIN Index ist bereits vorhanden, aber wir stellen sicher dass er genutzt wird
REINDEX INDEX idx_words_search_vector;

-- 5. Statistiken aktualisieren für Query Planner
ANALYZE words;

-- 6. Überprüfung
SELECT
    COUNT(*) as total_words,
    COUNT(search_vector) as words_with_search_vector,
    COUNT(*) FILTER (WHERE search_vector IS NULL) as missing_search_vector
FROM words;
