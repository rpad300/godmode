/**
 * Retention Policy Module
 * Automatic data retention and cleanup based on policies
 */

const fs = require('fs');
const path = require('path');

class RetentionPolicy {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.policyFile = path.join(this.dataDir, 'retention-policy.json');
        this.policies = this.loadPolicies();
        this.executionLog = [];
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.policyFile = path.join(this.dataDir, 'retention-policy.json');
        this.policies = this.loadPolicies();
    }

    loadPolicies() {
        try {
            if (fs.existsSync(this.policyFile)) {
                return JSON.parse(fs.readFileSync(this.policyFile, 'utf8'));
            }
        } catch (e) {
            // Ignore
        }
        return this.getDefaultPolicies();
    }

    getDefaultPolicies() {
        return {
            enabled: false, // Off by default for safety
            policies: [
                {
                    id: 'soft_delete_purge',
                    name: 'Purge Soft Deleted Items',
                    description: 'Permanently delete soft-deleted items after retention period',
                    type: 'soft_delete',
                    retentionDays: 30,
                    enabled: true
                },
                {
                    id: 'audit_log_retention',
                    name: 'Audit Log Retention',
                    description: 'Keep audit logs for compliance period',
                    type: 'audit_log',
                    retentionDays: 365,
                    enabled: true
                },
                {
                    id: 'backup_retention',
                    name: 'Delete Backup Retention',
                    description: 'Clean up old delete backups',
                    type: 'backup',
                    retentionDays: 90,
                    enabled: true
                },
                {
                    id: 'orphan_cleanup',
                    name: 'Orphan Node Cleanup',
                    description: 'Remove orphaned graph nodes',
                    type: 'orphan',
                    intervalDays: 7, // Run weekly
                    enabled: true
                }
            ],
            lastExecution: null,
            nextExecution: null
        };
    }

    savePolicies() {
        try {
            const dir = path.dirname(this.policyFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.policyFile, JSON.stringify(this.policies, null, 2));
        } catch (e) {
            console.log(`[RetentionPolicy] Save warning: ${e.message}`);
        }
    }

    /**
     * Enable/disable retention policies
     */
    setEnabled(enabled) {
        this.policies.enabled = enabled;
        this.savePolicies();
        console.log(`[RetentionPolicy] Policies ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Update a specific policy
     */
    updatePolicy(policyId, updates) {
        const policy = this.policies.policies.find(p => p.id === policyId);
        if (policy) {
            Object.assign(policy, updates);
            this.savePolicies();
            return policy;
        }
        return null;
    }

    /**
     * Add a custom policy
     */
    addPolicy(policy) {
        if (!policy.id) {
            policy.id = `policy_${Date.now()}`;
        }
        this.policies.policies.push(policy);
        this.savePolicies();
        return policy;
    }

    /**
     * Execute retention policies
     */
    async execute(dependencies = {}) {
        if (!this.policies.enabled) {
            return { executed: false, reason: 'Policies disabled' };
        }

        const results = {
            executed: true,
            timestamp: new Date().toISOString(),
            policyResults: []
        };

        for (const policy of this.policies.policies) {
            if (!policy.enabled) continue;

            try {
                const result = await this.executePolicy(policy, dependencies);
                results.policyResults.push({
                    id: policy.id,
                    name: policy.name,
                    ...result
                });
            } catch (e) {
                results.policyResults.push({
                    id: policy.id,
                    name: policy.name,
                    error: e.message
                });
            }
        }

        this.policies.lastExecution = results.timestamp;
        this.policies.nextExecution = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Next day
        this.savePolicies();

        this.executionLog.unshift(results);
        if (this.executionLog.length > 50) {
            this.executionLog = this.executionLog.slice(0, 50);
        }

        console.log(`[RetentionPolicy] Executed ${results.policyResults.length} policies`);
        return results;
    }

    async executePolicy(policy, dependencies) {
        const { softDelete, auditLog, backupBeforeDelete, graphProvider } = dependencies;
        const now = Date.now();

        switch (policy.type) {
            case 'soft_delete':
                if (softDelete) {
                    const purged = softDelete.purgeExpired();
                    return { purged, action: 'purge_soft_deleted' };
                }
                break;

            case 'audit_log':
                // Audit logs are retained, no action needed unless purging old entries
                return { action: 'retained', retentionDays: policy.retentionDays };

            case 'backup':
                if (backupBeforeDelete) {
                    const stats = backupBeforeDelete.getStats();
                    const cutoff = new Date(now - policy.retentionDays * 24 * 60 * 60 * 1000);
                    let deleted = 0;
                    
                    const backups = backupBeforeDelete.listBackups();
                    for (const backup of backups.backups) {
                        if (new Date(backup.createdAt) < cutoff) {
                            backupBeforeDelete.deleteBackup(backup.id);
                            deleted++;
                        }
                    }
                    return { deleted, action: 'cleanup_backups' };
                }
                break;

            case 'orphan':
                if (graphProvider && graphProvider.connected) {
                    const result = await graphProvider.query(`
                        MATCH (n)
                        WHERE NOT (n)--()
                        AND NOT n:Person AND NOT n:Project AND NOT n:Organization AND NOT n:Technology
                        DELETE n
                        RETURN count(n) as deleted
                    `);
                    return { deleted: result.results?.[0]?.deleted || 0, action: 'cleanup_orphans' };
                }
                break;

            default:
                return { action: 'unknown_policy_type' };
        }

        return { action: 'no_action', reason: 'Missing dependencies' };
    }

    /**
     * Get all policies
     */
    getPolicies() {
        return this.policies;
    }

    /**
     * Get execution log
     */
    getExecutionLog() {
        return this.executionLog;
    }

    /**
     * Dry run - preview what would be cleaned up
     */
    async dryRun(dependencies = {}) {
        const preview = {
            timestamp: new Date().toISOString(),
            wouldExecute: []
        };

        for (const policy of this.policies.policies) {
            if (!policy.enabled) continue;

            const policyPreview = {
                id: policy.id,
                name: policy.name,
                type: policy.type
            };

            switch (policy.type) {
                case 'soft_delete':
                    if (dependencies.softDelete) {
                        const stats = dependencies.softDelete.getStats();
                        policyPreview.itemsToDelete = stats.expiringSoon;
                    }
                    break;
                case 'backup':
                    if (dependencies.backupBeforeDelete) {
                        const stats = dependencies.backupBeforeDelete.getStats();
                        policyPreview.currentBackups = stats.totalBackups;
                    }
                    break;
            }

            preview.wouldExecute.push(policyPreview);
        }

        return preview;
    }
}

// Singleton
let instance = null;
function getRetentionPolicy(options = {}) {
    if (!instance) {
        instance = new RetentionPolicy(options);
    }
    if (options.dataDir) instance.setDataDir(options.dataDir);
    return instance;
}

module.exports = { RetentionPolicy, getRetentionPolicy };
