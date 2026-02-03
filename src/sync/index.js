/**
 * Sync Module
 * Exports all synchronization utilities
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
 * Initialize all sync modules with dependencies
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
 * Enhanced delete operation with all features
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
