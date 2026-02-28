/**
 * Purpose:
 *   Background polling worker that drains the Supabase outbox table and replays
 *   each event as a Cypher mutation against the project's graph database (one
 *   graph per project, e.g. FalkorDB or Neo4j).
 *
 * Responsibilities:
 *   - Poll the outbox at a configurable interval and claim batches of events
 *   - Translate outbox events (CREATE/UPDATE/DELETE/MERGE/LINK/UNLINK) into
 *     parameterized Cypher queries
 *   - Execute Cypher on the correct project graph (auto-switches via graphConnector)
 *   - Handle the special Action -> Decision IMPLEMENTS edge lifecycle
 *   - Mark events as completed or failed in the outbox
 *   - Run periodic health checks and warn on dead-letter queue growth
 *   - Enforce a per-batch timeout to prevent a stuck worker from blocking the poll loop
 *
 * Key dependencies:
 *   - ./supabase/outbox: claimBatch, markCompleted, markFailed, getStats
 *   - ./logger: structured logging (pino child)
 *   - graphConnector (injected at start): must expose switchGraph() and one of
 *     query(), runCypher(), or graph().query()
 *
 * Side effects:
 *   - Mutates the graph database (creates/updates/deletes nodes and relationships)
 *   - Mutates the Supabase outbox table (claim, complete, fail status transitions)
 *   - Holds two unref'd setInterval timers (poll + health check) while running
 *
 * Notes:
 *   - Timers are unref'd so the worker does not prevent Node process exit during
 *     tests or graceful shutdown.
 *   - Batch concurrency is capped at maxConcurrent (default 3) using chunked
 *     Promise.allSettled, not a full semaphore -- burst ordering is not guaranteed.
 *   - Legacy graph names prefixed "godmode_" are normalized to "project_" to
 *     maintain a single naming convention.
 *   - The processBatch and buildCypherQuery functions are exported for testing.
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
 * Start the sync worker polling loop.
 *
 * Idempotent -- calling start() when already running is a no-op.
 * Fires an immediate processBatch() before entering the interval loop
 * so that any events queued while the worker was stopped are picked up
 * without waiting for the first poll tick.
 *
 * @param {Object} graphConnection - Graph connector instance (must support
 *   switchGraph and at least one of query/runCypher/graph)
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
 * Claim and process a batch of outbox events.
 *
 * Wraps the actual work in a Promise.race against a timeout so that a
 * single slow graph operation cannot block the poll loop indefinitely.
 * Events within a batch are processed in chunks of maxConcurrent using
 * Promise.allSettled (failures in one event do not abort sibling events).
 *
 * On timeout the batch is abandoned -- uncompleted events remain claimed
 * and will be retried on the next poll via the outbox's retry mechanism.
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
 * Process a single outbox event: build Cypher, execute, mark done/failed.
 *
 * Special-case: when an Action is UPDATEd with a decision_id, an IMPLEMENTS
 * edge is created (or removed if decision_id is cleared). This keeps the
 * graph's Action->Decision links in sync with the relational model.
 *
 * @param {Object} event - Outbox row: {id, event_id, operation, entity_type,
 *   entity_id, graph_name, cypher_query?, cypher_params?, payload}
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
 * Translate an outbox event into a parameterized Cypher query.
 *
 * Dispatches on event.operation (CREATE/UPDATE/DELETE/MERGE/LINK/UNLINK).
 * Returns {query: null, params: null} for unrecognized operations so the
 * caller can treat it as an error without a thrown exception.
 *
 * @param {Object} event - Outbox event row
 * @returns {{query: string|null, params: object|null}}
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
 * Build a CREATE node query.
 *
 * Special case: Action nodes with a sprint_id also get an IN_SPRINT
 * relationship to a Sprint node (MERGE'd to avoid duplicates).
 *
 * @param {string} label - Node label (Cypher label, e.g. "Fact", "Action")
 * @param {string} id - Entity UUID
 * @param {Object} properties - All properties to set on the new node
 * @returns {{query: string, params: object}}
 */
function buildCreateQuery(label, id, properties) {
    const props = { ...properties, id };
    const sprintId = props.sprint_id;
    const propsString = Object.keys(props)
        .map(k => `${k}: $${k}`)
        .join(', ');

    const sprintableTypes = ['Action', 'Fact', 'Decision', 'Risk', 'Question'];
    if (sprintableTypes.includes(label) && sprintId) {
        return {
            query: `CREATE (n:${label} {${propsString}}) WITH n MERGE (s:Sprint {id: $sprint_id}) CREATE (n)-[:PART_OF_SPRINT]->(s) RETURN n`,
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
 * Build a MERGE (upsert) node query.
 *
 * Uses ON CREATE SET and ON MATCH SET with identical property lists so that
 * the node is fully populated regardless of whether it already existed.
 *
 * @param {string} label - Node label
 * @param {string} id - Entity UUID (used as the merge key)
 * @param {Object} properties - Properties to set/update
 * @returns {{query: string, params: object}}
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
 * Build a LINK query that creates (MERGEs) a relationship between two nodes.
 *
 * Uses MERGE rather than CREATE to make the operation idempotent -- replaying
 * the same LINK event twice will not produce duplicate edges.
 *
 * @param {Object} payload - {fromType, fromId, toType, toId, relationType, properties?}
 * @returns {{query: string, params: object}}
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
 * Execute a Cypher query on the correct project graph.
 *
 * Steps:
 *   1. Normalize legacy "godmode_*" graph names to "project_*"
 *   2. Switch the connector to the target graph (one graph per project)
 *   3. Run the query via whichever method the connector exposes
 *      (query, runCypher, or graph().query -- checked in that order)
 *
 * @param {string} graphName - Logical graph name from the outbox event
 * @param {string} query - Parameterized Cypher query string
 * @param {Object} params - Cypher parameter map
 * @returns {Promise<any>} Query result from the graph connector
 * @throws {Error} If connector is missing or graph switch fails
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
 * Hot-update worker configuration.
 *
 * Merges newConfig into the active CONFIG object. If the poll interval
 * changed and the worker is running, restarts the polling timer immediately
 * so the new interval takes effect without a stop/start cycle.
 *
 * @param {Object} newConfig - Partial config to merge (pollIntervalMs, batchSize, etc.)
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
