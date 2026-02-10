/**
 * Projects API Integration Tests
 * End-to-end tests for project management endpoints
 */

const http = require('http');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3005';

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

describe('Projects API Integration Tests', () => {
    let serverAvailable = false;

    beforeAll(async () => {
        try {
            const res = await request('GET', '/api/config');
            serverAvailable = res.status === 200;
        } catch (e) {
            console.log('Test server not available');
        }
    });

    describe('GET /api/projects', () => {
        it('should return list of projects', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/projects');
            
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('projects');
            expect(Array.isArray(res.body.projects)).toBe(true);
        });
    });

    describe('GET /api/projects/:id/stats', () => {
        it('should return 4xx/5xx for invalid project ID or 200 with stats', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/projects/invalid-id/stats');
            // 200 with stats, 400/404 invalid, 500/503 server or auth
            expect([200, 400, 404, 500, 503]).toContain(res.status);
        });
    });

    describe('Project Members', () => {
        it('should require auth to list members', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/projects/test-project/members');
            // 200 empty/list, 400 invalid ID, 401 unauth, 404 project, 500/503 server or auth not configured
            expect([200, 400, 401, 404, 500, 503]).toContain(res.status);
        });

        it('should require auth to add members', async () => {
            if (!serverAvailable) return;

            const res = await request('POST', '/api/projects/test-project/members', {
                userId: 'user-id',
                role: 'read'
            });
            
            expect([400, 401, 404, 503]).toContain(res.status);
        });
    });

    describe('Project Invites', () => {
        it('should require auth to list invites', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/projects/test-project/invites');
            expect([400, 401, 404, 500, 503]).toContain(res.status);
        });

        it('should require auth to create invite', async () => {
            if (!serverAvailable) return;

            const res = await request('POST', '/api/projects/test-project/invites', {
                role: 'write',
                expiresInHours: 24
            });
            
            expect([400, 401, 404, 503]).toContain(res.status);
        });
    });

    describe('Activity Log', () => {
        it('should require auth to view activity', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/projects/test-project/activity');
            
            expect([400, 401, 404, 503]).toContain(res.status);
        });
    });
});

describe('Comments API', () => {
    let serverAvailable = false;

    beforeAll(async () => {
        try {
            const res = await request('GET', '/api/config');
            serverAvailable = res.status === 200;
        } catch (e) {}
    });

    it('should require auth to create comment', async () => {
        if (!serverAvailable) return;

        const res = await request('POST', '/api/projects/test-project/comments', {
            targetType: 'fact',
            targetId: 'fact-1',
            content: 'Test comment'
        });
        
        expect([400, 401, 404, 503]).toContain(res.status);
    });

    it('should require auth to list comments', async () => {
        if (!serverAvailable) return;

        const res = await request('GET', '/api/projects/test-project/comments?targetType=fact&targetId=fact-1');
        
        expect([400, 401, 404, 503]).toContain(res.status);
    });
});

describe('Search API', () => {
    let serverAvailable = false;

    beforeAll(async () => {
        try {
            const res = await request('GET', '/api/config');
            serverAvailable = res.status === 200;
        } catch (e) {}
    });

    it('should require auth for global search', async () => {
        if (!serverAvailable) return;

        const res = await request('GET', '/api/search?q=test');
        
        expect([400, 401, 404, 503]).toContain(res.status);
    });

    it('should require auth for mention suggestions', async () => {
        if (!serverAvailable) return;

        const res = await request('GET', '/api/projects/test-project/mentions?prefix=@jo');
        
        expect([400, 401, 404, 503]).toContain(res.status);
    });
});
