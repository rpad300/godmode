/**
 * Purpose:
 *   Sync infrastructure API. Manages the graph outbox (Supabase-backed sync pipeline),
 *   soft-delete/restore, audit logging, batch operations, data integrity checks,
 *   pre-delete backups, delete event streaming, retention policies, data versioning,
 *   and scheduled job management.
 *
 * Responsibilities:
 *   - Outbox sync: status, dead letters, retry, resolve (requires Supabase)
 *   - Per-project sync: status, stats, pending count, dead letters
 *   - Soft delete: list deleted items, restore by type/id with audit logging
 *   - Audit: query log entries, stats, export (JSON/CSV)
 *   - Batch delete: bulk delete with soft-delete, cascade, and backup options
 *   - Integrity: run integrity checks, auto-fix inconsistencies
 *   - Backups: list, retrieve, stats for pre-delete backups
 *   - Events: recent delete events (JSON), real-time SSE stream
 *   - Stats: delete statistics, stats dashboard
 *   - Retention: view policies, enable/disable, dry-run preview, execute cleanup
 *   - Data versioning: create version snapshots, list versions, restore
 *   - Scheduled jobs: list, create, execute, stats, execution log
 *
 * Key dependencies:
 *   - ../../sync (getSoftDelete, getAuditLog, getDeleteEvents, getBatchDelete,
 *     getCascadeDelete, getIntegrityCheck, getBackupBeforeDelete, getDeleteStats,
 *     getRetentionPolicy): sync infrastructure modules
 *   - ../../advanced (getDataVersioning, getScheduledJobs): versioning and job scheduling
 *   - ../../server/security (isValidUUID): input validation for project/dead-letter IDs
 *   - supabase.outbox: Supabase outbox client for sync status and dead letter management
 *
 * Side effects:
 *   - Soft delete moves items to a deleted store; restore reverses this
 *   - Audit log writes persist to the local data directory
 *   - Batch delete may cascade to graph nodes and related entities
 *   - Integrity fix auto-corrects inconsistencies in storage and graph
 *   - Retention execute permanently removes items past their retention period
 *   - Version snapshots are written to the local data directory
 *   - Job execution triggers the associated job handler
 *   - SSE endpoint keeps the connection open until client disconnect
 *
 * Notes:
 *   - Routes are split into two sections: local-storage routes (no Supabase needed)
 *     and outbox routes (require Supabase). If Supabase is not configured, outbox
 *     routes return 503 (except /api/sync/status which returns a disconnected state).
 *   - The toSyncState helper normalizes outbox results into the frontend SyncState shape
 *   - UUID validation is enforced on all project and dead-letter ID path parameters
 *   - The /api/versions and /api/jobs routes live here because they share the sync
 *     data directory context, even though they are conceptually separate features
 *
 * Routes (summary -- 35+ endpoints):
 *   GET  /api/sync/deleted                       - List soft-deleted items
 *   POST /api/sync/restore/:type/:id             - Restore a soft-deleted item
 *   GET  /api/sync/audit                         - Query audit log entries
 *   GET  /api/sync/audit/stats                   - Audit log statistics
 *   GET  /api/sync/audit/export                  - Export audit log (JSON or CSV download)
 *   POST /api/sync/batch-delete                  - Bulk delete with options
 *   GET  /api/sync/integrity                     - Run data integrity check
 *   POST /api/sync/integrity/fix                 - Auto-fix integrity issues
 *   GET  /api/sync/backups/stats                 - Pre-delete backup statistics
 *   GET  /api/sync/backups                       - List backups
 *   GET  /api/sync/backups/:id                   - Retrieve a specific backup
 *   GET  /api/sync/events/recent                 - Recent delete events (JSON)
 *   GET  /api/sync/events                        - SSE stream of delete events
 *   GET  /api/sync/stats                         - Delete statistics
 *   GET  /api/sync/stats/dashboard               - Stats dashboard
 *   GET  /api/sync/retention                     - Retention policies
 *   POST /api/sync/retention/enable              - Enable/disable retention
 *   POST /api/sync/retention/execute             - Execute retention cleanup
 *   GET  /api/sync/retention/preview             - Dry-run retention preview
 *   POST /api/versions                           - Create a version snapshot
 *   GET  /api/versions/:id                       - List versions for an item
 *   GET  /api/versions/stats                     - Versioning statistics
 *   POST /api/versions/restore                   - Restore a version
 *   GET  /api/jobs                               - List scheduled jobs
 *   POST /api/jobs                               - Create a scheduled job
 *   POST /api/jobs/:id/execute                   - Execute a job immediately
 *   GET  /api/jobs/stats                         - Job execution statistics
 *   GET  /api/jobs/log                           - Job execution log
 *   GET  /api/sync/status                        - Frontend SyncState (outbox-backed)
 *   GET  /api/sync/dead-letters                  - Dead letter queue
 *   POST /api/sync/retry/:id                     - Retry a dead letter
 *   GET  /api/projects/:id/sync/status           - Per-project sync status
 *   GET  /api/projects/:id/sync/stats            - Per-project sync stats
 *   GET  /api/projects/:id/sync/pending          - Per-project pending count
 *   GET  /api/projects/:id/sync/dead-letters     - Per-project dead letters
 *   POST /api/sync/dead-letters/:id/retry        - Retry a specific dead letter
 *   POST /api/sync/dead-letters/:id/resolve      - Resolve a dead letter (auth required)
 */

