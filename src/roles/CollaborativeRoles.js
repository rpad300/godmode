/**
 * Collaborative Roles
 * Multi-user support with different roles in the same project
 */

const fs = require('fs');
const path = require('path');

class CollaborativeRoles {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.usersFile = path.join(this.dataDir, 'project-users.json');
        this.data = this.load();
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.usersFile = path.join(dataDir, 'project-users.json');
        this.data = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.usersFile)) {
                return JSON.parse(fs.readFileSync(this.usersFile, 'utf8'));
            }
        } catch (e) {
            console.error('[CollaborativeRoles] Load error:', e.message);
        }
        return {
            users: [],
            invitations: [],
            activityLog: []
        };
    }

    save() {
        try {
            fs.mkdirSync(this.dataDir, { recursive: true });
            fs.writeFileSync(this.usersFile, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error('[CollaborativeRoles] Save error:', e.message);
        }
    }

    /**
     * Add a user to the project
     */
    addUser(user) {
        const existingUser = this.data.users.find(u => u.id === user.id || u.email === user.email);
        if (existingUser) {
            return { success: false, error: 'User already exists' };
        }
        
        const newUser = {
            id: user.id || `user_${Date.now()}`,
            name: user.name,
            email: user.email,
            role: user.role || '',
            rolePrompt: user.rolePrompt || '',
            permissions: user.permissions || ['read'],
            joinedAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            status: 'active'
        };
        
        this.data.users.push(newUser);
        this.logActivity('user_added', { userId: newUser.id, name: newUser.name });
        this.save();
        
        return { success: true, user: newUser };
    }

    /**
     * Update a user
     */
    updateUser(userId, updates) {
        const user = this.data.users.find(u => u.id === userId);
        if (!user) {
            return { success: false, error: 'User not found' };
        }
        
        const allowedFields = ['name', 'role', 'rolePrompt', 'permissions', 'status'];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                user[field] = updates[field];
            }
        });
        
        user.lastActive = new Date().toISOString();
        this.logActivity('user_updated', { userId, updates: Object.keys(updates) });
        this.save();
        
        return { success: true, user };
    }

    /**
     * Remove a user
     */
    removeUser(userId) {
        const index = this.data.users.findIndex(u => u.id === userId);
        if (index === -1) {
            return { success: false, error: 'User not found' };
        }
        
        const removed = this.data.users.splice(index, 1)[0];
        this.logActivity('user_removed', { userId, name: removed.name });
        this.save();
        
        return { success: true, removed };
    }

    /**
     * Get all users
     */
    getUsers(options = {}) {
        const { status = null, role = null } = options;
        
        let users = this.data.users;
        
        if (status) {
            users = users.filter(u => u.status === status);
        }
        
        if (role) {
            users = users.filter(u => u.role?.toLowerCase().includes(role.toLowerCase()));
        }
        
        return users;
    }

    /**
     * Get a user by ID
     */
    getUser(userId) {
        return this.data.users.find(u => u.id === userId);
    }

    /**
     * Create an invitation
     */
    createInvitation(invitation) {
        const inv = {
            id: `inv_${Date.now()}`,
            email: invitation.email,
            role: invitation.role || '',
            rolePrompt: invitation.rolePrompt || '',
            permissions: invitation.permissions || ['read'],
            invitedBy: invitation.invitedBy,
            message: invitation.message || '',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
            status: 'pending'
        };
        
        this.data.invitations.push(inv);
        this.logActivity('invitation_created', { invitationId: inv.id, email: inv.email });
        this.save();
        
        return { success: true, invitation: inv };
    }

    /**
     * Accept an invitation
     */
    acceptInvitation(invitationId, user) {
        const inv = this.data.invitations.find(i => i.id === invitationId);
        if (!inv) {
            return { success: false, error: 'Invitation not found' };
        }
        
        if (inv.status !== 'pending') {
            return { success: false, error: 'Invitation already used' };
        }
        
        if (new Date(inv.expiresAt) < new Date()) {
            inv.status = 'expired';
            this.save();
            return { success: false, error: 'Invitation expired' };
        }
        
        // Create user from invitation
        const result = this.addUser({
            id: user.id,
            name: user.name,
            email: inv.email,
            role: inv.role,
            rolePrompt: inv.rolePrompt,
            permissions: inv.permissions
        });
        
        if (result.success) {
            inv.status = 'accepted';
            inv.acceptedAt = new Date().toISOString();
            this.logActivity('invitation_accepted', { invitationId, userId: result.user.id });
            this.save();
        }
        
        return result;
    }

    /**
     * Get pending invitations
     */
    getPendingInvitations() {
        return this.data.invitations.filter(i => 
            i.status === 'pending' && 
            new Date(i.expiresAt) > new Date()
        );
    }

    /**
     * Get users by role
     */
    getUsersByRole() {
        const byRole = {};
        
        this.data.users.forEach(user => {
            const role = user.role || 'Unassigned';
            if (!byRole[role]) {
                byRole[role] = [];
            }
            byRole[role].push(user);
        });
        
        return byRole;
    }

    /**
     * Get role distribution
     */
    getRoleDistribution() {
        const distribution = {};
        
        this.data.users.forEach(user => {
            const role = user.role || 'Unassigned';
            distribution[role] = (distribution[role] || 0) + 1;
        });
        
        return Object.entries(distribution)
            .map(([role, count]) => ({ role, count }))
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Check if user has permission
     */
    hasPermission(userId, permission) {
        const user = this.getUser(userId);
        if (!user) return false;
        
        return user.permissions.includes(permission) || user.permissions.includes('admin');
    }

    /**
     * Log activity
     */
    logActivity(action, data) {
        this.data.activityLog.push({
            timestamp: new Date().toISOString(),
            action,
            data
        });
        
        // Keep last 500 entries
        if (this.data.activityLog.length > 500) {
            this.data.activityLog = this.data.activityLog.slice(-500);
        }
    }

    /**
     * Get activity log
     */
    getActivityLog(options = {}) {
        const { limit = 50, action = null } = options;
        
        let log = this.data.activityLog;
        
        if (action) {
            log = log.filter(l => l.action === action);
        }
        
        return log.slice(-limit).reverse();
    }

    /**
     * Get collaboration stats
     */
    getStats() {
        const users = this.data.users;
        const activeUsers = users.filter(u => u.status === 'active');
        const pendingInvitations = this.getPendingInvitations();
        
        return {
            totalUsers: users.length,
            activeUsers: activeUsers.length,
            pendingInvitations: pendingInvitations.length,
            roleDistribution: this.getRoleDistribution(),
            recentActivity: this.getActivityLog({ limit: 10 })
        };
    }
}

// Singleton
let instance = null;
function getCollaborativeRoles(options) {
    if (!instance) {
        instance = new CollaborativeRoles(options);
    }
    return instance;
}

module.exports = { CollaborativeRoles, getCollaborativeRoles };
