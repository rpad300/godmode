/**
 * API Documentation Module
 * Auto-generates OpenAPI/Swagger documentation
 */

const fs = require('fs');
const path = require('path');

class APIDocumentation {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.title = options.title || 'GodMode API';
        this.version = options.version || '1.0.0';
        this.description = options.description || 'AI-powered document processing and knowledge management API';
        this.baseUrl = options.baseUrl || 'http://localhost:3005';
        this.endpoints = [];
    }

    /**
     * Register an endpoint
     */
    registerEndpoint(endpoint) {
        this.endpoints.push({
            path: endpoint.path,
            method: endpoint.method.toUpperCase(),
            summary: endpoint.summary || '',
            description: endpoint.description || '',
            tags: endpoint.tags || ['General'],
            parameters: endpoint.parameters || [],
            requestBody: endpoint.requestBody || null,
            responses: endpoint.responses || {
                200: { description: 'Success' },
                400: { description: 'Bad Request' },
                500: { description: 'Internal Server Error' }
            }
        });
    }

    /**
     * Register multiple endpoints
     */
    registerEndpoints(endpoints) {
        for (const ep of endpoints) {
            this.registerEndpoint(ep);
        }
    }

    /**
     * Generate OpenAPI 3.0 specification
     */
    generateOpenAPI() {
        const paths = {};
        const tags = new Set();

        for (const ep of this.endpoints) {
            if (!paths[ep.path]) {
                paths[ep.path] = {};
            }

            const operation = {
                summary: ep.summary,
                description: ep.description,
                tags: ep.tags,
                responses: {}
            };

            // Add tags
            for (const tag of ep.tags) {
                tags.add(tag);
            }

            // Parameters
            if (ep.parameters.length > 0) {
                operation.parameters = ep.parameters.map(p => ({
                    name: p.name,
                    in: p.in || 'query',
                    required: p.required || false,
                    schema: { type: p.type || 'string' },
                    description: p.description || ''
                }));
            }

            // Request body
            if (ep.requestBody) {
                operation.requestBody = {
                    required: ep.requestBody.required !== false,
                    content: {
                        'application/json': {
                            schema: ep.requestBody.schema || { type: 'object' }
                        }
                    }
                };
            }

            // Responses
            for (const [code, resp] of Object.entries(ep.responses)) {
                operation.responses[code] = {
                    description: resp.description,
                    content: resp.schema ? {
                        'application/json': {
                            schema: resp.schema
                        }
                    } : undefined
                };
            }

            paths[ep.path][ep.method.toLowerCase()] = operation;
        }

        return {
            openapi: '3.0.0',
            info: {
                title: this.title,
                version: this.version,
                description: this.description
            },
            servers: [
                { url: this.baseUrl, description: 'Development server' }
            ],
            tags: Array.from(tags).map(t => ({ name: t })),
            paths
        };
    }

    /**
     * Generate HTML documentation
     */
    generateHTML() {
        const spec = this.generateOpenAPI();
        const specJson = JSON.stringify(spec, null, 2);

        return `<!DOCTYPE html>
<html>
<head>
    <title>${this.title} - API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
        body { margin: 0; padding: 0; }
        .swagger-ui .topbar { display: none; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function() {
            SwaggerUIBundle({
                spec: ${specJson},
                dom_id: '#swagger-ui',
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout"
            });
        };
    </script>
</body>
</html>`;
    }

    /**
     * Generate Markdown documentation
     */
    generateMarkdown() {
        let md = `# ${this.title}\n\n`;
        md += `**Version:** ${this.version}\n\n`;
        md += `${this.description}\n\n`;
        md += `**Base URL:** ${this.baseUrl}\n\n`;
        md += `---\n\n`;

        // Group by tags
        const byTag = {};
        for (const ep of this.endpoints) {
            for (const tag of ep.tags) {
                if (!byTag[tag]) byTag[tag] = [];
                byTag[tag].push(ep);
            }
        }

        for (const [tag, endpoints] of Object.entries(byTag)) {
            md += `## ${tag}\n\n`;

            for (const ep of endpoints) {
                md += `### ${ep.method} ${ep.path}\n\n`;
                if (ep.summary) md += `**${ep.summary}**\n\n`;
                if (ep.description) md += `${ep.description}\n\n`;

                if (ep.parameters.length > 0) {
                    md += `**Parameters:**\n\n`;
                    md += `| Name | Type | Required | Description |\n`;
                    md += `|------|------|----------|-------------|\n`;
                    for (const p of ep.parameters) {
                        md += `| ${p.name} | ${p.type || 'string'} | ${p.required ? 'Yes' : 'No'} | ${p.description || ''} |\n`;
                    }
                    md += `\n`;
                }

                if (ep.requestBody) {
                    md += `**Request Body:**\n\n`;
                    md += `\`\`\`json\n${JSON.stringify(ep.requestBody.schema || {}, null, 2)}\n\`\`\`\n\n`;
                }

                md += `**Responses:**\n\n`;
                for (const [code, resp] of Object.entries(ep.responses)) {
                    md += `- **${code}**: ${resp.description}\n`;
                }
                md += `\n---\n\n`;
            }
        }

        return md;
    }

    /**
     * Save documentation to files
     */
    save() {
        const docsDir = path.join(this.dataDir, 'api-docs');
        if (!fs.existsSync(docsDir)) {
            fs.mkdirSync(docsDir, { recursive: true });
        }

        // Save OpenAPI JSON
        const openapi = this.generateOpenAPI();
        fs.writeFileSync(
            path.join(docsDir, 'openapi.json'),
            JSON.stringify(openapi, null, 2)
        );

        // Save HTML
        fs.writeFileSync(
            path.join(docsDir, 'index.html'),
            this.generateHTML()
        );

        // Save Markdown
        fs.writeFileSync(
            path.join(docsDir, 'API.md'),
            this.generateMarkdown()
        );

        return {
            saved: true,
            files: ['openapi.json', 'index.html', 'API.md'],
            directory: docsDir
        };
    }

    /**
     * Create Express/HTTP middleware for serving docs
     */
    createMiddleware() {
        return (req, res) => {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const pathname = url.pathname;

            if (pathname.endsWith('/openapi.json') || pathname.endsWith('/swagger.json')) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(this.generateOpenAPI(), null, 2));
            } else if (pathname.endsWith('/api-docs') || pathname.endsWith('/docs')) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(this.generateHTML());
            } else if (pathname.endsWith('/api-docs.md')) {
                res.writeHead(200, { 'Content-Type': 'text/markdown' });
                res.end(this.generateMarkdown());
            } else {
                return false; // Not handled
            }
            return true; // Handled
        };
    }

    /**
     * Auto-discover endpoints from server (basic pattern matching)
     */
    autoDiscover(serverCode) {
        const patterns = [
            // Match: if (pathname === '/api/xxx' && req.method === 'GET')
            /if\s*\(\s*pathname\s*===\s*['"]([^'"]+)['"]\s*&&\s*req\.method\s*===\s*['"](\w+)['"]/g,
            // Match: pathname.match(/^\/api\/xxx$/)
            /pathname\.match\(\s*\/\^(\\\/api[^/]+)\$\/\)/g
        ];

        const discovered = [];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(serverCode)) !== null) {
                const path = match[1].replace(/\\\//g, '/');
                const method = match[2] || 'GET';
                
                discovered.push({
                    path,
                    method,
                    summary: `${method} ${path}`,
                    tags: [this.guessTag(path)]
                });
            }
        }

        return discovered;
    }

    /**
     * Guess tag from path
     */
    guessTag(path) {
        if (path.includes('/graph')) return 'Graph Database';
        if (path.includes('/ontology')) return 'Ontology';
        if (path.includes('/sync')) return 'Sync & Backup';
        if (path.includes('/contacts')) return 'Contacts';
        if (path.includes('/conversations')) return 'Conversations';
        if (path.includes('/projects')) return 'Projects';
        if (path.includes('/optimizations')) return 'Optimizations';
        if (path.includes('/chat') || path.includes('/ask')) return 'Chat & Q&A';
        return 'General';
    }
}

