/**
 * Golden Tests for v1.6 Extraction Outputs
 * 
 * Tests expected outputs for:
 * 1. Document extraction
 * 2. Transcript extraction with notes
 * 3. Conversation extraction
 * 4. Email extraction
 * 
 * Run: node src/tests/golden.test.js
 */

const { validateTranscriptOutput } = require('../validators');

// ============================================
// GOLDEN OUTPUT TEMPLATES
// ============================================

/**
 * Expected document extraction output structure v1.6
 */
const GOLDEN_DOCUMENT = {
    extraction_metadata: {
        source_ref: 'doc-a1b2c3d4',
        source_type: 'document',
        filename: 'project-proposal.pdf',
        extracted_at: null, // Filled by runtime
        extractor_version: '1.6',
        content_hash: 'a1b2c3d4'
    },
    entities: [
        {
            id: 'person-john-doe-acme-com',
            type: 'Person',
            name: 'John Doe',
            properties: {
                email: 'john.doe@acme.com',
                role: 'Project Manager',
                organization: 'ACME Corp'
            },
            confidence: 0.95,
            evidence: 'John Doe, Project Manager at ACME',
            evidence_start: 45,
            evidence_end: 82,
            source_ref: 'doc-a1b2c3d4'
        },
        {
            id: 'org-acme-corp',
            type: 'Organization',
            name: 'ACME Corp',
            properties: {},
            confidence: 0.98,
            evidence: 'ACME Corp',
            evidence_start: 70,
            evidence_end: 79,
            source_ref: 'doc-a1b2c3d4'
        }
    ],
    relationships: [
        {
            id: 'rel-person-john-doe-acme-com-WORKS_AT-org-acme-corp',
            from_id: 'person-john-doe-acme-com',
            from_type: 'Person',
            to_id: 'org-acme-corp',
            to_type: 'Organization',
            relation_type: 'WORKS_AT',
            confidence: 0.90,
            evidence: 'at ACME Corp',
            source_ref: 'doc-a1b2c3d4'
        }
    ],
    facts: [
        {
            id: 'fact-a1b2c3d4-001',
            content: 'Project budget is $500,000',
            category: 'business',
            confidence: 0.95,
            uncertain: false,
            speaker_id: null,
            related_entity_ids: [],
            evidence: 'budget of $500,000',
            evidence_start: 150,
            evidence_end: 175,
            source_ref: 'doc-a1b2c3d4'
        }
    ],
    decisions: [
        {
            id: 'decision-a1b2c3d4-001',
            content: 'Proceed with Phase 2 development',
            decision_type: 'final',
            made_by_id: 'person-john-doe-acme-com',
            date: null,
            confidence: 0.85,
            uncertain: false,
            related_entity_ids: [],
            evidence: 'decided to proceed with Phase 2',
            evidence_start: 300,
            evidence_end: 340,
            source_ref: 'doc-a1b2c3d4'
        }
    ],
    risks: [],
    action_items: [],
    questions: [],
    summary: 'Project proposal document outlining Phase 2 development with $500,000 budget.',
    key_topics: ['project proposal', 'budget', 'Phase 2'],
    extraction_coverage: {
        entities_count: 2,
        relationships_count: 1,
        facts_count: 1,
        decisions_count: 1,
        risks_count: 0,
        actions_count: 0,
        questions_count: 0,
        overall_confidence: 0.91
    }
};

/**
 * Expected transcript extraction output structure v1.6 with notes
 */
