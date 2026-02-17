/**
 * Purpose:
 *   Compatibility bridge between the legacy synchronous Storage API (JSON files)
 *   and the new async Supabase-backed storage. Allows the rest of the codebase to
 *   migrate incrementally without a big-bang rewrite.
 *
 * Responsibilities:
 *   - Present the same method signatures as Storage (getFacts, addFact, getDocuments, etc.)
 *     but delegate to SupabaseStorage when available
 *   - Maintain an in-memory cache (_cache) for sync-style reads; refresh from Supabase
 *     on init, project switch, and explicit refreshCache() calls
 *   - Mirror cached data into legacy structure properties (this.knowledge, this.questions,
 *     this.documents) so code that reads those directly still works
 *   - Fall back to local JSON files (via projects.json) when Supabase is unavailable
 *   - Provide CRUD for all entity types: facts, decisions, risks, actions, questions,
 *     people, documents, contacts (with aliases, relationships, teams), conversations,
 *     sprints, user stories, briefings, chat sessions, emails, and ontology
 *   - Handle legacy project ID resolution (non-UUID IDs from the JSON storage era)
 *   - Support contact import/export (JSON and CSV), duplicate detection, and merge
 *
 * Key dependencies:
 *   - ./supabase/storageHelper (optional, try-loaded): Supabase storage backend
 *   - ./logger: Structured logging
 *   - fs / path: Local fallback for projects.json and file-based paths
 *
 * Side effects:
 *   - On init, reads Supabase DB (all entity tables) to populate the in-memory cache
 *   - Falls back to reading local projects.json if Supabase is unavailable
 *   - All write methods (add*, update*, delete*) mutate Supabase AND the in-memory cache
 *   - Supabase module load failure is non-fatal (caught and logged as warning)
 *
 * Notes:
 *   - Many methods return sync values from cache but perform async Supabase writes;
 *     callers that need write confirmation should await the async methods
 *   - The _isSupabaseMode flag can flip to false mid-session if Supabase init fails,
 *     causing a graceful degradation to cache-only mode
 *   - Contact alias matching is case-insensitive and trimmed
 *   - Document status mapping: legacy 'processed' == Supabase 'completed'
 *
 * Usage:
 *   // Async (preferred):
 *   const { createCompatStorage } = require('./storageCompat');
 *   const storage = await createCompatStorage(dataDir);
 *
 *   // Sync fallback (may have stale data):
 *   const { createSyncCompatStorage } = require('./storageCompat');
 *   const storage = createSyncCompatStorage(dataDir);
 */

const path = require('path');
const fs = require('fs');
const { logger: rootLogger, logError } = require('./logger');

const log = rootLogger.child({ module: 'storage' });

// Try to load Supabase helper - may fail due to project folder name conflict
let supabaseHelper = null;
try {
    supabaseHelper = require('./supabase/storageHelper');
} catch (e) {
    log.warn({ event: 'supabase_module_unavailable', err: e.message, code: e.code }, 'Supabase module not available, using local storage fallback');
}

/**
 * Compatibility wrapper that presents the legacy Storage interface while delegating
 * to SupabaseStorage for persistence.
 *
 * Lifecycle: construct -> init() -> ready.
 * After init(), data is available synchronously via cache properties.
 *
 * Dual-write pattern: writes go to Supabase first, then update the local cache.
 * Reads always return from cache for speed. Cache is refreshed on init() and
 * switchProject(), or manually via refreshCache().
 *
 * Invariants:
 *   - this._cache always reflects the current project's data
 *   - this.knowledge / this.questions / this.documents mirror _cache for backward compat
 *   - If _supabase is null, all operations are cache-only (no persistence)
 */
class StorageCompat {
    constructor(dataDir, supabaseStorage = null) {
        this.dataDir = dataDir;
        this._supabase = supabaseStorage;
        this._isSupabaseMode = !!supabaseStorage;

        // In-memory cache for sync access
        this._cache = {
            facts: [],
            decisions: [],
            risks: [],
            actions: [],
            questions: [],
            people: [],
            relationships: [],
            documents: [],
            contacts: [],
            conversations: [],
            config: null,
            lastRefresh: 0
        };

        // Current project context
        this.currentProjectId = null;
        this.currentProjectName = null;

        // Graph provider
        this.graphProvider = null;

        // Projects cache
        this._projectsCache = null;

        // For backwards compatibility with old Storage class
        this.knowledge = { facts: [], decisions: [], risks: [], people: [], relationships: [], change_log: [] };
        this.questions = { items: [] };
        this.documents = { items: [] };
        this.contacts = { items: [], teams: [], relationships: [] };
        this.conversations = { items: [] };

        // Similarity threshold
        this.similarityThreshold = 0.90;
    }

    /**
     * Get Supabase client (for direct queries)
     */
    get supabase() {
        return this._supabase?.supabase || null;
    }

    /**
     * Initialize the storage layer: connect to Supabase, load current project,
     * and populate the in-memory cache.
     *
     * Falls back to local projects.json for project context if Supabase is unavailable
     * or has no projects. Sets _isSupabaseMode = false on failure for graceful degradation.
     *
     * @returns {StorageCompat} this (for chaining)
     */
    async init() {
        if (this._isSupabaseMode && this._supabase) {
            try {
                // Get projects from Supabase
                const projects = await this._supabase.listProjects();
                this._projectsCache = projects;

                if (projects && projects.length > 0) {
                    // Use first project as current (or find the one marked as current)
                    const currentProject = projects.find(p => p.isCurrent) || projects[0];
                    this.currentProjectId = currentProject.id;
                    this.currentProjectName = currentProject.name;

                    // Set project in Supabase storage
                    await this._supabase.setProject(currentProject.id);

                    log.info({ event: 'storage_init_project', projectId: currentProject.id, projectName: currentProject.name }, 'Using Supabase project');
                } else {
                    log.info({ event: 'storage_init_no_projects' }, 'No projects found in Supabase');
                    this.currentProjectId = null;
                    this.currentProjectName = null;
                }

                await this._refreshCache();
                log.info({ event: 'storage_init_complete', mode: 'supabase' }, 'Initialized in Supabase mode');
            } catch (e) {
                log.warn({ event: 'storage_init_failed', err: e.message }, 'Supabase init failed, using local fallback');
                this._isSupabaseMode = false;
            }
        }

        // Fallback: Load from local projects.json if not in Supabase mode or no Supabase projects
        if (!this._isSupabaseMode || !this.currentProjectId) {
            try {
                const projectsPath = path.join(path.dirname(this.dataDir), 'projects.json');
                if (fs.existsSync(projectsPath)) {
                    const projectsData = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
                    if (projectsData.current && !this.currentProjectId) {
                        this.currentProjectId = projectsData.current;
                        const project = projectsData.projects?.find(p => p.id === this.currentProjectId);
                        this.currentProjectName = project?.name || 'Default Project';
                    }
                }
            } catch (e) {
                log.warn({ event: 'storage_load_projects_failed', err: e.message }, 'Could not load projects.json');
            }
        }

        return this;
    }

    /**
     * Check if a string is a valid UUID
     */
    _isValidUUID(str) {
        if (!str) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
    }

    /**
     * Public method to refresh cache
     */
    async refreshCache() {
        return this._refreshCache();
    }

    /**
     * Refresh the entire in-memory cache from Supabase for the current project.
     *
     * Fetches all entity types in parallel (facts, decisions, risks, actions,
     * questions, people, documents, contacts, teams, relationships) and updates
     * both _cache and legacy structure properties.
     *
     * Handles legacy (non-UUID) project IDs by resolving them through
     * setProjectWithLegacySupport before fetching data.
     *
     * Called automatically on init() and switchProject(). Can also be called
     * manually when external changes to the DB need to be reflected.
     */
    async _refreshCache() {
        if (!this._supabase || !this.currentProjectId) return;

        const projectId = this.currentProjectId;
        try {
            // Use legacy support to auto-resolve/create project if needed
            if (!this._isValidUUID(this.currentProjectId)) {
                log.debug({ event: 'legacy_id_resolution_started', projectId: this.currentProjectId }, 'Resolving legacy project ID via Supabase');
                const resolvedId = await this._supabase.setProjectWithLegacySupport(
                    this.currentProjectId,
                    this.currentProjectName
                );
                if (this._isValidUUID(resolvedId)) {
                    log.info({ event: 'legacy_id_resolution_succeeded', projectId: this.currentProjectId, resolvedId }, 'Resolved to UUID');
                } else {
                    log.warn({ event: 'legacy_id_resolution_failed', projectId: this.currentProjectId }, 'Legacy ID resolution did not return valid UUID');
                }
            } else {
                this._supabase.setProject(this.currentProjectId);
            }

            const [facts, decisions, risks, actions, questions, people, documents, contacts, teams, relationships, contactRelationships] = await Promise.all([
                this._supabase.getFacts(),
                this._supabase.getDecisions(),
                this._supabase.getRisks(),
                this._supabase.getActions(),
                this._supabase.getQuestions(),
                this._supabase.getPeople(),
                this._supabase.getDocuments(),
                this._supabase.getContacts(),
                this._supabase.getTeams(),
                this._supabase.getRelationships(),
                this._supabase.getContactRelationships()
            ]);

            this._cache = {
                facts: facts || [],
                decisions: decisions || [],
                risks: risks || [],
                actions: actions || [],
                questions: questions || [],
                people: people || [],
                documents: documents || [],
                relationships: relationships || [],
                contacts: contacts || [],
                contactRelationships: contactRelationships || [],
                conversations: [],
                config: null,
                lastRefresh: Date.now(),
                teams: teams || []
            };

            // Store teams in the contacts structure for compatibility
            if (!this.contacts) this.contacts = { items: [], teams: [], relationships: [] };
            this.contacts.teams = teams || [];

            log.debug({ event: 'contacts_cache_refresh', projectId, counts: { contacts: (contacts || []).length, teams: (teams || []).length, facts: (facts || []).length }, source: 'supabase' }, 'Cache loaded');

            // Update legacy structures
            this.knowledge.facts = this._cache.facts;
            this.knowledge.decisions = this._cache.decisions;
            this.knowledge.risks = this._cache.risks;
            this.knowledge.people = this._cache.people;
            this.questions.items = this._cache.questions;
            this.documents.items = this._cache.documents;

        } catch (e) {
            log.warn({ event: 'cache_refresh_failed', projectId, err: e.message }, 'Cache refresh failed');
        }
    }

    // ==================== Data Stats & Maintenance (API compatibility) ====================

    /**
     * Get data statistics. Compatible with Storage.getDataStats().
     * Uses in-memory cache in Supabase mode.
     */
    getDataStats() {
        const facts = this.knowledge?.facts?.length || 0;
        const people = this.knowledge?.people?.length || 0;
        const decisions = this.knowledge?.decisions?.length || 0;
        const risks = this.knowledge?.risks?.length || 0;
        const questions = this.questions?.items?.length || 0;
        const documents = (this.documents?.items ?? this.documents)?.length || 0;
        const estimateSize = (obj) => {
            try {
                return JSON.stringify(obj || {}).length;
            } catch {
                return 0;
            }
        };
        const memoryBytes = estimateSize(this.knowledge) + estimateSize(this.questions) + estimateSize(this.documents);
        return {
            counts: { facts, people, decisions, risks, questions, documents },
            total: facts + people + decisions + risks + questions + documents,
            memoryEstimateKB: Math.round(memoryBytes / 1024),
            memoryEstimateMB: (memoryBytes / 1024 / 1024).toFixed(2)
        };
    }

    /**
     * Recover from change_log. Not supported in Supabase mode (no change_log).
     */
    recoverFromChangeLog() {
        if (!this._isSupabaseMode && this.knowledge?.change_log?.length) {
            return { recovered: false, message: 'Local change_log recovery not implemented in StorageCompat' };
        }
        return { recovered: false, message: 'Recovery from change_log not supported in Supabase mode' };
    }

    /**
     * Cleanup old data. In Supabase mode returns no-op (data managed by DB).
     */
    cleanupOldData(_options = {}) {
        if (!this._isSupabaseMode) {
            return { cleaned: { facts: 0, questions: 0 }, archived: null };
        }
        return { cleaned: { facts: 0, questions: 0 }, archived: null, message: 'Cleanup not applied in Supabase mode' };
    }

    /**
     * Remove duplicates. In Supabase mode returns no-op.
     */
    removeDuplicates() {
        return { removed: { facts: 0, people: 0 } };
    }

    // ==================== Trends & Stats (Missing Implementation Fix) ====================

    getStats() {
        // Return flat structure expected by dashboard/routes.js
        const stats = this.getDataStats();
        return {
            facts: stats.counts.facts,
            decisions: stats.counts.decisions,
            risks: stats.counts.risks,
            questions: stats.counts.questions,
            people: stats.counts.people,
            documents: stats.counts.documents, // getDataStats returns number, routes.js handles object or number
            actions: stats.counts.actions
        };
    }

    recordDailyStats() {
        // No-op for now to prevent crash
    }

