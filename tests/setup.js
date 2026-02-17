/**
 * Purpose:
 *   Global Jest setup file loaded before every test suite (via setupFilesAfterEnv).
 *   Establishes a deterministic test environment with stubbed credentials,
 *   reusable factory helpers, and suppressed console output.
 *
 * What is tested:
 *   This file does not contain tests itself. It configures the environment for
 *   all backend unit and integration tests.
 *
 * Test strategy:
 *   - Set NODE_ENV='test' and inject dummy Supabase credentials so that no test
 *     accidentally hits a real backend
 *   - Provide global.testUtils with factory functions (mockUser, mockProject)
 *     and a wait() helper for async timing
 *   - Suppress console.log and console.warn via jest.spyOn to keep test output clean
 *   - Increase Jest timeout to 30s when TEST_TYPE=integration
 *
 * Mocking approach:
 *   - Console methods are spied on (not fully replaced) so they can be restored
 *     in afterAll; console.error is left intact for visibility into real failures
 *
 * Notes:
 *   - The dummy Supabase credentials here must NOT match any real project
 *   - testUtils.generateId() produces non-UUID random strings; for UUID-dependent
 *     tests, use a dedicated UUID generator
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

// Global test utilities
global.testUtils = {
    // Generate random ID
    generateId: () => Math.random().toString(36).substring(2, 15),
    
    // Create mock user
    mockUser: (overrides = {}) => ({
        id: global.testUtils.generateId(),
        email: `test-${Date.now()}@example.com`,
        created_at: new Date().toISOString(),
        ...overrides
    }),
    
    // Create mock project
    mockProject: (overrides = {}) => ({
        id: global.testUtils.generateId(),
        name: `Test Project ${Date.now()}`,
        description: 'Test project description',
        owner_id: global.testUtils.generateId(),
        created_at: new Date().toISOString(),
        ...overrides
    }),
    
    // Wait helper
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Console spy to suppress logs in tests
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
    jest.restoreAllMocks();
});

// Increase timeout for integration tests
if (process.env.TEST_TYPE === 'integration') {
    jest.setTimeout(30000);
}
