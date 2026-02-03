/**
 * Tests for Transcript Output Validator v1.5
 * 
 * Tests:
 * 1. Valid transcript with notes produces valid references
 * 2. Empty transcript produces empty notes
 * 3. Invalid references fail validation
 * 4. Meeting entity must exist
 */

const { validateTranscriptOutput, isValidTranscriptOutput, ENUMS } = require('../validators');

// Test helper
function createBaseTranscript(overrides = {}) {
    return {
        extraction_metadata: {
            source_ref: 'meeting-abc123',
            source_type: 'transcript',
            filename: 'test.txt',
            extracted_at: null,
            extractor_version: '1.5',
            content_hash: 'abc123'
        },
        meeting: {
            id: 'meeting-abc123',
            title: 'Test Meeting',
            date: null,
            type: 'status',
            duration_minutes: null
        },
        turns: [],
        entities: [
            {
                id: 'meeting-abc123',
                type: 'Meeting',
                name: 'Test Meeting',
                properties: {},
                confidence: 1.0,
                evidence: 'Meeting transcript',
                evidence_start: 0,
                evidence_end: 50,
                source_ref: 'meeting-abc123'
            }
        ],
        relationships: [],
        facts: [],
        decisions: [],
        risks: [],
        action_items: [],
        questions: [],
        summary: '',
        key_topics: [],
        next_steps: [],
        extraction_coverage: {
            entities_count: 1,
            relationships_count: 0,
            facts_count: 0,
            decisions_count: 0,
            risks_count: 0,
            actions_count: 0,
            questions_count: 0,
            turns_count: 0,
            overall_confidence: 1.0
        },
        ...overrides
    };
}

// Test 1: Valid transcript with many items produces notes with valid references
function testValidTranscriptWithNotes() {
    console.log('Test 1: Valid transcript with notes and valid references');
    
    const transcript = createBaseTranscript({
        facts: [
            {
                id: 'fact-abc123-001',
                content: 'Sprint velocity increased by 20%',
                category: 'metric',
                confidence: 0.95,
                uncertain: false,
                speaker_id: null,
                turn_index: 2,
                related_entity_ids: [],
                evidence: 'velocity went up 20%',
                evidence_start: 100,
                evidence_end: 130,
                source_ref: 'meeting-abc123'
            },
            {
                id: 'fact-abc123-002',
                content: 'New feature completed',
                category: 'business',
                confidence: 0.90,
                uncertain: false,
                speaker_id: null,
                turn_index: 5,
                related_entity_ids: [],
                evidence: 'feature is done',
                evidence_start: 200,
                evidence_end: 220,
                source_ref: 'meeting-abc123'
            }
        ],
        decisions: [
            {
                id: 'decision-abc123-001',
                content: 'Postpone release to March',
                decision_type: 'final',
                owner_id: null,
                date: null,
                rationale: 'Need more testing',
                confidence: 0.92,
                uncertain: false,
                speaker_id: null,
                turn_index: 8,
                evidence: 'postpone to March',
                evidence_start: 300,
                evidence_end: 330,
                source_ref: 'meeting-abc123'
            }
        ],
        action_items: [
            {
                id: 'action-abc123-001',
                task: 'Complete security review',
                owner_id: 'person-john-acme',
                deadline: '2024-02-01',
                status: 'pending',
                priority: 'high',
                confidence: 0.95,
                uncertain: false,
                speaker_id: null,
                turn_index: 10,
                evidence: 'John to complete review',
                evidence_start: 400,
                evidence_end: 430,
                source_ref: 'meeting-abc123'
            }
        ],
        notes_metadata: {
            template_name: 'GodMode Notes',
            started_at: null,
            duration_minutes: null,
            meeting_date_display: null,
            language: 'en'
        },
        notes: {
            key_points: [
                {
                    text: 'Sprint velocity increased significantly',
                    source_item_ids: ['fact-abc123-001'],
                    speaker_id: null,
                    turn_index: null,
                    confidence: 0.95
                },
                {
                    text: 'Release postponed due to testing needs',
                    source_item_ids: ['decision-abc123-001'],
                    speaker_id: null,
                    turn_index: null,
                    confidence: 0.92
                }
            ],
            action_items_rendered: [
                {
                    action_item_id: 'action-abc123-001',
                    text: 'John - Complete security review',
                    owner_id: 'person-john-acme',
                    owner_name: 'John',
                    deadline: '2024-02-01',
                    status: 'pending',
                    priority: 'high',
                    turn_index: 10
                }
            ],
            outline: [
                {
                    topic: 'Progress Update',
                    bullets: [
                        {
                            text: 'Velocity improved by 20%',
                            source_item_ids: ['fact-abc123-001']
                        },
                        {
                            text: 'Feature completed',
                            source_item_ids: ['fact-abc123-002']
                        }
                    ]
                }
            ]
        },
        notes_rendered_text: '📝 GodMode Notes\n\n## Key Points\n- Sprint velocity increased\n- Release postponed',
        extraction_coverage: {
            entities_count: 1,
            relationships_count: 0,
            facts_count: 2,
            decisions_count: 1,
            risks_count: 0,
            actions_count: 1,
            questions_count: 0,
            turns_count: 0,
            notes_key_points_count: 2,
            notes_outline_topics_count: 1,
            overall_confidence: 0.93
        }
    });

    // Add person entity for relationship
    transcript.entities.push({
        id: 'person-john-acme',
        type: 'Person',
        name: 'John',
        properties: {},
        confidence: 0.95,
        evidence: 'John mentioned',
        evidence_start: 50,
        evidence_end: 60,
        source_ref: 'meeting-abc123'
    });

    const result = validateTranscriptOutput(transcript);
    
    if (result.valid) {
        console.log('  ✓ PASSED: Valid transcript with notes accepted');
        return true;
    } else {
        console.log('  ✗ FAILED:', result.errors);
        return false;
    }
}