// Default endpoints for GodMode
function getDefaultEndpoints() {
    return [
        // Projects
        { path: '/api/projects', method: 'GET', summary: 'List all projects', tags: ['Projects'] },
        { path: '/api/projects', method: 'POST', summary: 'Create project', tags: ['Projects'], requestBody: { schema: { type: 'object', properties: { name: { type: 'string' } } } } },
        { path: '/api/projects/{id}', method: 'DELETE', summary: 'Delete project', tags: ['Projects'], parameters: [{ name: 'id', in: 'path', required: true }] },
        
        // Contacts
        { path: '/api/contacts', method: 'GET', summary: 'List contacts', tags: ['Contacts'] },
        { path: '/api/contacts', method: 'POST', summary: 'Create contact', tags: ['Contacts'] },
        { path: '/api/contacts/{id}', method: 'DELETE', summary: 'Delete contact', tags: ['Contacts'] },
        
        // Conversations
        { path: '/api/conversations', method: 'GET', summary: 'List conversations', tags: ['Conversations'] },
        { path: '/api/conversations', method: 'POST', summary: 'Ingest conversation', tags: ['Conversations'] },
        
        // Chat
        { path: '/api/chat', method: 'POST', summary: 'Chat with AI', tags: ['Chat & Q&A'], requestBody: { schema: { type: 'object', properties: { question: { type: 'string' } } } } },
        { path: '/api/ask', method: 'POST', summary: 'Ask a question', tags: ['Chat & Q&A'] },
        
        // Graph
        { path: '/api/graph/connect', method: 'POST', summary: 'Connect to graph DB', tags: ['Graph Database'] },
        { path: '/api/graph/query', method: 'POST', summary: 'Execute Cypher query', tags: ['Graph Database'] },
        { path: '/api/graph/visualize', method: 'GET', summary: 'Get visualization data', tags: ['Graph Database'] },
        
        // Ontology
        { path: '/api/ontology/schema', method: 'GET', summary: 'Get ontology schema', tags: ['Ontology'] },
        { path: '/api/ontology/suggestions', method: 'GET', summary: 'Get ontology suggestions', tags: ['Ontology'] },
        
        // Sync
        { path: '/api/sync/status', method: 'GET', summary: 'Get sync status', tags: ['Sync & Backup'] },
        { path: '/api/sync/deleted', method: 'GET', summary: 'Get soft-deleted items', tags: ['Sync & Backup'] },
        { path: '/api/sync/audit', method: 'GET', summary: 'Get audit log', tags: ['Sync & Backup'] }
    ];
}

// Singleton
let instance = null;
function getAPIDocumentation(options = {}) {
    if (!instance) {
        instance = new APIDocumentation(options);
        instance.registerEndpoints(getDefaultEndpoints());
    }
    return instance;
}

module.exports = { APIDocumentation, getAPIDocumentation, getDefaultEndpoints };
