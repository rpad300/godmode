/**
 * OTP (One-Time Password) Service Tests
 * Unit tests with mocked Supabase client
 */

const mockGetAdminClient = jest.fn();
jest.mock('../../src/supabase/client', () => ({
    getAdminClient: (...args) => mockGetAdminClient(...args)
}));

describe('OTP Service', () => {
    const { hashCode, generateCode } = require('../../src/supabase/otp');

    describe('generateCode', () => {
        it('should generate a 6-digit code', () => {
            const code = generateCode();
            expect(code).toMatch(/^\d{6}$/);
        });

        it('should generate codes between 100000 and 999999', () => {
            for (let i = 0; i < 100; i++) {
                const code = generateCode();
                const num = parseInt(code, 10);
                expect(num).toBeGreaterThanOrEqual(100000);
                expect(num).toBeLessThanOrEqual(999999);
            }
        });

        it('should generate different codes', () => {
            const codes = new Set();
            for (let i = 0; i < 100; i++) {
                codes.add(generateCode());
            }
            expect(codes.size).toBeGreaterThan(90);
        });
    });

    describe('hashCode', () => {
        it('should return a SHA256 hash (64 chars hex)', () => {
            const hash = hashCode('123456');
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should produce consistent hashes', () => {
            const code = '123456';
            const hash1 = hashCode(code);
            const hash2 = hashCode(code);
            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different codes', () => {
            const hash1 = hashCode('123456');
            const hash2 = hashCode('654321');
            expect(hash1).not.toBe(hash2);
        });

        it('should handle edge cases', () => {
            expect(hashCode('000000')).toMatch(/^[a-f0-9]{64}$/);
            expect(hashCode('999999')).toMatch(/^[a-f0-9]{64}$/);
        });
    });
});

describe('OTP Integration Tests (mocked)', () => {
    let otp;
    let mockAdmin;

    beforeEach(() => {
        jest.resetModules();
        mockAdmin = {
            rpc: jest.fn(),
            from: jest.fn()
        };
        mockGetAdminClient.mockReturnValue(mockAdmin);
        otp = require('../../src/supabase/otp');
    });

    describe('createOTP', () => {
        it('should create an OTP code when DB allows', async () => {
            mockAdmin.rpc.mockResolvedValueOnce({ data: [], error: null });
            mockAdmin.from.mockReturnValue({
                insert: jest.fn().mockReturnValue(Promise.resolve({ error: null }))
            });

            const result = await otp.createOTP('user@example.com', 'login', '127.0.0.1', 'test');

            expect(result.success).toBe(true);
            expect(result.code).toMatch(/^\d{6}$/);
            expect(result.expiresAt).toBeInstanceOf(Date);
            expect(result.expiresInMinutes).toBe(10);
        });

        it('should enforce rate limits when RPC returns not allowed', async () => {
            mockAdmin.rpc.mockResolvedValueOnce({
                data: [{ allowed: false, error_code: 'RATE_LIMIT_MINUTE', retry_after_seconds: 60 }],
                error: null
            });

            const result = await otp.createOTP('user@example.com', 'login');

            expect(result.success).toBe(false);
            expect(result.error).toContain('wait');
            expect(result.retryAfter).toBe(60);
            expect(mockAdmin.from).not.toHaveBeenCalled();
        });

        it('should return error when Supabase not configured', async () => {
            mockGetAdminClient.mockReturnValueOnce(null);

            const result = await otp.createOTP('user@example.com', 'login');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database not configured');
        });

        it('should return error for invalid purpose', async () => {
            const result = await otp.createOTP('user@example.com', 'invalid_purpose');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid OTP purpose');
        });

        it('should return error for invalid email', async () => {
            const result = await otp.createOTP('not-an-email', 'login');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Valid email is required');
        });

        it('should return error when insert fails', async () => {
            mockAdmin.rpc.mockResolvedValueOnce({ data: [], error: null });
            mockAdmin.from.mockReturnValue({
                insert: jest.fn().mockReturnValue(Promise.resolve({ error: { message: 'insert failed' } }))
            });

            const result = await otp.createOTP('user@example.com', 'login');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to create verification code');
        });
    });

    describe('verifyOTP', () => {
        it('should verify a valid code', async () => {
            mockAdmin.rpc.mockResolvedValueOnce({
                data: [{ success: true }],
                error: null
            });

            const result = await otp.verifyOTP('user@example.com', '123456', 'login');

            expect(result.success).toBe(true);
            expect(mockAdmin.rpc).toHaveBeenCalledWith('verify_otp_code', {
                p_email: 'user@example.com',
                p_code_hash: expect.any(String),
                p_purpose: 'login'
            });
        });

        it('should reject an invalid code', async () => {
            mockAdmin.rpc.mockResolvedValueOnce({
                data: [{ success: false, error_code: 'INVALID_CODE' }],
                error: null
            });

            const result = await otp.verifyOTP('user@example.com', '999999', 'login');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Incorrect');
        });

        it('should reject an expired or missing code', async () => {
            mockAdmin.rpc.mockResolvedValueOnce({
                data: [{ success: false, error_code: 'OTP_NOT_FOUND' }],
                error: null
            });

            const result = await otp.verifyOTP('user@example.com', '123456', 'login');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid or expired');
        });

        it('should reject after max attempts', async () => {
            mockAdmin.rpc.mockResolvedValueOnce({
                data: [{ success: false, error_code: 'MAX_ATTEMPTS_EXCEEDED' }],
                error: null
            });

            const result = await otp.verifyOTP('user@example.com', '000000', 'login');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Too many incorrect');
        });

        it('should return error when Supabase not configured', async () => {
            mockGetAdminClient.mockReturnValueOnce(null);

            const result = await otp.verifyOTP('user@example.com', '123456', 'login');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database not configured');
        });

        it('should return error for invalid code format', async () => {
            const result = await otp.verifyOTP('user@example.com', '12345', 'login');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid code format');
            expect(mockAdmin.rpc).not.toHaveBeenCalled();
        });

        it('should return error when email, code or purpose missing', async () => {
            expect((await otp.verifyOTP('', '123456', 'login')).success).toBe(false);
            expect((await otp.verifyOTP('u@e.com', '', 'login')).success).toBe(false);
            expect((await otp.verifyOTP('u@e.com', '123456', '')).success).toBe(false);
        });
    });
});