// Test 2: Empty transcript produces empty notes
function testEmptyTranscript() {
    console.log('Test 2: Empty transcript with empty notes arrays');
    
    const transcript = createBaseTranscript({
        notes_metadata: {
            template_name: 'GodMode Notes',
            started_at: null,
            duration_minutes: null,
            meeting_date_display: null,
            language: 'en'
        },
        notes: {
            key_points: [],
            action_items_rendered: [],
            outline: []
        },
        notes_rendered_text: '📝 GodMode Notes\n\nNo items extracted.'
    });

    const result = validateTranscriptOutput(transcript);
    
    if (result.valid) {
        console.log('  ✓ PASSED: Empty transcript with empty notes accepted');
        return true;
    } else {
        console.log('  ✗ FAILED:', result.errors);
        return false;
    }
}

// Test 3: Invalid references fail validation
function testInvalidReferences() {
    console.log('Test 3: Notes with invalid references fail validation');
    
    const transcript = createBaseTranscript({
        facts: [
            {
                id: 'fact-abc123-001',
                content: 'A fact',
                category: 'business',
                confidence: 0.90,
                uncertain: false,
                speaker_id: null,
                turn_index: 1,
                related_entity_ids: [],
                evidence: 'evidence',
                evidence_start: 0,
                evidence_end: 10,
                source_ref: 'meeting-abc123'
            }
        ],
        notes: {
            key_points: [
                {
                    text: 'Key point referencing non-existent item',
                    source_item_ids: ['fact-nonexistent-999'],  // Invalid reference
                    speaker_id: null,
                    turn_index: null,
                    confidence: 0.80
                }
            ],
            action_items_rendered: [],
            outline: []
        }
    });

    const result = validateTranscriptOutput(transcript);
    
    if (!result.valid && result.errors.some(e => e.message.includes('non-existent'))) {
        console.log('  ✓ PASSED: Invalid reference detected');
        return true;
    } else {
        console.log('  ✗ FAILED: Should have detected invalid reference');
        return false;
    }
}

// Test 4: Missing Meeting entity fails validation
function testMissingMeetingEntity() {
    console.log('Test 4: Missing Meeting entity in entities array fails');
    
    const transcript = createBaseTranscript();
    // Remove Meeting entity
    transcript.entities = [
        {
            id: 'person-john-acme',
            type: 'Person',
            name: 'John',
            properties: {},
            confidence: 0.95,
            evidence: 'John',
            evidence_start: 0,
            evidence_end: 10,
            source_ref: 'meeting-abc123'
        }
    ];

    const result = validateTranscriptOutput(transcript);
    
    if (!result.valid && result.errors.some(e => e.message.includes('Meeting entity'))) {
        console.log('  ✓ PASSED: Missing Meeting entity detected');
        return true;
    } else {
        console.log('  ✗ FAILED: Should have detected missing Meeting entity');
        return false;
    }
}

