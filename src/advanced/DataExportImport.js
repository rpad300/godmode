/**
 * Data Export/Import Module
 * Full project export and import for migration/backup
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../logger');

const log = logger.child({ module: 'data-export-import' });

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

            log.debug({ event: 'export_created', exportId, sizeKb: (exportData.size / 1024).toFixed(2) }, 'Created export');

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

                // Facts (batch when available)
                if (exportData.data.facts?.length > 0 && merge) {
                    const factsToAdd = exportData.data.facts
                        .filter(f => f && (f.content || '').trim().length >= 10)
                        .map(f => ({
                            content: f.content,
                            category: f.category,
                            confidence: f.confidence,
                            source_document_id: f.source_document_id,
                            document_id: f.document_id,
                            source_file: f.source_file
                        }));
                    if (factsToAdd.length > 0) {
                        if (typeof this.storage.addFacts === 'function') {
                            const result = await this.storage.addFacts(factsToAdd, { skipDedup: true });
                            imported.facts = result.inserted;
                        } else {
                            for (const fact of factsToAdd) {
                                await this.storage.addFact?.(fact, true);
                                imported.facts++;
                            }
                        }
                    }
                }

                // Questions (batch when available)
                if (exportData.data.questions?.length > 0 && merge) {
                    const questionsToAdd = exportData.data.questions
                        .filter(q => q && (q.content || '').trim().length >= 10)
                        .map(q => ({
                            content: q.content,
                            priority: q.priority,
                            status: q.status,
                            category: q.category,
                            context: q.context,
                            assigned_to: q.assigned_to,
                            source_document_id: q.source_document_id,
                            document_id: q.document_id,
                            source_file: q.source_file
                        }));
                    if (questionsToAdd.length > 0) {
                        if (typeof this.storage.addQuestions === 'function') {
                            const result = await this.storage.addQuestions(questionsToAdd, { skipDedup: true });
                            imported.questions = result.inserted;
                        } else {
                            for (const q of questionsToAdd) {
                                await this.storage.addQuestion?.(q, true);
                                imported.questions++;
                            }
                        }
                    }
                }

                // Decisions (batch when available)
                if (exportData.data.decisions?.length > 0 && merge) {
                    const decisionsToAdd = exportData.data.decisions
                        .filter(d => d && (d.content || '').trim())
                        .map(d => ({
                            content: d.content,
                            owner: d.owner,
                            date: d.date,
                            decision_date: d.decision_date,
                            context: d.context,
                            rationale: d.rationale,
                            status: d.status,
                            source_document_id: d.source_document_id,
                            document_id: d.document_id,
                            source_file: d.source_file
                        }));
                    if (decisionsToAdd.length > 0) {
                        if (typeof this.storage.addDecisions === 'function') {
                            const result = await this.storage.addDecisions(decisionsToAdd);
                            imported.decisions = result.inserted;
                        } else {
                            for (const d of decisionsToAdd) {
                                await this.storage.addDecision?.(d);
                                imported.decisions++;
                            }
                        }
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

            log.debug({ event: 'import_done', exportId: exportData.id, imported }, 'Imported from export');

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
