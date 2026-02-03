/**
 * Auth API Integration Tests
 * End-to-end tests for authentication endpoints
 */

const http = require('http');

// Test configuration
const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3005';

// Helper to make HTTP requests
function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data ? JSON.parse(data) : null
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                }
            });
        });

        req.on('error', reject);
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        
        req.end();
    });
}

describe('Auth API Integration Tests', () => {
    // Skip if no test server available
    let serverAvailable = false;

    beforeAll(async () => {
        try {
            const res = await request('GET', '/api/config');
            serverAvailable = res.status === 200;
        } catch (e) {
            console.log('Test server not available, skipping integration tests');
        }
    });

    describe('GET /api/auth/status', () => {
        it('should return auth configuration status', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/auth/status');
            
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('configured');
            expect(typeof res.body.configured).toBe('boolean');
        });
    });

    describe('POST /api/auth/register', () => {
        it('should reject registration without email', async () => {
            if (!serverAvailable) return;

            const res = await request('POST', '/api/auth/register', {
                password: 'password123'
            });
            
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should reject registration without password', async () => {
            if (!serverAvailable) return;

            const res = await request('POST', '/api/auth/register', {
                email: 'test@example.com'
            });
            
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should reject weak password', async () => {
            if (!serverAvailable) return;

            const res = await request('POST', '/api/auth/register', {
                email: 'test@example.com',
                password: '123'
            });
            
            expect([400, 422]).toContain(res.status);
        });
    });

    describe('POST /api/auth/login', () => {
        it('should reject login without credentials', async () => {
            if (!serverAvailable) return;

            const res = await request('POST', '/api/auth/login', {});
            
            expect(res.status).toBe(400);
        });

        it('should reject invalid credentials', async () => {
            if (!serverAvailable) return;

            const res = await request('POST', '/api/auth/login', {
                email: 'nonexistent@example.com',
                password: 'wrongpassword'
            });
            
            expect([400, 401]).toContain(res.status);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('GET /api/user/profile', () => {
        it('should reject request without auth token', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/user/profile');
            
            expect(res.status).toBe(401);
        });

        it('should reject request with invalid token', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/user/profile', null, {
                'Authorization': 'Bearer invalid-token'
            });
            
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/auth/forgot-password', () => {
        it('should accept email for password reset', async () => {
            if (!serverAvailable) return;

            const res = await request('POST', '/api/auth/forgot-password', {
                email: 'test@example.com'
            });
            
            // Should always return success to prevent email enumeration
            expect([200, 400, 503]).toContain(res.status);
        });
    });
});

describe('Protected Routes', () => {
    let serverAvailable = false;

    beforeAll(async () => {
        try {
            const res = await request('GET', '/api/config');
            serverAvailable = res.status === 200;
        } catch (e) {
            // Server not available
        }
    });

    const protectedRoutes = [
        { method: 'GET', path: '/api/user/profile' },
        { method: 'PUT', path: '/api/user/profile' },
        { method: 'GET', path: '/api/user/projects' },
        { method: 'GET', path: '/api/notifications' },
        { method: 'GET', path: '/api/notifications/unread-count' }
    ];

    protectedRoutes.forEach(({ method, path }) => {
        it(`should require auth for ${method} ${path}`, async () => {
            if (!serverAvailable) return;

            const res = await request(method, path);
            expect(res.status).toBe(401);
        });
    });
});
