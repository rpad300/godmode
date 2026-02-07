-- ============================================
-- Graph Database Tables for Supabase
-- Native graph storage without external dependencies
-- ============================================

-- Graph Nodes Table
CREATE TABLE IF NOT EXISTS graph_nodes (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    properties JSONB DEFAULT '{}',
    graph_name TEXT NOT NULL DEFAULT 'default',
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Search vector for full-text search
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(id, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(label, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(properties->>'name', '')), 'A') ||
        setweight(to_tsvector('english', coalesce(properties->>'title', '')), 'B') ||
        setweight(to_tsvector('english', coalesce(properties->>'content', '')), 'C') ||
        setweight(to_tsvector('english', coalesce(properties->>'description', '')), 'C')
    ) STORED
);

-- Indexes for nodes
CREATE INDEX IF NOT EXISTS idx_graph_nodes_label ON graph_nodes(label);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_name ON graph_nodes(graph_name);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_project_id ON graph_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_properties ON graph_nodes USING GIN(properties);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_search ON graph_nodes USING GIN(search_vector);

-- Graph Relationships Table
CREATE TABLE IF NOT EXISTS graph_relationships (
    id TEXT PRIMARY KEY,
    from_id TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    to_id TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    properties JSONB DEFAULT '{}',
    graph_name TEXT NOT NULL DEFAULT 'default',
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique relationships
    UNIQUE(from_id, to_id, type, graph_name)
);

-- Indexes for relationships
CREATE INDEX IF NOT EXISTS idx_graph_rel_from ON graph_relationships(from_id);
CREATE INDEX IF NOT EXISTS idx_graph_rel_to ON graph_relationships(to_id);
CREATE INDEX IF NOT EXISTS idx_graph_rel_type ON graph_relationships(type);
CREATE INDEX IF NOT EXISTS idx_graph_rel_graph_name ON graph_relationships(graph_name);
CREATE INDEX IF NOT EXISTS idx_graph_rel_project_id ON graph_relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_rel_properties ON graph_relationships USING GIN(properties);

-- Updated_at trigger for nodes
CREATE OR REPLACE FUNCTION update_graph_nodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_graph_nodes_updated_at ON graph_nodes;
CREATE TRIGGER trigger_graph_nodes_updated_at
    BEFORE UPDATE ON graph_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_graph_nodes_updated_at();

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_relationships ENABLE ROW LEVEL SECURITY;

