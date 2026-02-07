/**
 * FalkorDB Sync Worker
 * Background worker that processes the outbox and syncs to FalkorDB
 */

const outbox = global.__OUTBOX_MOCK__ || require('./supabase/outbox');

// Worker state
let isRunning = false;
let intervalId = null;
let healthIntervalId = null;
let graphConnector = null;
let processedCount = 0;
let errorCount = 0;

// Configuration
const CONFIG = {
    pollIntervalMs: 5000,       // How often to check for new events
    batchSize: 50,              // Events per batch
    maxConcurrent: 3,           // Max concurrent graph operations
    healthCheckIntervalMs: 60000 // Health check frequency
};

/**
 * Start the sync worker
 */
function start(graphConnection) {
    if (isRunning) {
        console.log('[SyncWorker] Already running');
        return false;
    }

    graphConnector = graphConnection;
    isRunning = true;
    processedCount = 0;
    errorCount = 0;

    console.log('[SyncWorker] Starting...');

    // Start polling
    intervalId = setInterval(processBatch, CONFIG.pollIntervalMs);
    // Don't keep the process alive just because of polling (helps Jest)
    if (typeof intervalId.unref === 'function') intervalId.unref();

    // Initial run
    processBatch();

    // Health check
    healthIntervalId = setInterval(healthCheck, CONFIG.healthCheckIntervalMs);
    if (typeof healthIntervalId.unref === 'function') healthIntervalId.unref();

    console.log('[SyncWorker] Started');
    return true;
}

/**
 * Check if worker is running (for tests)
 */
function isRunningFn() {
    return isRunning;
}

/**
 * Stop the sync worker
 */
function stop() {
    if (!isRunning) return false;

    console.log('[SyncWorker] Stopping...');

    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }

    if (healthIntervalId) {
        clearInterval(healthIntervalId);
        healthIntervalId = null;
    }

    isRunning = false;
    console.log('[SyncWorker] Stopped');
    return true;
}

/**
 * Process a batch of outbox events
 */
async function processBatch() {
    if (!isRunning || !graphConnector) return;

    try {
        // Claim batch
        const result = await outbox.claimBatch(CONFIG.batchSize);
        if (!result || !result.success) return;
        const events = result.events || [];
        if (events.length === 0) return;

        console.log(`[SyncWorker] Processing ${events.length} events`);

        // Process events
        const promises = events.map(event => processEvent(event));
        
        // Process in chunks to limit concurrency
        for (let i = 0; i < promises.length; i += CONFIG.maxConcurrent) {
            const chunk = promises.slice(i, i + CONFIG.maxConcurrent);
            await Promise.allSettled(chunk);
        }

    } catch (error) {
        console.error('[SyncWorker] Batch error:', error);
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
            : buildCypherQueryParts(event);

        if (!query) {
            throw new Error('Could not build Cypher query');
        }

        // Execute on FalkorDB
        await executeCypher(event.graph_name, query, params);

        // Mark as completed
        await outbox.markCompleted(event.id);
        processedCount += 1;

        const duration = Date.now() - startTime;
        console.log(`[SyncWorker] Completed ${event.operation} ${event.entity_type}:${event.entity_id} (${duration}ms)`);

    } catch (error) {
        errorCount += 1;
        console.error(`[SyncWorker] Failed ${event.event_id}:`, error.message);
        await outbox.markFailed(event.id, error.message);
    }
}

/**
 * Build Cypher query from event
 */
function buildCypherQueryParts(event) {
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
            return buildLinkQuery(event);
        case 'UNLINK':
            return buildUnlinkQuery(event);
        default:
            return { query: null, params: null };
    }
}

// Compatibility: unit/integration tests expect a query STRING
function buildCypherQuery(event) {
    const built = buildCypherQueryParts(event);
    return built?.query || null;
}

/**
 * Build CREATE node query
 */
function buildCreateQuery(label, id, properties) {
    const props = { ...properties, id };
    const propsString = Object.keys(props)
        .map(k => `${k}: $${k}`)
        .join(', ');

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
function buildLinkQuery(event) {
    const payload = event?.payload || {};

    // Support both legacy (tests) and newer payload keys
    const fromType = payload.from_type ?? payload.fromType;
    const fromId = payload.from_id ?? payload.fromId;
    const toType = payload.to_type ?? payload.toType;
    const toId = payload.to_id ?? payload.toId;
    const relationType = payload.relation_type ?? payload.relationType ?? event?.entity_type;
    const properties = payload.properties || {};

    const propsString = Object.keys(properties).length > 0
        ? ' {' + Object.keys(properties).map(k => `${k}: $${k}`).join(', ') + '}'
        : '';

    return {
        query: `
            MATCH (a:${fromType} {id: $fromId})
            MATCH (b:${toType} {id: $toId})
            CREATE (a)-[r:${relationType}${propsString}]->(b)
            RETURN r
        `,
        params: { fromId, toId, ...properties }
    };
}

/**
 * Build UNLINK (delete relation) query
 */
function buildUnlinkQuery(event) {
    const payload = event?.payload || {};

    const fromType = payload.from_type ?? payload.fromType;
    const fromId = payload.from_id ?? payload.fromId;
    const toType = payload.to_type ?? payload.toType;
    const toId = payload.to_id ?? payload.toId;
    const relationType = payload.relation_type ?? payload.relationType ?? event?.entity_type;

    return {
        query: `
            MATCH (a:${fromType} {id: $fromId})-[r:${relationType}]->(b:${toType} {id: $toId})
            DELETE r
        `,
        params: { fromId, toId }
    };
}

/**
 * Execute Cypher query on FalkorDB in the correct graph.
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
            
            // Log status
            console.log(`[SyncWorker] Health: pending=${pending}, failed=${failed}, dead_letter=${dead_letter}`);

            // Alert if too many failures
            if (dead_letter > 10) {
                console.warn(`[SyncWorker] WARNING: ${dead_letter} events in dead letter queue`);
            }
        }
    } catch (error) {
        console.error('[SyncWorker] Health check error:', error);
    }
}

/**
 * Get worker status
 */
function getStatus() {
    return {
        running: isRunning,
        processedCount,
        errorCount,
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
    isRunning: isRunningFn,
    getStatus,
    configure,
    processBatch, // Expose for manual triggering

    // Expose query builder for tests
    buildCypherQuery,
    buildCypherQueryParts
};
