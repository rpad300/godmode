/**
 * Purpose:
 *   Provides an append-only audit trail for all destructive operations
 *   (delete, restore, purge) for compliance and debugging.
 *
 * Responsibilities:
 *   - Record DELETE, RESTORE, and PURGE actions with full context and optional
 *     entity snapshots
 *   - Persist the log to a JSON file on disk (audit-log.json)
 *   - Support filtered queries, free-text search, time-windowed statistics,
 *     and CSV/JSON export
 *
 * Key dependencies:
 *   - fs / path: reading and writing the JSON audit log file
 *   - ../logger: structured logging via child logger
 *
 * Side effects:
 *   - Every log* call writes synchronously to `<dataDir>/audit-log.json`
 *   - Entries are capped at `maxEntries` (default 10 000); oldest entries are
 *     silently dropped when the cap is exceeded
 *
 * Notes:
 *   - Entries are ordered newest-first (unshift). Query helpers rely on this.
 *   - IDs include a timestamp + random suffix -- not guaranteed globally unique
 *     under heavy concurrency, but sufficient for single-process use.
 *   - The `snapshot` field in logDelete may contain the full entity payload;
 *     callers should be mindful of log file size.
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');

const log = logger.child({ module: 'audit-log' });

class AuditLog {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.maxEntries = options.maxEntries || 10000;
        this.logFile = path.join(this.dataDir, 'audit-log.json');
        this.entries = [];
        this.load();
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.logFile = path.join(this.dataDir, 'audit-log.json');
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.logFile)) {
                this.entries = JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
            }
        } catch (e) {
            this.entries = [];
        }
    }

    save() {
        try {
            const dir = path.dirname(this.logFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.logFile, JSON.stringify(this.entries, null, 2));
        } catch (e) {
            log.warn({ event: 'audit_log_save_warning', reason: e.message }, 'Save warning');
        }
    }

    /**
     * Log a delete operation
     */
    logDelete(options) {
        const entry = {
            id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            action: 'DELETE',
            entityType: options.entityType,
            entityId: options.entityId,
            entityName: options.entityName,
            deletedBy: options.deletedBy || 'system',
            reason: options.reason || null,
            cascade: options.cascade || false,
            graphSynced: options.graphSynced || false,
            softDelete: options.softDelete || false,
            metadata: options.metadata || {},
            // Store a snapshot of what was deleted
            snapshot: options.snapshot || null
        };

        this.entries.unshift(entry); // Add to beginning

        // Trim if too many entries
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(0, this.maxEntries);
        }

        this.save();
        log.debug({ event: 'audit_log_delete', entityType: options.entityType, entityName: options.entityName }, 'Logged DELETE');
        return entry;
    }

    /**
     * Log a restore operation
     */
    logRestore(options) {
        const entry = {
            id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            action: 'RESTORE',
            entityType: options.entityType,
            entityId: options.entityId,
            entityName: options.entityName,
            restoredBy: options.restoredBy || 'system',
            originalDeleteId: options.originalDeleteId || null
        };

        this.entries.unshift(entry);
        this.save();
        log.debug({ event: 'audit_log_restore', entityType: options.entityType, entityName: options.entityName }, 'Logged RESTORE');
        return entry;
    }

    /**
     * Log a purge operation
     */
    logPurge(options) {
        const entry = {
            id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            action: 'PURGE',
            itemsPurged: options.itemsPurged,
            reason: options.reason || 'retention_policy',
            purgedBy: options.purgedBy || 'system'
        };

        this.entries.unshift(entry);
        this.save();
        return entry;
    }

    /**
     * Get audit log entries
     */
    getEntries(options = {}) {
        let filtered = [...this.entries];

        if (options.action) {
            filtered = filtered.filter(e => e.action === options.action);
        }
        if (options.entityType) {
            filtered = filtered.filter(e => e.entityType === options.entityType);
        }
        if (options.from) {
            filtered = filtered.filter(e => new Date(e.timestamp) >= new Date(options.from));
        }
        if (options.to) {
            filtered = filtered.filter(e => new Date(e.timestamp) <= new Date(options.to));
        }
        if (options.deletedBy) {
            filtered = filtered.filter(e => e.deletedBy === options.deletedBy);
        }

        const limit = options.limit || 100;
        const offset = options.offset || 0;

        return {
            total: filtered.length,
            entries: filtered.slice(offset, offset + limit)
        };
    }

    /**
     * Get audit statistics
     */
    getStats() {
        const stats = {
            totalOperations: this.entries.length,
            byAction: {},
            byEntityType: {},
            last24Hours: 0,
            last7Days: 0,
            last30Days: 0
        };

        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;

        for (const entry of this.entries) {
            // By action
            stats.byAction[entry.action] = (stats.byAction[entry.action] || 0) + 1;
            
            // By entity type
            if (entry.entityType) {
                stats.byEntityType[entry.entityType] = (stats.byEntityType[entry.entityType] || 0) + 1;
            }

            // Time-based
            const entryTime = new Date(entry.timestamp).getTime();
            if (now - entryTime < day) stats.last24Hours++;
            if (now - entryTime < 7 * day) stats.last7Days++;
            if (now - entryTime < 30 * day) stats.last30Days++;
        }

        return stats;
    }

    /**
     * Search audit log
     */
    search(query) {
        const q = query.toLowerCase();
        return this.entries.filter(e => 
            e.entityName?.toLowerCase().includes(q) ||
            e.entityType?.toLowerCase().includes(q) ||
            e.deletedBy?.toLowerCase().includes(q) ||
            e.reason?.toLowerCase().includes(q)
        );
    }

    /**
     * Export audit log
     */
    export(format = 'json') {
        if (format === 'csv') {
            const headers = ['timestamp', 'action', 'entityType', 'entityId', 'entityName', 'deletedBy', 'reason', 'cascade', 'graphSynced'];
            const rows = this.entries.map(e => 
                headers.map(h => e[h] ?? '').join(',')
            );
            return [headers.join(','), ...rows].join('\n');
        }
        return JSON.stringify(this.entries, null, 2);
    }
}

// Singleton
let instance = null;
function getAuditLog(options = {}) {
    if (!instance) {
        instance = new AuditLog(options);
    }
    if (options.dataDir) instance.setDataDir(options.dataDir);
    return instance;
}

module.exports = { AuditLog, getAuditLog };
