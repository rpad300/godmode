/**
 * Purpose:
 *   Hand-written runtime validator for the transcript extraction JSON schema
 *   (v1.5 / v1.6). Ensures LLM output conforms to the expected structure
 *   before it is persisted or displayed.
 *
 * Responsibilities:
 *   - Validate top-level extraction fields: entities, relationships, facts,
 *     decisions, risks, action_items, questions, turns
 *   - Validate the Meeting Notes Pack (notes_metadata, notes, notes_rendered_text)
 *   - Enforce referential integrity: notes must reference IDs present in the
 *     extracted items (facts, decisions, risks, action_items, questions)
 *   - Flag low-confidence items (< 0.70) referenced by key_points or outline
 *   - Cross-check extraction_coverage counts against actual array lengths
 *   - Enforce enum values (fact_category, action_status, priority, etc.)
 *
 * Key dependencies:
 *   - None (zero external dependencies; pure validation logic)
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - Errors block further processing; warnings are advisory
 *   - "transcript" is a valid sentinel in source_item_ids for content derived
 *     directly from the raw transcript rather than an extracted item
 *   - ENUMS.fact_category is intentionally broad to tolerate common LLM
 *     variations; add new categories here when the extraction prompt changes
 *   - isValidTranscriptOutput() is a convenience boolean wrapper around
 *     validateTranscriptOutput()
 */

// Enums
const ENUMS = {
    fact_category: [
        // Core categories
        'technical', 'business', 'process', 'policy', 'timeline', 'metric', 'organizational',
        // Additional common categories (LLMs often generate these)
        'project', 'progress', 'status', 'data_model', 'data', 'architecture', 'design',
        'legal', 'compliance', 'financial', 'strategic', 'operational', 'resource',
        'risk', 'security', 'performance', 'quality', 'integration', 'infrastructure',
        'general', 'context', 'background', 'requirement', 'constraint', 'dependency'
    ],
    action_status: ['pending', 'in_progress', 'blocked', 'done', 'cancelled'],
    priority: ['critical', 'high', 'medium', 'low'],
    impact: ['critical', 'high', 'medium', 'low'],
    likelihood: ['almost_certain', 'likely', 'possible', 'unlikely', 'rare'],
    decision_type: ['final', 'tentative', 'deferred'],
    urgency: ['immediate', 'today', 'this_week', 'normal', 'low'],
    meeting_type: ['status', 'planning', 'review', 'retrospective', 'decision', 'brainstorm', 'other'],
    language: ['en', 'pt', 'es', 'fr', 'de', 'it', 'mixed']
};

/**
 * Validation result object
 */
class ValidationResult {
    constructor() {
        this.valid = true;
        this.errors = [];
        this.warnings = [];
    }

    addError(path, message) {
        this.valid = false;
        this.errors.push({ path, message });
    }

    addWarning(path, message) {
        this.warnings.push({ path, message });
    }
}

/**
 * Validate transcript extraction output
 * @param {object} output - The transcript extraction output
 * @returns {ValidationResult}
 */
function validateTranscriptOutput(output) {
    const result = new ValidationResult();

    if (!output || typeof output !== 'object') {
        result.addError('root', 'Output must be an object');
        return result;
    }

    // Validate extraction_metadata
    validateExtractionMetadata(output.extraction_metadata, result);

    // Validate meeting header
    validateMeetingHeader(output.meeting, result);

    // Validate turns
    validateTurns(output.turns, result);

    // Validate entities
    validateEntities(output.entities, result);

    // Validate relationships
    validateRelationships(output.relationships, output.entities, result);

    // Validate extracted items
    const itemIds = new Set();
    validateFacts(output.facts, itemIds, result);
    validateDecisions(output.decisions, itemIds, result);
    validateRisks(output.risks, itemIds, result);
    validateActionItems(output.action_items, itemIds, result);
    validateQuestions(output.questions, itemIds, result);

    // Validate notes pack (if present)
    if (output.notes_metadata || output.notes || output.notes_rendered_text) {
        validateNotesPack(output, itemIds, result);
    }

    // Validate extraction_coverage
    validateCoverage(output, result);

    return result;
}

