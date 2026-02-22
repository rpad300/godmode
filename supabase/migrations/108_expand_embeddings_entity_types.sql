-- ============================================================================
-- Migration 108: Expand embeddings entity_type CHECK constraint
-- Adds support for additional ontology entity types (email, company, contact,
-- conversation, sprint, user_story, team, meeting, calendar_event) and updates
-- match_embeddings_with_details to join the new tables.
-- ============================================================================

-- 1. Widen the CHECK constraint on embeddings.entity_type
--    Postgres does not support ALTER CONSTRAINT, so we drop and recreate.
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'embeddings'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%entity_type%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE embeddings DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

ALTER TABLE embeddings ADD CONSTRAINT embeddings_entity_type_check
    CHECK (entity_type IN (
        'fact', 'decision', 'risk', 'action', 'question',
        'document', 'chunk', 'person',
        'email', 'company', 'contact', 'conversation',
        'sprint', 'user_story', 'team', 'meeting', 'calendar_event'
    ));

-- 2. Recreate match_embeddings_with_details with joins for the new types
DROP FUNCTION IF EXISTS match_embeddings_with_details(vector(1024), float, int, uuid);

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
            WHEN 'fact'           THEN (SELECT to_jsonb(f.*)   FROM facts f            WHERE f.id = m.entity_id)
            WHEN 'decision'       THEN (SELECT to_jsonb(d.*)   FROM decisions d        WHERE d.id = m.entity_id)
            WHEN 'question'       THEN (SELECT to_jsonb(q.*)   FROM questions q        WHERE q.id = m.entity_id)
            WHEN 'risk'           THEN (SELECT to_jsonb(r.*)   FROM risks r            WHERE r.id = m.entity_id)
            WHEN 'action'         THEN (SELECT to_jsonb(a.*)   FROM action_items a     WHERE a.id = m.entity_id)
            WHEN 'person'         THEN (SELECT to_jsonb(p.*)   FROM people p           WHERE p.id = m.entity_id)
            WHEN 'document'       THEN (SELECT to_jsonb(doc.*) FROM documents doc      WHERE doc.id = m.entity_id)
            WHEN 'email'          THEN (SELECT to_jsonb(em.*)  FROM emails em          WHERE em.id = m.entity_id)
            WHEN 'company'        THEN (SELECT to_jsonb(co.*)  FROM companies co       WHERE co.id = m.entity_id)
            WHEN 'contact'        THEN (SELECT to_jsonb(ct.*)  FROM contacts ct        WHERE ct.id = m.entity_id)
            WHEN 'conversation'   THEN (SELECT to_jsonb(cv.*)  FROM conversations cv   WHERE cv.id = m.entity_id)
            WHEN 'sprint'         THEN (SELECT to_jsonb(sp.*)  FROM sprints sp         WHERE sp.id = m.entity_id)
            WHEN 'user_story'     THEN (SELECT to_jsonb(us.*)  FROM user_stories us    WHERE us.id = m.entity_id)
            WHEN 'team'           THEN (SELECT to_jsonb(tm.*)  FROM teams tm           WHERE tm.id = m.entity_id)
            ELSE NULL
        END as entity_data
    FROM matches m;
END;
$$;

GRANT EXECUTE ON FUNCTION match_embeddings_with_details TO authenticated;
GRANT EXECUTE ON FUNCTION match_embeddings_with_details TO service_role;

COMMENT ON FUNCTION match_embeddings_with_details IS
    'Vector similarity search with joined entity data. Supports all core ontology entity types.';
