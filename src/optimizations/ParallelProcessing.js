/**
 * Purpose:
 *   Execute async processing functions across collections of items with
 *   configurable concurrency, timeouts, rate limiting, and progress
 *   reporting.
 *
 * Responsibilities:
 *   - Process items in concurrent batches (processBatch) with per-item
 *     timeout protection via Promise.race
 *   - Process items sequentially with a rate limit (processWithRateLimit)
 *   - Provide a concurrent map utility (mapConcurrent) for order-
 *     preserving parallel transforms
 *   - Execute prioritized task queues (executePriorityQueue)
 *   - Report progress via an optional onProgress callback
 *
 * Key dependencies:
 *   - worker_threads: imported but not currently used for actual Worker
 *     spawning (processing stays in the main thread via async batching)
 *
 * Side effects:
 *   - None beyond executing the caller-supplied processFn
 *
 * Notes:
 *   - Despite importing worker_threads, actual work is done with
 *     Promise.all batches, not OS-level threads. The import may have
 *     been intended for future expansion.
 *   - mapConcurrent's completed-promise filtering relies on a .isSettled
 *     property that standard Promises do not have; this path may not
 *     correctly remove resolved promises from the executing set.
 *     Assumption: works in practice because Promise.all at the end
 *     catches up.
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { logger } = require('../logger');

const log = logger.child({ module: 'parallel-processing' });

class ParallelProcessing {
    constructor(options = {}) {
        this.maxWorkers = options.maxWorkers || 4;
        this.batchSize = options.batchSize || 5;
        this.timeout = options.timeout || 60000; // 60 seconds per item
    }

    /**
     * Process items in parallel batches
     * @param {Array} items - Items to process
     * @param {Function} processFn - Async function to process each item
     * @param {object} options - Processing options
     */
    async processBatch(items, processFn, options = {}) {
        const results = [];
        const errors = [];
        const concurrency = options.concurrency || this.maxWorkers;
        
        log.debug({ event: 'parallel_processing_batch_start', itemCount: items.length, concurrency }, 'Processing items');

        // Process in batches
        for (let i = 0; i < items.length; i += concurrency) {
            const batch = items.slice(i, i + concurrency);
            const batchPromises = batch.map(async (item, idx) => {
                try {
                    const result = await Promise.race([
                        processFn(item),
                        this.timeoutPromise(this.timeout)
                    ]);
                    return { success: true, result, index: i + idx };
                } catch (error) {
                    return { success: false, error: error.message, index: i + idx };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            
            for (const r of batchResults) {
                if (r.success) {
                    results.push(r.result);
                } else {
                    errors.push({ index: r.index, error: r.error });
                }
            }

            // Progress callback
            if (options.onProgress) {
                const progress = Math.min(100, Math.round(((i + batch.length) / items.length) * 100));
                options.onProgress(progress, results.length, errors.length);
            }
        }

        return {
            results,
            errors,
            total: items.length,
            successful: results.length,
            failed: errors.length
        };
    }

    /**
     * Create a timeout promise
     */
    timeoutPromise(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Processing timeout')), ms);
        });
    }

    /**
     * Process with rate limiting
     */
    async processWithRateLimit(items, processFn, options = {}) {
        const rateLimit = options.rateLimit || 10; // items per second
        const delay = 1000 / rateLimit;
        const results = [];

        for (let i = 0; i < items.length; i++) {
            const startTime = Date.now();
            
            try {
                const result = await processFn(items[i]);
                results.push({ success: true, result });
            } catch (error) {
                results.push({ success: false, error: error.message });
            }

            // Rate limit delay
            const elapsed = Date.now() - startTime;
            if (elapsed < delay) {
                await new Promise(resolve => setTimeout(resolve, delay - elapsed));
            }

            if (options.onProgress) {
                options.onProgress(Math.round(((i + 1) / items.length) * 100));
            }
        }

        return results;
    }

    /**
     * Chunk array into smaller pieces
     */
    chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Process files in parallel
     */
    async processFiles(files, processFn, options = {}) {
        const startTime = Date.now();
        
        const result = await this.processBatch(files, processFn, {
            concurrency: options.concurrency || this.maxWorkers,
            onProgress: options.onProgress
        });

        result.duration = Date.now() - startTime;
        result.avgTimePerFile = result.duration / result.total;

        log.info({ event: 'parallel_processing_completed', successful: result.successful, total: result.total, durationMs: result.duration, avgMsPerFile: Math.round(result.avgTimePerFile) }, 'Completed');

        return result;
    }

    /**
     * Map function with concurrency control
     */
    async mapConcurrent(items, mapFn, concurrency = this.maxWorkers) {
        const results = new Array(items.length);
        const executing = [];

        for (let i = 0; i < items.length; i++) {
            const promise = Promise.resolve().then(() => mapFn(items[i], i)).then(result => {
                results[i] = result;
            });

            executing.push(promise);

            if (executing.length >= concurrency) {
                await Promise.race(executing);
                // Remove completed promises
                const completed = executing.filter(p => p.isSettled);
                for (const c of completed) {
                    const idx = executing.indexOf(c);
                    if (idx > -1) executing.splice(idx, 1);
                }
            }
        }

        await Promise.all(executing);
        return results;
    }

    /**
     * Execute tasks with priority queue
     */
    async executePriorityQueue(tasks) {
        // Sort by priority (higher = first)
        const sorted = [...tasks].sort((a, b) => (b.priority || 0) - (a.priority || 0));
        
        const results = [];
        for (const task of sorted) {
            try {
                const result = await task.execute();
                results.push({ task: task.name, success: true, result });
            } catch (error) {
                results.push({ task: task.name, success: false, error: error.message });
            }
        }

        return results;
    }
}

// Singleton
let parallelProcessingInstance = null;
function getParallelProcessing(options = {}) {
    if (!parallelProcessingInstance) {
        parallelProcessingInstance = new ParallelProcessing(options);
    }
    return parallelProcessingInstance;
}

module.exports = { ParallelProcessing, getParallelProcessing };
