/**
 * Supabase Client Module
 * Provides both client (anon) and admin (service_role) clients
 */

const path = require('path');

// Fix module resolution when project folder is named "node_modules"
const projectNodeModules = path.join(__dirname, '..', '..', 'node_modules');
if (!process.env.NODE_PATH || !process.env.NODE_PATH.includes(projectNodeModules)) {
    process.env.NODE_PATH = process.env.NODE_PATH 
        ? `${process.env.NODE_PATH}${path.delimiter}${projectNodeModules}`
        : projectNodeModules;
    require('module').Module._initPaths();
}

const { createClient } = require('@supabase/supabase-js');

let clientInstance = null;
let adminInstance = null;

/**
 * Get environment variables (lazy loading to ensure .env is loaded first)
 */
function getEnvVars() {
    return {
        url: process.env.SUPABASE_PROJECT_URL,
        anonKey: process.env.SUPABASE_PROJECT_ANON_KEY,
        serviceKey: process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY
    };
}

/**
 * Get the public Supabase client (uses anon key, respects RLS)
 * Use for: user-facing operations
 */
function getClient() {
    // Test override hook (avoids brittle Jest module path mocking)
    if (global.__SUPABASE_CLIENT_MOCK__) return global.__SUPABASE_CLIENT_MOCK__;

    if (!clientInstance) {
        const { url, anonKey } = getEnvVars();
        if (!url || !anonKey) {
            console.warn('[Supabase] Missing SUPABASE_PROJECT_URL or SUPABASE_PROJECT_ANON_KEY');
            return null;
        }
        clientInstance = createClient(url, anonKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: false, // Server-side: don't persist
                detectSessionInUrl: false
            }
        });
        console.log('[Supabase] Client initialized');
    }
    return clientInstance;
}

/**
 * Get the admin Supabase client (uses service_role key, bypasses RLS)
 * Use for: admin operations, migrations, seeding
 * CAUTION: Never expose this to frontend
 */
function getAdminClient() {
    // Test override hook (avoids brittle Jest module path mocking)
    if (global.__SUPABASE_ADMIN_CLIENT_MOCK__) return global.__SUPABASE_ADMIN_CLIENT_MOCK__;

    if (!adminInstance) {
        const { url, serviceKey } = getEnvVars();
        if (!url || !serviceKey) {
            console.warn('[Supabase] Missing SUPABASE_PROJECT_URL or SUPABASE_PROJECT_SERVICE_ROLE_KEY');
            return null;
        }
        adminInstance = createClient(url, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        console.log('[Supabase] Admin client initialized');
    }
    return adminInstance;
}

/**
 * Check if Supabase is configured
 */
function isConfigured() {
    const { url, anonKey } = getEnvVars();
    return !!(url && anonKey);
}

/**
 * Test connection to Supabase
 */
async function testConnection() {
    const client = getClient();
    if (!client) return { success: false, error: 'Client not configured' };
    
    try {
        // Simple query to test connection
        const { data, error } = await client.from('user_profiles').select('count').limit(0);
        if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist (ok for first run)
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Get Supabase configuration info (safe for logging)
 */
function getConfigInfo() {
    const { url, anonKey, serviceKey } = getEnvVars();
    return {
        url: url || 'not set',
        hasAnonKey: !!anonKey,
        hasServiceKey: !!serviceKey,
        configured: isConfigured()
    };
}

module.exports = {
    getClient,
    getAdminClient,
    isConfigured,
    testConnection,
    getConfigInfo
};
