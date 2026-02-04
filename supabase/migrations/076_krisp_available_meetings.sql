-- ============================================================================
-- Migration 076: Krisp Available Meetings Catalog
-- ============================================================================
-- Stores meetings fetched from Krisp MCP for selective import
-- Tracks which meetings have been imported vs available

-- TABLE: krisp_available_meetings
-- Catalog of meetings from Krisp, synced via MCP
CREATE TABLE IF NOT EXISTS krisp_available_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Krisp meeting identifiers
    krisp_meeting_id VARCHAR(64) NOT NULL,
    
    -- Meeting metadata from Krisp
    meeting_name TEXT NOT NULL,
    meeting_date TIMESTAMPTZ NOT NULL,
    meeting_url TEXT,
    is_recurring BOOLEAN DEFAULT false,
    
    -- Participants
    attendees JSONB DEFAULT '[]'::jsonb,
    speakers JSONB DEFAULT '[]'::jsonb,
    
    -- Content preview (from Krisp, not full transcript)
    key_points JSONB DEFAULT '[]'::jsonb,
    action_items JSONB DEFAULT '[]'::jsonb,
    summary TEXT,
    
    -- Import tracking
    is_imported BOOLEAN DEFAULT false,
    imported_at TIMESTAMPTZ,
    imported_transcript_id UUID REFERENCES krisp_transcripts(id) ON DELETE SET NULL,
    
    -- Sync metadata
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    raw_data JSONB,
    
    -- Constraints
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one entry per Krisp meeting per user
    CONSTRAINT krisp_available_meetings_unique UNIQUE (user_id, krisp_meeting_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_krisp_available_user 
ON krisp_available_meetings(user_id);

CREATE INDEX IF NOT EXISTS idx_krisp_available_date 
ON krisp_available_meetings(user_id, meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_krisp_available_not_imported 
ON krisp_available_meetings(user_id, is_imported) 
WHERE is_imported = false;

CREATE INDEX IF NOT EXISTS idx_krisp_available_krisp_id 
ON krisp_available_meetings(krisp_meeting_id);

-- RLS
ALTER TABLE krisp_available_meetings ENABLE ROW LEVEL SECURITY;

-- Users can manage their own available meetings
CREATE POLICY "Users manage own krisp available meetings" 
ON krisp_available_meetings
FOR ALL USING (auth.uid() = user_id);

-- Superadmins can view all
CREATE POLICY "Superadmin views all krisp available meetings"
ON krisp_available_meetings
FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
);

-- Updated at trigger
DROP TRIGGER IF EXISTS krisp_available_meetings_updated_at ON krisp_available_meetings;
CREATE TRIGGER krisp_available_meetings_updated_at
    BEFORE UPDATE ON krisp_available_meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to upsert meetings from MCP sync
CREATE OR REPLACE FUNCTION upsert_krisp_available_meeting(
    p_user_id UUID,
    p_krisp_meeting_id VARCHAR(64),
    p_meeting_name TEXT,
    p_meeting_date TIMESTAMPTZ,
    p_meeting_url TEXT DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT false,
    p_attendees JSONB DEFAULT '[]'::jsonb,
    p_speakers JSONB DEFAULT '[]'::jsonb,
    p_key_points JSONB DEFAULT '[]'::jsonb,
    p_action_items JSONB DEFAULT '[]'::jsonb,
    p_summary TEXT DEFAULT NULL,
    p_raw_data JSONB DEFAULT NULL
) RETURNS krisp_available_meetings AS $$
DECLARE
    v_result krisp_available_meetings;
BEGIN
    INSERT INTO krisp_available_meetings (
        user_id,
        krisp_meeting_id,
        meeting_name,
        meeting_date,
        meeting_url,
        is_recurring,
        attendees,
        speakers,
        key_points,
        action_items,
        summary,
        raw_data,
        last_synced_at
    ) VALUES (
        p_user_id,
        p_krisp_meeting_id,
        p_meeting_name,
        p_meeting_date,
        p_meeting_url,
        p_is_recurring,
        p_attendees,
        p_speakers,
        p_key_points,
        p_action_items,
        p_summary,
        p_raw_data,
        NOW()
    )
    ON CONFLICT (user_id, krisp_meeting_id) DO UPDATE SET
        meeting_name = EXCLUDED.meeting_name,
        meeting_date = EXCLUDED.meeting_date,
        meeting_url = EXCLUDED.meeting_url,
        is_recurring = EXCLUDED.is_recurring,
        attendees = EXCLUDED.attendees,
        speakers = EXCLUDED.speakers,
        key_points = EXCLUDED.key_points,
        action_items = EXCLUDED.action_items,
        summary = EXCLUDED.summary,
        raw_data = EXCLUDED.raw_data,
        last_synced_at = NOW(),
        updated_at = NOW()
    RETURNING * INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark meeting as imported
CREATE OR REPLACE FUNCTION mark_krisp_meeting_imported(
    p_user_id UUID,
    p_krisp_meeting_id VARCHAR(64),
    p_transcript_id UUID
) RETURNS krisp_available_meetings AS $$
DECLARE
    v_result krisp_available_meetings;
BEGIN
    UPDATE krisp_available_meetings
    SET 
        is_imported = true,
        imported_at = NOW(),
        imported_transcript_id = p_transcript_id,
        updated_at = NOW()
    WHERE user_id = p_user_id AND krisp_meeting_id = p_krisp_meeting_id
    RETURNING * INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get import statistics
CREATE OR REPLACE FUNCTION get_krisp_import_stats(p_user_id UUID)
RETURNS TABLE (
    total_available BIGINT,
    total_imported BIGINT,
    total_pending BIGINT,
    oldest_meeting TIMESTAMPTZ,
    newest_meeting TIMESTAMPTZ,
    last_sync TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_available,
        COUNT(*) FILTER (WHERE is_imported = true)::BIGINT as total_imported,
        COUNT(*) FILTER (WHERE is_imported = false)::BIGINT as total_pending,
        MIN(meeting_date) as oldest_meeting,
        MAX(meeting_date) as newest_meeting,
        MAX(last_synced_at) as last_sync
    FROM krisp_available_meetings
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON krisp_available_meetings TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_krisp_available_meeting TO authenticated;
GRANT EXECUTE ON FUNCTION mark_krisp_meeting_imported TO authenticated;
GRANT EXECUTE ON FUNCTION get_krisp_import_stats TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE krisp_available_meetings IS 'Catalog of meetings from Krisp MCP, tracks import status';
COMMENT ON COLUMN krisp_available_meetings.krisp_meeting_id IS '32-char UUID from Krisp';
COMMENT ON COLUMN krisp_available_meetings.is_imported IS 'Whether meeting has been imported to krisp_transcripts';
COMMENT ON COLUMN krisp_available_meetings.imported_transcript_id IS 'Reference to imported transcript if imported';
COMMENT ON COLUMN krisp_available_meetings.raw_data IS 'Full JSON response from Krisp MCP for reference';
