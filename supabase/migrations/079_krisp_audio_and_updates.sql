-- ============================================================================
-- Migration 079: Krisp Audio Storage and Update Tracking
-- ============================================================================
-- Adds audio file path storage and tracks when imported meetings are updated

-- Add audio file path to available meetings (stores local path, not URL)
ALTER TABLE krisp_available_meetings 
ADD COLUMN IF NOT EXISTS audio_file_path TEXT;

ALTER TABLE krisp_available_meetings 
ADD COLUMN IF NOT EXISTS audio_download_url TEXT;

ALTER TABLE krisp_available_meetings 
ADD COLUMN IF NOT EXISTS audio_url_expires_at TIMESTAMPTZ;

-- Add same columns to transcripts for imported meetings
ALTER TABLE krisp_transcripts 
ADD COLUMN IF NOT EXISTS audio_file_path TEXT;

-- Track when data was last updated from Krisp (to detect changes)
ALTER TABLE krisp_available_meetings 
ADD COLUMN IF NOT EXISTS krisp_data_hash TEXT;

ALTER TABLE krisp_transcripts 
ADD COLUMN IF NOT EXISTS krisp_data_hash TEXT;

-- Index for finding meetings with expired audio URLs
CREATE INDEX IF NOT EXISTS idx_krisp_available_audio_expires 
ON krisp_available_meetings(audio_url_expires_at) 
WHERE audio_download_url IS NOT NULL;

-- Function to update imported transcript when source meeting changes
CREATE OR REPLACE FUNCTION sync_krisp_transcript_from_meeting(
    p_krisp_meeting_id VARCHAR(64)
) RETURNS TABLE (
    transcript_id UUID,
    updated_fields TEXT[]
) AS $$
DECLARE
    v_meeting RECORD;
    v_transcript RECORD;
    v_updates TEXT[] := '{}';
BEGIN
    -- Get the source meeting
    SELECT * INTO v_meeting 
    FROM krisp_available_meetings 
    WHERE krisp_meeting_id = p_krisp_meeting_id;
    
    IF v_meeting IS NULL THEN
        RETURN;
    END IF;
    
    -- Get the imported transcript
    SELECT * INTO v_transcript
    FROM krisp_transcripts
    WHERE krisp_meeting_id = p_krisp_meeting_id;
    
    IF v_transcript IS NULL THEN
        RETURN;
    END IF;
    
    -- Compare and update fields
    -- Update display title if meeting name changed
    IF v_meeting.meeting_name IS DISTINCT FROM v_transcript.krisp_title THEN
        v_updates := array_append(v_updates, 'title');
    END IF;
    
    -- Update speakers if changed
    IF v_meeting.speakers::TEXT IS DISTINCT FROM v_transcript.speakers::TEXT THEN
        v_updates := array_append(v_updates, 'speakers');
    END IF;
    
    -- Update key_points if changed
    IF v_meeting.key_points::TEXT IS DISTINCT FROM v_transcript.key_points::TEXT THEN
        v_updates := array_append(v_updates, 'key_points');
    END IF;
    
    -- Update action_items if changed
    IF v_meeting.action_items::TEXT IS DISTINCT FROM v_transcript.action_items::TEXT THEN
        v_updates := array_append(v_updates, 'action_items');
    END IF;
    
    -- Update transcript if we have a newer full transcript
    IF v_meeting.full_transcript IS NOT NULL 
       AND LENGTH(v_meeting.full_transcript) > COALESCE(LENGTH(v_transcript.transcript_text), 0) THEN
        v_updates := array_append(v_updates, 'transcript');
    END IF;
    
    -- Perform the update if there are changes
    IF array_length(v_updates, 1) > 0 THEN
        UPDATE krisp_transcripts SET
            krisp_title = COALESCE(v_meeting.meeting_name, krisp_title),
            speakers = COALESCE(v_meeting.speakers, speakers),
            key_points = COALESCE(v_meeting.key_points, key_points),
            action_items = COALESCE(v_meeting.action_items, action_items),
            transcript_text = CASE 
                WHEN v_meeting.full_transcript IS NOT NULL 
                     AND LENGTH(v_meeting.full_transcript) > COALESCE(LENGTH(transcript_text), 0)
                THEN v_meeting.full_transcript 
                ELSE transcript_text 
            END,
            audio_file_path = COALESCE(v_meeting.audio_file_path, audio_file_path),
            krisp_data_hash = v_meeting.krisp_data_hash,
            updated_at = NOW()
        WHERE krisp_meeting_id = p_krisp_meeting_id;
        
        transcript_id := v_transcript.id;
        updated_fields := v_updates;
        RETURN NEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check which imported transcripts have stale data
CREATE OR REPLACE FUNCTION get_stale_krisp_transcripts(
    p_user_id UUID DEFAULT NULL
) RETURNS TABLE (
    transcript_id UUID,
    krisp_meeting_id VARCHAR(64),
    krisp_title TEXT,
    meeting_data_hash TEXT,
    transcript_data_hash TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id as transcript_id,
        t.krisp_meeting_id,
        t.krisp_title,
        m.krisp_data_hash as meeting_data_hash,
        t.krisp_data_hash as transcript_data_hash
    FROM krisp_transcripts t
    JOIN krisp_available_meetings m ON t.krisp_meeting_id = m.krisp_meeting_id
    WHERE (p_user_id IS NULL OR t.user_id = p_user_id)
      AND (t.krisp_data_hash IS DISTINCT FROM m.krisp_data_hash
           OR t.krisp_data_hash IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION sync_krisp_transcript_from_meeting TO authenticated;
GRANT EXECUTE ON FUNCTION get_stale_krisp_transcripts TO authenticated;

COMMENT ON COLUMN krisp_available_meetings.audio_file_path IS 'Local filesystem path to downloaded audio file';
COMMENT ON COLUMN krisp_available_meetings.audio_download_url IS 'Temporary S3 URL for audio download (expires)';
COMMENT ON COLUMN krisp_available_meetings.krisp_data_hash IS 'Hash of Krisp data to detect changes';
