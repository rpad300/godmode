/**
 * Supabase Auth Module
 * Handles user authentication, registration, password reset
 */

const { getClient, getAdminClient } = require('./client');
const crypto = require('crypto');

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
            console.error('[Auth] Registration error:', error.message);
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
        console.error('[Auth] Registration exception:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Login with email and password
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
            console.error('[Auth] Login error:', error.message);
            // Don't reveal if email exists
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
        console.error('[Auth] Login exception:', err.message);
        return { success: false, error: 'Login failed' };
    }
}

/**
 * Logout (invalidate session)
 */
async function logout(accessToken) {
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    
    try {
        const { error } = await client.auth.signOut();
        if (error) {
            console.error('[Auth] Logout error:', error.message);
        }
        return { success: true };
    } catch (err) {
        // Still consider logout successful even if error
        return { success: true };
    }
}

/**
 * Request password reset
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
            console.error('[Auth] Update password error:', error.message);
            return { success: false, error: error.message };
        }
        
        return { success: true, message: 'Password updated successfully' };
        
    } catch (err) {
        console.error('[Auth] Update password exception:', err.message);
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
 * Get or create user profile in our user_profiles table
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
        console.error('[Auth] Get profile error:', err.message);
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
 * Middleware helper: Extract token from request
 */
function extractToken(req) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
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
