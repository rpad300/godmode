/**
 * Secure Invites Module
 * Handles project invitations with secure tokens
 */

const crypto = require('crypto');

function getClients() {
    return require('./client');
}

/**
 * Generate a secure random token (256-bit = 32 bytes = 64 hex chars)
 * @returns {string} Hex token
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
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
    const { getAdminClient } = getClients();
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Supabase not configured' };
    
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
            console.error('[Invites] Create error:', error.message);
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
        console.error('[Invites] Create exception:', err.message);
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
    const { getAdminClient } = getClients();
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Supabase not configured' };
    
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
            console.error('[Invites] Add member error:', memberError.message);
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
        console.error('[Invites] Accept exception:', err.message);
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
    const { getAdminClient } = getClients();
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Supabase not configured' };
    
    try {
        const { error } = await admin
            .from('invites')
            .delete()
            .eq('id', inviteId);
        
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
    const { getAdminClient } = getClients();
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Supabase not configured' };
    
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
    const { getAdminClient } = getClients();
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Supabase not configured' };
    
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
    const { getAdminClient } = getClients();
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Supabase not configured' };
    
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
