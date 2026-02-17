/**
 * Purpose:
 *   Role-based access control (RBAC) for multi-tenant project authorization.
 *   Defines a static permissions matrix and provides pure-function helpers to
 *   check, compare, and enforce roles across the application.
 *
 * Responsibilities:
 *   - Map action strings (e.g. 'content.edit', 'documents.upload') to allowed roles
 *   - Provide `can()`, `canAll()`, `canAny()` for permission checks in business logic
 *   - Expose role hierarchy comparisons (`isHigherRole`, `getAssignableRoles`) for
 *     safe role assignment (prevents privilege escalation)
 *   - Offer `requirePermission()` as an HTTP middleware helper that sends 403 on denial
 *
 * Key dependencies:
 *   - ./logger: Structured logging for unknown-action warnings
 *
 * Side effects:
 *   - `requirePermission()` writes HTTP 403 responses directly to `res` when denied
 *
 * Notes:
 *   - Role hierarchy: owner (4) > admin (3) > write (2) > read (1) > none (0)
 *   - The 'owner' role cannot be assigned via `getAssignableRoles()` -- ownership transfer
 *     must be handled separately
 *   - PERMISSIONS is the single source of truth; adding a new feature requires a new
 *     action key here before it can be gated anywhere else
 *   - All functions are stateless and safe to call from any context (routes, middleware, CLI)
 */

const { logger } = require('./logger');

const log = logger.child({ module: 'rbac' });

/**
 * Permission Matrix
 * Maps actions to allowed roles
 */
const PERMISSIONS = {
    // Project level
    'project.view':        ['owner', 'admin', 'write', 'read'],
    'project.edit':        ['owner', 'admin'],
    'project.delete':      ['owner'],
    'project.settings':    ['owner', 'admin'],
    'project.export':      ['owner', 'admin'],
    
    // Members management
    'members.view':        ['owner', 'admin', 'write', 'read'],
    'members.invite':      ['owner', 'admin'],
    'members.remove':      ['owner', 'admin'],
    'members.change_role': ['owner', 'admin'],
    
    // Content (facts, decisions, questions, risks, actions)
    'content.view':        ['owner', 'admin', 'write', 'read'],
    'content.create':      ['owner', 'admin', 'write'],
    'content.edit':        ['owner', 'admin', 'write'],
    'content.delete':      ['owner', 'admin'],
    
    // Documents
    'documents.view':      ['owner', 'admin', 'write', 'read'],
    'documents.upload':    ['owner', 'admin', 'write'],
    'documents.delete':    ['owner', 'admin'],
    'documents.process':   ['owner', 'admin', 'write'],
    
    // Comments
    'comments.view':       ['owner', 'admin', 'write', 'read'],
    'comments.create':     ['owner', 'admin', 'write', 'read'],
    'comments.edit_own':   ['owner', 'admin', 'write', 'read'],
    'comments.delete_own': ['owner', 'admin', 'write', 'read'],
    'comments.delete_any': ['owner', 'admin'],
    
    // History
    'history.view':        ['owner', 'admin', 'write', 'read'],
    'history.revert':      ['owner', 'admin'],
    
    // Invites
    'invites.view':        ['owner', 'admin'],
    'invites.create':      ['owner', 'admin'],
    'invites.revoke':      ['owner', 'admin'],
    
    // Activity log
    'activity.view':       ['owner', 'admin', 'write', 'read'],
    
    // Webhooks (project level)
    'webhooks.view':       ['owner'],
    'webhooks.manage':     ['owner'],
    
    // Graph DB
    'graph.view':          ['owner', 'admin', 'write', 'read'],
    'graph.query':         ['owner', 'admin', 'write'],
    'graph.sync':          ['owner', 'admin'],
    
    // Team Analysis (behavioral profiles)
    'team_analysis.view':          ['owner', 'admin'],  // Default: admin only
    'team_analysis.analyze':       ['owner', 'admin'],
    'team_analysis.config':        ['owner', 'admin'],
    'team_analysis.view_profiles': ['owner', 'admin'],
    'team_analysis.view_team':     ['owner', 'admin'],
};

/**
 * Role hierarchy (higher = more permissions)
 */
const ROLE_HIERARCHY = {
    'owner': 4,
    'admin': 3,
    'write': 2,
    'read': 1,
    'none': 0
};

/**
 * Check if a role has permission for an action
 * @param {string} userRole - User's role in the project
 * @param {string} action - Action to check
 * @returns {boolean}
 */
