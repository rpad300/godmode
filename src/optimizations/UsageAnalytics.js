/**
 * Purpose:
 *   Collect, buffer, and analyze system usage data (API requests, queries,
 *   feature usage, errors) with Supabase as the persistence layer.
 *
 * Responsibilities:
 *   - Buffer analytics events in memory and flush to Supabase every 30
 *     seconds to reduce write frequency
 *   - Track four event types: request, query, feature, and error
 *   - Provide aggregated summaries (today, last 7 days, top endpoints,
 *     top features) with a 1-minute cache
 *   - Compute hourly distribution and daily trend over configurable windows
 *   - Report error rate and popular queries
 *   - Export a complete analytics snapshot
 *
 * Key dependencies:
 *   - ../supabase/storageHelper: usage_analytics table access (soft-loaded)
 *
 * Side effects:
 *   - Starts a 30-second flush interval on construction
 *   - Writes batched analytics events to Supabase on flush
 *   - Reads from Supabase for summary/trend queries
 *
 * Notes:
 *   - If Supabase is unavailable, buffered events accumulate in memory
 *     until it becomes available or the process restarts (events are lost).
 *   - Query text is truncated to 500 characters before storage to limit
 *     row size.
 *   - Call destroy() before shutdown to flush remaining buffered events
 *     and clear the interval.
 */

const { logger } = require('../logger');

const log = logger.child({ module: 'usage-analytics' });

// Try to load Supabase - may fail due to project folder name conflict
let getStorage = null;
try {
    getStorage = require('../supabase/storageHelper').getStorage;
} catch (e) {
    // Will use in-memory analytics only
}

