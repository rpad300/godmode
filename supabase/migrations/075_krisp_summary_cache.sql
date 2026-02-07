-- ============================================================================
-- Migration 075: Add AI summary cache to Krisp transcripts
-- ============================================================================
-- Stores generated AI summaries to avoid regenerating them on each view

-- Add ai_summary column to krisp_transcripts
ALTER TABLE krisp_transcripts
ADD COLUMN IF NOT EXISTS ai_summary JSONB DEFAULT NULL;

-- Add generated_at timestamp to track when summary was created
ALTER TABLE krisp_transcripts
ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN krisp_transcripts.ai_summary IS 'Cached AI-generated summary. Structure: { title, topic, keyPoints[], actionItems[], decisions[], nextSteps, speakers[], source }';
COMMENT ON COLUMN krisp_transcripts.summary_generated_at IS 'When the AI summary was generated. NULL means not yet generated.';

-- Index for finding transcripts without summaries (for batch processing)
CREATE INDEX IF NOT EXISTS idx_krisp_transcripts_no_summary 
ON krisp_transcripts (user_id, status) 
WHERE ai_summary IS NULL AND status = 'processed';
