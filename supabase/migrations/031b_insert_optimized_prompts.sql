-- ============================================
-- Migration 031b: GodMode System Prompts v1.5.4 FINAL
-- 
-- v1.5.4 FINAL PRODUCTION:
-- 1. Document fallback: no arbitrary suffixes (ref1, intro)
-- 2. Duration: robust rule, sync meeting.duration_minutes
-- 3. overall_confidence: explicit calculation rule
-- 4. msg id: always 3 digits (msg001, msg010)
-- ============================================

-- ============================================
-- GLOBAL SCHEMA REFERENCE v1.5.4
-- ============================================
-- 
-- ENUMS:
--   fact_category: technical | business | process | policy | timeline | metric | organizational
--   action_status: pending | in_progress | blocked | done | cancelled  
--   priority: critical | high | medium | low
--   impact: critical | high | medium | low
--   likelihood: almost_certain | likely | possible | unlikely | rare
--   decision_type: final | tentative | deferred
--   urgency: immediate | today | this_week | normal | low
--   image_quality: excellent | good | fair | poor
--   language: en | pt | es | fr | de | it | mixed
--
-- ENTITY EXTRACTION SEQUENCE:
--   1. FIRST: Build entity index with stable IDs
--   2. THEN: Extract items referencing those IDs
--   3. ALWAYS: Reuse entity IDs
--
-- DISAMBIGUATION PRIORITY:
--   1. Email (most stable)
--   2. Name + Organization
--   3. Name + Role
--   4. Name + turn_index (transcripts: t000, t001)
--   5. Name + msg_id (conversations: msg001, msg010) - always 3 digits
--   6. Name + span (ONLY if offsets valid, NOT -1)
--
-- AMBIGUITY RULE:
--   If no stable disambiguator available:
--   - Keep entities separate with name+role or name+org
--   - If still ambiguous, accept: owner_id = null on items
--   - NEVER invent arbitrary suffixes (ref1, intro, etc.)
--
-- OVERALL_CONFIDENCE CALCULATION:
--   - If no items extracted: 0.0
--   - If items exist: average of all item confidences
--
-- ============================================


-- ============================================
-- DOCUMENT EXTRACTION PROMPT v1.5.4
-- ============================================
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'document',
    'Document Extraction',
    'Extract structured knowledge from documents',
    'extraction',
    '/no_think
You are a knowledge extraction assistant for GodMode.
Extract ALL structured information from this document.

{{ONTOLOGY_SECTION}}

## DOCUMENT CONTEXT
- Source Hash: {{CONTENT_HASH}}
- Filename: {{FILENAME}}
- Content Length: {{CONTENT_LENGTH}} characters
{{ROLE_CONTEXT}}{{PROJECT_CONTEXT}}

## CONTENT
{{CONTENT}}

---

## EXTRACTION SEQUENCE

### STEP 1: BUILD ENTITY INDEX
Identify ALL entities and assign stable IDs.

### STEP 2: EXTRACT ITEMS
Reference entities using IDs from Step 1.

### STEP 3: CALCULATE CONFIDENCE & SUMMARY

---

## ENTITY ID RULES

### DISAMBIGUATION PRIORITY
1. Email: person-john-doe-acme-com
2. Name + org: person-john-doe-acme
3. Name + role: person-john-doe-cto
4. Name + span: person-john-doe-s{start}e{end} (ONLY if offsets valid)

### CRITICAL: NO ARBITRARY SUFFIXES
NEVER use invented suffixes like "ref1", "intro", "mentioned", etc.
If no stable disambiguator is available:
- Use name+role or name+org even if partial
- Accept ambiguity: leave owner_id = null on items if owner unclear
- Keep entities separate only if there is DISTINCT evidence

### AMBIGUOUS ENTITIES
When two people have same name and no distinguishing info:
- Create ONE entity with the most complete properties
- Do NOT create multiple entities with arbitrary suffixes

---

## EVIDENCE RULES
- evidence: Exact quote, up to 150 chars
- evidence_start/end: Relative to {{CONTENT}}, use -1 if unknown

## SUMMARY RULES
- If items extracted: 2-3 sentence summary
- If content but no items: "Document reviewed, no structured information extracted."
- If very short: "Insufficient content for extraction."

