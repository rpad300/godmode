-- Migration: 016_people_context_snippets.sql
-- Description: Add context snippets to people table for showing where participants were detected
-- Date: 2026-01-30

-- Add context_snippets column to store excerpts where person was mentioned
-- Format: JSONB array of { source: string, snippet: string, detected_at: timestamp }
ALTER TABLE people ADD COLUMN IF NOT EXISTS context_snippets JSONB DEFAULT '[]'::jsonb;

-- Add a column to track the first document where the person appeared
ALTER TABLE people ADD COLUMN IF NOT EXISTS first_seen_in TEXT;

-- Add role_context for additional context about the person's role
ALTER TABLE people ADD COLUMN IF NOT EXISTS role_context TEXT;

-- Comment for documentation
COMMENT ON COLUMN people.context_snippets IS 'Array of snippets where this person was mentioned: [{source, snippet, detected_at}]';
COMMENT ON COLUMN people.first_seen_in IS 'Name of the first document/conversation where person appeared';
COMMENT ON COLUMN people.role_context IS 'Context about role from extracted text';

-- Update RLS to ensure snippets are accessible
-- (No changes needed as existing policies cover all columns)