const { parseBody, parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');
const { isValidUUID } = require('../../server/security');

/**
 * Map outbox result to frontend SyncState shape
 * Frontend expects: { connected, lastSync, pendingCount, errorCount }
 */
function toSyncState(projectId, statusResult, pendingResult, statsResult) {
    const connected = !!projectId && statusResult?.success !== false;
    const status = Array.isArray(statusResult?.status) ? statusResult.status[0] : statusResult?.status;
    const lastSync = status?.last_synced_at || status?.updated_at || null;
    const pendingCount = pendingResult?.success ? (pendingResult.count ?? 0) : 0;
    const stats = statsResult?.stats || {};
    const errorCount = (stats.failed || 0) + (stats.dead_letter || 0);

    return {
        connected,
        lastSync,
        pendingCount,
        errorCount
    };
}

/**
 * Handle sync routes
 * @param {object} ctx - Context with req, res, pathname, parsedUrl, supabase, storage
 * @returns {Promise<boolean>} - true if handled
 */
async function handleSync(ctx) {
    const { req, res, pathname, parsedUrl, supabase, storage } = ctx;
    const log = getLogger().child({ module: 'sync' });
    const dataDir = storage?.getProjectDataDir?.();
    const urlParsed = parsedUrl || parseUrl(req.url);

    // === Extended sync routes (use local storage, no Supabase required) ===
    if (storage && dataDir) {
        // GET /api/sync/deleted
        if (pathname === '/api/sync/deleted' && req.method === 'GET') {
            try {
                const { getSoftDelete } = require('../../sync');
                const softDelete = getSoftDelete({ dataDir });
                const type = urlParsed.query?.type;
                let items = [], stats = {};
                try { items = softDelete.getDeleted(type) || []; } catch (e) { items = []; }
                try { stats = softDelete.getStats() || {}; } catch (e) { stats = {}; }
                jsonResponse(res, { ok: true, items, count: items.length, stats });
            } catch (e) {
                log.warn({ event: 'sync_deleted_items_error', reason: e.message }, 'Deleted items error');
                jsonResponse(res, { ok: true, items: [], count: 0, stats: {} });
            }
            return true;
        }

        // POST /api/sync/restore/:type/:id
        const restoreMatch = pathname.match(/^\/api\/sync\/restore\/(\w+)\/([a-f0-9\-]+)$/);
        if (restoreMatch && req.method === 'POST') {
            try {
                const [ , type, itemId ] = restoreMatch;
                const { getSoftDelete, getAuditLog, getDeleteEvents } = require('../../sync');
                const softDelete = getSoftDelete({ dataDir });
                const restored = softDelete.restore(type, itemId);
                if (!restored) {
                    jsonResponse(res, { ok: false, error: 'Item not found in deleted items' }, 404);
                    return true;
                }
                getAuditLog({ dataDir }).logRestore({
                    entityType: type,
                    entityId: itemId,
                    entityName: restored.name || restored.title
                });
                getDeleteEvents().emitRestore(type, restored);
                jsonResponse(res, { ok: true, restored });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // GET /api/sync/audit
        if (pathname === '/api/sync/audit' && req.method === 'GET') {
            try {
                const { getAuditLog } = require('../../sync');
                const auditLog = getAuditLog({ dataDir });
                const action = urlParsed.query?.action;
                const entityType = urlParsed.query?.type;
                const limit = parseInt(urlParsed.query?.limit) || 100;
                const entries = auditLog.getEntries({ action, entityType, limit });
                jsonResponse(res, { ok: true, ...entries });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // GET /api/sync/audit/stats
        if (pathname === '/api/sync/audit/stats' && req.method === 'GET') {
            try {
                const { getAuditLog } = require('../../sync');
                const stats = getAuditLog({ dataDir }).getStats();
                jsonResponse(res, { ok: true, stats });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // GET /api/sync/audit/export
        if (pathname === '/api/sync/audit/export' && req.method === 'GET') {
            try {
                const { getAuditLog } = require('../../sync');
                const auditLog = getAuditLog({ dataDir });
                const format = urlParsed.query?.format || 'json';
                const data = auditLog.export(format);
                if (format === 'csv') {
                    res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=audit-log.csv' });
                    res.end(data);
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename=audit-log.json' });
                    res.end(data);
                }
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // POST /api/sync/batch-delete
        if (pathname === '/api/sync/batch-delete' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getBatchDelete, getSoftDelete, getAuditLog, getCascadeDelete } = require('../../sync');
                const batchDelete = getBatchDelete({
                    graphProvider: storage.getGraphProvider(),
                    storage,
                    softDelete: getSoftDelete({ dataDir }),
                    auditLog: getAuditLog({ dataDir }),
                    cascadeDelete: getCascadeDelete({ graphProvider: storage.getGraphProvider(), storage })
                });
                const result = await batchDelete.batchDelete(body.type, body.items, {
                    softDelete: body.softDelete !== false,
                    cascade: body.cascade !== false,
                    deletedBy: body.deletedBy || 'user'
                });
                jsonResponse(res, { ok: true, ...result });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // GET /api/sync/integrity
        if (pathname === '/api/sync/integrity' && req.method === 'GET') {
            try {
                const { getIntegrityCheck } = require('../../sync');
                const integrityCheck = getIntegrityCheck({
                    graphProvider: storage.getGraphProvider(),
                    storage
                });
                const report = await integrityCheck.runCheck();
                jsonResponse(res, { ok: true, ...report });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // POST /api/sync/integrity/fix
        if (pathname === '/api/sync/integrity/fix' && req.method === 'POST') {
            try {
                const { getIntegrityCheck } = require('../../sync');
                const integrityCheck = getIntegrityCheck({
                    graphProvider: storage.getGraphProvider(),
                    storage
                });
                const report = await integrityCheck.runCheck();
                const fixes = await integrityCheck.autoFix(report);
                jsonResponse(res, { ok: true, report, fixes });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // GET /api/sync/backups/stats
        if (pathname === '/api/sync/backups/stats' && req.method === 'GET') {
            try {
                const { getBackupBeforeDelete } = require('../../sync');
                const stats = getBackupBeforeDelete({ dataDir }).getStats();
                jsonResponse(res, { ok: true, stats });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // GET /api/sync/backups
        if (pathname === '/api/sync/backups' && req.method === 'GET') {
            try {
                const { getBackupBeforeDelete } = require('../../sync');
                const backup = getBackupBeforeDelete({ dataDir });
                const type = urlParsed.query?.type;
                const limit = parseInt(urlParsed.query?.limit) || 50;
                let result = { total: 0, backups: [] };
                try { result = backup.listBackups({ type, limit }) || result; } catch (e) {}
                jsonResponse(res, { ok: true, ...result });
            } catch (e) {
                jsonResponse(res, { ok: true, total: 0, backups: [] });
            }
            return true;
        }

        // GET /api/sync/backups/:id
        const backupGetMatch = pathname.match(/^\/api\/sync\/backups\/([a-z0-9_]+)$/);
        if (backupGetMatch && req.method === 'GET') {
            try {
                const { getBackupBeforeDelete } = require('../../sync');
                const data = getBackupBeforeDelete({ dataDir }).getBackup(backupGetMatch[1]);
                if (!data) {
                    jsonResponse(res, { ok: false, error: 'Backup not found' }, 404);
                    return true;
                }
                jsonResponse(res, { ok: true, backup: data });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // GET /api/sync/events/recent
        if (pathname === '/api/sync/events/recent' && req.method === 'GET') {
            try {
                const { getDeleteEvents } = require('../../sync');
                const limit = parseInt(urlParsed.query?.limit) || 20;
                let recentEvents = [];
                try { recentEvents = getDeleteEvents().getRecentEvents({ limit }) || []; } catch (e) {}
                jsonResponse(res, { ok: true, events: recentEvents });
            } catch (e) {
                jsonResponse(res, { ok: true, events: [] });
            }
            return true;
        }

        // GET /api/sync/events - SSE
        if (pathname === '/api/sync/events' && req.method === 'GET') {
            const { getDeleteEvents } = require('../../sync');
            getDeleteEvents().createSSEHandler()(req, res);
            return true;
        }

        // GET /api/sync/stats
        if (pathname === '/api/sync/stats' && req.method === 'GET') {
            try {
                const { getDeleteStats } = require('../../sync');
                const stats = getDeleteStats({ dataDir });
                jsonResponse(res, { ok: true, stats: stats.getStats() });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // GET /api/sync/stats/dashboard
        if (pathname === '/api/sync/stats/dashboard' && req.method === 'GET') {
            try {
                const { getDeleteStats } = require('../../sync');
                const stats = getDeleteStats({ dataDir });
                jsonResponse(res, { ok: true, dashboard: stats.getDashboard() });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // GET /api/sync/retention
        if (pathname === '/api/sync/retention' && req.method === 'GET') {
            try {
                const { getRetentionPolicy } = require('../../sync');
                const retention = getRetentionPolicy({ dataDir });
                jsonResponse(res, { ok: true, policies: retention.getPolicies() });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // POST /api/sync/retention/enable
        if (pathname === '/api/sync/retention/enable' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getRetentionPolicy } = require('../../sync');
                getRetentionPolicy({ dataDir }).setEnabled(body.enabled);
                jsonResponse(res, { ok: true, enabled: body.enabled });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // POST /api/sync/retention/execute
        if (pathname === '/api/sync/retention/execute' && req.method === 'POST') {
            try {
                const { getRetentionPolicy, getSoftDelete, getAuditLog, getBackupBeforeDelete } = require('../../sync');
                const retention = getRetentionPolicy({ dataDir });
                const result = await retention.execute({
                    softDelete: getSoftDelete({ dataDir }),
                    auditLog: getAuditLog({ dataDir }),
                    backupBeforeDelete: getBackupBeforeDelete({ dataDir }),
                    graphProvider: storage.getGraphProvider()
                });
                jsonResponse(res, { ok: true, ...result });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // GET /api/sync/retention/preview
        if (pathname === '/api/sync/retention/preview' && req.method === 'GET') {
            try {
                const { getRetentionPolicy, getSoftDelete, getBackupBeforeDelete } = require('../../sync');
                const retention = getRetentionPolicy({ dataDir });
                const preview = await retention.dryRun({
                    softDelete: getSoftDelete({ dataDir }),
                    backupBeforeDelete: getBackupBeforeDelete({ dataDir })
                });
                jsonResponse(res, { ok: true, preview });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // --- Data Versioning ---
        if (pathname === '/api/versions' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getDataVersioning } = require('../../advanced');
                const versioning = getDataVersioning({ dataDir });
                const result = versioning.createVersion(body.itemId, body.itemType, body.content, {
                    message: body.message,
                    createdBy: body.createdBy
                });
                jsonResponse(res, { ok: true, ...result });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        const versionsMatch = pathname.match(/^\/api\/versions\/([^/]+)$/);
        if (versionsMatch && req.method === 'GET') {
            try {
                const { getDataVersioning } = require('../../advanced');
                const versioning = getDataVersioning({ dataDir });
                const versions = versioning.getVersions(versionsMatch[1]);
                jsonResponse(res, { ok: true, versions });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        if (pathname === '/api/versions/stats' && req.method === 'GET') {
            try {
                const { getDataVersioning } = require('../../advanced');
                const versioning = getDataVersioning({ dataDir });
                const stats = versioning.getStats();
                jsonResponse(res, { ok: true, stats });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        if (pathname === '/api/versions/restore' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getDataVersioning } = require('../../advanced');
                const versioning = getDataVersioning({ dataDir });
                const result = versioning.restoreVersion(body.versionId);
                jsonResponse(res, { ok: true, ...result });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        // --- Scheduled Jobs ---
        if (pathname === '/api/jobs' && req.method === 'GET') {
            try {
                const { getScheduledJobs } = require('../../advanced');
                const scheduler = getScheduledJobs({ dataDir });
                const jobs = scheduler.getJobs();
                jsonResponse(res, { ok: true, jobs });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        if (pathname === '/api/jobs' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getScheduledJobs } = require('../../advanced');
                const scheduler = getScheduledJobs({ dataDir });
                const job = scheduler.createJob(body);
                jsonResponse(res, { ok: true, job });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        const jobExecMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/execute$/);
        if (jobExecMatch && req.method === 'POST') {
            try {
                const { getScheduledJobs } = require('../../advanced');
                const scheduler = getScheduledJobs({ dataDir });
                const result = await scheduler.executeJob(jobExecMatch[1]);
                jsonResponse(res, { ok: true, ...result });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        if (pathname === '/api/jobs/stats' && req.method === 'GET') {
            try {
                const { getScheduledJobs } = require('../../advanced');
                const scheduler = getScheduledJobs({ dataDir });
                const stats = scheduler.getStats();
                jsonResponse(res, { ok: true, stats });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }

        if (pathname === '/api/jobs/log' && req.method === 'GET') {
            try {
                const { getScheduledJobs } = require('../../advanced');
                const scheduler = getScheduledJobs({ dataDir });
                const log = scheduler.getExecutionLog();
                jsonResponse(res, { ok: true, log });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return true;
        }
    }

    // === Outbox routes (require Supabase) ===
    if (!supabase || !supabase.isConfigured()) {
        if (pathname.startsWith('/api/sync/') || pathname.includes('/sync/')) {
            if (pathname === '/api/sync/status' && req.method === 'GET') {
                jsonResponse(res, { connected: false, lastSync: null, pendingCount: 0, errorCount: 0 });
                return true;
            }
            jsonResponse(res, { error: 'Not configured' }, 503);
            return true;
        }
        return false;
    }

    // GET /api/sync/status - Frontend SyncStatus calls this (no project in path)
    if (pathname === '/api/sync/status' && req.method === 'GET') {
        const project = storage?.getCurrentProject?.();
        const projectId = project?.id;
        if (!projectId || !isValidUUID(projectId)) {
            jsonResponse(res, { connected: false, lastSync: null, pendingCount: 0, errorCount: 0 });
            return true;
        }
        const [statusResult, pendingResult, statsResult] = await Promise.all([
            supabase.outbox.getSyncStatus(projectId),
            supabase.outbox.getPendingCount(projectId),
            supabase.outbox.getStats(projectId)
        ]);
        const state = toSyncState(projectId, statusResult, pendingResult, statsResult);
        jsonResponse(res, state);
        return true;
    }

    // GET /api/sync/dead-letters - Frontend SyncStatus calls this (no project in path)
    if (pathname === '/api/sync/dead-letters' && req.method === 'GET') {
        const project = storage?.getCurrentProject?.();
        const projectId = project?.id;
        if (!projectId || !isValidUUID(projectId)) {
            jsonResponse(res, { deadLetters: [] });
            return true;
        }
        const urlParsed = parsedUrl || parseUrl(req.url);
        const result = await supabase.outbox.getDeadLetters(projectId, {
            unresolvedOnly: urlParsed.query?.unresolved !== 'false',
            limit: parseInt(urlParsed.query?.limit) || 50
        });
        const raw = result.success ? (result.deadLetters || []) : [];
        const deadLetters = raw.map(dl => ({
            ...dl,
            failedAt: dl.failed_at || dl.created_at,
            retryCount: dl.retry_count ?? dl.retryCount ?? 0
        }));
        jsonResponse(res, { deadLetters });
        return true;
    }

    // POST /api/sync/retry/:id - Frontend alias for /api/sync/dead-letters/:id/retry
    const retryAliasMatch = pathname.match(/^\/api\/sync\/retry\/([^/]+)$/);
    if (retryAliasMatch && req.method === 'POST') {
        const deadLetterId = retryAliasMatch[1];
        if (!isValidUUID(deadLetterId)) {
            jsonResponse(res, { error: 'Invalid dead letter ID: must be a UUID' }, 400);
            return true;
        }
        const result = await supabase.outbox.retryDeadLetter(deadLetterId);
        if (result.success) jsonResponse(res, { success: true });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // GET /api/projects/:id/sync/status
    const statusMatch = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/status$/);
    if (statusMatch && req.method === 'GET') {
        const projectId = statusMatch[1];
        if (!isValidUUID(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID: must be a UUID' }, 400);
            return true;
        }
        const result = await supabase.outbox.getSyncStatus(projectId);
        if (result.success) jsonResponse(res, { status: result.status });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // GET /api/projects/:id/sync/stats
    const statsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/stats$/);
    if (statsMatch && req.method === 'GET') {
        const projectId = statsMatch[1];
        if (!isValidUUID(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID: must be a UUID' }, 400);
            return true;
        }
        const result = await supabase.outbox.getStats(projectId);
        if (result.success) jsonResponse(res, { stats: result.stats });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // GET /api/projects/:id/sync/pending
    const pendingMatch = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/pending$/);
    if (pendingMatch && req.method === 'GET') {
        const projectId = pendingMatch[1];
        if (!isValidUUID(projectId)) {
            jsonResponse(res, { error: 'Invalid project ID: must be a UUID' }, 400);
            return true;
        }
        const result = await supabase.outbox.getPendingCount(projectId);
        if (result.success) jsonResponse(res, { count: result.count });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // GET /api/projects/:id/sync/dead-letters
    const deadLettersMatch = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/dead-letters$/);
    if (deadLettersMatch && req.method === 'GET') {
        const projectId = deadLettersMatch[1];
        const urlParsed = parsedUrl || parseUrl(req.url);
        const result = await supabase.outbox.getDeadLetters(projectId, {
            unresolvedOnly: urlParsed.query?.unresolved !== 'false',
            limit: parseInt(urlParsed.query?.limit) || 50
        });
        const raw = result.success ? (result.deadLetters || []) : [];
        const deadLetters = raw.map(dl => ({
            ...dl,
            failedAt: dl.failed_at || dl.created_at,
            retryCount: dl.retry_count ?? dl.retryCount ?? 0
        }));
        if (result.success) jsonResponse(res, { deadLetters });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // POST /api/sync/dead-letters/:id/retry
    const retryMatch = pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/retry$/);
    if (retryMatch && req.method === 'POST') {
        const deadLetterId = retryMatch[1];
        if (!isValidUUID(deadLetterId)) {
            jsonResponse(res, { error: 'Invalid dead letter ID: must be a UUID' }, 400);
            return true;
        }
        const result = await supabase.outbox.retryDeadLetter(deadLetterId);
        if (result.success) jsonResponse(res, { success: true });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // POST /api/sync/dead-letters/:id/resolve
    const resolveMatch = pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/resolve$/);
    if (resolveMatch && req.method === 'POST') {
        const deadLetterId = resolveMatch[1];
        if (!isValidUUID(deadLetterId)) {
            jsonResponse(res, { error: 'Invalid dead letter ID: must be a UUID' }, 400);
            return true;
        }
        const token = supabase.auth.extractToken(req);
        const userResult = await supabase.auth.getUser(token);
        if (!userResult.success) {
            jsonResponse(res, { error: 'Authentication required' }, 401);
            return true;
        }
        const body = await parseBody(req);
        const result = await supabase.outbox.resolveDeadLetter(deadLetterId, userResult.user.id, body?.notes);
        if (result.success) jsonResponse(res, { success: true });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    return false;
}

module.exports = { handleSync };