function can(userRole, action) {
    if (!userRole || !action) return false;
    const allowedRoles = PERMISSIONS[action];
    if (!allowedRoles) {
        log.warn({ event: 'rbac_unknown_action', action }, 'Unknown action');
        return false;
    }
    return allowedRoles.includes(userRole);
}

/**
 * Check if a role has permission for ALL specified actions
 * @param {string} userRole 
 * @param {string[]} actions 
 * @returns {boolean}
 */
function canAll(userRole, actions) {
    if (!Array.isArray(actions)) return false;
    return actions.every(action => can(userRole, action));
}

/**
 * Check if a role has permission for ANY of the specified actions
 * @param {string} userRole 
 * @param {string[]} actions 
 * @returns {boolean}
 */
function canAny(userRole, actions) {
    if (!Array.isArray(actions)) return false;
    return actions.some(action => can(userRole, action));
}

/**
 * Get all actions a role can perform
 * @param {string} userRole 
 * @returns {string[]}
 */
function getAllowedActions(userRole) {
    if (!userRole) return [];
    return Object.entries(PERMISSIONS)
        .filter(([_, roles]) => roles.includes(userRole))
        .map(([action, _]) => action);
}

/**
 * Check if roleA is higher than roleB in hierarchy
 * @param {string} roleA 
 * @param {string} roleB 
 * @returns {boolean}
 */
function isHigherRole(roleA, roleB) {
    return (ROLE_HIERARCHY[roleA] || 0) > (ROLE_HIERARCHY[roleB] || 0);
}

/**
 * Check if roleA is equal or higher than roleB
 * @param {string} roleA 
 * @param {string} roleB 
 * @returns {boolean}
 */
function isEqualOrHigherRole(roleA, roleB) {
    return (ROLE_HIERARCHY[roleA] || 0) >= (ROLE_HIERARCHY[roleB] || 0);
}

/**
 * Get role level (for comparison)
 * @param {string} role 
 * @returns {number}
 */
function getRoleLevel(role) {
    return ROLE_HIERARCHY[role] || 0;
}

/**
 * Validate role string
 * @param {string} role 
 * @returns {boolean}
 */
function isValidRole(role) {
    return role in ROLE_HIERARCHY && role !== 'none';
}

/**
 * Get all valid project roles
 * @returns {string[]}
 */
function getProjectRoles() {
    return ['owner', 'admin', 'write', 'read'];
}

/**
 * Get roles that can be assigned by a given role
 * (can only assign roles lower than your own, except owner can't be assigned)
 * @param {string} assignerRole 
 * @returns {string[]}
 */
function getAssignableRoles(assignerRole) {
    const assignerLevel = ROLE_HIERARCHY[assignerRole] || 0;
    return Object.entries(ROLE_HIERARCHY)
        .filter(([role, level]) => level < assignerLevel && role !== 'none' && role !== 'owner')
        .map(([role, _]) => role);
}

/**
 * Middleware helper: Check permission and return error response if denied.
 * Intended for use in route handlers -- call early and return if false.
 *
 * Side effect: When denied, writes a 403 JSON response to `res` and ends it,
 * so the caller must NOT write further to `res` after a false return.
 *
 * @param {object} res - HTTP response object (node http.ServerResponse or Express res)
 * @param {string} userRole - User's role in the current project
 * @param {string} action - Action to check (must exist in PERMISSIONS)
 * @param {string} [customMessage] - Custom error message override
 * @returns {boolean} true if allowed, false if denied (response already sent)
 */
function requirePermission(res, userRole, action, customMessage) {
    if (can(userRole, action)) {
        return true;
    }
    
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
        error: customMessage || `Permission denied: ${action} requires one of: ${PERMISSIONS[action]?.join(', ') || 'unknown'}`,
        required_roles: PERMISSIONS[action] || [],
        your_role: userRole || 'none'
    }));
    return false;
}

/** Ordered list of project roles (excluding 'none') */
const ROLES = ['owner', 'admin', 'write', 'read'];

module.exports = {
    // Core functions
    can,
    canAll,
    canAny,
    getAllowedActions,
    
    // Role hierarchy
    isHigherRole,
    isEqualOrHigherRole,
    getRoleLevel,
    isValidRole,
    getProjectRoles,
    getAssignableRoles,
    
    // Middleware helper
    requirePermission,
    
    // Constants (for reference)
    PERMISSIONS,
    ROLE_HIERARCHY,
    ROLES
};
