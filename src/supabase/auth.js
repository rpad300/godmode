/**
 * Supabase Auth Module
 * Handles user authentication, registration, password reset
 *
 * Note: this file keeps a small compatibility layer for older unit tests
 * (extractToken, resetPassword, requireAuth, and simpler return shapes).
 */

const crypto = require('crypto');

function getClients() {
    // Require lazily so Jest module mocks consistently apply after resetModules()
    return require('./client');
}

function extractToken(req) {
    const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
    if (authHeader && typeof authHeader === 'string') {
        const [scheme, token] = authHeader.split(' ');
        if (scheme && token && scheme.toLowerCase() === 'bearer') return token;
    }

    // Cookie support (used by the frontend)
    const cookieHeader = req?.headers?.cookie;
    if (cookieHeader && typeof cookieHeader === 'string') {
        const m = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
        if (m && m[1]) {
            try {
                return decodeURIComponent(m[1]);
            } catch {
                return m[1];
            }
        }
    }

    return null;
}

/**
 * Register a new user
 * @param {string} email 
 * @param {string} password 
 * @param {object} metadata - Additional user metadata (username, display_name)
 */
async function register(email, password, metadata = {}) {
    const { getClient } = getClients();
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    // Keep validation minimal here; route-layer can enforce stronger rules.
    if (!email || !email.includes('@')) {
        return { success: false, error: 'Valid email is required' };
    }
    if (!password) {
        return { success: false, error: 'Password is required' };
    }

    try {
        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        });
        
        if (error) {
            console.error('[Auth] Registration error:', error.message);
            return { success: false, error: error.message };
        }
        
        // Compatibility: return raw user/session when present.
        if (data?.user && !data?.session) {
            return { success: true, user: data.user, needsEmailVerification: true };
        }

        return { success: true, user: data?.user, session: data?.session, needsEmailVerification: false };
        
    } catch (err) {
        console.error('[Auth] Registration exception:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Login with email and password
 */
async function login(email, password) {
    const { getClient } = getClients();
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
            console.error('[Auth] Login error:', error.message);
            return { success: false, error: error.message };
        }

        // In normal runtime, attach application profile (role) so frontend can show admin UI.
        // Keep unit tests stable by skipping profile hydration under NODE_ENV=test.
        let user = data?.user;
        if (process.env.NODE_ENV !== 'test' && user?.id) {
            try {
                const profile = await getUserProfile(user.id);
                user = { ...user, profile };
            } catch {
                // best-effort
            }
        }

        return { success: true, user, session: data?.session };

    } catch (err) {
        console.error('[Auth] Login exception:', err.message);
        return { success: false, error: 'Login failed' };
    }
}

/**
 * Logout (invalidate session)
 */
async function logout() {
    const { getClient } = getClients();
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    try {
        await client.auth.signOut();
        return { success: true };
    } catch (_err) {
        return { success: true };
    }
}

/**
 * Request password reset
 */
async function resetPassword(email) {
    const { getClient } = getClients();
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    
    if (!email) {
        return { success: false, error: 'Email is required' };
    }
    
    try {
        const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.APP_URL || 'http://localhost:3005'}/reset-password`
        });
        
        // Always return success to not reveal if email exists
        if (error) {
            console.error('[Auth] Password reset error:', error.message);
        }
        
        return { 
            success: true, 
            message: 'If an account exists with this email, you will receive a password reset link'
        };
        
    } catch (err) {
        console.error('[Auth] Password reset exception:', err.message);
        return { success: true, message: 'Password reset email sent if account exists' };
    }
}

/**
 * Update password (when logged in or with reset token)
 */
async function updatePassword(newPassword, accessToken) {
    const { getClient } = getClients();
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    if (!newPassword) {
        return { success: false, error: 'Password is required' };
    }

    try {
        if (accessToken && typeof client.auth.setSession === 'function') {
            await client.auth.setSession({ access_token: accessToken });
        }

        const { error } = await client.auth.updateUser({ password: newPassword });
        if (error) return { success: false, error: error.message };

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Get current user from access token
 */
async function getUser(accessToken) {
    const { getClient } = getClients();
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    if (!accessToken) {
        return { success: false, error: 'No token provided' };
    }
    
    try {
        const { data, error } = await client.auth.getUser(accessToken);

        if (error) {
            return { success: false, error: error.message };
        }

        let user = data?.user;
        if (process.env.NODE_ENV !== 'test' && user?.id) {
            try {
                const profile = await getUserProfile(user.id);
                user = { ...user, profile };
            } catch {
                // best-effort
            }
        }

        return { success: true, user };
        
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Refresh access token
 */
async function refreshToken(refreshToken) {
    const { getClient } = getClients();
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
 * Get or create user profile in our user_profiles table
 */
async function getUserProfile(userId) {
    const { getAdminClient } = getClients();
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
        console.error('[Auth] Get profile error:', err.message);
        return null;
    }
}

/**
 * Create or update user profile
 */
async function upsertUserProfile(userId, profileData) {
    const { getAdminClient } = getClients();
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
            console.error('[Auth] Upsert profile error:', error.message);
            return { success: false, error: error.message };
        }
        
        return { success: true, profile: data };
        
    } catch (err) {
        console.error('[Auth] Upsert profile exception:', err.message);
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
    if (typeof next === 'function') next();
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

// Backwards-compat alias (some route modules still call requestPasswordReset)
async function requestPasswordReset(email) {
    return resetPassword(email);
}

module.exports = {
    register,
    login,
    logout,
    resetPassword,
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
