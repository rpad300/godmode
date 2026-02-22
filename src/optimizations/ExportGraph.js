/**
 * Purpose:
 *   Export the knowledge graph and knowledge base to multiple portable
 *   formats for external consumption or migration.
 *
 * Responsibilities:
 *   - Export graph data to JSON, Neo4j Cypher script, GraphML (XML), and
 *     CSV (separate nodes + edges files)
 *   - Export the knowledge base (facts, decisions, risks, etc.) to JSON
 *   - Save any export format to the local filesystem under a configurable
 *     export directory
 *
 * Key dependencies:
 *   - fs / path: file I/O for saved exports
 *   - graphProvider (injected): Cypher queries for graph node/relationship reads
 *   - storage (injected): local knowledge base data retrieval
 *
 * Side effects:
 *   - Writes export files to this.exportDir (created on demand)
 *   - Graph exports issue full-scan Cypher queries (MATCH (n) / MATCH ()-[r]->())
 *     which can be expensive on large graphs
 *
 * Notes:
 *   - Cypher export uses CREATE (not MERGE), so re-running the script on
 *     an existing database will create duplicates.
 *   - CSV export uses a fixed column set (id, label, name, role, org, email);
 *     nodes with additional properties will lose those columns.
 */

const fs = require('fs');
const path = require('path');

/**
 * Exports graph data and knowledge base to multiple formats (JSON, Cypher,
 * GraphML, CSV) and optionally saves to disk.
 *
 * @param {object} options
 * @param {object} options.graphProvider - Graph database adapter
 * @param {object} options.storage - Local knowledge base storage adapter
 * @param {string} [options.exportDir='./exports'] - Target directory for file exports
 */
