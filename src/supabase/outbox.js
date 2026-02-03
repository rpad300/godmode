/**
 * Outbox Module
 * Implements the transactional outbox pattern for reliable FalkorDB sync
 */

const { getAdminClient } = require('./client');

// Operation types
const OPERATIONS = {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    MERGE: 'MERGE',
    LINK: 'LINK',
    UNLINK: 'UNLINK'
};

// Event types
const EVENT_TYPES = {
    ENTITY_CREATED: 'entity.created',
    ENTITY_UPDATED: 'entity.updated',
    ENTITY_DELETED: 'entity.deleted',
    RELATION_CREATED: 'relation.created',
    RELATION_DELETED: 'relation.deleted',
    FACT_CREATED: 'fact.created',
    FACT_UPDATED: 'fact.updated',
    QUESTION_CREATED: 'question.created',
    DOCUMENT_PROCESSED: 'document.processed'
};

/**
 * Add an event to the outbox
 */
async function addToOutbox({
    projectId,
    graphName,
    eventType,
    operation,
    entityType,
    entityId,
    payload,
    cypherQuery = null,
    cypherParams = null,
    createdBy = null
}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Generate idempotency key
        const eventId = `${entityType}:${entityId}:${Date.now()}`;

        const { data: outboxEvent, error } = await supabase
            .from('graph_outbox')
            .insert({
                event_id: eventId,
                event_type: eventType,
                project_id: projectId,
                graph_name: graphName,
                operation,
                entity_type: entityType,
                entity_id: entityId,
                payload,
                cypher_query: cypherQuery,
                cypher_params: cypherParams,
                created_by: createdBy
            })
            .select()
            .single();

        if (error) {
            // Check for duplicate (idempotent)
            if (error.code === '23505') {
                return { success: true, duplicate: true };
            }
            throw error;
        }

        // Update pending count in sync status
        await updateSyncStatusCount(supabase, projectId, graphName, 1);

        return { success: true, event: outboxEvent };
    } catch (error) {
        console.error('[Outbox] Add error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Add multiple events to outbox in a batch
 */
async function addBatchToOutbox(events) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const records = events.map((e, i) => ({
            event_id: `${e.entityType}:${e.entityId}:${Date.now()}:${i}`,
            event_type: e.eventType,
            project_id: e.projectId,
            graph_name: e.graphName,
            operation: e.operation,
            entity_type: e.entityType,
            entity_id: e.entityId,
            payload: e.payload,
            cypher_query: e.cypherQuery,
            cypher_params: e.cypherParams,
            created_by: e.createdBy
        }));

        const { data, error } = await supabase
            .from('graph_outbox')
            .insert(records)
            .select();

        if (error) throw error;

        return { success: true, events: data, count: data.length };
    } catch (error) {
        console.error('[Outbox] Batch add error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Claim a batch of pending events for processing
 */
async function claimBatch(batchSize = 100) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Use the stored function for atomic claim
        const { data, error } = await supabase.rpc('claim_outbox_batch', {
            p_batch_size: batchSize
        });

        if (error) throw error;

        return { success: true, events: data || [], count: data?.length || 0 };
    } catch (error) {
        console.error('[Outbox] Claim error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mark an event as completed
 */
async function markCompleted(eventId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { error } = await supabase.rpc('complete_outbox_event', {
            p_id: eventId
        });

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('[Outbox] Complete error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mark an event as failed
 */
async function markFailed(eventId, errorMessage) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { error } = await supabase.rpc('fail_outbox_event', {
            p_id: eventId,
            p_error: errorMessage
        });

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('[Outbox] Fail error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get pending events count
 */
async function getPendingCount(projectId = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        let query = supabase
            .from('graph_outbox')
            .select('id', { count: 'exact', head: true })
            .in('status', ['pending', 'failed']);

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { count, error } = await query;

        if (error) throw error;

        return { success: true, count };
    } catch (error) {
        console.error('[Outbox] Count error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get sync status for a project
 */
async function getSyncStatus(projectId, graphName = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        let query = supabase
            .from('graph_sync_status')
            .select('*')
            .eq('project_id', projectId);

        if (graphName) {
            query = query.eq('graph_name', graphName).single();
        }

        const { data, error } = await query;

        if (error && error.code !== 'PGRST116') throw error;

        return { success: true, status: data };
    } catch (error) {
        console.error('[Outbox] Status error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update or create sync status
 */
async function upsertSyncStatus(projectId, graphName, updates) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data, error } = await supabase
            .from('graph_sync_status')
            .upsert({
                project_id: projectId,
                graph_name: graphName,
                ...updates,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'project_id,graph_name'
            })
            .select()
            .single();

        if (error) throw error;

        return { success: true, status: data };
    } catch (error) {
        console.error('[Outbox] Upsert status error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update pending count in sync status
 */
async function updateSyncStatusCount(supabase, projectId, graphName, delta) {
    try {
        // First ensure the record exists
        await supabase
            .from('graph_sync_status')
            .upsert({
                project_id: projectId,
                graph_name: graphName,
                pending_count: Math.max(0, delta)
            }, {
                onConflict: 'project_id,graph_name',
                ignoreDuplicates: true
            });

        // Then update the count
        if (delta !== 0) {
            const { data: current } = await supabase
                .from('graph_sync_status')
                .select('pending_count')
                .eq('project_id', projectId)
                .eq('graph_name', graphName)
                .single();

            if (current) {
                await supabase
                    .from('graph_sync_status')
                    .update({
                        pending_count: Math.max(0, (current.pending_count || 0) + delta),
                        updated_at: new Date().toISOString()
                    })
                    .eq('project_id', projectId)
                    .eq('graph_name', graphName);
            }
        }
    } catch (error) {
        console.error('[Outbox] Update count error:', error);
    }
}

/**
 * Get dead letter events
 */
async function getDeadLetters(projectId, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    const { unresolvedOnly = true, limit = 50 } = options;

    try {
        let query = supabase
            .from('graph_dead_letter')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (unresolvedOnly) {
            query = query.eq('resolved', false);
        }

        const { data, error } = await query;

        if (error) throw error;

        return { success: true, deadLetters: data || [] };
    } catch (error) {
        console.error('[Outbox] Dead letters error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Resolve a dead letter event
 */
async function resolveDeadLetter(deadLetterId, userId, notes = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { error } = await supabase
            .from('graph_dead_letter')
            .update({
                resolved: true,
                resolved_at: new Date().toISOString(),
                resolved_by: userId,
                resolution_notes: notes
            })
            .eq('id', deadLetterId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('[Outbox] Resolve error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Retry a dead letter event
 */
async function retryDeadLetter(deadLetterId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Get the dead letter
        const { data: dl, error: fetchError } = await supabase
            .from('graph_dead_letter')
            .select('*, outbox:graph_outbox!outbox_id(*)')
            .eq('id', deadLetterId)
            .single();

        if (fetchError) throw fetchError;

        // Reset the outbox event
        const { error: updateError } = await supabase
            .from('graph_outbox')
            .update({
                status: 'pending',
                attempts: 0,
                next_retry_at: null,
                last_error: null
            })
            .eq('id', dl.outbox_id);

        if (updateError) throw updateError;

        // Mark dead letter as resolved with retry note
        await resolveDeadLetter(deadLetterId, null, 'Retried manually');

        return { success: true };
    } catch (error) {
        console.error('[Outbox] Retry error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get outbox statistics
 */
async function getStats(projectId = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Get counts by status
        let query = supabase
            .from('graph_outbox')
            .select('status');

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { data, error } = await query;

        if (error) throw error;

        const stats = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            dead_letter: 0,
            total: data?.length || 0
        };

        for (const row of data || []) {
            stats[row.status] = (stats[row.status] || 0) + 1;
        }

        return { success: true, stats };
    } catch (error) {
        console.error('[Outbox] Stats error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cleanup old completed events
 */
async function cleanup(daysOld = 7) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysOld);

        const { error, count } = await supabase
            .from('graph_outbox')
            .delete()
            .eq('status', 'completed')
            .lt('processed_at', cutoff.toISOString());

        if (error) throw error;

        return { success: true, deleted: count };
    } catch (error) {
        console.error('[Outbox] Cleanup error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    OPERATIONS,
    EVENT_TYPES,
    addToOutbox,
    addBatchToOutbox,
    claimBatch,
    markCompleted,
    markFailed,
    getPendingCount,
    getSyncStatus,
    upsertSyncStatus,
    getDeadLetters,
    resolveDeadLetter,
    retryDeadLetter,
    getStats,
    cleanup
};
