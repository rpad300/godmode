-- ============================================
-- Migration 074: Krisp AI Meeting Assistant Integration
-- Webhook sync, transcript tracking, speaker matching
-- ============================================

-- ============================================
-- TABLE: krisp_user_webhooks
-- Webhook configuration per user (multi-tenant)
-- ============================================

CREATE TABLE IF NOT EXISTS krisp_user_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Owner of the webhook
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- Webhook credentials
    webhook_token TEXT NOT NULL UNIQUE,  -- Token in URL path
    webhook_secret TEXT,                  -- For Authorization header validation
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Enabled events
    events_enabled JSONB DEFAULT '["transcript_created", "notes_generated"]'::jsonb,
    
    -- Stats
    last_event_at TIMESTAMPTZ,
    total_events_received INTEGER DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Each user can only have one webhook config
CREATE UNIQUE INDEX IF NOT EXISTS idx_krisp_webhooks_user ON krisp_user_webhooks(user_id);

-- Fast lookup by token for incoming webhooks
CREATE INDEX IF NOT EXISTS idx_krisp_webhooks_token ON krisp_user_webhooks(webhook_token) WHERE is_active = true;

-- RLS
ALTER TABLE krisp_user_webhooks ENABLE ROW LEVEL SECURITY;

-- Users can manage their own webhook config
CREATE POLICY "Users manage own krisp webhook" ON krisp_user_webhooks
    FOR ALL USING (user_id = auth.uid());

-- Superadmin can view all
CREATE POLICY "Superadmin views all krisp webhooks" ON krisp_user_webhooks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

COMMENT ON TABLE krisp_user_webhooks IS 'Krisp webhook configuration per user for multi-tenant integration';
COMMENT ON COLUMN krisp_user_webhooks.webhook_token IS 'Unique token used in webhook URL path';
COMMENT ON COLUMN krisp_user_webhooks.webhook_secret IS 'Secret for Authorization header validation';

-- ============================================
-- TABLE: krisp_transcripts
-- Transcript metadata and processing state
-- ============================================

CREATE TABLE IF NOT EXISTS krisp_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Owner (from webhook config)
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- Krisp identifiers
    krisp_meeting_id TEXT NOT NULL,       -- Krisp's meeting ID (32 chars)
    source TEXT NOT NULL CHECK (source IN ('webhook', 'mcp_sync')),
    event_type TEXT,                       -- transcript_created, notes_generated, transcript_shared
    
    -- Meeting info
    krisp_title TEXT,                      -- Original title from Krisp
    display_title TEXT,                    -- Formatted title for GodMode: "{project_code} - {title}"
    meeting_date TIMESTAMPTZ,
    duration_minutes INTEGER,
    
    -- Speakers
    speakers JSONB,                        -- ["Rui Dias", "Speaker 1", "John Doe"]
    has_unidentified_speakers BOOLEAN DEFAULT false,
    
    -- Project matching
    matched_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    project_confidence DECIMAL(3,2),       -- 0.00 to 1.00
    project_candidates JSONB,              -- [{id, name, percentage, count}] if ambiguous
    
    -- Contact matching
    matched_contacts JSONB,                -- [{speaker, contact_id, contact_name, confidence}]
    
    -- Content
    transcript_text TEXT,
    action_items JSONB,
    key_points JSONB,
    notes JSONB,
    recording_url TEXT,                    -- Expires in 7 days
    
    -- Processing status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Just received, not processed
        'quarantine',   -- Has unidentified speakers
        'ambiguous',    -- Project match is ambiguous (tie or low confidence)
        'matched',      -- Speakers + project matched, ready to process
        'processed',    -- Successfully uploaded to GodMode
        'failed',       -- Processing failed
        'skipped'       -- Manually discarded
    )),
    status_reason TEXT,                    -- Human-readable reason for status
    
    -- Retry tracking
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    max_retries INTEGER DEFAULT 10,
    
    -- Link to processed document in GodMode
    processed_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    
    -- Raw data for debugging
    raw_payload JSONB,
    
    -- Timestamps
    received_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent duplicate imports (same meeting, same event type, same user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_krisp_transcripts_unique 
    ON krisp_transcripts(user_id, krisp_meeting_id, event_type);

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_krisp_transcripts_user ON krisp_transcripts(user_id);
CREATE INDEX IF NOT EXISTS idx_krisp_transcripts_status ON krisp_transcripts(status) WHERE status IN ('pending', 'quarantine', 'ambiguous', 'matched');
CREATE INDEX IF NOT EXISTS idx_krisp_transcripts_project ON krisp_transcripts(matched_project_id) WHERE matched_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_krisp_transcripts_date ON krisp_transcripts(meeting_date DESC);

-- For quarantine retry worker
CREATE INDEX IF NOT EXISTS idx_krisp_transcripts_retry 
    ON krisp_transcripts(status, last_retry_at, retry_count) 
    WHERE status IN ('quarantine', 'ambiguous') AND retry_count < 10;

-- RLS
ALTER TABLE krisp_transcripts ENABLE ROW LEVEL SECURITY;

-- Users can manage their own transcripts
CREATE POLICY "Users manage own krisp transcripts" ON krisp_transcripts
    FOR ALL USING (user_id = auth.uid());

-- Project members can view transcripts assigned to their projects
CREATE POLICY "Project members view project transcripts" ON krisp_transcripts
    FOR SELECT USING (
        matched_project_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = krisp_transcripts.matched_project_id 
            AND user_id = auth.uid()
        )
    );

