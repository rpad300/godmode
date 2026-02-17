/**
 * Purpose:
 *   Jest configuration for the GodMode backend test suite (Node.js environment).
 *
 * Responsibilities:
 *   - Define test discovery patterns (tests/**/*.test.js)
 *   - Configure coverage collection, reporters, and minimum thresholds (50%)
 *   - Set up the global test environment via tests/setup.js
 *   - Split tests into "unit" and "integration" project groups
 *
 * Key dependencies:
 *   - jest: test runner
 *   - tests/setup.js: global mocks and test utilities loaded via setupFilesAfterEnv
 *
 * Notes:
 *   - This config is for the backend (Node.js) only; the frontend uses Vitest
 *     (see src/frontend/vitest.config.ts)
 *   - Coverage excludes src/public/ (static assets) and src/server.js (entry point)
 *   - testTimeout is 10s by default; integration tests override to 30s in setup.js
 *   - clearMocks=true resets mock state between tests automatically
 */

module.exports = {
    // Test environment
    testEnvironment: 'node',
    
    // Root directory
    rootDir: '.',
    
    // Test file patterns
    testMatch: [
        '<rootDir>/tests/**/*.test.js'
    ],
    
    // Coverage configuration
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/public/**',
        '!src/server.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50
        }
    },
    
    // Module paths
    moduleDirectories: ['node_modules', 'src'],
    
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    
    // Timeout for async tests
    testTimeout: 10000,
    
    // Verbose output
    verbose: true,
    
    // Clear mocks between tests
    clearMocks: true,
    
    // Projects for different test types
    projects: [
        {
            displayName: 'unit',
            testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
            testEnvironment: 'node'
        },
        {
            displayName: 'integration',
            testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
            testEnvironment: 'node'
        }
    ]
};
