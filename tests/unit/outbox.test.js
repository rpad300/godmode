/**
 * Outbox Unit Tests
 * Tests for graph sync outbox pattern
 */

// Mock the supabase client (path must match what outbox requires: ./client from src/supabase)
const mockGetAdminClient = jest.fn();
jest.mock('../../src/supabase/client', () => ({
    getAdminClient: (...args) => mockGetAdminClient(...args)
}));

const outbox = require('../../src/supabase/outbox');
const { getAdminClient } = require('../../src/supabase/client');

/** Build chain for updateSyncStatusCount: from().upsert(), from().select().eq().eq().single(), from().update().eq().eq() */
function syncStatusChain() {
        const noErr = { data: null, error: null };
        return {
            upsert: jest.fn().mockResolvedValue(noErr),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { pending_count: 0 }, error: null }),
            update: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ error: null })
                })
            })
        };
    }

describe('Outbox Module', () => {
    let mockSupabase;
    let insertMock;

    beforeEach(() => {
        insertMock = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'event-1' }, error: null })
            })
        });

        mockSupabase = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                insert: insertMock,
                update: jest.fn().mockReturnThis(),
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                lt: jest.fn().mockReturnThis(),
                gt: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                ...syncStatusChain()
            }),
            rpc: jest.fn().mockResolvedValue({ data: null, error: null })
        };

        mockGetAdminClient.mockReturnValue(mockSupabase);
    });

    describe('Constants', () => {
        it('should define OPERATIONS', () => {
            expect(outbox.OPERATIONS).toBeDefined();
            expect(outbox.OPERATIONS.CREATE).toBe('CREATE');
            expect(outbox.OPERATIONS.UPDATE).toBe('UPDATE');
            expect(outbox.OPERATIONS.DELETE).toBe('DELETE');
            expect(outbox.OPERATIONS.LINK).toBe('LINK');
            expect(outbox.OPERATIONS.UNLINK).toBe('UNLINK');
        });

        it('should define EVENT_TYPES', () => {
            expect(outbox.EVENT_TYPES).toBeDefined();
            expect(outbox.EVENT_TYPES.ENTITY_CREATED).toBe('entity.created');
            expect(outbox.EVENT_TYPES.ENTITY_UPDATED).toBe('entity.updated');
            expect(outbox.EVENT_TYPES.RELATION_CREATED).toBe('relation.created');
            expect(outbox.EVENT_TYPES.FACT_CREATED).toBe('fact.created');
        });
    });

    describe('addToOutbox()', () => {
        it('should return error when Supabase not configured', async () => {
            mockGetAdminClient.mockReturnValue(null);
            
            const result = await outbox.addToOutbox({
                projectId: 'project-1',
                graphName: 'TestGraph',
                eventType: 'entity.created',
                operation: 'CREATE',
                entityType: 'Person',
                entityId: 'person-1',
                payload: { name: 'John' }
            });
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Supabase not configured');
        });

        it('should insert event into outbox', async () => {
            const result = await outbox.addToOutbox({
                projectId: 'project-1',
                graphName: 'TestGraph',
                eventType: 'entity.created',
                operation: 'CREATE',
                entityType: 'Person',
                entityId: 'person-1',
                payload: { name: 'John' }
            });

            expect(insertMock).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should include all required fields', async () => {
            await outbox.addToOutbox({
                projectId: 'project-1',
                graphName: 'TestGraph',
                eventType: 'entity.created',
                operation: 'CREATE',
                entityType: 'Person',
                entityId: 'person-1',
                payload: { name: 'John' },
                createdBy: 'user-1'
            });

            const insertedData = insertMock.mock.calls[0][0];
            expect(insertedData.project_id).toBe('project-1');
            expect(insertedData.graph_name).toBe('TestGraph');
            expect(insertedData.event_type).toBe('entity.created');
            expect(insertedData.operation).toBe('CREATE');
            expect(insertedData.entity_type).toBe('Person');
            expect(insertedData.entity_id).toBe('person-1');
            expect(insertedData.payload).toEqual({ name: 'John' });
            expect(insertedData.created_by).toBe('user-1');
        });
    });

    describe('addBatchToOutbox()', () => {
        it('should insert multiple events', async () => {
            const insertMock = jest.fn().mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    data: [{ id: 'e1' }, { id: 'e2' }],
                    error: null
                })
            });

            mockSupabase.from.mockReturnValue({
                insert: insertMock
            });

            const events = [
                {
                    projectId: 'project-1',
                    graphName: 'TestGraph',
                    eventType: 'entity.created',
                    operation: 'CREATE',
                    entityType: 'Person',
                    entityId: 'person-1',
                    payload: { name: 'John' }
                },
                {
                    projectId: 'project-1',
                    graphName: 'TestGraph',
                    eventType: 'entity.created',
                    operation: 'CREATE',
                    entityType: 'Person',
                    entityId: 'person-2',
                    payload: { name: 'Jane' }
                }
            ];

            const result = await outbox.addBatchToOutbox(events);

            expect(insertMock).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.count).toBe(2);
        });

        it('should return empty result for empty batch', async () => {
            const result = await outbox.addBatchToOutbox([]);
            expect(result.success).toBe(true);
            expect(result.count).toBe(0);
        });
    });

    describe('claimBatch()', () => {
        it('should call RPC to claim batch', async () => {
            mockSupabase.rpc.mockResolvedValue({
                data: [{ id: 'e1' }, { id: 'e2' }],
                error: null
            });

            const result = await outbox.claimBatch(50);

            expect(mockSupabase.rpc).toHaveBeenCalledWith('claim_outbox_batch', {
                p_batch_size: 50
            });
            expect(result.success).toBe(true);
        });
    });

    describe('markCompleted()', () => {
        it('should call RPC to complete event', async () => {
            mockSupabase.rpc.mockResolvedValue({ error: null });

            const result = await outbox.markCompleted('event-1');

            expect(mockSupabase.rpc).toHaveBeenCalledWith('complete_outbox_event', {
                p_id: 'event-1'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('markFailed()', () => {
        it('should call RPC to fail event with error message', async () => {
            mockSupabase.rpc.mockResolvedValue({ error: null });

            const result = await outbox.markFailed('event-1', 'Connection timeout');

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fail_outbox_event', {
                p_id: 'event-1',
                p_error: 'Connection timeout'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('getPendingCount()', () => {
        it('should count pending events for project', async () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ count: 42, error: null })
            });

            const result = await outbox.getPendingCount('project-1');

            expect(result.success).toBe(true);
            expect(result.count).toBe(42);
        });
    });

    describe('getSyncStatus()', () => {
        it('should retrieve sync status for project', async () => {
            const statusData = {
                project_id: 'project-1',
                health_status: 'healthy',
                pending_count: 0
            };
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: statusData,
                    error: null
                })
            });

            const result = await outbox.getSyncStatus('project-1');

            expect(result.success).toBe(true);
            expect(result.status).toEqual(statusData);
        });
    });

    describe('getDeadLetters()', () => {
        it('should retrieve dead letter events', async () => {
            const deadLettersData = [
                { id: 'dl1', original_event_id: 'e1', error_message: 'Failed' },
                { id: 'dl2', original_event_id: 'e2', error_message: 'Timeout' }
            ];
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                        data: deadLettersData,
                        error: null
                    })
                })
            });

            const result = await outbox.getDeadLetters('project-1');

            expect(result.success).toBe(true);
            expect(result.deadLetters).toHaveLength(2);
        });
    });

    describe('getStats()', () => {
        it('should aggregate outbox statistics', async () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: [
                        { status: 'pending' },
                        { status: 'pending' },
                        { status: 'completed' },
                        { status: 'failed' }
                    ],
                    error: null
                })
            });

            const result = await outbox.getStats('project-1');

            expect(result.success).toBe(true);
            expect(result.stats).toBeDefined();
            expect(result.stats.pending).toBe(2);
            expect(result.stats.completed).toBe(1);
            expect(result.stats.failed).toBe(1);
        });
    });
});
