-- PostgreSQL Schema for Bundestag Word Tracker
-- Optimized schema with PostgreSQL-specific features

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- Trigram similarity
CREATE EXTENSION IF NOT EXISTS btree_gin; -- Better indexing
CREATE EXTENSION IF NOT EXISTS unaccent;  -- Accent-insensitive search

-- Protocols table
CREATE TABLE IF NOT EXISTS protocols (
    id TEXT PRIMARY KEY,
    wahlperiode INTEGER NOT NULL,
    protokollnummer INTEGER NOT NULL,
    datum DATE NOT NULL,
    titel TEXT,
    pdf_url TEXT,
    total_words INTEGER,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wahlperiode, protokollnummer)
);

-- Words table with enhanced features
CREATE TABLE IF NOT EXISTS words (
    word_id SERIAL PRIMARY KEY,
    word TEXT UNIQUE NOT NULL,
    first_protocol_id TEXT REFERENCES protocols(id),

    -- NLP metadata
    base_lemma TEXT,
    gendered_lemma TEXT,
    gender TEXT,
    pos_tag TEXT,

    -- Compound word info (JSONB for better querying)
    is_compound BOOLEAN DEFAULT FALSE,
    compound_parts JSONB DEFAULT '[]'::jsonb,

    -- Analysis metadata
    analysis_source TEXT,
    confidence TEXT,

    -- Speaker information
    first_speaker_id INTEGER,
    optv_link TEXT,
    speaker_checked BOOLEAN DEFAULT FALSE,
    party_at_time_id INTEGER,

    -- Full-text search vector (auto-updated)
    search_vector tsvector,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Word occurrences table
CREATE TABLE IF NOT EXISTS word_occurrences (
    id SERIAL PRIMARY KEY,
    word_id INTEGER NOT NULL REFERENCES words(word_id) ON DELETE CASCADE,
    protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    count INTEGER NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(word_id, protocol_id)
);

-- Parties table
CREATE TABLE IF NOT EXISTS parties (
    party_id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    short_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Speakers table
CREATE TABLE IF NOT EXISTS speakers (
    speaker_id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    party_id INTEGER REFERENCES parties(party_id),
    optv_link TEXT,
    bundestag_id TEXT,
    birth_date TEXT,
    birth_place TEXT,
    profession TEXT,
    electoral_district TEXT,
    metadata_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wahlperiode metadata table
CREATE TABLE IF NOT EXISTS wahlperiode_metadata (
    wp_number INTEGER PRIMARY KEY,
    start_date TEXT,
    end_date TEXT,
    election_date TEXT,
    chancellor TEXT,
    bundestag_president TEXT,
    coalition TEXT,
    total_seats INTEGER,
    parliament_composition JSONB,
    cabinet_members JSONB,
    wikidata_json JSONB,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraints (with IF NOT EXISTS to avoid errors on re-initialization)
ALTER TABLE words
    DROP CONSTRAINT IF EXISTS fk_words_first_speaker;
ALTER TABLE words
    ADD CONSTRAINT fk_words_first_speaker
    FOREIGN KEY (first_speaker_id) REFERENCES speakers(speaker_id);

ALTER TABLE words
    DROP CONSTRAINT IF EXISTS fk_words_party_at_time;
ALTER TABLE words
    ADD CONSTRAINT fk_words_party_at_time
    FOREIGN KEY (party_at_time_id) REFERENCES parties(party_id);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Protocol indexes
CREATE INDEX IF NOT EXISTS idx_protocols_date ON protocols(datum);
CREATE INDEX IF NOT EXISTS idx_protocols_wp ON protocols(wahlperiode);
CREATE INDEX IF NOT EXISTS idx_protocols_processed ON protocols(processed);
CREATE INDEX IF NOT EXISTS idx_protocols_processed_date ON protocols(processed, datum);
CREATE INDEX IF NOT EXISTS idx_protocols_wp_num ON protocols(wahlperiode, protokollnummer);

-- Word indexes
CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);
CREATE INDEX IF NOT EXISTS idx_words_gendered_lemma ON words(gendered_lemma);
CREATE INDEX IF NOT EXISTS idx_words_gender ON words(gender);
CREATE INDEX IF NOT EXISTS idx_words_pos_tag ON words(pos_tag);
CREATE INDEX IF NOT EXISTS idx_words_speaker ON words(first_speaker_id);
CREATE INDEX IF NOT EXISTS idx_words_party_at_time ON words(party_at_time_id);
CREATE INDEX IF NOT EXISTS idx_words_speaker_protocol ON words(first_speaker_id, first_protocol_id);

-- Full-text search index (GIN for best performance)
CREATE INDEX IF NOT EXISTS idx_words_search_vector ON words USING GIN(search_vector);

-- Trigram index for fuzzy/similarity search
CREATE INDEX IF NOT EXISTS idx_words_trigram ON words USING GIN(word gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_words_lemma_trigram ON words USING GIN(gendered_lemma gin_trgm_ops);

-- JSONB indexes for compound parts
CREATE INDEX IF NOT EXISTS idx_words_compound_parts ON words USING GIN(compound_parts);

-- Word occurrence indexes
CREATE INDEX IF NOT EXISTS idx_word_occurrences_word_id ON word_occurrences(word_id);
CREATE INDEX IF NOT EXISTS idx_word_occurrences_date ON word_occurrences(date);
CREATE INDEX IF NOT EXISTS idx_word_occurrences_protocol_id ON word_occurrences(protocol_id);
CREATE INDEX IF NOT EXISTS idx_word_occurrences_word_date ON word_occurrences(word_id, date);
CREATE INDEX IF NOT EXISTS idx_word_occurrences_protocol_count ON word_occurrences(protocol_id, count);

-- Speaker indexes
CREATE INDEX IF NOT EXISTS idx_speakers_party ON speakers(party_id);
CREATE INDEX IF NOT EXISTS idx_speakers_name ON speakers(name);

-- Party indexes
CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name);

-- Wahlperiode indexes
CREATE INDEX IF NOT EXISTS idx_wp_dates ON wahlperiode_metadata(start_date, end_date);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update search_vector when word changes
CREATE OR REPLACE FUNCTION words_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('german', coalesce(NEW.word, '')), 'A') ||
        setweight(to_tsvector('german', coalesce(NEW.gendered_lemma, '')), 'B') ||
        setweight(to_tsvector('german', coalesce(NEW.base_lemma, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update BEFORE INSERT OR UPDATE ON words
    FOR EACH ROW EXECUTE FUNCTION words_search_vector_update();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_protocols_updated_at BEFORE UPDATE ON protocols
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_words_updated_at BEFORE UPDATE ON words
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MATERIALIZED VIEWS (for fast analytics)
-- ============================================================================

-- Word statistics (pre-aggregated)
CREATE MATERIALIZED VIEW IF NOT EXISTS word_statistics AS
SELECT
    w.word_id,
    w.word,
    w.gendered_lemma,
    w.gender,
    w.pos_tag,
    COUNT(wo.id) AS occurrence_count,
    SUM(wo.count) AS total_count,
    MIN(wo.date) AS first_date,
    MAX(wo.date) AS last_date,
    COUNT(DISTINCT wo.protocol_id) AS protocol_count,
    AVG(wo.count) AS avg_count_per_protocol
FROM words w
LEFT JOIN word_occurrences wo ON w.word_id = wo.word_id
GROUP BY w.word_id, w.word, w.gendered_lemma, w.gender, w.pos_tag;

CREATE UNIQUE INDEX ON word_statistics(word_id);
CREATE INDEX ON word_statistics(word);
CREATE INDEX ON word_statistics(total_count DESC);

-- Wahlperiode statistics (pre-aggregated)
CREATE MATERIALIZED VIEW IF NOT EXISTS wahlperiode_statistics AS
SELECT
    p.wahlperiode,
    COUNT(DISTINCT p.id) AS protocol_count,
    COUNT(DISTINCT CASE WHEN p.processed THEN p.id END) AS processed_count,
    SUM(p.total_words) AS total_words,
    COUNT(DISTINCT wo.word_id) AS unique_words,
    SUM(wo.count) AS total_word_occurrences,
    COUNT(DISTINCT w.first_speaker_id) AS speaker_count,
    MIN(p.datum) AS start_date,
    MAX(p.datum) AS end_date
FROM protocols p
LEFT JOIN word_occurrences wo ON p.id = wo.protocol_id
LEFT JOIN words w ON wo.word_id = w.word_id AND w.first_protocol_id = p.id
GROUP BY p.wahlperiode;

CREATE UNIQUE INDEX ON wahlperiode_statistics(wahlperiode);

-- ============================================================================
-- PARTITIONING (optional, for large datasets)
-- ============================================================================

-- Uncomment these if dataset exceeds 1M words

-- CREATE TABLE word_occurrences_wp19 PARTITION OF word_occurrences
-- FOR VALUES IN (
--     SELECT id FROM protocols WHERE wahlperiode = 19
-- );

-- CREATE TABLE word_occurrences_wp20 PARTITION OF word_occurrences
-- FOR VALUES IN (
--     SELECT id FROM protocols WHERE wahlperiode = 20
-- );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_statistics() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY word_statistics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY wahlperiode_statistics;
END;
$$ LANGUAGE plpgsql;

-- Function for fuzzy word search
CREATE OR REPLACE FUNCTION fuzzy_search_words(search_term TEXT, max_results INTEGER DEFAULT 20)
RETURNS TABLE (
    word TEXT,
    word_id INTEGER,
    similarity_score REAL,
    occurrence_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.word,
        w.word_id,
        similarity(w.word, search_term) AS similarity_score,
        ws.occurrence_count
    FROM words w
    JOIN word_statistics ws ON w.word_id = ws.word_id
    WHERE w.word % search_term  -- Trigram similarity operator
    ORDER BY similarity_score DESC, ws.occurrence_count DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS (adjust for your user)
-- ============================================================================

-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bundestag_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bundestag_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO bundestag_user;

-- ============================================================================
-- VACUUM & ANALYZE
-- ============================================================================

-- Run this after initial data load
-- VACUUM ANALYZE;

COMMENT ON TABLE words IS 'Stores unique words with NLP analysis and metadata';
COMMENT ON TABLE word_occurrences IS 'Stores word frequency per protocol';
COMMENT ON TABLE protocols IS 'Bundestag protocol metadata';
COMMENT ON COLUMN words.search_vector IS 'Auto-updated full-text search vector';
COMMENT ON MATERIALIZED VIEW word_statistics IS 'Pre-aggregated word statistics for fast queries';