    getTrends(days = 7) {
        // Return placeholder trends to prevent crash
        const now = new Date();
        const trends = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            trends.push({
                date: date.toISOString().split('T')[0],
                facts: 0,
                decisions: 0,
                risks: 0,
                actions: 0
            });
        }
        return trends.reverse();
    }

    getTrendInsights() {
        return [];
    }

    getStatsHistory(days = 30) {
        return this.getTrends(days);
    }

    // ==================== Project Management ====================

    async switchProject(projectId, projectName = null) {
        this.currentProjectId = projectId;
        this.currentProjectName = projectName || projectId || 'Default Project';
        if (this._supabase) {
            this._supabase.setProject(projectId);
            await this._refreshCache();
        }
        return { id: projectId, name: this.currentProjectName };
    }

    getProjectDataDir() {
        return path.join(this.dataDir, 'projects', this.currentProjectId || 'default');
    }

    getCurrentProject() {
        if (!this.currentProjectId) return null;

        // Try to get full project info from cache
        if (this._projectsCache) {
            const project = this._projectsCache.find(p => p.id === this.currentProjectId);
            if (project) {
                return {
                    id: project.id,
                    name: project.name,
                    userRole: project.userRole || '',
                    userRolePrompt: project.userRolePrompt || ''
                };
            }
        }

        return {
            id: this.currentProjectId,
            name: this.currentProjectName || 'Default Project',
            userRole: '',
            userRolePrompt: ''
        };
    }

    /**
     * Get current project with member role (async version)
     */
    async getCurrentProjectWithRole() {
        if (!this.currentProjectId) return null;

        const project = this.getCurrentProject();

        // Get member role from Supabase
        if (this._isSupabaseMode && this._supabase) {
            try {
                const role = await this.getMemberRole(this.currentProjectId);
                if (role) {
                    project.userRole = role.userRole || project.userRole;
                    project.userRolePrompt = role.userRolePrompt || project.userRolePrompt;
                    project.roleTemplateId = role.roleTemplateId;
                }
            } catch (e) {
                // Use cached role
            }
        }

        return project;
    }

    // ==================== Facts (Sync interface) ====================

    getFacts(category = null) {
        let facts = this._cache.facts;
        if (category) {
            facts = facts.filter(f => f.category === category);
        }
        return facts;
    }

    async addFact(fact, skipDedup = false) {
        if (this._supabase) {
            const result = await this._supabase.addFact(fact, skipDedup);
            if (!result.duplicate) {
                this._cache.facts.unshift(result);
                this.knowledge.facts = this._cache.facts;
            }
            return result;
        }
        // Fallback: add to local cache
        this._cache.facts.unshift({ id: Date.now().toString(), ...fact });
        return this._cache.facts[0];
    }

    async addFacts(facts, options = {}) {
        if (this._supabase && typeof this._supabase.addFacts === 'function') {
            const result = await this._supabase.addFacts(facts, options);
            if (result.data && result.data.length > 0) {
                this._cache.facts = (result.data || []).concat(this._cache.facts);
                this.knowledge.facts = this._cache.facts;
            }
            return result;
        }
        let inserted = 0;
        for (const fact of facts) {
            const r = await this.addFact(fact, options.skipDedup !== false);
            if (!r.duplicate) inserted++;
        }
        return { data: [], inserted };
    }

    // ==================== Decisions ====================

    getDecisions() {
        return this._cache.decisions;
    }

    async addDecision(decision) {
        if (this._supabase) {
            const result = await this._supabase.addDecision(decision);
            this._cache.decisions.unshift(result);
            return result;
        }
        this._cache.decisions.unshift({ id: Date.now().toString(), ...decision });
        return this._cache.decisions[0];
    }

    async addDecisions(decisions) {
        if (this._supabase && typeof this._supabase.addDecisions === 'function') {
            const result = await this._supabase.addDecisions(decisions);
            if (result.data?.length) {
                this._cache.decisions = (result.data || []).concat(this._cache.decisions);
            }
            return result;
        }
        let inserted = 0;
        for (const d of decisions) {
            await this.addDecision(d);
            inserted++;
        }
        return { data: [], inserted };
    }

    // ==================== Risks ====================

    getRisks() {
        return this._cache.risks;
    }

    async getRisk(id) {
        if (this._supabase) {
            const risk = await this._supabase.getRisk(id);
            if (risk) {
                const idx = this._cache.risks.findIndex(r => r.id === id || String(r.id) === String(id));
                if (idx !== -1) this._cache.risks[idx] = risk;
                else this._cache.risks.unshift(risk);
            }
            return risk;
        }
        return this._cache.risks.find(r => r.id === id || String(r.id) === String(id)) || null;
    }

    async addRisk(risk) {
        if (this._supabase) {
            const result = await this._supabase.addRisk(risk);
            this._cache.risks.unshift(result);
            return result;
        }
        this._cache.risks.unshift({ id: Date.now().toString(), ...risk });
        return this._cache.risks[0];
    }

    async updateRisk(id, updates) {
        if (this._supabase) {
            const result = await this._supabase.updateRisk(id, updates);
            if (result) {
                const idx = this._cache.risks.findIndex(r => r.id === id || String(r.id) === String(id));
                if (idx !== -1) this._cache.risks[idx] = result;
            }
            return result;
        }
        const idx = this._cache.risks.findIndex(r => r.id === id || String(r.id) === String(id));
        if (idx === -1) return null;
        this._cache.risks[idx] = { ...this._cache.risks[idx], ...updates };
        return this._cache.risks[idx];
    }

    async deleteRisk(id, soft = true) {
        if (this._supabase) {
            await this._supabase.deleteRisk(id, soft);
            const idx = this._cache.risks.findIndex(r => r.id === id || String(r.id) === String(id));
            if (idx !== -1) this._cache.risks.splice(idx, 1);
            return;
        }
        const idx = this._cache.risks.findIndex(r => r.id === id || String(r.id) === String(id));
        if (idx !== -1) this._cache.risks.splice(idx, 1);
    }

    async getRiskEvents(riskId) {
        if (this._supabase) return this._supabase.getRiskEvents(riskId);
        return [];
    }

    async getDeletedRisks() {
        if (this._supabase) return this._supabase.getDeletedRisks();
        return [];
    }

    async restoreRisk(id) {
        if (this._supabase) {
            const risk = await this._supabase.restoreRisk(id);
            if (risk) this._cache.risks.unshift(risk);
            return risk;
        }
        return null;
    }

    // ==================== Action Items ====================

    getActionItems(status) {
        if (!status) return this._cache.actions;
        return this._cache.actions.filter(a => a.status === status);
    }

    async getActions(status = null, owner = null, sprintId = null, decisionId = null) {
        if (this._supabase) {
            const data = await this._supabase.getActions(status, owner, sprintId, decisionId);
            if (!decisionId) this._cache.actions = data || [];
            return data || [];
        }
        if (!status && !owner && !sprintId && !decisionId) return this._cache.actions;
        return this._cache.actions.filter(a => {
            if (status && a.status !== status) return false;
            if (owner && a.owner !== owner) return false;
            if (sprintId && a.sprint_id !== sprintId) return false;
            if (decisionId && a.decision_id !== decisionId) return false;
            return true;
        });
    }

    async addAction(action) {
        if (this._supabase) {
            const result = await this._supabase.addAction(action);
            this._cache.actions.unshift(result);
            return result;
        }
        this._cache.actions.unshift({ id: Date.now().toString(), ...action });
        return this._cache.actions[0];
    }

    // Alias for addAction
    async addActionItem(action) {
        return this.addAction(action);
    }

    async updateAction(id, updates) {
        if (this._supabase) {
            const result = await this._supabase.updateAction(id, updates);
            const idx = this._cache.actions.findIndex(a => String(a.id) === String(id));
            if (idx >= 0) this._cache.actions[idx] = result;
            return result;
        }
        const idx = this._cache.actions.findIndex(a => String(a.id) === String(id));
        if (idx >= 0) {
            this._cache.actions[idx] = { ...this._cache.actions[idx], ...updates };
            return this._cache.actions[idx];
        }
        return null;
    }

    async deleteAction(id, soft = true) {
        if (this._supabase) {
            await this._supabase.deleteAction(id, soft);
        }
        this._cache.actions = this._cache.actions.filter(a => String(a.id) !== String(id));
    }

    async getDeletedActions() {
        if (this._supabase && typeof this._supabase.getDeletedActions === 'function') {
            return await this._supabase.getDeletedActions();
        }
        return [];
    }

    async restoreAction(id) {
        if (this._supabase && typeof this._supabase.restoreAction === 'function') {
            const result = await this._supabase.restoreAction(id);
            this._cache.actions = [result, ...(this._cache.actions || [])];
            return result;
        }
        throw new Error('Restore not available');
    }

    async getActionEvents(actionId) {
        if (this._supabase) {
            return await this._supabase.getActionEvents(actionId);
        }
        return [];
    }

    async getTaskDependencies(taskId) {
        if (this._supabase && typeof this._supabase.getTaskDependencies === 'function') {
            return await this._supabase.getTaskDependencies(taskId);
        }
        return [];
    }

    async setTaskDependencies(taskId, dependsOnIds) {
        if (this._supabase && typeof this._supabase.setTaskDependencies === 'function') {
            await this._supabase.setTaskDependencies(taskId, dependsOnIds);
        }
    }

    async getUserStories(status = null) {
        if (this._supabase && typeof this._supabase.getUserStories === 'function') {
            return await this._supabase.getUserStories(status);
        }
        return [];
    }

    /**
     * Get the graph provider
     */
    getGraphProvider() {
        if (this._supabase && typeof this._supabase.getGraphProvider === 'function') {
            return this._supabase.getGraphProvider();
        }
        return this.graphProvider || null;
    }

    async getUserStory(id) {
        if (this._supabase && typeof this._supabase.getUserStory === 'function') {
            return await this._supabase.getUserStory(id);
        }
        return null;
    }

    async addUserStory(story) {
        if (this._supabase && typeof this._supabase.addUserStory === 'function') {
            return await this._supabase.addUserStory(story);
        }
        return { id: Date.now().toString(), ...story };
    }

    async updateUserStory(id, updates) {
        if (this._supabase && typeof this._supabase.updateUserStory === 'function') {
            return await this._supabase.updateUserStory(id, updates);
        }
        return null;
    }

    async deleteUserStory(id, soft = true) {
        if (this._supabase && typeof this._supabase.deleteUserStory === 'function') {
            await this._supabase.deleteUserStory(id, soft);
        }
    }

    async createSprint(projectId, data) {
        if (this._supabase && typeof this._supabase.createSprint === 'function') {
            return await this._supabase.createSprint(projectId, data);
        }
        return { id: null, ...data };
    }

    async getSprint(id) {
        if (this._supabase && typeof this._supabase.getSprint === 'function') {
            return await this._supabase.getSprint(id);
        }
        return null;
    }

    async getSprints(projectId) {
        if (this._supabase && typeof this._supabase.getSprints === 'function') {
            return await this._supabase.getSprints(projectId);
        }
        return [];
    }

    async updateSprint(id, updates) {
        if (this._supabase && typeof this._supabase.updateSprint === 'function') {
            return await this._supabase.updateSprint(id, updates);
        }
        return null;
    }

    async getDeletedUserStories() {
        if (this._supabase && typeof this._supabase.getDeletedUserStories === 'function') {
            return await this._supabase.getDeletedUserStories();
        }
        return [];
    }

    async restoreUserStory(id) {
        if (this._supabase && typeof this._supabase.restoreUserStory === 'function') {
            return await this._supabase.restoreUserStory(id);
        }
        throw new Error('Restore not available');
    }

    // ==================== Questions ====================

    getQuestions() {
        return this._cache.questions;
    }

    async addQuestion(question, skipDedup = false) {
        if (this._supabase) {
            const result = await this._supabase.addQuestion(question, skipDedup);
            if (!result.duplicate) {
                this._cache.questions.unshift(result);
                this.questions.items = this._cache.questions;
            }
            return result;
        }
        this._cache.questions.unshift({ id: Date.now().toString(), ...question });
        return this._cache.questions[0];
    }

    async addQuestions(questions, options = {}) {
        if (this._supabase && typeof this._supabase.addQuestions === 'function') {
            const result = await this._supabase.addQuestions(questions, options);
            if (result.data?.length) {
                this._cache.questions = (result.data || []).concat(this._cache.questions);
                this.questions.items = this._cache.questions;
            }
            return result;
        }
        let inserted = 0;
        for (const q of questions) {
            const r = await this.addQuestion(q, options.skipDedup !== false);
            if (!r.duplicate) inserted++;
        }
        return { data: [], inserted };
    }

    getQuestionById(id) {
        return this._cache.questions.find(q => q.id === id);
    }

    async updateQuestion(id, updates) {
        // Find question in cache first (handles both UUID and numeric IDs)
        let idx = this._cache.questions.findIndex(q =>
            q.id === id || String(q.id) === String(id)
        );

        if (this._supabase) {
            try {
                const result = await this._supabase.updateQuestion(id, updates);
                if (result) {
                    // Update cache with the result
                    if (idx !== -1) {
                        this._cache.questions[idx] = { ...this._cache.questions[idx], ...result };
                    } else {
                        // Add to cache if not found (might have been created recently)
                        this._cache.questions.unshift(result);
                    }
                    return { success: true, ok: true, question: result };
                }
                // If result is null/undefined, the question doesn't exist
                return { success: false, ok: false, error: 'Question not found in database' };
            } catch (e) {
                log.error({ event: 'update_question_error', err: e.message }, 'updateQuestion error');
                // Return the actual error instead of falling through
                return { success: false, ok: false, error: e.message };
            }
        }

        // Fallback: update in cache only (non-Supabase mode)
        if (idx !== -1) {
            this._cache.questions[idx] = { ...this._cache.questions[idx], ...updates };
            return { success: true, ok: true, question: this._cache.questions[idx] };
        }

        return { success: false, ok: false, error: 'Question not found' };
    }

    /**
     * Resolve/answer a question
     */
    async resolveQuestion(id, answer, source = 'manual') {
        const updates = {
            answer: answer,
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            answer_source: source
        };

        return await this.updateQuestion(id, updates);
    }

    /**
     * Create a follow-up question
     */
    async createFollowUpQuestion(parentQuestionId, content, context = null) {
        const question = {
            content: content,
            context: context,
            follow_up_to: parentQuestionId,
            status: 'pending',
            priority: 'medium'
        };

        return await this.addQuestion(question);
    }

    // ==================== People ====================

    getPeople() {
        return this._cache.people;
    }

    async addPerson(person) {
        if (this._supabase) {
            const result = await this._supabase.addPerson(person);
            this._cache.people.push(result);
            return result;
        }
        this._cache.people.push({ id: Date.now().toString(), ...person });
        return this._cache.people[this._cache.people.length - 1];
    }

    // ==================== Documents ====================

    getDocuments(status = null) {
        let docs = this._cache.documents;
        if (status) {
            // Handle different status values between code and database
            // Code uses: 'processed' / Database uses: 'completed'
            if (status === 'processed') {
                docs = docs.filter(d => d.status === 'processed' || d.status === 'completed');
            } else {
                docs = docs.filter(d => d.status === status);
            }
        }
        return docs;
    }

    getDocumentById(id) {
        // Support both UUID and numeric IDs
        return this._cache.documents.find(d =>
            d.id === id || String(d.id) === String(id)
        );
    }

    async addDocument(doc) {
        if (this._supabase) {
            // Normalize field names for Supabase storage
            const normalizedDoc = {
                filename: doc.filename || doc.name,
                path: doc.path || doc.original_path || doc.filepath || doc.content_path,
                filepath: doc.filepath || doc.path || doc.original_path,
                hash: doc.hash || doc.content_hash || doc.file_hash,
                type: doc.type || doc.file_type,
                size: doc.size || doc.file_size,
                date: doc.date || doc.document_date,
                time: doc.time || doc.document_time,
                title: doc.title || doc.name || doc.filename,
                status: doc.status || 'pending',
                doc_type: doc.doc_type || doc.type || 'document',
                // Keep extraction info
                extraction_method: doc.extraction_method || doc.method,
                content_length: doc.content_length,
                summary: doc.summary || doc.ai_summary
            };

            try {
                const result = await this._supabase.addDocument(normalizedDoc);
                this._cache.documents.unshift(result);
                this.documents.items = this._cache.documents;
                return result;
            } catch (error) {
                log.error({ event: 'add_document_error', err: error.message }, 'addDocument error');
                // Fallback: add to cache only
                const fallbackDoc = { id: `local-${Date.now()}`, ...normalizedDoc, created_at: new Date().toISOString() };
                this._cache.documents.unshift(fallbackDoc);
                return fallbackDoc;
            }
        }
        this._cache.documents.unshift({ id: Date.now().toString(), ...doc });
        return this._cache.documents[0];
    }

    async updateDocumentStatus(id, status, archivedPath = null) {
        if (this._supabase) {
            const result = await this._supabase.updateDocumentStatus(id, status, archivedPath);
            const idx = this._cache.documents.findIndex(d => d.id === id);
            if (idx !== -1) this._cache.documents[idx] = result;
            return result;
        }
        const doc = this._cache.documents.find(d => d.id === id);
        if (doc) {
            doc.status = status;
            if (archivedPath) doc.filepath = archivedPath;
        }
        return doc;
    }

    /**
     * Update a document with AI-generated metadata (title, summary)
     */
    async updateDocument(id, updates) {
        if (this._supabase) {
            try {
                const result = await this._supabase.updateDocument(id, updates);
                // Update cache
                const idx = this._cache.documents.findIndex(d => d.id === id || String(d.id) === String(id));
                if (idx !== -1) {
                    this._cache.documents[idx] = { ...this._cache.documents[idx], ...result };
                }
                return result;
            } catch (error) {
                log.error({ event: 'update_document_error', err: error.message }, 'updateDocument error');
                // Fallback to cache-only update
            }
        }

        // Fallback: update cache only
        const doc = this._cache.documents.find(d => d.id === id || String(d.id) === String(id));
        if (doc) {
            Object.assign(doc, updates);
            return doc;
        }
        return null;
    }

    async checkDocumentExists(filename, fileSize, filePath = null) {
        if (this._supabase) {
            return this._supabase.checkDocumentExists(filename, fileSize, filePath);
        }
        return { exists: false };
    }

    /**
     * Delete a document with cascade (removes all related facts, decisions, questions, etc.)
     */
    async deleteDocument(documentId, options = {}) {
        log.debug({ event: 'delete_document_start', documentId }, 'deleteDocument called');

        if (this._supabase) {
            try {
                const result = await this._supabase.deleteDocument(documentId, options);

                // Remove from cache
                const idx = this._cache.documents.findIndex(d =>
                    d.id === documentId || String(d.id) === String(documentId)
                );
                if (idx !== -1) {
                    this._cache.documents.splice(idx, 1);
                    this.documents.items = this._cache.documents;
                }

                // Refresh cache to reflect cascade deletes
                await this._refreshCache();

                log.debug({ event: 'delete_document_success', documentId, deleted: result.deleted }, 'Document deleted with cascade');
                return result;
            } catch (error) {
                log.error({ event: 'delete_document_error', documentId, err: error?.message }, 'deleteDocument error');
                throw error;
            }
        }

        // Fallback for non-Supabase mode (just remove from cache)
        const idx = this._cache.documents.findIndex(d => d.id === documentId);
        if (idx !== -1) {
            const doc = this._cache.documents.splice(idx, 1)[0];
            return { deleted: { document: 1 }, document: doc };
        }

        return { deleted: { document: 0 }, error: 'Document not found' };
    }

    // ==================== Contacts ====================

    async getContacts(filter = null) {
        // Always fetch from Supabase if available
        if (this._isSupabaseMode && this._supabase) {
            try {
                const contacts = await this._supabase.getContacts(filter);
                this._cache.contacts = contacts || [];
                return this._cache.contacts;
            } catch (error) {
                log.warn({ event: 'get_contacts_error', err: error.message }, 'getContacts error');
                // Fall through to cached version
            }
        }
        return this._cache.contacts;
    }

    async addContact(contact) {
        // Validate for duplicates by email (if email provided)
        if (contact.email) {
            const existingByEmail = this._cache.contacts.find(c =>
                c.email?.toLowerCase() === contact.email?.toLowerCase()
            );
            if (existingByEmail) {
                throw new Error(`Contact with email "${contact.email}" already exists`);
            }
        }

        // Check for duplicate by name (case-insensitive)
        const existingByName = this._cache.contacts.find(c =>
            c.name?.toLowerCase().trim() === contact.name?.toLowerCase().trim()
        );
        if (existingByName) {
            throw new Error(`Contact "${contact.name}" already exists`);
        }

        if (this._supabase) {
            const result = await this._supabase.addContact(contact);
            this._cache.contacts.push(result);
            return result;
        }
        this._cache.contacts.push({ id: Date.now().toString(), ...contact });
        return this._cache.contacts[this._cache.contacts.length - 1];
    }

    findContactByName(name) {
        return this._cache.contacts.find(c =>
            c.name?.toLowerCase() === name?.toLowerCase()
        );
    }

    findContactByEmail(email) {
        if (!email) return null;
        return this._cache.contacts.find(c =>
            c.email?.toLowerCase() === email?.toLowerCase()
        );
    }

    /**
     * Find contact by name or alias
     * This enables auto-matching when a participant name was previously linked
     */
    findContactByNameOrAlias(name) {
        if (!name) return null;
        const searchName = name.toLowerCase().trim();

        return this._cache.contacts.find(c => {
            // Check main name
            if (c.name?.toLowerCase().trim() === searchName) return true;

            // Check aliases
            if (c.aliases && Array.isArray(c.aliases)) {
                return c.aliases.some(alias =>
                    alias?.toLowerCase().trim() === searchName
                );
            }
            return false;
        });
    }

    /**
     * Link a participant name to an existing contact
     * Adds the participant name as an alias for future auto-matching
     */
    async linkParticipantToContact(participantName, contactId) {
        log.debug({ event: 'link_participant_start', participantName, contactId }, 'linkParticipantToContact');

        // Try cache first, but also query Supabase directly to be sure
        let contact = this.getContactById(contactId);

        // If not in cache and we have Supabase, fetch directly
        if (!contact && this._supabase) {
            log.debug({ event: 'link_participant_fetch_contact' }, 'Contact not in cache, fetching from Supabase');
            try {
                const { data } = await this._supabase.supabase
                    .from('contacts')
                    .select('*')
                    .eq('id', contactId)
                    .single();
                if (data) {
                    contact = data;
                    // Add to cache
                    this._cache.contacts.push(contact);
                }
            } catch (e) {
                log.warn({ event: 'link_participant_fetch_failed', err: e.message }, 'Failed to fetch contact from Supabase');
            }
        }

        if (!contact) {
            log.warn({ event: 'contact_not_found', contactId }, 'Contact not found');
            throw new Error('Contact not found');
        }

        // Don't add if it's already the main name
        if (contact.name?.toLowerCase().trim() === participantName?.toLowerCase().trim()) {
            log.debug({ event: 'link_participant_skip_name_match' }, 'Name matches contact name, skipping');
            return { linked: false, reason: 'Name matches contact name' };
        }

        // Check if alias already exists
        const aliases = contact.aliases || [];
        const normalizedName = participantName.trim();
        if (aliases.some(a => a?.toLowerCase() === normalizedName.toLowerCase())) {
            log.debug({ event: 'link_participant_skip_alias_exists' }, 'Alias already exists, skipping');
            return { linked: false, reason: 'Alias already exists' };
        }

        // Add alias
        const updatedAliases = [...aliases, normalizedName];

        if (this._supabase) {
            try {
                log.debug({ event: 'link_participant_update_aliases' }, 'Updating contact aliases in Supabase');
                await this._supabase.updateContact(contactId, { aliases: updatedAliases });
            } catch (e) {
                log.error({ event: 'link_participant_error', err: e.message }, 'linkParticipantToContact error');
                throw e;
            }
        }

        // Update cache
        const cacheIdx = this._cache.contacts.findIndex(c => c.id === contactId);
        if (cacheIdx !== -1) {
            this._cache.contacts[cacheIdx].aliases = updatedAliases;
        }

        log.debug({ event: 'link_participant_success', participantName, contactId, aliasCount: updatedAliases.length }, 'Linked participant to contact');
        return { linked: true, contactId, contactName: contact.name, alias: normalizedName };
    }

    /**
     * Unlink a participant name from its associated contact
     * Removes the participant name from the contact's aliases
     */
    async unlinkParticipant(participantName) {
        log.debug({ event: 'unlink_participant_start', participantName }, 'unlinkParticipant');

        if (!participantName) {
            return { unlinked: false, reason: 'No participant name provided' };
        }

        const normalizedName = participantName.trim().toLowerCase();

        // Find the contact that has this alias - check cache first
        let contact = this._cache.contacts.find(c => {
            if (c.aliases && Array.isArray(c.aliases)) {
                return c.aliases.some(alias =>
                    alias?.toLowerCase().trim() === normalizedName
                );
            }
            return false;
        });

        // If not in cache and we have Supabase, search directly
        if (!contact && this._supabase) {
            log.debug({ event: 'unlink_participant_search' }, 'Alias not found in cache, searching Supabase');
            try {
                const projectId = this._supabase.getProjectId();
                const { data: contacts } = await this._supabase.supabase
                    .from('contacts')
                    .select('*')
                    .eq('project_id', projectId)
                    .is('deleted_at', null);

                if (contacts) {
                    contact = contacts.find(c => {
                        if (c.aliases && Array.isArray(c.aliases)) {
                            return c.aliases.some(alias =>
                                alias?.toLowerCase().trim() === normalizedName
                            );
                        }
                        return false;
                    });
                }
            } catch (e) {
                log.warn({ event: 'unlink_participant_search_failed', err: e.message }, 'Failed to search contacts in Supabase');
            }
        }

        if (!contact) {
            log.debug({ event: 'unlink_participant_not_found' }, 'No linked contact found for alias');
            return { unlinked: false, reason: 'No linked contact found' };
        }

        // Remove the alias
        const updatedAliases = (contact.aliases || []).filter(
            a => a?.toLowerCase().trim() !== normalizedName
        );

        if (this._supabase) {
            try {
                log.debug({ event: 'unlink_participant_remove_alias' }, 'Removing alias from contact in Supabase');
                await this._supabase.updateContact(contact.id, { aliases: updatedAliases });
            } catch (e) {
                log.error({ event: 'unlink_participant_error', err: e.message }, 'unlinkParticipant error');
                throw e;
            }
        }

        // Update cache
        const cacheIdx = this._cache.contacts.findIndex(c => c.id === contact.id);
        if (cacheIdx !== -1) {
            this._cache.contacts[cacheIdx].aliases = updatedAliases;
        }

        log.debug({ event: 'unlink_participant_success', participantName, contactId: contact.id }, 'Unlinked participant from contact');
        return { unlinked: true, contactId: contact.id, contactName: contact.name };
    }

    /**
     * Get unmatched participants - excludes names that match contact names or aliases
     */
    getUnmatchedParticipants() {
        const people = this._cache.people || [];
        const contacts = this._cache.contacts || [];

        // Build a set of all known names (contact names + all aliases)
        const knownNames = new Set();
        for (const c of contacts) {
            if (c.name) knownNames.add(c.name.toLowerCase().trim());
            if (c.aliases && Array.isArray(c.aliases)) {
                for (const alias of c.aliases) {
                    if (alias) knownNames.add(alias.toLowerCase().trim());
                }
            }
        }

        log.debug({ event: 'get_unmatched_participants', peopleCount: people.length, contactsCount: contacts.length, knownNamesCount: knownNames.size }, 'getUnmatchedParticipants');

        // Filter people not in known names
        const unmatched = people.filter(p => {
            const name = p.name?.toLowerCase().trim();
            return name && !knownNames.has(name);
        });

        log.debug({ event: 'get_unmatched_result', unmatchedCount: unmatched.length }, 'Unmatched count');
        return unmatched;
    }

    getContactById(id) {
        return this._cache.contacts.find(c => c.id === id);
    }

    getContact(id) {
        return this.getContactById(id);
    }

    async updateContact(id, updates) {
        const idx = this._cache.contacts.findIndex(c => c.id === id);
        if (idx === -1) return false;

        // Update cache
        this._cache.contacts[idx] = { ...this._cache.contacts[idx], ...updates };

        // Persist to Supabase
        if (this._supabase) {
            try {
                await this._supabase.updateContact(id, updates);
            } catch (e) {
                log.warn({ event: 'update_contact_error', err: e.message }, 'updateContact error');
            }
        }
        return true;
    }

    deleteContact(id) {
        const idx = this._cache.contacts.findIndex(c => c.id === id);
        if (idx === -1) return false;
        this._cache.contacts.splice(idx, 1);
        if (this._supabase) {
            this._supabase.deleteContact(id).catch(e =>
                log.warn({ event: 'delete_contact_error', err: e.message }, 'deleteContact error')
            );
        }
        return true;
    }

    getContactStats() {
        const contacts = this._cache.contacts || [];
        const people = this._cache.people || [];
        const teams = this.contacts?.teams || [];

        // Count by organization
        const byOrg = {};
        contacts.forEach(c => {
            const org = c.organization || 'Unknown';
            byOrg[org] = (byOrg[org] || 0) + 1;
        });

        // Count by tag
        const byTag = {};
        const allTags = [];
        contacts.forEach(c => {
            (c.tags || []).forEach(tag => {
                byTag[tag] = (byTag[tag] || 0) + 1;
                if (!allTags.includes(tag)) allTags.push(tag);
            });
        });

        return {
            total: contacts.length,
            byOrganization: byOrg,
            byTag: byTag,
            tags: allTags,
            teams: teams.length,
            knowledgePeople: people.length,
            unmatchedCount: this.getUnmatchedParticipants().length
        };
    }

    // NOTE: getUnmatchedParticipants is defined earlier (with alias support)
    // Do not duplicate here

    // NOTE: getUnmatchedParticipants is defined earlier (with alias support)
    // Do not duplicate here

    /**
     * Find contact by name or alias
     */
    async findContactByNameOrAlias(name) {
        if (!name) return null;

        if (this._supabase && this._supabase.findContactByNameOrAlias) {
            return await this._supabase.findContactByNameOrAlias(name);
        }

        const contacts = this._cache.contacts || [];
        const normalized = name.toLowerCase().trim();

        return contacts.find(c =>
            (c.name && c.name.toLowerCase().trim() === normalized) ||
            (c.aliases && c.aliases.some(a => a.toLowerCase().trim() === normalized))
        ) || null;
    }

    async findDuplicateContacts() {
        // Use Supabase version if available
        if (this._isSupabaseMode && this._supabase) {
            try {
                return await this._supabase.findDuplicateContacts();
            } catch (error) {
                log.error({ event: 'find_duplicates_failed', err: error?.message }, 'Supabase findDuplicates failed');
                // Fall through to local version
            }
        }

        // Fallback to local version
        const contacts = this._cache.contacts || [];
        const groups = [];
        const seen = new Set();

        for (let i = 0; i < contacts.length; i++) {
            if (seen.has(contacts[i].id)) continue;

            const name1 = (contacts[i].name || '').toLowerCase().trim();
            const duplicates = [contacts[i]];

            for (let j = i + 1; j < contacts.length; j++) {
                if (seen.has(contacts[j].id)) continue;

                const name2 = (contacts[j].name || '').toLowerCase().trim();
                // Simple similarity check - same name or one contains the other
                if (name1 === name2 || name1.includes(name2) || name2.includes(name1)) {
                    duplicates.push(contacts[j]);
                    seen.add(contacts[j].id);
                }
            }

            if (duplicates.length > 1) {
                groups.push(duplicates);
                seen.add(contacts[i].id);
            }
        }

        return groups;
    }

    getContactWithRelationships(id) {
        const contact = this.getContactById(id);
        if (!contact) return null;

        // Get relationships from cache or return empty
        const relationships = this.contacts?.relationships || [];
        const contactRels = relationships.filter(r =>
            r.fromContactId === id || r.toContactId === id
        );

        return {
            ...contact,
            relationships: contactRels
        };
    }

    async addContactRelationship(fromId, toId, type) {
        if (this._supabase) {
            try {
                const result = await this._supabase.addContactRelationship(fromId, toId, type);
                // Update cache
                if (!this._cache.contactRelationships) this._cache.contactRelationships = [];
                this._cache.contactRelationships.push(result);
                return result;
            } catch (e) {
                log.error({ event: 'add_contact_relationship_error', err: e.message }, 'addContactRelationship error');
                throw e;
            }
        }

        // Fallback for non-Supabase mode
        if (!this.contacts) this.contacts = { items: [], teams: [], relationships: [] };
        if (!this.contacts.relationships) this.contacts.relationships = [];

        const rel = {
            id: `rel-${Date.now()}`,
            from_contact_id: fromId,
            to_contact_id: toId,
            relationship_type: type,
            created_at: new Date().toISOString()
        };
        this.contacts.relationships.push(rel);
        return rel;
    }

    async removeContactRelationship(fromId, toId, type) {
        if (this._supabase) {
            try {
                const result = await this._supabase.removeContactRelationshipByContacts(fromId, toId, type);
                // Update cache
                if (this._cache.contactRelationships) {
                    this._cache.contactRelationships = this._cache.contactRelationships.filter(r =>
                        !(r.from_contact_id === fromId && r.to_contact_id === toId && r.relationship_type === type)
                    );
                }
                return result;
            } catch (e) {
                log.error({ event: 'remove_contact_relationship_error', err: e.message }, 'removeContactRelationship error');
                return false;
            }
        }

        // Fallback
        if (!this.contacts?.relationships) return false;

        const idx = this.contacts.relationships.findIndex(r =>
            r.from_contact_id === fromId && r.to_contact_id === toId && r.relationship_type === type
        );
        if (idx === -1) return false;
        this.contacts.relationships.splice(idx, 1);
        return true;
    }

    async getContactRelationships(contactId = null) {
        if (this._supabase) {
            return await this._supabase.getContactRelationships(contactId);
        }
        return this._cache.contactRelationships || this.contacts?.relationships || [];
    }

    // ==================== Contact-Project N:N Methods ====================

    /**
     * Add a contact to a project (N:N relationship)
     */
    async addContactToProject(contactId, projectId, options = {}) {
        if (this._supabase) {
            return await this._supabase.addContactToProject(contactId, projectId, options);
        }
        // Fallback: store in cache
        if (!this._cache.contactProjects) this._cache.contactProjects = [];
        const existing = this._cache.contactProjects.find(
            cp => cp.contact_id === contactId && cp.project_id === projectId
        );
        if (existing) return existing;

        const link = {
            id: `cp-${Date.now()}`,
            contact_id: contactId,
            project_id: projectId,
            role: options.role || null,
            is_primary: options.isPrimary || false,
            added_at: new Date().toISOString()
        };
        this._cache.contactProjects.push(link);
        return link;
    }

    /**
     * Remove a contact from a project
     */
    async removeContactFromProject(contactId, projectId) {
        if (this._supabase) {
            return await this._supabase.removeContactFromProject(contactId, projectId);
        }
        if (!this._cache.contactProjects) return false;
        const idx = this._cache.contactProjects.findIndex(
            cp => cp.contact_id === contactId && cp.project_id === projectId
        );
        if (idx === -1) return false;
        this._cache.contactProjects.splice(idx, 1);
        return true;
    }

    /**
     * Get all projects a contact belongs to
     */
    async getContactProjects(contactId) {
        if (this._supabase) {
            return await this._supabase.getContactProjects(contactId);
        }
        return (this._cache.contactProjects || []).filter(cp => cp.contact_id === contactId);
    }

    /**
     * Find existing contact or create new one (for entity extraction deduplication)
     * @param {Object} personData - Person data with name, email, organization, role
     * @returns {Promise<{contact: Object, action: string, confidence: number}>}
     */
    async findOrCreateContact(personData) {
        if (this._supabase) {
            return await this._supabase.findOrCreateContact(personData);
        }

        // Fallback: Simple match by name only
        if (!personData?.name) {
            return { contact: null, action: 'skipped', confidence: 0 };
        }

        const existingContact = this._cache.contacts?.find(c =>
            c.name?.toLowerCase() === personData.name.toLowerCase() ||
            (personData.email && c.email?.toLowerCase() === personData.email.toLowerCase())
        );

        if (existingContact) {
            return { contact: existingContact, action: 'matched', confidence: 0.8 };
        }

        // Create new contact
        try {
            const newContact = await this.addContact({
                name: personData.name,
                email: personData.email || null,
                organization: personData.organization || null,
                role: personData.role || null
            });
            return { contact: newContact, action: 'created', confidence: 1.0 };
        } catch (err) {
            return { contact: null, action: 'error', confidence: 0 };
        }
    }

    /**
     * Get all teams a contact belongs to
     */
    async getContactTeams(contactId) {
        if (this._supabase) {
            return await this._supabase.getContactTeams(contactId);
        }
        // Fallback: search in teams cache
        const teams = this.contacts?.teams || [];
        const result = [];
        for (const team of teams) {
            const members = team.members || [];
            const isMember = members.some(m =>
                m.contact_id === contactId || m.contactId === contactId || m.contact?.id === contactId
            );
            if (isMember) {
                const member = members.find(m =>
                    m.contact_id === contactId || m.contactId === contactId || m.contact?.id === contactId
                );
                result.push({
                    team_id: team.id,
                    role: member?.role || null,
                    is_lead: member?.is_lead || false,
                    joined_at: member?.joined_at,
                    teams: team
                });
            }
        }
        return result;
    }

    /**
     * Get contact with all their teams and projects
     */
    async getContactWithAssociations(contactId) {
        const contact = this.getContactById(contactId);
        if (!contact) return null;

        const teams = await this.getContactTeams(contactId);
        const projects = await this.getContactProjects(contactId);

        return {
            ...contact,
            teams: teams.map(t => ({
                id: t.team_id,
                name: t.teams?.name || t.name,
                color: t.teams?.color || t.color,
                role: t.role,
                isLead: t.is_lead
            })),
            projects: projects.map(p => ({
                id: p.project_id,
                name: p.projects?.name || p.name,
                role: p.role,
                isPrimary: p.is_primary
            }))
        };
    }

    async mergeContacts(contactIds) {
        if (!contactIds || contactIds.length < 2) return null;

        // Use Supabase version if available
        if (this._isSupabaseMode && this._supabase) {
            try {
                return await this._supabase.mergeContacts(contactIds);
            } catch (error) {
                log.error({ event: 'supabase_merge_failed', err: error?.message }, 'Supabase merge failed');
                throw error;
            }
        }

        // Fallback to local version
        const contacts = contactIds.map(id => this.getContactById(id)).filter(Boolean);
        if (contacts.length < 2) return null;

        // Merge into first contact
        const primary = contacts[0];
        const merged = { ...primary };

        // Merge data from other contacts
        for (let i = 1; i < contacts.length; i++) {
            const other = contacts[i];
            // Merge tags
            if (other.tags) {
                merged.tags = [...new Set([...(merged.tags || []), ...other.tags])];
            }
            // Merge notes
            if (other.notes) {
                merged.notes = (merged.notes || '') + '\n' + other.notes;
            }
            // Delete the duplicate
            this.deleteContact(other.id);
        }

        // Update primary
        this.updateContact(primary.id, merged);
        return primary.id;
    }

    exportContactsJSON() {
        return {
            contacts: this._cache.contacts || [],
            exportedAt: new Date().toISOString()
        };
    }

    exportContactsCSV() {
        const contacts = this._cache.contacts || [];
        if (contacts.length === 0) return 'name,email,organization,role,phone,tags\n';

        const headers = ['name', 'email', 'organization', 'role', 'phone', 'tags'];
        const rows = contacts.map(c => [
            c.name || '',
            c.email || '',
            c.organization || '',
            c.role || '',
            c.phone || '',
            (c.tags || []).join(';')
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

        return headers.join(',') + '\n' + rows.join('\n');
    }

    importContactsJSON(data) {
        const contacts = data.contacts || data;
        if (!Array.isArray(contacts)) {
            throw new Error('Invalid JSON format');
        }

        let added = 0;
        for (const c of contacts) {
            if (c.name) {
                this._cache.contacts.push({
                    id: c.id || `contact-${Date.now()}-${added}`,
                    ...c,
                    importedAt: new Date().toISOString()
                });
                added++;
            }
        }
        return { added, total: this._cache.contacts.length };
    }

    importContactsCSV(csv) {
        const lines = csv.split('\n').filter(l => l.trim());
        if (lines.length < 2) return { added: 0, total: this._cache.contacts.length };

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        let added = 0;

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].match(/("([^"]|"")*"|[^,]*)/g) || [];
            const contact = {};

            headers.forEach((h, idx) => {
                let val = (values[idx] || '').trim().replace(/^"|"$/g, '').replace(/""/g, '"');
                if (h === 'tags' && val) {
                    contact[h] = val.split(';').map(t => t.trim()).filter(Boolean);
                } else if (val) {
                    contact[h] = val;
                }
            });

            if (contact.name) {
                this._cache.contacts.push({
                    id: `contact-${Date.now()}-${added}`,
                    ...contact,
                    importedAt: new Date().toISOString()
                });
                added++;
            }
        }

        return { added, total: this._cache.contacts.length };
    }

    // ==================== Teams ====================

    async getTeams() {
        if (this._supabase) {
            try {
                const teams = await this._supabase.getTeams();
                return teams || [];
            } catch (e) {
                log.warn({ event: 'get_teams_error', reason: e.message }, 'getTeams error');
            }
        }
        return this.contacts?.teams || [];
    }

    async addTeam(team) {
        // Check for duplicate name first
        const existingTeams = await this.getTeams();
        const duplicate = existingTeams.find(t =>
            t.name?.toLowerCase().trim() === team.name?.toLowerCase().trim()
        );
        if (duplicate) {
            throw new Error(`Team "${team.name}" already exists`);
        }

        if (this._supabase) {
            try {
                const result = await this._supabase.addTeam(team);
                log.debug({ event: 'add_team_supabase', teamName: team.name, teamId: result?.id }, 'addTeam to Supabase');
                return result?.id;
            } catch (e) {
                log.warn({ event: 'add_team_supabase_error', reason: e.message }, 'addTeam Supabase error');
                throw e;
            }
        }
        // Fallback to memory
        if (!this.contacts) this.contacts = { items: [], teams: [], relationships: [] };
        if (!this.contacts.teams) this.contacts.teams = [];

        const newTeam = {
            id: `team-${Date.now()}`,
            name: team.name,
            description: team.description || '',
            color: team.color || '#3b82f6',
            createdAt: new Date().toISOString()
        };
        this.contacts.teams.push(newTeam);
        log.debug({ event: 'add_team_memory', teamName: newTeam.name, teamId: newTeam.id }, 'addTeam to memory');
        return newTeam.id;
    }

    async getTeamById(id) {
        if (this._supabase) {
            try {
                return await this._supabase.getTeamById(id);
            } catch (e) {
                log.warn({ event: 'get_team_by_id_error', reason: e.message }, 'getTeamById error');
            }
        }
        return this.contacts?.teams?.find(t => t.id === id);
    }

    getTeam(id) {
        return this.getTeamById(id);
    }

    async updateTeam(id, updates) {
        if (this._supabase) {
            try {
                await this._supabase.updateTeam(id, updates);
                return true;
            } catch (e) {
                log.warn({ event: 'update_team_error', reason: e.message }, 'updateTeam error');
            }
        }
        if (!this.contacts?.teams) return false;
        const idx = this.contacts.teams.findIndex(t => t.id === id);
        if (idx === -1) return false;
        this.contacts.teams[idx] = { ...this.contacts.teams[idx], ...updates };
        return true;
    }

    async deleteTeam(id) {
        if (this._supabase) {
            try {
                await this._supabase.deleteTeam(id);
                return true;
            } catch (e) {
                log.warn({ event: 'delete_team_error', reason: e.message }, 'deleteTeam error');
            }
        }
        if (!this.contacts?.teams) return false;
        const idx = this.contacts.teams.findIndex(t => t.id === id);
        if (idx === -1) return false;
        this.contacts.teams.splice(idx, 1);

        // Also remove team from all contacts
        for (const contact of this._cache.contacts || []) {
            if (contact.teamId === id) {
                contact.teamId = null;
            }
        }
        return true;
    }

    getContactsByTeam(teamId) {
        return (this._cache.contacts || []).filter(c => c.teamId === teamId);
    }

    async addTeamMember(teamId, contactId, role = null, isLead = false) {
        if (this._supabase) {
            try {
                return await this._supabase.addTeamMember(teamId, contactId, role, isLead);
            } catch (e) {
                log.warn({ event: 'add_team_member_error', reason: e.message }, 'addTeamMember error');
                throw e;
            }
        }
        // Fallback: update contact's teamId
        const contact = this._cache.contacts.find(c => c.id === contactId);
        if (contact) {
            contact.teamId = teamId;
            contact.teamRole = role;
            contact.isTeamLead = isLead;
            return { team_id: teamId, contact_id: contactId, role, is_lead: isLead };
        }
        throw new Error('Contact not found');
    }

    async removeTeamMember(teamId, contactId) {
        if (this._supabase) {
            try {
                await this._supabase.removeTeamMember(teamId, contactId);
                return true;
            } catch (e) {
                log.warn({ event: 'remove_team_member_error', reason: e.message }, 'removeTeamMember error');
                throw e;
            }
        }
        // Fallback: clear contact's teamId
        const contact = this._cache.contacts.find(c => c.id === contactId);
        if (contact && contact.teamId === teamId) {
            contact.teamId = null;
            contact.teamRole = null;
            contact.isTeamLead = false;
            return true;
        }
        return false;
    }

    // ==================== Timezones ====================

    async getTimezones() {
        if (this._supabase) {
            try {
                const timezones = await this._supabase.getTimezones();
                if (timezones && timezones.length > 0) {
                    return timezones;
                }
                // Try to populate if empty
                await this._supabase.ensureTimezonesExist();
                return await this._supabase.getTimezones();
            } catch (e) {
                log.warn({ event: 'get_timezones_error', reason: e.message }, 'getTimezones error');
                // Return fallback data
                return this._supabase?._getTimezoneData?.() || [];
            }
        }
        return [];
    }

    async getTimezonesGrouped() {
        if (this._supabase) {
            try {
                const grouped = await this._supabase.getTimezonesGrouped();
                if (Object.keys(grouped).length > 0) {
                    return grouped;
                }
                // Try to populate if empty
                await this._supabase.ensureTimezonesExist();
                return await this._supabase.getTimezonesGrouped();
            } catch (e) {
                log.warn({ event: 'get_timezones_grouped_error', reason: e.message }, 'getTimezonesGrouped error');
            }
        }
        return {};
    }

    async getTeamMembers(teamId) {
        if (this._supabase) {
            try {
                const team = await this._supabase.getTeamById(teamId);
                return team?.members || [];
            } catch (e) {
                log.warn({ event: 'get_team_members_error', reason: e.message }, 'getTeamMembers error');
            }
        }
        return this.getContactsByTeam(teamId);
    }

    // ==================== Stats ====================

    getStats() {
        return {
            facts: this._cache.facts.length,
            decisions: this._cache.decisions.length,
            risks: this._cache.risks.length,
            openRisks: this._cache.risks.filter(r => r.status === 'open').length,
            actions: this._cache.actions.length,
            pendingActions: this._cache.actions.filter(a => a.status === 'pending').length,
            questions: this._cache.questions.length,
            openQuestions: this._cache.questions.filter(q => q.status === 'open').length,
            people: this._cache.people.length,
            documents: this._cache.documents.length,
            contacts: this._cache.contacts.length
        };
    }

    async getProjectStats(projectId = null) {
        if (this._supabase) {
            return this._supabase.getProjectStats(projectId);
        }
        return this.getStats();
    }

    // ==================== Config ====================

    async getConfig() {
        if (this._supabase) {
            return this._supabase.getConfig();
        }
        return this._cache.config || {};
    }

    async updateConfig(updates) {
        if (this._supabase) {
            return this._supabase.updateConfig(updates);
        }
        this._cache.config = { ...this._cache.config, ...updates };
        return this._cache.config;
    }

    getOllamaConfig() {
        return this._cache.config?.ollama_config || {
            host: '127.0.0.1',
            port: '11434',
            model: 'qwen3:30b'
        };
    }

    // ==================== Utility ====================

    async calculateFileHash(filePath) {
        if (this._supabase) {
            return this._supabase.calculateFileHash(filePath);
        }
        const crypto = require('crypto');
        return new Promise((resolve) => {
            try {
                const hash = crypto.createHash('md5');
                const stream = fs.createReadStream(filePath);
                stream.on('data', data => hash.update(data));
                stream.on('end', () => resolve(hash.digest('hex')));
                stream.on('error', () => resolve(null));
            } catch (e) {
                resolve(null);
            }
        });
    }

    // ==================== All Knowledge ====================

    getAllKnowledge() {
        return {
            facts: this._cache.facts,
            decisions: this._cache.decisions,
            risks: this._cache.risks,
            actions: this._cache.actions,
            questions: this._cache.questions,
            people: this._cache.people,
            relationships: this._cache.relationships
        };
    }

    // ==================== Save Methods (No-op in Supabase mode) ====================

    saveKnowledge() {
        log.debug({ event: 'save_knowledge_noop' }, 'saveKnowledge (no-op in Supabase mode)');
    }

    saveQuestions() {
        log.debug({ event: 'save_questions_noop' }, 'saveQuestions (no-op in Supabase mode)');
    }

    saveDocuments() {
        log.debug({ event: 'save_documents_noop' }, 'saveDocuments (no-op in Supabase mode)');
    }

    saveContacts() {
        log.debug({ event: 'save_contacts_noop' }, 'saveContacts (no-op in Supabase mode)');
    }

    saveAll() {
        log.debug({ event: 'save_all_noop' }, 'saveAll (no-op in Supabase mode)');
    }

    /**
     * Cleanup bad data - stub for compatibility
     * In Supabase mode, data validation is handled by database constraints
     * @returns {Object} Cleanup results
     */
    cleanupBadData() {
        // No-op in Supabase mode - data validation handled by DB constraints
        return { decisions: 0, people: 0 };
    }

    /**
     * Invalidate RAG cache - stub
     */
    invalidateRAGCache() {
        // No-op - RAG cache is handled by GraphRAG module
        return;
    }

    /**
     * Sync people to contacts - stub
     */
    async syncPeopleToContacts() {
        if (this._supabase && this._supabase.syncPeopleToContacts) {
            return await this._supabase.syncPeopleToContacts();
        }
        // No-op - contacts sync is optional feature in legacy mode
        return { synced: 0 };
    }

    /**
     * Track contacts from conversation
     */
    async trackContactsFromConversation(conversation) {
        if (this._supabase && this._supabase.trackContactsFromConversation) {
            return await this._supabase.trackContactsFromConversation(conversation);
        }
        // No-op in legacy mode
        return;
    }

    /**
     * Record daily stats - async operation wrapped for sync interface
     */
    recordDailyStats() {
        if (this._isSupabaseMode && this._supabase && this._isValidUUID(this.currentProjectId)) {
            // Fire and forget - don't block startup
            this._supabase.recordDailyStats().catch(e =>
                log.warn({ event: 'record_daily_stats_error', reason: e.message }, 'recordDailyStats error')
            );
        }
    }

    // ==================== Stub methods for compatibility ====================
    // These methods exist in legacy storage but aren't fully implemented in Supabase yet

    /**
     * Get trends data - stub
     */
    getTrends() {
        return { daily: [], weekly: [], monthly: [] };
    }

    /**
     * Get questions grouped by person
     * Returns an object where keys are person names and values are arrays of questions
     */
    getQuestionsByPerson(personId) {
        // If personId is provided, filter by that person
        if (personId) {
            return this._cache.questions.filter(q => q.assignee === personId || q.createdBy === personId);
        }

        // Otherwise, group all questions by person
        const byPerson = {};
        for (const q of this._cache.questions || []) {
            const personName = q.assignee || q.createdBy || 'Unassigned';
            if (!byPerson[personName]) {
                byPerson[personName] = [];
            }
            byPerson[personName].push(q);
        }
        return byPerson;
    }

    /**
     * Get risks by category - stub
     */
    getRisksByCategory(category) {
        if (category) {
            return this._cache.risks.filter(r => r.category === category);
        }

        // Group risks by impact for the UI
        const risks = this._cache.risks || [];
        const grouped = {
            'High Impact': [],
            'Medium Impact': [],
            'Low Impact': []
        };

        risks.forEach(r => {
            const impact = (r.impact || 'medium').toLowerCase();
            if (impact === 'high' || impact === 'critical') {
                grouped['High Impact'].push(r);
            } else if (impact === 'medium') {
                grouped['Medium Impact'].push(r);
            } else {
                grouped['Low Impact'].push(r);
            }
        });

        // Remove empty categories
        Object.keys(grouped).forEach(key => {
            if (grouped[key].length === 0) delete grouped[key];
        });

        return grouped;
    }

    /**
     * Get org chart data for visualization
     * Integrates Contacts Directory with Knowledge Base people
     */
    getOrgChartData() {
        const contacts = this._cache.contacts || [];
        const teams = this._cache.teams || this.contacts?.teams || [];
        const knowledgePeople = this._cache.people || [];
        const knowledgeRelationships = this._cache.relationships || [];
        const contactRelationships = this._cache.contactRelationships || [];

        // Create unified node map (merge contacts + knowledge people)
        const nameToNode = new Map(); // name.toLowerCase() -> node (for merging)
        const idToNode = new Map(); // id -> node
        const nodes = []; // Final array of unique nodes

        // First, add all contacts (they have richer data)
        for (const contact of contacts) {
            const team = teams.find(t => t.id === contact.team_id || t.id === contact.teamId);
            const nodeKey = contact.name.toLowerCase().trim();

            // Skip if already processed (avoid duplicates)
            if (nameToNode.has(nodeKey)) continue;

            const node = {
                id: `contact_${contact.id}`,
                contactId: contact.id,
                label: contact.name,
                title: this._buildNodeTitle(contact, team),
                group: contact.team_id ? `team_${contact.team_id}` : (contact.organization || 'default'),
                role: contact.role,
                organization: contact.organization,
                email: contact.email,
                phone: contact.phone,
                isContact: true,
                teamColor: team?.color || null,
                activityCount: 0,
                shape: 'box',
                font: { color: '#ffffff' },
                color: team ? { background: team.color, border: team.color } : { background: '#6366f1', border: '#4f46e5' }
            };

            // Add to collections
            nodes.push(node);
            nameToNode.set(nodeKey, node);
            idToNode.set(contact.id, node);

            // Also map aliases
            const aliases = contact.aliases || [];
            for (const alias of aliases) {
                const aliasKey = (alias || '').toLowerCase().trim();
                if (aliasKey && !nameToNode.has(aliasKey)) {
                    nameToNode.set(aliasKey, node);
                }
            }
        }

        // Then add knowledge base people (if not already from contacts)
        for (const person of knowledgePeople) {
            const nameKey = (person.name || '').toLowerCase().trim();
            if (!nameKey) continue;

            if (!nameToNode.has(nameKey)) {
                const node = {
                    id: person.id,
                    label: person.name,
                    title: person.role ? `${person.name}\n${person.role}` : person.name,
                    group: person.organization || 'default',
                    role: person.role,
                    organization: person.organization,
                    isContact: false,
                    shape: 'ellipse',
                    color: { background: '#94a3b8', border: '#64748b' }
                };
                nodes.push(node);
                nameToNode.set(nameKey, node);
                idToNode.set(person.id, node);
            } else {
                // Link knowledge person ID to existing contact node
                const existingNode = nameToNode.get(nameKey);
                existingNode.knowledgeId = person.id;
                idToNode.set(person.id, existingNode);
            }
        }

        // Build edges
        const edges = [];
        const edgeSet = new Set(); // Prevent duplicate edges

        // Add edges from contact relationships (from separate table)
        for (const rel of contactRelationships) {
            const fromContactId = rel.from_contact_id;
            const toContactId = rel.to_contact_id;
            const relType = rel.relationship_type || rel.type || 'works_with';

            const fromNode = idToNode.get(fromContactId);
            const toNode = idToNode.get(toContactId);

            if (!fromNode || !toNode) continue;

            const edgeKey = `${fromNode.id}_${toNode.id}_${relType}`;
            if (edgeSet.has(edgeKey)) continue;
            edgeSet.add(edgeKey);

            const edgeStyle = this._getRelationshipStyle(relType);
            edges.push({
                from: fromNode.id,
                to: toNode.id,
                ...edgeStyle,
                title: (relType || '').replace('_', ' '),
                source: 'contact'
            });
        }

        // Also check for embedded relationships in contacts (legacy support)
        for (const contact of contacts) {
            const fromNode = idToNode.get(contact.id);
            if (!fromNode) continue;

            const relationships = contact.relationships || [];
            for (const rel of relationships) {
                const toContactId = rel.contact_id || rel.contactId || rel.to_contact_id;
                const toNode = idToNode.get(toContactId);
                if (!toNode) continue;

                const relType = rel.relationship_type || rel.type || 'works_with';
                const edgeKey = `${fromNode.id}_${toNode.id}_${relType}`;
                if (edgeSet.has(edgeKey)) continue;
                edgeSet.add(edgeKey);

                const edgeStyle = this._getRelationshipStyle(relType);
                edges.push({
                    from: fromNode.id,
                    to: toNode.id,
                    ...edgeStyle,
                    title: (relType || '').replace('_', ' '),
                    source: 'contact'
                });
            }
        }

        // Add edges from knowledge relationships
        for (const rel of knowledgeRelationships) {
            // Support both old format (from/to) and new format (from_name/to_name)
            const fromKey = (rel.from_name || rel.from || rel.from_entity || '').toLowerCase().trim();
            const toKey = (rel.to_name || rel.to || rel.to_entity || '').toLowerCase().trim();
            const relType = rel.relationship_type || rel.type || 'works_with';

            const fromNode = nameToNode.get(fromKey);
            const toNode = nameToNode.get(toKey);

            if (!fromNode || !toNode) continue;

            const edgeKey = `${fromNode.id}_${toNode.id}_${relType}`;
            if (edgeSet.has(edgeKey)) continue;
            edgeSet.add(edgeKey);

            const edgeStyle = this._getRelationshipStyle(relType);
            edges.push({
                from: fromNode.id,
                to: toNode.id,
                ...edgeStyle,
                title: (relType || '').replace('_', ' '),
                source: 'knowledge'
            });
        }

        // Build team groups for legend
        const teamGroups = teams.map(t => ({
            id: `team_${t.id}`,
            name: t.name,
            color: t.color,
            memberCount: contacts.filter(c => c.team_id === t.id || c.teamId === t.id).length
        }));

        return {
            nodes,
            edges,
            teams: teamGroups,
            stats: {
                people: nodes.length,
                relationships: edges.length,
                contacts: contacts.length,
                knowledgePeople: knowledgePeople.length,
                teams: teams.length
            }
        };
    }

    /**
     * Build rich tooltip for org chart node
     * @private
     */
    _buildNodeTitle(contact, team) {
        let title = contact.name;
        if (contact.role) title += `\n${contact.role}`;
        if (contact.organization) title += `\n${contact.organization}`;
        if (team) title += `\nTeam: ${team.name}`;
        if (contact.email) title += `\n📧 ${contact.email}`;
        if (contact.phone) title += `\n📞 ${contact.phone}`;
        return title;
    }

    /**
     * Get edge style for relationship type
     * @private
     */
    _getRelationshipStyle(type) {
        let arrows = 'to';
        let dashes = false;
        let color = '#3498db';
        let width = 1;

        switch (type) {
            case 'reports_to':
                arrows = 'to';
                color = '#e74c3c';
                width = 2;
                break;
            case 'manages':
                arrows = 'from';
                color = '#e74c3c';
                width = 2;
                break;
            case 'leads':
                arrows = 'from';
                color = '#9b59b6';
                width = 2;
                break;
            case 'member_of':
                arrows = 'to';
                color = '#1abc9c';
                break;
            case 'works_with':
            case 'collaborates':
                arrows = '';
                dashes = true;
                color = '#95a5a6';
                break;
        }

        return { arrows, dashes, color: { color }, width };
    }

    // ==================== BRIEFINGS ====================

    /**
     * Get cached briefing if data hasn't changed
     */
    async getCachedBriefing() {
        if (this._supabase) {
            return this._supabase.getCachedBriefing();
        }
        return { cached: false };
    }

    /**
     * Get the latest briefing
     */
    async getLatestBriefing() {
        if (this._supabase) {
            return this._supabase.getLatestBriefing();
        }
        return null;
    }

    /**
     * Save a new briefing
     */
    async saveBriefing(briefingContent, options = {}) {
        if (this._supabase) {
            return this._supabase.saveBriefing(briefingContent, options);
        }
        return null;
    }

    /**
     * Get briefing history
     */
    async getBriefingHistory(limit = 30) {
        if (this._supabase) {
            return this._supabase.getBriefingHistory(limit);
        }
        return [];
    }

    /**
     * Get file logs - returns documents from cache in the format expected by frontend
     */
    getFileLogs(limit = 50) {
        // Return documents as file logs (documents are the file logs in Supabase mode)
        const docs = this._cache.documents || [];

        // Sort by processed_at or created_at descending
        const sorted = [...docs].sort((a, b) => {
            const dateA = new Date(a.processed_at || a.created_at || 0);
            const dateB = new Date(b.processed_at || b.created_at || 0);
            return dateB - dateA;
        });

        // Transform to file log format expected by frontend
        return sorted.slice(0, limit).map(doc => ({
            // IDs
            id: doc.id,
            document_id: doc.id,

            // Names
            filename: doc.filename || doc.name || 'Unknown',
            ai_title: doc.title || doc.ai_title || null,
            ai_summary: doc.summary || doc.ai_summary || null,

            // Timestamps
            completed_at: doc.processed_at || doc.created_at,
            created_at: doc.created_at,

            // Status and method (database uses 'completed', frontend expects 'success')
            status: (doc.status === 'processed' || doc.status === 'completed') ? 'success' : (doc.status || 'pending'),
            method: doc.method || doc.source || 'document',

            // Extracted counts (from stats or individual fields)
            facts_extracted: doc.facts_count || doc.stats?.facts || 0,
            decisions_extracted: doc.decisions_count || doc.stats?.decisions || 0,
            questions_extracted: doc.questions_count || doc.stats?.questions || 0,
            risks_extracted: doc.risks_count || doc.stats?.risks || 0,
            actions_extracted: doc.actions_count || doc.stats?.actions || 0,
            people_extracted: doc.people_count || doc.stats?.people || 0,

            // Additional metadata
            file_size: doc.file_size || 0,
            processing_time: doc.processing_time || 0,
            source: doc.source || 'upload'
        }));
    }

    /**
     * Init graph - connect to Supabase graph database
     */
    async initGraph(graphConfig) {
        if (!graphConfig?.enabled) {
            log.debug({ event: 'graph_disabled' }, 'Graph database disabled');
            return { ok: true, message: 'Graph disabled' };
        }
        if (!this._supabase?.supabase) {
            log.debug({ event: 'graph_supabase_not_configured' }, 'Supabase not configured, graph disabled');
            return { ok: false, error: 'Supabase not configured' };
        }

        try {
            const SupabaseGraphProvider = require('./graph/providers/supabase');

            const graphName = `godmode_${this.currentProjectId || 'default'}`;

            this.graphProvider = new SupabaseGraphProvider({
                supabase: this._supabase.supabase,
                graphName: graphName,
                projectId: this.currentProjectId
            });

            const connectResult = await this.graphProvider.connect();

            if (!connectResult.ok) {
                log.warn({ event: 'graph_connect_failed', error: connectResult.error }, 'Failed to connect to Supabase graph');
                this.graphProvider = null;
                return connectResult;
            }
            log.info({ event: 'graph_connected', graphName }, 'Connected to Supabase graph');
            return { ok: true, graphName };
        } catch (error) {
            log.warn({ event: 'graph_init_error', reason: error.message }, 'Graph init error');
            this.graphProvider = null;
            return { ok: false, error: error.message };
        }
    }



    /**
     * Sync graphs with Supabase projects
     * Lists graphs and identifies orphans (graphs without associated projects)
     * @param {object} options
     * @param {boolean} options.dryRun - If true, only report what would be deleted
     * @returns {Promise<{ok: boolean, graphs: string[], validGraphs: string[], orphanGraphs: string[], deleted: string[]}>}
     */
    async syncGraphs(options = {}) {
        const { dryRun = false } = options;

        if (!this.graphProvider) {
            return { ok: false, error: 'Graph provider not available' };
        }

        log.info({ event: 'sync_graphs_start' }, 'Syncing graphs with projects');

        try {
            // 1. List all graphs
            const graphsResult = await this.graphProvider.listGraphs();
            if (!graphsResult.ok) {
                return { ok: false, error: graphsResult.error || 'Failed to list graphs' };
            }
            const allGraphs = graphsResult.graphs || [];

            // 2. Get valid project IDs
            const projects = await this.listProjects();
            const validProjectIds = (projects || []).map(p => p.id);

            // 3. Build valid graph names
            const validGraphNames = new Set(['godmode_default', 'default']);
            for (const projectId of validProjectIds) {
                validGraphNames.add(`godmode_${projectId}`);
            }

            // 4. Find orphan graphs
            const orphanGraphs = allGraphs.filter(g => !validGraphNames.has(g));
            const validGraphs = allGraphs.filter(g => validGraphNames.has(g));

            // 5. Delete orphan graphs (unless dry run)
            const deleted = [];
            if (!dryRun && orphanGraphs.length > 0) {
                for (const graphName of orphanGraphs) {
                    const deleteResult = await this.graphProvider.deleteGraph(graphName);
                    if (deleteResult.ok) {
                        deleted.push(graphName);
                    }
                }
            }

            return { ok: true, graphs: allGraphs, validGraphs, orphanGraphs, deleted, dryRun };
        } catch (error) {
            log.warn({ event: 'sync_graphs_error', reason: error.message }, 'syncGraphs error');
            return { ok: false, error: error.message };
        }
    }

    // Backward compat alias: syncFalkorDBGraphs -> syncGraphs (kept for existing callers)
    async syncFalkorDBGraphs(options = {}) {
        return this.syncGraphs(options);
    }

    /**
     * Get graph stats
     */
    async getGraphStats() {
        if (!this.graphProvider) {
            return { enabled: false };
        }

        try {
            const stats = await this.graphProvider.getStats();
            return {
                enabled: true,
                connected: this.graphProvider.connected,
                ...stats
            };
        } catch (error) {
            log.warn({ event: 'get_graph_stats_error', reason: error.message }, 'getGraphStats error');
            return { enabled: false, error: error.message };
        }
    }

    /**
     * Sync storage data to graph database
     */
    async syncToGraph(options = {}) {
        if (!this.graphProvider) {
            return { ok: false, error: 'Graph provider not initialized' };
        }

        try {
            const synced = { nodes: 0, relationships: 0, contacts: 0, teams: 0 };

            // 1. Sync GraphRAG data (facts, decisions, risks, etc)
            const GraphRAGEngine = require('./graphrag/GraphRAGEngine');
            const graphRAG = new GraphRAGEngine({
                storage: this,
                graphProvider: this.graphProvider,
                projectId: this.currentProjectId
            });

            const graphResult = await graphRAG.syncToGraph({
                useOntology: options.useOntology !== false,
                projectId: this.currentProjectId
            });

            if (graphResult.synced) {
                synced.nodes += graphResult.synced.nodes || 0;
                synced.relationships += graphResult.synced.relationships || 0;
            }

            // 2. Sync Contacts directly to graph
            const contacts = await this.getContacts?.() || this.contacts?.items || [];
            for (const contact of contacts) {
                try {
                    await this.graphProvider.createNode('Contact', {
                        id: contact.id,
                        name: contact.name || '',
                        email: contact.email || null,
                        organization: contact.organization || null,
                        role: contact.role || null,
                        phone: contact.phone || null,
                        avatar_url: contact.avatar_url || contact.avatarUrl || contact.photo_url || null,
                        linkedin: contact.linkedin || null,
                        notes: contact.notes || null,
                        updated_at: new Date().toISOString()
                    });
                    synced.contacts++;
                    synced.nodes++;
                } catch (e) {
                    // Ignore individual failures
                }
            }

            // 3. Sync Teams directly to graph
            const teams = await this.getTeams?.() || [];
            for (const team of teams) {
                try {
                    await this.graphProvider.createNode('Team', {
                        id: team.id,
                        name: team.name || '',
                        description: team.description || '',
                        color: team.color || '#3b82f6',
                        updated_at: new Date().toISOString()
                    });
                    synced.teams++;
                    synced.nodes++;
                } catch (e) {
                    // Ignore individual failures
                }
            }

            // 4. Sync Contact-Team relationships (MEMBER_OF)
            for (const contact of contacts) {
                // Get team memberships
                const teamIds = [];
                if (Array.isArray(contact.teams)) {
                    contact.teams.forEach(t => {
                        if (t?.id) teamIds.push(t.id);
                        else if (typeof t === 'string') teamIds.push(t);
                    });
                } else if (contact.teamId) {
                    teamIds.push(contact.teamId);
                }

                for (const teamId of teamIds) {
                    try {
                        await this.graphProvider.createRelationship(
                            contact.id, teamId, 'MEMBER_OF', {}
                        );
                        synced.relationships++;
                    } catch (e) {
                        // Team might not exist
                    }
                }
            }

            // 5. Sync Contact-Contact relationships from Supabase
            try {
                const contactRelations = await this.getContactRelationships?.() || this._cache?.contactRelationships || [];
                for (const rel of contactRelations) {
                    try {
                        const relType = (rel.relationship_type || rel.type || 'KNOWS').toUpperCase().replace(/\s+/g, '_');
                        const fromId = rel.from_contact_id || rel.from || rel.fromId;
                        const toId = rel.to_contact_id || rel.to || rel.toId;

                        if (fromId && toId) {
                            await this.graphProvider.createRelationship(
                                fromId, toId, relType,
                                { notes: rel.notes || '', strength: rel.strength }
                            );
                            synced.relationships++;
                        }
                    } catch (e) {
                        // Ignore individual failures
                    }
                }
            } catch (e) {
                log.warn({ event: 'sync_contact_relationships_warning', reason: e.message }, 'Contact relationships sync warning');
            }

            // 6. Sync Facts to graph (use prefixed IDs for consistency)
            const facts = this.knowledge?.facts || [];
            for (const fact of facts) {
                try {
                    await this.graphProvider.createNode('Fact', {
                        id: `fact_${fact.id}`,  // Prefixed ID for consistency
                        content: fact.content || fact.text,
                        category: fact.category,
                        source: fact.source_file || fact.source,
                        confidence: fact.confidence,
                        updated_at: new Date().toISOString()
                    });
                    synced.nodes++;
                } catch (e) {
                    // Ignore
                }
            }

            log.info({ event: 'sync_to_graph_done', nodes: synced.nodes, relationships: synced.relationships }, 'syncToGraph completed');
            return { ok: true, synced };
        } catch (error) {
            log.warn({ event: 'sync_to_graph_error', reason: error.message }, 'syncToGraph error');
            return { ok: false, error: error.message };
        }
    }

    /**
     * Get stats history - stub
     */
    getStatsHistory(days = 30) {
        return [];
    }

    /**
     * Get processing history - stub
     */
    getProcessingHistory(limit = 50) {
        return [];
    }

    /**
     * Add processing history entry - stub
     */
    addProcessingHistory(entry) {
        return entry;
    }

    /**
     * Get change log - stub
     */
    getChangeLog(limit = 100) {
        return this.knowledge?.change_log || [];
    }

    /**
     * Normalize all categories - stub
     */
    normalizeAllCategories() {
        return { normalized: 0 };
    }

    /**
     * Get decisions by status - stub
     */
    getDecisionsByStatus(status) {
        if (!status) return this._cache.decisions;
        return this._cache.decisions.filter(d => d.status === status);
    }

    /**
     * Get actions by status - stub
     */
    getActionsByStatus(status) {
        if (!status) return this._cache.actions;
        return this._cache.actions.filter(a => a.status === status);
    }

    /**
     * Get overdue actions - stub
     */
    getOverdueActions() {
        const now = new Date();
        return this._cache.actions.filter(a =>
            a.dueDate && new Date(a.dueDate) < now && a.status !== 'completed'
        );
    }

    /**
     * Search across all knowledge - stub
     */
    searchKnowledge(query) {
        const q = query.toLowerCase();
        const results = [];

        this._cache.facts.forEach(f => {
            if (f.content?.toLowerCase().includes(q)) {
                results.push({ type: 'fact', item: f });
            }
        });

        this._cache.decisions.forEach(d => {
            if (d.content?.toLowerCase().includes(q) || d.title?.toLowerCase().includes(q)) {
                results.push({ type: 'decision', item: d });
            }
        });

        return results;
    }

    /**
     * Get calendar events - stub
     */
    getCalendarEvents(startDate, endDate) {
        return [];
    }

    /**
     * Get trend insights - stub
     */
    getTrendInsights() {
        return {
            facts: { trend: 'stable', change: 0 },
            decisions: { trend: 'stable', change: 0 },
            risks: { trend: 'stable', change: 0 },
            actions: { trend: 'stable', change: 0 },
            questions: { trend: 'stable', change: 0 }
        };
    }

    /**
     * Get processing history from Supabase
     */
    async getHistory(limit = 50) {
        if (this._supabase) {
            try {
                const history = await this._supabase.getProcessingHistory(null, limit);
                // Map to format expected by frontend
                return (history || []).map(h => {
                    // Extract details - could be JSON object or null
                    const details = h.details || {};

                    // Get title from joined documents table (prefer AI title over filename)
                    const docTitle = h.documents?.title || h.documents?.filename || details.title || details.filename || null;

                    return {
                        timestamp: h.created_at,
                        action: h.action,
                        filename: docTitle,
                        files_processed: details.files_count || 1,
                        facts_extracted: details.facts_extracted || details.facts || 0,
                        questions_added: details.questions_added || details.questions || 0,
                        decisions_added: details.decisions_added || details.decisions || 0,
                        risks_added: details.risks_added || details.risks || 0,
                        actions_added: details.actions_added || details.actions || 0,
                        people_added: details.people_added || details.people || 0,
                        document_id: h.document_id,
                        status: h.status,
                        model_used: h.model_used || details.model || null,
                        tokens_used: h.tokens_used || details.tokens || null,
                        duration_ms: h.duration_ms || details.duration_ms || null
                    };
                });
            } catch (e) {
                log.warn({ event: 'load_history_error', reason: e.message }, 'Could not load history');
                return [];
            }
        }
        return [];
    }

    /**
     * Log processing event to history
     * @param {string} action - Action type (e.g., 'batch_process', 'process')
     * @param {Object} details - Processing details
     */
    async logProcessing(action, details = {}) {
        if (this._supabase) {
            try {
                await this._supabase.addProcessingHistory(
                    details.document_id || null,
                    action,
                    'completed',
                    {
                        files_count: details.files_processed || 0,
                        facts_extracted: details.facts_extracted || 0,
                        questions_added: details.questions_added || 0,
                        decisions_added: details.decisions_extracted || 0,
                        risks_added: details.risks_extracted || 0,
                        actions_added: details.actions_extracted || 0,
                        people_added: details.people_extracted || 0,
                        filename: details.filename || null,
                        title: details.title || null,
                        model: details.model || null,
                        errors: details.extra?.errors || 0
                    },
                    details.model || null,
                    details.tokens || null,
                    details.duration_ms || null
                );
            } catch (e) {
                log.warn({ event: 'log_processing_error', reason: e.message }, 'Could not log processing');
            }
        }
    }

    /**
     * Log individual file processing to history
     * @param {Object} result - Processing result from processFile
     * @param {Object} options - Additional options (model, duration, etc.)
     */
    async logFileProcessing(result, options = {}) {
        if (this._supabase && result.success) {
            try {
                await this._supabase.addProcessingHistory(
                    result.document_id || options.document_id || null,
                    'process',
                    'completed',
                    {
                        facts_extracted: result.facts || 0,
                        questions_added: result.questions || 0,
                        decisions_added: result.decisions || 0,
                        risks_added: result.risks || 0,
                        actions_added: result.actions || 0,
                        people_added: result.people || 0,
                        filename: result.filename || options.filename || null,
                        title: result.title || options.title || null
                    },
                    options.model || null,
                    result.tokens || options.tokens || null,
                    options.duration_ms || null
                );
            } catch (e) {
                log.warn({ event: 'log_file_processing_error', reason: e.message }, 'Could not log file processing');
            }
        }
    }

    /**
     * Get projects list - from Supabase if configured, otherwise local
     */
    async getProjectsAsync() {
        if (this._isSupabaseMode && this._supabase) {
            try {
                const projects = await this._supabase.listProjects();
                return projects || [];
            } catch (e) {
                log.warn({ event: 'load_projects_supabase_error', reason: e.message }, 'Could not load projects from Supabase');
            }
        }
        try {
            const projectsPath = path.join(this.dataDir, 'projects.json');
            if (fs.existsSync(projectsPath)) {
                const data = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
                return data.projects || [];
            }
        } catch (e) {
            log.warn({ event: 'load_local_projects_error', reason: e.message }, 'Could not load local projects');
        }
        return [];
    }

    /**
     * Get projects list (sync version - for backward compat, uses cache)
     */
    getProjects() {
        // For sync calls, return from cache or local file
        if (this._projectsCache) {
            return this._projectsCache;
        }

        try {
            const projectsPath = path.join(this.dataDir, 'projects.json');
            if (fs.existsSync(projectsPath)) {
                const data = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
                return data.projects || [];
            }
        } catch (e) {
            log.warn({ event: 'load_projects_error', reason: e.message }, 'Could not load projects');
        }
        return [];
    }

    /**
     * List projects - async version that checks Supabase
     */
    async listProjects() {
        return this.getProjectsAsync();
    }

    /**
     * Get all facts with optional filter
     */
    getAllFacts(filter = null) {
        let facts = this._cache.facts || [];
        if (filter?.category) {
            facts = facts.filter(f => f.category === filter.category);
        }
        return facts;
    }

    /**
     * Get conversations
     */
    getConversations() {
        return this._cache.conversations || [];
    }

    /**
     * Get contact mentions
     * @param {string} contactId
     * @returns {Promise<Array>}
     */
    async getContactMentions(contactId) {
        if (this._isSupabaseMode && this._supabase) {
            return await this._supabase.getContactMentions(contactId);
        }
        return [];
    }

    // ==================== Chat Sessions (Main Chat) ====================

    /**
     * Create a new chat session
     * @param {object} options - { projectId, userId, title }
     * @returns {Promise<object>}
     */
    async createChatSession(options = {}) {
        if (this._isSupabaseMode && this._supabase) {
            return await this._supabase.createChatSession({
                ...options,
                projectId: options.projectId || this.currentProjectId
            });
        }
        throw new Error('Chat sessions require Supabase');
    }

    /**
     * Get a single chat session by ID
     * @param {string} sessionId - Session ID
     * @returns {Promise<object|null>}
     */
    async getChatSession(sessionId) {
        if (this._isSupabaseMode && this._supabase) {
            return await this._supabase.getChatSession(sessionId);
        }
        return null;
    }

    /**
     * Update chat session (title, contextContactId, etc.)
     * @param {string} sessionId - Session ID
     * @param {object} updates - { title?, contextContactId? }
     * @returns {Promise<object>}
     */
    async updateChatSession(sessionId, updates = {}) {
        if (this._isSupabaseMode && this._supabase) {
            return await this._supabase.updateChatSession(sessionId, updates);
        }
        throw new Error('Chat sessions require Supabase');
    }

    /**
     * Get chat sessions for current project
     * @param {string} projectId - Optional project ID
     * @returns {Promise<Array>}
     */
    async getChatSessions(projectId = null) {
        if (this._isSupabaseMode && this._supabase) {
            return await this._supabase.getChatSessions(projectId || this.currentProjectId);
        }
        return [];
    }

    /**
     * Get messages for a chat session
     * @param {string} sessionId - Session ID
     * @returns {Promise<Array>}
     */
    async getChatMessages(sessionId) {
        if (this._isSupabaseMode && this._supabase) {
            return await this._supabase.getChatMessages(sessionId);
        }
        return [];
    }

    /**
     * Append a message to a chat session
     * @param {string} sessionId - Session ID
     * @param {string} role - user | assistant | system
     * @param {string} content - Message content
     * @param {object} extras - { sources, metadata }
     * @returns {Promise<object>}
     */
    async appendChatMessage(sessionId, role, content, extras = {}) {
        if (this._isSupabaseMode && this._supabase) {
            return await this._supabase.appendChatMessage(sessionId, role, content, extras);
        }
        throw new Error('Chat messages require Supabase');
    }

    /**
     * Update chat session title
     * @param {string} sessionId - Session ID
     * @param {string} title - New title
     * @returns {Promise<object>}
     */
    async updateChatSessionTitle(sessionId, title) {
        if (this._isSupabaseMode && this._supabase) {
            return await this._supabase.updateChatSessionTitle(sessionId, title);
        }
        throw new Error('Chat sessions require Supabase');
    }

    /**
     * Categorize a question based on content keywords
     */
    categorizeQuestion(content) {
        if (!content) return 'General';
        const text = content.toLowerCase();

        const teamKeywords = {
            'Technical': ['api', 'database', 'server', 'code', 'bug', 'error', 'integration', 'system', 'technical'],
            'Business': ['process', 'workflow', 'policy', 'procedure', 'approval', 'budget', 'business'],
            'Data': ['data', 'migration', 'export', 'import', 'format', 'mapping'],
            'Operations': ['timesheet', 'report', 'submit', 'portal', 'access', 'login'],
            'HR/Admin': ['employee', 'leave', 'vacation', 'holiday', 'contract', 'onboarding'],
            'Legal': ['law', 'legal', 'compliance', 'regulation', 'pension', 'contract']
        };

        for (const [team, keywords] of Object.entries(teamKeywords)) {
            if (keywords.some(kw => text.includes(kw))) return team;
        }
        return 'General';
    }

    /**
     * Get expertise suggestions for a question
     * Enhanced version that also considers contacts
     */
    getExpertiseSuggestions(questionContent) {
        const category = this.categorizeQuestion(questionContent);
        const expertiseMap = {};
        const contacts = this._cache.contacts || [];
        const people = this._cache.people || [];

        // Analyze questions to build expertise profiles
        for (const q of this._cache.questions || []) {
            const assignee = q.assigned_to || q.assignee || q.owner;
            if (!assignee || assignee === 'Unassigned') continue;

            const qCategory = this.categorizeQuestion(q.content);
            if (!expertiseMap[assignee]) {
                expertiseMap[assignee] = { total: 0, byCategory: {}, resolved: 0, isContact: false };
            }
            expertiseMap[assignee].total++;
            expertiseMap[assignee].byCategory[qCategory] = (expertiseMap[assignee].byCategory[qCategory] || 0) + 1;
            if (q.status === 'resolved' || q.answer) {
                expertiseMap[assignee].resolved++;
            }
        }

        // Also analyze actions ownership
        for (const a of this._cache.actions || []) {
            const owner = a.owner;
            if (!owner) continue;
            if (!expertiseMap[owner]) {
                expertiseMap[owner] = { total: 0, byCategory: {}, resolved: 0, isContact: false };
            }
            expertiseMap[owner].total++;
            if (a.status === 'done' || a.status === 'completed') {
                expertiseMap[owner].resolved++;
            }
        }

        // Add ALL contacts as potential experts (contacts are always valid assignees)
        for (const contact of contacts) {
            const name = contact.name;
            if (!name) continue;

            // Check if contact's role/organization matches the question category for bonus relevance
            const roleText = `${contact.role || ''} ${contact.organization || ''} ${(contact.tags || []).join(' ')}`.toLowerCase();
            let relevance = 1; // Base relevance for all contacts

            // Category-specific bonus
            if (category === 'Legal' && (roleText.includes('legal') || roleText.includes('law') || roleText.includes('compliance'))) {
                relevance = 5;
            } else if (category === 'Technical' && (roleText.includes('tech') || roleText.includes('engineer') || roleText.includes('developer') || roleText.includes('it'))) {
                relevance = 5;
            } else if (category === 'Business' && (roleText.includes('business') || roleText.includes('manager') || roleText.includes('analyst') || roleText.includes('strategy'))) {
                relevance = 5;
            } else if (category === 'Data' && (roleText.includes('data') || roleText.includes('analyst') || roleText.includes('database') || roleText.includes('analytics'))) {
                relevance = 5;
            } else if (category === 'General') {
                // For General category, boost contacts with leadership roles
                if (roleText.includes('lead') || roleText.includes('manager') || roleText.includes('director') || roleText.includes('head')) {
                    relevance = 3;
                } else {
                    relevance = 2; // All contacts get base relevance for General
                }
            }

            // Always add contacts to the map
            if (!expertiseMap[name]) {
                expertiseMap[name] = { total: relevance, byCategory: {}, resolved: relevance, isContact: true };
            }
            expertiseMap[name].byCategory[category] = (expertiseMap[name].byCategory[category] || 0) + relevance;
            expertiseMap[name].total += relevance;
        }

        // Add people from documents with relevant roles
        for (const person of people) {
            const name = person.name;
            if (!name) continue;

            const roleText = `${person.role || ''} ${person.organization || ''}`.toLowerCase();
            let relevance = 0;

            if (category === 'Legal' && (roleText.includes('legal') || roleText.includes('law'))) {
                relevance = 2;
            } else if (category === 'Technical' && (roleText.includes('tech') || roleText.includes('engineer'))) {
                relevance = 2;
            }

            if (relevance > 0) {
                if (!expertiseMap[name]) {
                    expertiseMap[name] = { total: relevance, byCategory: {}, resolved: relevance, isContact: false };
                }
                expertiseMap[name].byCategory[category] = (expertiseMap[name].byCategory[category] || 0) + relevance;
            }
        }

        // Calculate scores for each person based on category match
        const suggestions = [];
        for (const [person, stats] of Object.entries(expertiseMap)) {
            const categoryCount = stats.byCategory[category] || 0;
            const totalQuestions = stats.total || 1;
            const resolvedRatio = stats.resolved / Math.max(1, totalQuestions);

            // Score: category experience + resolution track record
            const categoryScore = categoryCount / Math.max(1, totalQuestions);
            const overallScore = (categoryScore * 0.6) + (resolvedRatio * 0.4);
            const score = Math.round(overallScore * 100);

            if (score > 0 || categoryCount > 0) {
                let reason = '';
                if (stats.isContact) {
                    reason = `Contact with relevant role for ${category}`;
                } else if (categoryCount > 0) {
                    reason = `Handled ${categoryCount} ${category} question(s)`;
                } else if (stats.total > 0) {
                    reason = `Active participant (${stats.total} items)`;
                }

                suggestions.push({
                    person,
                    score: Math.max(score, categoryCount > 0 ? 30 : 10),
                    reason: reason || `Experience in ${category}`
                });
            }
        }

        // Sort by score descending
        suggestions.sort((a, b) => b.score - a.score);
        return suggestions.slice(0, 5);
    }

    /**
     * Add calendar event - stub
     */
    addCalendarEvent(event) {
        return event;
    }

    /**
     * Get a specific project by ID
     */
    async getProject(projectId) {
        if (this._isSupabaseMode && this._supabase) {
            try {
                const projects = await this._supabase.listProjects();
                return projects.find(p => p.id === projectId) || null;
            } catch (e) {
                log.warn({ event: 'get_project_error', reason: e.message }, 'getProject error');
            }
        }
        const projects = this.getProjects();
        return projects.find(p => p.id === projectId) || null;
    }

    /**
     * Update a project
     */
    async updateProject(projectId, updates) {
        if (this._isSupabaseMode && this._supabase) {
            try {
                const result = await this._supabase.updateProject(projectId, updates);

                // Update local cache if this is the current project
                if (projectId === this.currentProjectId) {
                    if (updates.name) this.currentProjectName = updates.name;
                }

                // Invalidate projects cache
                this._projectsCache = null;

                return {
                    id: result.id,
                    name: result.name,
                    userRole: result.settings?.userRole || '',
                    userRolePrompt: result.settings?.userRolePrompt || '',
                    updated_at: result.updated_at
                };
            } catch (e) {
                log.warn({ event: 'update_project_error', reason: e.message }, 'updateProject error');
                throw e;
            }
        }

        // Fallback to local
        try {
            const projectsPath = path.join(path.dirname(this.dataDir), 'projects.json');
            const data = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
            const project = data.projects.find(p => p.id === projectId);
            if (project) {
                Object.assign(project, updates, { updated_at: new Date().toISOString() });
                fs.writeFileSync(projectsPath, JSON.stringify(data, null, 2));
                return project;
            }
        } catch (e) {
            log.warn({ event: 'update_project_local_error', reason: e.message }, 'Local updateProject error');
        }
        return null;
    }

    /**
     * Get default project ID
     */
    getDefaultProjectId() {
        // In Supabase mode, return the first project or current project
        if (this.currentProjectId) {
            return this.currentProjectId;
        }

        // Try from cache
        if (this._projectsCache && this._projectsCache.length > 0) {
            return this._projectsCache[0].id;
        }

        return null;
    }

    /**
     * Set default project
     */
    setDefaultProject(projectId) {
        // In Supabase mode, just update current project
        this.currentProjectId = projectId;
        log.debug({ event: 'default_project_set', projectId }, 'Default project set');
        return true;
    }

    /**
     * Get member's role in a project
     */
    async getMemberRole(projectId = null, userId = null) {
        const pid = projectId || this.currentProjectId;
        if (!pid) return null;

        if (this._isSupabaseMode && this._supabase) {
            try {
                return await this._supabase.getMemberRole(pid, userId);
            } catch (e) {
                log.warn({ event: 'get_member_role_error', reason: e.message }, 'getMemberRole error');
            }
        }

        // Fallback: get from project (legacy)
        const project = await this.getProject(pid);
        return {
            userRole: project?.userRole || '',
            userRolePrompt: project?.userRolePrompt || '',
            roleTemplateId: null,
            accessRole: 'owner'
        };
    }

    /**
     * Update member's role in a project
     */
    async updateMemberRole(projectId, updates, userId = null) {
        const pid = projectId || this.currentProjectId;
        if (!pid) throw new Error('No project specified');

        if (this._isSupabaseMode && this._supabase) {
            try {
                // If no userId, find the owner of the project
                let uid = userId;
                if (!uid) {
                    const { data: owner } = await this._supabase.supabase
                        .from('project_members')
                        .select('user_id')
                        .eq('project_id', pid)
                        .eq('role', 'owner')
                        .single();
                    uid = owner?.user_id;
                }

                if (!uid) {
                    throw new Error('No owner found for project');
                }

                return await this._supabase.updateMemberRole(pid, updates, uid);
            } catch (e) {
                log.warn({ event: 'update_member_role_error', reason: e.message }, 'updateMemberRole error');
            }
        }

        // Fallback: update project (legacy)
        return this.updateProject(pid, updates);
    }

    /**
     * Delete a project
     */
    async deleteProject(projectId) {
        if (this._isSupabaseMode && this._supabase) {
            try {
                // Delete from Supabase
                const { error } = await this._supabase.supabase
                    .from('project_members')
                    .delete()
                    .eq('project_id', projectId);

                if (error) log.warn({ event: 'delete_project_members_error', reason: error.message }, 'Error deleting project members');

                const { error: projectError } = await this._supabase.supabase
                    .from('projects')
                    .delete()
                    .eq('id', projectId);

                if (projectError) {
                    log.warn({ event: 'delete_project_error', reason: projectError.message }, 'Error deleting project');
                    return false;
                }

                // Invalidate cache
                this._projectsCache = null;

                // If this was the current project, clear it
                if (projectId === this.currentProjectId) {
                    this.currentProjectId = null;
                    this.currentProjectName = null;
                }

                return true;
            } catch (e) {
                log.warn({ event: 'delete_project_error', reason: e.message }, 'deleteProject error');
                return false;
            }
        }

        // Fallback to local
        try {
            const projectsPath = path.join(path.dirname(this.dataDir), 'projects.json');
            const data = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
            const index = data.projects.findIndex(p => p.id === projectId);
            if (index !== -1) {
                data.projects.splice(index, 1);
                if (data.current === projectId) {
                    data.current = data.projects.length > 0 ? data.projects[0].id : null;
                }
                fs.writeFileSync(projectsPath, JSON.stringify(data, null, 2));
                return true;
            }
        } catch (e) {
            log.warn({ event: 'delete_project_local_error', reason: e.message }, 'Local deleteProject error');
        }
        return false;
    }

    /**
     * Create a new project
     * @param {string} name
     * @param {string} userRole
     * @param {string} [companyId] - optional; used when creating via Supabase (user flow uses createProject with auth)
     */
    async createProject(name, userRole = '', companyId = null, ownerId = null, accessToken = null) {
        if (this._isSupabaseMode && this._supabase) {
            try {
                // Try to create via Supabase (createProjectWithServiceKey resolves company for system user)
                const project = await this._supabase.createProject(name, userRole, companyId, ownerId, accessToken);

                // Update current project
                this.currentProjectId = project.id;
                this.currentProjectName = project.name;

                // Create local directories
                const projectDir = path.join(path.dirname(this.dataDir), project.id);
                fs.mkdirSync(path.join(projectDir, 'files'), { recursive: true });
                fs.mkdirSync(path.join(projectDir, 'archived'), { recursive: true });
                fs.mkdirSync(path.join(projectDir, 'temp'), { recursive: true });

                return project;
            } catch (e) {
                log.warn({ event: 'create_project_supabase_failed', reason: e.message }, 'Supabase createProject failed');
                throw e;
            }
        }

        // Fallback to local creation
        const projectId = this._generateId();
        const project = {
            id: projectId,
            name: name.trim(),
            userRole: userRole || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Save to local projects.json
        const projectsPath = path.join(path.dirname(this.dataDir), 'projects.json');
        let data = { projects: [], current: null };
        try {
            if (fs.existsSync(projectsPath)) {
                data = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
            }
        } catch (e) { }

        data.projects.push(project);
        data.current = projectId;
        fs.writeFileSync(projectsPath, JSON.stringify(data, null, 2));

        // Create directories
        const projectDir = path.join(path.dirname(this.dataDir), projectId);
        fs.mkdirSync(path.join(projectDir, 'files'), { recursive: true });

        this.currentProjectId = projectId;
        this.currentProjectName = project.name;

        return project;
    }

    /**
     * Generate a unique ID
     */
    _generateId() {
        return require('crypto').randomBytes(16).toString('hex').substring(0, 8);
    }

    // ==================== Email Methods ====================

    /**
     * Save a new email
     * @param {Object} emailData - Parsed email data
     * @returns {Promise<Object>}
     */
    async saveEmail(emailData) {
        if (this._supabase) {
            return await this._supabase.saveEmail(emailData);
        }
        throw new Error('Email storage requires Supabase');
    }

    /**
     * Update email with analysis results
     * @param {string} id - Email ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>}
     */
    async updateEmail(id, updates) {
        if (this._supabase) {
            return await this._supabase.updateEmail(id, updates);
        }
        throw new Error('Email storage requires Supabase');
    }

    /**
     * Get emails for the current project
     * @param {Object} options - Filter options
     * @returns {Promise<Array>}
     */
    async getEmails(options = {}) {
        if (this._supabase) {
            return await this._supabase.getEmails(options);
        }
        return [];
    }

    /**
     * Get a single email by ID
     * @param {string} id - Email ID
     * @returns {Promise<Object|null>}
     */
    async getEmail(id) {
        if (this._supabase) {
            return await this._supabase.getEmail(id);
        }
        return null;
    }

    /**
     * Find email by content hash (for duplicate detection)
     * @param {string} contentHash - MD5 hash of email content
     * @returns {Promise<Object|null>}
     */
    async findEmailByHash(contentHash) {
        if (this._supabase) {
            return await this._supabase.findEmailByHash(contentHash);
        }
        return null;
    }

    /**
     * Delete an email (soft delete)
     * @param {string} id - Email ID
     * @returns {Promise<boolean>}
     */
    async deleteEmail(id) {
        if (this._supabase) {
            return await this._supabase.deleteEmail(id);
        }
        return false;
    }

    /**
     * Add email recipient link
     * @param {string} emailId - Email ID
     * @param {Object} recipient - Recipient data
     * @returns {Promise<Object|null>}
     */
    async addEmailRecipient(emailId, recipient) {
        if (this._supabase) {
            return await this._supabase.addEmailRecipient(emailId, recipient);
        }
        return null;
    }

    /**
     * Get email recipients
     * @param {string} emailId - Email ID
     * @returns {Promise<Array>}
     */
    async getEmailRecipients(emailId) {
        if (this._supabase) {
            return await this._supabase.getEmailRecipients(emailId);
        }
        return [];
    }

    /**
     * Add email attachment link
     * @param {string} emailId - Email ID
     * @param {string} documentId - Document ID
     * @param {Object} metadata - Attachment metadata
     * @returns {Promise<Object|null>}
     */
    async addEmailAttachment(emailId, documentId, metadata = {}) {
        if (this._supabase) {
            return await this._supabase.addEmailAttachment(emailId, documentId, metadata);
        }
        return null;
    }

    /**
     * Get emails that need a response
     * @returns {Promise<Array>}
     */
    async getEmailsNeedingResponse() {
        if (this._supabase) {
            return await this._supabase.getEmailsNeedingResponse();
        }
        return [];
    }

    /**
     * Find contact by email address
     * @param {string} email - Email address
     * @returns {Promise<Object|null>}
     */
    async findContactByEmail(email) {
        if (this._supabase) {
            return await this._supabase.findContactByEmail(email);
        }
        // Fallback to cache search
        const contacts = this._cache.contacts || [];
        return contacts.find(c => c.email?.toLowerCase() === email?.toLowerCase()) || null;
    }

    /**
     * Find contact by name (fuzzy match)
     * @param {string} name - Contact name
     * @returns {Promise<Object|null>}
     */
    async findContactByName(name) {
        if (this._supabase) {
            return await this._supabase.findContactByName(name);
        }
        // Fallback to cache search
        const contacts = this._cache.contacts || [];
        const lowerName = name?.toLowerCase();
        return contacts.find(c => c.name?.toLowerCase().includes(lowerName)) || null;
    }

    /**
     * Create a new contact from email data
     * @param {Object} contactData - Contact data
     * @returns {Promise<Object>}
     */
    async createContactFromEmail(contactData) {
        if (this._supabase) {
            const contact = await this._supabase.createContactFromEmail(contactData);
            // Update cache
            if (contact && this._cache.contacts) {
                this._cache.contacts.push(contact);
            }
            return contact;
        }
        throw new Error('Contact creation requires Supabase');
    }

    // ==================== Ontology Methods (SOTA v2.0) ====================

    /**
     * Get ontology schema from Supabase
     * @param {string|null} projectId - Project ID or null for global
     * @param {string|null} schemaType - Filter by type (entity, relation, etc.)
     * @returns {Promise<Array>}
     */
    async getOntologySchema(projectId = null, schemaType = null) {
        if (this._supabase?.getOntologySchema) {
            return await this._supabase.getOntologySchema(projectId, schemaType);
        }
        return [];
    }

    /**
     * Save ontology schema item to Supabase
     * @param {Object} item - Schema item
     * @param {string|null} userId - User ID
     * @returns {Promise<Object|null>}
     */
    async saveOntologySchemaItem(item, userId = null) {
        if (this._supabase?.saveOntologySchemaItem) {
            return await this._supabase.saveOntologySchemaItem(item, userId);
        }
        return null;
    }

    /**
     * Save full ontology schema to Supabase
     * @param {Object} schema - Full schema object
     * @param {string|null} projectId - Project ID
     * @param {string|null} userId - User ID
     * @returns {Promise<Object>}
     */
    async saveOntologySchema(schema, projectId = null, userId = null) {
        if (this._supabase?.saveOntologySchema) {
            return await this._supabase.saveOntologySchema(schema, projectId, userId);
        }
        return { success: false, error: 'Supabase not available' };
    }

    /**
     * Build schema from Supabase records
     * @param {string|null} projectId - Project ID
     * @returns {Promise<Object|null>}
     */
    async buildSchemaFromSupabase(projectId = null) {
        if (this._supabase?.buildSchemaFromSupabase) {
            return await this._supabase.buildSchemaFromSupabase(projectId);
        }
        return null;
    }

    /**
     * Deactivate ontology schema item
     * @param {string} id - Item ID
     * @returns {Promise<boolean>}
     */
    async deactivateOntologySchemaItem(id) {
        if (this._supabase?.deactivateOntologySchemaItem) {
            return await this._supabase.deactivateOntologySchemaItem(id);
        }
        return false;
    }

    /**
     * Get ontology schema version
     * @param {string|null} projectId - Project ID
     * @returns {Promise<string|null>}
     */
    async getOntologySchemaVersion(projectId = null) {
        if (this._supabase?.getOntologySchemaVersion) {
            return await this._supabase.getOntologySchemaVersion(projectId);
        }
        return null;
    }

    /**
     * Log ontology change
     * @param {Object} changeData - Change data
     * @returns {Promise<Object|null>}
     */
    async logOntologyChange(changeData) {
        if (this._supabase?.logOntologyChange) {
            return await this._supabase.logOntologyChange(changeData);
        }
        return null;
    }

    /**
     * Get all unique contact roles
     * @returns {Promise<Array>}
     */
    async getContactRoles() {
        if (this._supabase) {
            const pid = this.currentProjectId;
            if (!pid) return [];

            const { data, error } = await this.supabase
                .from('contacts')
                .select('role')
                .eq('project_id', pid)
                .not('role', 'is', null);

            if (error) {
                log.warn({ event: 'storage_get_roles_error', reason: error.message }, 'Error getting roles');
                return [];
            }

            // Get unique roles
            const roles = [...new Set(data.map(c => c.role).filter(r => r && r.trim().length > 0))];
            return roles.sort().map(r => ({ id: r, name: r }));
        }

        // Fallback for local storage
        const contacts = this._cache.contacts || [];
        const roles = [...new Set(contacts.map(c => c.role).filter(r => r && r.trim().length > 0))];
        return roles.sort().map(r => ({ id: r, name: r }));
    }

    /**
     * Get ontology changes history
     * @param {Object} options - Filter options
     * @returns {Promise<Array>}
     */
    async getOntologyChanges(options = {}) {
        if (this._supabase?.getOntologyChanges) {
            return await this._supabase.getOntologyChanges(options);
        }
        return [];
    }
    // ==================== RAG Support (Supabase) ====================

    /**
     * Search across knowledge base (keyword-based)
     * @param {string} query - Search query
     * @param {object} options - { limit, types }
     * @returns {object} - { query, total, facts, questions, decisions, risks, people }
     */
    search(query, options = {}) {
        const searchTerm = query.toLowerCase().trim();
        const limit = options.limit || 50;

        const results = {
            query,
            total: 0,
            facts: (this._cache.facts || []).filter(f => f.content?.toLowerCase().includes(searchTerm)).slice(0, limit),
            questions: (this._cache.questions || []).filter(q => q.content?.toLowerCase().includes(searchTerm)).slice(0, limit),
            decisions: (this._cache.decisions || []).filter(d => d.content?.toLowerCase().includes(searchTerm)).slice(0, limit),
            risks: (this._cache.risks || []).filter(r => r.content?.toLowerCase().includes(searchTerm)).slice(0, limit),
            people: (this._cache.people || []).filter(p => p.name?.toLowerCase().includes(searchTerm)).slice(0, limit)
        };

        results.total = results.facts.length + results.questions.length + results.decisions.length + results.risks.length + results.people.length;
        return results;
    }

    /**
     * Preprocess query for better search results
     * @param {string} query - Raw user query
     * @returns {object} - {original, normalized, expanded, terms}
     */
    preprocessQuery(query) {
        if (!query) return { original: '', normalized: '', expanded: '', terms: [] };

        // Common abbreviations mapping
        const abbreviations = {
            'db': 'database',
            'api': 'api application programming interface',
            'ui': 'ui user interface',
            'ux': 'ux user experience',
            'crm': 'crm customer relationship management',
            'hr': 'hr human resources',
            'qa': 'qa quality assurance',
            'dev': 'developer development',
            'prod': 'production',
            'env': 'environment',
            'config': 'configuration',
            'auth': 'authentication authorization',
            'admin': 'administrator administration',
            'doc': 'document documentation'
        };

        const normalized = query.toLowerCase().trim();
        const terms = normalized.split(/\s+/).filter(t => t.length > 2);

        // Expand abbreviations
        const expandedTerms = terms.map(term => abbreviations[term] || term);
        const expanded = expandedTerms.join(' ');

        return { original: query, normalized, expanded, terms: expandedTerms };
    }

    /**
     * Classify query type for routing
     * @param {string} query - User query
     * @returns {string} - Query type
     */
    classifyQuery(query) {
        const q = query.toLowerCase();

        if (/\b(status|state|progress|estado)\b/i.test(q)) return 'status';
        if (/^(list|show|get|what are|quais são)\b/i.test(q)) return 'list';
        if (/\b(who|quem|person|people|contact|team)\b/i.test(q)) return 'person';
        if (/\b(how many|count|total|quantos)\b/i.test(q)) return 'count';
        if (/\b(compare|difference|versus|vs)\b/i.test(q)) return 'comparison';
        if (/^(what|when|where|why|how|o que|quando|onde)\b/i.test(q)) return 'factual';

        return 'general';
    }

    /**
     * Calculate keyword relevance score (BM25-style)
     * @param {string} query - Search query
     * @param {string} text - Text to score
     * @returns {number} - Score between 0 and 1
     */
    keywordScore(query, text) {
        if (!query || !text) return 0;

        const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        if (queryTerms.length === 0) return 0;

        const textLower = text.toLowerCase();
        let matchedTerms = 0;
        let phraseBoost = 0;

        // Check for phrase match (all terms in order)
        if (textLower.includes(query.toLowerCase())) {
            phraseBoost = 0.3;
        }

        // Count matched terms
        for (const term of queryTerms) {
            if (textLower.includes(term)) matchedTerms++;
        }

        const termScore = matchedTerms / queryTerms.length;
        return Math.min(1, termScore + phraseBoost);
    }

    /**
     * Get all items formatted for embedding/search
     * @returns {Array} - [{id, type, text, data}]
     */
    getAllItemsForEmbedding() {
        const items = [];

        (this._cache.facts || []).forEach(f => {
            items.push({ id: `fact_${f.id}`, type: 'fact', text: `[${f.category || 'general'}] ${f.content}`, data: f });
        });

        (this._cache.decisions || []).forEach(d => {
            items.push({ id: `decision_${d.id}`, type: 'decision', text: d.content, data: d });
        });

        (this._cache.risks || []).forEach(r => {
            items.push({ id: `risk_${r.id}`, type: 'risk', text: `Risk: ${r.content}`, data: r });
        });

        (this._cache.questions || []).forEach(q => {
            let text = `Question: ${q.content}`;
            if (q.answer) text += ` Answer: ${q.answer}`;
            items.push({ id: `question_${q.id}`, type: 'question', text, data: q });
        });

        (this._cache.people || []).forEach(p => {
            items.push({ id: `person_${p.id}`, type: 'person', text: `${p.name} - ${p.role || 'unknown role'}`, data: p });
        });

        (this._cache.actions || []).forEach((a) => {
            const title = (a.task || a.content || '').trim();
            const desc = (a.description || '').trim();
            const status = (a.status || 'pending').toLowerCase();
            const priority = (a.priority || 'medium').toLowerCase();
            const due = (a.due_date || a.deadline || '').toString();
            const text = `[Task] ${title} - ${desc}. Status: ${status}, Priority: ${priority}. Due: ${due}`.trim();
            items.push({ id: `action_item_${a.id}`, type: 'action_item', text: text || `Task ${a.id}`, data: a });
        });

        return items;
    }

    /**
     * Get items with enhanced metadata
     * @param {Array} ids - Item IDs to retrieve
     * @returns {Array}
     */
    getItemsWithMetadata(ids) {
        const items = this.getAllItemsForEmbedding().filter(item => ids.includes(item.id));

        return items.map(item => {
            const enhanced = { ...item };
            if (item.data?.source_file) enhanced.source = item.data.source_file;
            if (item.data?.created_at) enhanced.date = item.data.created_at.split('T')[0];
            if (item.type === 'fact' && item.data?.category) enhanced.category = item.data.category;
            if (item.type === 'question' && item.data?.priority) enhanced.priority = item.data.priority;
            if (item.type === 'risk' && item.data?.impact) enhanced.impact = item.data.impact;
            return enhanced;
        });
    }

    /**
     * Load embeddings - returns null for Supabase mode (use searchBySimilarity instead)
     * For compatibility with legacy code that expects this method
     * @returns {object|null}
     */
    loadEmbeddings() {
        // In Supabase mode, embeddings are stored in DB and searched via match_embeddings RPC
        // Return a stub that indicates RAG should use Supabase vector search
        if (this._isSupabaseMode && this._supabase) {
            return {
                version: 'supabase',
                generated_at: new Date().toISOString(),
                model: 'supabase_vectors',
                count: -1, // Indicates Supabase mode
                embeddings: [], // Empty - use searchBySimilarity instead
                isSupabaseMode: true
            };
        }
        return null;
    }

    /**
     * Save embeddings - in Supabase mode, use upsertEmbedding for each item
     * @param {Array} embeddings - Array of embedding objects
     * @returns {object}
     */
    async saveEmbeddings(embeddings) {
        if (this._isSupabaseMode && this._supabase && typeof this._supabase.upsertEmbedding === 'function') {
            let count = 0;
            for (const item of embeddings || []) {
                if (!item.embedding || !Array.isArray(item.embedding)) continue;
                const entityType = item.type || (item.id && item.id.split('_')[0]);
                const entityId = item.id && entityType ? item.id.slice(String(entityType).length + 1) : item.id;
                if (!entityId) continue;
                try {
                    await this._supabase.upsertEmbedding(entityType, entityId, item.text || '', item.embedding);
                    count++;
                } catch (err) {
                    log.warn({ event: 'save_embedding_item_error', entityType, entityId, reason: err.message }, 'upsertEmbedding item failed');
                }
            }
            log.debug({ event: 'save_embeddings_supabase', count }, 'saveEmbeddings: upserted to Supabase');
            return { version: 'supabase', count };
        }
        return { version: 'local', count: (embeddings || []).length };
    }

    /**
     * Invalidate embeddings cache
     */
    invalidateRAGCache() {
        // In Supabase mode, there's no local cache to invalidate
        log.debug({ event: 'rag_cache_invalidated' }, 'RAG cache invalidated (Supabase mode uses DB)');
    }

    /**
     * Get embedding status
     * @returns {object}
     */
    async getEmbeddingStatus() {
        if (this._isSupabaseMode && this._supabase && this.currentProjectId) {
            try {
                const { count, error } = await this._supabase.supabase
                    .from('embeddings')
                    .select('*', { count: 'exact', head: true })
                    .eq('project_id', this.currentProjectId);

                const embeddingCount = error ? 0 : (count ?? 0);
                return {
                    indexed: embeddingCount > 0,
                    count: embeddingCount,
                    total: this.getAllItemsForEmbedding().length,
                    model: 'supabase_vectors',
                    generated_at: new Date().toISOString(),
                    isSupabaseMode: true
                };
            } catch (e) {
                log.warn({ event: 'get_embedding_status_error', reason: e.message }, 'getEmbeddingStatus error');
            }
        }
        return { indexed: false, count: 0, total: this.getAllItemsForEmbedding().length, model: null };
    }

    /**
     * Hybrid search combining semantic (Supabase vector) and keyword scores
     * @param {string} query - Search query
     * @param {Array} semanticResults - Pre-computed semantic results (optional, for legacy compatibility)
     * @param {object} options - {semanticWeight, keywordWeight, minScore, limit}
     * @returns {Array} - Combined and ranked results
     */
    hybridSearch(query, semanticResults = [], options = {}) {
        const {
            semanticWeight = 0.6,
            keywordWeight = 0.4,
            minScore = 0.15,
            limit = 15
        } = options;

        const allItems = this.getAllItemsForEmbedding();
        const itemMap = new Map(allItems.map(item => [item.id, item]));

        // Create map for semantic scores (from pre-computed results or empty)
        const semanticScores = new Map(
            semanticResults.map(r => [r.id, r.similarity])
        );

        // Calculate hybrid scores
        const scoredItems = allItems.map(item => {
            const semScore = semanticScores.get(item.id) || 0;
            const kwScore = this.keywordScore(query, item.text);
            const hybridScore = (semScore * semanticWeight) + (kwScore * keywordWeight);
            const agreementBoost = (semScore > 0.4 && kwScore > 0.3) ? 0.1 : 0;

            return {
                id: item.id,
                type: item.type,
                text: item.text,
                data: item.data,
                semanticScore: semScore,
                keywordScore: kwScore,
                score: Math.min(1, hybridScore + agreementBoost)
            };
        });

        return scoredItems
            .filter(item => item.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Supabase-native vector search with optional hybrid ranking
     * @param {string} query - Search query
     * @param {Array} queryEmbedding - Query embedding vector
     * @param {object} options - {limit, threshold, entityTypes, useHybrid}
     * @returns {Promise<Array>}
     */
    async searchWithEmbedding(query, queryEmbedding, options = {}) {
        const { limit = 15, threshold = 0.5, entityTypes = null, useHybrid = true } = options;

        if (!this._isSupabaseMode || !this._supabase) {
            log.warn({ event: 'search_embedding_requires_supabase' }, 'searchWithEmbedding requires Supabase mode');
            return [];
        }

        try {
            // Get semantic results from Supabase
            const semanticResults = await this._supabase.searchBySimilarity(
                queryEmbedding,
                entityTypes,
                limit * 2, // Get more for hybrid re-ranking
                threshold
            );

            if (!useHybrid) {
                // Return semantic results directly
                return semanticResults.map(r => ({
                    id: `${r.entity_type}_${r.entity_id}`,
                    type: r.entity_type,
                    text: r.content,
                    similarity: r.similarity,
                    score: r.similarity,
                    source: 'semantic'
                }));
            }

            // Convert to format for hybrid search
            const semanticForHybrid = semanticResults.map(r => ({
                id: `${r.entity_type}_${r.entity_id}`,
                similarity: r.similarity
            }));

            // Run hybrid search
            const hybridResults = this.hybridSearch(query, semanticForHybrid, {
                semanticWeight: 0.6,
                keywordWeight: 0.4,
                minScore: 0.15,
                limit
            });

            return hybridResults;
        } catch (e) {
            log.warn({ event: 'search_with_embedding_error', reason: e.message }, 'searchWithEmbedding error');
            // Fallback to keyword-only
            return this.hybridSearch(query, [], { semanticWeight: 0, keywordWeight: 1, limit });
        }
    }

    /**
     * Reset project knowledge data. Preserves team, contacts, and cost.
     * In Supabase mode: calls resetProjectData() then refreshes cache.
     * In Legacy mode: delegates to Legacy Storage reset (which preserves contacts/cost).
     */
    async reset() {
        if (this._isSupabaseMode && this._supabase) {
            const result = await this._supabase.resetProjectData();
            if (!result.success) {
                throw new Error(result.error || 'Reset failed');
            }
            this._cache = {
                facts: [],
                decisions: [],
                risks: [],
                actions: [],
                questions: [],
                people: [],
                relationships: [],
                documents: [],
                contacts: this._cache.contacts || [],
                conversations: [],
                config: this._cache.config
            };
            this.knowledge = { facts: [], decisions: [], risks: [], people: [], relationships: [], change_log: [] };
            this.questions = { items: [] };
            this.documents = { items: [] };
            this.conversations = { items: [] };
            if (this.currentProjectId) {
                await this._refreshCache();
            }
            return;
        }
        const LegacyStorage = require('./storage');
        const legacy = new LegacyStorage(this.dataDir);
        legacy.loadProjects();
        if (this.currentProjectId) {
            legacy.switchProject(this.currentProjectId);
        }
        legacy.reset();
    }

    /**
     * Close storage connection
     */
    close() {
        if (this._isSupabaseMode && this._supabase && typeof this._supabase.close === 'function') {
            try {
                this._supabase.close();
            } catch (e) {
                log.warn({ event: 'storage_close_error', err: e.message }, 'Error closing supabase storage');
            }
        }
    }
}

/**
 * Create a compatible storage instance
 * Falls back to local JSON storage if Supabase is not available
 */
async function createCompatStorage(dataDir) {
    let supabaseStorage = null;

    try {
        // Try to initialize Supabase storage
        if (supabaseHelper && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
            if (!supabaseHelper.isStorageInitialized()) {
                supabaseHelper.initStorage({
                    filesBasePath: path.join(dataDir, 'projects')
                });
            }
            supabaseStorage = supabaseHelper.getStorage();
            log.info({ event: 'storage_using_supabase' }, 'Using Supabase storage');
        }
    } catch (e) {
        log.warn({ event: 'storage_supabase_unavailable', err: e.message }, 'Supabase not available');
    }

    const compat = new StorageCompat(dataDir, supabaseStorage);
    await compat.init();

    return compat;
}

/**
 * Create sync-style storage (for backward compatibility during migration)
 * Note: This uses sync cache and may have stale data
 */
function createSyncCompatStorage(dataDir) {
    let supabaseStorage = null;

    try {
        if (supabaseHelper && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
            if (!supabaseHelper.isStorageInitialized()) {
                supabaseHelper.initStorage({
                    filesBasePath: path.join(dataDir, 'projects')
                });
            }
            supabaseStorage = supabaseHelper.getStorage();
        }
    } catch (e) {
        // Ignore - will use local storage fallback
    }

    return new StorageCompat(dataDir, supabaseStorage);
}

module.exports = {
    StorageCompat,
    createCompatStorage,
    createSyncCompatStorage
};
