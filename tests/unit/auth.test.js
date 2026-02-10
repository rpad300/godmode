/**
 * Auth Unit Tests
 * Tests for authentication module
 */

jest.mock('../../src/supabase/client', () => ({
    getClient: jest.fn(),
    getAdminClient: jest.fn()
}));

describe('Auth Module', () => {
    let auth;
    let mockSupabase;
    let mockAdminSupabase;

    beforeEach(() => {
        // Create mock clients
        mockSupabase = {
            auth: {
                signUp: jest.fn(),
                signInWithPassword: jest.fn(),
                signOut: jest.fn(),
                getUser: jest.fn(),
                resetPasswordForEmail: jest.fn(),
                updateUser: jest.fn()
            },
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                insert: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                upsert: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
            })
        };
        
        mockAdminSupabase = {
            ...mockSupabase,
            auth: {
                admin: {
                    createUser: jest.fn(),
                    deleteUser: jest.fn(),
                    updateUserById: jest.fn()
                }
            }
        };

        jest.resetModules();
        const client = require('../../src/supabase/client');
        client.getClient.mockReturnValue(mockSupabase);
        client.getAdminClient.mockReturnValue(mockAdminSupabase);
        auth = require('../../src/supabase/auth');
    });

    describe('extractToken()', () => {
        it('should extract Bearer token from Authorization header', () => {
            const req = {
                headers: {
                    authorization: 'Bearer test-token-123'
                }
            };
            
            const token = auth.extractToken(req);
            expect(token).toBe('test-token-123');
        });

        it('should return null for missing header', () => {
            const req = { headers: {} };
            const token = auth.extractToken(req);
            expect(token).toBeNull();
        });

        it('should return null for non-Bearer auth', () => {
            const req = {
                headers: {
                    authorization: 'Basic dXNlcjpwYXNz'
                }
            };
            const token = auth.extractToken(req);
            expect(token).toBeNull();
        });

        it('should handle case insensitive Bearer', () => {
            const req = {
                headers: {
                    authorization: 'bearer token-123'
                }
            };
            const token = auth.extractToken(req);
            expect(token).toBe('token-123');
        });
    });

    describe('register()', () => {
        it('should return error when Supabase not configured', async () => {
            require('../../src/supabase/client').getClient.mockReturnValue(null);
            
            const result = await auth.register('test@email.com', 'password123');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Supabase not configured');
        });

        it('should call signUp with correct parameters', async () => {
            const client = require('../../src/supabase/client');
            client.getClient.mockReturnValue(mockSupabase);
            mockSupabase.auth.signUp.mockResolvedValue({
                data: { user: { id: 'user-id', email: 'test@email.com' } },
                error: null
            });

            await auth.register('test@email.com', 'password1234', { name: 'Test User' });

            expect(client.getClient).toHaveBeenCalled();
            expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
                email: 'test@email.com',
                password: 'password1234',
                options: {
                    data: expect.objectContaining({
                        username: expect.any(String),
                        display_name: expect.any(String)
                    })
                }
            });
        });

        it('should return success with user on successful registration', async () => {
            const client = require('../../src/supabase/client');
            client.getClient.mockReturnValue(mockSupabase);
            const mockUser = { id: 'user-id', email: 'test@email.com' };
            mockSupabase.auth.signUp.mockResolvedValue({
                data: { user: mockUser },
                error: null
            });

            const result = await auth.register('test@email.com', 'password1234');

            expect(result.success).toBe(true);
            expect(result.user).toMatchObject({ id: 'user-id', email: 'test@email.com' });
        });

        it('should return error on signup failure', async () => {
            mockSupabase.auth.signUp.mockResolvedValue({
                data: { user: null },
                error: { message: 'Email already registered' }
            });

            const result = await auth.register('test@email.com', 'password123456');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Email already registered');
        });
    });

    describe('login()', () => {
        it('should return error when Supabase not configured', async () => {
            require('../../src/supabase/client').getClient.mockReturnValue(null);
            
            const result = await auth.login('test@email.com', 'password123');
            
            expect(result.success).toBe(false);
        });

        it('should call signInWithPassword with correct parameters', async () => {
            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: { id: 'user-id' }, session: { access_token: 'token' } },
                error: null
            });

            await auth.login('test@email.com', 'password123');

            expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
                email: 'test@email.com',
                password: 'password123'
            });
        });

        it('should return session on successful login', async () => {
            const mockSession = { access_token: 'token-123' };
            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: { id: 'user-id' }, session: mockSession },
                error: null
            });

            const result = await auth.login('test@email.com', 'password123');

            expect(result.success).toBe(true);
            expect(result.session).toEqual(mockSession);
        });

        it('should return error on login failure', async () => {
            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: null, session: null },
                error: { message: 'Invalid credentials' }
            });

            const result = await auth.login('test@email.com', 'wrong-password');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid email or password');
        });
    });

    describe('logout()', () => {
        it('should call signOut', async () => {
            mockSupabase.auth.signOut.mockResolvedValue({ error: null });

            const result = await auth.logout();

            expect(mockSupabase.auth.signOut).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });
    });

    describe('getUser()', () => {
        it('should return error for missing token', async () => {
            const result = await auth.getUser(null);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Access token required');
        });

        it('should call getUser with token', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: 'user-id', email: 'test@email.com' } },
                error: null
            });

            await auth.getUser('valid-token');

            expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('valid-token');
        });

        it('should return user on success', async () => {
            const mockUser = { id: 'user-id', email: 'test@email.com' };
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockUser },
                error: null
            });

            const result = await auth.getUser('valid-token');

            expect(result.success).toBe(true);
            expect(result.user).toMatchObject({ id: 'user-id', email: 'test@email.com' });
        });
    });

    describe('requestPasswordReset()', () => {
        it('should call resetPasswordForEmail', async () => {
            mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });

            const result = await auth.requestPasswordReset('test@email.com');

            expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
                'test@email.com',
                expect.any(Object)
            );
            expect(result.success).toBe(true);
        });
    });

    describe('requireAuth middleware', () => {
        let mockReq;
        let mockRes;
        let mockNext;

        beforeEach(() => {
            mockReq = { headers: {} };
            mockRes = {
                writeHead: jest.fn(),
                end: jest.fn()
            };
            mockNext = jest.fn();
        });

        it('should set req.user and return true with valid token', async () => {
            mockReq.headers.authorization = 'Bearer valid-token';
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: 'user-id' } },
                error: null
            });

            const result = await auth.requireAuth(mockReq, mockRes, mockNext);

            expect(result).toBe(true);
            expect(mockReq.user).toBeDefined();
        });

        it('should return 401 without token', async () => {
            await auth.requireAuth(mockReq, mockRes, mockNext);

            expect(mockRes.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 with invalid token', async () => {
            mockReq.headers.authorization = 'Bearer invalid-token';
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: { message: 'Invalid token' }
            });

            await auth.requireAuth(mockReq, mockRes, mockNext);

            expect(mockRes.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
        });
    });
});
