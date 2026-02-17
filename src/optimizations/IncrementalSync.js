/**
 * Purpose:
 *   Track content hashes for documents, conversations, and entities so
 *   that only changed items are re-processed, avoiding full-graph rescans.
 *
 * Responsibilities:
 *   - Compute MD5 hashes of content and compare against previously stored
 *     hashes to determine if a sync is needed
 *   - Persist sync state (hashes + timestamps) in Supabase via the
 *     sync_states table, keyed by project_id and sync_type
 *   - Provide needsSync / markSynced pairs for documents, conversations,
 *     and entities
 *   - Support a full reset (delete sync state) to force re-processing
 *
 * Key dependencies:
 *   - crypto: MD5 content hashing
 *   - ../supabase/storageHelper: sync state persistence (soft-loaded)
 *
 * Side effects:
 *   - Reads from and writes to the Supabase "sync_states" table
 *   - resetState deletes the corresponding sync_states row
 *
 * Notes:
 *   - In-memory cache has a 1-minute TTL; multiple calls within that
 *     window avoid re-querying Supabase.
 *   - The singleton factory (getIncrementalSync) maintains one instance
 *     per syncType, unlike most other modules which use a single global.
 *   - MD5 is used for speed, not security. Collision resistance is
 *     adequate for change-detection purposes.
 */

const crypto = require('crypto');
const { logger } = require('../logger');

const log = logger.child({ module: 'incremental-sync' });
// Try to load Supabase - may fail due to project folder name conflict
let getStorage = null;
try {
    getStorage = require('../supabase/storageHelper').getStorage;
} catch (e) {
    // Will use in-memory state only
}

/**
 * Tracks MD5 content hashes to enable incremental (change-only) processing
 * of documents, conversations, and entities.
 *
 * @param {object} options
 * @param {string} [options.syncType='default'] - Identifier for this sync lane
 */
class IncrementalSync {
    constructor(options = {}) {
        this.syncType = options.syncType || 'default';
        
        // In-memory cache for sync state
        this._cache = {
            entities: {},
            documents: {},
            conversations: {},
            lastRefresh: 0
        };
        this._cacheTTL = 60000; // 1 minute
    }

    /**
     * Get storage instance
     */
    _getStorage() {
        if (!getStorage) return null;
        try {
            return getStorage();
        } catch (e) {
            return null;
        }
    }

    /**
     * Load sync state from Supabase
     */
    async _loadState() {
        if (Date.now() - this._cache.lastRefresh < this._cacheTTL) {
            return;
        }
        
        try {
            const storage = this._getStorage();
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            
            if (!projectId) return;
            
            const { data } = await supabase
                .from('sync_states')
                .select('*')
                .eq('project_id', projectId)
                .eq('sync_type', this.syncType)
                .single();
            
            if (data) {
                // Parse the sync cursor as our state
                const state = data.last_sync_cursor ? JSON.parse(data.last_sync_cursor) : {};
                this._cache = {
                    entities: state.entities || {},
                    documents: state.documents || {},
                    conversations: state.conversations || {},
                    lastFullSync: data.last_sync_at,
                    lastRefresh: Date.now()
                };
            }
        } catch (e) {
            log.warn({ event: 'incremental_sync_load_state_failed', message: e.message }, 'Could not load state');
        }
    }

    /**
     * Save sync state to Supabase
     */
    async _saveState() {
        try {
            const storage = this._getStorage();
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            
            if (!projectId) return;
            
            const stateData = {
                entities: this._cache.entities,
                documents: this._cache.documents,
                conversations: this._cache.conversations
            };
            
            await supabase.from('sync_states').upsert({
                project_id: projectId,
                sync_type: this.syncType,
                last_sync_at: new Date().toISOString(),
                last_sync_cursor: JSON.stringify(stateData),
                sync_status: 'idle',
                items_synced: Object.keys(this._cache.entities).length,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'project_id,sync_type'
            });
        } catch (e) {
            log.warn({ event: 'incremental_sync_save_state_failed', message: e.message }, 'Could not save state');
        }
    }

