-- ============================================
-- Knowledge Graph SOTA UI Tables
-- Persistence for queries, views, bookmarks, annotations, chat, snapshots
-- ============================================

-- ============================================
-- 1. GRAPH QUERY HISTORY
-- Stores Cypher and natural language queries for reuse
-- ============================================
CREATE TABLE IF NOT EXISTS graph_query_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    query_type TEXT NOT NULL CHECK (query_type IN ('cypher', 'natural_language', 'visual', 'template')),
    query_text TEXT NOT NULL,
    query_name TEXT, -- Optional name for favorites
    generated_cypher TEXT, -- For NL queries, the generated Cypher
    result_count INTEGER,
    execution_time_ms INTEGER,
    is_favorite BOOLEAN DEFAULT false,
    tags TEXT[], -- Optional tags for organization
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata (filters used, etc.)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for query history
CREATE INDEX IF NOT EXISTS idx_graph_query_history_project ON graph_query_history(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_query_history_user ON graph_query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_query_history_favorite ON graph_query_history(project_id, user_id) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_graph_query_history_created ON graph_query_history(created_at DESC);

-- RLS for query history
ALTER TABLE graph_query_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own query history" ON graph_query_history
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own query history" ON graph_query_history
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own query history" ON graph_query_history
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own query history" ON graph_query_history
    FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- 2. GRAPH SAVED VIEWS (Perspectives)
-- Stores filter configurations, layouts, zoom settings
-- ============================================
CREATE TABLE IF NOT EXISTS graph_saved_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    view_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- view_config structure:
    -- {
    --   filters: { entityTypes: [], communityIds: [], dateRange: {} },
    --   layout: { type: 'physics'|'hierarchical'|'manual', positions: {} },
    --   zoom: { scale: 1, position: {x, y} },
    --   selectedNodes: [],
    --   highlightedPaths: [],
    --   communityColors: {},
    --   showLabels: true,
    --   showEdgeLabels: false
    -- }
    thumbnail_url TEXT, -- Optional preview image
    is_default BOOLEAN DEFAULT false,
    is_shared BOOLEAN DEFAULT false, -- Share with team members
    shared_with TEXT[] DEFAULT '{}', -- Specific user IDs or 'all'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for saved views
CREATE INDEX IF NOT EXISTS idx_graph_saved_views_project ON graph_saved_views(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_saved_views_user ON graph_saved_views(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_saved_views_shared ON graph_saved_views(project_id) WHERE is_shared = true;

-- RLS for saved views
ALTER TABLE graph_saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own views" ON graph_saved_views
    FOR SELECT USING (user_id = auth.uid() OR is_shared = true);

CREATE POLICY "Users can insert own views" ON graph_saved_views
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own views" ON graph_saved_views
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own views" ON graph_saved_views
    FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- 3. GRAPH BOOKMARKS
-- Favorite nodes for quick access
-- ============================================
CREATE TABLE IF NOT EXISTS graph_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL, -- ID of the node in the graph
    node_type TEXT NOT NULL, -- Person, Project, Decision, etc.
    node_label TEXT NOT NULL, -- Display name
    node_avatar_url TEXT, -- For Person nodes
    note TEXT, -- Optional note
    color TEXT, -- Optional highlight color
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, user_id, node_id)
);

-- Indexes for bookmarks
CREATE INDEX IF NOT EXISTS idx_graph_bookmarks_project_user ON graph_bookmarks(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_graph_bookmarks_node_type ON graph_bookmarks(node_type);

-- RLS for bookmarks
ALTER TABLE graph_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks" ON graph_bookmarks
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own bookmarks" ON graph_bookmarks
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own bookmarks" ON graph_bookmarks
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own bookmarks" ON graph_bookmarks
    FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- 4. GRAPH ANNOTATIONS
-- Notes and highlights on nodes/edges
-- ============================================
CREATE TABLE IF NOT EXISTS graph_annotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('node', 'edge', 'path', 'region')),
    target_id TEXT NOT NULL, -- Node ID, Edge ID, or path description
    target_label TEXT, -- Display label for the target
    content TEXT NOT NULL, -- The annotation content
    annotation_type TEXT DEFAULT 'note' CHECK (annotation_type IN ('note', 'warning', 'highlight', 'question', 'todo')),
    color TEXT, -- Highlight color
    icon TEXT, -- Optional icon
    is_shared BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false, -- For questions/todos
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES user_profiles(id),
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional data (position, style, etc.)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for annotations
CREATE INDEX IF NOT EXISTS idx_graph_annotations_project ON graph_annotations(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_annotations_target ON graph_annotations(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_graph_annotations_shared ON graph_annotations(project_id) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_graph_annotations_unresolved ON graph_annotations(project_id) WHERE is_resolved = false;

-- RLS for annotations
ALTER TABLE graph_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and shared annotations" ON graph_annotations
    FOR SELECT USING (user_id = auth.uid() OR is_shared = true);

CREATE POLICY "Users can insert own annotations" ON graph_annotations
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own annotations" ON graph_annotations
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own annotations" ON graph_annotations
    FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- 5. GRAPH CHAT HISTORY
-- AI Copilot conversation persistence
-- ============================================
CREATE TABLE IF NOT EXISTS graph_chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    session_id UUID NOT NULL, -- Group messages by session
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    -- metadata structure:
    -- {
    --   queryType: 'structural'|'semantic'|'hybrid',
    --   cypherGenerated: '...',
    --   sources: [...],
    --   reasoningChain: [...],
    --   highlightedNodes: [...],
    --   executionTimeMs: 123,
    --   confidence: 0.95,
    --   isVoiceInput: false
    -- }
    is_pinned BOOLEAN DEFAULT false, -- Pin important messages
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for chat history
CREATE INDEX IF NOT EXISTS idx_graph_chat_project_user ON graph_chat_history(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_graph_chat_session ON graph_chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_graph_chat_created ON graph_chat_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_chat_pinned ON graph_chat_history(project_id, user_id) WHERE is_pinned = true;

-- Full-text search on chat content
CREATE INDEX IF NOT EXISTS idx_graph_chat_content_search ON graph_chat_history USING gin(to_tsvector('portuguese', content));

-- RLS for chat history
ALTER TABLE graph_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat history" ON graph_chat_history
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chat messages" ON graph_chat_history
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chat messages" ON graph_chat_history
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own chat messages" ON graph_chat_history
    FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- 6. GRAPH SNAPSHOTS
-- Point-in-time graph states for time travel
-- ============================================
CREATE TABLE IF NOT EXISTS graph_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    snapshot_type TEXT DEFAULT 'manual' CHECK (snapshot_type IN ('manual', 'auto', 'milestone', 'before_change')),
    snapshot_data JSONB NOT NULL,
    -- snapshot_data structure:
    -- {
    --   nodes: [...],
    --   edges: [...],
    --   stats: { nodeCount, edgeCount, byType: {} },
    --   communities: [...],
    --   capturedAt: '...'
    -- }
    node_count INTEGER,
    edge_count INTEGER,
    file_size_bytes INTEGER, -- Size of snapshot_data
    is_baseline BOOLEAN DEFAULT false, -- Mark as baseline for comparison
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for snapshots
CREATE INDEX IF NOT EXISTS idx_graph_snapshots_project ON graph_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_snapshots_user ON graph_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_snapshots_created ON graph_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_snapshots_baseline ON graph_snapshots(project_id) WHERE is_baseline = true;

-- RLS for snapshots
ALTER TABLE graph_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project snapshots" ON graph_snapshots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_members.project_id = graph_snapshots.project_id 
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert snapshots" ON graph_snapshots
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own snapshots" ON graph_snapshots
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own snapshots" ON graph_snapshots
    FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get user's recent queries
CREATE OR REPLACE FUNCTION get_recent_graph_queries(
    p_project_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    query_type TEXT,
    query_text TEXT,
    query_name TEXT,
    is_favorite BOOLEAN,
    result_count INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gqh.id,
        gqh.query_type,
        gqh.query_text,
        gqh.query_name,
        gqh.is_favorite,
        gqh.result_count,
        gqh.created_at
    FROM graph_query_history gqh
    WHERE gqh.project_id = p_project_id
    AND gqh.user_id = auth.uid()
    ORDER BY gqh.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get chat session messages
CREATE OR REPLACE FUNCTION get_graph_chat_session(
    p_session_id UUID
)
RETURNS TABLE (
    id UUID,
    role TEXT,
    content TEXT,
    metadata JSONB,
    is_pinned BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gch.id,
        gch.role,
        gch.content,
        gch.metadata,
        gch.is_pinned,
        gch.created_at
    FROM graph_chat_history gch
    WHERE gch.session_id = p_session_id
    AND gch.user_id = auth.uid()
    ORDER BY gch.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to compare two snapshots
CREATE OR REPLACE FUNCTION compare_graph_snapshots(
    p_snapshot_id_1 UUID,
    p_snapshot_id_2 UUID
)
RETURNS JSONB AS $$
DECLARE
    v_snapshot_1 JSONB;
    v_snapshot_2 JSONB;
    v_result JSONB;
BEGIN
    SELECT snapshot_data INTO v_snapshot_1
    FROM graph_snapshots
    WHERE id = p_snapshot_id_1;
    
    SELECT snapshot_data INTO v_snapshot_2
    FROM graph_snapshots
    WHERE id = p_snapshot_id_2;
    
    IF v_snapshot_1 IS NULL OR v_snapshot_2 IS NULL THEN
        RETURN jsonb_build_object('error', 'Snapshot not found');
    END IF;
    
    v_result := jsonb_build_object(
        'snapshot1', jsonb_build_object(
            'nodeCount', (v_snapshot_1->'stats'->>'nodeCount')::integer,
            'edgeCount', (v_snapshot_1->'stats'->>'edgeCount')::integer
        ),
        'snapshot2', jsonb_build_object(
            'nodeCount', (v_snapshot_2->'stats'->>'nodeCount')::integer,
            'edgeCount', (v_snapshot_2->'stats'->>'edgeCount')::integer
        ),
        'diff', jsonb_build_object(
            'nodeCountDiff', (v_snapshot_2->'stats'->>'nodeCount')::integer - (v_snapshot_1->'stats'->>'nodeCount')::integer,
            'edgeCountDiff', (v_snapshot_2->'stats'->>'edgeCount')::integer - (v_snapshot_1->'stats'->>'edgeCount')::integer
        )
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for saved_views
CREATE OR REPLACE FUNCTION update_graph_saved_views_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_graph_saved_views_updated ON graph_saved_views;
CREATE TRIGGER trigger_graph_saved_views_updated
    BEFORE UPDATE ON graph_saved_views
    FOR EACH ROW
    EXECUTE FUNCTION update_graph_saved_views_timestamp();

-- Auto-update updated_at for annotations
DROP TRIGGER IF EXISTS trigger_graph_annotations_updated ON graph_annotations;
CREATE TRIGGER trigger_graph_annotations_updated
    BEFORE UPDATE ON graph_annotations
    FOR EACH ROW
    EXECUTE FUNCTION update_graph_saved_views_timestamp();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE graph_query_history IS 'Stores user query history for the Knowledge Graph UI (Cypher, NL, visual queries)';
COMMENT ON TABLE graph_saved_views IS 'Stores saved graph perspectives/views with filters, layouts, and settings';
COMMENT ON TABLE graph_bookmarks IS 'Stores bookmarked/favorite graph nodes for quick access';
COMMENT ON TABLE graph_annotations IS 'Stores user annotations (notes, highlights) on graph nodes and edges';
COMMENT ON TABLE graph_chat_history IS 'Stores AI Copilot conversation history per session';
COMMENT ON TABLE graph_snapshots IS 'Stores point-in-time graph snapshots for time travel and comparison';
