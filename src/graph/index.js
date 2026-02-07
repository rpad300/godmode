/**
 * Graph Database Module
 * Exports all graph-related functionality
 */

const GraphProvider = require('./GraphProvider');
const GraphFactory = require('./GraphFactory');
const { MultiGraphManager, getMultiGraphManager, resetMultiGraphManager } = require('./MultiGraphManager');

module.exports = {
    GraphProvider,
    GraphFactory,
    MultiGraphManager,
    getMultiGraphManager,
    resetMultiGraphManager,
    ...GraphFactory
};