const GOLDEN_TRANSCRIPT = {
    extraction_metadata: {
        source_ref: 'meeting-b2c3d4e5',
        source_type: 'transcript',
        filename: 'standup-2024-01-15.txt',
        extracted_at: null,
        extractor_version: '1.6',
        content_hash: 'b2c3d4e5'
    },
    meeting: {
        id: 'meeting-b2c3d4e5',
        title: 'Daily Standup',
        date: '2024-01-15',
        type: 'status',
        duration_minutes: 15
    },
    turns: [
        {
            turn_index: 0,
            speaker_label: 'Alice',
            speaker_id: 'person-alice-tech-corp',
            timestamp: '09:00',
            text: 'Good morning everyone. I completed the API refactoring yesterday.'
        },
        {
            turn_index: 1,
            speaker_label: 'Bob',
            speaker_id: 'person-bob-tech-corp',
            timestamp: '09:01',
            text: 'Great. I\'m working on the frontend integration today.'
        }
    ],
    entities: [
        {
            id: 'meeting-b2c3d4e5',
            type: 'Meeting',
            name: 'Daily Standup',
            properties: { date: '2024-01-15', type: 'status' },
            confidence: 1.0,
            evidence: 'Daily Standup transcript',
            evidence_start: 0,
            evidence_end: 30,
            source_ref: 'meeting-b2c3d4e5'
        },
        {
            id: 'person-alice-tech-corp',
            type: 'Person',
            name: 'Alice',
            properties: { organization: 'Tech Corp' },
            confidence: 0.95,
            evidence: 'Alice:',
            evidence_start: 0,
            evidence_end: 6,
            source_ref: 'meeting-b2c3d4e5'
        }
    ],
    relationships: [
        {
            id: 'rel-person-alice-tech-corp-ATTENDS-meeting-b2c3d4e5',
            from_id: 'person-alice-tech-corp',
            from_type: 'Person',
            to_id: 'meeting-b2c3d4e5',
            to_type: 'Meeting',
            relation: 'ATTENDS',
            relation_type: 'ATTENDS',
            properties: { role: 'participant' },
            confidence: 0.98,
            evidence: 'Alice spoke in meeting',
            source_ref: 'meeting-b2c3d4e5'
        }
    ],
    facts: [
        {
            id: 'fact-b2c3d4e5-001',
            content: 'API refactoring completed',
            category: 'technical',
            confidence: 0.90,
            uncertain: false,
            speaker_id: 'person-alice-tech-corp',
            turn_index: 0,
            related_entity_ids: [],
            evidence: 'I completed the API refactoring yesterday',
            evidence_start: 25,
            evidence_end: 68,
            source_ref: 'meeting-b2c3d4e5'
        }
    ],
    decisions: [],
    risks: [],
    action_items: [
        {
            id: 'action-b2c3d4e5-001',
            task: 'Work on frontend integration',
            content: 'Work on frontend integration',
            owner_id: 'person-bob-tech-corp',
            deadline: null,
            status: 'in_progress',
            priority: 'medium',
            speaker_id: 'person-bob-tech-corp',
            turn_index: 1,
            confidence: 0.85,
            uncertain: false,
            evidence: 'I\'m working on the frontend integration today',
            evidence_start: 100,
            evidence_end: 145,
            source_ref: 'meeting-b2c3d4e5'
        }
    ],
    questions: [],
    summary: 'Daily standup with updates on API refactoring completion and frontend work.',
    key_topics: ['API refactoring', 'frontend integration'],
    next_steps: ['Complete frontend integration'],
    notes_metadata: {
        template_name: 'GodMode Notes',
        started_at: '2024-01-15T09:00:00Z',
        duration_minutes: 15,
        meeting_date_display: '2024-01-15',
        language: 'en'
    },
    notes: {
        key_points: [
            {
                text: 'API refactoring completed by Alice',
                source_item_ids: ['fact-b2c3d4e5-001'],
                speaker_id: 'person-alice-tech-corp',
                turn_index: 0,
                confidence: 0.90
            }
        ],
        action_items_rendered: [
            {
                action_item_id: 'action-b2c3d4e5-001',
                text: 'Bob - Work on frontend integration - B',
                owner_id: 'person-bob-tech-corp',
                deadline: null,
                status: 'in_progress',
                priority: 'medium',
                turn_index: 1
            }
        ],
        outline: [
            {
                topic: 'Progress Updates',
                bullets: [
                    {
                        text: 'API refactoring done',
                        source_item_ids: ['fact-b2c3d4e5-001']
                    }
                ]
            }
        ]
    },
    notes_rendered_text: `📝 GodMode Notes
Key Points
- API refactoring completed by Alice

Action Items
- Bob - Work on frontend integration - B

Outline
Progress Updates
  - API refactoring done`,
    extraction_coverage: {
        entities_count: 2,
        relationships_count: 1,
        facts_count: 1,
        decisions_count: 0,
        risks_count: 0,
        actions_count: 1,
        questions_count: 0,
        turns_count: 2,
        notes_key_points_count: 1,
        notes_outline_topics_count: 1,
        overall_confidence: 0.91
    }
};