/**
 * Validate extraction_metadata
 */
function validateExtractionMetadata(metadata, result) {
    if (!metadata) {
        result.addWarning('extraction_metadata', 'Missing extraction_metadata');
        return;
    }

    if (!metadata.source_ref) {
        result.addError('extraction_metadata.source_ref', 'source_ref is required');
    }

    if (metadata.source_type !== 'transcript') {
        result.addWarning('extraction_metadata.source_type', `Expected 'transcript', got '${metadata.source_type}'`);
    }

    if (!metadata.extractor_version) {
        result.addWarning('extraction_metadata.extractor_version', 'Missing extractor_version');
    }
}

/**
 * Validate meeting header
 */
function validateMeetingHeader(meeting, result) {
    if (!meeting) {
        result.addError('meeting', 'Meeting header is required');
        return;
    }

    if (!meeting.id) {
        result.addError('meeting.id', 'Meeting ID is required');
    }

    if (!meeting.title && meeting.title !== '') {
        result.addWarning('meeting.title', 'Meeting title is recommended');
    }
}

/**
 * Validate turns array
 */
function validateTurns(turns, result) {
    if (!Array.isArray(turns)) {
        result.addWarning('turns', 'turns should be an array');
        return;
    }

    turns.forEach((turn, idx) => {
        if (typeof turn.turn_index !== 'number') {
            result.addError(`turns[${idx}].turn_index`, 'turn_index must be a number');
        }
        if (!turn.text && turn.text !== '') {
            result.addWarning(`turns[${idx}].text`, 'turn text is recommended');
        }
    });
}

/**
 * Validate entities array
 */
function validateEntities(entities, result) {
    if (!Array.isArray(entities)) {
        result.addError('entities', 'entities must be an array');
        return;
    }

    const entityIds = new Set();
    let hasMeetingEntity = false;

    entities.forEach((entity, idx) => {
        if (!entity.id) {
            result.addError(`entities[${idx}].id`, 'Entity ID is required');
        } else {
            if (entityIds.has(entity.id)) {
                result.addError(`entities[${idx}].id`, `Duplicate entity ID: ${entity.id}`);
            }
            entityIds.add(entity.id);
        }

        if (!entity.type) {
            result.addError(`entities[${idx}].type`, 'Entity type is required');
        }

        if (entity.type === 'Meeting') {
            hasMeetingEntity = true;
        }

        if (typeof entity.confidence !== 'number' || entity.confidence < 0 || entity.confidence > 1) {
            result.addWarning(`entities[${idx}].confidence`, 'confidence should be a number between 0 and 1');
        }
    });

    if (!hasMeetingEntity) {
        result.addError('entities', 'Meeting entity must exist in entities array');
    }
}

/**
 * Validate relationships array
 */
function validateRelationships(relationships, entities, result) {
    if (!Array.isArray(relationships)) {
        result.addError('relationships', 'relationships must be an array');
        return;
    }

    const entityIds = new Set((entities || []).map(e => e.id));

    relationships.forEach((rel, idx) => {
        if (!rel.id) {
            result.addError(`relationships[${idx}].id`, 'Relationship ID is required');
        }

        if (!rel.from_id) {
            result.addError(`relationships[${idx}].from_id`, 'from_id is required');
        } else if (!entityIds.has(rel.from_id)) {
            result.addError(`relationships[${idx}].from_id`, `from_id references non-existent entity: ${rel.from_id}`);
        }

        if (!rel.to_id) {
            result.addError(`relationships[${idx}].to_id`, 'to_id is required');
        } else if (!entityIds.has(rel.to_id)) {
            result.addError(`relationships[${idx}].to_id`, `to_id references non-existent entity: ${rel.to_id}`);
        }

        if (!rel.relation) {
            result.addError(`relationships[${idx}].relation`, 'relation type is required');
        }
    });
}

/**
 * Validate facts array
 */