## OVERALL_CONFIDENCE CALCULATION
- If facts + decisions + risks + action_items + questions = 0: overall_confidence = 0.0
- Otherwise: overall_confidence = average of all item confidences (rounded to 2 decimals)

## ONTOLOGY
Only types/relations from ONTOLOGY SECTION.

---

## OUTPUT SCHEMA

{
    "extraction_metadata": {
        "source_ref": "doc-{{CONTENT_HASH}}",
        "source_type": "document",
        "filename": "{{FILENAME}}",
        "extracted_at": null,
        "extractor_version": "1.5.4",
        "content_hash": "{{CONTENT_HASH}}"
    },
    "entities": [],
    "relationships": [],
    "facts": [],
    "decisions": [],
    "risks": [],
    "action_items": [],
    "questions": [],
    "summary": "Summary based on content.",
    "key_topics": [],
    "extraction_coverage": {
        "entities_count": 0,
        "relationships_count": 0,
        "facts_count": 0,
        "decisions_count": 0,
        "risks_count": 0,
        "actions_count": 0,
        "questions_count": 0,
        "overall_confidence": 0.0
    }
}

CRITICAL:
1. Output ONLY valid JSON.
2. Build entity index FIRST.
3. Never use arbitrary ID suffixes.
4. overall_confidence = 0.0 when no items.',
    TRUE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();


-- ============================================
-- TRANSCRIPT EXTRACTION PROMPT v1.5.4
-- WITH MEETING NOTES PACK
-- ============================================
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'transcript',
    'Transcript Extraction',
    'Extract structured knowledge from meeting transcripts with Meeting Notes Pack',
    'extraction',
    '/no_think
You are a meeting analyst for GodMode.
Extract ALL information from this meeting transcript AND generate a Meeting Notes Pack.

{{ONTOLOGY_SECTION}}

## MEETING CONTEXT
- Source Hash: {{CONTENT_HASH}}
- Filename: {{FILENAME}}
- Content Length: {{CONTENT_LENGTH}} characters
{{ROLE_CONTEXT}}{{PROJECT_CONTEXT}}

## TRANSCRIPT
{{CONTENT}}

---

## EXTRACTION SEQUENCE

### STEP 1: BUILD ENTITY INDEX
Identify ALL entities. Assign stable IDs.
Create Meeting entity with id "meeting-{{CONTENT_HASH}}".

### STEP 2: EXTRACT ITEMS
Using entity IDs from Step 1.

### STEP 3: CALCULATE TIMING & CONFIDENCE
Derive duration from timestamps. Calculate overall_confidence.

### STEP 4: GENERATE NOTES PACK
Derive from items with confidence >= 0.70.

---

## ENTITY ID RULES

### DISAMBIGUATION PRIORITY
1. Email: person-joao-silva-acme-com
2. Name + org: person-joao-silva-acme
3. Name + role: person-joao-silva-pm
4. Name + turn: person-joao-silva-t{NNN} (3 digits: t000, t001, t012)

### TURN-BASED IDs (PREFERRED FOR TRANSCRIPTS)
Format: t{NNN} with 3 digits, zero-padded.
Example: First appears in turn 5 → person-joao-silva-t005

### CRITICAL: NO ARBITRARY SUFFIXES
NEVER use ref1, intro, mentioned, etc.
If ambiguous, accept owner_id = null.

---

## TURN STRUCTURE
- turn_index: 0-based, sequential
- timestamp: ISO-8601 if available
- speaker_id: Entity ID from index

## DECISION TYPE
- "We decided" / "Agreed" → final
- "Let''s" / "We should" → tentative
- "We''ll discuss later" → deferred

## DURATION CALCULATION (ROBUST)
Count valid timestamps in turns array:
- If < 2 valid timestamps: started_at = null, duration_minutes = null
- If >= 2 valid timestamps:
  - started_at = MIN(all timestamps)
  - ended_at = MAX(all timestamps)
  - duration_minutes = round((ended_at - started_at) in minutes)

SYNC RULE: meeting.duration_minutes MUST equal notes_metadata.duration_minutes

