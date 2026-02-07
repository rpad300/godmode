/**
 * Query Planner Module
 * Optimizes Cypher queries automatically for better performance
 */

class QueryPlanner {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
        
        // Query patterns and their optimizations
        this.optimizationRules = [
            {
                pattern: /MATCH \((\w+)\) WHERE \1\.(\w+) = ['"](.+)['"]/gi,
                optimize: (match, var1, prop, val) => 
                    `MATCH (${var1} {${prop}: "${val}"})`
            },
            {
                pattern: /MATCH \((\w+):(\w+)\) MATCH \(\1\)-\[(\w+)\]->\((\w+)\)/gi,
                optimize: (match, var1, label, relVar, var2) =>
                    `MATCH (${var1}:${label})-[${relVar}]->(${var2})`
            },
            {
                pattern: /RETURN \* LIMIT (\d+)/gi,
                optimize: (match, limit) => {
                    const num = parseInt(limit);
                    if (num > 100) return `RETURN * LIMIT 100`;
                    return match;
                }
            }
        ];

        // Query statistics for learning
        this.queryStats = new Map();
    }

    setGraphProvider(provider) {
        this.graphProvider = provider;
    }

    /**
     * Optimize a Cypher query
     */
    optimize(query) {
        let optimized = query;
        const optimizations = [];

        // Apply optimization rules
        for (const rule of this.optimizationRules) {
            const before = optimized;
            optimized = optimized.replace(rule.pattern, rule.optimize);
            if (before !== optimized) {
                optimizations.push({
                    rule: rule.pattern.toString(),
                    before: before.substring(0, 100),
                    after: optimized.substring(0, 100)
                });
            }
        }

        // Add query hints
        optimized = this.addQueryHints(optimized);

        // Ensure LIMIT exists for safety
        if (!optimized.toLowerCase().includes('limit') && 
            optimized.toLowerCase().includes('return')) {
            optimized += ' LIMIT 100';
            optimizations.push({ rule: 'add_limit', added: 'LIMIT 100' });
        }

        return {
            original: query,
            optimized,
            optimizations,
            wasOptimized: optimizations.length > 0
        };
    }

    /**
     * Add query hints for indexed properties
     */
    addQueryHints(query) {
        // Common indexed properties
        const indexedProps = ['name', 'id', 'email', 'type'];
        
        // If query filters on indexed property, it's already optimized
        // Just return as-is for now
        return query;
    }

    /**
     * Analyze query for potential issues
     */
    analyze(query) {
        const issues = [];
        const suggestions = [];

        // Check for cartesian products
        const matchCount = (query.match(/MATCH/gi) || []).length;
        const whereCount = (query.match(/WHERE/gi) || []).length;
        if (matchCount > 1 && whereCount === 0) {
            issues.push({
                type: 'cartesian_product',
                severity: 'warning',
                message: 'Multiple MATCH clauses without WHERE may cause cartesian product'
            });
            suggestions.push('Add WHERE clause to connect MATCH patterns');
        }

        // Check for missing LIMIT
        if (!query.toLowerCase().includes('limit')) {
            issues.push({
                type: 'no_limit',
                severity: 'info',
                message: 'Query has no LIMIT clause'
            });
            suggestions.push('Add LIMIT to prevent large result sets');
        }

        // Check for RETURN *
        if (query.toLowerCase().includes('return *')) {
            issues.push({
                type: 'return_all',
                severity: 'info',
                message: 'RETURN * returns all properties'
            });
            suggestions.push('Specify only needed properties in RETURN');
        }

        // Check for unparameterized values
        const literalStrings = query.match(/['"][^'"]+['"]/g) || [];
        if (literalStrings.length > 2) {
            suggestions.push('Consider using parameters for literal values');
        }

        return {
            query,
            issues,
            suggestions,
            score: this.calculateQueryScore(issues)
        };
    }

    /**
     * Calculate query quality score (0-100)
     */
    calculateQueryScore(issues) {
        let score = 100;
        
        for (const issue of issues) {
            switch (issue.severity) {
                case 'error': score -= 30; break;
                case 'warning': score -= 15; break;
                case 'info': score -= 5; break;
            }
        }

        return Math.max(0, score);
    }

    /**
     * Record query execution stats
     */
    recordExecution(query, duration, resultCount) {
        const normalized = query.toLowerCase().trim();
        
        if (!this.queryStats.has(normalized)) {
            this.queryStats.set(normalized, {
                count: 0,
                totalDuration: 0,
                avgDuration: 0,
                maxDuration: 0,
                avgResults: 0
            });
        }

        const stats = this.queryStats.get(normalized);
        stats.count++;
        stats.totalDuration += duration;
        stats.avgDuration = stats.totalDuration / stats.count;
        stats.maxDuration = Math.max(stats.maxDuration, duration);
        stats.avgResults = ((stats.avgResults * (stats.count - 1)) + resultCount) / stats.count;
    }

    /**
     * Get slow queries
     */
    getSlowQueries(threshold = 1000) {
        const slow = [];
        
        for (const [query, stats] of this.queryStats) {
            if (stats.avgDuration > threshold) {
                slow.push({
                    query: query.substring(0, 200),
                    ...stats
                });
            }
        }

        return slow.sort((a, b) => b.avgDuration - a.avgDuration);
    }

    /**
     * Get frequently used queries
     */
    getFrequentQueries(limit = 10) {
        const queries = Array.from(this.queryStats.entries())
            .map(([query, stats]) => ({ query: query.substring(0, 200), ...stats }))
            .sort((a, b) => b.count - a.count);

        return queries.slice(0, limit);
    }

    /**
     * Suggest indexes based on query patterns
     */
    suggestIndexes() {
        const propertyUsage = new Map();

        for (const [query] of this.queryStats) {
            // Extract property access patterns
            const propMatches = query.matchAll(/\.(\w+)\s*[=<>]/g);
            for (const match of propMatches) {
                const prop = match[1];
                propertyUsage.set(prop, (propertyUsage.get(prop) || 0) + 1);
            }
        }

        return Array.from(propertyUsage.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([property, count]) => ({
                property,
                usageCount: count,
                suggestion: `CREATE INDEX ON :Node(${property})`
            }));
    }
}

// Singleton
let queryPlannerInstance = null;
function getQueryPlanner(options = {}) {
    if (!queryPlannerInstance) {
        queryPlannerInstance = new QueryPlanner(options);
    }
    if (options.graphProvider) {
        queryPlannerInstance.setGraphProvider(options.graphProvider);
    }
    return queryPlannerInstance;
}

module.exports = { QueryPlanner, getQueryPlanner };
