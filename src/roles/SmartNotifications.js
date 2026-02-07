/**
 * Smart Notifications
 * Role-aware notification filtering and prioritization
 */

const fs = require('fs');
const path = require('path');

// Role-based notification rules
const DEFAULT_RULES = {
    'tech_lead': {
        priority: ['security', 'architecture', 'technical_debt', 'performance'],
        filter: ['marketing', 'sales'],
        keywords: ['security', 'vulnerability', 'performance', 'architecture', 'refactor', 'debt']
    },
    'developer': {
        priority: ['bugs', 'features', 'code_review', 'deployment'],
        filter: ['budget', 'strategy'],
        keywords: ['bug', 'feature', 'deploy', 'review', 'merge', 'pr']
    },
    'project_manager': {
        priority: ['timeline', 'risks', 'blockers', 'milestones'],
        filter: ['code', 'technical_details'],
        keywords: ['deadline', 'risk', 'blocker', 'milestone', 'delay', 'budget']
    },
    'product_owner': {
        priority: ['user_feedback', 'features', 'roadmap', 'metrics'],
        filter: ['infrastructure', 'devops'],
        keywords: ['user', 'feedback', 'feature', 'requirement', 'priority', 'backlog']
    },
    'qa_engineer': {
        priority: ['bugs', 'testing', 'releases', 'quality'],
        filter: ['sales', 'marketing'],
        keywords: ['bug', 'test', 'regression', 'release', 'quality', 'defect']
    },
    'devops': {
        priority: ['deployment', 'infrastructure', 'security', 'monitoring'],
        filter: ['features', 'ux'],
        keywords: ['deploy', 'server', 'monitoring', 'alert', 'incident', 'infrastructure']
    },
    'executive': {
        priority: ['risks', 'budget', 'milestones', 'strategic'],
        filter: ['technical_details', 'bugs'],
        keywords: ['risk', 'budget', 'milestone', 'strategic', 'decision', 'approval']
    },
    'default': {
        priority: [],
        filter: [],
        keywords: []
    }
};

