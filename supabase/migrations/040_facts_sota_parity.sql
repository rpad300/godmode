-- ============================================================================
-- Migration 040: Facts SOTA parity (generation_source, view for reporting)
-- Aligns with Questions SOTA: explicit source of fact, view for analytics
-- ============================================================================

-- ============================================================================
-- SECTION 1: GENERATION SOURCE
-- ============================================================================
-- Tracks how the fact was created: extracted from document, quick capture, or manual
-- (Questions have generation_source: manual, extracted, template, ai_generated)

ALTER TABLE facts
ADD COLUMN IF NOT EXISTS generation_source TEXT;

COMMENT ON COLUMN facts.generation_source IS 'How the fact was created: extracted (from document), quick_capture, manual';

-- Constraint for known values
ALTER TABLE facts DROP CONSTRAINT IF EXISTS facts_generation_source_check;
ALTER TABLE facts ADD CONSTRAINT facts_generation_source_check
CHECK (generation_source IS NULL OR generation_source IN ('extracted', 'quick_capture', 'manual', 'import'));

CREATE INDEX IF NOT EXISTS idx_facts_generation_source
ON facts(project_id, generation_source) WHERE deleted_at IS NULL AND generation_source IS NOT NULL;

-- ============================================================================
-- SECTION 2: VIEW FACTS_BY_CATEGORY_VERIFIED
-- ============================================================================
-- Reporting view (parity with questions_by_requester_role / knowledge_gaps)

CREATE OR REPLACE VIEW facts_by_category_verified AS
SELECT
    project_id,
    category,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE verified = TRUE) AS verified_count,
    COUNT(*) FILTER (WHERE verified = FALSE OR verified IS NULL) AS unverified_count,
    MAX(verified_at) AS latest_verified_at
FROM facts
WHERE deleted_at IS NULL
GROUP BY project_id, category
ORDER BY project_id, total_count DESC;

COMMENT ON VIEW facts_by_category_verified IS 'Facts aggregated by category and verification status for reporting';
