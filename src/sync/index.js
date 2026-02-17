/**
 * Purpose:
 *   Central barrel file and orchestration layer for the sync subsystem.
 *   Provides both raw class exports and singleton factory functions, plus
 *   a high-level `enhancedDelete` workflow that chains all delete concerns.
 *
 * Responsibilities:
 *   - Re-export every sync module (classes + singleton getters)
 *   - Wire inter-module dependencies via `initSyncModules`
 *   - Implement `enhancedDelete` -- a single-call delete that runs backup,
 *     soft-delete, cascade, audit, event emission, and stats recording
 *
 * Key dependencies:
 *   - All sibling modules in ./sync/ (GraphSync, SoftDelete, CascadeDelete, etc.)
 *
 * Side effects:
 *   - `initSyncModules` mutates the BatchDelete singleton with cross-module refs
 *   - `enhancedDelete` writes to disk (backups, soft-delete file, audit log, stats)
 *     and may issue graph-database mutations via CascadeDelete
 *
 * Notes:
 *   - Every getXxx() call returns a process-wide singleton; passing new options
 *     after first creation only updates a subset of fields (e.g. dataDir).
 *   - `enhancedDelete` instantiates fresh singletons per call rather than reusing
 *     a pre-wired module set. This is intentional for stateless HTTP handlers but
 *     means the caller must pass graphProvider/storage each time.
 */

const { GraphSync, getGraphSync } = require('./GraphSync');
const { SoftDelete, getSoftDelete } = require('./SoftDelete');
const { CascadeDelete, getCascadeDelete } = require('./CascadeDelete');
const { AuditLog, getAuditLog } = require('./AuditLog');
const { BatchDelete, getBatchDelete } = require('./BatchDelete');
const { IntegrityCheck, getIntegrityCheck } = require('./IntegrityCheck');
const { BackupBeforeDelete, getBackupBeforeDelete } = require('./BackupBeforeDelete');
const { DeleteEvents, getDeleteEvents } = require('./DeleteEvents');
const { DeleteStats, getDeleteStats } = require('./DeleteStats');
const { RetentionPolicy, getRetentionPolicy } = require('./RetentionPolicy');

/**
 * Bootstrap all sync singletons and wire cross-module dependencies.
 * Call once at startup with the shared graphProvider and storage references.
 * Returns a keyed object of ready-to-use module instances.
 *
 * @param {object} options
 * @param {string} [options.dataDir='./data'] - Root directory for on-disk persistence
 * @param {object} [options.graphProvider] - Graph database client
 * @param {object} [options.storage] - Local/Supabase storage layer
 * @returns {object} Map of module name to initialised singleton
 */
function initSyncModules(options = {}) {
    const dataDir = options.dataDir || './data';
    const graphProvider = options.graphProvider;
    const storage = options.storage;

    const modules = {
        graphSync: getGraphSync({ graphProvider, storage }),
        softDelete: getSoftDelete({ dataDir }),
        cascadeDelete: getCascadeDelete({ graphProvider, storage }),
        auditLog: getAuditLog({ dataDir }),
        batchDelete: getBatchDelete({ graphProvider, storage }),
        integrityCheck: getIntegrityCheck({ graphProvider, storage }),
        backupBeforeDelete: getBackupBeforeDelete({ dataDir }),
        deleteEvents: getDeleteEvents(),
        deleteStats: getDeleteStats({ dataDir }),
        retentionPolicy: getRetentionPolicy({ dataDir })
    };

    // Wire up batch delete with other modules
    modules.batchDelete.setDependencies({
        graphProvider,
        storage,
        softDelete: modules.softDelete,
        auditLog: modules.auditLog,
        cascadeDelete: modules.cascadeDelete
    });

    return modules;
}

/**
 * Orchestrates a full delete pipeline for a single entity:
 *   1. backup  2. soft-delete  3. cascade (graph + local)
 *   4. audit   5. event emit   6. stats recording
 *
 * Each step is best-effort; a failure in one step is captured in the
 * results object but does not prevent subsequent steps from running.
 *
 * @param {string} type - Entity type (contact, conversation, project, etc.)
 * @param {object} item - The entity to delete (must have at least `id`)
 * @param {object} [options]
 * @param {string} [options.dataDir='./data']
 * @param {object} [options.graphProvider]
 * @param {object} [options.storage]
 * @param {string} [options.deletedBy='system']
 * @returns {Promise<object>} Results summary including success flag and timing
 */
async function enhancedDelete(type, item, options = {}) {
    const dataDir = options.dataDir || './data';
    const graphProvider = options.graphProvider;
    const storage = options.storage;
    const deletedBy = options.deletedBy || 'system';

    const startTime = Date.now();
    const results = {
        success: false,
        type,
        itemId: item.id,
        itemName: item.name || item.title
    };

    try {
        // 1. Create backup
        const backupModule = getBackupBeforeDelete({ dataDir });
        const backup = backupModule.createBackup(type, item, { deletedBy });
        results.backupId = backup?.id;

        // 2. Soft delete (mark as deleted)
        const softDeleteModule = getSoftDelete({ dataDir });
        softDeleteModule.markDeleted(type, item, deletedBy);
        results.softDeleted = true;

        // 3. Cascade delete (graph + local)
        const cascadeModule = getCascadeDelete({ graphProvider, storage });
        const cascadeResult = await cascadeModule.cascadeDelete(type, item);
        results.cascade = cascadeResult;
        results.graphSynced = cascadeResult.graphDeleted?.length > 0;

        // 4. Audit log
        const auditModule = getAuditLog({ dataDir });
        const auditEntry = auditModule.logDelete({
            entityType: type,
            entityId: item.id,
            entityName: item.name || item.title,
            deletedBy,
            cascade: true,
            graphSynced: results.graphSynced,
            softDelete: true,
            snapshot: item
        });
        results.auditId = auditEntry.id;

        // 5. Emit event
        const eventsModule = getDeleteEvents();
        eventsModule.emitDelete(type, item, {
            deletedBy,
            cascade: true,
            graphSynced: results.graphSynced,
            softDelete: true
        });

        // 6. Record stats
        const statsModule = getDeleteStats({ dataDir });
        statsModule.recordDelete({
            entityType: type,
            graphSynced: results.graphSynced,
            cascade: true,
            softDelete: true,
            duration: Date.now() - startTime
        });

        results.success = true;
        results.duration = Date.now() - startTime;

    } catch (e) {
        results.error = e.message;
    }

    return results;
}

module.exports = {
    // Classes
    GraphSync,
    SoftDelete,
    CascadeDelete,
    AuditLog,
    BatchDelete,
    IntegrityCheck,
    BackupBeforeDelete,
    DeleteEvents,
    DeleteStats,
    RetentionPolicy,
    
    // Singletons
    getGraphSync,
    getSoftDelete,
    getCascadeDelete,
    getAuditLog,
    getBatchDelete,
    getIntegrityCheck,
    getBackupBeforeDelete,
    getDeleteEvents,
    getDeleteStats,
    getRetentionPolicy,
    
    // Utilities
    initSyncModules,
    enhancedDelete
};
