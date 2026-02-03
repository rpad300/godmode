/**
 * Jest Test Setup
 * Global configuration and mocks
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
