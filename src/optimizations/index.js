/**
 * Optimizations Module
 * Exports all optimization features (24 modules total)
 */

// === BATCH 1: Core Optimizations ===
const { EntityResolver, getEntityResolver } = require('./EntityResolver');
const { IncrementalSync, getIncrementalSync } = require('./IncrementalSync');
const { GraphAnalytics, getGraphAnalytics } = require('./GraphAnalytics');
const { AutoSummary, getAutoSummary } = require('./AutoSummary');
const { TemporalRelations, getTemporalRelations } = require('./TemporalRelations');
const { ConfidenceScores, getConfidenceScores } = require('./ConfidenceScores');
const { SmartDedup, getSmartDedup } = require('./SmartDedup');
const { ParallelProcessing, getParallelProcessing } = require('./ParallelProcessing');
const { FeedbackLoop, getFeedbackLoop } = require('./FeedbackLoop');
const { ExportGraph, getExportGraph } = require('./ExportGraph');
const { Webhooks, getWebhooks } = require('./Webhooks');
const { AutoTagging, getAutoTagging } = require('./AutoTagging');

// === BATCH 2: Advanced Optimizations ===
const { SemanticCache, getSemanticCache } = require('./SemanticCache');
const { QueryPlanner, getQueryPlanner } = require('./QueryPlanner');
const { ContextOptimizer, getContextOptimizer } = require('./ContextOptimizer');
const { GraphIndexing, getGraphIndexing } = require('./GraphIndexing');
const { BatchEmbeddings, getBatchEmbeddings } = require('./BatchEmbeddings');
const { MemoryPool, getMemoryPool } = require('./MemoryPool');
const { QuerySuggestions, getQuerySuggestions } = require('./QuerySuggestions');
const { HealthMonitor, getHealthMonitor } = require('./HealthMonitor');
const { AutoBackup, getAutoBackup } = require('./AutoBackup');
const { RateLimiter, getRateLimiter } = require('./RateLimiter');
const { UsageAnalytics, getUsageAnalytics } = require('./UsageAnalytics');
const { MultiLanguageNER, getMultiLanguageNER } = require('./MultiLanguageNER');

module.exports = {
    // === BATCH 1: Core (12 modules) ===
    
    // High Impact
    EntityResolver,
    getEntityResolver,
    IncrementalSync,
    getIncrementalSync,
    GraphAnalytics,
    getGraphAnalytics,
    AutoSummary,
    getAutoSummary,
    
    // Medium Impact
    TemporalRelations,
    getTemporalRelations,
    ConfidenceScores,
    getConfidenceScores,
    SmartDedup,
    getSmartDedup,
    ParallelProcessing,
    getParallelProcessing,
    
    // Nice to have
    FeedbackLoop,
    getFeedbackLoop,
    ExportGraph,
    getExportGraph,
    Webhooks,
    getWebhooks,
    AutoTagging,
    getAutoTagging,

    // === BATCH 2: Advanced (12 modules) ===
    
    // High Impact
    SemanticCache,
    getSemanticCache,
    QueryPlanner,
    getQueryPlanner,
    ContextOptimizer,
    getContextOptimizer,
    GraphIndexing,
    getGraphIndexing,
    
    // Medium Impact
    BatchEmbeddings,
    getBatchEmbeddings,
    MemoryPool,
    getMemoryPool,
    QuerySuggestions,
    getQuerySuggestions,
    HealthMonitor,
    getHealthMonitor,
    
    // Nice to have
    AutoBackup,
    getAutoBackup,
    RateLimiter,
    getRateLimiter,
    UsageAnalytics,
    getUsageAnalytics,
    MultiLanguageNER,
    getMultiLanguageNER
};