class SmartNotifications {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.configFile = path.join(this.dataDir, 'smart-notifications.json');
        this.config = this.load();
        this.subscribers = new Map();
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.configFile = path.join(dataDir, 'smart-notifications.json');
        this.config = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.configFile)) {
                return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
            }
        } catch (e) {
            console.error('[SmartNotifications] Load error:', e.message);
        }
        return {
            rules: { ...DEFAULT_RULES },
            customRules: {},
            history: [],
            enabled: true
        };
    }

    save() {
        try {
            fs.mkdirSync(this.dataDir, { recursive: true });
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
        } catch (e) {
            console.error('[SmartNotifications] Save error:', e.message);
        }
    }

    /**
     * Get notification rules for a role
     */
    getRulesForRole(role) {
        // Check custom rules first
        if (this.config.customRules[role]) {
            return { ...DEFAULT_RULES.default, ...this.config.customRules[role] };
        }
        
        // Check built-in rules
        const roleKey = this.normalizeRoleKey(role);
        return this.config.rules[roleKey] || DEFAULT_RULES.default;
    }

    /**
     * Normalize role to rule key
     */
    normalizeRoleKey(role) {
        if (!role) return 'default';
        const lower = role.toLowerCase();
        
        // Map common variations
        const mappings = {
            'tech lead': 'tech_lead',
            'technical lead': 'tech_lead',
            'architect': 'tech_lead',
            'software engineer': 'developer',
            'software developer': 'developer',
            'engineer': 'developer',
            'pm': 'project_manager',
            'manager': 'project_manager',
            'po': 'product_owner',
            'product manager': 'product_owner',
            'qa': 'qa_engineer',
            'tester': 'qa_engineer',
            'sre': 'devops',
            'ops': 'devops',
            'cto': 'executive',
            'ceo': 'executive',
            'director': 'executive'
        };
        
        for (const [key, value] of Object.entries(mappings)) {
            if (lower.includes(key)) return value;
        }
        
        // Try direct match
        if (this.config.rules[lower]) return lower;
        if (this.config.rules[lower.replace(/\s+/g, '_')]) return lower.replace(/\s+/g, '_');
        
        return 'default';
    }

    /**
     * Score a notification for a role
     */
    scoreNotification(notification, role) {
        const rules = this.getRulesForRole(role);
        let score = 50; // Base score
        
        const content = `${notification.title || ''} ${notification.message || ''} ${notification.category || ''}`.toLowerCase();
        const category = (notification.category || '').toLowerCase();
        
        // Boost for priority categories
        if (rules.priority.some(p => category.includes(p) || content.includes(p))) {
            score += 30;
        }
        
        // Reduce for filtered categories
        if (rules.filter.some(f => category.includes(f) || content.includes(f))) {
            score -= 40;
        }
        
        // Keyword matching
        const keywordMatches = rules.keywords.filter(k => content.includes(k)).length;
        score += keywordMatches * 10;
        
        // Urgency boost
        if (notification.urgent || notification.priority === 'high') {
            score += 20;
        }
        
        // Mentioned boost
        if (notification.mentions && notification.mentions.length > 0) {
            score += 15;
        }
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Filter and sort notifications for a role
     */
    filterForRole(notifications, role, options = {}) {
        const { threshold = 30, limit = 50 } = options;
        
        // Score all notifications
        const scored = notifications.map(n => ({
            ...n,
            roleScore: this.scoreNotification(n, role)
        }));
        
        // Filter by threshold
        const filtered = scored.filter(n => n.roleScore >= threshold);
        
        // Sort by score (descending) then by date
        filtered.sort((a, b) => {
            if (b.roleScore !== a.roleScore) return b.roleScore - a.roleScore;
            return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
        });
        
        return filtered.slice(0, limit);
    }

    /**
     * Create a notification
     */
    createNotification(notification) {
        const entry = {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            read: false,
            ...notification
        };
        
        this.config.history.unshift(entry);
        
        // Keep only last 500 notifications
        if (this.config.history.length > 500) {
            this.config.history = this.config.history.slice(0, 500);
        }
        
        this.save();
        
        // Notify subscribers
        this.notifySubscribers(entry);
        
        return entry;
    }

    /**
     * Get notifications for a role
     */
    getNotificationsForRole(role, options = {}) {
        const { unreadOnly = false, limit = 50 } = options;
        
        let notifications = this.config.history;
        
        if (unreadOnly) {
            notifications = notifications.filter(n => !n.read);
        }
        
        return this.filterForRole(notifications, role, { limit });
    }

    /**
     * Mark notifications as read
     */
    markAsRead(notificationIds) {
        let count = 0;
        notificationIds.forEach(id => {
            const notif = this.config.history.find(n => n.id === id);
            if (notif && !notif.read) {
                notif.read = true;
                count++;
            }
        });
        if (count > 0) this.save();
        return count;
    }

    /**
     * Set custom rules for a role
     */
    setCustomRules(role, rules) {
        this.config.customRules[role] = {
            priority: rules.priority || [],
            filter: rules.filter || [],
            keywords: rules.keywords || []
        };
        this.save();
    }

    /**
     * Subscribe to notifications
     */
    subscribe(subscriberId, callback) {
        this.subscribers.set(subscriberId, callback);
    }

    /**
     * Unsubscribe from notifications
     */
    unsubscribe(subscriberId) {
        this.subscribers.delete(subscriberId);
    }

    /**
     * Notify all subscribers
     */
    notifySubscribers(notification) {
        this.subscribers.forEach((callback, id) => {
            try {
                callback(notification);
            } catch (e) {
                console.error(`[SmartNotifications] Subscriber ${id} error:`, e.message);
            }
        });
    }

    /**
     * Get notification preferences
     */
    getPreferences(role) {
        return {
            role,
            rules: this.getRulesForRole(role),
            customRules: this.config.customRules[role] || null,
            enabled: this.config.enabled
        };
    }

    /**
     * Get notification stats
     */
    getStats(role) {
        const all = this.config.history;
        const forRole = this.filterForRole(all, role, { threshold: 0 });
        const highPriority = forRole.filter(n => n.roleScore >= 70);
        const unread = forRole.filter(n => !n.read);
        
        return {
            role,
            total: all.length,
            relevant: forRole.length,
            highPriority: highPriority.length,
            unread: unread.length,
            relevanceRate: all.length > 0 ? Math.round((forRole.length / all.length) * 100) : 0
        };
    }
}

// Singleton
let instance = null;
function getSmartNotifications(options) {
    if (!instance) {
        instance = new SmartNotifications(options);
    }
    return instance;
}

module.exports = { SmartNotifications, getSmartNotifications, DEFAULT_RULES };
