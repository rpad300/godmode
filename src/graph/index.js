/**
 * Purpose:
 *   Barrel export for the graph database abstraction layer, exposing the
 *   provider interface, factory, and multi-graph manager.
 *
 * Responsibilities:
 *   - Re-export GraphProvider (abstract base class for all backends)
 *   - Re-export GraphFactory (provider creation, caching, and connection testing)
 *   - Re-export MultiGraphManager and its singleton helpers
 *
 * Key dependencies:
 *   - ./GraphProvider: abstract interface every backend must implement
 *   - ./GraphFactory: factory functions and provider registry
 *   - ./MultiGraphManager: multi-project graph isolation and cross-project queries
 *
 * Side effects:
 *   - Spreads GraphFactory exports, so all factory functions are available at the top level
 *
 * Notes:
 *   - Currently only the Supabase provider is registered in GraphFactory.
 *     Additional providers can be added to the PROVIDERS registry.
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
