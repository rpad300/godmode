/**
 * Purpose:
 *   Wraps Supabase Auth (GoTrue) and the custom `user_profiles` table to
 *   provide registration, login, logout, password management, profile CRUD,
 *   and Express-compatible auth middleware for the application.
 *
 * Responsibilities:
 *   - Register / login / logout via Supabase Auth (email + password)
 *   - Password reset flow (request + update)
 *   - Token refresh and user retrieval from access tokens
 *   - CRUD on the `user_profiles` table (app-level profile data)
 *   - Superadmin role check and promotion
 *   - Express middleware: extractToken, requireAuth, requireSuperAdmin
 *
 * Key dependencies:
 *   - ./client (getClient, getAdminClient): public client for auth flows,
 *     admin client for profile operations that bypass RLS
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - Reads APP_URL env var for password-reset redirect URL
 *   - Writes to the Supabase `user_profiles` table (upsertUserProfile)
 *   - Sets HTTP response status/body in middleware helpers (requireAuth,
 *     requireSuperAdmin)
 *
 * Notes:
 *   - Password minimum is 12 characters; there is no complexity rule beyond
 *     length (passphrase-friendly policy).
 *   - sanitizeUser() strips sensitive Supabase fields before returning user
 *     objects to callers.
 *   - requestPasswordReset always returns success to avoid email enumeration.
 *   - extractToken checks Authorization header first, then the
 *     `sb-access-token` cookie.
 *
 * Supabase tables accessed:
 *   - user_profiles: { id (FK auth.users), username, display_name,
 *     avatar_url, role, updated_at, ... }
 */

const { getClient, getAdminClient } = require('./client');
const crypto = require('crypto');
const { logger: rootLogger, logError } = require('../logger');

const log = rootLogger.child({ module: 'auth' });

/**
 * Register a new user
 * @param {string} email 
 * @param {string} password 
 * @param {object} metadata - Additional user metadata (username, display_name)
 */
async function register(email, password, metadata = {}) {
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    
    // Validate password (min 12 chars or passphrase)
    if (!password || password.length < 12) {
        return { success: false, error: 'Password must be at least 12 characters' };
    }
    
    // Validate email
    if (!email || !email.includes('@')) {
        return { success: false, error: 'Valid email is required' };
    }
    
    // Validate username if provided
    if (metadata.username) {
        if (metadata.username.length < 3) {
            return { success: false, error: 'Username must be at least 3 characters' };
        }
        if (!/^[a-zA-Z0-9_]+$/.test(metadata.username)) {
            return { success: false, error: 'Username can only contain letters, numbers, and underscores' };
        }
    }
    
    try {
        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: metadata.username || email.split('@')[0],
                    display_name: metadata.display_name || metadata.username || email.split('@')[0]
                }
            }
        });
        
        if (error) {
            log.warn({ event: 'auth_register_failed', reason: error.message }, 'Registration failed');
            return { success: false, error: error.message };
        }
        
        // If email confirmation is required
        if (data.user && !data.session) {
            return { 
                success: true, 
                user: sanitizeUser(data.user),
                needsEmailVerification: true,
                message: 'Please check your email to verify your account'
            };
        }
        
        return { 
            success: true, 
            user: sanitizeUser(data.user),
            session: data.session,
            needsEmailVerification: false
        };
        
    } catch (err) {
        logError(err, { module: 'auth', event: 'auth_register_error' });
        return { success: false, error: err.message };
    }
}

/**
 * Authenticate with email + password via Supabase Auth.
 *
 * On success, fetches the user's profile from `user_profiles` and returns
 * a sanitized user object along with session tokens. The raw Supabase
 * error message is intentionally hidden behind a generic "Invalid email
 * or password" to prevent information leakage.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, user?: object, session?: object, error?: string}>}
 *   session shape: { access_token, refresh_token, expires_at }
 */
