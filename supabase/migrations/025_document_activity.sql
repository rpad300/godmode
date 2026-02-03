-- ============================================
-- GodMode Phase 25: Document Activity Log
-- Track all actions on documents
-- ============================================

-- ============================================
-- DOCUMENT ACTIVITY
-- Audit trail for document actions
-- ============================================
CREATE TABLE IF NOT EXISTS document_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    
    -- Action details
    action TEXT NOT NULL CHECK (action IN (
        'created',
        'viewed',
        'downloaded',
        'updated',
        'version_uploaded',
        'analyzed',
        'reprocessed',
        'shared',
        'unshared',
        'deleted',
        'restored',
        'tagged',
        'favorited',
        'unfavorited',
        'commented'
    )),
    
    -- Additional context
    details JSONB DEFAULT '{}',
    
    -- Request info
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_doc_activity_document ON document_activity(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_activity_project ON document_activity(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_activity_user ON document_activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_activity_action ON document_activity(action);

-- ============================================
-- DOCUMENT FAVORITES
-- Track user favorites
-- ============================================
CREATE TABLE IF NOT EXISTS document_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_favorites_user ON document_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_favorites_document ON document_favorites(document_id);

-- ============================================
-- DOCUMENT VIEW TRACKING
-- Track recent views per user
-- ============================================
CREATE TABLE IF NOT EXISTS document_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    view_count INTEGER DEFAULT 1,
    first_viewed_at TIMESTAMPTZ DEFAULT now(),
    last_viewed_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_views_user ON document_views(user_id, last_viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_views_document ON document_views(document_id);

-- ============================================
-- FUNCTION: Track Document View
-- ============================================
CREATE OR REPLACE FUNCTION track_document_view(
    p_document_id UUID,
    p_user_id UUID,
    p_project_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Update or insert view record
    INSERT INTO document_views (document_id, user_id)
    VALUES (p_document_id, p_user_id)
    ON CONFLICT (document_id, user_id) DO UPDATE
    SET view_count = document_views.view_count + 1,
        last_viewed_at = now();
    
    -- Log activity
    INSERT INTO document_activity (document_id, project_id, user_id, action)
    VALUES (p_document_id, p_project_id, p_user_id, 'viewed');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Toggle Favorite
-- ============================================
CREATE OR REPLACE FUNCTION toggle_document_favorite(
    p_document_id UUID,
    p_user_id UUID,
    p_project_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_is_favorite BOOLEAN;
BEGIN
    -- Check if already favorite
    IF EXISTS (SELECT 1 FROM document_favorites WHERE document_id = p_document_id AND user_id = p_user_id) THEN
        -- Remove favorite
        DELETE FROM document_favorites WHERE document_id = p_document_id AND user_id = p_user_id;
        
        -- Log activity
        INSERT INTO document_activity (document_id, project_id, user_id, action)
        VALUES (p_document_id, p_project_id, p_user_id, 'unfavorited');
        
        RETURN FALSE;
    ELSE
        -- Add favorite
        INSERT INTO document_favorites (document_id, user_id)
        VALUES (p_document_id, p_user_id);
        
        -- Log activity
        INSERT INTO document_activity (document_id, project_id, user_id, action)
        VALUES (p_document_id, p_project_id, p_user_id, 'favorited');
        
        RETURN TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE document_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view document_activity" ON document_activity FOR SELECT
    USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY "Members insert document_activity" ON document_activity FOR INSERT
    WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own favorites" ON document_favorites FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Users manage own views" ON document_views FOR ALL
    USING (user_id = auth.uid());

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE document_activity IS 'Audit trail of all document actions';
COMMENT ON TABLE document_favorites IS 'User document favorites';
COMMENT ON TABLE document_views IS 'Track document views per user for recent files';
COMMENT ON FUNCTION track_document_view IS 'Track a document view and update last viewed timestamp';
COMMENT ON FUNCTION toggle_document_favorite IS 'Toggle favorite status and return new state';
