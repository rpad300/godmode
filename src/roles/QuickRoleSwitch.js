/**
 * Quick Role Switch
 * Temporarily view the system from a different role perspective
 */

const { getRoleHistory } = require('./RoleHistory');
const { getRoleTemplates } = require('./RoleTemplates');

class QuickRoleSwitch {
    constructor(options = {}) {
        this.storage = options.storage;
        this.history = options.history || getRoleHistory();
        this.templates = options.templates || getRoleTemplates();
        
        // Active perspective sessions
        this.activePerspectives = new Map();
    }

    setStorage(storage) {
        this.storage = storage;
    }

    setHistory(history) {
        this.history = history;
    }

    /**
     * Switch to a different role perspective temporarily
     */
    switchPerspective(userId, newRole, options = {}) {
        const { duration = 30 * 60 * 1000, reason = null } = options; // Default 30 min
        
        // Get current role
        const project = this.storage?.getCurrentProject?.();
        const originalRole = project?.userRole || '';
        const originalRolePrompt = project?.userRolePrompt || '';
        
        // Create perspective session
        const session = {
            id: `persp_${Date.now()}`,
            userId,
            originalRole,
            originalRolePrompt,
            viewingAsRole: newRole,
            viewingAsRolePrompt: this.getRolePromptForRole(newRole),
            startedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + duration).toISOString(),
            reason
        };
        
        this.activePerspectives.set(userId, session);
        
        // Record in history
        this.history.recordPerspectiveSwitch({
            originalRole,
            viewedAsRole: newRole,
            context: reason
        });
        
        return session;
    }

    /**
     * Get role prompt for a role (from templates)
     */
    getRolePromptForRole(role) {
        const template = this.templates.suggestFromTitle(role)[0];
        return template?.prompt || '';
    }

    /**
     * Get current perspective for a user
     */
    getCurrentPerspective(userId) {
        const session = this.activePerspectives.get(userId);
        
        if (!session) {
            return null;
        }
        
        // Check if expired
        if (new Date(session.expiresAt) < new Date()) {
            this.activePerspectives.delete(userId);
            return null;
        }
        
        return session;
    }

    /**
     * Get effective role (considering active perspective)
     */
    getEffectiveRole(userId) {
        const perspective = this.getCurrentPerspective(userId);
        
        if (perspective) {
            return {
                role: perspective.viewingAsRole,
                rolePrompt: perspective.viewingAsRolePrompt,
                isPerspective: true,
                originalRole: perspective.originalRole,
                expiresAt: perspective.expiresAt
            };
        }
        
        const project = this.storage?.getCurrentProject?.();
        return {
            role: project?.userRole || '',
            rolePrompt: project?.userRolePrompt || '',
            isPerspective: false
        };
    }

    /**
     * End perspective session
     */
    endPerspective(userId) {
        const session = this.activePerspectives.get(userId);
        
        if (session) {
            // Calculate duration
            const duration = Date.now() - new Date(session.startedAt).getTime();
            
            // Update history with duration
            this.history.recordPerspectiveSwitch({
                originalRole: session.originalRole,
                viewedAsRole: session.viewingAsRole,
                duration,
                context: session.reason
            });
            
            this.activePerspectives.delete(userId);
            
            return {
                ended: true,
                duration,
                session
            };
        }
        
        return { ended: false };
    }

    /**
     * Extend perspective session
     */
    extendPerspective(userId, additionalTime = 15 * 60 * 1000) {
        const session = this.activePerspectives.get(userId);
        
        if (session) {
            const currentExpiry = new Date(session.expiresAt);
            session.expiresAt = new Date(currentExpiry.getTime() + additionalTime).toISOString();
            return session;
        }
        
        return null;
    }

    /**
     * Get available perspectives (quick switch options)
     */
    getAvailablePerspectives(currentRole) {
        // Get all template roles
        const allTemplates = this.templates.getAll();
        
        // Get frequently used perspectives
        const frequent = this.history.getFrequentPerspectives();
        const frequentRoles = frequent.map(f => f.role);
        
        // Build options
        const options = [];
        
        // Add frequent perspectives first
        frequent.slice(0, 3).forEach(f => {
            const template = allTemplates.find(t => 
                t.title.toLowerCase().includes(f.role.toLowerCase()) ||
                f.role.toLowerCase().includes(t.title.toLowerCase())
            );
            options.push({
                role: f.role,
                prompt: template?.prompt || '',
                icon: template?.icon || '👤',
                usageCount: f.count,
                source: 'frequent'
            });
        });
        
        // Add common contrasting roles
        const contrastingRoles = this.getContrastingRoles(currentRole);
        contrastingRoles.forEach(role => {
            if (!frequentRoles.includes(role.title)) {
                const template = this.templates.get(role.id);
                if (template) {
                    options.push({
                        role: template.title,
                        prompt: template.prompt,
                        icon: template.icon,
                        source: 'suggested'
                    });
                }
            }
        });
        
        return options.slice(0, 6);
    }

    /**
     * Get contrasting roles for current role
     */
    getContrastingRoles(currentRole) {
        const roleContrasts = {
            'tech_lead': ['project_manager', 'product_owner', 'executive'],
            'developer': ['qa_engineer', 'product_owner', 'tech_lead'],
            'project_manager': ['developer', 'executive', 'product_owner'],
            'product_owner': ['developer', 'qa_engineer', 'executive'],
            'qa_engineer': ['developer', 'product_owner', 'devops'],
            'devops': ['developer', 'qa_engineer', 'project_manager'],
            'executive': ['project_manager', 'tech_lead', 'product_owner'],
            'default': ['project_manager', 'developer', 'product_owner']
        };
        
        const normalized = this.normalizeRole(currentRole);
        const contrastIds = roleContrasts[normalized] || roleContrasts.default;
        
        return contrastIds.map(id => ({ id, ...this.templates.get(id) })).filter(r => r.title);
    }

    /**
     * Normalize role name
     */
    normalizeRole(role) {
        if (!role) return 'default';
        const lower = role.toLowerCase();
        
        const mappings = {
            'tech': 'tech_lead',
            'architect': 'tech_lead',
            'lead': 'tech_lead',
            'developer': 'developer',
            'engineer': 'developer',
            'pm': 'project_manager',
            'manager': 'project_manager',
            'product': 'product_owner',
            'qa': 'qa_engineer',
            'devops': 'devops',
            'executive': 'executive',
            'cto': 'executive'
        };
        
        for (const [key, value] of Object.entries(mappings)) {
            if (lower.includes(key)) return value;
        }
        
        return 'default';
    }

    /**
     * Get all active perspectives
     */
    getAllActivePerspectives() {
        const active = [];
        
        this.activePerspectives.forEach((session, userId) => {
            if (new Date(session.expiresAt) > new Date()) {
                active.push({ userId, ...session });
            }
        });
        
        return active;
    }
}

// Singleton
let instance = null;
function getQuickRoleSwitch(options) {
    if (!instance) {
        instance = new QuickRoleSwitch(options);
    }
    return instance;
}

module.exports = { QuickRoleSwitch, getQuickRoleSwitch };