-- Nodes: Users can see nodes in their projects
DROP POLICY IF EXISTS graph_nodes_select ON graph_nodes;
CREATE POLICY graph_nodes_select ON graph_nodes
    FOR SELECT USING (
        project_id IS NULL 
        OR project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

-- Nodes: Users can insert/update/delete nodes in their projects
DROP POLICY IF EXISTS graph_nodes_insert ON graph_nodes;
CREATE POLICY graph_nodes_insert ON graph_nodes
    FOR INSERT WITH CHECK (
        project_id IS NULL 
        OR project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS graph_nodes_update ON graph_nodes;
CREATE POLICY graph_nodes_update ON graph_nodes
    FOR UPDATE USING (
        project_id IS NULL 
        OR project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS graph_nodes_delete ON graph_nodes;
CREATE POLICY graph_nodes_delete ON graph_nodes
    FOR DELETE USING (
        project_id IS NULL 
        OR project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

-- Relationships: Same policies
DROP POLICY IF EXISTS graph_rel_select ON graph_relationships;
CREATE POLICY graph_rel_select ON graph_relationships
    FOR SELECT USING (
        project_id IS NULL 
        OR project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS graph_rel_insert ON graph_relationships;
CREATE POLICY graph_rel_insert ON graph_relationships
    FOR INSERT WITH CHECK (
        project_id IS NULL 
        OR project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS graph_rel_update ON graph_relationships;
CREATE POLICY graph_rel_update ON graph_relationships
    FOR UPDATE USING (
        project_id IS NULL 
        OR project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS graph_rel_delete ON graph_relationships;
CREATE POLICY graph_rel_delete ON graph_relationships
    FOR DELETE USING (
        project_id IS NULL 
        OR project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- Helper Functions
-- ============================================

-- Test connection function
CREATE OR REPLACE FUNCTION graph_test_connection()
RETURNS TEXT AS $$
BEGIN
    RETURN 'Connected to Supabase Graph';
END;
$$ LANGUAGE plpgsql;

-- Get node neighbors (outgoing relationships)
CREATE OR REPLACE FUNCTION graph_get_neighbors(
    p_node_id TEXT,
    p_graph_name TEXT DEFAULT 'default',
    p_rel_type TEXT DEFAULT NULL,
    p_limit INT DEFAULT 100
)
RETURNS TABLE (
    node_id TEXT,
    node_label TEXT,
    node_properties JSONB,
    rel_id TEXT,
    rel_type TEXT,
    rel_properties JSONB,
    direction TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Outgoing relationships
    SELECT 
        n.id,
        n.label,
        n.properties,
        r.id,
        r.type,
        r.properties,
        'outgoing'::TEXT
    FROM graph_relationships r
    JOIN graph_nodes n ON r.to_id = n.id
    WHERE r.from_id = p_node_id
      AND r.graph_name = p_graph_name
      AND (p_rel_type IS NULL OR r.type = p_rel_type)
    
    UNION ALL
    
    -- Incoming relationships
    SELECT 
        n.id,
        n.label,
        n.properties,
        r.id,
        r.type,
        r.properties,
        'incoming'::TEXT
    FROM graph_relationships r
    JOIN graph_nodes n ON r.from_id = n.id
    WHERE r.to_id = p_node_id
      AND r.graph_name = p_graph_name
      AND (p_rel_type IS NULL OR r.type = p_rel_type)
    
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get shortest path between two nodes (BFS up to depth 5)
CREATE OR REPLACE FUNCTION graph_shortest_path(
    p_from_id TEXT,
    p_to_id TEXT,
    p_graph_name TEXT DEFAULT 'default',
    p_max_depth INT DEFAULT 5
)
RETURNS TABLE (
    path_nodes TEXT[],
    path_rels TEXT[],
    depth INT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE path_search AS (
        -- Start from source node
        SELECT 
            ARRAY[p_from_id] AS nodes,
            ARRAY[]::TEXT[] AS rels,
            1 AS depth,
            p_from_id = p_to_id AS found
        
        UNION ALL
        
        SELECT 
            ps.nodes || r.to_id,
            ps.rels || r.id,
            ps.depth + 1,
            r.to_id = p_to_id
        FROM path_search ps
        JOIN graph_relationships r ON r.from_id = ps.nodes[array_length(ps.nodes, 1)]
        WHERE NOT ps.found
          AND ps.depth < p_max_depth
          AND r.graph_name = p_graph_name
          AND NOT r.to_id = ANY(ps.nodes)  -- Avoid cycles
    )
    SELECT nodes, rels, depth
    FROM path_search
    WHERE found
    ORDER BY depth
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Get graph statistics
CREATE OR REPLACE FUNCTION graph_stats(p_graph_name TEXT DEFAULT 'default')
RETURNS TABLE (
    node_count BIGINT,
    relationship_count BIGINT,
    label_distribution JSONB,
    type_distribution JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM graph_nodes WHERE graph_name = p_graph_name),
        (SELECT COUNT(*) FROM graph_relationships WHERE graph_name = p_graph_name),
        (
            SELECT jsonb_object_agg(label, cnt)
            FROM (
                SELECT label, COUNT(*) as cnt 
                FROM graph_nodes 
                WHERE graph_name = p_graph_name 
                GROUP BY label
            ) labels
        ),
        (
            SELECT jsonb_object_agg(type, cnt)
            FROM (
                SELECT type, COUNT(*) as cnt 
                FROM graph_relationships 
                WHERE graph_name = p_graph_name 
                GROUP BY type
            ) types
        );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Service role bypass for admin operations
-- ============================================

-- Allow service role full access (for server-side operations)
DROP POLICY IF EXISTS graph_nodes_service ON graph_nodes;
CREATE POLICY graph_nodes_service ON graph_nodes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS graph_rel_service ON graph_relationships;
CREATE POLICY graph_rel_service ON graph_relationships
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE graph_nodes IS 'Stores graph nodes with labels and properties';
COMMENT ON TABLE graph_relationships IS 'Stores directed relationships between nodes';
COMMENT ON FUNCTION graph_get_neighbors IS 'Get all neighbors of a node (incoming and outgoing)';
COMMENT ON FUNCTION graph_shortest_path IS 'Find shortest path between two nodes using BFS';
COMMENT ON FUNCTION graph_stats IS 'Get statistics for a graph';
