/**
 * Graph Sync Worker
 * Background worker that processes the outbox and syncs to graph provider
 */

const outbox = require('./supabase/outbox');
const { logger: rootLogger, logError } = require('./logger');

const log = rootLogger.child({ module: 'worker' });

// Worker state
let isRunning = false;
let intervalId = null;
let healthCheckIntervalId = null;
let graphConnector = null;

// Configuration
const CONFIG = {
    pollIntervalMs: 5000,       // How often to check for new events
    batchSize: 50,              // Events per batch
    maxConcurrent: 3,           // Max concurrent graph operations
    healthCheckIntervalMs: 60000, // Health check frequency
    batchTimeoutMs: 60000       // Max time for one batch; prevents stuck worker
};

/**
 * Start the sync worker
 */
function start(graphConnection) {
    if (isRunning) {
        log.info({ event: 'job_already_running' }, 'Already running');
        return;
    }

    graphConnector = graphConnection;
    isRunning = true;

    log.info({ event: 'job_start' }, 'SyncWorker starting');

    // Start polling (unref so process can exit if only this is running, e.g. in tests)
    intervalId = setInterval(processBatch, CONFIG.pollIntervalMs);
    if (intervalId.unref) intervalId.unref();

    // Initial run
    processBatch();

    // Health check (store ID so we can clear on stop)
    healthCheckIntervalId = setInterval(healthCheck, CONFIG.healthCheckIntervalMs);
    if (healthCheckIntervalId.unref) healthCheckIntervalId.unref();

    log.info({ event: 'job_started' }, 'SyncWorker started');
}

/**
 * Stop the sync worker
 */
function stop() {
    if (!isRunning) return;

    log.info({ event: 'job_stop' }, 'SyncWorker stopping');

    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    if (healthCheckIntervalId) {
        clearInterval(healthCheckIntervalId);
        healthCheckIntervalId = null;
    }

    isRunning = false;
    graphConnector = null;
    log.info({ event: 'job_stopped' }, 'SyncWorker stopped');
}

/**
 * Process a batch of outbox events (with timeout to prevent stuck worker)
 */
async function processBatch() {
    if (!isRunning || !graphConnector) return;

    const runBatch = async () => {
        const result = await outbox.claimBatch(CONFIG.batchSize);
        if (!result || !result.success) return;
        const events = result.events || [];
        if (events.length === 0) return;

        const jobId = `batch-${Date.now()}`;
        log.info({ event: 'job_start', jobId, batchSize: events.length }, 'Processing batch');

        const promises = events.map(event => processEvent(event));
        for (let i = 0; i < promises.length; i += CONFIG.maxConcurrent) {
            const chunk = promises.slice(i, i + CONFIG.maxConcurrent);
            await Promise.allSettled(chunk);
        }
    };

    const timeoutPromise = new Promise((_, reject) => {
        const t = setTimeout(() => reject(new Error('BATCH_TIMEOUT')), CONFIG.batchTimeoutMs);
        if (t.unref) t.unref();
    });

    try {
        await Promise.race([runBatch(), timeoutPromise]);
    } catch (error) {
        if (error.message === 'BATCH_TIMEOUT') {
            log.warn({ event: 'job_batch_timeout' }, 'Batch timeout; will retry on next poll');
        } else {
            logError(error, { module: 'worker', event: 'job_batch_error' });
        }
    }
}

/**
 * Process a single outbox event
 */
async function processEvent(event) {
    const startTime = Date.now();

    try {
        // Build Cypher query if not pre-computed
        const { query, params } = event.cypher_query 
            ? { query: event.cypher_query, params: event.cypher_params }
            : buildCypherQuery(event);

        if (!query) {
            throw new Error('Could not build Cypher query');
        }

        // Execute on graph
        await executeCypher(event.graph_name, query, params);

        // Action UPDATE: sync IMPLEMENTS edge to Decision when decision_id present
        if (event.entity_type === 'Action' && event.operation === 'UPDATE' && event.payload) {
            const decisionId = event.payload.decision_id;
            const actionId = event.entity_id;
            if (decisionId) {
                try {
                    await executeCypher(
                        event.graph_name,
                        'MATCH (a:Action {id: $actionId}) MERGE (d:Decision {id: $decisionId}) MERGE (a)-[:IMPLEMENTS]->(d) RETURN a',
                        { actionId, decisionId }
                    );
                } catch (err) {
                    log.warn({ event: 'worker_action_implements_failed', actionId, decisionId, err: err.message }, 'IMPLEMENTS edge sync failed');
                }
            } else {
                try {
                    await executeCypher(
                        event.graph_name,
                        'MATCH (a:Action {id: $actionId})-[r:IMPLEMENTS]->() DELETE r',
                        { actionId }
                    );
                } catch (err) {
                    log.warn({ event: 'worker_action_implements_delete_failed', actionId, err: err.message }, 'IMPLEMENTS edge delete failed');
                }
            }
        }

        // Mark as completed
        await outbox.markCompleted(event.id);

        const durationMs = Date.now() - startTime;
        log.info({ event: 'job_end', operation: event.operation, entity_type: event.entity_type, entity_id: event.entity_id, durationMs }, 'Completed');

    } catch (error) {
        log.error({ event: 'job_failed', messageId: event.event_id, entity_type: event.entity_type, entity_id: event.entity_id, err: error.message }, 'Failed');
        await outbox.markFailed(event.id, error.message);
    }
}

/**
 * Build Cypher query from event
 */