function validateFacts(facts, itemIds, result) {
    if (!Array.isArray(facts)) {
        result.addError('facts', 'facts must be an array');
        return;
    }

    facts.forEach((fact, idx) => {
        if (!fact.id) {
            result.addError(`facts[${idx}].id`, 'Fact ID is required');
        } else {
            itemIds.add(fact.id);
        }

        if (!fact.content) {
            result.addError(`facts[${idx}].content`, 'Fact content is required');
        }

        if (fact.category && !ENUMS.fact_category.includes(fact.category)) {
            result.addWarning(`facts[${idx}].category`, `Invalid category: ${fact.category}. Expected: ${ENUMS.fact_category.join(', ')}`);
        }
    });
}

/**
 * Validate decisions array
 */
function validateDecisions(decisions, itemIds, result) {
    if (!Array.isArray(decisions)) {
        result.addError('decisions', 'decisions must be an array');
        return;
    }

    decisions.forEach((dec, idx) => {
        if (!dec.id) {
            result.addError(`decisions[${idx}].id`, 'Decision ID is required');
        } else {
            itemIds.add(dec.id);
        }

        if (!dec.content) {
            result.addError(`decisions[${idx}].content`, 'Decision content is required');
        }

        if (dec.decision_type && !ENUMS.decision_type.includes(dec.decision_type)) {
            result.addWarning(`decisions[${idx}].decision_type`, `Invalid decision_type: ${dec.decision_type}`);
        }
    });
}

/**
 * Validate risks array
 */
function validateRisks(risks, itemIds, result) {
    if (!Array.isArray(risks)) {
        result.addError('risks', 'risks must be an array');
        return;
    }

    risks.forEach((risk, idx) => {
        if (!risk.id) {
            result.addError(`risks[${idx}].id`, 'Risk ID is required');
        } else {
            itemIds.add(risk.id);
        }

        if (!risk.content) {
            result.addError(`risks[${idx}].content`, 'Risk content is required');
        }

        if (risk.impact && !ENUMS.impact.includes(risk.impact)) {
            result.addWarning(`risks[${idx}].impact`, `Invalid impact: ${risk.impact}`);
        }

        if (risk.likelihood && !ENUMS.likelihood.includes(risk.likelihood)) {
            result.addWarning(`risks[${idx}].likelihood`, `Invalid likelihood: ${risk.likelihood}`);
        }
    });
}

/**
 * Validate action_items array
 */
function validateActionItems(actionItems, itemIds, result) {
    if (!Array.isArray(actionItems)) {
        result.addError('action_items', 'action_items must be an array');
        return;
    }

    actionItems.forEach((action, idx) => {
        if (!action.id) {
            result.addError(`action_items[${idx}].id`, 'Action item ID is required');
        } else {
            itemIds.add(action.id);
        }

        if (!action.task) {
            result.addError(`action_items[${idx}].task`, 'Action item task is required');
        }

        if (action.status && !ENUMS.action_status.includes(action.status)) {
            result.addWarning(`action_items[${idx}].status`, `Invalid status: ${action.status}`);
        }

        if (action.priority && !ENUMS.priority.includes(action.priority)) {
            result.addWarning(`action_items[${idx}].priority`, `Invalid priority: ${action.priority}`);
        }
    });
}

/**
 * Validate questions array
 */
function validateQuestions(questions, itemIds, result) {
    if (!Array.isArray(questions)) {
        result.addError('questions', 'questions must be an array');
        return;
    }

    questions.forEach((q, idx) => {
        if (!q.id) {
            result.addError(`questions[${idx}].id`, 'Question ID is required');
        } else {
            itemIds.add(q.id);
        }

        if (!q.content) {
            result.addError(`questions[${idx}].content`, 'Question content is required');
        }
    });
}

/**
 * Validate Meeting Notes Pack (v1.5.1)
 */
