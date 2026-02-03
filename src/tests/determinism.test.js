/**
 * Determinism Tests for v1.6 Extraction System
 * 
 * Verifies that:
 * 1. Same content always produces same content hash
 * 2. Same message content produces same message ID
 * 3. Entity IDs follow deterministic rules
 * 4. Source refs are stable across runs
 * 
 * Run: node src/tests/determinism.test.js
 */

// ============================================
// CONTENT HASH TESTS
// ============================================

/**
 * Simple content hash implementation (must match processor.js)
 */
function generateContentHash(content) {
    if (!content) return '00000000';
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 8).padStart(8, '0');
}

/**
 * Message ID generator (must match conversations/parser.js)
 */
function generateMessageId(speaker, text, timestamp) {
    const content = `${speaker || 'unknown'}:${text || ''}:${timestamp || ''}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const hashStr = Math.abs(hash).toString(36).substring(0, 8).padStart(8, '0');
    return `msg-${hashStr}`;
}

/**
 * Entity ID generator following v1.6 rules
 */
function generateEntityId(type, name, email = null, organization = null, role = null, span = null) {
    // Lowercase type prefix
    const prefix = type.toLowerCase();
    
    // Slugify name
    const nameSlug = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    
    // Priority order: email > name+org > name+role > name+span
    if (email) {
        const emailSlug = email.replace('@', '-').replace(/\./g, '-');
        return `${prefix}-${emailSlug}`;
    }
    
    if (organization) {
        const orgSlug = organization.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        return `${prefix}-${nameSlug}-${orgSlug}`;
    }
    
    if (role) {
        const roleSlug = role.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        return `${prefix}-${nameSlug}-${roleSlug}`;
    }
    
    if (span && span.start >= 0 && span.end > span.start) {
        return `${prefix}-${nameSlug}-s${String(span.start).padStart(3, '0')}e${String(span.end).padStart(3, '0')}`;
    }
    
    // Fallback: just name (may have collisions)
    return `${prefix}-${nameSlug}`;
}

// ============================================
// TEST FUNCTIONS
// ============================================

function testContentHashDeterminism() {
    console.log('\n=== Test: Content Hash Determinism ===');
    
    const testCases = [
        'Hello, world!',
        'This is a meeting transcript about Q1 planning.',
        '{"json": "content", "with": "special chars"}',
        'Unicode: café, naïve, 日本語',
        'Long text '.repeat(1000)
    ];
    
    let passed = true;
    
    for (const content of testCases) {
        const hash1 = generateContentHash(content);
        const hash2 = generateContentHash(content);
        const hash3 = generateContentHash(content);
        
        if (hash1 !== hash2 || hash2 !== hash3) {
            console.log(`  FAIL: Hash not deterministic for content length ${content.length}`);
            console.log(`    hash1=${hash1}, hash2=${hash2}, hash3=${hash3}`);
            passed = false;
        }
        
        // Check hash format (8 chars, alphanumeric)
        if (!/^[a-z0-9]{8}$/.test(hash1)) {
            console.log(`  FAIL: Invalid hash format: ${hash1}`);
            passed = false;
        }
    }
    
    // Test different content produces different hashes
    const hashA = generateContentHash('Content A');
    const hashB = generateContentHash('Content B');
    if (hashA === hashB) {
        console.log('  FAIL: Different content produced same hash');
        passed = false;
    }
    
    if (passed) {
        console.log('  PASS: Content hash is deterministic');
    }
    return passed;
}

function testMessageIdDeterminism() {
    console.log('\n=== Test: Message ID Determinism ===');
    
    const testCases = [
        { speaker: 'Alice', text: 'Hello everyone', timestamp: '09:00' },
        { speaker: 'Bob', text: 'Hi there!', timestamp: '09:01' },
        { speaker: 'Charlie', text: 'Good morning', timestamp: null },
        { speaker: null, text: 'Unknown speaker', timestamp: '10:00' }
    ];
    
    let passed = true;
    
    for (const tc of testCases) {
        const id1 = generateMessageId(tc.speaker, tc.text, tc.timestamp);
        const id2 = generateMessageId(tc.speaker, tc.text, tc.timestamp);
        const id3 = generateMessageId(tc.speaker, tc.text, tc.timestamp);
        
        if (id1 !== id2 || id2 !== id3) {
            console.log(`  FAIL: Message ID not deterministic for ${tc.speaker}`);
            passed = false;
        }
        
        // Check format: msg-{8chars}
        if (!/^msg-[a-z0-9]{8}$/.test(id1)) {
            console.log(`  FAIL: Invalid message ID format: ${id1}`);
            passed = false;
        }
    }
    
    // Different messages = different IDs
    const id1 = generateMessageId('Alice', 'Message 1', '09:00');
    const id2 = generateMessageId('Alice', 'Message 2', '09:00');
    if (id1 === id2) {
        console.log('  FAIL: Different messages produced same ID');
        passed = false;
    }
    
    if (passed) {
        console.log('  PASS: Message ID is deterministic');
    }
    return passed;
}

function testEntityIdDeterminism() {
    console.log('\n=== Test: Entity ID Determinism ===');
    
    let passed = true;
    
    // Test email-based ID (highest priority)
    const emailId = generateEntityId('Person', 'John Doe', 'john.doe@acme.com');
    if (emailId !== 'person-john-doe-acme-com') {
        console.log(`  FAIL: Email-based ID incorrect: ${emailId}`);
        passed = false;
    }
    
    // Test name+org ID
    const nameOrgId = generateEntityId('Person', 'Jane Smith', null, 'Tech Corp');
    if (nameOrgId !== 'person-jane-smith-tech-corp') {
        console.log(`  FAIL: Name+org ID incorrect: ${nameOrgId}`);
        passed = false;
    }
    
    // Test name+role ID
    const nameRoleId = generateEntityId('Person', 'Mike Johnson', null, null, 'CTO');
    if (nameRoleId !== 'person-mike-johnson-cto') {
        console.log(`  FAIL: Name+role ID incorrect: ${nameRoleId}`);
        passed = false;
    }
    
    // Test span-based ID
    const spanId = generateEntityId('Person', 'Unknown Person', null, null, null, { start: 45, end: 60 });
    if (spanId !== 'person-unknown-person-s045e060') {
        console.log(`  FAIL: Span-based ID incorrect: ${spanId}`);
        passed = false;
    }
    
    // Test determinism
    for (let i = 0; i < 5; i++) {
        const id = generateEntityId('Person', 'Test User', 'test@example.com');
        if (id !== 'person-test-example-com') {
            console.log(`  FAIL: Entity ID not deterministic on run ${i}`);
            passed = false;
        }
    }
    
    // Test priority (email takes precedence)
    const priorityId = generateEntityId('Person', 'John', 'john@test.com', 'ACME', 'Manager');
    if (priorityId !== 'person-john-test-com') {
        console.log(`  FAIL: Email should take priority: ${priorityId}`);
        passed = false;
    }
    
    if (passed) {
        console.log('  PASS: Entity ID is deterministic and follows priority rules');
    }
    return passed;
}

function testSourceRefStability() {
    console.log('\n=== Test: Source Ref Stability ===');
    
    let passed = true;
    
    // Same content = same source_ref
    const content = 'This is a test document with some content.';
    const hash1 = generateContentHash(content);
    const hash2 = generateContentHash(content);
    
    const sourceRef1 = `doc-${hash1}`;
    const sourceRef2 = `doc-${hash2}`;
    
    if (sourceRef1 !== sourceRef2) {
        console.log(`  FAIL: Source refs not stable: ${sourceRef1} vs ${sourceRef2}`);
        passed = false;
    }
    
    // Different content types use same hash algorithm
    const meetingContent = 'Meeting about project planning';
    const meetingHash = generateContentHash(meetingContent);
    const meetingRef = `meeting-${meetingHash}`;
    
    // Re-compute should be identical
    const meetingRef2 = `meeting-${generateContentHash(meetingContent)}`;
    if (meetingRef !== meetingRef2) {
        console.log(`  FAIL: Meeting refs not stable`);
        passed = false;
    }
    
    if (passed) {
        console.log('  PASS: Source refs are stable across runs');
    }
    return passed;
}

function testIdCollisionAvoidance() {
    console.log('\n=== Test: ID Collision Avoidance ===');
    
    let passed = true;
    const ids = new Set();
    
    // Generate many IDs and check for collisions
    const testPeople = [
        { name: 'John Doe', email: 'john@acme.com' },
        { name: 'John Doe', email: 'john@other.com' }, // Same name, different email
        { name: 'John Doe', org: 'ACME' },
        { name: 'John Doe', org: 'Other Corp' },
        { name: 'Jane Doe', email: 'jane@acme.com' },
        { name: 'John Smith', org: 'ACME' }
    ];
    
    for (const person of testPeople) {
        const id = generateEntityId('Person', person.name, person.email, person.org);
        if (ids.has(id)) {
            console.log(`  FAIL: Collision detected for ID: ${id}`);
            passed = false;
        }
        ids.add(id);
    }
    
    // Verify we generated expected number of unique IDs
    if (ids.size !== testPeople.length) {
        console.log(`  FAIL: Expected ${testPeople.length} unique IDs, got ${ids.size}`);
        passed = false;
    }
    
    if (passed) {
        console.log('  PASS: No ID collisions with distinct inputs');
    }
    return passed;
}

// ============================================
// RUN TESTS
// ============================================

function runAllTests() {
    console.log('=================================================');
    console.log('           v1.6 Determinism Tests');
    console.log('=================================================');
    
    const results = [
        testContentHashDeterminism(),
        testMessageIdDeterminism(),
        testEntityIdDeterminism(),
        testSourceRefStability(),
        testIdCollisionAvoidance()
    ];
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log('\n=================================================');
    console.log(`Results: ${passed}/${total} tests passed`);
    console.log('=================================================');
    
    // Export functions for use in other tests
    module.exports = {
        generateContentHash,
        generateMessageId,
        generateEntityId
    };
    
    process.exit(passed === total ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
    runAllTests();
}
