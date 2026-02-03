/**
 * Advanced Module
 * Exports all advanced features
 */

const { DataVersioning, getDataVersioning } = require('./DataVersioning');
const { ScheduledJobs, getScheduledJobs } = require('./ScheduledJobs');
const { SearchIndex, getSearchIndex } = require('./SearchIndex');
const { DataExportImport, getDataExportImport } = require('./DataExportImport');
const { NotificationSystem, getNotificationSystem } = require('./NotificationSystem');
const { DataCompression, getDataCompression } = require('./DataCompression');
const { AdvancedCache, getAdvancedCache } = require('./AdvancedCache');
const { APIDocumentation, getAPIDocumentation } = require('./APIDocumentation');

/**
 * Initialize all advanced modules
 */
function initAdvancedModules(options = {}) {
    const dataDir = options.dataDir || './data';
    const storage = options.storage;

    return {
        versioning: getDataVersioning({ dataDir }),
        scheduler: getScheduledJobs({ dataDir }),
        searchIndex: getSearchIndex({ dataDir }),
        exportImport: getDataExportImport({ dataDir, storage }),
        notifications: getNotificationSystem({ dataDir }),
        compression: getDataCompression({ dataDir }),
        cache: getAdvancedCache({ dataDir }),
        apiDocs: getAPIDocumentation({ dataDir })
    };
}

module.exports = {
    // Classes
    DataVersioning,
    ScheduledJobs,
    SearchIndex,
    DataExportImport,
    NotificationSystem,
    DataCompression,
    AdvancedCache,
    APIDocumentation,
    
    // Singletons
    getDataVersioning,
    getScheduledJobs,
    getSearchIndex,
    getDataExportImport,
    getNotificationSystem,
    getDataCompression,
    getAdvancedCache,
    getAPIDocumentation,
    
    // Utilities
    initAdvancedModules
};
