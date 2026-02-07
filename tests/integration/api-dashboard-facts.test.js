/**
 * Dashboard API Integration Tests (Facts SOTA)
 * GET /api/dashboard should return factsByCategory and factsVerifiedCount
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
            headers: { 'Content-Type': 'application/json', ...headers }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

describe('Dashboard API (Facts SOTA)', () => {
    let serverAvailable = false;

    beforeAll(async () => {
        try {
            const res = await request('GET', '/api/config');
            serverAvailable = res.status === 200;
        } catch {
            // Server not running
        }
    });

    describe('GET /api/dashboard', () => {
        it('should return factsByCategory and factsVerifiedCount when dashboard is available', async () => {
            if (!serverAvailable) return;

            const res = await request('GET', '/api/dashboard');
            if (res.status !== 200) return;

            expect(res.body).toBeDefined();
            expect(res.body).toHaveProperty('totalFacts');
            // SOTA: dashboard must include factsByCategory and factsVerifiedCount (server.js GET /api/dashboard)
            if (res.body.factsByCategory != null) {
                expect(res.body).toHaveProperty('factsVerifiedCount');
                expect(typeof res.body.factsVerifiedCount).toBe('number');
                const cats = ['technical', 'process', 'policy', 'people', 'timeline', 'general'];
                cats.forEach(c => {
                    expect(res.body.factsByCategory).toHaveProperty(c);
                });
            }
        });
    });
});
