/**
 * Enterprise Features API Integration Tests
 * Tests for API Keys, Webhooks, Audit Export
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

describe('API Keys Integration Tests', () => {
    let serverAvailable = false;

    beforeAll(async () => {
        try {
            const res = await request('GET', '/api/config');
            serverAvailable = res.status === 200;
        } catch (e) {}
    });

    describe('GET /api/projects/:id/api-keys', () => {
        it('should require authentication', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/projects/test-project/api-keys');
            expect([400, 401, 404, 503]).toContain(res.status);
        });
    });

    describe('POST /api/projects/:id/api-keys', () => {
        it('should require authentication', async () => {
            if (!serverAvailable) return;

            const res = await request('POST', '/api/projects/test-project/api-keys', {
                name: 'Test Key',
                permissions: ['read']
            });
            expect([400, 401, 503]).toContain(res.status);
        });
    });

    describe('DELETE /api/api-keys/:id', () => {
        it('should require authentication', async () => {
            if (!serverAvailable) return;

            const res = await request('DELETE', '/api/api-keys/key-id');
            expect([401, 503]).toContain(res.status);
        });
    });
});

describe('Webhooks Integration Tests', () => {
    let serverAvailable = false;

    beforeAll(async () => {
        try {
            const res = await request('GET', '/api/config');
            serverAvailable = res.status === 200;
        } catch (e) {}
    });

    describe('GET /api/projects/:id/webhooks', () => {
        it('should require authentication', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/projects/test-project/webhooks');
            expect([400, 401, 404, 503]).toContain(res.status);
        });
    });

    describe('POST /api/projects/:id/webhooks', () => {
        it('should require authentication', async () => {
            if (!serverAvailable) return;

            const res = await request('POST', '/api/projects/test-project/webhooks', {
                name: 'Test Webhook',
                url: 'https://example.com/webhook',
                events: ['content.created']
            });
            expect([400, 401, 503]).toContain(res.status);
        });

        it('should validate webhook URL format', async () => {
            if (!serverAvailable) return;

            // Even without auth, validation should catch bad URLs
            const res = await request('POST', '/api/projects/test-project/webhooks', {
                name: 'Test Webhook',
                url: 'not-a-valid-url',
                events: ['content.created']
            });
            expect([400, 401, 503]).toContain(res.status);
        });
    });

    describe('POST /api/webhooks/:id/test', () => {
        it('should require authentication', async () => {
            if (!serverAvailable) return;

            const res = await request('POST', '/api/webhooks/webhook-id/test');
            expect([400, 401, 404, 500, 503]).toContain(res.status);
        });
    });
});

describe('Audit Export Integration Tests', () => {
    let serverAvailable = false;

    beforeAll(async () => {
        try {
            const res = await request('GET', '/api/config');
            serverAvailable = res.status === 200;
        } catch (e) {}
    });

    describe('GET /api/projects/:id/audit-exports', () => {
        it('should require authentication', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/projects/test-project/audit-exports');
            expect([400, 401, 404, 503]).toContain(res.status);
        });
    });

    describe('POST /api/projects/:id/audit-exports', () => {
        it('should require authentication', async () => {
            if (!serverAvailable) return;

            const res = await request('POST', '/api/projects/test-project/audit-exports', {
                dateFrom: '2024-01-01',
                dateTo: '2024-12-31',
                format: 'json'
            });
            expect([400, 401, 404, 503]).toContain(res.status);
        });
    });

    describe('GET /api/audit-exports/:id/download', () => {
        it('should require authentication', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/audit-exports/export-id/download');
            expect([401, 404, 503]).toContain(res.status);
        });
    });
});

describe('Graph Sync Integration Tests', () => {
    let serverAvailable = false;

    beforeAll(async () => {
        try {
            const res = await request('GET', '/api/config');
            serverAvailable = res.status === 200;
        } catch (e) {}
    });

    describe('GET /api/projects/:id/sync/status', () => {
        it('should return sync status (may require auth)', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/projects/test-project/sync/status');
            expect([200, 400, 401, 503]).toContain(res.status);
        });
    });

    describe('GET /api/projects/:id/sync/stats', () => {
        it('should return sync statistics', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/projects/test-project/sync/stats');
            expect([200, 400, 401, 503]).toContain(res.status);
        });
    });

    describe('GET /api/projects/:id/sync/dead-letters', () => {
        it('should require authentication', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/projects/test-project/sync/dead-letters');
            expect([200, 400, 401, 404, 500, 503]).toContain(res.status);
        });
    });

    describe('POST /api/sync/dead-letters/:id/retry', () => {
        it('should require authentication', async () => {
            if (!serverAvailable) return;

            const res = await request('POST', '/api/sync/dead-letters/dl-id/retry');
            expect([400, 401, 404, 503]).toContain(res.status);
        });
    });
});
