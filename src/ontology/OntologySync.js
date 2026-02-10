/**
 * OntologySync - Real-time synchronization of ontology between Supabase and graph database
 * 
 * Uses Supabase Realtime to:
 * - Watch for ontology_schema changes
 * - Propagate changes to graph database automatically
 * - Keep all connected clients in sync
 * 
 * SOTA v2.0 - State of the Art Ontology Synchronization
 * SOTA v3.0 - Native Supabase graph support (no external graph DB required)
 */

const { logger } = require('../logger');
const { getOntologyManager } = require('./OntologyManager');
const { getSchemaExporter } = require('./SchemaExporter');
const { getInferenceEngine } = require('./InferenceEngine');

const log = logger.child({ module: 'ontology-sync' });

class OntologySync {
    constructor(options = {}) {
        this.supabase = options.supabase;
        this.graphProvider = options.graphProvider;
        this.storage = options.storage;
        
        this.ontologyManager = options.ontologyManager || getOntologyManager();
        this.schemaExporter = options.schemaExporter || getSchemaExporter();
        this.inferenceEngine = options.inferenceEngine || getInferenceEngine();
        
        // Ensure ontologyManager has storage set for Supabase operations
        if (this.storage && this.ontologyManager.setStorage) {
            this.ontologyManager.setStorage(this.storage);
        }
        
        // Realtime subscription
        this.subscription = null;
        this.isListening = false;
        
        // Sync status
        this.lastSyncAt = null;
        this.syncInProgress = false;
        this.syncErrors = [];
        
        // Configuration
        this.autoSyncToGraph = options.autoSyncToGraph !== false;
        this.runInferenceOnSync = options.runInferenceOnSync || false;
        this.debounceMs = options.debounceMs || 2000;
        
        // Debounce timer
        this._debounceTimer = null;
        this._pendingChanges = [];
        
        // Event handlers
        this.onSchemaChange = options.onSchemaChange || (() => {});
        this.onSyncComplete = options.onSyncComplete || (() => {});
        this.onSyncError = options.onSyncError || (() => {});
    }

