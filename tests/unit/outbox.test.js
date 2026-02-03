/**
 * Outbox Unit Tests
 * Tests for graph sync outbox pattern
 */

// Mock the supabase client
jest.mock('../../src/supabase/client', () => ({
    getAdminClient: jest.fn()
}));

const { getAdminClient } = require('../../src/supabase/client');

describe('Outbox Module', () => {
    let outbox;
    let mockSupabase;

    beforeEach(() => {
        jest.resetModules();
        
        mockSupabase = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                insert: jest.fn().mockReturnThis(),
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
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
            }),
            rpc: jest.fn().mockResolvedValue({ data: null, error: null })
        };

        getAdminClient.mockReturnValue(mockSupabase);
        outbox = require('../../src/supabase/outbox');
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
            expect(outbox.EVENT_TYPES.ENTITY).toBe('entity');
            expect(outbox.EVENT_TYPES.RELATION).toBe('relation');
            expect(outbox.EVENT_TYPES.PROPERTY).toBe('property');
        });
    });

    describe('addToOutbox()', () => {
        it('should return error when Supabase not configured', async () => {
            getAdminClient.mockReturnValue(null);
            
            const result = await outbox.addToOutbox({
                projectId: 'project-1',
                graphName: 'TestGraph',
                eventType: 'entity',
                operation: 'CREATE',
                entityType: 'Person',
                entityId: 'person-1',
                payload: { name: 'John' }
            });
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Supabase not configured');
        });

        it('should insert event into outbox', async () => {
            const insertMock = jest.fn().mockReturnThis();
            const selectMock = jest.fn().mockReturnThis();
            const singleMock = jest.fn().mockResolvedValue({
                data: { id: 'event-1' },
                error: null
            });

            mockSupabase.from.mockReturnValue({
                insert: insertMock,
                select: selectMock,
                single: singleMock
            });

            const result = await outbox.addToOutbox({
                projectId: 'project-1',
                graphName: 'TestGraph',
                eventType: 'entity',
                operation: 'CREATE',
                entityType: 'Person',
                entityId: 'person-1',
                payload: { name: 'John' }
            });

            expect(insertMock).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should include all required fields', async () => {
            const insertMock = jest.fn().mockReturnThis();
            
            mockSupabase.from.mockReturnValue({
                insert: insertMock,
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: { id: 'e1' }, error: null })
            });

            await outbox.addToOutbox({
                projectId: 'project-1',
                graphName: 'TestGraph',
                eventType: 'entity',
                operation: 'CREATE',
                entityType: 'Person',
                entityId: 'person-1',
                payload: { name: 'John' },
                createdBy: 'user-1'
            });

            const insertedData = insertMock.mock.calls[0][0];
            expect(insertedData.project_id).toBe('project-1');
            expect(insertedData.graph_name).toBe('TestGraph');
            expect(insertedData.event_type).toBe('entity');
            expect(insertedData.operation).toBe('CREATE');
            expect(insertedData.entity_type).toBe('Person');
            expect(insertedData.entity_id).toBe('person-1');
            expect(insertedData.payload).toEqual({ name: 'John' });
            expect(insertedData.created_by).toBe('user-1');
        });
    });

    describe('addBatchToOutbox()', () => {
        it('should insert multiple events', async () => {
            const insertMock = jest.fn().mockReturnThis();
            const selectMock = jest.fn().mockResolvedValue({
                data: [{ id: 'e1' }, { id: 'e2' }],
                error: null
            });

            mockSupabase.from.mockReturnValue({
                insert: insertMock,
                select: selectMock
            });

            const events = [
                {
                    projectId: 'project-1',
                    graphName: 'TestGraph',
                    eventType: 'entity',
                    operation: 'CREATE',
                    entityType: 'Person',
                    entityId: 'person-1',
                    payload: { name: 'John' }
                },
                {
                    projectId: 'project-1',
                    graphName: 'TestGraph',
                    eventType: 'entity',
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
                batch_size: 50
            });
            expect(result.success).toBe(true);
        });
    });

    describe('markCompleted()', () => {
        it('should update event status to completed', async () => {
            const updateMock = jest.fn().mockReturnThis();
            const eqMock = jest.fn().mockResolvedValue({ error: null });

            mockSupabase.from.mockReturnValue({
                update: updateMock,
                eq: eqMock
            });

            const result = await outbox.markCompleted('event-1');

            expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
                status: 'completed'
            }));
            expect(result.success).toBe(true);
        });
    });

    describe('markFailed()', () => {
        it('should update event status with error', async () => {
            const updateMock = jest.fn().mockReturnThis();
            const eqMock = jest.fn().mockResolvedValue({ error: null });

            mockSupabase.from.mockReturnValue({
                update: updateMock,
                eq: eqMock
            });

            const result = await outbox.markFailed('event-1', 'Connection timeout');

            expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
                status: 'failed',
                last_error: 'Connection timeout'
            }));
            expect(result.success).toBe(true);
        });

        it('should increment attempt count', async () => {
            const updateMock = jest.fn().mockReturnThis();
            
            mockSupabase.from.mockReturnValue({
                update: updateMock,
                eq: jest.fn().mockResolvedValue({ error: null })
            });

            await outbox.markFailed('event-1', 'Error', 3);

            const updateArg = updateMock.mock.calls[0][0];
            expect(updateArg.attempts).toBe(3);
        });
    });

    describe('getPendingCount()', () => {
        it('should count pending events for project', async () => {
            const selectMock = jest.fn().mockReturnThis();
            const eqMock = jest.fn().mockReturnThis();
            const statusEqMock = jest.fn().mockResolvedValue({
                count: 42,
                error: null
            });

            mockSupabase.from.mockReturnValue({
                select: selectMock,
                eq: jest.fn().mockImplementation((field, value) => {
                    if (field === 'project_id') return { eq: statusEqMock };
                    return { count: 42 };
                })
            });

            const result = await outbox.getPendingCount('project-1');

            expect(result.success).toBe(true);
        });
    });

    describe('getSyncStatus()', () => {
        it('should retrieve sync status for project', async () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        project_id: 'project-1',
                        health_status: 'healthy',
                        pending_count: 0
                    },
                    error: null
                })
            });

            const result = await outbox.getSyncStatus('project-1');

            expect(result.success).toBe(true);
            expect(result.status.health_status).toBe('healthy');
        });
    });

    describe('getDeadLetters()', () => {
        it('should retrieve dead letter events', async () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({
                    data: [
                        { id: 'dl1', original_event_id: 'e1', error_message: 'Failed' },
                        { id: 'dl2', original_event_id: 'e2', error_message: 'Timeout' }
                    ],
                    error: null
                })
            });

            const result = await outbox.getDeadLetters('project-1');

            expect(result.success).toBe(true);
            expect(result.deadLetters).toHaveLength(2);
        });
    });

    describe('getStats()', () => {
        it('should aggregate outbox statistics', async () => {
            // Mock different status counts
            mockSupabase.from.mockImplementation((table) => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockResolvedValue({
                    data: [
                        { status: 'pending', count: 10 },
                        { status: 'processing', count: 2 },
                        { status: 'completed', count: 100 },
                        { status: 'failed', count: 3 }
                    ],
                    error: null
                })
            }));

            const result = await outbox.getStats('project-1');

            expect(result.success).toBe(true);
        });
    });
});
