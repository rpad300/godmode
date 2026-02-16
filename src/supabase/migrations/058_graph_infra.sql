-- Migration: 058_graph_infra.sql
-- Description: Adds infrastructure for Graph V3 features (Bookmarks & Saved Views)

-- 7.1 Bookmarks
-- Allows users to "pin" nodes for quick access

CREATE TABLE IF NOT EXISTS public.graph_bookmarks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    node_id text NOT NULL, -- Logical ID (e.g., "DOC:123") matches graph_nodes.id
    created_at timestamptz DEFAULT now(),
    
    -- Constraint: One bookmark per node per user per project
    UNIQUE(project_id, user_id, node_id)
);

-- Index for quick lookup of bookmarks in a project
CREATE INDEX IF NOT EXISTS idx_graph_bookmarks_project_user 
ON public.graph_bookmarks (project_id, user_id);


-- 7.2 Saved Views
-- Allows saving filter configurations and layouts

CREATE TABLE IF NOT EXISTS public.graph_views (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- Owner
    name text NOT NULL,
    configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_shared boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- JSONB Structure for configuration:
-- {
--   "filters": {
--     "toggles": { "Person": true, "Risk": false ... },
--     "searchQuery": "",
--     "showSemantic": false
--   },
--   "layout": {
--     "mode": "concentric",
--     "positions": { "node_id": {x, y}, ... } -- Optional manual overrides
--   },
--   "camera": { x, y, zoom }
-- }

-- Index for listing views
CREATE INDEX IF NOT EXISTS idx_graph_views_project 
ON public.graph_views (project_id);

COMMENT ON TABLE public.graph_bookmarks IS 'User-pinned nodes in the knowledge graph';
COMMENT ON TABLE public.graph_views IS 'Saved graph configurations (filters, layout, camera)';