    /**
     * Start listening for ontology changes via Supabase Realtime
     * @returns {boolean} - Whether subscription was started
     */
    async startListening() {
        if (!this.supabase) {
            log.warn({ event: 'ontology_sync_no_supabase' }, 'No Supabase client configured');
            return false;
        }

        if (this.isListening) {
            log.debug({ event: 'ontology_sync_already_listening' }, 'Already listening');
            return true;
        }

        try {
            log.info({ event: 'ontology_sync_start_subscription' }, 'Starting Supabase Realtime subscription');

            // Subscribe to ontology_schema table changes
            this.subscription = this.supabase
                .channel('ontology_changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*', // INSERT, UPDATE, DELETE
                        schema: 'public',
                        table: 'ontology_schema'
                    },
                    (payload) => this._handleChange(payload)
                )
                .subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') {
                        this.isListening = true;
                        log.info({ event: 'ontology_sync_subscribed' }, 'Subscribed to ontology_schema changes');
                    } else if (status === 'CHANNEL_ERROR') {
                        log.warn({ event: 'ontology_sync_channel_error', reason: err?.message || 'unknown' }, 'Channel error (will retry)');
                        this.isListening = false;
                    } else if (status === 'TIMED_OUT') {
                        log.warn({ event: 'ontology_sync_timed_out' }, 'Subscription timed out, will retry');
                        this.isListening = false;
                    } else if (status === 'CLOSED') {
                        log.debug({ event: 'ontology_sync_channel_closed' }, 'Channel closed');
                        this.isListening = false;
                    }
                });

            return true;
        } catch (e) {
            log.error({ event: 'ontology_sync_start_listening_error', reason: e.message }, 'Failed to start listening');
            return false;
        }
    }

    /**
     * Stop listening for changes
     */
    async stopListening() {
        if (this.subscription) {
            await this.supabase.removeChannel(this.subscription);
            this.subscription = null;
            this.isListening = false;
            log.debug({ event: 'ontology_sync_stopped' }, 'Stopped listening');
        }
    }

    /**
     * Handle incoming change from Supabase Realtime
     * @private
     */
    _handleChange(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        log.debug({ event: 'ontology_sync_change', eventType, schemaType: newRecord?.schema_type || oldRecord?.schema_type, schemaName: newRecord?.schema_name || oldRecord?.schema_name }, 'Change detected');

        // Add to pending changes
        this._pendingChanges.push({
            type: eventType,
            record: newRecord || oldRecord,
            timestamp: Date.now()
        });

        // Debounce to batch rapid changes
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        this._debounceTimer = setTimeout(() => {
            this._processPendingChanges();
        }, this.debounceMs);

        // Notify listeners immediately
        this.onSchemaChange({
            type: eventType,
            record: newRecord || oldRecord
        });
    }

    /**
     * Process batched pending changes
     * SOTA v3.0 - Updated for native Supabase graph support
     * @private
     */
    async _processPendingChanges() {
        if (this._pendingChanges.length === 0) return;
        if (this.syncInProgress) {
            // Re-schedule if sync already in progress
            this._debounceTimer = setTimeout(() => this._processPendingChanges(), 1000);
            return;
        }

        const changes = [...this._pendingChanges];
        this._pendingChanges = [];
        
        log.debug({ event: 'ontology_sync_processing', count: changes.length }, 'Processing pending changes');
        
        this.syncInProgress = true;

        try {
            // Reload ontology from Supabase
            await this.ontologyManager.load();
            
            // Sync to graph database if enabled
            if (this.autoSyncToGraph && this.graphProvider?.connected) {
                this.schemaExporter.setGraphProvider(this.graphProvider);
                const syncResult = await this.schemaExporter.syncToGraph();
                
                if (syncResult.ok) {
                    log.debug({ event: 'ontology_sync_graph_complete', results: syncResult.results }, 'Graph sync complete');
                } else {
                    log.error({ event: 'ontology_sync_graph_failed', reason: syncResult.error }, 'Graph sync failed');
                    this.syncErrors.push({ error: syncResult.error, at: new Date().toISOString() });
                }
            }

            // Run inference if enabled
            if (this.runInferenceOnSync && this.inferenceEngine) {
                this.inferenceEngine.setGraphProvider(this.graphProvider);
                await this.inferenceEngine.runAllRules();
            }

            this.lastSyncAt = new Date().toISOString();
            
            this.onSyncComplete({
                changes: changes.length,
                syncedAt: this.lastSyncAt
            });

        } catch (e) {
            log.error({ event: 'ontology_sync_process_error', reason: e.message }, 'Error processing changes');
            this.syncErrors.push({ error: e.message, at: new Date().toISOString() });
            this.onSyncError(e);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Force a full sync from Supabase to graph database
     * SOTA v3.0 - Updated for native Supabase graph support
     * @returns {Promise<{ok: boolean, results?: object, error?: string}>}
     */
    async forceSync() {
        log.info({ event: 'ontology_sync_force_full' }, 'Forcing full sync');
        
        if (this.syncInProgress) {
            return { ok: false, error: 'Sync already in progress' };
        }

        this.syncInProgress = true;

        try {
            // Reload from Supabase
            await this.ontologyManager.load();

            // Sync to graph database
            if (this.graphProvider?.connected) {
                this.schemaExporter.setGraphProvider(this.graphProvider);
                const result = await this.schemaExporter.syncToGraph();
                
                this.lastSyncAt = new Date().toISOString();
                
                return result;
            }

            return { ok: false, error: 'Graph not connected' };
        } catch (e) {
            return { ok: false, error: e.message };
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Get sync status
     * @returns {object}
     */
    getStatus() {
        return {
            isListening: this.isListening,
            syncInProgress: this.syncInProgress,
            lastSyncAt: this.lastSyncAt,
            pendingChanges: this._pendingChanges.length,
            recentErrors: this.syncErrors.slice(-5),
            ontologySource: this.ontologyManager.getLoadedFrom(),
            graphConnected: this.graphProvider?.connected || false
        };
    }

    /**
     * Clear sync errors
     */
    clearErrors() {
        this.syncErrors = [];
    }

    /**
     * Set the graph provider for syncing
     */
    setGraphProvider(provider) {
        this.graphProvider = provider;
        this.schemaExporter.setGraphProvider(provider);
        if (this.inferenceEngine) {
            this.inferenceEngine.setGraphProvider(provider);
        }
    }

    /**
     * Set the Supabase client
     */
    setSupabase(supabase) {
        this.supabase = supabase;
    }

    /**
     * Broadcast a manual change notification (for local changes)
     * @param {object} change - Change details
     */
    async notifyChange(change) {
        if (this.supabase) {
            try {
                // Use Supabase broadcast to notify other clients
                await this.supabase
                    .channel('ontology_changes')
                    .send({
                        type: 'broadcast',
                        event: 'manual_change',
                        payload: change
                    });
            } catch (e) {
                log.warn({ event: 'ontology_sync_broadcast_error', reason: e.message }, 'Could not broadcast change');
            }
        }
    }
}

// Singleton
let instance = null;

function getOntologySync(options = {}) {
    if (!instance) {
        instance = new OntologySync(options);
    }
    return instance;
}

module.exports = {
    OntologySync,
    getOntologySync
};
