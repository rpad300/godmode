-- ============================================
-- GodMode Phase 24: Document Sharing
-- Public sharing links for documents
-- ============================================

-- ============================================
-- DOCUMENT SHARES
-- Public sharing links with access control
-- ============================================
CREATE TABLE IF NOT EXISTS document_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Share token (unique identifier for public access)
    token TEXT UNIQUE NOT NULL,
    
    -- Access control
    expires_at TIMESTAMPTZ,
    password_hash TEXT,                -- Optional password protection
    max_views INTEGER,                 -- Maximum number of views allowed
    view_count INTEGER DEFAULT 0,      -- Current view count
    permissions TEXT[] DEFAULT ARRAY['view'],  -- Allowed actions: view, download
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    last_accessed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shares_document ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_shares_token ON document_shares(token);
CREATE INDEX IF NOT EXISTS idx_shares_project ON document_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_shares_active ON document_shares(is_active, expires_at);

-- ============================================
-- SHARE ACCESS LOG
-- Track who accessed shared documents
-- ============================================
CREATE TABLE IF NOT EXISTS share_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    share_id UUID NOT NULL REFERENCES document_shares(id) ON DELETE CASCADE,
    
    -- Access info
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    
    -- Action
    action TEXT NOT NULL CHECK (action IN ('view', 'download', 'password_attempt', 'expired', 'limit_reached')),
    success BOOLEAN DEFAULT TRUE,
    
    -- Timestamp
    accessed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_access_share ON share_access_log(share_id, accessed_at DESC);

-- ============================================
-- FUNCTION: Generate Share Token
-- ============================================
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(24), 'base64');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Increment View Count
-- ============================================
CREATE OR REPLACE FUNCTION increment_share_views(p_share_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_share document_shares%ROWTYPE;
BEGIN
    SELECT * INTO v_share FROM document_shares WHERE id = p_share_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check if still valid
    IF NOT v_share.is_active THEN
        RETURN FALSE;
    END IF;
    
    IF v_share.expires_at IS NOT NULL AND v_share.expires_at < now() THEN
        UPDATE document_shares SET is_active = FALSE WHERE id = p_share_id;
        RETURN FALSE;
    END IF;
    
    IF v_share.max_views IS NOT NULL AND v_share.view_count >= v_share.max_views THEN
        RETURN FALSE;
    END IF;
    
    -- Increment view count
    UPDATE document_shares 
    SET view_count = view_count + 1, last_accessed_at = now()
    WHERE id = p_share_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage document_shares" ON document_shares FOR ALL 
    USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY "Members view share_access_log" ON share_access_log FOR SELECT
    USING (share_id IN (
        SELECT id FROM document_shares 
        WHERE project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    ));

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE document_shares IS 'Public sharing links for documents';
COMMENT ON TABLE share_access_log IS 'Access log for shared document links';
COMMENT ON COLUMN document_shares.token IS 'Unique token for public URL';
COMMENT ON COLUMN document_shares.password_hash IS 'Optional bcrypt hash for password protection';
COMMENT ON COLUMN document_shares.permissions IS 'Array of allowed actions: view, download';
