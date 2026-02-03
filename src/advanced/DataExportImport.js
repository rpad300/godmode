/**
 * Data Export/Import Module
 * Full project export and import for migration/backup
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class DataExportImport {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.exportDir = path.join(this.dataDir, 'exports');
        this.storage = options.storage;
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.exportDir = path.join(this.dataDir, 'exports');
    }

    setStorage(storage) {
        this.storage = storage;
    }

    /**
     * Export entire project
     */
    async exportProject(options = {}) {
        const exportId = `export_${Date.now()}`;
        const exportData = {
            id: exportId,
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            format: options.format || 'full',
            checksum: null,
            data: {}
        };

        try {
            // Export documents/facts
            if (this.storage) {
                exportData.data.facts = this.storage.getFacts?.() || [];
                exportData.data.questions = this.storage.getQuestions?.() || [];
                exportData.data.decisions = this.storage.getDecisions?.() || [];
                exportData.data.actions = this.storage.getActions?.() || [];
                exportData.data.risks = this.storage.getRisks?.() || [];
                exportData.data.contacts = this.storage.getContacts?.() || [];
                exportData.data.conversations = this.storage.getConversations?.() || [];
                exportData.data.teams = this.storage.getTeams?.() || [];
                exportData.data.people = this.storage.getPeople?.() || [];
                
                // Embeddings if requested
                if (options.includeEmbeddings) {
                    const embeddings = this.storage.loadEmbeddings?.();
                    exportData.data.embeddings = embeddings?.embeddings || [];
                }
            }

            // Export ontology
            try {
                const ontologyFile = path.join(this.dataDir, 'ontology', 'schema.json');
                if (fs.existsSync(ontologyFile)) {
                    exportData.data.ontology = JSON.parse(fs.readFileSync(ontologyFile, 'utf8'));
                }
            } catch (e) {}

            // Export config
            try {
                const configFile = path.join(this.dataDir, 'config.json');
                if (fs.existsSync(configFile)) {
                    exportData.data.config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                }
            } catch (e) {}

            // Calculate checksum
            const contentStr = JSON.stringify(exportData.data);
            exportData.checksum = crypto.createHash('sha256').update(contentStr).digest('hex');
            exportData.size = contentStr.length;

            // Save export file
            if (!fs.existsSync(this.exportDir)) {
                fs.mkdirSync(this.exportDir, { recursive: true });
            }

            const exportFile = path.join(this.exportDir, `${exportId}.json`);
            fs.writeFileSync(exportFile, JSON.stringify(exportData, null, 2));

            console.log(`[Export] Created export ${exportId} (${(exportData.size / 1024).toFixed(2)} KB)`);

            return {
                success: true,
                exportId,
                file: exportFile,
                checksum: exportData.checksum,
                size: exportData.size,
                counts: {
                    facts: exportData.data.facts?.length || 0,
                    questions: exportData.data.questions?.length || 0,
                    contacts: exportData.data.contacts?.length || 0,
                    conversations: exportData.data.conversations?.length || 0
                }
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Import project from export file
     */
    async importProject(exportFile, options = {}) {
        try {
            let exportData;

            if (typeof exportFile === 'string') {
                // File path
                if (!fs.existsSync(exportFile)) {
                    return { success: false, error: 'Export file not found' };
                }
                exportData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
            } else {
                // Already parsed data
                exportData = exportFile;
            }

            // Validate checksum
            const contentStr = JSON.stringify(exportData.data);
            const checksum = crypto.createHash('sha256').update(contentStr).digest('hex');
            
            if (exportData.checksum && checksum !== exportData.checksum) {
                return { success: false, error: 'Checksum mismatch - data may be corrupted' };
            }

            const imported = {
                facts: 0,
                questions: 0,
                decisions: 0,
                actions: 0,
                contacts: 0,
                conversations: 0
            };

            // Import data
            if (this.storage && exportData.data) {
                const merge = options.merge !== false; // Default to merge

                // Facts
                if (exportData.data.facts?.length > 0) {
                    for (const fact of exportData.data.facts) {
                        if (merge) {
                            this.storage.addFact?.(fact);
                        }
                        imported.facts++;
                    }
                }

                // Questions
                if (exportData.data.questions?.length > 0) {
                    for (const q of exportData.data.questions) {
                        if (merge) {
                            this.storage.addQuestion?.(q);
                        }
                        imported.questions++;
                    }
                }

                // Decisions
                if (exportData.data.decisions?.length > 0) {
                    for (const d of exportData.data.decisions) {
                        if (merge) {
                            this.storage.addDecision?.(d);
                        }
                        imported.decisions++;
                    }
                }

                // Contacts
                if (exportData.data.contacts?.length > 0) {
                    for (const c of exportData.data.contacts) {
                        if (merge) {
                            this.storage.addContact?.(c);
                        }
                        imported.contacts++;
                    }
                }

                // Conversations
                if (exportData.data.conversations?.length > 0) {
                    for (const conv of exportData.data.conversations) {
                        if (merge) {
                            this.storage.saveConversation?.(conv);
                        }
                        imported.conversations++;
                    }
                }

                // Ontology
                if (exportData.data.ontology && options.importOntology) {
                    const ontologyDir = path.join(this.dataDir, 'ontology');
                    if (!fs.existsSync(ontologyDir)) {
                        fs.mkdirSync(ontologyDir, { recursive: true });
                    }
                    fs.writeFileSync(
                        path.join(ontologyDir, 'schema.json'),
                        JSON.stringify(exportData.data.ontology, null, 2)
                    );
                }
            }

            console.log(`[Import] Imported from ${exportData.id}: ${JSON.stringify(imported)}`);

            return {
                success: true,
                exportId: exportData.id,
                exportedAt: exportData.exportedAt,
                imported
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * List available exports
     */
    listExports() {
        const exports = [];
        
        try {
            if (!fs.existsSync(this.exportDir)) return exports;

            const files = fs.readdirSync(this.exportDir);
            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                
                try {
                    const filePath = path.join(this.exportDir, file);
                    const stat = fs.statSync(filePath);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    
                    exports.push({
                        id: data.id,
                        file,
                        exportedAt: data.exportedAt,
                        size: stat.size,
                        checksum: data.checksum
                    });
                } catch (e) {}
            }
        } catch (e) {}

        return exports.sort((a, b) => new Date(b.exportedAt) - new Date(a.exportedAt));
    }

    /**
     * Delete an export
     */
    deleteExport(exportId) {
        try {
            const exportFile = path.join(this.exportDir, `${exportId}.json`);
            if (fs.existsSync(exportFile)) {
                fs.unlinkSync(exportFile);
                return { success: true };
            }
            return { success: false, error: 'Export not found' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Export to specific formats
     */
    async exportToFormat(format, options = {}) {
        const baseExport = await this.exportProject(options);
        if (!baseExport.success) return baseExport;

        const exportFile = baseExport.file;
        const exportData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));

        switch (format) {
            case 'csv': {
                const csvDir = path.join(this.exportDir, baseExport.exportId);
                if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, { recursive: true });

                // Export each collection as CSV
                for (const [collection, items] of Object.entries(exportData.data)) {
                    if (!Array.isArray(items) || items.length === 0) continue;
                    
                    const headers = Object.keys(items[0]);
                    const csv = [
                        headers.join(','),
                        ...items.map(item => 
                            headers.map(h => JSON.stringify(item[h] ?? '')).join(',')
                        )
                    ].join('\n');
                    
                    fs.writeFileSync(path.join(csvDir, `${collection}.csv`), csv);
                }

                return { ...baseExport, format: 'csv', directory: csvDir };
            }

            case 'markdown': {
                let md = `# Project Export\n\n`;
                md += `Exported: ${exportData.exportedAt}\n\n`;

                for (const [collection, items] of Object.entries(exportData.data)) {
                    if (!Array.isArray(items) || items.length === 0) continue;
                    
                    md += `## ${collection.charAt(0).toUpperCase() + collection.slice(1)}\n\n`;
                    for (const item of items.slice(0, 100)) { // Limit to 100 per type
                        md += `- ${item.content || item.text || item.name || item.title || JSON.stringify(item).substring(0, 100)}\n`;
                    }
                    md += '\n';
                }

                const mdFile = path.join(this.exportDir, `${baseExport.exportId}.md`);
                fs.writeFileSync(mdFile, md);

                return { ...baseExport, format: 'markdown', markdownFile: mdFile };
            }

            default:
                return baseExport;
        }
    }
}

// Singleton
let instance = null;
function getDataExportImport(options = {}) {
    if (!instance) {
        instance = new DataExportImport(options);
    }
    if (options.dataDir) instance.setDataDir(options.dataDir);
    if (options.storage) instance.setStorage(options.storage);
    return instance;
}

module.exports = { DataExportImport, getDataExportImport };