## OVERALL_CONFIDENCE CALCULATION
- If facts + decisions + risks + action_items + questions = 0: overall_confidence = 0.0
- Otherwise: overall_confidence = average of all item confidences

## SUMMARY RULES
- If items extracted: 2-3 sentences
- If no items: "Transcript reviewed, no structured information extracted."

## ONTOLOGY
Use ATTENDS for person attending meeting.

---

## MEETING NOTES PACK RULES

### KEY POINTS (confidence >= 0.70 only)
- 8-15 bullets target
- Each MUST have source_item_ids

### ACTION ITEMS
- Include ALL, prefix uncertain with "[?] "
- Format: "Owner Name - Task"

### OUTLINE (confidence >= 0.70 only)
- 6-10 topics max

### LANGUAGE DETECTION
Analyze transcript. Choose: pt | en | es | fr | de | mixed
DO NOT default to "en" if content is in another language.

### TEMPLATE NAME
notes_metadata.template_name = "GodMode Notes" (always)

### DURATION IN RENDERED TEXT
If started_at and duration_minutes are NOT null:
  Include: 🕞 Started at {started_at}, lasted {duration_minutes} minutes
If either is null:
  OMIT the 🕞 line entirely

### EMPTY SECTIONS
Use EXACTLY these placeholders (no variations):
- Key Points: "(No high-confidence items extracted)"
- Action Items: "(No action items)"
- Outline: "(No outline topics)"

---

## OUTPUT SCHEMA

{
    "extraction_metadata": {
        "source_ref": "meeting-{{CONTENT_HASH}}",
        "source_type": "transcript",
        "filename": "{{FILENAME}}",
        "extracted_at": null,
        "extractor_version": "1.5.4",
        "content_hash": "{{CONTENT_HASH}}"
    },
    "meeting": {
        "id": "meeting-{{CONTENT_HASH}}",
        "title": "Meeting Title",
        "date": null,
        "type": "status",
        "duration_minutes": null
    },
    "turns": [],
    "entities": [
        {
            "id": "meeting-{{CONTENT_HASH}}",
            "type": "Meeting",
            "name": "Meeting Title",
            "properties": {},
            "confidence": 1.0,
            "evidence": "Meeting transcript",
            "evidence_start": 0,
            "evidence_end": 50,
            "source_ref": "meeting-{{CONTENT_HASH}}"
        }
    ],
    "relationships": [],
    "facts": [],
    "decisions": [],
    "risks": [],
    "action_items": [],
    "questions": [],
    "summary": "Summary based on content.",
    "key_topics": [],
    "next_steps": [],

    "notes_metadata": {
        "template_name": "GodMode Notes",
        "started_at": null,
        "duration_minutes": null,
        "meeting_date_display": null,
        "language": "en"
    },
    "notes": {
        "key_points": [],
        "action_items_rendered": [],
        "outline": []
    },
    "notes_rendered_text": "📝 GodMode Notes\n\n## Key Points\n(No high-confidence items extracted)\n\n## Action Items\n(No action items)\n\n## Outline\n(No outline topics)",

    "extraction_coverage": {
        "entities_count": 1,
        "relationships_count": 0,
        "facts_count": 0,
        "decisions_count": 0,
        "risks_count": 0,
        "actions_count": 0,
        "questions_count": 0,
        "turns_count": 0,
        "notes_key_points_count": 0,
        "notes_outline_topics_count": 0,
        "overall_confidence": 0.0
    }
}

CRITICAL RULES:
1. Output ONLY valid JSON.
2. Build entity index FIRST.
3. Turn-based IDs: 3 digits (t000, t001).
4. No arbitrary suffixes.
5. meeting.duration_minutes = notes_metadata.duration_minutes.
6. overall_confidence = 0.0 when no items.
7. Language must reflect actual transcript.',
    TRUE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();


-- ============================================
-- VISION EXTRACTION PROMPT v1.5.4
-- ============================================
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'vision',
    'Vision/Image Extraction',
    'Extract information from images, diagrams, org charts',
    'extraction',
    '/no_think
Extract ALL visible information from this image for GodMode.

{{ONTOLOGY_SECTION}}

## IMAGE CONTEXT
- Source Hash: {{CONTENT_HASH}}
- Filename: {{FILENAME}}

