/**
 * Role Analytics
 * Track and analyze usage patterns by role
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');

const log = logger.child({ module: 'role-analytics' });

class RoleAnalytics {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.analyticsFile = path.join(this.dataDir, 'role-analytics.json');
        this.analytics = this.load();
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.analyticsFile = path.join(dataDir, 'role-analytics.json');
        this.analytics = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.analyticsFile)) {
                return JSON.parse(fs.readFileSync(this.analyticsFile, 'utf8'));
            }
        } catch (e) {
            log.error({ event: 'role_analytics_load_failed', message: e.message }, 'Load error');
        }
        return {
            interactions: [],
            aggregated: {},
            lastUpdated: null
        };
    }

    save() {
        try {
            fs.mkdirSync(this.dataDir, { recursive: true });
            fs.writeFileSync(this.analyticsFile, JSON.stringify(this.analytics, null, 2));
        } catch (e) {
            log.error({ event: 'role_analytics_save_failed', message: e.message }, 'Save error');
        }
    }

    /**
     * Track a user interaction
     */
    trackInteraction(interaction) {
        const entry = {
            timestamp: new Date().toISOString(),
            userRole: interaction.userRole || 'unknown',
            type: interaction.type, // 'question', 'view', 'search', 'action', etc.
            category: interaction.category, // 'facts', 'risks', 'decisions', etc.
            query: interaction.query,
            resultCount: interaction.resultCount,
            duration: interaction.duration
        };
        
        this.analytics.interactions.push(entry);
        
        // Keep only last 1000 interactions
        if (this.analytics.interactions.length > 1000) {
            this.analytics.interactions = this.analytics.interactions.slice(-1000);
        }
        
        // Update aggregated stats
        this.updateAggregated(entry);
        this.analytics.lastUpdated = new Date().toISOString();
        
        this.save();
        return entry;
    }

    /**
     * Update aggregated statistics
     */
    updateAggregated(entry) {
        const role = entry.userRole;
        if (!this.analytics.aggregated[role]) {
            this.analytics.aggregated[role] = {
                totalInteractions: 0,
                byType: {},
                byCategory: {},
                byHour: {},
                byDay: {},
                avgDuration: 0,
                totalDuration: 0,
                topQueries: []
            };
        }
        
        const stats = this.analytics.aggregated[role];
        stats.totalInteractions++;
        
        // By type
        stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
        
        // By category
        if (entry.category) {
            stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
        }
        
        // By hour
        const hour = new Date(entry.timestamp).getHours();
        stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
        
        // By day of week
        const day = new Date(entry.timestamp).toLocaleDateString('en-US', { weekday: 'short' });
        stats.byDay[day] = (stats.byDay[day] || 0) + 1;
        
        // Duration
        if (entry.duration) {
            stats.totalDuration += entry.duration;
            stats.avgDuration = stats.totalDuration / stats.totalInteractions;
        }
        
        // Top queries
        if (entry.query) {
            const existingQuery = stats.topQueries.find(q => q.query === entry.query);
            if (existingQuery) {
                existingQuery.count++;
            } else {
                stats.topQueries.push({ query: entry.query, count: 1 });
            }
            stats.topQueries.sort((a, b) => b.count - a.count);
            stats.topQueries = stats.topQueries.slice(0, 20);
        }
    }

    /**
     * Get analytics for a specific role
     */
    getRoleAnalytics(role) {
        const stats = this.analytics.aggregated[role];
        if (!stats) {
            return {
                role,
                hasData: false,
                message: 'No analytics data for this role yet'
            };
        }
        
        // Calculate insights
        const topType = Object.entries(stats.byType)
            .sort((a, b) => b[1] - a[1])[0];
        
        const topCategory = Object.entries(stats.byCategory)
            .sort((a, b) => b[1] - a[1])[0];
        
        const peakHour = Object.entries(stats.byHour)
            .sort((a, b) => b[1] - a[1])[0];
        
        const peakDay = Object.entries(stats.byDay)
            .sort((a, b) => b[1] - a[1])[0];
        
        return {
            role,
            hasData: true,
            stats: {
                totalInteractions: stats.totalInteractions,
                avgDuration: Math.round(stats.avgDuration),
                byType: stats.byType,
                byCategory: stats.byCategory,
                byHour: stats.byHour,
                byDay: stats.byDay,
                topQueries: stats.topQueries.slice(0, 10)
            },
            insights: {
                primaryActivity: topType ? `${topType[0]} (${topType[1]} times)` : null,
                focusArea: topCategory ? topCategory[0] : null,
                peakHour: peakHour ? `${peakHour[0]}:00` : null,
                peakDay: peakDay ? peakDay[0] : null
            }
        };
    }

    /**
     * Get comparative analytics across roles
     */
    getComparativeAnalytics() {
        const roles = Object.keys(this.analytics.aggregated);
        
        if (roles.length === 0) {
            return { hasData: false, message: 'No analytics data yet' };
        }
        
        const comparison = roles.map(role => {
            const stats = this.analytics.aggregated[role];
            return {
                role,
                totalInteractions: stats.totalInteractions,
                topType: Object.entries(stats.byType)
                    .sort((a, b) => b[1] - a[1])[0]?.[0],
                topCategory: Object.entries(stats.byCategory)
                    .sort((a, b) => b[1] - a[1])[0]?.[0],
                avgDuration: Math.round(stats.avgDuration)
            };
        }).sort((a, b) => b.totalInteractions - a.totalInteractions);
        
        return {
            hasData: true,
            roles: comparison,
            totalRoles: roles.length,
            totalInteractions: comparison.reduce((sum, r) => sum + r.totalInteractions, 0)
        };
    }

    /**
     * Get content recommendations based on role activity
     */
    getRecommendations(role) {
        const stats = this.analytics.aggregated[role];
        if (!stats) {
            return [];
        }
        
        const recommendations = [];
        
        // Based on low-activity areas
        const allCategories = ['facts', 'decisions', 'risks', 'actions', 'questions'];
        const usedCategories = Object.keys(stats.byCategory);
        const unusedCategories = allCategories.filter(c => !usedCategories.includes(c));
        
        if (unusedCategories.length > 0) {
            recommendations.push({
                type: 'explore',
                message: `Consider exploring: ${unusedCategories.join(', ')}`,
                categories: unusedCategories
            });
        }
        
        // Based on high-activity areas
        const topCategory = Object.entries(stats.byCategory)
            .sort((a, b) => b[1] - a[1])[0];
        
        if (topCategory && topCategory[1] > 10) {
            recommendations.push({
                type: 'deep_dive',
                message: `You're very focused on ${topCategory[0]}. Consider setting up notifications for this area.`,
                category: topCategory[0]
            });
        }
        
        return recommendations;
    }

    /**
     * Get dashboard data for role analytics
     */
    getDashboard(role) {
        const roleStats = this.getRoleAnalytics(role);
        const comparative = this.getComparativeAnalytics();
        const recommendations = this.getRecommendations(role);
        
        // Recent activity
        const recentActivity = this.analytics.interactions
            .filter(i => i.userRole === role)
            .slice(-20)
            .reverse();
        
        return {
            role,
            roleStats,
            comparative,
            recommendations,
            recentActivity,
            lastUpdated: this.analytics.lastUpdated
        };
    }

    /**
     * Clear analytics data
     */
    clear() {
        this.analytics = {
            interactions: [],
            aggregated: {},
            lastUpdated: null
        };
        this.save();
    }
}

// Singleton
let instance = null;
function getRoleAnalytics(options) {
    if (!instance) {
        instance = new RoleAnalytics(options);
    }
    return instance;
}

module.exports = { RoleAnalytics, getRoleAnalytics };
