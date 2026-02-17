/**
 * Purpose:
 *   Secure, token-based invitation system for adding users to projects.
 *   Tokens are generated, SHA-256 hashed, and stored; the plaintext token
 *   is returned only once for embedding in an invite link.
 *
 * Responsibilities:
 *   - Generate and store invite tokens in the `invites` table
 *   - Accept invites: validate token, check expiry/email binding, add to `project_members`
 *   - Revoke pending invites
 *   - List invites per project with optional status filter
 *   - Preview invite metadata by token (for the accept-invite UI)
 *   - Cleanup expired invites (batch status update)
 *
 * Key dependencies:
 *   - crypto: secure random token generation and SHA-256 hashing
 *   - ./client (getAdminClient): Supabase admin client for DB access
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - `createInvite` inserts into `invites`
 *   - `acceptInvite` inserts into `project_members` and updates `invites`
 *   - `cleanupExpiredInvites` bulk-updates expired pending invites
 *
 * Notes:
 *   - Only the hashed token is stored; the plaintext is returned exactly once
 *     at creation time (similar pattern to API key generation).
 *   - Email-bound invites enforce case-insensitive email matching.
 *   - Default expiry is 48 hours; configurable via `expiresInHours`.
 *   - `acceptInvite` checks for existing membership to prevent duplicates.
 *   - `getInviteByToken` joins `projects` to show the project name in the UI.
 */

const crypto = require('crypto');
const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'invites' });

/**
 * Generate a secure random token (128-bit = 16 bytes = 32 hex chars)
 * @returns {string} Hex token
 */
function generateToken() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash a token using SHA256
 * @param {string} token 
 * @returns {string} Hashed token
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new invite
 * @param {object} params
 * @param {string} params.projectId - Project UUID
 * @param {string} params.createdBy - User UUID who creates the invite
 * @param {string} params.role - Role to assign (admin, write, read)
 * @param {string} [params.email] - Optional: bind to specific email
 * @param {number} [params.expiresInHours] - Hours until expiry (default 48)
 * @returns {Promise<{success: boolean, token?: string, invite?: object, error?: string}>}
 */
async function createInvite({ projectId, createdBy, role, email, expiresInHours = 48 }) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };
    
    // Validate role
    if (!['admin', 'write', 'read'].includes(role)) {
        return { success: false, error: 'Invalid role. Must be admin, write, or read' };
    }
    
    // Generate secure token
    const token = generateToken();
    const tokenHash = hashToken(token);
    
    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    
    try {
        const { data, error } = await admin
            .from('invites')
            .insert({
                project_id: projectId,
                token_hash: tokenHash,
                email: email || null,
                role: role,
                status: 'pending',
                created_by: createdBy,
                expires_at: expiresAt.toISOString()
            })
            .select()
            .single();
        
        if (error) {
            log.error({ event: 'invites_create_error', reason: error.message }, 'Create error');
            return { success: false, error: error.message };
        }
        
        // Return the plain token (only time it's available!)
        return { 
            success: true, 
            token: token,  // Plain token for the invite link
            invite: {
                id: data.id,
                project_id: data.project_id,
                role: data.role,
                email: data.email,
                expires_at: data.expires_at,
                created_at: data.created_at
            }
        };
        
    } catch (err) {
        log.error({ event: 'invites_create_exception', reason: err.message }, 'Create exception');
        return { success: false, error: err.message };
    }
}

/**
 * Accept an invite
 * @param {string} token - Plain token from invite link
 * @param {string} userId - User UUID accepting the invite
 * @param {string} [userEmail] - User's email (for email-bound invites)
 * @returns {Promise<{success: boolean, membership?: object, error?: string}>}
 */
