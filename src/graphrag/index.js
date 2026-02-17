/**
 * Purpose:
 *   Barrel export for the GraphRAG module, aggregating the core engine
 *   and all state-of-the-art retrieval-augmented generation enhancements.
 *
 * Responsibilities:
 *   - Re-export GraphRAGEngine (main orchestrator)
 *   - Re-export SOTA modules: Reranker, HyDE, MultiHopReasoning,
 *     CommunityDetection, EmbeddingPrompts, CypherGenerator
 *   - Provide singleton getters for each module to simplify consumption
 *
 * Key dependencies:
 *   - ./GraphRAGEngine: core RAG engine combining graph + semantic search
 *   - ./Reranker: cross-encoder and RRF-based result reranking
 *   - ./HyDE: Hypothetical Document Embeddings for improved retrieval
 *   - ./MultiHopReasoning: query decomposition and iterative retrieval
 *   - ./CommunityDetection: graph community and centrality analytics
 *   - ./EmbeddingPrompts: instruction-tuned prompt templates for embeddings
 *   - ./CypherGenerator: AI-powered natural language to Cypher translation
 *
 * Side effects:
 *   - None (pure re-export)
 *
 * Notes:
 *   - Each sub-module exposes both a class and a singleton getter (e.g. Reranker / getReranker).
 *     Use the getter for shared state; instantiate the class for isolated usage.
 */

const GraphRAGEngine = require('./GraphRAGEngine');
const { Reranker, getReranker } = require('./Reranker');
const { HyDE, getHyDE } = require('./HyDE');
const { MultiHopReasoning, getMultiHopReasoning } = require('./MultiHopReasoning');
const { CommunityDetection, getCommunityDetection } = require('./CommunityDetection');
const { EmbeddingPrompts, getEmbeddingPrompts } = require('./EmbeddingPrompts');
const { CypherGenerator, getCypherGenerator } = require('./CypherGenerator');

module.exports = {
    GraphRAGEngine,
    
    // SOTA modules
    Reranker,
    getReranker,
    HyDE,
    getHyDE,
    MultiHopReasoning,
    getMultiHopReasoning,
    CommunityDetection,
    getCommunityDetection,
    EmbeddingPrompts,
    getEmbeddingPrompts,
    
    // AI-powered Cypher generation
    CypherGenerator,
    getCypherGenerator
};