class UsageAnalytics {
    constructor(options = {}) {
        // In-memory buffer for batching writes
        this._buffer = {
            requests: [],
            queries: [],
            features: {},
            errors: []
        };
        
        // Flush interval (batch writes to Supabase)
        this._flushInterval = setInterval(() => this._flush(), 30000); // 30 seconds
        
        // Cache for reads
        this._cache = {
            summary: null,
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

    /**
     * Flush buffered data to Supabase
     */
    async _flush() {
        const storage = this._getStorage();
        
        try {
            // Batch insert analytics events
            const events = [];
            
            // Add request events
            for (const req of this._buffer.requests) {
                events.push({
                    event_type: 'request',
                    event_name: req.endpoint,
                    event_data: {
                        duration: req.duration,
                        error: req.error
                    }
                });
            }
            
            // Add query events
            for (const query of this._buffer.queries) {
                events.push({
                    event_type: 'query',
                    event_name: query.source || 'search',
                    event_data: {
                        query: query.query.substring(0, 500),
                        duration: query.duration,
                        resultsCount: query.resultsCount,
                        cached: query.cached
                    }
                });
            }
            
            // Add feature events
            for (const [feature, count] of Object.entries(this._buffer.features)) {
                for (let i = 0; i < count; i++) {
                    events.push({
                        event_type: 'feature',
                        event_name: feature,
                        event_data: {}
                    });
                }
            }
            
            // Add error events
            for (const error of this._buffer.errors) {
                events.push({
                    event_type: 'error',
                    event_name: error.context,
                    event_data: {
                        message: error.message,
                        stack: error.stack
                    }
                });
            }
            
            // Insert all events
            if (events.length > 0) {
                const supabase = storage.supabase;
                const projectId = storage.currentProjectId;
                
                if (projectId) {
                    await supabase.from('usage_analytics').insert(
                        events.map(e => ({
                            project_id: projectId,
                            ...e,
                            created_at: new Date().toISOString()
                        }))
                    );
                }
            }
            
            // Clear buffer
            this._buffer = {
                requests: [],
                queries: [],
                features: {},
                errors: []
            };
        } catch (e) {
            log.warn({ event: 'usage_analytics_flush_failed', message: e.message }, 'Could not flush data');
        }
    }

    /**
     * Track an API request
     */
    trackRequest(endpoint, options = {}) {
        this._buffer.requests.push({
            endpoint,
            duration: options.duration,
            error: options.error,
            timestamp: Date.now()
        });
        
        // Invalidate cache
        this._cache.lastRefresh = 0;
    }

    /**
     * Track a query
     */
    trackQuery(query, options = {}) {
        this._buffer.queries.push({
            query: query.substring(0, 500),
            duration: options.duration || 0,
            resultsCount: options.resultsCount || 0,
            source: options.source || 'unknown',
            cached: options.cached || false,
            timestamp: Date.now()
        });
        
        // Invalidate cache
        this._cache.lastRefresh = 0;
    }

    /**
     * Track feature usage
     */
    trackFeature(feature, action = 'use') {
        this._buffer.features[feature] = (this._buffer.features[feature] || 0) + 1;
    }

    /**
     * Track an error
     */
    trackError(error, context = {}) {
        this._buffer.errors.push({
            message: error.message || String(error),
            context: context.endpoint || context.feature || 'unknown',
            stack: error.stack?.substring(0, 500),
            timestamp: Date.now()
        });
    }

    /**
     * Get usage summary from Supabase
     */
    async getSummary() {
        // Return cached if fresh
        if (Date.now() - this._cache.lastRefresh < this._cacheTTL && this._cache.summary) {
            return this._cache.summary;
        }
        
        try {
            const storage = this._getStorage();
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            
            if (!projectId) {
                return this._getEmptySummary();
            }
            
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            
            // Get today's stats
            const { data: todayData } = await supabase
                .from('usage_analytics')
                .select('event_type', { count: 'exact' })
                .eq('project_id', projectId)
                .gte('created_at', today);
            
            // Get 7-day stats
            const { data: weekData } = await supabase
                .from('usage_analytics')
                .select('event_type, event_name')
                .eq('project_id', projectId)
                .gte('created_at', sevenDaysAgo);
            
            // Calculate stats
            const todayRequests = (todayData || []).filter(e => e.event_type === 'request').length;
            const todayQueries = (todayData || []).filter(e => e.event_type === 'query').length;
            const todayErrors = (todayData || []).filter(e => e.event_type === 'error').length;
            
            const weekRequests = (weekData || []).filter(e => e.event_type === 'request').length;
            const weekQueries = (weekData || []).filter(e => e.event_type === 'query').length;
            const weekErrors = (weekData || []).filter(e => e.event_type === 'error').length;
            
            // Top endpoints
            const endpointCounts = {};
            for (const e of (weekData || []).filter(e => e.event_type === 'request')) {
                endpointCounts[e.event_name] = (endpointCounts[e.event_name] || 0) + 1;
            }
            const topEndpoints = Object.entries(endpointCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([endpoint, count]) => ({ endpoint, count }));
            
            // Top features
            const featureCounts = {};
            for (const e of (weekData || []).filter(e => e.event_type === 'feature')) {
                featureCounts[e.event_name] = (featureCounts[e.event_name] || 0) + 1;
            }
            const topFeatures = Object.entries(featureCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([feature, uses]) => ({ feature, uses }));
            
            const summary = {
                today: { requests: todayRequests, queries: todayQueries, errors: todayErrors },
                last7Days: {
                    requests: weekRequests,
                    queries: weekQueries,
                    errors: weekErrors,
                    avgRequestsPerDay: Math.round(weekRequests / 7)
                },
                topEndpoints,
                topFeatures,
                recentErrors: []
            };
            
            this._cache.summary = summary;
            this._cache.lastRefresh = Date.now();
            
            return summary;
        } catch (e) {
            log.warn({ event: 'usage_analytics_summary_failed', message: e.message }, 'Could not get summary');
            return this._getEmptySummary();
        }
    }

    /**
     * Get empty summary structure
     */
    _getEmptySummary() {
        return {
            today: { requests: 0, queries: 0, errors: 0 },
            last7Days: { requests: 0, queries: 0, errors: 0, avgRequestsPerDay: 0 },
            topEndpoints: [],
            topFeatures: [],
            recentErrors: []
        };
    }

    /**
     * Get top endpoints
     */
    async getTopEndpoints(limit = 10) {
        const summary = await this.getSummary();
        return summary.topEndpoints.slice(0, limit);
    }

    /**
     * Get top features
     */
    async getTopFeatures(limit = 10) {
        const summary = await this.getSummary();
        return summary.topFeatures.slice(0, limit);
    }

    /**
     * Get popular queries
     */
    async getPopularQueries(limit = 20) {
        try {
            const storage = this._getStorage();
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            
            if (!projectId) return [];
            
            const { data } = await supabase
                .from('usage_analytics')
                .select('event_data')
                .eq('project_id', projectId)
                .eq('event_type', 'query')
                .order('created_at', { ascending: false })
                .limit(500);
            
            const queryCounts = {};
            for (const entry of (data || [])) {
                const query = entry.event_data?.query?.toLowerCase().trim();
                if (query) {
                    queryCounts[query] = (queryCounts[query] || 0) + 1;
                }
            }
            
            return Object.entries(queryCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit)
                .map(([query, count]) => ({ query, count }));
        } catch (e) {
            return [];
        }
    }

    /**
     * Get hourly distribution
     */
    async getHourlyDistribution() {
        try {
            const storage = this._getStorage();
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            
            if (!projectId) return new Array(24).fill(0);
            
            const { data } = await supabase
                .from('usage_analytics')
                .select('created_at')
                .eq('project_id', projectId)
                .eq('event_type', 'request');
            
            const distribution = new Array(24).fill(0);
            for (const entry of (data || [])) {
                const hour = new Date(entry.created_at).getHours();
                distribution[hour]++;
            }
            
            return distribution;
        } catch (e) {
            return new Array(24).fill(0);
        }
    }

    /**
     * Get daily trend
     */
    async getDailyTrend(days = 30) {
        try {
            const storage = this._getStorage();
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            
            if (!projectId) return [];
            
            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
            
            const { data } = await supabase
                .from('usage_analytics')
                .select('event_type, created_at')
                .eq('project_id', projectId)
                .gte('created_at', startDate);
            
            // Group by date
            const dailyStats = {};
            for (const entry of (data || [])) {
                const date = entry.created_at.split('T')[0];
                if (!dailyStats[date]) {
                    dailyStats[date] = { requests: 0, queries: 0, errors: 0 };
                }
                if (entry.event_type === 'request') dailyStats[date].requests++;
                if (entry.event_type === 'query') dailyStats[date].queries++;
                if (entry.event_type === 'error') dailyStats[date].errors++;
            }
            
            // Build trend array
            const trend = [];
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                trend.push({
                    date,
                    ...(dailyStats[date] || { requests: 0, queries: 0, errors: 0 })
                });
            }
            
            return trend;
        } catch (e) {
            return [];
        }
    }

    /**
     * Get error rate
     */
    async getErrorRate() {
        const summary = await this.getSummary();
        const totalRequests = summary.last7Days.requests;
        const totalErrors = summary.last7Days.errors;

        if (totalRequests === 0) return '0%';
        return ((totalErrors / totalRequests) * 100).toFixed(2) + '%';
    }

    /**
     * Export analytics
     */
    async exportData() {
        return {
            exportedAt: new Date().toISOString(),
            summary: await this.getSummary(),
            dailyTrend: await this.getDailyTrend(30),
            hourlyDistribution: await this.getHourlyDistribution(),
            popularQueries: await this.getPopularQueries(50)
        };
    }

    /**
     * Stop auto-flush and flush remaining data
     */
    async destroy() {
        if (this._flushInterval) {
            clearInterval(this._flushInterval);
        }
        await this._flush();
    }
}

// Singleton
let usageAnalyticsInstance = null;
function getUsageAnalytics(options = {}) {
    if (!usageAnalyticsInstance) {
        usageAnalyticsInstance = new UsageAnalytics(options);
    }
    return usageAnalyticsInstance;
}

module.exports = { UsageAnalytics, getUsageAnalytics };
