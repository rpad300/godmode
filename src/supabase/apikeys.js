/**
 * API Keys Module
 * Manages API keys for programmatic project access
 */

const crypto = require('crypto');
const { getAdminClient } = require('./client');

// Key prefix for identification
const KEY_PREFIX = 'gm_live_';
const KEY_LENGTH = 32;  // 256 bits

// Available permissions
const PERMISSIONS = {
    READ: 'read',
    WRITE: 'write',
    DELETE: 'delete',
    ADMIN: 'admin'
};

/**
 * Generate a new API key
 * Returns both the full key (to show once) and the hash (to store)
 */
function generateApiKey() {
    const randomBytes = crypto.randomBytes(KEY_LENGTH);
    const key = KEY_PREFIX + randomBytes.toString('base64url');
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    
    return {
        key,                                    // Full key - show to user ONCE
        prefix: key.substring(0, 12),           // For identification
        hash                                    // Store this
    };
}

/**
 * Hash an API key for lookup
 */
function hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Create a new API key
 */
async function createApiKey({
    projectId,
    createdBy,
    name,
    description = null,
    permissions = ['read'],
    rateLimitPerMinute = 60,
    rateLimitPerDay = 10000,
    expiresAt = null
}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Generate key
        const { key, prefix, hash } = generateApiKey();

        // Create record
        const { data: apiKey, error } = await supabase
            .from('api_keys')
            .insert({
                project_id: projectId,
                created_by: createdBy,
                name,
                description,
                key_prefix: prefix,
                key_hash: hash,
                permissions,
                rate_limit_per_minute: rateLimitPerMinute,
                rate_limit_per_day: rateLimitPerDay,
                expires_at: expiresAt
            })
            .select()
            .single();

        if (error) throw error;

        // Return the full key only once
        return {
            success: true,
            apiKey: {
                ...apiKey,
                key  // IMPORTANT: This is the only time the full key is available
            }
        };
    } catch (error) {
        console.error('[API Keys] Create error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Validate an API key and return its details
 */
async function validateApiKey(key) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const hash = hashApiKey(key);

        const { data: apiKey, error } = await supabase
            .from('api_keys')
            .select(`
                *,
                project:projects!project_id(id, name)
            `)
            .eq('key_hash', hash)
            .eq('is_active', true)
            .single();

        if (error || !apiKey) {
            return { success: false, error: 'Invalid API key' };
        }

        // Check expiration
        if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
            return { success: false, error: 'API key expired' };
        }

        // Update last used
        await supabase
            .from('api_keys')
            .update({
                last_used_at: new Date().toISOString(),
                total_requests: apiKey.total_requests + 1
            })
            .eq('id', apiKey.id);

        return { success: true, apiKey };
    } catch (error) {
        console.error('[API Keys] Validate error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Check if API key has specific permission
 */
function hasPermission(apiKey, permission) {
    if (!apiKey || !apiKey.permissions) return false;
    
    // Admin has all permissions
    if (apiKey.permissions.includes(PERMISSIONS.ADMIN)) return true;
    
    return apiKey.permissions.includes(permission);
}

/**
 * List API keys for a project
 */
async function listApiKeys(projectId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: keys, error } = await supabase
            .from('api_keys')
            .select(`
                id, name, description, key_prefix, permissions,
                rate_limit_per_minute, rate_limit_per_day,
                is_active, expires_at, last_used_at, total_requests,
                created_at, revoked_at,
                creator:user_profiles!created_by(id, username, display_name)
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { success: true, keys: keys || [] };
    } catch (error) {
        console.error('[API Keys] List error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Revoke an API key
 */
async function revokeApiKey(keyId, revokedBy) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { error } = await supabase
            .from('api_keys')
            .update({
                is_active: false,
                revoked_at: new Date().toISOString(),
                revoked_by: revokedBy
            })
            .eq('id', keyId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('[API Keys] Revoke error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update API key settings
 */
async function updateApiKey(keyId, updates) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    const allowedFields = ['name', 'description', 'permissions', 'rate_limit_per_minute', 'rate_limit_per_day', 'expires_at'];
    const filteredUpdates = {};
    
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
        }
    }

    try {
        const { data: apiKey, error } = await supabase
            .from('api_keys')
            .update(filteredUpdates)
            .eq('id', keyId)
            .select()
            .single();

        if (error) throw error;

        return { success: true, apiKey };
    } catch (error) {
        console.error('[API Keys] Update error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Log API key usage
 */
async function logUsage(apiKeyId, endpoint, method, statusCode, responseTimeMs, ipAddress, userAgent) {
    const supabase = getAdminClient();
    if (!supabase) return;

    try {
        await supabase
            .from('api_key_usage')
            .insert({
                api_key_id: apiKeyId,
                endpoint,
                method,
                status_code: statusCode,
                response_time_ms: responseTimeMs,
                ip_address: ipAddress,
                user_agent: userAgent
            });
    } catch (error) {
        console.error('[API Keys] Log usage error:', error);
    }
}

/**
 * Get API key usage stats
 */
async function getUsageStats(apiKeyId, days = 7) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const { data: usage, error } = await supabase
            .from('api_key_usage')
            .select('endpoint, method, status_code, response_time_ms, created_at')
            .eq('api_key_id', apiKeyId)
            .gte('created_at', since.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Calculate stats
        const stats = {
            totalRequests: usage?.length || 0,
            successfulRequests: usage?.filter(u => u.status_code >= 200 && u.status_code < 400).length || 0,
            failedRequests: usage?.filter(u => u.status_code >= 400).length || 0,
            avgResponseTime: usage?.length > 0 
                ? Math.round(usage.reduce((sum, u) => sum + (u.response_time_ms || 0), 0) / usage.length)
                : 0,
            endpointBreakdown: {},
            dailyBreakdown: {}
        };

        // Endpoint breakdown
        for (const u of usage || []) {
            const key = `${u.method} ${u.endpoint}`;
            stats.endpointBreakdown[key] = (stats.endpointBreakdown[key] || 0) + 1;
        }

        return { success: true, stats };
    } catch (error) {
        console.error('[API Keys] Get stats error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Middleware to authenticate API key requests
 */
async function authenticateApiKey(req) {
    // Check for API key in header
    const authHeader = req.headers['authorization'] || req.headers['x-api-key'];
    
    if (!authHeader) {
        return { success: false, error: 'API key required' };
    }

    // Extract key (support "Bearer KEY" or just "KEY")
    const key = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;

    // Validate
    const result = await validateApiKey(key);
    
    if (result.success) {
        // Log usage
        const startTime = req._startTime || Date.now();
        req.apiKey = result.apiKey;
        
        // Note: Response logging should be done after response is sent
    }

    return result;
}

module.exports = {
    PERMISSIONS,
    generateApiKey,
    hashApiKey,
    createApiKey,
    validateApiKey,
    hasPermission,
    listApiKeys,
    revokeApiKey,
    updateApiKey,
    logUsage,
    getUsageStats,
    authenticateApiKey
};
