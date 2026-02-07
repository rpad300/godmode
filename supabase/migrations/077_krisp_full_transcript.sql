-- ============================================================================
-- Migration 077: Add full_transcript to krisp_available_meetings
-- ============================================================================
-- Stores the complete transcript obtained via get_document MCP call
-- The search_meetings only returns key_points/action_items, not full transcript

-- Add full_transcript column
ALTER TABLE krisp_available_meetings 
ADD COLUMN IF NOT EXISTS full_transcript TEXT;

-- Add has_full_transcript computed flag for quick filtering
ALTER TABLE krisp_available_meetings 
ADD COLUMN IF NOT EXISTS has_full_transcript BOOLEAN GENERATED ALWAYS AS (full_transcript IS NOT NULL AND full_transcript != '') STORED;

-- Index for filtering by transcript availability
CREATE INDEX IF NOT EXISTS idx_krisp_available_has_transcript 
ON krisp_available_meetings(user_id, has_full_transcript);

-- Function to update full transcript
CREATE OR REPLACE FUNCTION update_krisp_meeting_transcript(
    p_user_id UUID,
    p_krisp_meeting_id VARCHAR(64),
    p_full_transcript TEXT
) RETURNS krisp_available_meetings AS $$
DECLARE
    v_result krisp_available_meetings;
BEGIN
    UPDATE krisp_available_meetings
    SET 
        full_transcript = p_full_transcript,
        updated_at = NOW()
    WHERE krisp_meeting_id = p_krisp_meeting_id
    AND (user_id = p_user_id OR EXISTS (
        SELECT 1 FROM user_profiles WHERE id = p_user_id AND role = 'superadmin'
    ))
    RETURNING * INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION update_krisp_meeting_transcript TO authenticated;

-- Comments
COMMENT ON COLUMN krisp_available_meetings.full_transcript IS 'Complete transcript from get_document MCP call';
COMMENT ON COLUMN krisp_available_meetings.has_full_transcript IS 'Computed: whether full transcript has been fetched';