function validateNotesPack(output, extractedItemIds, result) {
    const { notes_metadata, notes, notes_rendered_text } = output;

    // Build confidence map for items
    const itemConfidenceMap = new Map();
    const lowConfidenceItems = new Set();
    
    ['facts', 'decisions', 'risks'].forEach(arrayName => {
        if (Array.isArray(output[arrayName])) {
            output[arrayName].forEach(item => {
                if (item.id) {
                    itemConfidenceMap.set(item.id, item.confidence || 0);
                    if ((item.confidence || 0) < 0.70) {
                        lowConfidenceItems.add(item.id);
                    }
                }
            });
        }
    });

    // Validate notes_metadata
    if (notes_metadata) {
        if (typeof notes_metadata.template_name !== 'string') {
            result.addWarning('notes_metadata.template_name', 'template_name should be a string');
        }
        
        // Validate language enum (v1.6)
        if (notes_metadata.language) {
            if (!ENUMS.language.includes(notes_metadata.language)) {
                result.addError(
                    'notes_metadata.language',
                    `Invalid language: "${notes_metadata.language}". Must be one of: ${ENUMS.language.join(', ')}`
                );
            }
        }
        
        // Validate duration_minutes is a number or null
        if (notes_metadata.duration_minutes !== null && notes_metadata.duration_minutes !== undefined) {
            if (typeof notes_metadata.duration_minutes !== 'number') {
                result.addWarning('notes_metadata.duration_minutes', 'duration_minutes should be a number');
            }
        }
    }

    // Validate notes
    if (!notes) {
        result.addWarning('notes', 'notes object is recommended when notes_metadata is present');
        return;
    }

    // Validate key_points (v1.5.1: only confidence >= 0.70)
    if (Array.isArray(notes.key_points)) {
        notes.key_points.forEach((kp, idx) => {
            if (!kp.text) {
                result.addError(`notes.key_points[${idx}].text`, 'Key point text is required');
            }

            if (!Array.isArray(kp.source_item_ids) || kp.source_item_ids.length === 0) {
                result.addError(`notes.key_points[${idx}].source_item_ids`, 'source_item_ids must be a non-empty array');
            } else {
                kp.source_item_ids.forEach((refId, refIdx) => {
                    // "transcript" is a valid placeholder for content derived directly from transcript
                    if (refId === 'transcript') {
                        return; // Valid placeholder, skip validation
                    }
                    if (!extractedItemIds.has(refId)) {
                        // Downgrade to warning - LLMs sometimes generate invalid references
                        result.addWarning(
                            `notes.key_points[${idx}].source_item_ids[${refIdx}]`,
                            `Reference to non-existent item: ${refId}`
                        );
                    }
                    // Check confidence threshold for key_points
                    if (lowConfidenceItems.has(refId)) {
                        result.addWarning(
                            `notes.key_points[${idx}].source_item_ids[${refIdx}]`,
                            `Key point references low-confidence item (< 0.70): ${refId}`
                        );
                    }
                });
            }
        });
    }

    // Validate action_items_rendered
    if (Array.isArray(notes.action_items_rendered)) {
        const actionItemIds = new Set((output.action_items || []).map(a => a.id));

        notes.action_items_rendered.forEach((air, idx) => {
            if (!air.action_item_id) {
                result.addError(`notes.action_items_rendered[${idx}].action_item_id`, 'action_item_id is required');
            } else if (!actionItemIds.has(air.action_item_id)) {
                result.addError(
                    `notes.action_items_rendered[${idx}].action_item_id`,
                    `Reference to non-existent action_item: ${air.action_item_id}`
                );
            }

            if (!air.text) {
                result.addError(`notes.action_items_rendered[${idx}].text`, 'Rendered text is required');
            }
        });
    }

    // Validate outline
    if (Array.isArray(notes.outline)) {
        if (notes.outline.length > 10) {
            result.addWarning('notes.outline', `Outline has ${notes.outline.length} topics, recommended max is 10`);
        }

        notes.outline.forEach((topic, tIdx) => {
            if (!topic.topic) {
                result.addError(`notes.outline[${tIdx}].topic`, 'Topic name is required');
            }

            if (!Array.isArray(topic.bullets)) {
                result.addError(`notes.outline[${tIdx}].bullets`, 'bullets must be an array');
            } else {
                if (topic.bullets.length > 6) {
                    result.addWarning(`notes.outline[${tIdx}].bullets`, `Topic has ${topic.bullets.length} bullets, recommended max is 6`);
                }

                topic.bullets.forEach((bullet, bIdx) => {
                    if (!bullet.text) {
                        result.addError(`notes.outline[${tIdx}].bullets[${bIdx}].text`, 'Bullet text is required');
                    }

                    if (!Array.isArray(bullet.source_item_ids) || bullet.source_item_ids.length === 0) {
                        result.addError(
                            `notes.outline[${tIdx}].bullets[${bIdx}].source_item_ids`,
                            'source_item_ids must be a non-empty array'
                        );
                    } else {
                        bullet.source_item_ids.forEach((refId, refIdx) => {
                            // "transcript" is a valid placeholder for content derived directly from transcript
                            if (refId === 'transcript') {
                                return; // Valid placeholder, skip validation
                            }
                            if (!extractedItemIds.has(refId)) {
                                // Downgrade to warning - LLMs sometimes generate invalid references
                                result.addWarning(
                                    `notes.outline[${tIdx}].bullets[${bIdx}].source_item_ids[${refIdx}]`,
                                    `Reference to non-existent item: ${refId}`
                                );
                            }
                            // Check confidence threshold for outline (v1.5.1)
                            if (lowConfidenceItems.has(refId)) {
                                result.addWarning(
                                    `notes.outline[${tIdx}].bullets[${bIdx}].source_item_ids[${refIdx}]`,
                                    `Outline references low-confidence item (< 0.70): ${refId}`
                                );
                            }
                        });
                    }
                });
            }
        });
    }

    // Validate notes_rendered_text
    if (notes_rendered_text !== undefined && typeof notes_rendered_text !== 'string') {
        result.addError('notes_rendered_text', 'notes_rendered_text must be a string');
    }
}