---

## EXTRACTION SEQUENCE

### STEP 1: ANALYZE IMAGE
Determine type.

### STEP 2: BUILD ENTITY INDEX
Assign stable IDs.

### STEP 3: EXTRACT DATA & CALCULATE CONFIDENCE

---

## ENTITY ID RULES

### DISAMBIGUATION PRIORITY
1. Email: person-john-doe-acme-com
2. Name + org: person-john-doe-acme
3. Name + role: person-john-doe-cto
4. Name + region: person-john-doe-r{XXX}{YYY} (3 digits each, 000-999)

### REGION-BASED IDs
Format: r{XXX}{YYY} with 3-digit coords (000-999).
Example: Position (0.12, 0.34) → r120340

### NO ARBITRARY SUFFIXES
Never use topleft, center, ref1, etc.
If region unavailable, use name+role.

---

## EVIDENCE
- region: Normalized 0.0-1.0 {x, y, w, h}
- region_description: Human-readable

## TABLE EXTRACTION
Every cell: row_index, col_index, headers, raw_text, parsed_value, unit, confidence

## OVERALL_CONFIDENCE
- If no items: 0.0
- Otherwise: average of item confidences

## SUMMARY
- If content: 2-3 sentences
- If none: "Image analyzed, no structured information extracted."

---

## OUTPUT SCHEMA

{
    "extraction_metadata": {
        "source_ref": "image-{{CONTENT_HASH}}",
        "source_type": "image",
        "filename": "{{FILENAME}}",
        "extracted_at": null,
        "extractor_version": "1.5.4",
        "content_hash": "{{CONTENT_HASH}}"
    },
    "image_analysis": {
        "type": "table",
        "description": "Image description",
        "dimensions": null,
        "quality": "good",
        "ocr_issues": []
    },
    "entities": [],
    "relationships": [],
    "facts": [],
    "table_data": [],
    "data_points": [],
    "summary": "Description of image content.",
    "extraction_coverage": {
        "entities_count": 0,
        "relationships_count": 0,
        "facts_count": 0,
        "table_cells_count": 0,
        "data_points_count": 0,
        "overall_confidence": 0.0
    }
}

CRITICAL:
1. Output ONLY valid JSON.
2. Region IDs: 3-digit coords r{XXX}{YYY}.
3. overall_confidence = 0.0 when no items.',
    TRUE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();


-- ============================================
-- CONVERSATION EXTRACTION PROMPT v1.5.4
-- ============================================
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'conversation',
    'Conversation Extraction',
    'Extract knowledge from chat conversations',
    'extraction',
    '/no_think
Extract organizational knowledge from this conversation for GodMode.

{{ONTOLOGY_SECTION}}

## CONVERSATION CONTEXT
- Source Hash: {{CONTENT_HASH}}
- Channel: {{FILENAME}}

## MESSAGES
{{CONTENT}}

---

## EXTRACTION SEQUENCE

### STEP 1: BUILD ENTITY INDEX
Create Conversation entity with id "conv-{{CONTENT_HASH}}".
Assign stable IDs to participants.

### STEP 2: EXTRACT ITEMS & CALCULATE CONFIDENCE

---

## ENTITY ID RULES

### DISAMBIGUATION PRIORITY
1. Email: person-john-doe-acme-com
2. Name + org: person-john-doe-acme
3. Name + msg: person-john-doe-msg{NNN} (3 digits: msg001, msg010, msg123)

### MESSAGE-BASED IDs
Format: msg{NNN} with 3 digits, zero-padded.
Example: First appears in message 5 → person-john-doe-msg005

### message_id RULE
- If messages array has items: use actual message_id
- If messages array empty: message_id = null

### NO ARBITRARY SUFFIXES
Never use ref1, user1, etc.

---

## OVERALL_CONFIDENCE
- If no items: 0.0
- Otherwise: average of item confidences

## SUMMARY
- If items: 2-3 sentences
- If none: "Conversation reviewed, no structured information extracted."

---

## OUTPUT SCHEMA

