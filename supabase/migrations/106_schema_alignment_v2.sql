-- Migration 106: Schema Alignment V2
-- Consolidates gaps found by cross-referencing backend code, frontend direct
-- Supabase calls, and the existing migration set. Integrates stranded migrations
-- from src/supabase/migrations/ (057, 058) that were never applied.

-- ============================================================================
-- GAP 1: categories table (used by src/supabase/categories.js, project routes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    display_name TEXT,
    color TEXT,
    icon TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_project ON categories(project_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage project categories" ON categories
    FOR ALL
    USING (
        project_id IS NULL
        OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = categories.project_id
              AND pm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        project_id IS NULL
        OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = categories.project_id
              AND pm.user_id = auth.uid()
        )
    );

COMMENT ON TABLE categories IS 'Global and project-scoped categories for organizing facts, decisions, etc.';

-- ============================================================================
-- GAP 2: sprints.status and sprints.goals columns
-- (frontend Sprint type, PATCH /api/sprints/:id/status, storage.js)
-- ============================================================================
ALTER TABLE sprints
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planning'
        CHECK (status IN ('planning', 'active', 'completed'));

ALTER TABLE sprints
    ADD COLUMN IF NOT EXISTS goals JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(project_id, status);

COMMENT ON COLUMN sprints.status IS 'Sprint lifecycle: planning -> active -> completed';
COMMENT ON COLUMN sprints.goals IS 'JSON array of sprint goal strings';

-- ============================================================================
-- GAP 3: find_semantic_neighbors RPC
-- (called by frontend graph-api.ts via supabase.rpc)
-- Originally in stranded src/supabase/migrations/057_graph_v3_schema.sql
-- ============================================================================
CREATE OR REPLACE FUNCTION find_semantic_neighbors(
    p_entity_id uuid,
    p_project_id uuid,
    p_threshold float DEFAULT 0.78,
    p_limit int DEFAULT 10
)
RETURNS TABLE (
    entity_type text,
    entity_id uuid,
    content text,
    similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
    SELECT
        e2.entity_type,
        e2.entity_id,
        e2.content,
        (1 - (e1.embedding <=> e2.embedding))::float AS similarity
    FROM embeddings e1
    JOIN embeddings e2
        ON e1.project_id = e2.project_id
        AND e1.entity_id != e2.entity_id
    WHERE e1.entity_id = p_entity_id
        AND e1.project_id = p_project_id
        AND e2.project_id = p_project_id
        AND (1 - (e1.embedding <=> e2.embedding)) > p_threshold
    ORDER BY similarity DESC
    LIMIT p_limit;
$$;

COMMENT ON FUNCTION find_semantic_neighbors IS 'Vector similarity search across embeddings for the knowledge graph';

-- ============================================================================
-- GAP 4: graph_views table
-- (used by frontend useSavedViews.ts via direct Supabase client)
-- Originally in stranded src/supabase/migrations/058_graph_infra.sql
-- Note: migration 053 created graph_saved_views (different name/FK target).
-- The frontend uses graph_views referencing auth.users, so we create it as-is.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.graph_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_shared BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_graph_views_project ON public.graph_views(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_views_user ON public.graph_views(project_id, user_id);

ALTER TABLE public.graph_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own or shared views" ON public.graph_views
    FOR SELECT USING (user_id = auth.uid() OR is_shared = true);

CREATE POLICY "Users can insert own views" ON public.graph_views
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own views" ON public.graph_views
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own views" ON public.graph_views
    FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE public.graph_views IS 'Saved graph configurations (filters, layout, camera) used by the frontend';

-- ============================================================================
-- GAP 5: actions view (alias for action_items)
-- (RelationshipInferrer.js queries .from('actions'))
-- Follows the same pattern as the 'questions' view (migration 081/083)
-- ============================================================================
CREATE OR REPLACE VIEW actions WITH (security_invoker = on) AS
SELECT * FROM action_items;

COMMENT ON VIEW actions IS 'Alias for action_items (used by RelationshipInferrer and ontology code)';

-- ============================================================================
-- GAP 6: transcripts view (alias for krisp_transcripts)
-- (RelationshipInferrer.js queries .from('transcripts'))
-- ============================================================================
CREATE OR REPLACE VIEW transcripts WITH (security_invoker = on) AS
SELECT * FROM krisp_transcripts;

COMMENT ON VIEW transcripts IS 'Alias for krisp_transcripts (used by RelationshipInferrer)';

-- ============================================================================
-- GAP 7: Contact FK columns on knowledge entities
-- Originally in stranded src/supabase/migrations/057_graph_v3_schema.sql
-- Links entities to contacts for reliable identity resolution.
-- ============================================================================

-- action_items
ALTER TABLE public.action_items
    ADD COLUMN IF NOT EXISTS owner_contact_id UUID REFERENCES public.contacts(id);
ALTER TABLE public.action_items
    ADD COLUMN IF NOT EXISTS requested_by_contact_id UUID REFERENCES public.contacts(id);

-- decisions
ALTER TABLE public.decisions
    ADD COLUMN IF NOT EXISTS owner_contact_id UUID REFERENCES public.contacts(id);
ALTER TABLE public.decisions
    ADD COLUMN IF NOT EXISTS made_by_contact_id UUID REFERENCES public.contacts(id);
ALTER TABLE public.decisions
    ADD COLUMN IF NOT EXISTS approved_by_contact_id UUID REFERENCES public.contacts(id);

-- risks
ALTER TABLE public.risks
    ADD COLUMN IF NOT EXISTS owner_contact_id UUID REFERENCES public.contacts(id);

-- knowledge_questions
ALTER TABLE public.knowledge_questions
    ADD COLUMN IF NOT EXISTS assigned_to_contact_id UUID REFERENCES public.contacts(id);
ALTER TABLE public.knowledge_questions
    ADD COLUMN IF NOT EXISTS answered_by_contact_id UUID REFERENCES public.contacts(id);

-- user_stories
ALTER TABLE public.user_stories
    ADD COLUMN IF NOT EXISTS requested_by_contact_id UUID REFERENCES public.contacts(id);

-- Indexes for the new FK columns (speeds up joins and lookups)
CREATE INDEX IF NOT EXISTS idx_action_items_owner_contact ON action_items(owner_contact_id) WHERE owner_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_owner_contact ON decisions(owner_contact_id) WHERE owner_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_risks_owner_contact ON risks(owner_contact_id) WHERE owner_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_assigned_contact ON knowledge_questions(assigned_to_contact_id) WHERE assigned_to_contact_id IS NOT NULL;

-- ============================================================================
-- GAP 8: Graph performance indexes and unique constraint
-- Originally in stranded src/supabase/migrations/057_graph_v3_schema.sql
-- ============================================================================

-- Unique constraint: one sync status per project+graph pair
ALTER TABLE public.graph_sync_status
    DROP CONSTRAINT IF EXISTS graph_sync_status_project_graph_unique;
ALTER TABLE public.graph_sync_status
    ADD CONSTRAINT graph_sync_status_project_graph_unique
    UNIQUE (project_id, graph_name);

-- Graph traversal indexes
CREATE INDEX IF NOT EXISTS idx_graph_nodes_project_graph
    ON public.graph_nodes (project_id, graph_name);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_label
    ON public.graph_nodes (label);
CREATE INDEX IF NOT EXISTS idx_graph_rels_project_graph
    ON public.graph_relationships (project_id, graph_name);
CREATE INDEX IF NOT EXISTS idx_graph_rels_from
    ON public.graph_relationships (from_id);
CREATE INDEX IF NOT EXISTS idx_graph_rels_to
    ON public.graph_relationships (to_id);
CREATE INDEX IF NOT EXISTS idx_graph_rels_type
    ON public.graph_relationships (type);
