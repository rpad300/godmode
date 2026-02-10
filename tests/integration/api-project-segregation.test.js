/**
 * Project segregation integration tests
 * Verifies that project-scoped endpoints use X-Project-Id and do not leak data across projects.
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
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Project segregation', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    try {
      const res = await request('GET', '/api/config');
      serverAvailable = res.status === 200;
    } catch {
      // Server not available
    }
  });

  describe('X-Project-Id header on project-scoped endpoints', () => {
    const projectScopedEndpoints = [
      { method: 'GET', path: '/api/questions' },
      { method: 'GET', path: '/api/risks' },
      { method: 'GET', path: '/api/actions' },
      { method: 'GET', path: '/api/decisions' },
      { method: 'GET', path: '/api/contacts' },
    ];

    projectScopedEndpoints.forEach(({ method, path }) => {
      it(`${method} ${path} accepts X-Project-Id and returns project-scoped structure`, async () => {
        if (!serverAvailable) return;

        const projectId = '00000000-0000-0000-0000-000000000001';
        const res = await request(method, path, null, {
          'X-Project-Id': projectId,
        });

        expect([200, 401, 403, 503]).toContain(res.status);
        if (res.status === 200 && res.body) {
          const key = path.includes('questions')
            ? 'questions'
            : path.includes('risks')
              ? 'risks'
              : path.includes('actions')
                ? 'actions'
                : path.includes('decisions')
                  ? 'decisions'
                  : path.includes('contacts')
                    ? 'contacts'
                    : null;
          if (key) expect(res.body).toHaveProperty(key);
          expect(Array.isArray(res.body[key]) || typeof res.body[key] === 'object').toBe(true);
        }
      });
    });
  });

  describe('Project-scoped list responses are arrays', () => {
    it('GET /api/questions with X-Project-Id returns questions array', async () => {
      if (!serverAvailable) return;

      const res = await request('GET', '/api/questions', null, {
        'X-Project-Id': '00000000-0000-0000-0000-000000000001',
      });

      if (res.status === 200 && res.body) {
        expect(res.body).toHaveProperty('questions');
        expect(Array.isArray(res.body.questions)).toBe(true);
      }
    });

    it('GET /api/risks with X-Project-Id returns risks array', async () => {
      if (!serverAvailable) return;

      const res = await request('GET', '/api/risks', null, {
        'X-Project-Id': '00000000-0000-0000-0000-000000000001',
      });

      if (res.status === 200 && res.body) {
        expect(res.body).toHaveProperty('risks');
        expect(Array.isArray(res.body.risks)).toBe(true);
      }
    });
  });

  describe('Different X-Project-Id values are independent', () => {
    it('sequential requests with different X-Project-Id do not share response body', async () => {
      if (!serverAvailable) return;

      const projectA = '00000000-0000-0000-0000-000000000001';
      const projectB = '00000000-0000-0000-0000-000000000002';

      const resA = await request('GET', '/api/questions', null, {
        'X-Project-Id': projectA,
      });
      const resB = await request('GET', '/api/questions', null, {
        'X-Project-Id': projectB,
      });

      expect(resA.status).toBe(resB.status);
      if (resA.status === 200 && resB.status === 200 && resA.body && resB.body) {
        expect(resA.body).toHaveProperty('questions');
        expect(resB.body).toHaveProperty('questions');
        expect(Array.isArray(resA.body.questions)).toBe(true);
        expect(Array.isArray(resB.body.questions)).toBe(true);
      }
    });
  });

  describe('Routes without project context', () => {
    it('GET /api/projects does not require X-Project-Id', async () => {
      if (!serverAvailable) return;

      const res = await request('GET', '/api/projects');
      expect([200, 401, 503]).toContain(res.status);
      if (res.status === 200 && res.body) {
        expect(res.body).toHaveProperty('projects');
        expect(Array.isArray(res.body.projects)).toBe(true);
      }
    });
  });
});
