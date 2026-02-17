/**
 * Purpose:
 *   User profile management API routes. Covers profile CRUD, avatar upload/removal,
 *   session management, password changes, activity history, and account deletion.
 *   Also handles the /api/user/profile legacy endpoints.
 *
 * Responsibilities:
 *   - GET/PUT /api/user/profile: Legacy profile read/update (Supabase user API style)
 *   - GET /api/profile: Full profile with merged auth user data and user_profiles table
 *   - PUT /api/profile: Update profile fields (display_name, username, avatar_url, etc.)
 *   - GET /api/profile/sessions: List active sessions (currently returns only current session)
 *   - DELETE /api/profile/sessions/:id: Revoke a specific session (stub -- Supabase manages sessions)
 *   - POST /api/profile/sessions/revoke-all: Sign out and revoke all sessions
 *   - POST /api/profile/avatar: Upload avatar image to Supabase Storage ("avatars" bucket)
 *   - DELETE /api/profile/avatar: Remove avatar from storage and clear profile URL
 *   - GET /api/profile/activity: User activity feed with configurable limit
 *   - POST /api/profile/change-password: Change password using current session token
 *   - POST /api/profile/delete: Account deletion placeholder (returns error, requires support)
 *
 * Key dependencies:
 *   - supabase.auth: verifyRequest, getUserProfile, upsertUserProfile, updatePassword,
 *     extractToken, getUser, logout
 *   - supabase.activity: getUserActivity for activity feed
 *   - supabase.getAdminClient: Supabase admin client for storage operations (avatar bucket)
 *
 * Side effects:
 *   - Database: updates user_profiles table
 *   - Supabase Storage: uploads/deletes files in the "avatars" bucket; auto-creates bucket
 *     if it does not exist
 *   - Auth: signs out user on revoke-all, updates password on change-password
 *
 * Notes:
 *   - Two profile endpoint families exist (/api/user/profile and /api/profile) for
 *     backward compatibility; /api/user/profile uses extractToken+getUser, while
 *     /api/profile uses the newer verifyRequest flow
 *   - Avatar upload uses a simplified multipart parser that extracts the first file part;
 *     it does not use the shared parseMultipart utility
 *   - Session listing is limited to the current session only (Supabase does not expose
 *     all sessions via its public API)
 *   - Avatar deletion tries all common image extensions since the stored extension is unknown
 *   - Account deletion is not implemented; it returns a 400 instructing users to contact support
 */

const { parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');
const { getClientIp } = require('../../server/middleware');

/**
 * Handle profile routes
 * @param {object} ctx - Context object with req, res, pathname, parsedUrl, supabase
 * @returns {Promise<boolean>} - true if handled, false if not a profile route
 */
async function handleProfile(ctx) {
    const { req, res, pathname, parsedUrl, supabase } = ctx;
    const log = getLogger().child({ module: 'profile' });
    // GET /api/user/profile - Get current user profile (Supabase user API)
    if (pathname === '/api/user/profile' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        const profileResult = await supabase.auth.getUserProfile(userResult.user.id);
        jsonResponse(res, { user: userResult.user, profile: profileResult.success ? profileResult.profile : null });
        return true;
    }

    // PUT /api/user/profile - Update current user profile (Supabase user API)
    if (pathname === '/api/user/profile' && req.method === 'PUT') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        const body = await parseBody(req);
        const result = await supabase.auth.upsertUserProfile(userResult.user.id, {
            username: body.username,
            display_name: body.display_name,
            avatar_url: body.avatar_url
        });
        if (result.success) jsonResponse(res, { success: true, profile: result.profile });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // Only handle /api/profile routes
    if (!pathname.startsWith('/api/profile')) {
        return false;
    }

    // GET /api/profile - Get current user profile
    if (pathname === '/api/profile' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Not authenticated' }, 401);
            return true;
        }
        
        const profile = await supabase.auth.getUserProfile(authResult.user.id);
        
        // Always include email from auth user (not stored in user_profiles)
        const fullProfile = {
            ...(profile || {}),
            id: authResult.user.id,
            email: authResult.user.email,
            display_name: profile?.display_name || authResult.user.email?.split('@')[0] || 'User',
            created_at: profile?.created_at || authResult.user.created_at || new Date().toISOString()
        };
        
        jsonResponse(res, { profile: fullProfile });
        return true;
    }
    
    // PUT /api/profile - Update current user profile
    if (pathname === '/api/profile' && req.method === 'PUT') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Not authenticated' }, 401);
            return true;
        }
        
        const body = await parseBody(req);
        const result = await supabase.auth.upsertUserProfile(authResult.user.id, body);
        
        if (result.success) {
            jsonResponse(res, { profile: result.profile });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // GET /api/profile/sessions - Get user sessions
    if (pathname === '/api/profile/sessions' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Not authenticated' }, 401);
            return true;
        }
        
        // Return current session info (Supabase doesn't expose all sessions via API)
        jsonResponse(res, { 
            sessions: [{
                id: 'current',
                device: req.headers['user-agent'] || 'Unknown',
                ip_address: req.socket?.remoteAddress || 'Unknown',
                location: null,
                last_active: new Date().toISOString(),
                is_current: true
            }]
        });
        return true;
    }
    
    // DELETE /api/profile/sessions/:id - Revoke a session
    if (pathname.match(/^\/api\/profile\/sessions\/([^/]+)$/) && req.method === 'DELETE') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Not authenticated' }, 401);
            return true;
        }
        
        // Supabase manages sessions internally
        jsonResponse(res, { success: true });
        return true;
    }
    
    // POST /api/profile/sessions/revoke-all - Revoke all sessions
    if (pathname === '/api/profile/sessions/revoke-all' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Not authenticated' }, 401);
            return true;
        }
        
        // Sign out user (revokes current session)
        await supabase.auth.logout();
        jsonResponse(res, { success: true });
        return true;
    }
    
    // POST /api/profile/avatar - Upload avatar
    if (pathname === '/api/profile/avatar' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Not authenticated' }, 401);
            return true;
        }
        
        try {
            // Parse multipart form data
            const boundary = req.headers['content-type']?.split('boundary=')[1];
            if (!boundary) {
                jsonResponse(res, { error: 'Invalid content type' }, 400);
                return true;
            }
            
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            
            // Parse the multipart data (simplified - extract file data)
            const data = buffer.toString('binary');
            const parts = data.split('--' + boundary);
            
            let fileBuffer = null;
            let fileName = 'avatar.jpg';
            let contentType = 'image/jpeg';
            
            for (const part of parts) {
                if (part.includes('filename=')) {
                    const match = part.match(/filename="([^"]+)"/);
                    if (match) fileName = match[1];
                    
                    const typeMatch = part.match(/Content-Type:\s*([^\r\n]+)/i);
                    if (typeMatch) contentType = typeMatch[1].trim();
                    
                    // Extract file content (after double CRLF)
                    const contentStart = part.indexOf('\r\n\r\n') + 4;
                    const contentEnd = part.lastIndexOf('\r\n');
                    if (contentStart > 3 && contentEnd > contentStart) {
                        fileBuffer = Buffer.from(part.substring(contentStart, contentEnd), 'binary');
                    }
                }
            }
            
            if (!fileBuffer) {
                jsonResponse(res, { error: 'No file uploaded' }, 400);
                return true;
            }
            
            // Upload to Supabase Storage
            const userId = authResult.user.id;
            const ext = fileName.split('.').pop() || 'jpg';
            const storagePath = `avatars/${userId}.${ext}`;
            
            const client = supabase.getAdminClient();
            
            // Upload to storage bucket (create bucket if needed)
            const { data: uploadData, error: uploadError } = await client.storage
                .from('avatars')
                .upload(storagePath, fileBuffer, {
                    contentType,
                    upsert: true
                });
            
            if (uploadError) {
                // Try creating bucket first
                if (uploadError.message.includes('not found')) {
                    await client.storage.createBucket('avatars', { public: true });
                    const { error: retryError } = await client.storage
                        .from('avatars')
                        .upload(storagePath, fileBuffer, { contentType, upsert: true });
                    if (retryError) throw retryError;
                } else {
                    throw uploadError;
                }
            }
            
            // Get public URL
            const { data: urlData } = client.storage
                .from('avatars')
                .getPublicUrl(storagePath);
            
            const avatarUrl = urlData.publicUrl;
            
            // Update user profile with avatar URL
            await supabase.auth.upsertUserProfile(userId, { avatar_url: avatarUrl });
            
            jsonResponse(res, { avatar_url: avatarUrl });
        } catch (error) {
            log.warn({ event: 'profile_avatar_upload_error', reason: error.message }, 'Avatar upload error');
            jsonResponse(res, { error: 'Avatar upload failed: ' + error.message }, 500);
        }
        return true;
    }
    
    // DELETE /api/profile/avatar - Remove avatar
    if (pathname === '/api/profile/avatar' && req.method === 'DELETE') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Not authenticated' }, 401);
            return true;
        }
        
        try {
            const userId = authResult.user.id;
            const client = supabase.getAdminClient();
            
            // Delete from storage (try common extensions)
            for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp']) {
                try {
                    await client.storage.from('avatars').remove([`avatars/${userId}.${ext}`]);
                } catch (e) {
                    // Ignore errors - file might not exist
                }
            }
            
            // Clear avatar URL in profile
            await supabase.auth.upsertUserProfile(userId, { avatar_url: null });
            
            jsonResponse(res, { success: true });
        } catch (error) {
            log.warn({ event: 'profile_avatar_delete_error', reason: error.message }, 'Avatar delete error');
            jsonResponse(res, { error: 'Failed to remove avatar' }, 500);
        }
        return true;
    }
    
    // GET /api/profile/activity - Get user activity
    if (pathname === '/api/profile/activity' && req.method === 'GET') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Not authenticated' }, 401);
            return true;
        }
        
        // Get activity from Supabase
        const limit = parseInt(parsedUrl.query.limit || '20');
        const activity = await supabase.activity.getUserActivity(authResult.user.id, { limit });
        
        jsonResponse(res, { activity: activity || [] });
        return true;
    }
    
    // POST /api/profile/change-password - Change password
    if (pathname === '/api/profile/change-password' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Not authenticated' }, 401);
            return true;
        }
        
        const body = await parseBody(req);
        const token = supabase.auth.extractToken(req);
        const result = await supabase.auth.updatePassword(body.new_password, token);
        
        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            jsonResponse(res, { error: result.error }, 400);
        }
        return true;
    }
    
    // POST /api/profile/delete - Delete account
    if (pathname === '/api/profile/delete' && req.method === 'POST') {
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Authentication not configured' }, 503);
            return true;
        }
        
        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Not authenticated' }, 401);
            return true;
        }
        
        // Account deletion requires admin privileges - for now just return error
        jsonResponse(res, { error: 'Account deletion requires contacting support' }, 400);
        return true;
    }

    // Not a profile route we handle
    return false;
}

module.exports = {
    handleProfile
};
