/**
 * Health Monitor Module
 * Dashboard for system health monitoring
 */

const os = require('os');

class HealthMonitor {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
        this.storage = options.storage;
        this.checkInterval = options.checkInterval || 60000; // 1 minute
        
        // Health history
        this.history = [];
        this.maxHistory = options.maxHistory || 100;
        
        // Thresholds
        this.thresholds = {
            memoryWarning: 0.8,
            memoryCritical: 0.95,
            cpuWarning: 0.7,
            cpuCritical: 0.9,
            responseTimeWarning: 2000, // ms
            responseTimeCritical: 5000
        };

        // Current status
        this.status = 'unknown';
        this.issues = [];
    }

    setGraphProvider(provider) {
        this.graphProvider = provider;
    }

    setStorage(storage) {
        this.storage = storage;
    }

    /**
     * Get comprehensive health check
     */
    async getHealth() {
        const checks = await Promise.all([
            this.checkSystem(),
            this.checkGraph(),
            this.checkStorage(),
            this.checkLLM(),
            this.checkEndpoints()
        ]);

        const [system, graph, storage, llm, endpoints] = checks;

        // Determine overall status
        const allChecks = [system, graph, storage, llm, endpoints];
        let status = 'healthy';
        const issues = [];

        for (const check of allChecks) {
            if (check.status === 'error') {
                status = 'error';
                if (check.issues) issues.push(...check.issues);
            } else if (check.status === 'warning' && status !== 'error') {
                status = 'warning';
                if (check.issues) issues.push(...check.issues);
            }
        }

        const health = {
            status,
            issues,
            timestamp: new Date().toISOString(),
            checks: {
                system,
                graph,
                storage,
                llm,
                endpoints
            },
            uptime: process.uptime()
        };

        // Record in history
        this.recordHealth(health);

        return health;
    }

    /**
     * Check system resources
     */
    async checkSystem() {
        const memory = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memoryUsage = (totalMem - freeMem) / totalMem;
        
        const cpus = os.cpus();
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + (1 - idle / total);
        }, 0) / cpus.length;

        const issues = [];
        let status = 'healthy';

        if (memoryUsage > this.thresholds.memoryCritical) {
            status = 'error';
            issues.push('Memory usage critical');
        } else if (memoryUsage > this.thresholds.memoryWarning) {
            status = 'warning';
            issues.push('Memory usage high');
        }

        if (cpuUsage > this.thresholds.cpuCritical) {
            status = 'error';
            issues.push('CPU usage critical');
        } else if (cpuUsage > this.thresholds.cpuWarning) {
            if (status !== 'error') status = 'warning';
            issues.push('CPU usage high');
        }

        return {
            name: 'system',
            status,
            issues,
            details: {
                memoryUsage: (memoryUsage * 100).toFixed(1) + '%',
                cpuUsage: (cpuUsage * 100).toFixed(1) + '%',
                heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
                heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
                platform: process.platform,
                nodeVersion: process.version
            }
        };
    }

    /**
     * Check graph database
     */
    async checkGraph() {
        if (!this.graphProvider) {
            return {
                name: 'graph',
                status: 'warning',
                issues: ['Graph provider not configured'],
                details: { connected: false }
            };
        }

        if (!this.graphProvider.connected) {
            return {
                name: 'graph',
                status: 'error',
                issues: ['Graph database not connected'],
                details: { connected: false }
            };
        }

        try {
            const start = Date.now();
            const result = await this.graphProvider.query('MATCH (n) RETURN count(n) as count LIMIT 1');
            const responseTime = Date.now() - start;

            let status = 'healthy';
            const issues = [];

            if (responseTime > this.thresholds.responseTimeCritical) {
                status = 'error';
                issues.push('Graph response time critical');
            } else if (responseTime > this.thresholds.responseTimeWarning) {
                status = 'warning';
                issues.push('Graph response time slow');
            }

            return {
                name: 'graph',
                status,
                issues,
                details: {
                    connected: true,
                    responseTime: responseTime + 'ms',
                    nodeCount: result.results?.[0]?.count || 0
                }
            };
        } catch (e) {
            return {
                name: 'graph',
                status: 'error',
                issues: ['Graph query failed: ' + e.message],
                details: { connected: false, error: e.message }
            };
        }
    }

    /**
     * Check storage
     */
    async checkStorage() {
        if (!this.storage) {
            return {
                name: 'storage',
                status: 'warning',
                issues: ['Storage not configured'],
                details: {}
            };
        }

        try {
            const stats = {
                facts: this.storage.getFacts().length,
                people: this.storage.getPeople().length,
                decisions: this.storage.getDecisions().length,
                risks: this.storage.getRisks().length
            };

            return {
                name: 'storage',
                status: 'healthy',
                issues: [],
                details: stats
            };
        } catch (e) {
            return {
                name: 'storage',
                status: 'error',
                issues: ['Storage access failed: ' + e.message],
                details: { error: e.message }
            };
        }
    }

    /**
     * Check LLM availability
     */
    async checkLLM() {
        // Basic check - just verify the module loads
        try {
            const llm = require('../llm');
            return {
                name: 'llm',
                status: 'healthy',
                issues: [],
                details: { available: true }
            };
        } catch (e) {
            return {
                name: 'llm',
                status: 'error',
                issues: ['LLM module not available: ' + e.message],
                details: { available: false, error: e.message }
            };
        }
    }

    /**
     * Check critical endpoints
     */
    async checkEndpoints() {
        // This is a placeholder - in real implementation would check HTTP endpoints
        return {
            name: 'endpoints',
            status: 'healthy',
            issues: [],
            details: {
                api: 'available',
                port: process.env.PORT || 3005
            }
        };
    }

    /**
     * Record health in history
     */
    recordHealth(health) {
        this.history.unshift({
            timestamp: health.timestamp,
            status: health.status,
            issueCount: health.issues.length
        });

        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(0, this.maxHistory);
        }

        this.status = health.status;
        this.issues = health.issues;
    }

    /**
     * Get health history
     */
    getHistory(limit = 50) {
        return this.history.slice(0, limit);
    }

    /**
     * Get health summary
     */
    getSummary() {
        const last24h = this.history.filter(h => 
            Date.now() - new Date(h.timestamp).getTime() < 24 * 60 * 60 * 1000
        );

        const statusCounts = { healthy: 0, warning: 0, error: 0 };
        for (const h of last24h) {
            statusCounts[h.status] = (statusCounts[h.status] || 0) + 1;
        }

        const uptime = last24h.length > 0
            ? ((statusCounts.healthy + statusCounts.warning) / last24h.length * 100).toFixed(1)
            : 100;

        return {
            currentStatus: this.status,
            currentIssues: this.issues,
            last24h: statusCounts,
            uptimePercentage: uptime + '%',
            checksCount: last24h.length
        };
    }

    /**
     * Start periodic health checks
     */
    startMonitoring() {
        this.intervalId = setInterval(async () => {
            await this.getHealth();
        }, this.checkInterval);
        
        console.log('[HealthMonitor] Started monitoring every', this.checkInterval / 1000, 'seconds');
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
}

// Singleton
let healthMonitorInstance = null;
function getHealthMonitor(options = {}) {
    if (!healthMonitorInstance) {
        healthMonitorInstance = new HealthMonitor(options);
    }
    if (options.graphProvider) healthMonitorInstance.setGraphProvider(options.graphProvider);
    if (options.storage) healthMonitorInstance.setStorage(options.storage);
    return healthMonitorInstance;
}

module.exports = { HealthMonitor, getHealthMonitor };