/**
 * Expected conversation extraction output structure v1.6
 */
const GOLDEN_CONVERSATION = {
    extraction_metadata: {
        source_ref: 'conv-c3d4e5f6',
        source_type: 'conversation',
        filename: 'slack-dev-channel.txt',
        extracted_at: null,
        extractor_version: '1.6',
        content_hash: 'c3d4e5f6'
    },
    conversation: {
        id: 'conv-c3d4e5f6',
        platform: 'slack',
        channel: 'dev-channel',
        topic: null,
        participants_count: 2,
        messages_count: 3
    },
    messages: [
        {
            id: 'msg-001',
            timestamp: '10:30',
            author_id: 'person-dave-devs',
            author_label: 'dave',
            text: 'Anyone know why the build is failing?',
            reply_to_id: null
        },
        {
            id: 'msg-002',
            timestamp: '10:32',
            author_id: 'person-eve-devs',
            author_label: 'eve',
            text: 'Check the CI logs, looks like a dependency issue',
            reply_to_id: 'msg-001'
        }
    ],
    entities: [
        {
            id: 'conv-c3d4e5f6',
            type: 'Conversation',
            name: 'dev-channel discussion',
            properties: { platform: 'slack' },
            confidence: 1.0,
            evidence: 'Slack conversation',
            evidence_start: 0,
            evidence_end: 20,
            source_ref: 'conv-c3d4e5f6'
        }
    ],
    relationships: [],
    facts: [
        {
            id: 'fact-c3d4e5f6-001',
            content: 'Build is failing due to dependency issue',
            category: 'technical',
            confidence: 0.80,
            uncertain: false,
            speaker_id: 'person-eve-devs',
            message_id: 'msg-002',
            related_entity_ids: [],
            evidence: 'looks like a dependency issue',
            evidence_start: -1,
            evidence_end: -1,
            source_ref: 'conv-c3d4e5f6'
        }
    ],
    decisions: [],
    risks: [],
    action_items: [],
    questions: [
        {
            id: 'question-c3d4e5f6-001',
            content: 'Why is the build failing?',
            status: 'resolved',
            asked_by_id: 'person-dave-devs',
            message_id: 'msg-001',
            confidence: 0.95,
            evidence: 'Anyone know why the build is failing?',
            evidence_start: -1,
            evidence_end: -1,
            source_ref: 'conv-c3d4e5f6'
        }
    ],
    summary: 'Dev channel discussion about build failure caused by dependency issue.',
    key_topics: ['build failure', 'CI', 'dependencies'],
    sentiment: 'neutral',
    extraction_coverage: {
        entities_count: 1,
        relationships_count: 0,
        facts_count: 1,
        decisions_count: 0,
        risks_count: 0,
        actions_count: 0,
        questions_count: 1,
        messages_count: 2,
        overall_confidence: 0.88
    }
};

/**
 * Expected email extraction output structure v1.6
 */
