/**
 * GraphRAG Module
 * Exports GraphRAG functionality with SOTA enhancements
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
