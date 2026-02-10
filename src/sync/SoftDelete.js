/**
 * Soft Delete Module
 * Instead of permanent deletion, marks items as deleted (allows restore)
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');

const log = logger.child({ module: 'soft-delete' });

class SoftDelete {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.retentionDays = options.retentionDays || 30; // Keep deleted items for 30 days
        this.deletedItems = new Map(); // type -> [items]
        this.deletedFile = path.join(this.dataDir, 'deleted-items.json');
        this.load();
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.deletedFile = path.join(this.dataDir, 'deleted-items.json');
        this.load();
    }

    ensureInitialized() {
        if (!this.deletedItems) {
            this.deletedItems = new Map();
        }
    }

    load() {
        try {
            this.deletedItems = new Map(); // Always reset
            if (fs.existsSync(this.deletedFile)) {
                const data = JSON.parse(fs.readFileSync(this.deletedFile, 'utf8'));
                if (data && typeof data === 'object') {
                    this.deletedItems = new Map(Object.entries(data));
                }
            }
        } catch (e) {
            log.warn({ event: 'soft_delete_load_warning', reason: e.message }, 'Load warning');
            this.deletedItems = new Map();
        }
    }

    save() {
        try {
            const dir = path.dirname(this.deletedFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const data = Object.fromEntries(this.deletedItems);
            fs.writeFileSync(this.deletedFile, JSON.stringify(data, null, 2));
        } catch (e) {
            log.warn({ event: 'soft_delete_save_warning', reason: e.message }, 'Save warning');
        }
    }

    /**
     * Mark an item as deleted (soft delete)
     */
    markDeleted(type, item, deletedBy = 'system') {
        const deletedItem = {
            ...item,
            _deleted: true,
            _deletedAt: new Date().toISOString(),
            _deletedBy: deletedBy,
            _expiresAt: new Date(Date.now() + this.retentionDays * 24 * 60 * 60 * 1000).toISOString(),
            _originalType: type
        };

        if (!this.deletedItems.has(type)) {
            this.deletedItems.set(type, []);
        }
        this.deletedItems.get(type).push(deletedItem);
        this.save();

        log.debug({ event: 'soft_delete_marked', type, itemName: item.name || item.title || item.id }, 'Marked as deleted');
        return deletedItem;
    }

    /**
     * Get all deleted items of a type
     */
    getDeleted(type = null) {
        if (!this.deletedItems) {
            this.deletedItems = new Map();
        }
        
        if (type) {
            return this.deletedItems.get(type) || [];
        }
        
        // Return all deleted items
        const all = [];
        for (const [t, items] of this.deletedItems) {
            all.push(...items.map(i => ({ ...i, _type: t })));
        }
        return all.sort((a, b) => new Date(b._deletedAt) - new Date(a._deletedAt));
    }

    /**
     * Restore a deleted item
     */
    restore(type, itemId) {
        const items = this.deletedItems.get(type) || [];
        const index = items.findIndex(i => i.id === itemId);
        
        if (index === -1) {
            return null;
        }

        const item = items.splice(index, 1)[0];
        this.deletedItems.set(type, items);
        this.save();

        // Remove soft delete metadata
        delete item._deleted;
        delete item._deletedAt;
        delete item._deletedBy;
        delete item._expiresAt;
        delete item._originalType;

        log.debug({ event: 'soft_delete_restored', type, itemName: item.name || item.title || item.id }, 'Restored');
        return item;
    }

    /**
     * Permanently delete expired items
     */
    purgeExpired() {
        const now = new Date();
        let purged = 0;

        for (const [type, items] of this.deletedItems) {
            const remaining = items.filter(item => {
                if (new Date(item._expiresAt) < now) {
                    purged++;
                    return false;
                }
                return true;
            });
            this.deletedItems.set(type, remaining);
        }

        if (purged > 0) {
            this.save();
            log.debug({ event: 'soft_delete_purged', purged }, 'Purged expired items');
        }
        return purged;
    }

    /**
     * Get deletion statistics
     */
    getStats() {
        const stats = {
            totalDeleted: 0,
            byType: {},
            oldestDeletion: null,
            newestDeletion: null,
            expiringSoon: 0 // Within 7 days
        };

        if (!this.deletedItems || this.deletedItems.size === 0) {
            return stats;
        }

        const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        for (const [type, items] of this.deletedItems) {
            stats.byType[type] = items.length;
            stats.totalDeleted += items.length;

            for (const item of items) {
                const deletedAt = new Date(item._deletedAt);
                const expiresAt = new Date(item._expiresAt);

                if (!stats.oldestDeletion || deletedAt < new Date(stats.oldestDeletion)) {
                    stats.oldestDeletion = item._deletedAt;
                }
                if (!stats.newestDeletion || deletedAt > new Date(stats.newestDeletion)) {
                    stats.newestDeletion = item._deletedAt;
                }
                if (expiresAt < sevenDaysFromNow) {
                    stats.expiringSoon++;
                }
            }
        }

        return stats;
    }
}

// Singleton
let instance = null;
function getSoftDelete(options = {}) {
    if (!instance) {
        instance = new SoftDelete(options);
    } else if (options.dataDir) {
        instance.setDataDir(options.dataDir);
    }
    // Ensure always initialized
    instance.ensureInitialized();
    return instance;
}

module.exports = { SoftDelete, getSoftDelete };
