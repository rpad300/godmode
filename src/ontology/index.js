/**
 * Ontology Module - GodMode Knowledge Graph Ontology System
 * 
 * SOTA v2.1 - State of the Art Ontology System
 * 
 * This module provides:
 * - OntologyManager: Schema management and validation (now with Supabase persistence)
 * - RelationInference: Automatic entity and relationship extraction
 * - EmbeddingEnricher: Enhanced embeddings with ontological context
 * - OntologyAgent: AI-powered ontology evolution (now with LLM analysis & auto-approval)
 * - SchemaExporter: Export ontology to graph with indexes and metadata
 * - InferenceEngine: Execute inference rules automatically
 * - OntologySync: Real-time sync between Supabase and graph provider
 * - OntologyBackgroundWorker: Background jobs for continuous optimization
 * - OntologyExtractor: Extract ontology from graph, validate compliance, merge ontologies (NEW v2.1)
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