const GOLDEN_EMAIL = {
    extraction_metadata: {
        source_ref: 'email-d4e5f6g7',
        source_type: 'email',
        filename: 'email-thread.eml',
        extracted_at: null,
        extractor_version: '1.6',
        content_hash: 'd4e5f6g7'
    },
    email: {
        id: 'email-d4e5f6g7',
        subject: 'Re: Q1 Planning Meeting',
        from: 'sarah@company.com',
        to: ['team@company.com'],
        cc: [],
        date: '2024-01-20',
        thread_id: null,
        urgency: 'normal'
    },
    participants: [
        {
            id: 'person-sarah-company-com',
            name: 'Sarah',
            email: 'sarah@company.com',
            role: 'from'
        }
    ],
    entities: [
        {
            id: 'email-d4e5f6g7',
            type: 'Email',
            name: 'Q1 Planning Meeting thread',
            properties: { subject: 'Re: Q1 Planning Meeting' },
            confidence: 1.0,
            evidence: 'Email subject line',
            evidence_start: 0,
            evidence_end: 25,
            source_ref: 'email-d4e5f6g7'
        }
    ],
    relationships: [],
    facts: [
        {
            id: 'fact-d4e5f6g7-001',
            content: 'Q1 planning meeting scheduled for next week',
            category: 'business',
            confidence: 0.85,
            uncertain: false,
            from_quoted: false,
            speaker_id: 'person-sarah-company-com',
            related_entity_ids: [],
            evidence: 'meeting scheduled for next week',
            evidence_start: 50,
            evidence_end: 85,
            source_ref: 'email-d4e5f6g7'
        }
    ],
    decisions: [],
    risks: [],
    action_items: [
        {
            id: 'action-d4e5f6g7-001',
            content: 'Prepare Q1 roadmap slides',
            owner_id: null,
            deadline: null,
            status: 'pending',
            priority: 'medium',
            from_quoted: false,
            confidence: 0.75,
            uncertain: true,
            evidence: 'please prepare the Q1 roadmap slides',
            evidence_start: 120,
            evidence_end: 160,
            source_ref: 'email-d4e5f6g7'
        }
    ],
    questions: [],
    summary: 'Email about Q1 planning meeting with request to prepare roadmap slides.',
    key_topics: ['Q1 planning', 'roadmap'],
    attachments_mentioned: [],
    attachments_present: [],
    extraction_coverage: {
        entities_count: 1,
        relationships_count: 0,
        facts_count: 1,
        decisions_count: 0,
        risks_count: 0,
        actions_count: 1,
        questions_count: 0,
        overall_confidence: 0.80
    }
};

// ============================================
// TEST FUNCTIONS
// ============================================

function testDocumentGolden() {
    console.log('\n=== Test: Document Golden Output ===');
    
    // Check required fields
    const requiredFields = [
        'extraction_metadata',
        'entities',
        'relationships',
        'facts',
        'decisions',
        'risks',
        'action_items',
        'questions',
        'summary',
        'key_topics',
        'extraction_coverage'
    ];
    
    let passed = true;
    for (const field of requiredFields) {
        if (!(field in GOLDEN_DOCUMENT)) {
            console.log(`  FAIL: Missing required field: ${field}`);
            passed = false;
        }
    }
    
    // Check ID format
    const entity = GOLDEN_DOCUMENT.entities[0];
    if (!entity.id.startsWith('person-')) {
        console.log(`  FAIL: Entity ID should start with type prefix`);
        passed = false;
    }
    
    // Check relationship ID format
    const rel = GOLDEN_DOCUMENT.relationships[0];
    if (!rel.id.startsWith('rel-')) {
        console.log(`  FAIL: Relationship ID should start with 'rel-'`);
        passed = false;
    }
    
    // Check source_ref consistency
    if (entity.source_ref !== GOLDEN_DOCUMENT.extraction_metadata.source_ref) {
        console.log(`  FAIL: Entity source_ref should match extraction_metadata.source_ref`);
        passed = false;
    }
    
    if (passed) {
        console.log('  PASS: Document golden output is valid');
    }
    return passed;
}

