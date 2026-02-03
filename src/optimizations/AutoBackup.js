/**
 * Auto-Backup Module
 * Automatic backup of graph and data
 * 
 * Note: Backups are stored locally on disk (not in Supabase)
 * but knowledge data is fetched from SupabaseStorage
 */

const fs = require('fs');
const path = require('path');
// Try to load Supabase - may fail due to project folder name conflict
let getStorage = null;
try {
    getStorage = require('../supabase/storageHelper').getStorage;
} catch (e) {
    // Will use legacy storage methods
}

class AutoBackup {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
        this.backupDir = options.backupDir || './backups';
        this.maxBackups = options.maxBackups || 10;
        this.autoBackupInterval = options.autoBackupInterval || 24 * 60 * 60 * 1000; // 24 hours
        
        // Ensure backup directory exists
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }

        this.intervalId = null;
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

    setGraphProvider(provider) {
        this.graphProvider = provider;
    }

    /**
     * Create a full backup
     */
    async createBackup(name = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = name || `backup-${timestamp}`;
        const backupPath = path.join(this.backupDir, backupName);

        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
        }

        const results = {
            name: backupName,
            timestamp: new Date().toISOString(),
            files: []
        };

        try {
            // Backup graph data
            if (this.graphProvider && this.graphProvider.connected) {
                const graphBackup = await this.backupGraph();
                if (graphBackup.success) {
                    const graphFile = path.join(backupPath, 'graph.json');
                    fs.writeFileSync(graphFile, JSON.stringify(graphBackup.data, null, 2));
                    results.files.push('graph.json');
                    results.graphNodes = graphBackup.data.nodes?.length || 0;
                }
            }

            // Backup knowledge base from Supabase
            const knowledgeBackup = await this.backupKnowledgeBase();
            if (knowledgeBackup) {
                const kbFile = path.join(backupPath, 'knowledge-base.json');
                fs.writeFileSync(kbFile, JSON.stringify(knowledgeBackup, null, 2));
                results.files.push('knowledge-base.json');
                results.knowledgeItems = knowledgeBackup.stats?.total || 0;
            }

            // Backup configuration
            const configBackup = await this.backupConfig();
            if (configBackup) {
                const configFile = path.join(backupPath, 'config.json');
                fs.writeFileSync(configFile, JSON.stringify(configBackup, null, 2));
                results.files.push('config.json');
            }

            // Create manifest
            const manifest = {
                version: '2.0',
                created: results.timestamp,
                source: 'supabase',
                files: results.files,
                stats: {
                    graphNodes: results.graphNodes || 0,
                    knowledgeItems: results.knowledgeItems || 0
                }
            };
            fs.writeFileSync(path.join(backupPath, 'manifest.json'), JSON.stringify(manifest, null, 2));

            // Cleanup old backups
            await this.cleanupOldBackups();

            results.success = true;
            results.path = backupPath;
            console.log(`[AutoBackup] Created backup: ${backupName}`);

        } catch (e) {
            results.success = false;
            results.error = e.message;
            console.log(`[AutoBackup] Backup failed: ${e.message}`);
        }

        return results;
    }

    /**
     * Backup graph data
     */
    async backupGraph() {
        try {
            // Get all nodes
            const nodesResult = await this.graphProvider.query(
                'MATCH (n) RETURN id(n) as id, labels(n) as labels, properties(n) as props'
            );

            // Get all relationships
            const relsResult = await this.graphProvider.query(
                'MATCH (a)-[r]->(b) RETURN id(a) as source, id(b) as target, type(r) as type, properties(r) as props'
            );

            return {
                success: true,
                data: {
                    nodes: nodesResult.results || [],
                    relationships: relsResult.results || [],
                    exportedAt: new Date().toISOString()
                }
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Backup knowledge base from Supabase
     */
    async backupKnowledgeBase() {
        try {
            const storage = this._getStorage();
            
            // Export all project data
            const exportData = await storage.exportProjectData();
            
            // Calculate stats
            const stats = {
                facts: exportData.knowledge?.facts?.length || 0,
                decisions: exportData.knowledge?.decisions?.length || 0,
                risks: exportData.knowledge?.risks?.length || 0,
                questions: exportData.knowledge?.questions?.length || 0,
                people: exportData.knowledge?.people?.length || 0,
                actions: exportData.knowledge?.actions?.length || 0,
                documents: exportData.documents?.length || 0,
                contacts: exportData.contacts?.length || 0,
                total: 0
            };
            stats.total = Object.values(stats).reduce((a, b) => a + b, 0);
            
            return {
                ...exportData,
                stats
            };
        } catch (e) {
            console.warn('[AutoBackup] Knowledge backup failed:', e.message);
            return null;
        }
    }

    /**
     * Backup configuration from Supabase
     */
    async backupConfig() {
        try {
            const storage = this._getStorage();
            const config = await storage.getConfig();
            
            // Redact sensitive data
            if (config?.llm_config?.providers) {
                for (const provider of Object.values(config.llm_config.providers)) {
                    if (provider.apiKey) provider.apiKey = '[REDACTED]';
                }
            }
            
            return config;
        } catch (e) {
            console.log('[AutoBackup] Config backup failed:', e.message);
            return null;
        }
    }

    /**
     * Restore from backup
     */
    async restore(backupName) {
        const backupPath = path.join(this.backupDir, backupName);
        
        if (!fs.existsSync(backupPath)) {
            return { success: false, error: 'Backup not found' };
        }

        const results = {
            name: backupName,
            restored: [],
            warnings: []
        };

        try {
            const storage = this._getStorage();
            
            // Restore knowledge base
            const kbFile = path.join(backupPath, 'knowledge-base.json');
            if (fs.existsSync(kbFile)) {
                const kb = JSON.parse(fs.readFileSync(kbFile, 'utf-8'));
                
                // Restore facts
                if (kb.knowledge?.facts) {
                    for (const fact of kb.knowledge.facts) {
                        try {
                            await storage.addFact(fact, true); // skipDedup
                        } catch (e) {
                            results.warnings.push(`Fact: ${e.message}`);
                        }
                    }
                }
                
                // Restore decisions
                if (kb.knowledge?.decisions) {
                    for (const decision of kb.knowledge.decisions) {
                        try {
                            await storage.addDecision(decision);
                        } catch (e) {
                            results.warnings.push(`Decision: ${e.message}`);
                        }
                    }
                }
                
                // Restore risks
                if (kb.knowledge?.risks) {
                    for (const risk of kb.knowledge.risks) {
                        try {
                            await storage.addRisk(risk);
                        } catch (e) {
                            results.warnings.push(`Risk: ${e.message}`);
                        }
                    }
                }
                
                results.restored.push('knowledge-base');
            }

            // Restore graph (if connected)
            const graphFile = path.join(backupPath, 'graph.json');
            if (fs.existsSync(graphFile) && this.graphProvider?.connected) {
                const graphData = JSON.parse(fs.readFileSync(graphFile, 'utf-8'));
                await this.restoreGraph(graphData);
                results.restored.push('graph');
            }

            results.success = true;
            console.log(`[AutoBackup] Restored backup: ${backupName}`);

        } catch (e) {
            results.success = false;
            results.error = e.message;
        }

        return results;
    }

    /**
     * Restore graph from backup data
     */
    async restoreGraph(graphData) {
        // Create nodes
        for (const node of graphData.nodes || []) {
            const label = node.labels?.[0] || 'Node';
            const props = node.props || {};
            const propsStr = Object.entries(props)
                .map(([k, v]) => `${k}: $${k}`)
                .join(', ');
            
            await this.graphProvider.query(
                `MERGE (n:${label} {${propsStr}})`,
                props
            );
        }
    }

    /**
     * List available backups
     */
    listBackups() {
        const backups = [];
        
        if (!fs.existsSync(this.backupDir)) {
            return backups;
        }

        const dirs = fs.readdirSync(this.backupDir);
        
        for (const dir of dirs) {
            const manifestPath = path.join(this.backupDir, dir, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                    backups.push({
                        name: dir,
                        created: manifest.created,
                        source: manifest.source || 'local',
                        files: manifest.files,
                        stats: manifest.stats
                    });
                } catch (e) {
                    backups.push({ name: dir, error: 'Invalid manifest' });
                }
            }
        }

        return backups.sort((a, b) => 
            new Date(b.created || 0) - new Date(a.created || 0)
        );
    }

    /**
     * Cleanup old backups
     */
    async cleanupOldBackups() {
        const backups = this.listBackups();
        
        if (backups.length <= this.maxBackups) {
            return { removed: 0 };
        }

        const toRemove = backups.slice(this.maxBackups);
        let removed = 0;

        for (const backup of toRemove) {
            try {
                const backupPath = path.join(this.backupDir, backup.name);
                fs.rmSync(backupPath, { recursive: true });
                removed++;
            } catch (e) {
                console.log(`[AutoBackup] Failed to remove ${backup.name}: ${e.message}`);
            }
        }

        return { removed };
    }

    /**
     * Start auto backup
     */
    startAutoBackup() {
        console.log(`[AutoBackup] Starting auto backup every ${this.autoBackupInterval / 1000 / 60 / 60} hours`);
        
        this.intervalId = setInterval(async () => {
            await this.createBackup();
        }, this.autoBackupInterval);
    }

    /**
     * Stop auto backup
     */
    stopAutoBackup() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Delete a backup
     */
    deleteBackup(backupName) {
        const backupPath = path.join(this.backupDir, backupName);
        
        if (!fs.existsSync(backupPath)) {
            return { success: false, error: 'Backup not found' };
        }

        try {
            fs.rmSync(backupPath, { recursive: true });
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

// Singleton
let autoBackupInstance = null;
function getAutoBackup(options = {}) {
    if (!autoBackupInstance) {
        autoBackupInstance = new AutoBackup(options);
    }
    if (options.graphProvider) autoBackupInstance.setGraphProvider(options.graphProvider);
    return autoBackupInstance;
}

module.exports = { AutoBackup, getAutoBackup };
