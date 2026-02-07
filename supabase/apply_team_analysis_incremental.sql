-- ============================================
-- TEAM ANALYSIS INCREMENTAL FEATURE
-- Apply this script to your Supabase database
-- ============================================
-- Combines migrations:
-- - 066_team_analysis_evidence.sql
-- - 067_team_analysis_incremental_prompt.sql
-- ============================================

-- ============================================
-- 1. EVIDENCE SNIPPETS TABLE
-- Stores key quotes supporting behavioral analysis
-- ============================================
CREATE TABLE IF NOT EXISTS profile_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES team_profiles(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    
    -- Evidence content
    quote TEXT NOT NULL,
    context TEXT, -- What prompted this statement
    
    -- Source tracking
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_filename TEXT,
    timestamp_in_transcript TEXT,
    
    -- Categorization
    evidence_type TEXT NOT NULL CHECK (evidence_type IN (
        'communication_style',
        'motivation',
        'pressure_response',
        'influence_tactic',
        'vulnerability',
        'defense_trigger',
        'cooperation_signal',
        'power_indicator',
        'warning_sign',
        'relationship_dynamic'
    )),
    
    -- What this evidence supports
    supports_trait TEXT, -- e.g., "direct communication", "avoids conflict"
    confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
    
    -- Metadata
    extracted_at TIMESTAMPTZ DEFAULT now(),
    is_primary BOOLEAN DEFAULT false, -- Primary evidence for this trait
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_evidence_profile ON profile_evidence(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_evidence_person ON profile_evidence(person_id);
CREATE INDEX IF NOT EXISTS idx_profile_evidence_type ON profile_evidence(project_id, evidence_type);
CREATE INDEX IF NOT EXISTS idx_profile_evidence_document ON profile_evidence(source_document_id);

-- ============================================
-- 2. TRANSCRIPT INTERVENTIONS CACHE
-- Caches extracted interventions per person per document
-- ============================================
CREATE TABLE IF NOT EXISTS transcript_interventions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    
    -- Extracted content
    interventions JSONB NOT NULL DEFAULT '[]', -- Array of {timestamp, text, context, word_count}
    total_word_count INTEGER DEFAULT 0,
    intervention_count INTEGER DEFAULT 0,
    
    -- Processing metadata
    extracted_at TIMESTAMPTZ DEFAULT now(),
    extraction_version TEXT DEFAULT '1.0'
);

-- Unique constraint: one cache per person per document
CREATE UNIQUE INDEX IF NOT EXISTS idx_interventions_unique ON transcript_interventions(project_id, document_id, person_id);
CREATE INDEX IF NOT EXISTS idx_interventions_person ON transcript_interventions(person_id);
CREATE INDEX IF NOT EXISTS idx_interventions_document ON transcript_interventions(document_id);

-- ============================================
-- 3. ADD COLUMNS TO TEAM_PROFILES
-- ============================================
ALTER TABLE team_profiles ADD COLUMN IF NOT EXISTS evidence_count INTEGER DEFAULT 0;
ALTER TABLE team_profiles ADD COLUMN IF NOT EXISTS last_incremental_analysis_at TIMESTAMPTZ;
ALTER TABLE team_profiles ADD COLUMN IF NOT EXISTS analysis_version TEXT DEFAULT '1.0';

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profile_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_interventions ENABLE ROW LEVEL SECURITY;

-- Profile Evidence policies
DO $$ BEGIN
    CREATE POLICY "Members access profile_evidence" ON profile_evidence FOR ALL 
        USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role profile_evidence" ON profile_evidence
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Transcript Interventions policies
DO $$ BEGIN
    CREATE POLICY "Members access transcript_interventions" ON transcript_interventions FOR ALL 
        USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role transcript_interventions" ON transcript_interventions
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Get evidence summary for a profile
CREATE OR REPLACE FUNCTION get_profile_evidence_summary(p_profile_id UUID)
RETURNS TABLE (
    evidence_type TEXT,
    count BIGINT,
    primary_count BIGINT,
    traits TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pe.evidence_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE pe.is_primary) as primary_count,
        ARRAY_AGG(DISTINCT pe.supports_trait) FILTER (WHERE pe.supports_trait IS NOT NULL) as traits
    FROM profile_evidence pe
    WHERE pe.profile_id = p_profile_id
    GROUP BY pe.evidence_type
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Get total intervention stats for a person
CREATE OR REPLACE FUNCTION get_person_intervention_stats(p_project_id UUID, p_person_id UUID)
RETURNS TABLE (
    total_documents INTEGER,
    total_interventions INTEGER,
    total_word_count INTEGER,
    avg_intervention_length NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT ti.document_id)::INTEGER as total_documents,
        SUM(ti.intervention_count)::INTEGER as total_interventions,
        SUM(ti.total_word_count)::INTEGER as total_word_count,
        ROUND(AVG(ti.total_word_count::NUMERIC / NULLIF(ti.intervention_count, 0)), 2) as avg_intervention_length
    FROM transcript_interventions ti
    WHERE ti.project_id = p_project_id AND ti.person_id = p_person_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. INSERT INCREMENTAL BEHAVIORAL ANALYSIS PROMPT
-- ============================================
INSERT INTO system_prompts (
    key, 
    name, 
    description, 
    category, 
    prompt_template, 
    uses_ontology, 
    is_system,
    created_at,
    updated_at
) VALUES (
    'team_behavioral_analysis_incremental',
    'Team Behavioral Analysis (Incremental)',
    'Incrementally refines behavioral profiles based on new evidence, comparing against existing profile.',
    'analysis',
    E'## ROLE
You are a behavioral analyst performing **incremental profile refinement**. You have an existing profile and new evidence. Your task is to REFINE the profile, not rebuild it from scratch.

---

## INPUTS PROVIDED

1. **Target person**: {{TARGET_NAME}}
2. **Existing profile**: {{EXISTING_PROFILE}}
3. **Existing evidence bank**: {{EXISTING_EVIDENCE}}
4. **New interventions to analyze**: {{NEW_INTERVENTIONS}}
5. **Analysis objective**: {{OBJECTIVE}}

---

## YOUR TASK

Analyze the NEW interventions and:
1. **CONFIRM** patterns already identified (with new evidence)
2. **REFINE** assessments based on new data
3. **IDENTIFY** new patterns not previously observed
4. **FLAG** contradictions or behavior changes
5. **EXTRACT** key quotes as evidence

---

## ANALYSIS RULES

| Do | Do Not |
|-----|--------|
| Focus on what NEW interventions reveal | Repeat all existing analysis verbatim |
| Cite specific quotes with context | Make claims without evidence |
| Note when new data confirms existing patterns | Assume patterns without checking evidence |
| Flag behavioral inconsistencies | Ignore contradictions |
| Adjust confidence levels based on evidence | Keep same confidence without justification |

---

## OUTPUT FORMAT

Return a valid JSON object:

```json
{
  "analysis_type": "incremental",
  "target_name": "string",
  "analysis_date": "ISO date",
  
  "profile_updates": {
    "confidence_level_change": {
      "previous": "low|medium|high|very_high",
      "new": "low|medium|high|very_high",
      "reason": "string"
    },
    
    "communication_identity": {
      "status": "confirmed|refined|unchanged",
      "updates": "string or null",
      "new_evidence": [{"quote": "string", "context": "string", "supports": "string"}]
    },
    
    "motivations_and_priorities": {
      "status": "confirmed|refined|new_discovered|unchanged",
      "updates": "string or null",
      "new_values_identified": ["string"],
      "new_avoids_identified": ["string"],
      "new_evidence": [{"quote": "string", "context": "string", "supports": "string"}]
    },
    
    "behavior_under_pressure": {
      "status": "confirmed|refined|new_discovered|unchanged",
      "new_observations": [
        {
          "situation": "string",
          "observed_behavior": "string",
          "quote": "string",
          "context": "string"
        }
      ]
    },
    
    "influence_tactics": {
      "status": "confirmed|refined|new_discovered|unchanged",
      "new_tactics": [
        {
          "objective": "string",
          "tactic": "string",
          "quote": "string",
          "context": "string"
        }
      ]
    },
    
    "vulnerabilities": {
      "status": "confirmed|refined|new_discovered|unchanged",
      "new_triggers": [{"trigger": "string", "evidence": "string"}],
      "new_blind_spots": [{"description": "string", "evidence": "string"}]
    },
    
    "interaction_strategy": {
      "status": "confirmed|refined|unchanged",
      "updates": "string or null",
      "new_recommendations": ["string"]
    },
    
    "warning_signs": {
      "status": "confirmed|new_discovered|unchanged",
      "new_signs": [
        {
          "signal": "string",
          "indicates": "string",
          "evidence": "string"
        }
      ]
    },
    
    "power_analysis": {
      "status": "confirmed|refined|unchanged",
      "updates": "string or null"
    }
  },
  
  "contradictions_detected": [
    {
      "aspect": "string",
      "previous_assessment": "string",
      "new_evidence_suggests": "string",
      "quote": "string",
      "recommendation": "string"
    }
  ],
  
  "behavior_evolution": {
    "detected": true|false,
    "description": "string or null",
    "evidence": ["string"]
  },
  
  "key_new_evidence": [
    {
      "quote": "string",
      "context": "string",
      "timestamp": "string or null",
      "evidence_type": "communication_style|motivation|pressure_response|influence_tactic|vulnerability|defense_trigger|cooperation_signal|power_indicator|warning_sign|relationship_dynamic",
      "supports_trait": "string",
      "confidence": "low|medium|high",
      "is_primary": true|false
    }
  ],
  
  "analysis_summary": {
    "patterns_confirmed": number,
    "patterns_refined": number,
    "new_patterns_discovered": number,
    "contradictions_found": number,
    "evidence_pieces_extracted": number,
    "recommended_next_analysis": "string"
  }
}
```

---

## NEW INTERVENTIONS TO ANALYZE

{{NEW_INTERVENTIONS}}',
    true,
    true,
    NOW(),
    NOW()
) ON CONFLICT (key) DO UPDATE SET
    prompt_template = EXCLUDED.prompt_template,
    updated_at = NOW();

-- ============================================
-- 7. TABLE COMMENTS
-- ============================================

COMMENT ON TABLE profile_evidence IS 'Stores key quotes and evidence supporting behavioral profile conclusions';
COMMENT ON TABLE transcript_interventions IS 'Caches extracted interventions per person per document for efficient re-analysis';

-- ============================================
-- DONE!
-- ============================================
SELECT 'Team Analysis Incremental Feature applied successfully!' as status;
