/**
 * Supabase Module Index
 * Exports all Supabase-related functionality
 */

const client = require('./client');
const auth = require('./auth');
const invites = require('./invites');
const activity = require('./activity');
const members = require('./members');
const comments = require('./comments');
const notifications = require('./notifications');
const search = require('./search');
const apikeys = require('./apikeys');
const webhooks = require('./webhooks');
const audit = require('./audit');
const outbox = require('./outbox');
const realtime = require('./realtime');
const projects = require('./projects');
const { SupabaseStorage, createSupabaseStorage } = require('./storage');

module.exports = {
    // Client
    getClient: client.getClient,
    getAdminClient: client.getAdminClient,
    isConfigured: client.isConfigured,
    testConnection: client.testConnection,
    getConfigInfo: client.getConfigInfo,
    
    // Auth
    auth: {
        register: auth.register,
        login: auth.login,
        logout: auth.logout,
        requestPasswordReset: auth.requestPasswordReset,
        updatePassword: auth.updatePassword,
        getUser: auth.getUser,
        refreshToken: auth.refreshToken,
        getUserProfile: auth.getUserProfile,
        upsertUserProfile: auth.upsertUserProfile,
        isSuperAdmin: auth.isSuperAdmin,
        makeSuperAdmin: auth.makeSuperAdmin,
        extractToken: auth.extractToken,
        verifyRequest: auth.verifyRequest,
        requireAuth: auth.requireAuth,
        requireSuperAdmin: auth.requireSuperAdmin
    },
    
    // Invites
    invites: {
        createInvite: invites.createInvite,
        acceptInvite: invites.acceptInvite,
        revokeInvite: invites.revokeInvite,
        listInvites: invites.listInvites,
        getInviteByToken: invites.getInviteByToken,
        cleanupExpiredInvites: invites.cleanupExpiredInvites
    },
    
    // Activity Log
    activity: {
        ACTION_TYPES: activity.ACTION_TYPES,
        logActivity: activity.logActivity,
        logActivityFromRequest: activity.logActivityFromRequest,
        getProjectActivity: activity.getProjectActivity,
        getUserActivity: activity.getUserActivity
    },
    
    // Members
    members: {
        getProjectMembers: members.getProjectMembers,
        getMemberRole: members.getMemberRole,
        addMember: members.addMember,
        updateMemberRole: members.updateMemberRole,
        removeMember: members.removeMember,
        transferOwnership: members.transferOwnership,
        getUserProjects: members.getUserProjects
    },
    
    // Comments
    comments: {
        createComment: comments.createComment,
        getComments: comments.getComments,
        updateComment: comments.updateComment,
        deleteComment: comments.deleteComment,
        resolveComment: comments.resolveComment,
        extractMentions: comments.extractMentions
    },
    
    // Notifications
    notifications: {
        TYPES: notifications.NOTIFICATION_TYPES,
        create: notifications.createNotification,
        getForUser: notifications.getUserNotifications,
        getUnreadCount: notifications.getUnreadCount,
        markAsRead: notifications.markAsRead,
        markAllAsRead: notifications.markAllAsRead,
        delete: notifications.deleteNotification,
        watchItem: notifications.watchItem,
        unwatchItem: notifications.unwatchItem,
        notifyWatchers: notifications.notifyWatchers
    },
    
    // Search
    search: {
        users: search.searchUsers,
        comments: search.searchComments,
        projects: search.searchProjects,
        global: search.globalSearch,
        mentionSuggestions: search.getMentionSuggestions
    },
    
    // API Keys
    apikeys: {
        PERMISSIONS: apikeys.PERMISSIONS,
        create: apikeys.createApiKey,
        validate: apikeys.validateApiKey,
        hasPermission: apikeys.hasPermission,
        list: apikeys.listApiKeys,
        revoke: apikeys.revokeApiKey,
        update: apikeys.updateApiKey,
        logUsage: apikeys.logUsage,
        getUsageStats: apikeys.getUsageStats,
        authenticate: apikeys.authenticateApiKey
    },
    
    // Webhooks
    webhooks: {
        EVENTS: webhooks.WEBHOOK_EVENTS,
        create: webhooks.createWebhook,
        list: webhooks.listWebhooks,
        update: webhooks.updateWebhook,
        delete: webhooks.deleteWebhook,
        regenerateSecret: webhooks.regenerateSecret,
        trigger: webhooks.triggerWebhooks,
        getDeliveryHistory: webhooks.getDeliveryHistory,
        test: webhooks.testWebhook,
        signPayload: webhooks.signPayload,
        verifySignature: webhooks.verifySignature
    },
    
    // Audit
    audit: {
        FORMATS: audit.EXPORT_FORMATS,
        createExport: audit.createExportJob,
        getExport: audit.getExportJob,
        listExports: audit.listExportJobs,
        download: audit.downloadExport,
        getSummary: audit.getAuditSummary,
        cleanup: audit.cleanupExpiredExports
    },
    
    // Outbox (Graph Sync)
    outbox: {
        OPERATIONS: outbox.OPERATIONS,
        EVENT_TYPES: outbox.EVENT_TYPES,
        add: outbox.addToOutbox,
        addBatch: outbox.addBatchToOutbox,
        claimBatch: outbox.claimBatch,
        markCompleted: outbox.markCompleted,
        markFailed: outbox.markFailed,
        getPendingCount: outbox.getPendingCount,
        getSyncStatus: outbox.getSyncStatus,
        upsertSyncStatus: outbox.upsertSyncStatus,
        getDeadLetters: outbox.getDeadLetters,
        resolveDeadLetter: outbox.resolveDeadLetter,
        retryDeadLetter: outbox.retryDeadLetter,
        getStats: outbox.getStats,
        cleanup: outbox.cleanup
    },
    
    // Realtime
    realtime: {
        subscribeToProject: realtime.subscribeToProject,
        subscribeToNotifications: realtime.subscribeToNotifications,
        subscribeToPresence: realtime.subscribeToPresence,
        trackPresence: realtime.trackPresence,
        untrackPresence: realtime.untrackPresence,
        unsubscribe: realtime.unsubscribe,
        unsubscribeAll: realtime.unsubscribeAll,
        on: realtime.on,
        broadcast: realtime.broadcast,
        getActiveSubscriptions: realtime.getActiveSubscriptions,
        getPresenceState: realtime.getPresenceState
    },
    
    // Projects
    projects: {
        create: projects.createProject,
        get: projects.getProject,
        update: projects.updateProject,
        delete: projects.deleteProject,
        listForUser: projects.listUserProjects,
        getStats: projects.getProjectStats,
        updateSettings: projects.updateSettings,
        clone: projects.cloneProject
    },
    
    // Storage (replaces local JSON storage)
    SupabaseStorage,
    createSupabaseStorage
};
