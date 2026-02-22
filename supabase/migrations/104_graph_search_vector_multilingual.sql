-- Migration: Update graph_nodes search_vector to use 'simple' dictionary
-- for language-agnostic full-text search (supports English, Portuguese, etc.)
-- The previous 'english' dictionary only stemmed English words correctly.

-- Drop the existing generated column and recreate with 'simple' dictionary
ALTER TABLE graph_nodes DROP COLUMN IF EXISTS search_vector;

ALTER TABLE graph_nodes ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(id, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(label, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(properties->>'name', '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(properties->>'title', '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(properties->>'content', '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(properties->>'description', '')), 'C')
) STORED;

-- Recreate the GIN index for the new column
DROP INDEX IF EXISTS idx_graph_nodes_search;
CREATE INDEX idx_graph_nodes_search ON graph_nodes USING GIN (search_vector);