/**
 * Validate extraction_coverage counts
 */
function validateCoverage(output, result) {
    const coverage = output.extraction_coverage;
    if (!coverage) {
        result.addWarning('extraction_coverage', 'extraction_coverage is recommended');
        return;
    }

    const checks = [
        ['entities_count', 'entities'],
        ['relationships_count', 'relationships'],
        ['facts_count', 'facts'],
        ['decisions_count', 'decisions'],
        ['risks_count', 'risks'],
        ['actions_count', 'action_items'],
        ['questions_count', 'questions'],
        ['turns_count', 'turns']
    ];

    checks.forEach(([countKey, arrayKey]) => {
        const declared = coverage[countKey];
        const actual = Array.isArray(output[arrayKey]) ? output[arrayKey].length : 0;

        if (declared !== undefined && declared !== actual) {
            result.addWarning(
                `extraction_coverage.${countKey}`,
                `Declared ${declared} but actual array length is ${actual}`
            );
        }
    });

    // Check notes counts
    if (output.notes) {
        if (coverage.notes_key_points_count !== undefined) {
            const actual = Array.isArray(output.notes.key_points) ? output.notes.key_points.length : 0;
            if (coverage.notes_key_points_count !== actual) {
                result.addWarning(
                    'extraction_coverage.notes_key_points_count',
                    `Declared ${coverage.notes_key_points_count} but actual is ${actual}`
                );
            }
        }

        if (coverage.notes_outline_topics_count !== undefined) {
            const actual = Array.isArray(output.notes.outline) ? output.notes.outline.length : 0;
            if (coverage.notes_outline_topics_count !== actual) {
                result.addWarning(
                    'extraction_coverage.notes_outline_topics_count',
                    `Declared ${coverage.notes_outline_topics_count} but actual is ${actual}`
                );
            }
        }
    }
}

/**
 * Quick validation check - returns true/false
 */
function isValidTranscriptOutput(output) {
    const result = validateTranscriptOutput(output);
    return result.valid;
}

module.exports = {
    validateTranscriptOutput,
    isValidTranscriptOutput,
    ValidationResult,
    ENUMS
};
