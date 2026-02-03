/**
 * Role History
 * Track role changes over time
 */

const fs = require('fs');
const path = require('path');

class RoleHistory {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.historyFile = path.join(this.dataDir, 'role-history.json');
        this.history = this.load();
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.historyFile = path.join(dataDir, 'role-history.json');
        this.history = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.historyFile)) {
                return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
            }
        } catch (e) {
            console.error('[RoleHistory] Load error:', e.message);
        }
        return {
            changes: [],
            perspectives: []
        };
    }

    save() {
        try {
            fs.mkdirSync(this.dataDir, { recursive: true });
            fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
        } catch (e) {
            console.error('[RoleHistory] Save error:', e.message);
        }
    }

    /**
     * Record a role change
     */
    recordChange(change) {
        const entry = {
            id: `change_${Date.now()}`,
            timestamp: new Date().toISOString(),
            previousRole: change.previousRole || null,
            previousRolePrompt: change.previousRolePrompt || null,
            newRole: change.newRole,
            newRolePrompt: change.newRolePrompt || null,
            reason: change.reason || null,
            projectId: change.projectId || null
        };
        
        this.history.changes.push(entry);
        
        // Keep last 100 changes
        if (this.history.changes.length > 100) {
            this.history.changes = this.history.changes.slice(-100);
        }
        
        this.save();
        return entry;
    }

    /**
     * Record a perspective switch (temporary role view)
     */
    recordPerspectiveSwitch(perspectiveSwitch) {
        const entry = {
            id: `persp_${Date.now()}`,
            timestamp: new Date().toISOString(),
            originalRole: perspectiveSwitch.originalRole,
            viewedAsRole: perspectiveSwitch.viewedAsRole,
            duration: perspectiveSwitch.duration || null,
            context: perspectiveSwitch.context || null
        };
        
        this.history.perspectives.push(entry);
        
        // Keep last 200 perspective switches
        if (this.history.perspectives.length > 200) {
            this.history.perspectives = this.history.perspectives.slice(-200);
        }
        
        this.save();
        return entry;
    }

    /**
     * Get role change history
     */
    getChanges(options = {}) {
        const { projectId, limit = 50 } = options;
        
        let changes = this.history.changes;
        
        if (projectId) {
            changes = changes.filter(c => c.projectId === projectId);
        }
        
        return changes.slice(-limit).reverse();
    }

    /**
     * Get perspective switch history
     */
    getPerspectives(options = {}) {
        const { limit = 50 } = options;
        return this.history.perspectives.slice(-limit).reverse();
    }

    /**
     * Get timeline of role evolution
     */
    getTimeline(projectId = null) {
        const changes = this.getChanges({ projectId, limit: 100 });
        
        if (changes.length === 0) {
            return { hasData: false };
        }
        
        // Group by month
        const byMonth = {};
        changes.forEach(c => {
            const month = c.timestamp.substring(0, 7); // YYYY-MM
            if (!byMonth[month]) {
                byMonth[month] = [];
            }
            byMonth[month].push(c);
        });
        
        // Calculate stats
        const uniqueRoles = [...new Set(changes.map(c => c.newRole).filter(Boolean))];
        const firstChange = changes[changes.length - 1];
        const lastChange = changes[0];
        
        return {
            hasData: true,
            totalChanges: changes.length,
            uniqueRoles,
            byMonth,
            firstChange,
            lastChange,
            mostCommonRole: this.getMostCommonRole(changes)
        };
    }

    /**
     * Get most common role from changes
     */
    getMostCommonRole(changes) {
        const counts = {};
        changes.forEach(c => {
            if (c.newRole) {
                counts[c.newRole] = (counts[c.newRole] || 0) + 1;
            }
        });
        
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? sorted[0][0] : null;
    }

    /**
     * Get frequently used perspectives
     */
    getFrequentPerspectives() {
        const counts = {};
        this.history.perspectives.forEach(p => {
            counts[p.viewedAsRole] = (counts[p.viewedAsRole] || 0) + 1;
        });
        
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([role, count]) => ({ role, count }));
    }

    /**
     * Get insights from role history
     */
    getInsights() {
        const changes = this.history.changes;
        const perspectives = this.history.perspectives;
        
        const insights = [];
        
        // Role stability
        if (changes.length > 5) {
            const recentChanges = changes.slice(-5);
            const timeBetweenChanges = [];
            for (let i = 1; i < recentChanges.length; i++) {
                const diff = new Date(recentChanges[i].timestamp) - new Date(recentChanges[i-1].timestamp);
                timeBetweenChanges.push(diff);
            }
            const avgDays = timeBetweenChanges.reduce((a, b) => a + b, 0) / timeBetweenChanges.length / (1000 * 60 * 60 * 24);
            
            if (avgDays < 7) {
                insights.push({
                    type: 'warning',
                    message: 'Role changes frequently. Consider stabilizing your role definition.'
                });
            } else if (avgDays > 90) {
                insights.push({
                    type: 'info',
                    message: 'Role has been stable. Good consistency!'
                });
            }
        }
        
        // Perspective usage
        if (perspectives.length > 10) {
            const freqPersp = this.getFrequentPerspectives();
            if (freqPersp.length > 0 && freqPersp[0].count > 5) {
                insights.push({
                    type: 'suggestion',
                    message: `You often view as "${freqPersp[0].role}". Consider if this should be your primary role.`
                });
            }
        }
        
        return insights;
    }

    /**
     * Clear history
     */
    clear() {
        this.history = {
            changes: [],
            perspectives: []
        };
        this.save();
    }
}

// Singleton
let instance = null;
function getRoleHistory(options) {
    if (!instance) {
        instance = new RoleHistory(options);
    }
    return instance;
}

module.exports = { RoleHistory, getRoleHistory };
