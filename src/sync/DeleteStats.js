/**
 * Purpose:
 *   Collects, persists, and reports quantitative metrics on delete, restore,
 *   and purge operations for dashboards and health monitoring.
 *
 * Responsibilities:
 *   - Record individual delete/restore/purge events, updating both Supabase
 *     tables and an in-memory session counter
 *   - Aggregate statistics from Supabase (by type, hour, day, month) with a
 *     TTL-based cache to avoid excessive queries
 *   - Compute derived health indicators (graph sync rate, soft-delete rate)
 *   - Provide a dashboard-ready summary including health status thresholds
 *
 * Key dependencies:
 *   - ../supabase/storageHelper: Supabase client for persisted stats (optional;
 *     gracefully degrades to in-memory-only tracking)
 *   - ../logger: structured warning logging
 *
 * Side effects:
 *   - Writes to `delete_stats` and `delete_audit_log` Supabase tables via RPC
 *     and inserts
 *   - `recordPurge` issues N individual RPC calls (one per purged item);
 *     Assumption: purge counts are small enough that this is acceptable
 *
 * Notes:
 *   - Supabase import may fail at require-time due to a project folder name
 *     conflict; the module falls back to in-memory tracking only.
 *   - Cache TTL is 60 seconds; `_cache.lastRefresh = 0` invalidates it.
 *   - Session stats (`_sessionStats`) are never persisted; they exist only for
 *     the current process lifetime.
 */

const { logger } = require('../logger');

const log = logger.child({ module: 'delete-stats' });

// Try to load Supabase - may fail due to project folder name conflict
let getStorage = null;
try {
    getStorage = require('../supabase/storageHelper').getStorage;
} catch (e) {
    log.warn({ event: 'delete_stats_supabase_unavailable' }, 'Supabase not available, using in-memory tracking only');
}

class DeleteStats {
    constructor(options = {}) {
        // In-memory stats for current session
        this._sessionStats = this._getDefaultStats();
        
        // Cache for Supabase data
        this._cache = {
            stats: null,
            lastRefresh: 0
        };
        this._cacheTTL = 60000; // 1 minute
    }

    /**
     * Get storage instance
     */
    _getStorage() {
        if (!getStorage) return null;
        try {
            return getStorage();
        } catch (e) {
            return null;
        }
    }

    _getDefaultStats() {
        return {
            totalDeletes: 0,
            totalRestores: 0,
            totalPurges: 0,
            byType: {},
            byHour: {},
            byDay: {},
            byMonth: {},
            graphSyncSuccess: 0,
            graphSyncFailed: 0,
            cascadeDeletes: 0,
            softDeletes: 0,
            hardDeletes: 0,
            batchOperations: 0,
            avgDeleteDuration: 0,
            deleteDurations: [],
            lastUpdated: null
        };
    }