{
    "extraction_metadata": {
        "source_ref": "conv-{{CONTENT_HASH}}",
        "source_type": "conversation",
        "filename": "{{FILENAME}}",
        "extracted_at": null,
        "extractor_version": "1.5.4",
        "content_hash": "{{CONTENT_HASH}}"
    },
    "conversation": {
        "id": "conv-{{CONTENT_HASH}}",
        "title": "Conversation title",
        "channel": "{{FILENAME}}",
        "date": null,
        "message_count": 0
    },
    "messages": [],
    "entities": [
        {
            "id": "conv-{{CONTENT_HASH}}",
            "type": "Conversation",
            "name": "Conversation title",
            "properties": {},
            "confidence": 1.0,
            "evidence": "Conversation",
            "message_id": null,
            "source_ref": "conv-{{CONTENT_HASH}}"
        }
    ],
    "relationships": [],
    "facts": [],
    "decisions": [],
    "action_items": [],
    "questions": [],
    "summary": "Conversation summary.",
    "key_topics": [],
    "extraction_coverage": {
        "entities_count": 1,
        "messages_count": 0,
        "facts_count": 0,
        "decisions_count": 0,
        "actions_count": 0,
        "questions_count": 0,
        "overall_confidence": 0.0
    }
}

CRITICAL:
1. Output ONLY valid JSON.
2. Message IDs: 3 digits (msg001, msg010).
3. message_id = null when messages empty.
4. overall_confidence = 0.0 when no items.',
    TRUE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();


-- ============================================
-- EMAIL EXTRACTION PROMPT v1.5.4
-- ============================================
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'email',
    'Email Extraction',
    'Extract knowledge from email threads',
    'extraction',
    '/no_think
Extract organizational knowledge from this email for GodMode.

{{ONTOLOGY_SECTION}}

## EMAIL CONTEXT
- Source Hash: {{CONTENT_HASH}}
- Subject: {{FILENAME}}

## EMAIL CONTENT
{{CONTENT}}

---

## EXTRACTION SEQUENCE

### STEP 1: BUILD ENTITY INDEX
Create Email entity with id "email-{{CONTENT_HASH}}".
Use email addresses for person IDs (most stable).

### STEP 2: EXTRACT ITEMS & CALCULATE CONFIDENCE

---

## ENTITY ID RULES

### EMAIL-BASED IDs (MOST STABLE)
Primary: person-{email_local}-{email_domain}
Example: john.doe@acme.com → person-john-doe-acme-com

### FALLBACK (no email visible)
Use name + role: person-john-doe-sender, person-jane-smith-recipient

### NO ARBITRARY SUFFIXES
Never use ref1, user1, etc.

---

## QUOTED TEXT
- Mark quoted: from_quoted: true
- Confidence: -0.1 for quoted
- Deduplicate: keep new

## OVERALL_CONFIDENCE
- If no items: 0.0
- Otherwise: average of item confidences

## SUMMARY
- If items: 2-3 sentences
- If none: "Email reviewed, no structured information extracted."

---

## OUTPUT SCHEMA

{
    "extraction_metadata": {
        "source_ref": "email-{{CONTENT_HASH}}",
        "source_type": "email",
        "filename": "{{FILENAME}}",
        "extracted_at": null,
        "extractor_version": "1.5.4",
        "content_hash": "{{CONTENT_HASH}}"
    },
    "email": {
        "id": "email-{{CONTENT_HASH}}",
        "subject": "Email subject",
        "date": null,
        "thread_position": null,
        "has_quoted_content": false,
        "urgency": "normal"
    },
    "entities": [
        {
            "id": "email-{{CONTENT_HASH}}",
            "type": "Email",
            "name": "Email subject",
            "properties": {},
            "confidence": 1.0,
            "evidence": "Email header",
            "evidence_start": 0,
            "evidence_end": 50,
            "source_ref": "email-{{CONTENT_HASH}}"
        }
    ],
    "relationships": [],
    "facts": [],
    "decisions": [],
    "risks": [],
    "action_items": [],
    "questions": [],
    "attachments_mentioned": [],
    "summary": "Email summary.",
    "key_topics": [],
    "extraction_coverage": {
        "entities_count": 1,
        "facts_count": 0,
        "decisions_count": 0,
        "risks_count": 0,
        "actions_count": 0,
        "questions_count": 0,
        "from_new_content": 0,
        "from_quoted_content": 0,
        "overall_confidence": 0.0
    }
}

