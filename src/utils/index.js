/**
 * Purpose:
 *   Public barrel export for shared utility classes used across the application.
 *
 * Responsibilities:
 *   - Re-export Cache, QueryCache, SyncTracker, and RequestDedup classes
 *   - Expose singleton accessors (getCache, getQueryCache, getSyncTracker, getRequestDedup)
 *
 * Key dependencies:
 *   - ./Cache: In-memory LRU cache with TTL
 *   - ./SyncTracker: Filesystem-backed incremental sync state
 *   - ./RequestDedup: Concurrent request deduplication
 *
 * Side effects:
 *   - None at import time; singletons are lazily created on first access
 *
 * Notes:
 *   - Consumers should prefer singleton accessors to avoid multiple cache instances
 */

const { Cache, QueryCache, getCache, getQueryCache } = require('./Cache');
const { SyncTracker, getSyncTracker } = require('./SyncTracker');
const { RequestDedup, getRequestDedup } = require('./RequestDedup');

module.exports = {
    Cache,
    QueryCache,
    getCache,
    getQueryCache,
    SyncTracker,
    getSyncTracker,
    RequestDedup,
    getRequestDedup
};