function testTranscriptGolden() {
    console.log('\n=== Test: Transcript Golden Output ===');
    
    // Use existing validator
    const result = validateTranscriptOutput(GOLDEN_TRANSCRIPT);
    
    if (!result.valid) {
        console.log('  FAIL: Transcript validation failed:');
        result.errors.slice(0, 5).forEach(e => console.log(`    - ${e.path}: ${e.message}`));
        return false;
    }
    
    // Check notes reference integrity
    const keyPoint = GOLDEN_TRANSCRIPT.notes?.key_points?.[0];
    if (keyPoint) {
        const sourceIds = keyPoint.source_item_ids || [];
        const factIds = GOLDEN_TRANSCRIPT.facts.map(f => f.id);
        const validRefs = sourceIds.every(id => factIds.includes(id));
        if (!validRefs) {
            console.log('  FAIL: Key point references non-existent fact');
            return false;
        }
    }
    
    // Check action item render
    const actionRender = GOLDEN_TRANSCRIPT.notes?.action_items_rendered?.[0];
    if (actionRender) {
        const actionIds = GOLDEN_TRANSCRIPT.action_items.map(a => a.id);
        if (!actionIds.includes(actionRender.action_item_id)) {
            console.log('  FAIL: Action render references non-existent action');
            return false;
        }
    }
    
    console.log('  PASS: Transcript golden output is valid');
    return true;
}

function testConversationGolden() {
    console.log('\n=== Test: Conversation Golden Output ===');
    
    let passed = true;
    
    // Check message IDs are deterministic
    const msg = GOLDEN_CONVERSATION.messages[0];
    if (!msg.id.startsWith('msg-')) {
        console.log('  FAIL: Message ID should start with msg-');
        passed = false;
    }
    
    // Check question references message
    const question = GOLDEN_CONVERSATION.questions[0];
    const msgIds = GOLDEN_CONVERSATION.messages.map(m => m.id);
    if (question.message_id && !msgIds.includes(question.message_id)) {
        console.log('  FAIL: Question references non-existent message');
        passed = false;
    }
    
    // Check entity type Conversation exists
    const convEntity = GOLDEN_CONVERSATION.entities.find(e => e.type === 'Conversation');
    if (!convEntity) {
        console.log('  FAIL: Conversation entity missing');
        passed = false;
    }
    
    if (passed) {
        console.log('  PASS: Conversation golden output is valid');
    }
    return passed;
}

function testEmailGolden() {
    console.log('\n=== Test: Email Golden Output ===');
    
    let passed = true;
    
    // Check email header
    if (!GOLDEN_EMAIL.email) {
        console.log('  FAIL: Email header missing');
        passed = false;
    }
    
    // Check participant format
    const participant = GOLDEN_EMAIL.participants?.[0];
    if (!participant?.email) {
        console.log('  FAIL: Participant missing email');
        passed = false;
    }
    
    // Check from_quoted field
    const action = GOLDEN_EMAIL.action_items[0];
    if (action && typeof action.from_quoted !== 'boolean') {
        console.log('  FAIL: Action item missing from_quoted boolean');
        passed = false;
    }
    
    // Check entity type Email exists
    const emailEntity = GOLDEN_EMAIL.entities.find(e => e.type === 'Email');
    if (!emailEntity) {
        console.log('  FAIL: Email entity missing');
        passed = false;
    }
    
    if (passed) {
        console.log('  PASS: Email golden output is valid');
    }
    return passed;
}

// ============================================
// RUN TESTS
// ============================================

function runAllTests() {
    console.log('=================================================');
    console.log('           v1.6 Golden Tests');
    console.log('=================================================');
    
    const results = [
        testDocumentGolden(),
        testTranscriptGolden(),
        testConversationGolden(),
        testEmailGolden()
    ];
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log('\n=================================================');
    console.log(`Results: ${passed}/${total} tests passed`);
    console.log('=================================================');
    
    // Export golden templates for use in other tests
    module.exports = {
        GOLDEN_DOCUMENT,
        GOLDEN_TRANSCRIPT,
        GOLDEN_CONVERSATION,
        GOLDEN_EMAIL
    };
    
    process.exit(passed === total ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
    runAllTests();
}
