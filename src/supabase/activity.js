/**
 * Activity Log Module
 * Append-only audit trail for project actions
 */

const { getAdminClient, getClient } = require('./client');

/**
 * Action types for activity log
 */
const ACTION_TYPES = {
    // Project
    PROJECT_CREATED: 'project.created',
    PROJECT_UPDATED: 'project.updated',
    PROJECT_DELETED: 'project.deleted',
    
    // Members
    MEMBER_ADDED: 'member.added',
    MEMBER_REMOVED: 'member.removed',
    MEMBER_ROLE_CHANGED: 'member.role_changed',
    
    // Invites
    INVITE_CREATED: 'invite.created',
    INVITE_ACCEPTED: 'invite.accepted',
    INVITE_REVOKED: 'invite.revoked',
    
    // Content
    CONTENT_CREATED: 'content.created',
    CONTENT_UPDATED: 'content.updated',
    CONTENT_DELETED: 'content.deleted',
    
    // Documents
    DOCUMENT_UPLOADED: 'document.uploaded',
    DOCUMENT_PROCESSED: 'document.processed',
    DOCUMENT_DELETED: 'document.deleted',
    
    // Comments
    COMMENT_CREATED: 'comment.created',
    COMMENT_DELETED: 'comment.deleted',
    
    // Auth
    USER_LOGIN: 'user.login',
    USER_LOGOUT: 'user.logout',
    PASSWORD_CHANGED: 'password.changed',
    
    // Admin
    ADMIN_ACCESS: 'admin.access',
    SETTINGS_CHANGED: 'settings.changed'
};

/**
 * Log an activity
 * @param {object} params
 * @param {string} params.projectId - Project UUID (optional for global actions)
 * @param {string} params.actorId - User UUID who performed the action
 * @param {string} params.action - Action type (use ACTION_TYPES)
 * @param {string} [params.targetType] - Type of target (e.g., 'fact', 'member')
 * @param {string} [params.targetId] - UUID of target
 * @param {object} [params.metadata] - Additional data about the action
 * @param {string} [params.ipAddress] - IP address of actor
 * @param {string} [params.userAgent] - User agent string
 * @returns {Promise<{success: boolean, activity?: object, error?: string}>}
 */
async function logActivity({ projectId, actorId, action, targetType, targetId, metadata, ipAddress, userAgent }) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };
    
    if (!actorId || !action) {
        return { success: false, error: 'actorId and action are required' };
    }
    
    try {
        const { data, error } = await admin
            .from('activity_log')
            .insert({
                project_id: projectId || null,
                actor_id: actorId,
                action: action,
                target_type: targetType || null,
                target_id: targetId || null,
                metadata: metadata || {},
                ip_address: ipAddress || null,
                user_agent: userAgent || null
            })
            .select()
            .single();
        
        if (error) {
            console.error('[Activity] Log error:', error.message);
            return { success: false, error: error.message };
        }
        
        return { success: true, activity: data };
        
    } catch (err) {
        console.error('[Activity] Log exception:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Get activity log for a project
 * @param {string} projectId 
 * @param {object} [options]
 * @param {number} [options.limit] - Max entries to return (default 50)
 * @param {number} [options.offset] - Offset for pagination
 * @param {string} [options.action] - Filter by action type
 * @param {string} [options.actorId] - Filter by actor
 * @param {string} [options.since] - ISO date string, get activities after this date
 * @returns {Promise<{success: boolean, activities?: object[], total?: number, error?: string}>}
 */
async function getProjectActivity(projectId, options = {}) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };
    
    const { limit = 50, offset = 0, action, actorId, since } = options;
    
    try {
        let query = admin
            .from('activity_log')
            .select(`
                id,
                action,
                target_type,
                target_id,
                metadata,
                created_at,
                actor_id,
                user_profiles!activity_log_actor_id_fkey (
                    username,
                    display_name,
                    avatar_url
                )
            `, { count: 'exact' })
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (action) {
            query = query.eq('action', action);
        }
        if (actorId) {
            query = query.eq('actor_id', actorId);
        }
        if (since) {
            query = query.gte('created_at', since);
        }
        
        const { data, error, count } = await query;
        
        if (error) {
            console.error('[Activity] Query error:', error.message);
            return { success: false, error: error.message };
        }
        
        // Format the response
        const activities = (data || []).map(a => ({
            id: a.id,
            action: a.action,
            target_type: a.target_type,
            target_id: a.target_id,
            metadata: a.metadata,
            created_at: a.created_at,
            actor: a.user_profiles ? {
                id: a.actor_id,
                username: a.user_profiles.username,
                display_name: a.user_profiles.display_name,
                avatar_url: a.user_profiles.avatar_url
            } : { id: a.actor_id }
        }));
        
        return { 
            success: true, 
            activities,
            total: count || 0
        };
        
    } catch (err) {
        console.error('[Activity] Query exception:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Get activity for a specific user across all their projects
 * @param {string} userId 
 * @param {object} [options]
 * @returns {Promise<{success: boolean, activities?: object[], error?: string}>}
 */
async function getUserActivity(userId, options = {}) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };
    
    const { limit = 50, offset = 0 } = options;
    
    try {
        const { data, error } = await admin
            .from('activity_log')
            .select(`
                id,
                action,
                target_type,
                target_id,
                metadata,
                created_at,
                project_id,
                projects (
                    name
                )
            `)
            .eq('actor_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        return { success: true, activities: data || [] };
        
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Helper: Extract IP and User-Agent from request
 * @param {object} req - HTTP request
 * @returns {{ipAddress: string|null, userAgent: string|null}}
 */
function extractRequestInfo(req) {
    return {
        ipAddress: req.headers['x-forwarded-for']?.split(',')[0] || 
                   req.socket?.remoteAddress || 
                   null,
        userAgent: req.headers['user-agent'] || null
    };
}

/**
 * Convenience function: Log with request info
 * @param {object} req - HTTP request
 * @param {object} params - Activity params (without ipAddress/userAgent)
 */
async function logActivityFromRequest(req, params) {
    const { ipAddress, userAgent } = extractRequestInfo(req);
    return logActivity({ ...params, ipAddress, userAgent });
}

module.exports = {
    ACTION_TYPES,
    logActivity,
    logActivityFromRequest,
    getProjectActivity,
    getUserActivity,
    extractRequestInfo
};
