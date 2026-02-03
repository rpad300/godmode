/**
 * Jest Configuration
 * GodMode Testing Framework
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
