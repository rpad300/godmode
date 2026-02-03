/**
 * OTP (One-Time Password) Service Tests
 */

const { hashCode, generateCode } = require('../../src/supabase/otp');

describe('OTP Service', () => {
    describe('generateCode', () => {
        it('should generate a 6-digit code', () => {
            const code = generateCode();
            expect(code).toMatch(/^\d{6}$/);
        });

        it('should generate codes between 100000 and 999999', () => {
            // Generate multiple codes to verify range
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
            // With 6 digits, 100 codes should all be unique (statistically)
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

describe('OTP Integration Tests', () => {
    // These tests require a database connection
    // They are skipped by default and run in integration test suite
    
    describe.skip('createOTP', () => {
        it('should create an OTP code', async () => {
            // Requires database setup
        });

        it('should enforce rate limits', async () => {
            // Requires database setup
        });
    });

    describe.skip('verifyOTP', () => {
        it('should verify a valid code', async () => {
            // Requires database setup
        });

        it('should reject an invalid code', async () => {
            // Requires database setup
        });

        it('should reject an expired code', async () => {
            // Requires database setup
        });

        it('should track attempts', async () => {
            // Requires database setup
        });

        it('should reject after max attempts', async () => {
            // Requires database setup
        });
    });
});