// Test 5: action_items_rendered references must exist
function testActionItemRenderedReferences() {
    console.log('Test 5: action_items_rendered must reference existing action_items');
    
    const transcript = createBaseTranscript({
        action_items: [
            {
                id: 'action-abc123-001',
                task: 'Do something',
                owner_id: null,
                deadline: null,
                status: 'pending',
                priority: 'medium',
                confidence: 0.90,
                uncertain: false,
                speaker_id: null,
                turn_index: 1,
                evidence: 'do something',
                evidence_start: 0,
                evidence_end: 20,
                source_ref: 'meeting-abc123'
            }
        ],
        notes: {
            key_points: [],
            action_items_rendered: [
                {
                    action_item_id: 'action-nonexistent-999',  // Invalid
                    text: 'Invalid action reference',
                    owner_id: null,
                    owner_name: null,
                    deadline: null,
                    status: 'pending',
                    priority: 'medium',
                    turn_index: null
                }
            ],
            outline: []
        }
    });

    const result = validateTranscriptOutput(transcript);
    
    if (!result.valid && result.errors.some(e => e.message.includes('action_item'))) {
        console.log('  ✓ PASSED: Invalid action_item_id reference detected');
        return true;
    } else {
        console.log('  ✗ FAILED: Should have detected invalid action_item_id');
        return false;
    }
}

// Test 6: Outline bullets must have source_item_ids
function testOutlineBulletReferences() {
    console.log('Test 6: Outline bullets must have non-empty source_item_ids');
    
    const transcript = createBaseTranscript({
        facts: [
            {
                id: 'fact-abc123-001',
                content: 'A fact',
                category: 'business',
                confidence: 0.90,
                uncertain: false,
                speaker_id: null,
                turn_index: 1,
                related_entity_ids: [],
                evidence: 'evidence',
                evidence_start: 0,
                evidence_end: 10,
                source_ref: 'meeting-abc123'
            }
        ],
        notes: {
            key_points: [],
            action_items_rendered: [],
            outline: [
                {
                    topic: 'Topic without references',
                    bullets: [
                        {
                            text: 'Bullet with empty source_item_ids',
                            source_item_ids: []  // Invalid - must be non-empty
                        }
                    ]
                }
            ]
        }
    });

    const result = validateTranscriptOutput(transcript);
    
    if (!result.valid && result.errors.some(e => e.message.includes('non-empty array'))) {
        console.log('  ✓ PASSED: Empty source_item_ids detected');
        return true;
    } else {
        console.log('  ✗ FAILED: Should have detected empty source_item_ids');
        return false;
    }
}

// Test 7: Low confidence items in key_points generate warnings
function testLowConfidenceWarnings() {
    console.log('Test 7: Low confidence items in key_points generate warnings');
    
    const transcript = createBaseTranscript({
        facts: [
            {
                id: 'fact-abc123-001',
                content: 'Uncertain fact',
                category: 'business',
                confidence: 0.55,  // Below 0.70 threshold
                uncertain: true,
                speaker_id: null,
                turn_index: 1,
                related_entity_ids: [],
                evidence: 'maybe this happened',
                evidence_start: 0,
                evidence_end: 20,
                source_ref: 'meeting-abc123'
            }
        ],
        notes: {
            key_points: [
                {
                    text: 'Key point from low-confidence item',
                    source_item_ids: ['fact-abc123-001'],  // References low-confidence
                    speaker_id: null,
                    turn_index: null,
                    confidence: 0.55
                }
            ],
            action_items_rendered: [],
            outline: []
        }
    });

    const result = validateTranscriptOutput(transcript);
    
    // Should be valid but with warnings
    if (result.valid && result.warnings.some(w => w.message.includes('low-confidence'))) {
        console.log('  ✓ PASSED: Low confidence warning generated');
        return true;
    } else {
        console.log('  ✗ FAILED: Should have generated low-confidence warning');
        console.log('    Warnings:', result.warnings);
        return false;
    }
}

// Run all tests
function runAllTests() {
    console.log('\n========================================');
    console.log('Transcript Validator Tests v1.5.1');
    console.log('========================================\n');

    const tests = [
        testValidTranscriptWithNotes,
        testEmptyTranscript,
        testInvalidReferences,
        testMissingMeetingEntity,
        testActionItemRenderedReferences,
        testOutlineBulletReferences,
        testLowConfidenceWarnings
    ];

    let passed = 0;
    let failed = 0;

    tests.forEach(test => {
        try {
            if (test()) {
                passed++;
            } else {
                failed++;
            }
        } catch (e) {
            console.log(`  ✗ ERROR: ${e.message}`);
            failed++;
        }
        console.log('');
    });

    console.log('========================================');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('========================================\n');

    return failed === 0;
}

// Export for external use
module.exports = {
    runAllTests,
    createBaseTranscript
};

// Run if executed directly
if (require.main === module) {
    const success = runAllTests();
    process.exit(success ? 0 : 1);
}