    /**
     * Calculate content hash
     */
    getHash(content) {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Determine whether a document has changed since its last sync by
     * comparing the MD5 hash of its content against the stored hash.
     * @param {string} docPath - Document path (used as key)
     * @param {string} content - Current document content
     * @returns {Promise<boolean>} true if the document needs re-processing
     */
    async needsSync(docPath, content) {
        await this._loadState();
        const hash = this.getHash(content);
        const existing = this._cache.documents[docPath];
        
        if (!existing) return true;
        return existing.hash !== hash;
    }

    /**
     * Mark a document as synced
     */
    async markDocumentSynced(docPath, content) {
        this._cache.documents[docPath] = {
            hash: this.getHash(content),
            lastSynced: new Date().toISOString()
        };
        await this._saveState();
    }

    /**
     * Check if a conversation needs syncing
     */
    async conversationNeedsSync(convId, messages) {
        await this._loadState();
        const hash = this.getHash(JSON.stringify(messages));
        const existing = this._cache.conversations[convId];
        
        if (!existing) return true;
        return existing.hash !== hash;
    }

    /**
     * Mark a conversation as synced
     */
    async markConversationSynced(convId, messages) {
        this._cache.conversations[convId] = {
            hash: this.getHash(JSON.stringify(messages)),
            lastSynced: new Date().toISOString()
        };
        await this._saveState();
    }

    /**
     * Check if an entity needs graph update
     */
    async entityNeedsSync(entityType, entityId, properties) {
        await this._loadState();
        const key = `${entityType}:${entityId}`;
        const hash = this.getHash(JSON.stringify(properties));
        const existing = this._cache.entities[key];
        
        if (!existing) return true;
        return existing !== hash;
    }

    /**
     * Mark an entity as synced
     */
    async markEntitySynced(entityType, entityId, properties) {
        const key = `${entityType}:${entityId}`;
        this._cache.entities[key] = this.getHash(JSON.stringify(properties));
        await this._saveState();
    }

    /**
     * Get documents that need syncing
     */
    async getDocumentsToSync(allDocs) {
        await this._loadState();
        
        const toSync = [];
        for (const doc of allDocs) {
            const existing = this._cache.documents[doc.filepath || doc.path];
            if (!existing || existing.hash !== doc.file_hash) {
                toSync.push(doc);
            }
        }
        return toSync;
    }

    /**
     * Get sync statistics
     */
    async getStats() {
        await this._loadState();
        
        return {
            lastFullSync: this._cache.lastFullSync,
            documentsTracked: Object.keys(this._cache.documents).length,
            conversationsTracked: Object.keys(this._cache.conversations).length,
            entitiesTracked: Object.keys(this._cache.entities).length
        };
    }

    /**
     * Force full resync
     */
    async resetState() {
        this._cache = {
            entities: {},
            documents: {},
            conversations: {},
            lastFullSync: null,
            lastRefresh: 0
        };
        
        try {
            const storage = this._getStorage();
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            
            if (projectId) {
                await supabase
                    .from('sync_states')
                    .delete()
                    .eq('project_id', projectId)
                    .eq('sync_type', this.syncType);
            }
        } catch (e) {
            log.warn({ event: 'incremental_sync_reset_state_failed', message: e.message }, 'Could not reset state');
        }
    }

    /**
     * Mark full sync completed
     */
    async markFullSyncComplete() {
        this._cache.lastFullSync = new Date().toISOString();
        await this._saveState();
    }
}

/** Singleton per sync type (unlike other modules which use a single global instance). */
const instances = new Map();
function getIncrementalSync(options = {}) {
    const syncType = options.syncType || 'default';
    
    if (!instances.has(syncType)) {
        instances.set(syncType, new IncrementalSync({ syncType, ...options }));
    }
    return instances.get(syncType);
}

module.exports = { IncrementalSync, getIncrementalSync };
