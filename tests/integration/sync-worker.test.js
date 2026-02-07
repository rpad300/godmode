/**
 * Sync Worker Integration Tests
 * Tests for FalkorDB synchronization
 */

// Mock dependencies
jest.mock('../../src/supabase/outbox', () => ({
    OPERATIONS: {
        CREATE: 'CREATE',
        UPDATE: 'UPDATE',
        DELETE: 'DELETE',
        LINK: 'LINK',
        UNLINK: 'UNLINK'
    },
    EVENT_TYPES: {
        ENTITY: 'entity',
        RELATION: 'relation',
        PROPERTY: 'property'
    },
    claimBatch: jest.fn(),
    markCompleted: jest.fn(),
    markFailed: jest.fn(),
    getSyncStatus: jest.fn(),
    upsertSyncStatus: jest.fn()
}));

const outbox = require('../../src/supabase/outbox');

describe('Sync Worker', () => {
    let syncWorker;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        global.__OUTBOX_MOCK__ = outbox;
        syncWorker = require('../../src/sync-worker');
    });

    afterEach(() => {
        if (syncWorker.isRunning && syncWorker.isRunning()) {
            syncWorker.stop();
        }
    });

    describe('Module Structure', () => {
        it('should export required functions', () => {
            expect(syncWorker.start).toBeDefined();
            expect(syncWorker.stop).toBeDefined();
            expect(syncWorker.getStatus).toBeDefined();
        });
    });

    describe('start()', () => {
        it('should start the worker', () => {
            const mockGraph = {
                query: jest.fn().mockResolvedValue({ results: [] })
            };

            syncWorker.start(mockGraph);
            
            expect(syncWorker.getStatus().running).toBe(true);
            
            syncWorker.stop();
        });

        it('should not start if already running', () => {
            const mockGraph = {
                query: jest.fn().mockResolvedValue({ results: [] })
            };

            syncWorker.start(mockGraph);
            const firstStatus = syncWorker.getStatus();
            
            syncWorker.start(mockGraph); // Try to start again
            const secondStatus = syncWorker.getStatus();
            
            expect(firstStatus.running).toBe(secondStatus.running);
            
            syncWorker.stop();
        });
    });

    describe('stop()', () => {
        it('should stop the worker', () => {
            const mockGraph = {
                query: jest.fn().mockResolvedValue({ results: [] })
            };

            syncWorker.start(mockGraph);
            expect(syncWorker.getStatus().running).toBe(true);
            
            syncWorker.stop();
            expect(syncWorker.getStatus().running).toBe(false);
        });
    });

    describe('getStatus()', () => {
        it('should return worker status', () => {
            const status = syncWorker.getStatus();
            
            expect(status).toHaveProperty('running');
            expect(status).toHaveProperty('processedCount');
            expect(status).toHaveProperty('errorCount');
        });
    });

    describe('processBatch()', () => {
        it('should process claimed events', async () => {
            const mockGraph = {
                query: jest.fn().mockResolvedValue({ results: [] })
            };

            const mockEvents = [
                {
                    id: 'event-1',
                    event_type: 'entity',
                    operation: 'CREATE',
                    entity_type: 'Person',
                    entity_id: 'person-1',
                    payload: { name: 'John Doe' }
                }
            ];

            outbox.claimBatch.mockResolvedValue({
                success: true,
                events: mockEvents
            });

            outbox.markCompleted.mockResolvedValue({ success: true });

            syncWorker.start(mockGraph);
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 100));
            
            syncWorker.stop();

            // Should have attempted to claim batch
            expect(outbox.claimBatch).toHaveBeenCalled();
        });
    });

    describe('Cypher Query Building', () => {
        it('should build CREATE query for entity', () => {
            const event = {
                event_type: 'entity',
                operation: 'CREATE',
                entity_type: 'Person',
                entity_id: 'person-1',
                payload: { name: 'John', age: 30 }
            };

            const query = syncWorker.buildCypherQuery(event);
            
            expect(query).toContain('CREATE');
            expect(query).toContain('Person');
        });

        it('should build UPDATE query for entity', () => {
            const event = {
                event_type: 'entity',
                operation: 'UPDATE',
                entity_type: 'Person',
                entity_id: 'person-1',
                payload: { name: 'John Updated' }
            };

            const query = syncWorker.buildCypherQuery(event);
            
            expect(query).toContain('MATCH');
            expect(query).toContain('SET');
        });

        it('should build DELETE query for entity', () => {
            const event = {
                event_type: 'entity',
                operation: 'DELETE',
                entity_type: 'Person',
                entity_id: 'person-1',
                payload: {}
            };

            const query = syncWorker.buildCypherQuery(event);
            
            expect(query).toContain('MATCH');
            expect(query).toContain('DELETE');
        });

        it('should build LINK query for relation', () => {
            const event = {
                event_type: 'relation',
                operation: 'LINK',
                entity_type: 'KNOWS',
                entity_id: 'rel-1',
                payload: {
                    from_id: 'person-1',
                    from_type: 'Person',
                    to_id: 'person-2',
                    to_type: 'Person'
                }
            };

            const query = syncWorker.buildCypherQuery(event);
            
            expect(query).toContain('MATCH');
            expect(query).toContain('CREATE');
            expect(query).toContain('KNOWS');
        });

        it('should build UNLINK query for relation', () => {
            const event = {
                event_type: 'relation',
                operation: 'UNLINK',
                entity_type: 'KNOWS',
                entity_id: 'rel-1',
                payload: {
                    from_id: 'person-1',
                    to_id: 'person-2'
                }
            };

            const query = syncWorker.buildCypherQuery(event);
            
            expect(query).toContain('MATCH');
            expect(query).toContain('DELETE');
        });
    });

    describe('Error Handling', () => {
        it('should handle graph query errors', async () => {
            const mockGraph = {
                query: jest.fn().mockRejectedValue(new Error('Connection failed'))
            };

            const mockEvents = [
                {
                    id: 'event-1',
                    event_type: 'entity',
                    operation: 'CREATE',
                    entity_type: 'Person',
                    entity_id: 'person-1',
                    payload: { name: 'John' },
                    attempts: 1
                }
            ];

            outbox.claimBatch.mockResolvedValue({
                success: true,
                events: mockEvents
            });

            outbox.markFailed.mockResolvedValue({ success: true });

            syncWorker.start(mockGraph);
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            syncWorker.stop();

            // Should mark event as failed
            expect(outbox.markFailed).toHaveBeenCalled();
        });

        it('should handle empty batch gracefully', async () => {
            const mockGraph = {
                query: jest.fn().mockResolvedValue({ results: [] })
            };

            outbox.claimBatch.mockResolvedValue({
                success: true,
                events: []
            });

            syncWorker.start(mockGraph);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            syncWorker.stop();

            // Should not throw
            expect(syncWorker.getStatus().errorCount).toBe(0);
        });
    });

    describe('Configuration', () => {
        it('should allow configuring poll interval', () => {
            syncWorker.configure({
                pollIntervalMs: 5000,
                batchSize: 50
            });

            const status = syncWorker.getStatus();
            expect(status.config).toBeDefined();
        });
    });
});
