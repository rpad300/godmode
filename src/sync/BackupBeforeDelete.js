/**
 * Purpose:
 *   Creates point-in-time snapshots of entities immediately before they are
 *   deleted, enabling later restoration if needed.
 *
 * Responsibilities:
 *   - Persist a deep-cloned copy of each entity to an individual JSON file
 *     under `<dataDir>/delete-backups/`
 *   - Maintain an in-memory + on-disk index (backup-index.json) for fast lookup
 *   - Enforce a maximum backup count (default 100); oldest backups are pruned
 *     automatically
 *   - Provide restore, list, delete, and statistics APIs
 *
 * Key dependencies:
 *   - fs / path: file I/O for individual backup files and the index
 *   - ../logger: structured warning/debug logging
 *
 * Side effects:
 *   - Creates the `delete-backups/` directory if it does not exist
 *   - Writes one JSON file per backup and updates backup-index.json on every
 *     create/delete operation (synchronous I/O)
 *   - `trimBackups` physically removes old backup files from disk
 *
 * Notes:
 *   - `restoreFromBackup` only returns the backed-up data; it does NOT
 *     re-insert the entity into storage or the graph. The caller is
 *     responsible for actual restoration.
 *   - Deep clone via JSON round-trip; non-serializable values (functions,
 *     Dates as objects) will be lost.
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');

const log = logger.child({ module: 'backup-before-delete' });

class BackupBeforeDelete {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.backupDir = path.join(this.dataDir, 'delete-backups');
        this.maxBackups = options.maxBackups || 100;
        this.backupIndex = [];
        this.indexFile = path.join(this.backupDir, 'backup-index.json');
        this.load();
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.backupDir = path.join(this.dataDir, 'delete-backups');
        this.indexFile = path.join(this.backupDir, 'backup-index.json');
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.indexFile)) {
                this.backupIndex = JSON.parse(fs.readFileSync(this.indexFile, 'utf8')) || [];
            } else {
                this.backupIndex = [];
            }
        } catch (e) {
            this.backupIndex = [];
        }
    }

    saveIndex() {
        try {
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
            }
            fs.writeFileSync(this.indexFile, JSON.stringify(this.backupIndex, null, 2));
        } catch (e) {
            log.warn({ event: 'backup_save_index_warning', reason: e.message }, 'Save index warning');
        }
    }

    /**
     * Create backup before delete
     */
    createBackup(type, item, options = {}) {
        const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const backupFile = path.join(this.backupDir, `${backupId}.json`);

        const backup = {
            id: backupId,
            type,
            itemId: item.id,
            itemName: item.name || item.title,
            createdAt: new Date().toISOString(),
            deletedBy: options.deletedBy || 'system',
            reason: options.reason || null,
            data: JSON.parse(JSON.stringify(item)), // Deep clone
            relatedData: options.relatedData || null
        };

        try {
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
            }
            fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

            // Update index
            this.backupIndex.unshift({
                id: backupId,
                type,
                itemId: item.id,
                itemName: item.name || item.title,
                createdAt: backup.createdAt,
                file: backupFile
            });

            // Trim old backups
            this.trimBackups();
            this.saveIndex();

            log.debug({ event: 'backup_created', backupId, type, itemName: item.name || item.title }, 'Created backup');
            return backup;
        } catch (e) {
            log.warn({ event: 'backup_failed', reason: e.message }, 'Backup failed');
            return null;
        }
    }

    /**
     * Get backup by ID
     */
    getBackup(backupId) {
        const entry = this.backupIndex.find(b => b.id === backupId);
        if (!entry) return null;

        try {
            const data = JSON.parse(fs.readFileSync(entry.file, 'utf8'));
            return data;
        } catch (e) {
            return null;
        }
    }

    /**
     * List all backups
     */
    listBackups(options = {}) {
        if (!this.backupIndex) {
            this.backupIndex = [];
        }
        
        let backups = [...this.backupIndex];

        if (options.type) {
            backups = backups.filter(b => b.type === options.type);
        }
        if (options.from) {
            backups = backups.filter(b => new Date(b.createdAt) >= new Date(options.from));
        }
        if (options.to) {
            backups = backups.filter(b => new Date(b.createdAt) <= new Date(options.to));
        }

        const limit = options.limit || 50;
        const offset = options.offset || 0;

        return {
            total: backups.length,
            backups: backups.slice(offset, offset + limit)
        };
    }

    /**
     * Restore from backup
     */
    restoreFromBackup(backupId) {
        const backup = this.getBackup(backupId);
        if (!backup) {
            return { success: false, error: 'Backup not found' };
        }

        return {
            success: true,
            type: backup.type,
            data: backup.data,
            relatedData: backup.relatedData
        };
    }

    /**
     * Delete a backup
     */
    deleteBackup(backupId) {
        const index = this.backupIndex.findIndex(b => b.id === backupId);
        if (index === -1) return false;

        const entry = this.backupIndex[index];
        try {
            if (fs.existsSync(entry.file)) {
                fs.unlinkSync(entry.file);
            }
        } catch (e) {
            // Ignore file delete errors
        }

        this.backupIndex.splice(index, 1);
        this.saveIndex();
        return true;
    }

    /**
     * Trim old backups to stay under limit
     */
    trimBackups() {
        while (this.backupIndex.length > this.maxBackups) {
            const oldest = this.backupIndex.pop();
            try {
                if (fs.existsSync(oldest.file)) {
                    fs.unlinkSync(oldest.file);
                }
            } catch (e) {
                // Ignore
            }
        }
    }

    /**
     * Get backup statistics
     */
    getStats() {
        const stats = {
            totalBackups: this.backupIndex.length,
            byType: {},
            oldestBackup: null,
            newestBackup: null,
            totalSizeEstimate: 0
        };

        for (const backup of this.backupIndex) {
            stats.byType[backup.type] = (stats.byType[backup.type] || 0) + 1;

            if (!stats.oldestBackup || new Date(backup.createdAt) < new Date(stats.oldestBackup)) {
                stats.oldestBackup = backup.createdAt;
            }
            if (!stats.newestBackup || new Date(backup.createdAt) > new Date(stats.newestBackup)) {
                stats.newestBackup = backup.createdAt;
            }

            // Estimate file size
            try {
                if (fs.existsSync(backup.file)) {
                    stats.totalSizeEstimate += fs.statSync(backup.file).size;
                }
            } catch (e) {
                // Ignore
            }
        }

        stats.totalSizeMB = (stats.totalSizeEstimate / (1024 * 1024)).toFixed(2);
        return stats;
    }
}

// Singleton
let instance = null;
function getBackupBeforeDelete(options = {}) {
    if (!instance) {
        instance = new BackupBeforeDelete(options);
    }
    if (options.dataDir) instance.setDataDir(options.dataDir);
    return instance;
}

module.exports = { BackupBeforeDelete, getBackupBeforeDelete };
