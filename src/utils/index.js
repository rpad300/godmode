/**
 * Utils Module
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
