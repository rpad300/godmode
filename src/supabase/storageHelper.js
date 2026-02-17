/**
 * Purpose:
 *   Manages a singleton SupabaseStorage instance and provides Express
 *   middleware for attaching it to incoming requests. Acts as the bridge
 *   between the application layer and the SupabaseStorage class.
 *
 * Responsibilities:
 *   - Initialize the SupabaseStorage singleton once at startup
 *   - Auto-initialize with defaults if getStorage() is called before
 *     explicit init (developer convenience; logged at debug level)
 *   - Provide Express middleware to attach storage + project context to
 *     every request (`attachStorage`, `requireProject`)
 *   - Expose a migration-status checker for projects that may still have
 *     local JSON data but no Supabase data
 *   - Allow instance reset for test isolation (`resetStorage`)
 *
 * Key dependencies:
 *   - ./storage (SupabaseStorage, createSupabaseStorage): the underlying
 *     storage class
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - Holds module-level mutable state (`storageInstance`)
 *   - `attachStorage` / `requireProject` mutate `req.storage` and call
 *     `setProject` / `setUser` on the shared singleton, which clears its
 *     internal cache. This means concurrent requests sharing the singleton
 *     may interfere if project context differs -- Assumption: the
 *     application serializes or scopes requests appropriately.
 *   - `checkMigrationStatus` reads the local filesystem (fs.existsSync)
 *
 * Notes:
 *   - The project ID for middleware is resolved from `req.params.projectId`
 *     or the `X-Project-Id` header, in that order.
 *   - The singleton pattern means all callers share cache and context state.
 *     For multi-tenant scenarios consider one instance per request instead.
 *
 * Usage:
 *   const { getStorage, initStorage } = require('./supabase/storageHelper');
 *
 *   // Initialize once at app startup
 *   await initStorage();
 *
 *   // Get instance anywhere
 *   const storage = getStorage();
 *   const facts = await storage.getFacts();
 */

const { logger } = require('../logger');
const { SupabaseStorage, createSupabaseStorage } = require('./storage');

const log = logger.child({ module: 'storage-helper' });

// Singleton instance
let storageInstance = null;

/**
 * Initialize the storage instance
 * Should be called once at application startup
 * 
 * @param {object} options - Configuration options
 * @param {string} options.supabaseUrl - Supabase URL (defaults to env)
 * @param {string} options.supabaseKey - Supabase anon key (defaults to env)
 * @param {string} options.filesBasePath - Base path for local file storage
 * @param {number} options.similarityThreshold - Deduplication threshold (0.0-1.0)
 * @param {number} options.cacheTTL - Cache TTL in milliseconds
 * @returns {SupabaseStorage} Storage instance
 */
function initStorage(options = {}) {
    if (storageInstance) {
        log.warn({ event: 'storage_helper_already_init' }, 'Storage already initialized');
        return storageInstance;
    }

    storageInstance = createSupabaseStorage(options);
    log.info({ event: 'storage_helper_initialized' }, 'Storage initialized');
    return storageInstance;
}

/**
 * Get the storage instance
 * Throws if not initialized
 * 
 * @returns {SupabaseStorage} Storage instance
 */
function getStorage() {
    if (!storageInstance) {
        // Auto-initialize with defaults if not yet initialized
        storageInstance = createSupabaseStorage();
        log.debug({ event: 'storage_helper_auto_init' }, 'Storage auto-initialized with defaults');
    }
    return storageInstance;
}

/**
 * Check if storage is initialized
 * 
 * @returns {boolean} True if initialized
 */
function isStorageInitialized() {
    return storageInstance !== null;
}

/**
 * Reset storage instance (for testing)
 */
function resetStorage() {
    storageInstance = null;
}

/**
 * Get storage with project context
 * Convenience function that sets the project and returns storage
 * 
 * @param {string} projectId - Project ID to set
 * @returns {SupabaseStorage} Storage instance with project set
 */
function getStorageForProject(projectId) {
    const storage = getStorage();
    storage.setProject(projectId);
    return storage;
}

/**
 * Middleware factory for Express routes
 * Attaches storage to request object
 * 
 * Usage:
 *   app.use(attachStorage());
 *   
 *   app.get('/api/facts', async (req, res) => {
 *     const facts = await req.storage.getFacts();
 *     res.json(facts);
 *   });
 */
function attachStorage() {
    return (req, res, next) => {
        req.storage = getStorage();
        
        // If project ID is in params or header, set it
        const projectId = req.params.projectId || req.headers['x-project-id'];
        if (projectId) {
            req.storage.setProject(projectId);
        }
        
        // If user is authenticated, set user
        if (req.user) {
            req.storage.setUser(req.user);
        }
        
        next();
    };
}

/**
 * Middleware that requires a project context
 * Returns 400 if no project is set
 */
function requireProject() {
    return (req, res, next) => {
        const projectId = req.params.projectId || req.headers['x-project-id'];
        
        if (!projectId) {
            return res.status(400).json({
                error: 'Project ID required',
                message: 'Provide project ID via URL parameter or X-Project-Id header'
            });
        }
        
        req.storage = getStorage();
        req.storage.setProject(projectId);
        
        if (req.user) {
            req.storage.setUser(req.user);
        }
        
        next();
    };
}

/**
 * Migration helper: Check if project needs data migration
 * Returns true if project has local JSON files but no Supabase data
 * 
 * @param {string} projectId - Project ID to check
 * @param {string} localDataDir - Local data directory path
 * @returns {object} Migration status
 */
async function checkMigrationStatus(projectId, localDataDir) {
    const path = require('path');
    const fs = require('fs');
    
    const storage = getStorage();
    storage.setProject(projectId);
    
    // Check local files
    const localProjectDir = path.join(localDataDir, 'projects', projectId);
    const localKnowledgePath = path.join(localProjectDir, 'knowledge.json');
    const hasLocalData = fs.existsSync(localKnowledgePath);
    
    // Check Supabase data
    let hasSupabaseData = false;
    try {
        const stats = await storage.getProjectStats();
        hasSupabaseData = (stats.facts || 0) > 0 || (stats.documents || 0) > 0;
    } catch (e) {
        // Ignore errors
    }
    
    return {
        projectId,
        hasLocalData,
        hasSupabaseData,
        needsMigration: hasLocalData && !hasSupabaseData,
        status: hasSupabaseData ? 'migrated' : (hasLocalData ? 'pending' : 'empty')
    };
}

module.exports = {
    initStorage,
    getStorage,
    isStorageInitialized,
    resetStorage,
    getStorageForProject,
    attachStorage,
    requireProject,
    checkMigrationStatus,
    SupabaseStorage
};
