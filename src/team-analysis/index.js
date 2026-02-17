/**
 * Purpose:
 *   Barrel export and singleton management for the team-analysis subsystem,
 *   which builds behavioral profiles of individuals and analyses team dynamics
 *   from meeting transcripts.
 *
 * Responsibilities:
 *   - Re-export TeamAnalyzer, GraphSync, and InterventionExtractor classes
 *   - Provide lazy singleton accessors with optional config injection
 *   - Expose resetInstances() for test isolation
 *
 * Key dependencies:
 *   - ./TeamAnalyzer: LLM-driven behavioral profiling and team dynamics
 *   - ./GraphSync: Persists analysis results to the graph database
 *   - ./InterventionExtractor: Extracts per-person transcript segments
 *
 * Side effects:
 *   - None at import time; singletons are created on first accessor call
 *
 * Notes:
 *   - getTeamAnalyzer() hot-reloads config on subsequent calls so that
 *     admin settings changes take effect without restarting the server
 */

const TeamAnalyzer = require('./TeamAnalyzer');
const GraphSync = require('./GraphSync');
const InterventionExtractor = require('./InterventionExtractor');

// Singleton instances
let teamAnalyzerInstance = null;
let graphSyncInstance = null;
let interventionExtractorInstance = null;

/**
 * Get or create TeamAnalyzer instance
 * @param {Object} options - Configuration options
 * @returns {TeamAnalyzer}
 */
function getTeamAnalyzer(options = {}) {
    if (!teamAnalyzerInstance) {
        teamAnalyzerInstance = new TeamAnalyzer(options);
    } else if (options.config) {
        // Update config if provided (singleton may have been created without config)
        teamAnalyzerInstance.config = options.config;
    }
    return teamAnalyzerInstance;
}

/**
 * Get or create GraphSync instance
 * @param {Object} options - Configuration options
 * @returns {GraphSync}
 */
function getGraphSync(options = {}) {
    if (!graphSyncInstance) {
        graphSyncInstance = new GraphSync(options);
    }
    return graphSyncInstance;
}

/**
 * Get or create InterventionExtractor instance
 * @param {Object} options - Configuration options
 * @returns {InterventionExtractor}
 */
function getInterventionExtractor(options = {}) {
    if (!interventionExtractorInstance) {
        interventionExtractorInstance = new InterventionExtractor(options);
    }
    return interventionExtractorInstance;
}

/**
 * Reset instances (for testing)
 */
function resetInstances() {
    teamAnalyzerInstance = null;
    graphSyncInstance = null;
    interventionExtractorInstance = null;
}

module.exports = {
    TeamAnalyzer,
    GraphSync,
    InterventionExtractor,
    getTeamAnalyzer,
    getGraphSync,
    getInterventionExtractor,
    resetInstances
};
