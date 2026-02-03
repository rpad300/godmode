-- Migration: Add cached suggestions to questions table
-- This avoids regenerating AI suggestions for the same question

-- Add cached_suggestions column to knowledge_questions
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS cached_suggestions JSONB DEFAULT NULL;

-- Add suggestions_generated_at timestamp
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS suggestions_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add answer column for persisting answers
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS answer TEXT DEFAULT NULL;

-- Add answered_by column
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS answered_by UUID REFERENCES auth.users(id) DEFAULT NULL;

-- Add answered_at timestamp
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add follow_up_to column for linking follow-up questions
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS follow_up_to UUID REFERENCES knowledge_questions(id) DEFAULT NULL;

-- Index for follow-up questions
CREATE INDEX IF NOT EXISTS idx_questions_follow_up ON knowledge_questions(follow_up_to) WHERE follow_up_to IS NOT NULL;

-- Comments
COMMENT ON COLUMN knowledge_questions.cached_suggestions IS 'Cached AI suggestions to avoid regenerating (JSON array)';
COMMENT ON COLUMN knowledge_questions.suggestions_generated_at IS 'When suggestions were last generated';
COMMENT ON COLUMN knowledge_questions.answer IS 'The answer to this question';
COMMENT ON COLUMN knowledge_questions.follow_up_to IS 'Parent question ID if this is a follow-up question';
