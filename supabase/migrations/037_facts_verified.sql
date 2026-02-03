-- ============================================================================
-- Migration 037: Facts verified columns (SOTA alignment with ontology/frontend)
-- Adds verified, verified_by, verified_at to facts table
-- ============================================================================

ALTER TABLE facts
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

ALTER TABLE facts
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

ALTER TABLE facts
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

COMMENT ON COLUMN facts.verified IS 'Whether the fact has been verified by a user';
COMMENT ON COLUMN facts.verified_by IS 'User who verified the fact';
COMMENT ON COLUMN facts.verified_at IS 'When the fact was verified';

CREATE INDEX IF NOT EXISTS idx_facts_verified ON facts(project_id, verified) WHERE deleted_at IS NULL;
