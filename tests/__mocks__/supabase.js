/**
 * Supabase Mock
 * Mock implementation for testing
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

// Helper to reset all mocks
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
