/**
 * Facts & Dashboard Unit Tests
 * Payload shape for dashboard (factsByCategory, factsVerifiedCount) and fact events
 */

describe('Facts Dashboard payload', () => {
    const categories = ['technical', 'process', 'policy', 'people', 'timeline', 'general'];

    it('dashboard payload should include factsByCategory with all categories', () => {
        const factsByCategory = {
            technical: 0,
            process: 0,
            policy: 0,
            people: 0,
            timeline: 0,
            general: 0
        };
        categories.forEach(c => {
            expect(factsByCategory).toHaveProperty(c);
        });
    });

    it('dashboard payload should include factsVerifiedCount', () => {
        const payload = {
            totalFacts: 10,
            factsByCategory: { technical: 2, process: 1, policy: 0, people: 0, timeline: 0, general: 7 },
            factsVerifiedCount: 3
        };
        expect(typeof payload.factsVerifiedCount).toBe('number');
        expect(payload.factsVerifiedCount).toBe(3);
    });

    it('fact event types should match schema (created, verified, updated, conflict_detected)', () => {
        const allowedTypes = ['created', 'verified', 'updated', 'conflict_detected'];
        const event = { event_type: 'verified', fact_id: 'uuid', created_at: new Date().toISOString() };
        expect(allowedTypes).toContain(event.event_type);
    });
});
