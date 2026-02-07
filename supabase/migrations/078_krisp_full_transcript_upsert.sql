-- ============================================================================
-- Migration 078: Add full_transcript support to Krisp sync
-- ============================================================================
-- Ensures full_transcript column exists and updates upsert function

-- Add full_transcript column if not exists
ALTER TABLE krisp_available_meetings 
ADD COLUMN IF NOT EXISTS full_transcript TEXT;

-- Add needs_transcript flag to track which meetings need full transcript fetch
ALTER TABLE krisp_available_meetings 
ADD COLUMN IF NOT EXISTS needs_full_transcript BOOLEAN DEFAULT true;

-- Index for finding meetings that need transcript fetch
CREATE INDEX IF NOT EXISTS idx_krisp_available_needs_transcript 
ON krisp_available_meetings(user_id, needs_full_transcript) 
WHERE needs_full_transcript = true AND is_imported = false;

-- Update the upsert function to include full_transcript
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
    p_raw_data JSONB DEFAULT NULL,
    p_full_transcript TEXT DEFAULT NULL
) RETURNS krisp_available_meetings AS $$
DECLARE
    v_result krisp_available_meetings;
    v_has_transcript BOOLEAN;
BEGIN
    -- Check if we're providing a transcript
    v_has_transcript := p_full_transcript IS NOT NULL AND LENGTH(p_full_transcript) > 0;
    
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
        full_transcript,
        needs_full_transcript,
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
        p_full_transcript,
        NOT v_has_transcript,  -- needs_full_transcript = false if we have it
        NOW()
    )
    ON CONFLICT (user_id, krisp_meeting_id) DO UPDATE SET
        -- Always update metadata (in case it changed in Krisp)
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
        -- Only update transcript if we're providing one
        full_transcript = CASE 
            WHEN EXCLUDED.full_transcript IS NOT NULL AND LENGTH(EXCLUDED.full_transcript) > 0 
            THEN EXCLUDED.full_transcript 
            ELSE krisp_available_meetings.full_transcript 
        END,
        needs_full_transcript = CASE 
            WHEN EXCLUDED.full_transcript IS NOT NULL AND LENGTH(EXCLUDED.full_transcript) > 0 
            THEN false 
            ELSE krisp_available_meetings.needs_full_transcript 
        END,
        last_synced_at = NOW(),
        updated_at = NOW()
    RETURNING * INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get meetings that need full transcript fetch
CREATE OR REPLACE FUNCTION get_krisp_meetings_needing_transcript(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
) RETURNS SETOF krisp_available_meetings AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM krisp_available_meetings
    WHERE user_id = p_user_id 
      AND needs_full_transcript = true 
      AND is_imported = false
    ORDER BY meeting_date DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update import stats to include transcript stats
CREATE OR REPLACE FUNCTION get_krisp_import_stats(p_user_id UUID)
RETURNS TABLE (
    total_available BIGINT,
    total_imported BIGINT,
    total_pending BIGINT,
    total_with_transcript BIGINT,
    total_needs_transcript BIGINT,
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
        COUNT(*) FILTER (WHERE full_transcript IS NOT NULL AND LENGTH(full_transcript) > 0)::BIGINT as total_with_transcript,
        COUNT(*) FILTER (WHERE needs_full_transcript = true)::BIGINT as total_needs_transcript,
        MIN(meeting_date) as oldest_meeting,
        MAX(meeting_date) as newest_meeting,
        MAX(last_synced_at) as last_sync
    FROM krisp_available_meetings
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION get_krisp_meetings_needing_transcript TO authenticated;