async function login(email, password) {
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    
    if (!email || !password) {
        return { success: false, error: 'Email and password are required' };
    }
    
    try {
        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            log.warn({ event: 'auth_login_failed', provider: 'password', reason: error.message }, 'Login failed');
            return { success: false, error: 'Invalid email or password' };
        }
        
        // Get user profile from our table
        const profile = await getUserProfile(data.user.id);
        
        return { 
            success: true, 
            user: {
                ...sanitizeUser(data.user),
                profile: profile
            },
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at
            }
        };
        
    } catch (err) {
        logError(err, { module: 'auth', event: 'auth_login_error' });
        return { success: false, error: 'Login failed' };
    }
}

/**
 * Sign out the current session. Always returns success even if the
 * Supabase signOut call fails, because the client-side token should be
 * discarded regardless.
 *
 * @param {string} [accessToken] - Currently unused by Supabase JS client
 * @returns {Promise<{success: true}>}
 */
async function logout(accessToken) {
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    
    try {
        const { error } = await client.auth.signOut();
        if (error) {
            log.warn({ event: 'auth_logout_failed', reason: error.message }, 'Logout error');
        }
        return { success: true };
    } catch (err) {
        // Still consider logout successful even if error
        return { success: true };
    }
}

/**
 * Request a password-reset email. Always returns success to prevent
 * email enumeration attacks.
 *
 * The redirect URL is built from APP_URL env var (defaults to
 * http://localhost:3005).
 *
 * @param {string} email
 * @returns {Promise<{success: true, message: string}>}
 */
