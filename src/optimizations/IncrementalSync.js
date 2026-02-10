/**
 * Incremental Sync Module
 * Only process changes, not the entire graph
 * Tracks what has been synced and what needs updating
 * 
 * Refactored to use Supabase instead of local JSON files
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
     * Check if a document needs syncing
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

// Singleton per sync type
const instances = new Map();
function getIncrementalSync(options = {}) {
    const syncType = options.syncType || 'default';
    
    if (!instances.has(syncType)) {
        instances.set(syncType, new IncrementalSync({ syncType, ...options }));
    }
    return instances.get(syncType);
}

module.exports = { IncrementalSync, getIncrementalSync };
