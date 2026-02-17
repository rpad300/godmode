/**
 * Purpose:
 *   Creates and caches two Supabase JS client singletons: a public client
 *   (anon key, subject to RLS) and an admin client (service_role key,
 *   bypasses RLS). All other modules obtain their database handle from here.
 *
 * Responsibilities:
 *   - Lazy-initialize clients on first access so env vars from .env are
 *     available even if this module is required early
 *   - Wrap every Supabase fetch in a timeout + circuit-breaker to prevent
 *     hung requests from blocking the event loop and to fail fast when
 *     Supabase is unreachable
 *   - Expose helpers to check configuration and test connectivity
 *
 * Key dependencies:
 *   - @supabase/supabase-js: Official Supabase client
 *   - ../logger: Structured pino logger
 *
 * Side effects:
 *   - Mutates process.env.NODE_PATH at load time to fix module resolution
 *     when the project directory itself is named "node_modules"
 *   - Reads SUPABASE_PROJECT_URL, SUPABASE_PROJECT_ANON_KEY,
 *     SUPABASE_PROJECT_SERVICE_ROLE_KEY (and legacy aliases) from env
 *   - SUPABASE_CIRCUIT_THRESHOLD / SUPABASE_CIRCUIT_COOLDOWN_MS control
 *     circuit-breaker behavior
 *
 * Notes:
 *   - The admin client must never be exposed to browser/frontend code.
 *   - Circuit breaker state is in-process; it does not share across workers.
 *   - testConnection() queries the `user_profiles` table; PGRST116 (table
 *     not found) is tolerated so the check passes before migrations run.
 */

const path = require('path');
const { logger: rootLogger } = require('../logger');

const log = rootLogger.child({ module: 'supabase-client' });

// Fix module resolution when project folder is named "node_modules"
const projectNodeModules = path.join(__dirname, '..', '..', 'node_modules');
if (!process.env.NODE_PATH || !process.env.NODE_PATH.includes(projectNodeModules)) {
    process.env.NODE_PATH = process.env.NODE_PATH 
        ? `${process.env.NODE_PATH}${path.delimiter}${projectNodeModules}`
        : projectNodeModules;
    require('module').Module._initPaths();
}

const { createClient } = require('@supabase/supabase-js');

const DEFAULT_FETCH_TIMEOUT_MS = 30000; // 30s
const CIRCUIT_THRESHOLD = Number(process.env.SUPABASE_CIRCUIT_THRESHOLD) || 5;
const CIRCUIT_COOLDOWN_MS = Number(process.env.SUPABASE_CIRCUIT_COOLDOWN_MS) || 30000;

const circuitState = { failures: 0, lastFailureAt: 0, state: 'closed' };

/**
 * Fetch wrapper that aborts after timeout (prevents hung Supabase requests)
 */
function fetchWithTimeout(input, init = {}) {
    const timeoutMs = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS) || DEFAULT_FETCH_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const signal = controller.signal;
    return fetch(input, { ...init, signal }).then(
        (r) => { clearTimeout(timeoutId); return r; },
        (e) => { clearTimeout(timeoutId); throw e; }
    );
}

/**
 * Fetch with circuit breaker: after CIRCUIT_THRESHOLD consecutive failures,
 * reject immediately for CIRCUIT_COOLDOWN_MS, then allow one probe (half-open).
 */
function fetchWithCircuitBreaker(input, init = {}) {
    const now = Date.now();
    if (circuitState.state === 'open') {
        if (now - circuitState.lastFailureAt < CIRCUIT_COOLDOWN_MS) {
            return Promise.reject(new Error('Supabase circuit open (service unavailable)'));
        }
        circuitState.state = 'half-open';
    }
    return fetchWithTimeout(input, init).then(
        (r) => {
            circuitState.failures = 0;
            circuitState.state = 'closed';
            return r;
        },
        (e) => {
            circuitState.failures += 1;
            circuitState.lastFailureAt = now;
            if (circuitState.failures >= CIRCUIT_THRESHOLD) {
                circuitState.state = 'open';
                log.warn({ event: 'supabase_circuit_open', failures: circuitState.failures, cooldownMs: CIRCUIT_COOLDOWN_MS }, 'Circuit open');
            }
            throw e;
        }
    );
}

let clientInstance = null;
let adminInstance = null;

/**
 * Get environment variables (lazy loading to ensure .env is loaded first).
 * Accepts both SUPABASE_PROJECT_* and legacy SUPABASE_URL / SUPABASE_ANON_KEY.
 */
function getEnvVars() {
    return {
        url: process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_PROJECT_ANON_KEY || process.env.SUPABASE_ANON_KEY,
        serviceKey: process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    };
}

/**
 * Get the public Supabase client (uses anon key, respects RLS)
 * Use for: user-facing operations
 */
function getClient() {
    if (!clientInstance) {
        const { url, anonKey } = getEnvVars();
        if (!url || !anonKey) {
            log.warn({ event: 'supabase_client_missing_config' }, 'Missing SUPABASE_PROJECT_URL or SUPABASE_PROJECT_ANON_KEY');
            return null;
        }
        clientInstance = createClient(url, anonKey, {
            auth: { autoRefreshToken: true, persistSession: false, detectSessionInUrl: false },
            global: { fetch: fetchWithCircuitBreaker }
        });
        log.info({ event: 'supabase_client_initialized' }, 'Client initialized');
    }
    return clientInstance;
}

/**
 * Get the admin Supabase client (uses service_role key, bypasses RLS)
 * Use for: admin operations, migrations, seeding
 * CAUTION: Never expose this to frontend
 */
function getAdminClient() {
    if (!adminInstance) {
        const { url, serviceKey } = getEnvVars();
        if (!url || !serviceKey) {
            log.warn({ event: 'supabase_admin_missing_config' }, 'Missing SUPABASE_PROJECT_URL or SUPABASE_PROJECT_SERVICE_ROLE_KEY');
            return null;
        }
        adminInstance = createClient(url, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
            global: { fetch: fetchWithCircuitBreaker }
        });
        log.info({ event: 'supabase_admin_initialized' }, 'Admin client initialized');
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