async function requestPasswordReset(email) {
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    
    if (!email) {
        return { success: false, error: 'Email is required' };
    }
    
    try {
        const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.APP_URL || 'http://localhost:3005'}/reset-password`
        });
        
        if (error) {
            log.warn({ event: 'auth_password_reset_failed', reason: error.message }, 'Password reset error');
        }
        
        return { 
            success: true, 
            message: 'If an account exists with this email, you will receive a password reset link'
        };
        
    } catch (err) {
        logError(err, { module: 'auth', event: 'auth_password_reset_error' });
        return { success: true, message: 'Password reset email sent if account exists' };
    }
}

/**
 * Update password (when logged in or with reset token)
 */
async function updatePassword(newPassword, accessToken) {
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    
    if (!newPassword || newPassword.length < 12) {
        return { success: false, error: 'Password must be at least 12 characters' };
    }
    
    try {
        // Set session from token if provided
        if (accessToken) {
            await client.auth.setSession({ access_token: accessToken });
        }
        
        const { error } = await client.auth.updateUser({
            password: newPassword
        });
        
        if (error) {
            log.warn({ event: 'auth_update_password_failed', reason: error.message }, 'Update password failed');
            return { success: false, error: error.message };
        }
        
        return { success: true, message: 'Password updated successfully' };
        
    } catch (err) {
        logError(err, { module: 'auth', event: 'auth_update_password_error' });
        return { success: false, error: err.message };
    }
}

/**
 * Get current user from access token
 */
async function getUser(accessToken) {
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    
    if (!accessToken) {
        return { success: false, error: 'Access token required' };
    }
    
    try {
        const { data, error } = await client.auth.getUser(accessToken);
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        // Get user profile
        const profile = await getUserProfile(data.user.id);
        
        return { 
            success: true, 
            user: {
                ...sanitizeUser(data.user),
                profile: profile
            }
        };
        
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Refresh access token
 */
async function refreshToken(refreshToken) {
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    
    try {
        const { data, error } = await client.auth.refreshSession({
            refresh_token: refreshToken
        });
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        return { 
            success: true, 
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at
            }
        };
        
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Fetch the user's application-level profile from the `user_profiles` table.
 *
 * Uses the admin client to bypass RLS. Returns null (instead of throwing)
 * if the table does not exist yet (PGRST116) or if no row is found, so
 * callers can safely merge a potentially null profile.
 *
 * @param {string} userId - Supabase auth.users UUID
 * @returns {Promise<object|null>} Profile row or null
 */
async function getUserProfile(userId) {
    const admin = getAdminClient();
    if (!admin) return null;
    
    try {
        // Try to get existing profile
        const { data: profile, error } = await admin
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error && error.code === 'PGRST116') {
            // Table doesn't exist yet - that's ok
            return null;
        }
        
        if (profile) {
            return profile;
        }
        
        return null;
        
    } catch (err) {
        log.warn({ event: 'auth_get_profile_error', reason: err.message }, 'Get profile error');
        return null;
    }
}

/**
 * Create or update user profile
 */
async function upsertUserProfile(userId, profileData) {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: 'Admin client not configured' };
    
    try {
        const { data, error } = await admin
            .from('user_profiles')
            .upsert({
                id: userId,
                ...profileData,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'id'
            })
            .select()
            .single();
        
        if (error) {
            log.warn({ event: 'auth_upsert_profile_failed', reason: error.message }, 'Upsert profile failed');
            return { success: false, error: error.message };
        }
        
        return { success: true, profile: data };
        
    } catch (err) {
        logError(err, { module: 'auth', event: 'auth_upsert_profile_error' });
        return { success: false, error: err.message };
    }
}

/**
 * Check if user is superadmin
 */
async function isSuperAdmin(userId) {
    const profile = await getUserProfile(userId);
    return profile?.role === 'superadmin';
}

/**
 * Make user superadmin (admin only)
 */
async function makeSuperAdmin(userId) {
    return await upsertUserProfile(userId, { role: 'superadmin' });
}

/**
 * Sanitize user object for response (remove sensitive data)
 */
function sanitizeUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        user_metadata: user.user_metadata
    };
}

/**
 * Extract a Bearer token from the request. Checks the `Authorization`
 * header first, then falls back to the `sb-access-token` cookie.
 *
 * @param {object} req - HTTP request with `headers` property
 * @returns {string|null} JWT access token or null
 */
function extractToken(req) {
    const authHeader = req.headers['authorization'];
    if (authHeader && /^bearer\s+/i.test(authHeader)) {
        return authHeader.replace(/^bearer\s+/i, '').trim();
    }
    // Also check cookie
    const cookies = req.headers['cookie'];
    if (cookies) {
        const match = cookies.match(/sb-access-token=([^;]+)/);
        if (match) return match[1];
    }
    return null;
}

/**
 * Verify request authentication and return user info
 * @param {object} req - HTTP request object
 * @returns {object} { authenticated: boolean, user?: object }
 */
async function verifyRequest(req) {
    const token = extractToken(req);
    
    if (!token) {
        return { authenticated: false };
    }
    
    const result = await getUser(token);
    
    if (!result.success) {
        return { authenticated: false };
    }
    
    return { authenticated: true, user: result.user };
}

/**
 * Middleware: Require authentication
 * Adds req.user if authenticated
 */
async function requireAuth(req, res, next) {
    const token = extractToken(req);
    
    if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authentication required' }));
        return false;
    }
    
    const result = await getUser(token);
    
    if (!result.success) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or expired token' }));
        return false;
    }
    
    req.user = result.user;
    return true;
}

/**
 * Middleware: Require superadmin
 */
async function requireSuperAdmin(req, res, next) {
    const authed = await requireAuth(req, res, next);
    if (!authed) return false;
    
    if (req.user.profile?.role !== 'superadmin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Super admin access required' }));
        return false;
    }
    
    return true;
}

module.exports = {
    register,
    login,
    logout,
    requestPasswordReset,
    updatePassword,
    getUser,
    refreshToken,
    getUserProfile,
    upsertUserProfile,
    isSuperAdmin,
    makeSuperAdmin,
    extractToken,
    verifyRequest,
    requireAuth,
    requireSuperAdmin
};