-- Superadmin can view all
CREATE POLICY "Superadmin views all krisp transcripts" ON krisp_transcripts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

COMMENT ON TABLE krisp_transcripts IS 'Krisp meeting transcripts with processing state and project matching';
COMMENT ON COLUMN krisp_transcripts.krisp_meeting_id IS 'Unique meeting ID from Krisp (32 chars)';
COMMENT ON COLUMN krisp_transcripts.status IS 'Processing status: pending->quarantine/ambiguous/matched->processed/failed/skipped';
COMMENT ON COLUMN krisp_transcripts.project_confidence IS 'Confidence level of project match (0-1, requires >= 0.70 for auto-assign)';

-- ============================================
-- TABLE: krisp_speaker_mappings
-- Speaker name to contact mappings (user-specific or global)
-- ============================================

CREATE TABLE IF NOT EXISTS krisp_speaker_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Scope: user-specific or global
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,  -- NULL = global
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,    -- Context project
    
    -- Mapping
    speaker_name TEXT NOT NULL,           -- Normalized speaker name (lowercase)
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Flags
    is_global BOOLEAN DEFAULT false,      -- Applies to all users
    is_active BOOLEAN DEFAULT true,
    
    -- Confidence and source
    confidence DECIMAL(3,2) DEFAULT 1.0,  -- How confident is this mapping
    source TEXT DEFAULT 'manual',         -- manual, auto_matched, imported
    
    -- Audit
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique mapping per scope
CREATE UNIQUE INDEX IF NOT EXISTS idx_krisp_mappings_user_speaker 
    ON krisp_speaker_mappings(user_id, project_id, LOWER(speaker_name)) 
    WHERE user_id IS NOT NULL AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_krisp_mappings_global_speaker 
    ON krisp_speaker_mappings(project_id, LOWER(speaker_name)) 
    WHERE is_global = true AND is_active = true;

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_krisp_mappings_speaker ON krisp_speaker_mappings(LOWER(speaker_name));
CREATE INDEX IF NOT EXISTS idx_krisp_mappings_contact ON krisp_speaker_mappings(contact_id);
CREATE INDEX IF NOT EXISTS idx_krisp_mappings_project ON krisp_speaker_mappings(project_id);

-- RLS
ALTER TABLE krisp_speaker_mappings ENABLE ROW LEVEL SECURITY;

-- Users can manage their own mappings
CREATE POLICY "Users manage own krisp mappings" ON krisp_speaker_mappings
    FOR ALL USING (
        user_id = auth.uid() OR
        (is_global = true AND EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
        ))
    );

-- Users can view global mappings and their own
CREATE POLICY "Users view krisp mappings" ON krisp_speaker_mappings
    FOR SELECT USING (
        user_id = auth.uid() OR
        is_global = true OR
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = krisp_speaker_mappings.project_id 
            AND user_id = auth.uid()
        )
    );

COMMENT ON TABLE krisp_speaker_mappings IS 'Maps speaker names to contacts for Krisp transcript matching';
COMMENT ON COLUMN krisp_speaker_mappings.speaker_name IS 'Normalized (lowercase) speaker name from transcripts';

-- ============================================
-- TABLE: krisp_sync_state
-- MCP sync state for admin backfill
-- ============================================

CREATE TABLE IF NOT EXISTS krisp_sync_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User being synced (admin can sync any user)
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- Sync progress
    last_sync_at TIMESTAMPTZ,
    last_meeting_date TIMESTAMPTZ,        -- Cursor for pagination
    meetings_synced INTEGER DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'error', 'completed')),
    error_message TEXT,
    
    -- Audit
    started_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- One sync state per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_krisp_sync_user ON krisp_sync_state(user_id);

-- RLS
ALTER TABLE krisp_sync_state ENABLE ROW LEVEL SECURITY;

-- Users can view their own sync state
CREATE POLICY "Users view own krisp sync" ON krisp_sync_state
    FOR SELECT USING (user_id = auth.uid());

