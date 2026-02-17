/**
 * Purpose:
 *   Comprehensive mock of the Supabase client and related modules (auth, invites,
 *   outbox) for use in backend Jest tests. Provides chainable query builders that
 *   mirror the real @supabase/supabase-js API surface.
 *
 * What is tested:
 *   This file is not tested directly. It is consumed by test files that need to
 *   isolate business logic from real Supabase network calls.
 *
 * Test strategy:
 *   - All Supabase client methods return jest.fn() mocks that are chainable
 *     (.select().eq().single() etc.) just like the real client
 *   - Default resolved values are { data: null, error: null } so tests can
 *     override only what they care about
 *
 * Mocking approach:
 *   - createMockClient(): returns a full mock Supabase client with .from(),
 *     .auth, .channel(), and .removeChannel() stubs
 *   - mockAuth: mocks for the app's auth module (register, login, requireAuth, etc.)
 *   - mockInvites: mocks for invite CRUD and token operations
 *   - mockOutbox: mocks for the sync outbox (addToOutbox, claimBatch, etc.)
 *     including OPERATIONS and EVENT_TYPES constants
 *   - mockData: in-memory Maps/arrays for tests that need stateful mock storage
 *   - resetMocks(): clears all mock data and resets all jest.fn() instances;
 *     call this in beforeEach for test isolation
 *
 * Notes:
 *   - The channel mock supports .on().subscribe() chaining for realtime tests
 *   - presenceState returns an empty object by default; override in tests that
 *     exercise presence features
 */

const mockData = {
    users: new Map(),
    projects: new Map(),
    members: new Map(),
    invites: new Map(),
    activity: [],
    outbox: []
};

// Mock Supabase client
const createMockClient = () => ({
    from: (table) => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
    }),
    auth: {
        signUp: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signInWithPassword: jest.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
        updateUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null })
    },
    channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
        unsubscribe: jest.fn(),
        track: jest.fn(),
        untrack: jest.fn(),
        presenceState: jest.fn().mockReturnValue({})
    }),
    removeChannel: jest.fn()
});

// Mock auth module
const mockAuth = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    getUser: jest.fn(),
    extractToken: jest.fn(),
    getUserProfile: jest.fn(),
    upsertUserProfile: jest.fn(),
    requireAuth: jest.fn(),
    requireSuperAdmin: jest.fn()
};

// Mock invites module
const mockInvites = {
    generateToken: jest.fn(),
    hashToken: jest.fn(),
    createInvite: jest.fn(),
    acceptInvite: jest.fn(),
    revokeInvite: jest.fn(),
    listInvites: jest.fn(),
    getInviteByToken: jest.fn(),
    cleanupExpiredInvites: jest.fn()
};

// Mock outbox module
const mockOutbox = {
    OPERATIONS: {
        CREATE: 'CREATE',
        UPDATE: 'UPDATE',
        DELETE: 'DELETE',
        LINK: 'LINK',
        UNLINK: 'UNLINK'
    },
    EVENT_TYPES: {
        ENTITY: 'entity',
        RELATION: 'relation',
        PROPERTY: 'property'
    },
    addToOutbox: jest.fn(),
    addBatchToOutbox: jest.fn(),
    claimBatch: jest.fn(),
    markCompleted: jest.fn(),
    markFailed: jest.fn(),
    getPendingCount: jest.fn(),
    getSyncStatus: jest.fn(),
    getDeadLetters: jest.fn(),
    getStats: jest.fn()
};

/**
 * Reset all in-memory mock data and clear every jest.fn() mock.
 * Call in beforeEach() for full test isolation.
 */
const resetMocks = () => {
    mockData.users.clear();
    mockData.projects.clear();
    mockData.members.clear();
    mockData.invites.clear();
    mockData.activity = [];
    mockData.outbox = [];
    
    Object.values(mockAuth).forEach(fn => fn.mockReset && fn.mockReset());
    Object.values(mockInvites).forEach(fn => fn.mockReset && fn.mockReset());
    Object.values(mockOutbox).forEach(fn => fn.mockReset && fn.mockReset());
};

module.exports = {
    createMockClient,
    mockAuth,
    mockInvites,
    mockOutbox,
    mockData,
    resetMocks
};
