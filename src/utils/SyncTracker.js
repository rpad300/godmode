/**
 * Purpose:
 *   Persists per-entity content hashes to a JSON file so that incremental sync
 *   operations only process entities whose content has actually changed.
 *
 * Responsibilities:
 *   - Compute deterministic MD5 hashes of entity payloads (sorted keys)
 *   - Compare stored vs. current hashes to decide if an entity needs re-sync
 *   - Persist sync state (hashes + timestamps) to .sync-state.json on disk
 *   - Provide bulk filterNeedSync() for efficient batch processing
 *
 * Key dependencies:
 *   - crypto (Node built-in): MD5 content hashing
 *   - fs / path (Node built-in): Filesystem persistence of sync state
 *   - ../logger: Structured logging
 *
 * Side effects:
 *   - Reads/writes <dataDir>/.sync-state.json on construction and on save()
 *   - Creates the data directory recursively if missing
 *
 * Notes:
 *   - JSON.stringify with sorted keys ensures hash stability regardless of
 *     property insertion order
 *   - clear() forces a full re-sync by wiping all stored hashes
 *   - Singleton accessor getSyncTracker() ignores options after initial creation
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');

const log = logger.child({ module: 'sync-tracker' });

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
            log.warn({ event: 'sync_tracker_load_failed', message: error.message }, 'Could not load sync state');
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
            log.error({ event: 'sync_tracker_save_failed', message: error.message }, 'Could not save sync state');
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