async function acceptInvite(token, userId, userEmail) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };
    
    const tokenHash = hashToken(token);
    
    try {
        // Find the invite
        const { data: invite, error: findError } = await admin
            .from('invites')
            .select('*')
            .eq('token_hash', tokenHash)
            .eq('status', 'pending')
            .single();
        
        if (findError || !invite) {
            return { success: false, error: 'Invalid or expired invite' };
        }
        
        // Check expiry
        if (new Date(invite.expires_at) < new Date()) {
            // Mark as expired
            await admin
                .from('invites')
                .update({ status: 'expired' })
                .eq('id', invite.id);
            return { success: false, error: 'Invite has expired' };
        }
        
        // Check email binding
        if (invite.email && invite.email.toLowerCase() !== userEmail?.toLowerCase()) {
            return { success: false, error: 'This invite is for a different email address' };
        }
        
        // Check if user is already a member
        const { data: existingMember } = await admin
            .from('project_members')
            .select('role')
            .eq('project_id', invite.project_id)
            .eq('user_id', userId)
            .single();
        
        if (existingMember) {
            return { success: false, error: 'You are already a member of this project' };
        }
        
        // Add user as project member
        const { data: membership, error: memberError } = await admin
            .from('project_members')
            .insert({
                project_id: invite.project_id,
                user_id: userId,
                role: invite.role,
                invited_by: invite.created_by
            })
            .select()
            .single();
        
        if (memberError) {
            log.error({ event: 'invites_add_member_error', reason: memberError.message }, 'Add member error');
            return { success: false, error: 'Failed to add you to the project' };
        }
        
        // Mark invite as accepted
        await admin
            .from('invites')
            .update({ 
                status: 'accepted',
                accepted_by: userId,
                accepted_at: new Date().toISOString()
            })
            .eq('id', invite.id);
        
        return { 
            success: true, 
            membership: {
                project_id: membership.project_id,
                role: membership.role,
                joined_at: membership.joined_at
            }
        };
        
    } catch (err) {
        log.error({ event: 'invites_accept_exception', reason: err.message }, 'Accept exception');
        return { success: false, error: err.message };
    }
}

/**
 * Revoke an invite
 * @param {string} inviteId - Invite UUID
 * @param {string} revokedBy - User UUID revoking
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function revokeInvite(inviteId, revokedBy) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };
    
    try {
        const { error } = await admin
            .from('invites')
            .update({ status: 'revoked' })
            .eq('id', inviteId)
            .eq('status', 'pending');
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        return { success: true };
        
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * List invites for a project
 * @param {string} projectId 
 * @param {string} [status] - Filter by status
 * @returns {Promise<{success: boolean, invites?: object[], error?: string}>}
 */
async function listInvites(projectId, status) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };
    
    try {
        let query = admin
            .from('invites')
            .select(`
                id,
                role,
                email,
                status,
                expires_at,
                created_at,
                accepted_at,
                created_by,
                accepted_by
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
        
        if (status) {
            query = query.eq('status', status);
        }
        
        const { data, error } = await query;
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        return { success: true, invites: data || [] };
        
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Get invite info by token (for preview before accepting)
 * @param {string} token 
 * @returns {Promise<{success: boolean, invite?: object, error?: string}>}
 */
async function getInviteByToken(token) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };
    
    const tokenHash = hashToken(token);
    
    try {
        const { data: invite, error } = await admin
            .from('invites')
            .select(`
                id,
                project_id,
                role,
                email,
                status,
                expires_at,
                projects (
                    id,
                    name
                )
            `)
            .eq('token_hash', tokenHash)
            .single();
        
        if (error || !invite) {
            return { success: false, error: 'Invalid invite' };
        }
        
        // Check if expired
        const isExpired = new Date(invite.expires_at) < new Date();
        
        return { 
            success: true, 
            invite: {
                id: invite.id,
                project_id: invite.project_id,
                project_name: invite.projects?.name,
                role: invite.role,
                email: invite.email,
                status: isExpired ? 'expired' : invite.status,
                expires_at: invite.expires_at,
                is_valid: invite.status === 'pending' && !isExpired
            }
        };
        
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Clean up expired invites
 * @returns {Promise<{success: boolean, cleaned?: number, error?: string}>}
 */
async function cleanupExpiredInvites() {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Database not configured' };
    
    try {
        const { data, error } = await admin
            .from('invites')
            .update({ status: 'expired' })
            .eq('status', 'pending')
            .lt('expires_at', new Date().toISOString())
            .select('id');
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        return { success: true, cleaned: data?.length || 0 };
        
    } catch (err) {
        return { success: false, error: err.message };
    }
}

module.exports = {
    generateToken,
    hashToken,
    createInvite,
    acceptInvite,
    revokeInvite,
    listInvites,
    getInviteByToken,
    cleanupExpiredInvites
};
