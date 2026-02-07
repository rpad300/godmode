-- ============================================================================
-- Migration 036: Question Requester Role
-- Tracks who (which role) is ASKING the question vs who should ANSWER it
-- ============================================================================

-- ============================================================================
-- SECTION 1: ADD REQUESTER ROLE FIELDS
-- ============================================================================

-- The role/perspective from which the question is being asked
-- Example: "Business Analyst" - questions that a BA would ask about the project
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS requester_role TEXT;

-- The prompt template for that role (for AI context)
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS requester_role_prompt TEXT;

-- The contact/person who represents this role (optional - for display with avatar)
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS requester_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- The name of the person representing the requester role (denormalized for display)
ALTER TABLE knowledge_questions 
ADD COLUMN IF NOT EXISTS requester_name TEXT;

-- Index for filtering questions by requester role
CREATE INDEX IF NOT EXISTS idx_questions_requester_role 
    ON knowledge_questions(requester_role) 
    WHERE requester_role IS NOT NULL;

-- Index for filtering by requester contact
CREATE INDEX IF NOT EXISTS idx_questions_requester_contact 
    ON knowledge_questions(requester_contact_id) 
    WHERE requester_contact_id IS NOT NULL;

-- ============================================================================
-- SECTION 2: UPDATE COMMENTS
-- ============================================================================

COMMENT ON COLUMN knowledge_questions.requester_role IS 
    'The role perspective from which this question is asked (e.g., Business Analyst, DevOps Engineer)';

COMMENT ON COLUMN knowledge_questions.requester_role_prompt IS 
    'The AI prompt template associated with the requester role for context';

-- ============================================================================
-- SECTION 3: VIEW FOR QUESTIONS BY REQUESTER ROLE
-- ============================================================================

CREATE OR REPLACE VIEW questions_by_requester_role AS
SELECT 
    requester_role,
    COUNT(*) as total_questions,
    COUNT(*) FILTER (WHERE status = 'open') as open_questions,
    COUNT(*) FILTER (WHERE status = 'answered') as answered_questions,
    COUNT(*) FILTER (WHERE assigned_to IS NULL) as unassigned_questions
FROM knowledge_questions
WHERE requester_role IS NOT NULL
GROUP BY requester_role
ORDER BY total_questions DESC;

-- ============================================================================
-- SECTION 4: FIX STATUS CHECK CONSTRAINT
-- ============================================================================

-- The original constraint only allows: 'open', 'in_progress', 'answered', 'closed'
-- We need to add: 'pending', 'assigned', 'dismissed', 'deferred', 'resolved'

ALTER TABLE knowledge_questions 
DROP CONSTRAINT IF EXISTS knowledge_questions_status_check;

ALTER TABLE knowledge_questions 
ADD CONSTRAINT knowledge_questions_status_check 
CHECK (status IN (
    'open',         -- Newly created, unassigned
    'pending',      -- Waiting for action
    'assigned',     -- Assigned to someone
    'in_progress',  -- Being worked on
    'deferred',     -- Postponed to later date
    'answered',     -- Has an answer
    'resolved',     -- Resolved (synonym for answered)
    'dismissed',    -- Dismissed without answer
    'closed'        -- Closed/archived
));

-- ============================================================================
-- SECTION 5: RLS POLICIES (inherit from knowledge_questions)
-- ============================================================================

-- No new RLS needed - inherits from knowledge_questions table policies
