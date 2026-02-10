/**
 * Scheduled Jobs Module
 * Task scheduler for automated operations
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');

const log = logger.child({ module: 'scheduled-jobs' });

class ScheduledJobs {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.jobsFile = path.join(this.dataDir, 'scheduled-jobs.json');
        this.jobs = new Map();
        this.timers = new Map();
        this.executionLog = [];
        this.handlers = new Map();
        this.running = false;
        this.load();
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.jobsFile = path.join(this.dataDir, 'scheduled-jobs.json');
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.jobsFile)) {
                const data = JSON.parse(fs.readFileSync(this.jobsFile, 'utf8'));
                this.jobs = new Map(Object.entries(data.jobs || {}));
                this.executionLog = data.executionLog || [];
            }
        } catch (e) {
            this.jobs = new Map();
            this.executionLog = [];
        }
    }

    save() {
        try {
            const dir = path.dirname(this.jobsFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.jobsFile, JSON.stringify({
                jobs: Object.fromEntries(this.jobs),
                executionLog: this.executionLog.slice(0, 100)
            }, null, 2));
        } catch (e) {
            log.warn({ event: 'scheduled_jobs_save_warning', reason: e.message }, 'Save warning');
        }
    }

    /**
     * Register a job handler
     */
    registerHandler(jobType, handler) {
        this.handlers.set(jobType, handler);
        log.debug({ event: 'scheduled_jobs_handler_registered', jobType }, 'Registered handler');
    }

    /**
     * Create a scheduled job
     */
    createJob(options) {
        const jobId = options.id || `job_${Date.now()}`;
        
        const job = {
            id: jobId,
            name: options.name || jobId,
            type: options.type, // backup, cleanup, sync, retention, etc.
            schedule: options.schedule, // cron-like or interval
            intervalMs: this.parseInterval(options.schedule),
            enabled: options.enabled !== false,
            createdAt: new Date().toISOString(),
            lastRun: null,
            nextRun: null,
            runCount: 0,
            config: options.config || {}
        };

        // Calculate next run
        if (job.intervalMs) {
            job.nextRun = new Date(Date.now() + job.intervalMs).toISOString();
        }

        this.jobs.set(jobId, job);
        this.save();

        // Schedule if running
        if (this.running && job.enabled) {
            this.scheduleJob(job);
        }

        log.debug({ event: 'scheduled_jobs_created', jobName: job.name, schedule: job.schedule }, 'Created job');
        return job;
    }

    /**
     * Parse interval string to milliseconds
     */
    parseInterval(schedule) {
        if (!schedule) return null;
        if (typeof schedule === 'number') return schedule;

        const match = schedule.match(/^(\d+)(s|m|h|d)$/);
        if (!match) return null;

        const [, num, unit] = match;
        const multipliers = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000
        };

        return parseInt(num) * (multipliers[unit] || 1000);
    }

    /**
     * Schedule a job for execution
     */
    scheduleJob(job) {
        if (this.timers.has(job.id)) {
            clearInterval(this.timers.get(job.id));
        }

        if (!job.enabled || !job.intervalMs) return;

        const timer = setInterval(async () => {
            await this.executeJob(job.id);
        }, job.intervalMs);

        this.timers.set(job.id, timer);
    }

    /**
     * Execute a job
     */
    async executeJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) return { error: 'Job not found' };

        const execution = {
            jobId,
            jobName: job.name,
            startedAt: new Date().toISOString(),
            status: 'running',
            result: null,
            error: null,
            duration: null
        };

        const startTime = Date.now();

        try {
            const handler = this.handlers.get(job.type);
            if (!handler) {
                throw new Error(`No handler registered for job type: ${job.type}`);
            }

            execution.result = await handler(job.config);
            execution.status = 'completed';
        } catch (e) {
            execution.status = 'failed';
            execution.error = e.message;
        }

        execution.duration = Date.now() - startTime;
        execution.completedAt = new Date().toISOString();

        // Update job
        job.lastRun = execution.completedAt;
        job.runCount++;
        job.nextRun = job.intervalMs 
            ? new Date(Date.now() + job.intervalMs).toISOString() 
            : null;
        this.jobs.set(jobId, job);

        // Log execution
        this.executionLog.unshift(execution);
        if (this.executionLog.length > 100) {
            this.executionLog = this.executionLog.slice(0, 100);
        }

        this.save();
        log.debug({ event: 'scheduled_jobs_executed', jobName: job.name, status: execution.status, duration: execution.duration }, 'Executed job');

        return execution;
    }

    /**
     * Start the scheduler
     */
    start() {
        if (this.running) return;
        this.running = true;

        for (const [jobId, job] of this.jobs) {
            if (job.enabled) {
                this.scheduleJob(job);
            }
        }

        log.debug({ event: 'scheduled_jobs_started', count: this.jobs.size }, 'Started with jobs');
    }

    /**
     * Stop the scheduler
     */
    stop() {
        this.running = false;
        for (const [jobId, timer] of this.timers) {
            clearInterval(timer);
        }
        this.timers.clear();
        log.debug({ event: 'scheduled_jobs_stopped' }, 'Stopped');
    }

    /**
     * Get all jobs
     */
    getJobs() {
        return Array.from(this.jobs.values());
    }

    /**
     * Get job by ID
     */
    getJob(jobId) {
        return this.jobs.get(jobId);
    }

    /**
     * Update job
     */
    updateJob(jobId, updates) {
        const job = this.jobs.get(jobId);
        if (!job) return null;

        Object.assign(job, updates);
        if (updates.schedule) {
            job.intervalMs = this.parseInterval(updates.schedule);
            job.nextRun = job.intervalMs 
                ? new Date(Date.now() + job.intervalMs).toISOString() 
                : null;
        }

        this.jobs.set(jobId, job);
        this.save();

        // Reschedule if running
        if (this.running) {
            this.scheduleJob(job);
        }

        return job;
    }

    /**
     * Delete job
     */
    deleteJob(jobId) {
        if (this.timers.has(jobId)) {
            clearInterval(this.timers.get(jobId));
            this.timers.delete(jobId);
        }
        const deleted = this.jobs.delete(jobId);
        this.save();
        return deleted;
    }

    /**
     * Get execution log
     */
    getExecutionLog(options = {}) {
        let log = [...this.executionLog];
        if (options.jobId) {
            log = log.filter(e => e.jobId === options.jobId);
        }
        if (options.status) {
            log = log.filter(e => e.status === options.status);
        }
        return log.slice(0, options.limit || 50);
    }

    /**
     * Get stats
     */
    getStats() {
        const stats = {
            totalJobs: this.jobs.size,
            enabledJobs: 0,
            totalExecutions: this.executionLog.length,
            successfulExecutions: 0,
            failedExecutions: 0,
            byType: {}
        };

        for (const job of this.jobs.values()) {
            if (job.enabled) stats.enabledJobs++;
            stats.byType[job.type] = (stats.byType[job.type] || 0) + 1;
        }

        for (const exec of this.executionLog) {
            if (exec.status === 'completed') stats.successfulExecutions++;
            if (exec.status === 'failed') stats.failedExecutions++;
        }

        return stats;
    }

    /**
     * Create default jobs
     */
    createDefaultJobs() {
        // Auto backup every 6 hours
        this.createJob({
            id: 'auto_backup',
            name: 'Auto Backup',
            type: 'backup',
            schedule: '6h',
            config: { type: 'full' }
        });

        // Cleanup every 24 hours
        this.createJob({
            id: 'daily_cleanup',
            name: 'Daily Cleanup',
            type: 'cleanup',
            schedule: '24h',
            config: { maxAge: 30 }
        });

        // Retention policy every 12 hours
        this.createJob({
            id: 'retention_policy',
            name: 'Retention Policy',
            type: 'retention',
            schedule: '12h',
            config: {}
        });

        // Graph sync every hour
        this.createJob({
            id: 'graph_sync',
            name: 'Graph Sync',
            type: 'graph_sync',
            schedule: '1h',
            config: {}
        });

        // Integrity check every 4 hours
        this.createJob({
            id: 'integrity_check',
            name: 'Integrity Check',
            type: 'integrity',
            schedule: '4h',
            config: { autoFix: true }
        });

        return this.getJobs();
    }
}

// Singleton
let instance = null;
function getScheduledJobs(options = {}) {
    if (!instance) {
        instance = new ScheduledJobs(options);
    }
    if (options.dataDir) instance.setDataDir(options.dataDir);
    return instance;
}

module.exports = { ScheduledJobs, getScheduledJobs };
