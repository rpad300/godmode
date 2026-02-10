/**
 * Batch Delete Module
 * Efficiently delete multiple items in a single operation
 */

const { logger } = require('../logger');

const log = logger.child({ module: 'batch-delete' });

class BatchDelete {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
        this.storage = options.storage;
        this.softDelete = options.softDelete;
        this.auditLog = options.auditLog;
        this.cascadeDelete = options.cascadeDelete;
    }

    setDependencies(deps) {
        if (deps.graphProvider) this.graphProvider = deps.graphProvider;
        if (deps.storage) this.storage = deps.storage;
        if (deps.softDelete) this.softDelete = deps.softDelete;
        if (deps.auditLog) this.auditLog = deps.auditLog;
        if (deps.cascadeDelete) this.cascadeDelete = deps.cascadeDelete;
    }

    /**
     * Delete multiple items of the same type
     */
    async batchDelete(type, items, options = {}) {
        const results = {
            type,
            requested: items.length,
            deleted: 0,
            failed: 0,
            errors: [],
            graphSynced: false,
            startTime: Date.now()
        };

        const useSoftDelete = options.softDelete !== false;
        const useCascade = options.cascade !== false;
        const deletedBy = options.deletedBy || 'batch_operation';

        // Collect IDs and names for batch graph operation
        const ids = [];
        const names = [];

        for (const item of items) {
            try {
                // Soft delete if enabled
                if (useSoftDelete && this.softDelete) {
                    this.softDelete.markDeleted(type, item, deletedBy);
                }

                // Cascade delete if enabled
                if (useCascade && this.cascadeDelete) {
                    await this.cascadeDelete.cascadeDelete(type, item);
                }

                // Audit log
                if (this.auditLog) {
                    this.auditLog.logDelete({
                        entityType: type,
                        entityId: item.id,
                        entityName: item.name || item.title,
                        deletedBy,
                        cascade: useCascade,
                        softDelete: useSoftDelete,
                        metadata: { batchOperation: true }
                    });
                }

                ids.push(item.id);
                if (item.name) names.push(item.name);
                if (item.title) names.push(item.title);

                results.deleted++;
            } catch (e) {
                results.failed++;
                results.errors.push({ item: item.id, error: e.message });
            }
        }

        // Batch graph delete
        if (this.graphProvider && this.graphProvider.connected && ids.length > 0) {
            try {
                const labelMap = {
                    contact: 'Person',
                    conversation: 'Conversation',
                    project: 'Project',
                    team: 'Team',
                    meeting: 'Meeting',
                    document: 'Document'
                };
                const label = labelMap[type] || type;

                // Batch delete by IDs
                await this.graphProvider.query(
                    `MATCH (n:${label}) WHERE n.id IN $ids DETACH DELETE n`,
                    { ids }
                );

                // Also try by names
                if (names.length > 0) {
                    await this.graphProvider.query(
                        `MATCH (n:${label}) WHERE n.name IN $names OR n.title IN $names DETACH DELETE n`,
                        { names }
                    );
                }

                results.graphSynced = true;
            } catch (e) {
                results.errors.push({ graph: e.message });
            }
        }

        results.duration = Date.now() - results.startTime;
        log.debug({ event: 'batch_delete_done', type, deleted: results.deleted, requested: results.requested, duration: results.duration }, 'Batch delete complete');
        
        return results;
    }

    /**
     * Delete items matching a filter
     */
    async deleteByFilter(type, filter, options = {}) {
        let items = [];

        // Get items based on type
        switch (type) {
            case 'contact':
                items = this.storage?.getContacts?.() || [];
                break;
            case 'conversation':
                items = this.storage?.getConversations?.() || [];
                break;
            case 'project':
                items = this.storage?.listProjects?.() || [];
                break;
            case 'team':
                items = this.storage?.getTeams?.() || [];
                break;
        }

        // Apply filter
        const filtered = items.filter(filter);

        if (filtered.length === 0) {
            return { deleted: 0, message: 'No items match filter' };
        }

        // Confirm if many items
        if (filtered.length > 10 && !options.confirmed) {
            return {
                requiresConfirmation: true,
                itemCount: filtered.length,
                preview: filtered.slice(0, 5).map(i => i.name || i.title || i.id)
            };
        }

        return this.batchDelete(type, filtered, options);
    }

    /**
     * Delete all items of a type
     */
    async deleteAll(type, options = {}) {
        return this.deleteByFilter(type, () => true, { ...options, confirmed: true });
    }

    /**
     * Dry run - preview what would be deleted
     */
    async preview(type, items) {
        return {
            type,
            count: items.length,
            items: items.slice(0, 10).map(i => ({
                id: i.id,
                name: i.name || i.title
            })),
            hasMore: items.length > 10
        };
    }
}

// Singleton
let instance = null;
function getBatchDelete(options = {}) {
    if (!instance) {
        instance = new BatchDelete(options);
    }
    instance.setDependencies(options);
    return instance;
}

module.exports = { BatchDelete, getBatchDelete };