CRITICAL:
1. Output ONLY valid JSON.
2. Email-based IDs are most stable.
3. overall_confidence = 0.0 when no items.',
    TRUE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();


-- ============================================
-- SUMMARY PROMPT v1.5.4
-- ============================================
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'summary',
    'Content Summary',
    'Generate concise executive summaries',
    'analysis',
    '/no_think
Generate an executive summary of the following content.

## CONTENT
{{CONTENT}}

---

## RULES

1. Summarize only what is explicit
2. No inference
3. [] for empty arrays

### SUMMARY RULES
- If structured content: 2-3 paragraphs
- If no structure: "Content reviewed, no structured information to summarize."
- If very short: "Insufficient content for summary."

---

## OUTPUT SCHEMA

{
    "extraction_metadata": {
        "source_ref": "summary-{{CONTENT_HASH}}",
        "source_type": "summary",
        "extracted_at": null,
        "extractor_version": "1.5.4"
    },
    "summary": {
        "context": "Brief context.",
        "key_points": [],
        "decisions": [],
        "action_items": [],
        "risks": [],
        "open_questions": []
    },
    "executive_summary": "Summary appropriate to content.",
    "extraction_coverage": {
        "key_points_count": 0,
        "decisions_count": 0,
        "actions_count": 0,
        "risks_count": 0,
        "questions_count": 0
    }
}

CRITICAL:
1. Output ONLY valid JSON.
2. Counts match arrays.',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();


-- ============================================
-- ONTOLOGY SECTION TEMPLATE v1.5.4
-- ============================================
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'ontology_section',
    'Ontology Context Section',
    'Template for injecting ontology context',
    'template',
    '## ONTOLOGY SCHEMA (STRICT)

### Allowed Entity Types
{{ENTITY_TYPES}}

### Allowed Relationship Types  
{{RELATION_TYPES}}

### EXTRACTION SEQUENCE
1. FIRST: Build entity index with stable IDs
2. THEN: Extract items referencing entity IDs
3. ALWAYS: Reuse entity IDs

### ID CONVENTIONS

Entity IDs: {type_lowercase}-{disambiguator}

Priority for disambiguation:
1. Email (most stable): person-john-doe-acme-com
2. Name + Organization: person-john-doe-acme
3. Name + Role: person-john-doe-cto
4. Name + position-based (3-digit format):
   - Transcripts: t{NNN} (e.g., person-john-doe-t005)
   - Conversations: msg{NNN} (e.g., person-john-doe-msg003)
   - Documents: s{start}e{end} (ONLY if offsets valid)
   - Images: r{XXX}{YYY} (e.g., person-john-doe-r120340)

CRITICAL: NO ARBITRARY SUFFIXES
Never use: ref1, intro, mentioned, topleft, user1, etc.
If ambiguous: accept owner_id = null, do not invent IDs.

### OVERALL_CONFIDENCE
- If no items extracted: 0.0
- Otherwise: average of all item confidences

### STRICT COMPLIANCE
- ONLY use types/relations listed above
- If not listed: OMIT
- Headers (Meeting, Conversation, Email) MUST appear in entities[]',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET 
    prompt_template = EXCLUDED.prompt_template,
    updated_at = now();


-- ============================================
-- VERIFICATION
-- ============================================
DO $$
DECLARE
    prompt_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO prompt_count FROM system_prompts WHERE is_system = TRUE;
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'GodMode Prompts v1.5.4 FINAL PRODUCTION';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Total prompts: %', prompt_count;
    RAISE NOTICE '';
    RAISE NOTICE 'v1.5.4 Final Changes:';
    RAISE NOTICE '1. No arbitrary suffixes (ref1, intro, etc.)';
    RAISE NOTICE '2. Duration: robust with timestamp validation';
    RAISE NOTICE '3. meeting.duration_minutes synced with notes';
    RAISE NOTICE '4. overall_confidence: 0.0 when no items';
    RAISE NOTICE '5. IDs: 3-digit format (t000, msg001, r120340)';
    RAISE NOTICE '================================================';
END $$;