function buildCypherQuery(event) {
    const { operation, entity_type, entity_id, payload } = event;

    switch (operation) {
        case 'CREATE':
            return buildCreateQuery(entity_type, entity_id, payload);
        case 'UPDATE':
            return buildUpdateQuery(entity_type, entity_id, payload);
        case 'DELETE':
            return buildDeleteQuery(entity_type, entity_id);
        case 'MERGE':
            return buildMergeQuery(entity_type, entity_id, payload);
        case 'LINK':
            return buildLinkQuery(payload);
        case 'UNLINK':
            return buildUnlinkQuery(payload);
        default:
            return { query: null, params: null };
    }
}

/**
 * Build CREATE node query.
 * For Action with sprint_id, also create IN_SPRINT relationship to Sprint node.
 */
function buildCreateQuery(label, id, properties) {
    const props = { ...properties, id };
    const sprintId = props.sprint_id;
    const propsString = Object.keys(props)
        .map(k => `${k}: $${k}`)
        .join(', ');

    if (label === 'Action' && sprintId) {
        return {
            query: `CREATE (n:Action {${propsString}}) WITH n MERGE (s:Sprint {id: $sprint_id}) CREATE (n)-[:IN_SPRINT]->(s) RETURN n`,
            params: props
        };
    }

    return {
        query: `CREATE (n:${label} {${propsString}}) RETURN n`,
        params: props
    };
}

/**
 * Build UPDATE node query
 */
function buildUpdateQuery(label, id, properties) {
    const setStatements = Object.keys(properties)
        .filter(k => k !== 'id')
        .map(k => `n.${k} = $${k}`)
        .join(', ');

    return {
        query: `MATCH (n:${label} {id: $id}) SET ${setStatements} RETURN n`,
        params: { id, ...properties }
    };
}

/**
 * Build DELETE node query
 */
function buildDeleteQuery(label, id) {
    return {
        query: `MATCH (n:${label} {id: $id}) DETACH DELETE n`,
        params: { id }
    };
}

/**
 * Build MERGE node query (upsert)
 */
function buildMergeQuery(label, id, properties) {
    const onCreateProps = Object.keys(properties)
        .map(k => `n.${k} = $${k}`)
        .join(', ');

    return {
        query: `MERGE (n:${label} {id: $id}) ON CREATE SET ${onCreateProps} ON MATCH SET ${onCreateProps} RETURN n`,
        params: { id, ...properties }
    };
}

/**
 * Build LINK (create relation) query
 */
function buildLinkQuery(payload) {
    const { fromType, fromId, toType, toId, relationType, properties = {} } = payload;

    const propsString = Object.keys(properties).length > 0
        ? ' {' + Object.keys(properties).map(k => `${k}: $${k}`).join(', ') + '}'
        : '';

    return {
        query: `
            MATCH (a:${fromType} {id: $fromId})
            MATCH (b:${toType} {id: $toId})
            MERGE (a)-[r:${relationType}${propsString}]->(b)
            RETURN r
        `,
        params: { fromId, toId, ...properties }
    };
}

/**
 * Build UNLINK (delete relation) query
 */
function buildUnlinkQuery(payload) {
    const { fromType, fromId, toType, toId, relationType } = payload;

    return {
        query: `
            MATCH (a:${fromType} {id: $fromId})-[r:${relationType}]->(b:${toType} {id: $toId})
            DELETE r
        `,
        params: { fromId, toId }
    };
}

/**
 * Execute Cypher query on graph.
 * Switches to graph_name before running so Fact and other project entities
 * are segregated per project (one graph per project).
 * Normalizes legacy godmode_* names to project_* for a single convention.
 */
async function executeCypher(graphName, query, params) {
    if (!graphConnector) {
        throw new Error('Graph connector not available');
    }

    const normalizedGraphName = graphName && graphName.startsWith('godmode_')
        ? `project_${graphName.slice(8)}`
        : graphName;

    // Switch to the event's graph so CREATE/UPDATE/DELETE run in the right project graph
    if (typeof graphConnector.switchGraph === 'function') {
        const switched = await graphConnector.switchGraph(normalizedGraphName);
        if (switched && switched.ok === false) {
            throw new Error(switched.error || 'Failed to switch graph');
        }
    }

    // Run query on current graph (connector may use query(cypher, params) or runCypher)
    if (typeof graphConnector.query === 'function') {
        return await graphConnector.query(query, params);
    }
    if (typeof graphConnector.runCypher === 'function') {
        return await graphConnector.runCypher(query, params);
    }
    if (graphConnector.graph) {
        const graph = graphConnector.graph(normalizedGraphName);
        return await graph.query(query, { params });
    }

    throw new Error('Unknown graph connector type');
}

/**
 * Health check
 */
async function healthCheck() {
    if (!isRunning) return;

    try {
        const stats = await outbox.getStats();
        
        if (stats.success) {
            const { pending, failed, dead_letter } = stats.stats;
            log.debug({ event: 'job_health', pending, failed, dead_letter }, 'Health');
            if (dead_letter > 10) {
                log.warn({ event: 'job_dead_letter_high', dead_letter }, 'Dead letter queue high');
            }
        }
    } catch (error) {
        logError(error, { module: 'worker', event: 'job_health_check_error' });
    }
}

/**
 * Get worker status
 */
function getStatus() {
    return {
        isRunning,
        config: CONFIG
    };
}

/**
 * Update configuration
 */
function configure(newConfig) {
    Object.assign(CONFIG, newConfig);
    
    // Restart polling with new interval if running
    if (isRunning && intervalId) {
        clearInterval(intervalId);
        intervalId = setInterval(processBatch, CONFIG.pollIntervalMs);
    }
}

module.exports = {
    start,
    stop,
    getStatus,
    configure,
    processBatch,  // Expose for manual triggering
    buildCypherQuery  // Exposed for tests
};