-- Superadmin can manage all
CREATE POLICY "Superadmin manages krisp sync" ON krisp_sync_state
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

COMMENT ON TABLE krisp_sync_state IS 'Tracks MCP sync progress for admin backfill operations';

-- ============================================
-- FUNCTIONS
-- ============================================

-- Generate secure webhook token
CREATE OR REPLACE FUNCTION generate_krisp_webhook_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Generate secure webhook secret
CREATE OR REPLACE FUNCTION generate_krisp_webhook_secret()
RETURNS TEXT AS $$
BEGIN
    RETURN 'kw_' || encode(gen_random_bytes(24), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Create or get user's webhook config
CREATE OR REPLACE FUNCTION get_or_create_krisp_webhook(p_user_id UUID)
RETURNS krisp_user_webhooks AS $$
DECLARE
    v_webhook krisp_user_webhooks;
BEGIN
    -- Try to get existing
    SELECT * INTO v_webhook FROM krisp_user_webhooks WHERE user_id = p_user_id;
    
    IF v_webhook.id IS NOT NULL THEN
        RETURN v_webhook;
    END IF;
    
    -- Create new
    INSERT INTO krisp_user_webhooks (user_id, webhook_token, webhook_secret)
    VALUES (p_user_id, generate_krisp_webhook_token(), generate_krisp_webhook_secret())
    RETURNING * INTO v_webhook;
    
    RETURN v_webhook;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Regenerate webhook credentials
CREATE OR REPLACE FUNCTION regenerate_krisp_webhook(p_user_id UUID)
RETURNS krisp_user_webhooks AS $$
DECLARE
    v_webhook krisp_user_webhooks;
BEGIN
    UPDATE krisp_user_webhooks
    SET 
        webhook_token = generate_krisp_webhook_token(),
        webhook_secret = generate_krisp_webhook_secret(),
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO v_webhook;
    
    RETURN v_webhook;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get transcripts summary for user
CREATE OR REPLACE FUNCTION get_krisp_transcripts_summary(p_user_id UUID)
RETURNS TABLE (
    total_count BIGINT,
    pending_count BIGINT,
    quarantine_count BIGINT,
    ambiguous_count BIGINT,
    processed_count BIGINT,
    failed_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_count,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_count,
        COUNT(*) FILTER (WHERE status = 'quarantine')::BIGINT as quarantine_count,
        COUNT(*) FILTER (WHERE status = 'ambiguous')::BIGINT as ambiguous_count,
        COUNT(*) FILTER (WHERE status = 'processed')::BIGINT as processed_count,
        COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_count
    FROM krisp_transcripts
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_krisp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all Krisp tables
DROP TRIGGER IF EXISTS krisp_user_webhooks_updated_at ON krisp_user_webhooks;
CREATE TRIGGER krisp_user_webhooks_updated_at
    BEFORE UPDATE ON krisp_user_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_krisp_updated_at();

DROP TRIGGER IF EXISTS krisp_transcripts_updated_at ON krisp_transcripts;
CREATE TRIGGER krisp_transcripts_updated_at
    BEFORE UPDATE ON krisp_transcripts
    FOR EACH ROW EXECUTE FUNCTION update_krisp_updated_at();

DROP TRIGGER IF EXISTS krisp_speaker_mappings_updated_at ON krisp_speaker_mappings;
CREATE TRIGGER krisp_speaker_mappings_updated_at
    BEFORE UPDATE ON krisp_speaker_mappings
    FOR EACH ROW EXECUTE FUNCTION update_krisp_updated_at();

DROP TRIGGER IF EXISTS krisp_sync_state_updated_at ON krisp_sync_state;
CREATE TRIGGER krisp_sync_state_updated_at
    BEFORE UPDATE ON krisp_sync_state
    FOR EACH ROW EXECUTE FUNCTION update_krisp_updated_at();

-- ============================================
-- GRANTS
-- ============================================

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION generate_krisp_webhook_token() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_krisp_webhook_secret() TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_krisp_webhook(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION regenerate_krisp_webhook(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_krisp_transcripts_summary(UUID) TO authenticated;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION generate_krisp_webhook_token IS 'Generates a secure 64-char hex token for webhook URL';
COMMENT ON FUNCTION generate_krisp_webhook_secret IS 'Generates a secure secret for Authorization header';
COMMENT ON FUNCTION get_or_create_krisp_webhook IS 'Gets or creates a Krisp webhook config for a user';
COMMENT ON FUNCTION regenerate_krisp_webhook IS 'Regenerates webhook credentials for security';
COMMENT ON FUNCTION get_krisp_transcripts_summary IS 'Returns transcript count summary by status';
