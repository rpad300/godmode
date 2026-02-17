/**
 * Purpose:
 *   Barrel export for the GodMode knowledge graph ontology subsystem.
 *   Re-exports every public class and its singleton getter so consumers can
 *   import the entire ontology surface from a single path.
 *
 * Responsibilities:
 *   - Centralise all ontology-related imports into one module entry-point
 *   - Expose both class constructors (for testing / custom instances) and
 *     singleton getters (for production use)
 *
 * Key dependencies:
 *   - Every sibling module in src/ontology/ (OntologyManager, RelationInference,
 *     EmbeddingEnricher, OntologyAgent, SchemaExporter, InferenceEngine,
 *     OntologySync, OntologyBackgroundWorker, OntologyExtractor,
 *     RelationshipInferrer)
 *
 * Side effects:
 *   - Requiring this file eagerly requires all sub-modules, which may trigger
 *     synchronous file-system reads (e.g. schema.json loading in OntologyManager)
 *
 * Notes:
 *   - Singleton instances are lazily created on first call to the getter functions,
 *     not at require-time.
 *   - SOTA v2.1 / v3.0 - Supabase-native graph support added across sub-modules.
 */

const { OntologyManager, getOntologyManager } = require('./OntologyManager');
const { RelationInference, getRelationInference } = require('./RelationInference');
const { EmbeddingEnricher, getEmbeddingEnricher } = require('./EmbeddingEnricher');
const { OntologyAgent, getOntologyAgent } = require('./OntologyAgent');
const { SchemaExporter, getSchemaExporter } = require('./SchemaExporter');
const { InferenceEngine, getInferenceEngine } = require('./InferenceEngine');
const { OntologySync, getOntologySync } = require('./OntologySync');
const { OntologyBackgroundWorker, getOntologyBackgroundWorker } = require('./OntologyBackgroundWorker');
const { OntologyExtractor, getOntologyExtractor } = require('./OntologyExtractor');
const { RelationshipInferrer, getRelationshipInferrer } = require('./RelationshipInferrer');

module.exports = {
    // Classes
    OntologyManager,
    RelationInference,
    EmbeddingEnricher,
    OntologyAgent,
    SchemaExporter,
    InferenceEngine,
    OntologySync,
    OntologyBackgroundWorker,
    OntologyExtractor,
    RelationshipInferrer,
    
    // Singleton getters
    getOntologyManager,
    getRelationInference,
    getEmbeddingEnricher,
    getOntologyAgent,
    getSchemaExporter,
    getInferenceEngine,
    getOntologySync,
    getOntologyBackgroundWorker,
    getOntologyExtractor,
    getRelationshipInferrer
};
