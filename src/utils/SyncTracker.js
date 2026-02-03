/**
 * SyncTracker - Tracks sync state for incremental synchronization
 * 
 * Features:
 * - Track which entities have been synced
 * - Compute content hashes to detect changes
 * - Support incremental sync (only changed items)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SyncTracker {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.syncFile = path.join(this.dataDir, '.sync-state.json');
        this.state = {
            lastSync: null,
            hashes: {}, // entityType:id -> hash
            synced: {}  // entityType:id -> timestamp
        };
        this.load();
    }

    /**
     * Load sync state from file
     */
    load() {
        try {
            if (fs.existsSync(this.syncFile)) {
                const data = fs.readFileSync(this.syncFile, 'utf-8');
                this.state = JSON.parse(data);
            }
        } catch (error) {
            console.log('[SyncTracker] Could not load sync state:', error.message);
        }
    }

    /**
     * Save sync state to file
     */
    save() {
        try {
            fs.mkdirSync(path.dirname(this.syncFile), { recursive: true });
            fs.writeFileSync(this.syncFile, JSON.stringify(this.state, null, 2));
        } catch (error) {
            console.error('[SyncTracker] Could not save sync state:', error.message);
        }
    }

    /**
     * Compute hash for an entity
     * @param {object} entity 
     * @returns {string}
     */
    computeHash(entity) {
        const content = JSON.stringify(entity, Object.keys(entity).sort());
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Get entity key
     * @param {string} type 
     * @param {string|number} id 
     * @returns {string}
     */
    getKey(type, id) {
        return `${type}:${id}`;
    }

    /**
     * Check if entity needs to be synced
     * @param {string} type - Entity type
     * @param {object} entity - Entity data
     * @returns {boolean}
     */
    needsSync(type, entity) {
        const id = entity.id || entity._id;
        if (!id) return true;

        const key = this.getKey(type, id);
        const currentHash = this.computeHash(entity);
        const storedHash = this.state.hashes[key];

        return currentHash !== storedHash;
    }

    /**
     * Mark entity as synced
     * @param {string} type 
     * @param {object} entity 
     */
    markSynced(type, entity) {
        const id = entity.id || entity._id;
        if (!id) return;

        const key = this.getKey(type, id);
        this.state.hashes[key] = this.computeHash(entity);
        this.state.synced[key] = new Date().toISOString();
    }

    /**
     * Mark sync complete
     */
    markSyncComplete() {
        this.state.lastSync = new Date().toISOString();
        this.save();
    }

    /**
     * Get last sync time
     * @returns {string|null}
     */
    getLastSync() {
        return this.state.lastSync;
    }

    /**
     * Filter entities that need syncing
     * @param {string} type 
     * @param {Array} entities 
     * @returns {Array}
     */
    filterNeedSync(type, entities) {
        return entities.filter(entity => this.needsSync(type, entity));
    }

    /**
     * Get sync statistics
     * @returns {object}
     */
    getStats() {
        return {
            lastSync: this.state.lastSync,
            trackedEntities: Object.keys(this.state.hashes).length,
            syncedEntities: Object.keys(this.state.synced).length
        };
    }

    /**
     * Clear all sync state (force full resync)
     */
    clear() {
        this.state = {
            lastSync: null,
            hashes: {},
            synced: {}
        };
        this.save();
    }

    /**
     * Remove entity from tracking
     * @param {string} type 
     * @param {string|number} id 
     */
    remove(type, id) {
        const key = this.getKey(type, id);
        delete this.state.hashes[key];
        delete this.state.synced[key];
    }
}

// Singleton instance
let instance = null;

function getSyncTracker(options = {}) {
    if (!instance) {
        instance = new SyncTracker(options);
    }
    return instance;
}

module.exports = {
    SyncTracker,
    getSyncTracker
};
