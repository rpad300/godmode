/**
 * Invites Unit Tests
 * Tests for invitation system
 */

const crypto = require('crypto');

// Mock the supabase client before requiring the module
jest.mock('../../src/supabase/client', () => ({
    getAdminClient: jest.fn()
}));

const { getAdminClient } = require('../../src/supabase/client');

// Create a mock supabase client
const createMockSupabase = (overrides = {}) => ({
    from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        ...overrides
    })
});

describe('Invites Module', () => {
    let invites;
    let mockSupabase;

    beforeEach(() => {
        jest.resetModules();
        mockSupabase = createMockSupabase();
        getAdminClient.mockReturnValue(mockSupabase);
        invites = require('../../src/supabase/invites');
    });

    describe('generateToken()', () => {
        it('should generate a 64-character hex token', () => {
            const token = invites.generateToken();
            expect(typeof token).toBe('string');
            expect(token.length).toBe(64);
            expect(/^[a-f0-9]+$/.test(token)).toBe(true);
        });

        it('should generate unique tokens', () => {
            const token1 = invites.generateToken();
            const token2 = invites.generateToken();
            expect(token1).not.toBe(token2);
        });
    });

    describe('hashToken()', () => {
        it('should return SHA-256 hash of token', () => {
            const token = 'test-token';
            const hash = invites.hashToken(token);
            
            const expectedHash = crypto
                .createHash('sha256')
                .update(token)
                .digest('hex');
            
            expect(hash).toBe(expectedHash);
        });

        it('should produce consistent hashes', () => {
            const token = 'consistent-token';
            const hash1 = invites.hashToken(token);
            const hash2 = invites.hashToken(token);
            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different tokens', () => {
            const hash1 = invites.hashToken('token1');
            const hash2 = invites.hashToken('token2');
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('createInvite()', () => {
        it('should return error when Supabase not configured', async () => {
            getAdminClient.mockReturnValue(null);
            
            const result = await invites.createInvite({
                projectId: 'test-project',
                createdBy: 'test-user',
                role: 'write'
            });
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Supabase not configured');
        });

        it('should create invite with correct expiration', async () => {
            const insertMock = jest.fn().mockReturnThis();
            const selectMock = jest.fn().mockReturnThis();
            const singleMock = jest.fn().mockResolvedValue({
                data: { id: 'invite-id' },
                error: null
            });

            mockSupabase.from.mockReturnValue({
                insert: insertMock,
                select: selectMock,
                single: singleMock
            });

            const result = await invites.createInvite({
                projectId: 'test-project',
                createdBy: 'test-user',
                role: 'write',
                expiresInHours: 24
            });

            expect(insertMock).toHaveBeenCalled();
            const insertArg = insertMock.mock.calls[0][0];
            
            // Check expiration is approximately 24 hours from now
            const expiresAt = new Date(insertArg.expires_at);
            const now = new Date();
            const diffHours = (expiresAt - now) / (1000 * 60 * 60);
            expect(diffHours).toBeCloseTo(24, 0);
        });

        it('should return token on successful creation', async () => {
            mockSupabase.from.mockReturnValue({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'invite-id' },
                    error: null
                })
            });

            const result = await invites.createInvite({
                projectId: 'test-project',
                createdBy: 'test-user',
                role: 'write'
            });

            expect(result.success).toBe(true);
            expect(result.token).toBeDefined();
            expect(result.token.length).toBe(64);
        });
    });

    describe('acceptInvite()', () => {
        it('should return error when Supabase not configured', async () => {
            getAdminClient.mockReturnValue(null);
            
            const result = await invites.acceptInvite('token', 'user-id', 'user@email.com');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Supabase not configured');
        });

        it('should return error for invalid token', async () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gt: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: null,
                    error: null
                })
            });

            const result = await invites.acceptInvite('invalid-token', 'user-id', 'user@email.com');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid');
        });
    });

    describe('revokeInvite()', () => {
        it('should return error when Supabase not configured', async () => {
            getAdminClient.mockReturnValue(null);
            
            const result = await invites.revokeInvite('invite-id');
            
            expect(result.success).toBe(false);
        });

        it('should delete invite by ID', async () => {
            const deleteMock = jest.fn().mockReturnThis();
            const eqMock = jest.fn().mockResolvedValue({ error: null });

            mockSupabase.from.mockReturnValue({
                delete: deleteMock,
                eq: eqMock
            });

            await invites.revokeInvite('invite-id');

            expect(deleteMock).toHaveBeenCalled();
            expect(eqMock).toHaveBeenCalledWith('id', 'invite-id');
        });
    });

    describe('listInvites()', () => {
        it('should return error when Supabase not configured', async () => {
            getAdminClient.mockReturnValue(null);
            
            const result = await invites.listInvites('project-id');
            
            expect(result.success).toBe(false);
        });

        it('should query invites for project', async () => {
            const selectMock = jest.fn().mockReturnThis();
            const eqMock = jest.fn().mockReturnThis();
            const orderMock = jest.fn().mockResolvedValue({
                data: [{ id: '1' }, { id: '2' }],
                error: null
            });

            mockSupabase.from.mockReturnValue({
                select: selectMock,
                eq: eqMock,
                order: orderMock
            });

            const result = await invites.listInvites('project-id');

            expect(result.success).toBe(true);
            expect(result.invites).toHaveLength(2);
        });
    });
});
