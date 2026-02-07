-- ============================================================================
-- Migration 054: Vector Search RPC Function
-- ============================================================================
-- Creates the match_embeddings RPC function for vector similarity search
-- This function is called by the application but was missing from migrations
-- ============================================================================

-- Drop existing function if it exists (for idempotency)
DROP FUNCTION IF EXISTS match_embeddings(vector(1024), float, int, uuid, text[]);
DROP FUNCTION IF EXISTS match_embeddings(vector(1024), float, int, uuid);

-- Create the vector similarity search function
CREATE OR REPLACE FUNCTION match_embeddings(
    query_embedding vector(1024),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    filter_project_id uuid DEFAULT NULL,
    filter_entity_types text[] DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    entity_type text,
    entity_id uuid,
    content text,
    similarity float,
    model text,
    created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.entity_type,
        e.entity_id,
        e.content,
        (1 - (e.embedding <=> query_embedding))::float as similarity,
        e.model,
        e.created_at
    FROM embeddings e
    WHERE 
        (filter_project_id IS NULL OR e.project_id = filter_project_id)
        AND (filter_entity_types IS NULL OR e.entity_type = ANY(filter_entity_types))
        AND (1 - (e.embedding <=> query_embedding)) > match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create optimized index for cosine similarity (if not exists)
-- HNSW index provides approximate nearest neighbor search
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_embeddings_vector_cosine'
    ) THEN
        CREATE INDEX idx_embeddings_vector_cosine 
        ON embeddings USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;
END $$;

-- Also create an index on project_id for filtering
CREATE INDEX IF NOT EXISTS idx_embeddings_project_type 
ON embeddings(project_id, entity_type);

-- Function to search embeddings with entity details joined
CREATE OR REPLACE FUNCTION match_embeddings_with_details(
    query_embedding vector(1024),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    filter_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    entity_type text,
    entity_id uuid,
    content text,
    similarity float,
    entity_data jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH matches AS (
        SELECT 
            e.id,
            e.entity_type,
            e.entity_id,
            e.content,
            (1 - (e.embedding <=> query_embedding))::float as similarity
        FROM embeddings e
        WHERE 
            (filter_project_id IS NULL OR e.project_id = filter_project_id)
            AND (1 - (e.embedding <=> query_embedding)) > match_threshold
        ORDER BY e.embedding <=> query_embedding
        LIMIT match_count
    )
    SELECT 
        m.id,
        m.entity_type,
        m.entity_id,
        m.content,
        m.similarity,
        CASE m.entity_type
            WHEN 'fact' THEN (SELECT to_jsonb(f.*) FROM facts f WHERE f.id = m.entity_id)
            WHEN 'decision' THEN (SELECT to_jsonb(d.*) FROM decisions d WHERE d.id = m.entity_id)
            WHEN 'question' THEN (SELECT to_jsonb(q.*) FROM questions q WHERE q.id = m.entity_id)
            WHEN 'risk' THEN (SELECT to_jsonb(r.*) FROM risks r WHERE r.id = m.entity_id)
            WHEN 'action_item' THEN (SELECT to_jsonb(a.*) FROM action_items a WHERE a.id = m.entity_id)
            WHEN 'person' THEN (SELECT to_jsonb(p.*) FROM people p WHERE p.id = m.entity_id)
            WHEN 'document' THEN (SELECT to_jsonb(doc.*) FROM documents doc WHERE doc.id = m.entity_id)
            ELSE NULL
        END as entity_data
    FROM matches m;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION match_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION match_embeddings TO service_role;
GRANT EXECUTE ON FUNCTION match_embeddings_with_details TO authenticated;
GRANT EXECUTE ON FUNCTION match_embeddings_with_details TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION match_embeddings IS 'Vector similarity search using cosine distance. Returns entities with similarity above threshold.';
COMMENT ON FUNCTION match_embeddings_with_details IS 'Vector similarity search with joined entity data.';
