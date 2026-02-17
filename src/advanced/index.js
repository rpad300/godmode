/**
 * Purpose:
 *   Barrel module that re-exports every advanced subsystem and provides a
 *   single convenience initializer for bootstrapping them all at once.
 *
 * Responsibilities:
 *   - Re-export class constructors for direct instantiation
 *   - Re-export singleton factory functions (getXxx pattern)
 *   - Provide initAdvancedModules() to wire up all subsystems in one call
 *
 * Key dependencies:
 *   - Every sibling module in src/advanced/: aggregated here so consumers
 *     only need a single require()
 *
 * Side effects:
 *   - None on import; initAdvancedModules() will create singleton instances
 *     (some of which start timers or read from the filesystem)
 *
 * Notes:
 *   - Each getXxx factory is a lazy singleton -- first call creates the
 *     instance, subsequent calls return the same one. Pass options only on
 *     the first call; later options are silently ignored for most modules.
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
 * Bootstrap every advanced subsystem with shared configuration.
 *
 * @param {Object} options
 * @param {string} [options.dataDir='./data'] - Root directory for persistent data files
 * @param {Object} [options.storage] - Storage backend (e.g. SupabaseStorage) passed
 *   to modules that need it (currently DataExportImport)
 * @returns {Object} Map of named singleton instances keyed by short alias
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