    /**
     * Refresh cache from Supabase
     */
    async _refreshCache() {
        if (Date.now() - this._cache.lastRefresh < this._cacheTTL) {
            return;
        }
        
        try {
            const storage = this._getStorage();
            if (!storage) return;
            
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            
            if (!projectId) return;
            
            // Get delete stats from Supabase
            const { data } = await supabase
                .from('delete_stats')
                .select('*')
                .eq('project_id', projectId);
            
            // Aggregate by type
            const stats = this._getDefaultStats();
            
            for (const row of (data || [])) {
                stats.totalDeletes += row.total_deleted || 0;
                stats.totalRestores += row.total_restored || 0;
                stats.totalPurges += row.total_purged || 0;
                stats.byType[row.entity_type] = row.total_deleted || 0;
            }
            
            // Get audit log stats
            const { data: auditData } = await supabase
                .from('delete_audit_log')
                .select('action, performed_at')
                .eq('project_id', projectId)
                .gte('performed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
            
            // Calculate distributions
            for (const row of (auditData || [])) {
                const date = new Date(row.performed_at);
                const hour = date.getHours();
                const day = date.toLocaleDateString('en-US', { weekday: 'short' });
                const month = row.performed_at.substring(0, 7);
                
                stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
                stats.byDay[day] = (stats.byDay[day] || 0) + 1;
                stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
                
                if (row.action === 'soft_delete') stats.softDeletes++;
                if (row.action === 'delete') stats.hardDeletes++;
                if (row.action === 'restore') stats.totalRestores++;
                if (row.action === 'cascade_delete') stats.cascadeDeletes++;
            }
            
            this._cache = {
                stats,
                lastRefresh: Date.now()
            };
        } catch (e) {
            log.warn({ event: 'delete_stats_refresh_error', reason: e.message }, 'Could not refresh cache');
        }
    }

    /**
     * Record a delete operation
     */
    async recordDelete(options) {
        try {
            const storage = this._getStorage();
            if (!storage) {
                // Fall back to session stats
                this._sessionStats.totalDeletes++;
                return;
            }
            
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            const user = await storage.getCurrentUser();
            
            if (!projectId) return;
            
            const entityType = options.entityType || 'unknown';
            const action = options.softDelete ? 'soft_delete' : 'delete';
            
            // Update delete_stats table
            await supabase.rpc('update_delete_stats', {
                p_project_id: projectId,
                p_entity_type: entityType,
                p_action: 'delete'
            });
            
            // Add to audit log
            await supabase.from('delete_audit_log').insert({
                project_id: projectId,
                action: options.cascade ? 'cascade_delete' : action,
                entity_type: entityType,
                entity_id: options.entityId || '00000000-0000-0000-0000-000000000000',
                entity_snapshot: options.snapshot,
                cascade_count: options.cascadeCount || 0,
                reason: options.reason,
                performed_by: user?.id
            });
            
            // Invalidate cache
            this._cache.lastRefresh = 0;
            
            // Update session stats
            this._sessionStats.totalDeletes++;
            if (options.softDelete) this._sessionStats.softDeletes++;
            else this._sessionStats.hardDeletes++;
            if (options.cascade) this._sessionStats.cascadeDeletes++;
            if (options.graphSynced) this._sessionStats.graphSyncSuccess++;
            else if (options.graphAttempted) this._sessionStats.graphSyncFailed++;
            
        } catch (e) {
            log.warn({ event: 'delete_stats_record_delete_error', reason: e.message }, 'Could not record delete');
            this._sessionStats.totalDeletes++;
        }
    }

    /**
     * Record a restore operation
     */
    async recordRestore(options) {
        try {
            const storage = this._getStorage();
            if (!storage) {
                this._sessionStats.totalRestores++;
                return;
            }
            
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            const user = await storage.getCurrentUser();
            
            if (!projectId) return;
            
            await supabase.rpc('update_delete_stats', {
                p_project_id: projectId,
                p_entity_type: options.entityType || 'unknown',
                p_action: 'restore'
            });
            
            await supabase.from('delete_audit_log').insert({
                project_id: projectId,
                action: 'restore',
                entity_type: options.entityType || 'unknown',
                entity_id: options.entityId || '00000000-0000-0000-0000-000000000000',
                performed_by: user?.id
            });
            
            this._cache.lastRefresh = 0;
            this._sessionStats.totalRestores++;
            
        } catch (e) {
            log.warn({ event: 'delete_stats_record_restore_error', reason: e.message }, 'Could not record restore');
            this._sessionStats.totalRestores++;
        }
    }

    /**
     * Record a purge operation
     */
    async recordPurge(count, entityType = 'unknown') {
        try {
            const storage = this._getStorage();
            if (!storage) {
                this._sessionStats.totalPurges += count;
                return;
            }
            
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            
            if (!projectId) return;
            
            for (let i = 0; i < count; i++) {
                await supabase.rpc('update_delete_stats', {
                    p_project_id: projectId,
                    p_entity_type: entityType,
                    p_action: 'purge'
                });
            }
            
            this._cache.lastRefresh = 0;
            this._sessionStats.totalPurges += count;
            
        } catch (e) {
            log.warn({ event: 'delete_stats_record_purge_error', reason: e.message }, 'Could not record purge');
            this._sessionStats.totalPurges += count;
        }
    }

    /**
     * Get all statistics
     */
    async getStats() {
        await this._refreshCache();
        
        const stats = this._cache.stats || this._sessionStats;
        
        return {
            ...stats,
            graphSyncRate: stats.graphSyncSuccess + stats.graphSyncFailed > 0
                ? Math.round((stats.graphSyncSuccess / (stats.graphSyncSuccess + stats.graphSyncFailed)) * 100)
                : 100,
            softDeleteRate: stats.totalDeletes > 0
                ? Math.round((stats.softDeletes / stats.totalDeletes) * 100)
                : 0
        };
    }

    /**
     * Get dashboard data
     */
    async getDashboard() {
        const stats = await this.getStats();
        
        return {
            summary: {
                totalDeletes: stats.totalDeletes,
                totalRestores: stats.totalRestores,
                graphSyncRate: stats.graphSyncRate + '%',
                avgDuration: stats.avgDeleteDuration + 'ms'
            },
            byType: stats.byType,
            hourlyDistribution: stats.byHour,
            dailyDistribution: stats.byDay,
            monthlyTrend: stats.byMonth,
            health: {
                graphSync: stats.graphSyncRate >= 95 ? 'healthy' : stats.graphSyncRate >= 80 ? 'warning' : 'critical',
                performance: stats.avgDeleteDuration < 500 ? 'healthy' : stats.avgDeleteDuration < 2000 ? 'warning' : 'slow'
            }
        };
    }

    /**
     * Reset session statistics
     */
    reset() {
        this._sessionStats = this._getDefaultStats();
        this._cache.lastRefresh = 0;
    }
}

// Singleton
let instance = null;
function getDeleteStats(options = {}) {
    if (!instance) {
        instance = new DeleteStats(options);
    }
    return instance;
}

module.exports = { DeleteStats, getDeleteStats };