class ExportGraph {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
        this.storage = options.storage;
        this.exportDir = options.exportDir || './exports';
    }

    setGraphProvider(provider) {
        this.graphProvider = provider;
    }

    setStorage(storage) {
        this.storage = storage;
    }

    /**
     * Export full graph to JSON
     */
    async exportToJSON() {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        try {
            // Get all nodes
            const nodesResult = await this.graphProvider.query(`
                MATCH (n)
                RETURN id(n) as id, labels(n) as labels, properties(n) as properties
            `);

            // Get all relationships
            const relsResult = await this.graphProvider.query(`
                MATCH (a)-[r]->(b)
                RETURN id(a) as source, id(b) as target, type(r) as type, properties(r) as properties
            `);

            const exportData = {
                exportedAt: new Date().toISOString(),
                format: 'json',
                nodes: nodesResult.results || [],
                relationships: relsResult.results || [],
                stats: {
                    nodeCount: nodesResult.results?.length || 0,
                    relationshipCount: relsResult.results?.length || 0
                }
            };

            return exportData;
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Export to Neo4j Cypher format
     */
    async exportToCypher() {
        const json = await this.exportToJSON();
        if (json.error) return json;

        const statements = [];
        
        // Create nodes
        for (const node of json.nodes) {
            const label = node.labels?.[0] || 'Node';
            const props = node.properties || {};
            const propsStr = Object.entries(props)
                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                .join(', ');
            
            statements.push(`CREATE (:${label} {${propsStr}});`);
        }

        // Create relationships
        for (const rel of json.relationships) {
            const props = rel.properties || {};
            const propsStr = Object.entries(props)
                .filter(([k, v]) => v !== null && v !== undefined)
                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                .join(', ');
            
            statements.push(`MATCH (a), (b) WHERE id(a) = ${rel.source} AND id(b) = ${rel.target} CREATE (a)-[:${rel.type} {${propsStr}}]->(b);`);
        }

        return {
            format: 'cypher',
            statements,
            content: statements.join('\n')
        };
    }

    /**
     * Export to GraphML (XML format)
     */
    async exportToGraphML() {
        const json = await this.exportToJSON();
        if (json.error) return json;

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
        xml += '  <graph id="G" edgedefault="directed">\n';

        // Nodes
        for (const node of json.nodes) {
            const label = node.labels?.[0] || 'Node';
            const name = node.properties?.name || node.id;
            xml += `    <node id="n${node.id}">\n`;
            xml += `      <data key="label">${label}</data>\n`;
            xml += `      <data key="name">${this.escapeXml(name)}</data>\n`;
            for (const [k, v] of Object.entries(node.properties || {})) {
                if (k !== 'name') {
                    xml += `      <data key="${k}">${this.escapeXml(String(v))}</data>\n`;
                }
            }
            xml += '    </node>\n';
        }

        // Edges
        let edgeId = 0;
        for (const rel of json.relationships) {
            xml += `    <edge id="e${edgeId++}" source="n${rel.source}" target="n${rel.target}">\n`;
            xml += `      <data key="type">${rel.type}</data>\n`;
            xml += '    </edge>\n';
        }

        xml += '  </graph>\n';
        xml += '</graphml>';

        return {
            format: 'graphml',
            content: xml
        };
    }

    /**
     * Export to CSV (nodes and edges files)
     */
    async exportToCSV() {
        const json = await this.exportToJSON();
        if (json.error) return json;

        // Nodes CSV
        const nodeHeaders = ['id', 'label', 'name', 'role', 'organization', 'email'];
        let nodesCSV = nodeHeaders.join(',') + '\n';
        
        for (const node of json.nodes) {
            const props = node.properties || {};
            const row = [
                node.id,
                node.labels?.[0] || '',
                this.escapeCSV(props.name || ''),
                this.escapeCSV(props.role || ''),
                this.escapeCSV(props.organization || ''),
                this.escapeCSV(props.email || '')
            ];
            nodesCSV += row.join(',') + '\n';
        }

        // Edges CSV
        const edgeHeaders = ['source', 'target', 'type'];
        let edgesCSV = edgeHeaders.join(',') + '\n';
        
        for (const rel of json.relationships) {
            const row = [rel.source, rel.target, rel.type];
            edgesCSV += row.join(',') + '\n';
        }

        return {
            format: 'csv',
            nodes: nodesCSV,
            edges: edgesCSV
        };
    }

    /**
     * Export knowledge base to JSON
     */
    async exportKnowledgeBase() {
        if (!this.storage) return { error: 'Storage not set' };

        const [facts, decisions, risks, questions, people, actionItems] = await Promise.all([
            this.storage.getFacts(),
            this.storage.getDecisions(),
            this.storage.getRisks(),
            this.storage.getQuestions(),
            this.storage.getPeople(),
            this.storage.getActions(),
        ]);
        return {
            exportedAt: new Date().toISOString(),
            format: 'knowledge_base',
            data: { facts, decisions, risks, questions, people, actionItems }
        };
    }

    /**
     * Export data in the given format and write it to disk. CSV produces two
     * files (nodes + edges); all others produce a single file.
     * @param {string} [format='json'] - 'json' | 'cypher' | 'graphml' | 'csv' | 'knowledge'
     * @param {string|null} [filename] - Custom base filename (without extension)
     * @returns {Promise<{success: boolean, file?: string, files?: string[], path?: string, error?: string}>}
     */
    async saveExport(format = 'json', filename = null) {
        let exportData;
        let extension;

        switch (format) {
            case 'cypher':
                exportData = await this.exportToCypher();
                extension = 'cypher';
                break;
            case 'graphml':
                exportData = await this.exportToGraphML();
                extension = 'graphml';
                break;
            case 'csv':
                exportData = await this.exportToCSV();
                extension = 'csv';
                break;
            case 'knowledge':
                exportData = await this.exportKnowledgeBase();
                extension = 'json';
                break;
            default:
                exportData = await this.exportToJSON();
                extension = 'json';
        }

        if (exportData.error) return exportData;

        // Ensure export directory exists
        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseFilename = filename || `graph-export-${timestamp}`;

        if (format === 'csv') {
            // Save nodes and edges separately
            fs.writeFileSync(
                path.join(this.exportDir, `${baseFilename}-nodes.csv`),
                exportData.nodes
            );
            fs.writeFileSync(
                path.join(this.exportDir, `${baseFilename}-edges.csv`),
                exportData.edges
            );
            return {
                success: true,
                files: [
                    `${baseFilename}-nodes.csv`,
                    `${baseFilename}-edges.csv`
                ]
            };
        } else {
            const content = typeof exportData.content === 'string' 
                ? exportData.content 
                : JSON.stringify(exportData, null, 2);
            
            const filepath = path.join(this.exportDir, `${baseFilename}.${extension}`);
            fs.writeFileSync(filepath, content);
            
            return {
                success: true,
                file: `${baseFilename}.${extension}`,
                path: filepath
            };
        }
    }

    /**
     * Escape XML special characters
     */
    escapeXml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Escape CSV field
     */
    escapeCSV(str) {
        if (!str) return '';
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }
}

// Singleton
let exportGraphInstance = null;
function getExportGraph(options = {}) {
    if (!exportGraphInstance) {
        exportGraphInstance = new ExportGraph(options);
    }
    if (options.graphProvider) exportGraphInstance.setGraphProvider(options.graphProvider);
    if (options.storage) exportGraphInstance.setStorage(options.storage);
    return exportGraphInstance;
}

module.exports = { ExportGraph, getExportGraph };
