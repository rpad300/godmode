/**
 * Purpose:
 *   Detects and optionally repairs inconsistencies between the local data
 *   store and the graph database (missing nodes, extra nodes, orphans,
 *   dangling relationships).
 *
 * Responsibilities:
 *   - Compare local contacts against graph Person nodes to find missing or
 *     extra entries
 *   - Compare local conversations against graph Conversation nodes
 *   - Detect orphaned graph nodes (nodes with no relationships, excluding
 *     known standalone types like Person, Project, Organization)
 *   - Detect dangling relationships where one endpoint is null (data corruption)
 *   - Provide an `autoFix` method that removes orphaned nodes
 *   - Expose a lightweight `quickCheck` returning total node/edge counts
 *
 * Key dependencies:
 *   - graphProvider: Cypher query interface (MATCH, DELETE)
 *   - storage: local data store (getContacts, getConversations)
 *
 * Side effects:
 *   - `runCheck` is read-only (queries only)
 *   - `autoFix` deletes orphaned nodes from the graph database
 *
 * Notes:
 *   - Contact comparison is name-based (case-insensitive); contacts without
 *     names are silently ignored.
 *   - autoFix preserves Person, Project, Organization, and Technology nodes
 *     even if they have no relationships, since these are expected to exist
 *     as standalone entities.
 *   - The Cypher query for dangling relationships (`WHERE a IS NULL OR b IS
 *     NULL`) may not behave as expected in all graph engines; verify against
 *     your provider.
 */

class IntegrityCheck {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
        this.storage = options.storage;
    }

    setDependencies(deps) {
        if (deps.graphProvider) this.graphProvider = deps.graphProvider;
        if (deps.storage) this.storage = deps.storage;
    }

    /**
     * Run full integrity check
     */
    async runCheck() {
        const report = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            issues: [],
            stats: {
                localContacts: 0,
                graphPeople: 0,
                localConversations: 0,
                graphConversations: 0,
                orphanedNodes: 0,
                missingInGraph: 0,
                extraInGraph: 0
            }
        };

        if (!this.graphProvider || !this.graphProvider.connected) {
            report.status = 'skipped';
            report.issues.push({ type: 'warning', message: 'Graph database not connected' });
            return report;
        }

        try {
            // Check contacts vs People nodes
            await this.checkContacts(report);

            // Check conversations
            await this.checkConversations(report);

            // Check for orphaned nodes
            await this.checkOrphans(report);

            // Check for dangling relationships
            await this.checkRelationships(report);

            // Determine overall status
            if (report.issues.some(i => i.type === 'error')) {
                report.status = 'unhealthy';
            } else if (report.issues.some(i => i.type === 'warning')) {
                report.status = 'warning';
            }

        } catch (e) {
            report.status = 'error';
            report.issues.push({ type: 'error', message: e.message });
        }

        return report;
    }

    async checkContacts(report) {
        // Get local contacts
        const localContacts = this.storage?.getContacts?.() || [];
        report.stats.localContacts = localContacts.length;
        const localNames = new Set(localContacts.map(c => c.name?.toLowerCase()).filter(Boolean));

        // Get graph People
        const graphResult = await this.graphProvider.query('MATCH (p:Person) RETURN p.name as name');
        const graphPeople = graphResult.results || [];
        report.stats.graphPeople = graphPeople.length;
        const graphNames = new Set(graphPeople.map(p => p.name?.toLowerCase()).filter(Boolean));

        // Find missing in graph
        for (const name of localNames) {
            if (!graphNames.has(name)) {
                report.stats.missingInGraph++;
                report.issues.push({
                    type: 'warning',
                    entity: 'contact',
                    message: `Contact "${name}" exists locally but not in graph`
                });
            }
        }

        // Find extra in graph
        for (const name of graphNames) {
            if (!localNames.has(name)) {
                report.stats.extraInGraph++;
                report.issues.push({
                    type: 'info',
                    entity: 'person',
                    message: `Person "${name}" exists in graph but not in contacts`
                });
            }
        }
    }

    async checkConversations(report) {
        // Get local conversations
        const localConvs = this.storage?.getConversations?.() || [];
        report.stats.localConversations = localConvs.length;
        const localIds = new Set(localConvs.map(c => c.id));

        // Get graph Conversations
        const graphResult = await this.graphProvider.query('MATCH (c:Conversation) RETURN c.id as id');
        const graphConvs = graphResult.results || [];
        report.stats.graphConversations = graphConvs.length;
        const graphIds = new Set(graphConvs.map(c => c.id).filter(Boolean));

        // Find discrepancies
        for (const id of localIds) {
            if (!graphIds.has(id)) {
                report.issues.push({
                    type: 'info',
                    entity: 'conversation',
                    message: `Conversation "${id}" not indexed in graph`
                });
            }
        }
    }

    async checkOrphans(report) {
        // Find nodes with no relationships
        const orphanResult = await this.graphProvider.query(`
            MATCH (n)
            WHERE NOT (n)--()
            AND NOT n:Person AND NOT n:Project AND NOT n:Organization
            RETURN labels(n) as labels, count(n) as count
        `);

        for (const row of orphanResult.results || []) {
            if (row.count > 0) {
                report.stats.orphanedNodes += row.count;
                report.issues.push({
                    type: 'warning',
                    entity: 'node',
                    message: `${row.count} orphaned ${row.labels?.join(',')} nodes found`
                });
            }
        }
    }

    async checkRelationships(report) {
        // Check for relationships with missing endpoints
        // This would indicate data corruption
        const danglingResult = await this.graphProvider.query(`
            MATCH (a)-[r]->(b)
            WHERE a IS NULL OR b IS NULL
            RETURN count(r) as count
        `);

        const dangling = danglingResult.results?.[0]?.count || 0;
        if (dangling > 0) {
            report.issues.push({
                type: 'error',
                entity: 'relationship',
                message: `${dangling} dangling relationships found (data corruption)`
            });
        }
    }

    /**
     * Auto-fix issues
     */
    async autoFix(report) {
        const fixes = [];

        if (!this.graphProvider || !this.graphProvider.connected) {
            return { fixed: 0, message: 'Graph not connected' };
        }

        // Fix orphaned nodes
        if (report.stats.orphanedNodes > 0) {
            try {
                const result = await this.graphProvider.query(`
                    MATCH (n)
                    WHERE NOT (n)--()
                    AND NOT n:Person AND NOT n:Project AND NOT n:Organization AND NOT n:Technology
                    DELETE n
                    RETURN count(n) as deleted
                `);
                fixes.push({ action: 'delete_orphans', count: result.results?.[0]?.deleted || 0 });
            } catch (e) {
                fixes.push({ action: 'delete_orphans', error: e.message });
            }
        }

        return { fixed: fixes.length, fixes };
    }

    /**
     * Quick health check
     */
    async quickCheck() {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { healthy: false, reason: 'Graph not connected' };
        }

        try {
            const nodeCount = await this.graphProvider.query('MATCH (n) RETURN count(n) as c');
            const edgeCount = await this.graphProvider.query('MATCH ()-[r]->() RETURN count(r) as c');
            
            return {
                healthy: true,
                nodes: nodeCount.results?.[0]?.c || 0,
                edges: edgeCount.results?.[0]?.c || 0
            };
        } catch (e) {
            return { healthy: false, reason: e.message };
        }
    }
}

// Singleton
let instance = null;
function getIntegrityCheck(options = {}) {
    if (!instance) {
        instance = new IntegrityCheck(options);
    }
    instance.setDependencies(options);
    return instance;
}

module.exports = { IntegrityCheck, getIntegrityCheck };
