/**
 * JSON-Only Storage Module with Multi-Project Support
 * Single source of truth: JSON files per project
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { logger } = require('./logger');

const log = logger.child({ module: 'storage' });

class Storage {
    constructor(dataDir) {
        this.dataDir = dataDir;

        // Project management paths (global)
        this.projectsPath = path.join(dataDir, 'projects.json');
        this.configPath = path.join(dataDir, 'config.json');

        // Current project context
        this.currentProjectId = null;
        this.projectsData = null;

        // In-memory data for current project
        this.knowledge = null;
        this.questions = null;
        this.documents = null;
        this.history = null;

        // Embeddings cache for performance
        this._embeddingsCache = null;
        this._embeddingsCacheTime = null;
        this._embeddingsCacheTTL = 5 * 60 * 1000; // 5 minutes

        // Deduplication threshold (0.90 = only 90%+ similar facts are duplicates)
        // Higher value = more facts preserved, less aggressive deduplication
        this.similarityThreshold = 0.90;

        // Stats history for trend calculation
        this.statsHistory = null;
    }

    // ==================== Project Management ====================

    /**
     * Generate a unique project ID
     */
    generateProjectId() {
        return crypto.randomBytes(4).toString('hex');
    }

    /**
     * Get the directory path for a project
     */
    getProjectDir(projectId) {
        return path.join(this.dataDir, 'projects', projectId);
    }

    /**
     * Load projects metadata
     */
    loadProjects() {
        if (fs.existsSync(this.projectsPath)) {
            try {
                this.projectsData = JSON.parse(fs.readFileSync(this.projectsPath, 'utf8'));
            } catch (e) {
                log.warn({ event: 'storage_load_projects_error', reason: e.message }, 'Error loading projects');
                this.projectsData = null;
            }
        }

        if (!this.projectsData) {
            this.projectsData = {
                version: '1.0',
                current: null,
                projects: [],
                updated_at: new Date().toISOString()
            };
        }

        return this.projectsData;
    }

    /**
     * Save projects metadata
     */
    saveProjects() {
        this.projectsData.updated_at = new Date().toISOString();
        fs.writeFileSync(this.projectsPath, JSON.stringify(this.projectsData, null, 2));
    }

    /**
     * Create a new project
     * @param {string} name - Project name
     * @returns {object} - Created project
     */
    createProject(name, userRole = '') {
        if (!name || name.trim().length === 0) {
            throw new Error('Project name is required');
        }

        const id = this.generateProjectId();
        const projectDir = this.getProjectDir(id);

        // Create project directory structure
        fs.mkdirSync(projectDir, { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'archived', 'documents'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'archived', 'meetings'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'newinfo'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'newtranscripts'), { recursive: true });

        const project = {
            id,
            name: name.trim(),
            userRole: userRole || '',
            created_at: new Date().toISOString(),
            last_accessed: new Date().toISOString()
        };

        this.projectsData.projects.push(project);

        // If this is the first project, make it current
        if (this.projectsData.projects.length === 1) {
            this.projectsData.current = id;
        }

        this.saveProjects();

        log.debug({ event: 'storage_project_created', name, id }, 'Project created');
        return project;
    }

    /**
     * List all projects
     * @returns {Array} - List of projects with stats
     */
    listProjects() {
        const defaultProjectId = this.getDefaultProjectId();
        const projects = this.projectsData.projects.map(p => {
            const stats = this.getProjectStats(p.id);
            return {
                ...p,
                isCurrent: p.id === this.currentProjectId,
                isDefault: p.id === defaultProjectId,
                graphName: `godmode_${p.id}`, // Show associated graph name
                stats
            };
        });

        // Sort by last_accessed (most recent first)
        projects.sort((a, b) => new Date(b.last_accessed) - new Date(a.last_accessed));

        return projects;
    }

    /**
     * Get all projects (simple list without stats)
     * @returns {Array} - List of project objects
     */
    getProjects() {
        return this.projectsData.projects || [];
    }

    /**
     * Get the default project ID
     * @returns {string|null} - Default project ID
     */
    getDefaultProjectId() {
        return this.projectsData.defaultProjectId || this.projectsData.projects[0]?.id || null;
    }

    /**
     * Set a project as the default
     * @param {string} projectId - Project ID to set as default
     */
    setDefaultProject(projectId) {
        const project = this.projectsData.projects.find(p => p.id === projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }

        this.projectsData.defaultProjectId = projectId;
        this.saveProjects();
        log.debug({ event: 'storage_default_project', projectName: project.name, projectId }, 'Default project set');
    }

    /**
     * Get basic stats for a project without loading all data
     */
    getProjectStats(projectId) {
        const projectDir = this.getProjectDir(projectId);
        const knowledgePath = path.join(projectDir, 'knowledge.json');
        const questionsPath = path.join(projectDir, 'questions.json');
        const documentsPath = path.join(projectDir, 'documents.json');

        let facts = 0, questions = 0, documents = 0, decisions = 0, risks = 0, actions = 0, people = 0;

        try {
            if (fs.existsSync(knowledgePath)) {
                const data = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));
                facts = data.facts?.length || 0;
                decisions = data.decisions?.length || 0;
                risks = data.risks?.length || 0;
                actions = data.action_items?.length || 0;
                people = data.people?.length || 0;
            }
            if (fs.existsSync(questionsPath)) {
                const data = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
                questions = data.items?.length || 0;
            }
            if (fs.existsSync(documentsPath)) {
                const data = JSON.parse(fs.readFileSync(documentsPath, 'utf8'));
                documents = data.items?.length || 0;
            }
        } catch (e) {
            // Ignore errors, return zeros
        }

        return { facts, questions, documents, decisions, risks, actions, people };
    }

    /**
     * Switch to a different project
     * @param {string} projectId - Project ID to switch to
     * @returns {object} - Project that was switched to
     */
    switchProject(projectId) {
        const project = this.projectsData.projects.find(p => p.id === projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }

        // Update last_accessed
        project.last_accessed = new Date().toISOString();
        this.projectsData.current = projectId;
        this.saveProjects();

        // Clear caches
        this.invalidateRAGCache();

        // Load the project data
        this.currentProjectId = projectId;
        this.loadProjectData();

        log.debug({ event: 'storage_switched_project', projectName: project.name, projectId }, 'Switched to project');
        return project;
    }

    /**
     * Get the current project
     * @returns {object|null} - Current project or null
     */
    getCurrentProject() {
        if (!this.currentProjectId) return null;
        return this.projectsData.projects.find(p => p.id === this.currentProjectId) || null;
    }

    /**
     * Delete a project and all its data
     * @param {string} projectId - Project ID to delete
     * @returns {boolean} - Success
     */
    deleteProject(projectId) {
        const projectIndex = this.projectsData.projects.findIndex(p => p.id === projectId);
        if (projectIndex === -1) {
            throw new Error(`Project not found: ${projectId}`);
        }

        const project = this.projectsData.projects[projectIndex];
        const projectDir = this.getProjectDir(projectId);

        // Delete project directory recursively
        if (fs.existsSync(projectDir)) {
            fs.rmSync(projectDir, { recursive: true, force: true });
        }

        // Remove from projects list
        this.projectsData.projects.splice(projectIndex, 1);

        // If we deleted the current project, switch to another or null
        if (this.projectsData.current === projectId) {
            if (this.projectsData.projects.length > 0) {
                // Switch to most recently accessed project
                const sorted = [...this.projectsData.projects].sort(
                    (a, b) => new Date(b.last_accessed) - new Date(a.last_accessed)
                );
                this.projectsData.current = sorted[0].id;
                this.currentProjectId = sorted[0].id;
                this.loadProjectData();
            } else {
                this.projectsData.current = null;
                this.currentProjectId = null;
                this.knowledge = null;
                this.questions = null;
                this.documents = null;
                this.history = null;
            }
        }

        this.saveProjects();
        log.debug({ event: 'storage_project_deleted', projectName: project.name, projectId }, 'Project deleted');
        return true;
    }

    /**
     * Rename a project
     * @param {string} projectId - Project ID
     * @param {string} newName - New name
     */
    renameProject(projectId, newName) {
        const project = this.projectsData.projects.find(p => p.id === projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }

        project.name = newName.trim();
        this.saveProjects();
        return project;
    }

    /**
     * Update project properties
     * @param {string} projectId - Project ID
     * @param {object} updates - Object with properties to update (name, userRole)
     * @returns {object|null} - Updated project or null if not found
     */
    updateProject(projectId, updates) {
        const project = this.projectsData.projects.find(p => p.id === projectId);
        if (!project) {
            return null;
        }

        // Apply updates
        if (updates.name !== undefined) {
            project.name = updates.name;
        }
        if (updates.userRole !== undefined) {
            project.userRole = updates.userRole;
        }
        if (updates.userRolePrompt !== undefined) {
            project.userRolePrompt = updates.userRolePrompt;
        }

        this.saveProjects();
        return project;
    }

    // ==================== Initialization ====================

    /**
     * Initialize storage - handles migration from single-project to multi-project
     */
    init() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        // Load or create projects metadata
        this.loadProjects();

        // Check if we need to migrate from legacy single-project structure
        const needsMigration = this.checkNeedsMigration();

        if (needsMigration) {
            this.migrateToMultiProject();
        }

        // If no projects exist, create a default one
        if (this.projectsData.projects.length === 0) {
            this.createProject('Default Project');
        }

        // Set current project
        if (!this.projectsData.current) {
            this.projectsData.current = this.projectsData.projects[0].id;
            this.saveProjects();
        }

        this.currentProjectId = this.projectsData.current;
        this.loadProjectData();

        // Auto-normalize categories on startup
        this.normalizeAllCategories();

        // Migrate: generate history from existing documents if no history exists
        this.migrateHistoryFromDocuments();

        // Migrate: ensure all question assignees exist in People list
        this.migrateQuestionAssigneesToPeople();

        const project = this.getCurrentProject();
        log.debug({ event: 'storage_initialized', projectName: project?.name, facts: this.knowledge.facts.length, questions: this.questions.items.length, documents: this.documents.items.length }, 'Storage initialized');
    }

    /**
     * Check if migration from single-project to multi-project is needed
     */
    checkNeedsMigration() {
        // Check for legacy files in root data directory
        const legacyKnowledgePath = path.join(this.dataDir, 'knowledge.json');
        const legacyQuestionsPath = path.join(this.dataDir, 'questions.json');

        // If legacy files exist and no projects exist, we need to migrate
        const hasLegacyFiles = fs.existsSync(legacyKnowledgePath) || fs.existsSync(legacyQuestionsPath);
        const hasProjects = this.projectsData.projects.length > 0;

        return hasLegacyFiles && !hasProjects;
    }

    /**
     * Migrate legacy single-project data to multi-project structure
     */
    migrateToMultiProject() {
        log.debug({ event: 'storage_migration_start' }, 'Migrating from single-project to multi-project structure');

        // Create the default project
        const project = this.createProject('Default Project');
        const projectDir = this.getProjectDir(project.id);

        // List of files to migrate
        const filesToMigrate = [
            'knowledge.json',
            'questions.json',
            'documents.json',
            'embeddings.json',
            'history.json'
        ];

        // Move files to project directory
        for (const filename of filesToMigrate) {
            const oldPath = path.join(this.dataDir, filename);
            const newPath = path.join(projectDir, filename);

            if (fs.existsSync(oldPath)) {
                fs.copyFileSync(oldPath, newPath);
                fs.unlinkSync(oldPath);
                log.debug({ event: 'storage_migrated_file', filename }, 'Migrated');
            }
        }

        // Move archived folders
        const archivedDocs = path.join(this.dataDir, 'archived', 'documents');
        const archivedMeetings = path.join(this.dataDir, 'archived', 'meetings');

        if (fs.existsSync(archivedDocs)) {
            const destDocs = path.join(projectDir, 'archived', 'documents');
            this.copyDirRecursive(archivedDocs, destDocs);
            fs.rmSync(archivedDocs, { recursive: true, force: true });
        }

        if (fs.existsSync(archivedMeetings)) {
            const destMeetings = path.join(projectDir, 'archived', 'meetings');
            this.copyDirRecursive(archivedMeetings, destMeetings);
            fs.rmSync(archivedMeetings, { recursive: true, force: true });
        }

        // Move newinfo and newtranscripts folders
        const newinfo = path.join(this.dataDir, 'newinfo');
        const newtranscripts = path.join(this.dataDir, 'newtranscripts');

        if (fs.existsSync(newinfo)) {
            this.copyDirRecursive(newinfo, path.join(projectDir, 'newinfo'));
            fs.rmSync(newinfo, { recursive: true, force: true });
        }

        if (fs.existsSync(newtranscripts)) {
            this.copyDirRecursive(newtranscripts, path.join(projectDir, 'newtranscripts'));
            fs.rmSync(newtranscripts, { recursive: true, force: true });
        }

        // Clean up empty archived folder
        const archivedRoot = path.join(this.dataDir, 'archived');
        if (fs.existsSync(archivedRoot)) {
            try {
                fs.rmdirSync(archivedRoot);
            } catch (e) {
                // Not empty, leave it
            }
        }

        log.debug({ event: 'storage_migration_complete' }, 'Migration complete');
    }
    // ==================== Analytics & Dashboard ====================

    getStats() {
        if (!this.currentProjectId) return {};
        const stats = this.getProjectStats(this.currentProjectId);
        return stats;
    }

    getStatsHistory(days = 30) {
        if (!this.statsHistory) {
            this.loadStatsHistory();
        }
        return this.statsHistory.slice(-days);
    }

    loadStatsHistory() {
        if (fs.existsSync(this.statsHistoryPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.statsHistoryPath, 'utf8'));
                this.statsHistory = data.history || [];
            } catch (e) {
                this.statsHistory = [];
            }
        } else {
            this.statsHistory = [];
        }
    }

    getTrends(days = 7) {
        // Calculate trends based on history or snapshots
        // For now, return a placeholder or simple calculation
        return [
            { metric: 'facts', trend: '+0', up: true },
            { metric: 'actions', trend: '+0', up: true },
            { metric: 'risks', trend: '0', up: false }
        ];
    }

    getTrendInsights() {
        return [];
    }

    getWeeklyActivity() {
        const activity = {
            Mon: { facts: 0, actions: 0, questions: 0 },
            Tue: { facts: 0, actions: 0, questions: 0 },
            Wed: { facts: 0, actions: 0, questions: 0 },
            Thu: { facts: 0, actions: 0, questions: 0 },
            Fri: { facts: 0, actions: 0, questions: 0 },
            Sat: { facts: 0, actions: 0, questions: 0 },
            Sun: { facts: 0, actions: 0, questions: 0 }
        };

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Helper to check date range and increment
        const processItems = (items, type) => {
            items.forEach(item => {
                const date = item.created_at ? new Date(item.created_at) : (item.date ? new Date(item.date) : null);
                if (date && date >= oneWeekAgo && date <= now) {
                    const dayName = days[date.getDay()];
                    if (activity[dayName]) {
                        activity[dayName][type]++;
                    }
                }
            });
        };

        if (this.knowledge) {
            processItems(this.knowledge.facts || [], 'facts');
            processItems(this.knowledge.action_items || [], 'actions');
        }
        if (this.questions) {
            processItems(this.questions.items || [], 'questions');
        }

        // Convert to array format for Recharts
        return Object.entries(activity).map(([day, counts]) => ({
            day,
            ...counts
        }));
    }

    getRecentActivity(limit = 10) {
        const events = [];

        // Add Facts
        if (this.knowledge && this.knowledge.facts) {
            this.knowledge.facts.forEach(f => {
                events.push({
                    id: f.id || `fact-${Math.random()}`,
                    type: 'fact',
                    action: 'Captured Fact',
                    description: f.content?.substring(0, 50) + (f.content?.length > 50 ? '...' : ''),
                    timestamp: f.created_at || new Date().toISOString(),
                    status: 'success'
                });
            });
        }

        // Add Actions
        if (this.knowledge && this.knowledge.action_items) {
            this.knowledge.action_items.forEach(a => {
                events.push({
                    id: a.id || `action-${Math.random()}`,
                    type: 'action',
                    action: 'Created Action',
                    description: a.title,
                    timestamp: a.created_at || new Date().toISOString(),
                    status: 'warning' // Just a visual indicator
                });
            });
        }

        // Add Questions
        if (this.questions && this.questions.items) {
            this.questions.items.forEach(q => {
                events.push({
                    id: q.id || `question-${Math.random()}`,
                    type: 'question',
                    action: 'Raised Question',
                    description: q.text?.substring(0, 50) + (q.text?.length > 50 ? '...' : ''),
                    timestamp: q.created_at || new Date().toISOString(),
                    status: 'error' // Visual indicator for question (often yellow/red)
                });
            });
        }

        // Add File Processed Logs
        if (this.history && this.history.file_logs) {
            this.history.file_logs.forEach(l => {
                events.push({
                    id: l.id || `log-${Math.random()}`,
                    type: 'file',
                    action: 'Processed File',
                    description: l.filename,
                    timestamp: l.timestamp,
                    status: l.status === 'success' ? 'success' : 'error',
                    duration: l.processing_time_ms ? `${Math.round(l.processing_time_ms / 1000)}s` : null,
                    factsFound: l.facts_extracted
                });
            });
        }

        // Sort by timestamp desc
        events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return events.slice(0, limit);
    }

    /**
     * Helper to copy directory recursively
     */
    copyDirRecursive(src, dest) {
        if (!fs.existsSync(src)) return;

        fs.mkdirSync(dest, { recursive: true });

        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                this.copyDirRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    /**
     * Load data for the current project
     */
    loadProjectData() {
        if (!this.currentProjectId) {
            log.warn({ event: 'storage_no_current_project' }, 'No current project set');
            return;
        }

        const projectDir = this.getProjectDir(this.currentProjectId);

        // Update file paths for current project
        this.knowledgePath = path.join(projectDir, 'knowledge.json');
        this.questionsPath = path.join(projectDir, 'questions.json');
        this.documentsPath = path.join(projectDir, 'documents.json');
        this.conversationsPath = path.join(projectDir, 'conversations.json');
        this.contactsPath = path.join(projectDir, 'contacts.json');
        this.embeddingsPath = path.join(projectDir, 'embeddings.json');
        this.historyPath = path.join(projectDir, 'history.json');
        this.statsHistoryPath = path.join(projectDir, 'stats_history.json');

        this.loadAll();
        this.loadStatsHistory();
    }

    /**
     * Get the data directory for the current project
     * Used by processor for archived folders, newinfo, etc.
     */
    getProjectDataDir() {
        if (!this.currentProjectId) {
            return this.dataDir; // Fallback for backward compatibility
        }
        return this.getProjectDir(this.currentProjectId);
    }

    migrateHistoryFromDocuments() {
        // Always sync file_logs with documents
        let synced = 0;

        for (const doc of this.documents.items) {
            if (doc.status === 'processed') {
                // Check if this document already has a file_log
                const existingLog = this.history.file_logs.find(l => l.document_id === doc.id);

                if (!existingLog) {
                    this.history.file_logs.push({
                        id: doc.id,
                        timestamp: doc.processed_at || doc.created_at || new Date().toISOString(),
                        document_id: doc.id,
                        filename: doc.name || doc.filename,
                        method: doc.extraction_method || 'text',
                        chunks_processed: 0,
                        pages_processed: 0,
                        facts_extracted: 0,
                        questions_extracted: 0,
                        decisions_extracted: 0,
                        risks_extracted: 0,
                        actions_extracted: 0,
                        people_extracted: 0,
                        processing_time_ms: 0,
                        status: 'success',
                        error_message: null
                    });
                    synced++;
                }
            }
        }

        // Create initial session if needed
        if (this.documents.items.length > 0 && this.history.sessions.length === 0) {
            this.history.sessions.push({
                id: Date.now(),
                timestamp: new Date().toISOString(),
                action: 'migrated_from_existing',
                files_processed: this.documents.items.filter(d => d.status === 'processed').length,
                facts_extracted: this.knowledge.facts.length,
                questions_added: this.questions.items.length,
                decisions_extracted: this.knowledge.decisions.length,
                errors: 0
            });
        }

        if (synced > 0) {
            this.saveHistory();
            log.debug({ event: 'storage_synced_file_logs', synced }, 'Synced missing file logs from documents');
        }
    }

    migrateQuestionAssigneesToPeople() {
        // Ensure all question assignees exist in the People list
        const existingPeopleNames = new Set(
            this.knowledge.people.map(p => p.name?.toLowerCase().trim())
        );

        let added = 0;
        const assigneesToAdd = new Set();

        // Collect unique assignees not in People list
        for (const q of this.questions.items) {
            if (q.assigned_to) {
                const assigneeName = q.assigned_to.trim();
                const normalizedName = assigneeName.toLowerCase();
                if (!existingPeopleNames.has(normalizedName) && !assigneesToAdd.has(normalizedName)) {
                    assigneesToAdd.add(normalizedName);
                    // Add to People list with unique ID
                    this.knowledge.people.push({
                        id: Date.now().toString() + Math.random().toString(36).substring(2, 8),
                        name: assigneeName,
                        role: null,
                        organization: null,
                        source: 'question_assignee',
                        created_at: new Date().toISOString()
                    });
                    added++;
                    log.debug({ event: 'storage_migrated_assignee', assigneeName }, 'Migrated question assignee to People');
                }
            }
        }

        if (added > 0) {
            this.saveKnowledge();
            log.debug({ event: 'storage_migrated_assignees', added }, 'Migrated question assignees to People list');
        }
    }

    loadAll() {
        this.knowledge = this._loadJSON(this.knowledgePath, {
            version: '2.0',
            facts: [],
            decisions: [],
            risks: [],
            people: [],
            relationships: [], // For org chart: {from, to, type, context}
            action_items: [],
            change_log: [], // Version tracking: {timestamp, action, type, id, summary}
            updated_at: new Date().toISOString()
        });

        // Ensure relationships array exists (migration for existing data)
        if (!this.knowledge.relationships) {
            this.knowledge.relationships = [];
        }

        // Ensure change_log array exists (migration for existing data)
        if (!this.knowledge.change_log) {
            this.knowledge.change_log = [];
        }

        this.questions = this._loadJSON(this.questionsPath, {
            version: '2.0',
            items: [],
            updated_at: new Date().toISOString()
        });

        this.documents = this._loadJSON(this.documentsPath, {
            version: '2.0',
            items: [],
            updated_at: new Date().toISOString()
        });

        this.conversations = this._loadJSON(this.conversationsPath, {
            version: '1.0',
            items: [],
            updated_at: new Date().toISOString()
        });

        this.contacts = this._loadJSON(this.contactsPath, {
            version: '1.0',
            items: [],
            updated_at: new Date().toISOString()
        });

        this.history = this._loadJSON(this.historyPath, {
            version: '2.0',
            sessions: [],
            file_logs: [],
            updated_at: new Date().toISOString()
        });
    }

    _loadJSON(filePath, defaultValue) {
        if (fs.existsSync(filePath)) {
            try {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch (e) {
                log.warn({ event: 'storage_load_file_error', filePath, reason: e.message }, 'Error loading file');
            }
        }
        return defaultValue;
    }

    _saveJSON(filePath, data) {
        data.updated_at = new Date().toISOString();
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    saveKnowledge() {
        this._saveJSON(this.knowledgePath, this.knowledge);
    }

    saveQuestions() {
        this._saveJSON(this.questionsPath, this.questions);
    }

    saveDocuments() {
        this._saveJSON(this.documentsPath, this.documents);
    }

    saveConversations() {
        this._saveJSON(this.conversationsPath, this.conversations);
    }

    saveContacts() {
        this._saveJSON(this.contactsPath, this.contacts);
    }

    saveAll() {
        this.saveKnowledge();
        this.saveQuestions();
        this.saveDocuments();
        this.saveConversations();
        this.saveContacts();
    }

    // ==================== Text Similarity ====================

    normalizeText(text) {
        if (!text) return '';
        return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    stemWord(word) {
        if (word.length < 4) return word;
        if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
        if (word.endsWith('es')) return word.slice(0, -2);
        if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
        if (word.endsWith('ing')) return word.slice(0, -3);
        if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
        return word;
    }

    textSimilarity(text1, text2) {
        const norm1 = this.normalizeText(text1);
        const norm2 = this.normalizeText(text2);
        if (norm1 === norm2) return 1.0;
        if (!norm1 || !norm2) return 0.0;

        const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'they', 'this', 'that', 'with', 'from', 'what', 'which', 'when', 'where', 'will', 'would', 'there', 'their']);

        const words1 = new Set(norm1.split(' ').filter(w => w.length > 2 && !stopWords.has(w)).map(w => this.stemWord(w)));
        const words2 = new Set(norm2.split(' ').filter(w => w.length > 2 && !stopWords.has(w)).map(w => this.stemWord(w)));

        if (words1.size === 0 || words2.size === 0) return 0.0;

        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);

        const jaccard = intersection.size / union.size;
        const smaller = words1.size <= words2.size ? words1 : words2;
        const containment = intersection.size / smaller.size;

        return Math.max(jaccard, containment * 0.9);
    }

    findDuplicate(newContent, existingItems, contentField = 'content') {
        if (!newContent || !existingItems || existingItems.length === 0) {
            return { isDuplicate: false, existingItem: null, similarity: 0 };
        }

        let bestMatch = null;
        let bestSimilarity = 0;

        for (const item of existingItems) {
            const similarity = this.textSimilarity(newContent, item[contentField]);
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = item;
            }
            if (similarity >= 0.99) break;
        }

        return {
            isDuplicate: bestSimilarity >= this.similarityThreshold,
            existingItem: bestSimilarity >= this.similarityThreshold ? bestMatch : null,
            similarity: bestSimilarity
        };
    }

    // ==================== Documents ====================

    /**
     * Calculate MD5 hash of a file for duplicate detection
     */
    calculateFileHash(filePath) {
        try {
            const crypto = require('crypto');
            const content = fs.readFileSync(filePath);
            return crypto.createHash('md5').update(content).digest('hex');
        } catch (e) {
            log.warn({ event: 'storage_hash_error', filePath, reason: e.message }, 'Could not calculate hash');
            return null;
        }
    }

    /**
     * Check if a document already exists (by hash, or fallback to name+size)
     * Hash is the most reliable method - catches same content with different names
     */
    checkDocumentExists(filename, fileSize, filePath = null) {
        // Method 1: Check by MD5 hash (most reliable)
        if (filePath) {
            const hash = this.calculateFileHash(filePath);
            if (hash) {
                const existingByHash = this.documents.items.find(d =>
                    d.content_hash === hash &&
                    d.status === 'processed'
                );
                if (existingByHash) {
                    log.debug({ event: 'storage_duplicate_hash', filename, existing: existingByHash.name || existingByHash.filename }, 'Found by hash');
                    return {
                        exists: true,
                        document: existingByHash,
                        method: 'hash',
                        hash: hash
                    };
                }
                // Return hash for storage even if not duplicate
                return this._checkByNameAndSize(filename, fileSize, hash);
            }
        }

        // Fallback: Check by filename and size
        return this._checkByNameAndSize(filename, fileSize, null);
    }

    _checkByNameAndSize(filename, fileSize, hash) {
        // Only consider documents that were successfully processed
        // Failed documents (status != 'processed') should be retried
        const existing = this.documents.items.find(d =>
            d.filename === filename &&
            d.file_size === fileSize &&
            d.status === 'processed'
        );

        if (existing) {
            log.debug({ event: 'storage_duplicate_name_size', filename }, 'Found by name+size');
        }

        return {
            exists: !!existing,
            document: existing || null,
            method: existing ? 'name_size' : null,
            hash: hash  // Pass hash for storage
        };
    }

    addDocument(doc) {
        const id = Date.now();

        // Calculate hash if path provided and not already included
        let contentHash = doc.content_hash || null;
        if (!contentHash && doc.path) {
            contentHash = this.calculateFileHash(doc.path);
        }

        const newDoc = {
            id,
            ...doc,
            content_hash: contentHash,
            processed_at: new Date().toISOString()
        };
        this.documents.items.push(newDoc);
        this.saveDocuments();

        // Also create a file_log entry for tracking
        const existingLog = this.history.file_logs.find(l => l.document_id === id);
        if (!existingLog) {
            this.history.file_logs.push({
                id: id,
                timestamp: newDoc.processed_at,
                document_id: id,
                filename: doc.name || doc.filename || 'Unknown',
                method: doc.extraction_method || 'text',
                chunks_processed: 0,
                pages_processed: 0,
                facts_extracted: 0,
                questions_extracted: 0,
                decisions_extracted: 0,
                risks_extracted: 0,
                actions_extracted: 0,
                people_extracted: 0,
                processing_time_ms: 0,
                status: doc.status === 'processed' ? 'success' : 'pending',
                error_message: null
            });
            this.saveHistory();
        }

        return id;
    }

    /**
     * Update file log with extraction results and AI metadata
     */
    updateFileLog(documentId, results) {
        const log = this.history.file_logs.find(l => l.document_id === documentId);
        if (log) {
            // Update extraction counts
            if (results.facts !== undefined) log.facts_extracted = results.facts;
            if (results.questions !== undefined) log.questions_extracted = results.questions;
            if (results.decisions !== undefined) log.decisions_extracted = results.decisions;
            if (results.risks !== undefined) log.risks_extracted = results.risks;
            if (results.actions !== undefined) log.actions_extracted = results.actions;
            if (results.people !== undefined) log.people_extracted = results.people;

            // Update AI metadata
            if (results.ai_title) log.ai_title = results.ai_title;
            if (results.ai_summary) log.ai_summary = results.ai_summary;

            log.status = 'success';
            this.saveHistory();
        }
    }

    updateDocumentStatus(id, status, archivedPath = null) {
        const doc = this.documents.items.find(d => d.id === id);
        if (doc) {
            doc.status = status;
            if (archivedPath) doc.archived_path = archivedPath;
            this.saveDocuments();
        }
    }

    getDocuments(status = null) {
        return status
            ? this.documents.items.filter(d => d.status === status)
            : this.documents.items;
    }

    /**
     * Get a document by ID
     */
    getDocumentById(id) {
        return this.documents.items.find(d => d.id === id);
    }

    /**
     * Delete a document and ALL related data (cascade delete)
     * This removes: document record, content file, related facts/decisions/risks/actions/people, 
     * file logs, embeddings, and graph nodes
     * 
     * @param {number} documentId - Document ID to delete
     * @param {object} options - Options: { softDelete: false, keepArchive: false }
     * @returns {object} - Results of deletion with counts
     */
    async deleteDocument(documentId, options = {}) {
        const { softDelete = false, keepArchive = false } = options;
        const results = {
            success: false,
            document: null,
            deleted: {
                facts: 0,
                decisions: 0,
                risks: 0,
                actions: 0,
                people: 0,
                questions: 0,
                fileLogs: 0,
                embeddings: 0,
                graphNodes: 0,
                contentFile: false,
                archivedFile: false
            },
            errors: []
        };

        try {
            // Find the document
            const doc = this.documents.items.find(d => d.id === documentId);
            if (!doc) {
                results.errors.push(`Document ${documentId} not found`);
                return results;
            }

            results.document = { id: doc.id, name: doc.name || doc.filename };
            const docName = (doc.name || doc.filename || '').replace(/\.[^/.]+$/, '').toLowerCase();

            log.debug({ event: 'storage_cascade_delete_start', docName: doc.name || doc.filename }, 'Starting cascade delete');

            // 1. Delete related facts
            const factsToDelete = this.knowledge.facts.filter(f => {
                const source = (f.source_file || f.meeting || '').toLowerCase();
                return source.includes(docName);
            });
            if (factsToDelete.length > 0) {
                const factIds = new Set(factsToDelete.map(f => f.id));
                this.knowledge.facts = this.knowledge.facts.filter(f => !factIds.has(f.id));
                results.deleted.facts = factsToDelete.length;
                log.debug({ event: 'storage_cascade_facts', count: factsToDelete.length }, 'Removed facts');
            }

            // 2. Delete related decisions
            const decisionsToDelete = this.knowledge.decisions.filter(d => {
                const source = (d.source_file || d.source || d.meeting || '').toLowerCase();
                return source.includes(docName);
            });
            if (decisionsToDelete.length > 0) {
                const decisionIds = new Set(decisionsToDelete.map(d => d.id));
                this.knowledge.decisions = this.knowledge.decisions.filter(d => !decisionIds.has(d.id));
                results.deleted.decisions = decisionsToDelete.length;
                log.debug({ event: 'storage_cascade_decisions', count: decisionsToDelete.length }, 'Removed decisions');
            }

            // 3. Delete related risks
            const risksToDelete = this.knowledge.risks.filter(r => {
                const source = (r.source_file || r.meeting || '').toLowerCase();
                return source.includes(docName);
            });
            if (risksToDelete.length > 0) {
                const riskIds = new Set(risksToDelete.map(r => r.id));
                this.knowledge.risks = this.knowledge.risks.filter(r => !riskIds.has(r.id));
                results.deleted.risks = risksToDelete.length;
                log.debug({ event: 'storage_cascade_risks', count: risksToDelete.length }, 'Removed risks');
            }

            // 4. Delete related action items
            const actionsToDelete = (this.knowledge.action_items || []).filter(a => {
                const source = (a.source_file || a.meeting || '').toLowerCase();
                return source.includes(docName);
            });
            if (actionsToDelete.length > 0) {
                const actionIds = new Set(actionsToDelete.map(a => a.id));
                this.knowledge.action_items = (this.knowledge.action_items || []).filter(a => !actionIds.has(a.id));
                results.deleted.actions = actionsToDelete.length;
                log.debug({ event: 'storage_cascade_actions', count: actionsToDelete.length }, 'Removed action items');
            }

            // 5. Delete related people (only those exclusively from this document and not contacts)
            const peopleToDelete = this.knowledge.people.filter(p => {
                if (p.isContact) return false; // Never auto-delete contacts
                const source = (p.source_file || '').toLowerCase();
                return source.includes(docName) && !source.includes(','); // Only if single source
            });
            if (peopleToDelete.length > 0) {
                const peopleIds = new Set(peopleToDelete.map(p => p.id));
                this.knowledge.people = this.knowledge.people.filter(p => !peopleIds.has(p.id));
                results.deleted.people = peopleToDelete.length;
                log.debug({ event: 'storage_cascade_people', count: peopleToDelete.length }, 'Removed people');
            }

            // 6. Delete related questions
            const questionsToDelete = this.questions.items.filter(q => {
                const source = (q.source_file || q.meeting || '').toLowerCase();
                return source.includes(docName);
            });
            if (questionsToDelete.length > 0) {
                const questionIds = new Set(questionsToDelete.map(q => q.id));
                this.questions.items = this.questions.items.filter(q => !questionIds.has(q.id));
                results.deleted.questions = questionsToDelete.length;
                log.debug({ event: 'storage_cascade_questions', count: questionsToDelete.length }, 'Removed questions');
            }

            // 7. Delete file log entry
            const logsBefore = this.history.file_logs.length;
            this.history.file_logs = this.history.file_logs.filter(l => l.document_id !== documentId);
            results.deleted.fileLogs = logsBefore - this.history.file_logs.length;

            // 8. Delete content file
            if (doc.content_path && fs.existsSync(doc.content_path)) {
                try {
                    fs.unlinkSync(doc.content_path);
                    results.deleted.contentFile = true;
                    log.debug({ event: 'storage_deleted_content_file', path: doc.content_path }, 'Deleted content file');
                } catch (e) {
                    results.errors.push(`Failed to delete content file: ${e.message}`);
                }
            }

            // 9. Delete archived file (optional)
            if (!keepArchive && doc.archived_path && fs.existsSync(doc.archived_path)) {
                try {
                    fs.unlinkSync(doc.archived_path);
                    results.deleted.archivedFile = true;
                    log.debug({ event: 'storage_deleted_archived_file', path: doc.archived_path }, 'Deleted archived file');
                } catch (e) {
                    results.errors.push(`Failed to delete archived file: ${e.message}`);
                }
            }

            // 10. Remove embeddings for this document
            if (this.embeddings && this.embeddings.documents) {
                const embeddingsBefore = this.embeddings.documents.length;
                this.embeddings.documents = this.embeddings.documents.filter(e => {
                    const source = (e.source || e.source_file || '').toLowerCase();
                    return !source.includes(docName);
                });
                results.deleted.embeddings = embeddingsBefore - this.embeddings.documents.length;
                if (results.deleted.embeddings > 0) {
                    this.saveEmbeddings();
                    log.debug({ event: 'storage_cascade_embeddings', count: results.deleted.embeddings }, 'Removed embeddings');
                }
            }

            // 11. Remove from documents list
            if (softDelete) {
                doc.status = 'deleted';
                doc.deleted_at = new Date().toISOString();
            } else {
                this.documents.items = this.documents.items.filter(d => d.id !== documentId);
            }

            // Save all changes
            this.saveKnowledge();
            this.saveQuestions();
            this.saveDocuments();
            this.saveHistory();

            results.success = true;
            log.debug({ event: 'storage_cascade_complete', docName: doc.name || doc.filename }, 'Cascade delete complete');

            // 12. Sync with Graph DB (async, don't wait)
            this._syncDocumentDeletionToGraph(documentId, doc.name || doc.filename).catch(e => {
                log.warn({ event: 'storage_cascade_graph_sync_error', reason: e.message }, 'Graph sync error');
            });

            // 13. Clean any remaining orphan data
            const orphanStats = this.cleanOrphanData();
            if (Object.values(orphanStats).some(v => v > 0)) {
                log.debug({ event: 'storage_cascade_orphans', orphanStats }, 'Additional orphans cleaned');
                results.deleted.orphans = orphanStats;
            }

            return results;

        } catch (error) {
            results.errors.push(error.message);
            log.warn({ event: 'storage_cascade_error', reason: error.message }, 'Cascade delete error');
            return results;
        }
    }

    /**
     * Sync document deletion to Graph DB
     */
    async _syncDocumentDeletionToGraph(documentId, documentTitle) {
        const graphProvider = this.getGraphProvider();
        if (!graphProvider || !graphProvider.connected) {
            return { skipped: true, reason: 'Graph not connected' };
        }

        try {
            const { getGraphSync } = require('./sync/GraphSync');
            const graphSync = getGraphSync(graphProvider);
            const result = await graphSync.onDocumentDeleted(documentId, documentTitle);
            log.debug({ event: 'storage_graph_sync', result }, 'Graph sync');
            return result;
        } catch (e) {
            log.warn({ event: 'storage_graph_sync_failed', reason: e.message }, 'Graph sync failed');
            return { error: e.message };
        }
    }

    // ==================== Conversation Management ====================

    /**
     * Add a new conversation to storage
     * @param {object} conversation - Conversation object from parser
     * @returns {string} - Conversation ID
     */
    addConversation(conversation) {
        // Ensure conversation has required fields
        const conv = {
            ...conversation,
            projectId: this.currentProjectId,
            importedAt: new Date().toISOString()
        };

        // Don't store rawText in main storage to save space (it's in messages)
        // but keep it if explicitly provided
        if (!conv.rawText) {
            delete conv.rawText;
        }

        this.conversations.items.push(conv);
        this.saveConversations();
        return conv.id;
    }

    /**
     * Get all conversations, optionally filtered
     * @param {object} filter - Optional filter criteria
     * @returns {Array}
     */
    getConversations(filter = null) {
        let items = this.conversations.items;

        if (filter) {
            if (filter.sourceApp) {
                items = items.filter(c => c.sourceApp === filter.sourceApp);
            }
            if (filter.participant) {
                items = items.filter(c =>
                    c.participants.some(p =>
                        p.toLowerCase().includes(filter.participant.toLowerCase())
                    )
                );
            }
        }

        return items;
    }

    /**
     * Get a conversation by ID
     * @param {string} id - Conversation ID
     * @returns {object|null}
     */
    getConversationById(id) {
        return this.conversations.items.find(c => c.id === id) || null;
    }

    /**
     * Update a conversation
     * @param {string} id - Conversation ID
     * @param {object} updates - Fields to update
     * @returns {boolean} - Success
     */
    updateConversation(id, updates) {
        const conv = this.conversations.items.find(c => c.id === id);
        if (!conv) return false;

        // Only allow updating certain fields
        const allowedFields = ['title', 'channelName', 'workspaceName', 'participants'];
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                conv[field] = updates[field];
            }
        }

        this.saveConversations();
        return true;
    }

    /**
     * Delete a conversation
     * @param {string} id - Conversation ID
     * @returns {boolean} - Success
     */
    deleteConversation(id) {
        const index = this.conversations.items.findIndex(c => c.id === id);
        if (index === -1) return false;

        this.conversations.items.splice(index, 1);
        this.saveConversations();
        return true;
    }

    /**
     * Get conversation statistics
     * @returns {object}
     */
    getConversationStats() {
        const items = this.conversations.items;
        const bySource = {};
        let totalMessages = 0;

        for (const conv of items) {
            bySource[conv.sourceApp] = (bySource[conv.sourceApp] || 0) + 1;
            totalMessages += conv.messageCount || 0;
        }

        return {
            total: items.length,
            bySource,
            totalMessages
        };
    }

    // ==================== Contacts Directory ====================

    /**
     * Add a new contact
     * @param {object} contact - Contact data
     * @returns {string} - Contact ID
     */
    addContact(contact) {
        const id = contact.id || require('crypto').randomUUID();
        const now = new Date().toISOString();

        const newContact = {
            id,
            name: contact.name || '',
            email: contact.email || '',
            role: contact.role || '',
            rolePrompt: contact.rolePrompt || '', // AI context prompt for this role
            organization: contact.organization || '',
            department: contact.department || '',
            phone: contact.phone || '',
            linkedin: contact.linkedin || '',
            timezone: contact.timezone || '',
            photoUrl: contact.photoUrl || '',
            tags: contact.tags || [],
            notes: contact.notes || '',
            aliases: contact.aliases || [], // Alternative names (nicknames, etc.)
            teamId: contact.teamId || null, // Team/group membership
            relationships: contact.relationships || [], // [{contactId, type: 'reports_to'|'works_with'|'manages'|'collaborates'}]
            activity: [], // [{type: 'conversation'|'document'|'transcript', id, title, date}]
            createdAt: now,
            updatedAt: now
        };

        this.contacts.items.push(newContact);
        this.saveContacts();
        return id;
    }

    /**
     * Add activity record to a contact
     * @param {string} contactId 
     * @param {object} activity - {type, id, title, date}
     */
    addContactActivity(contactId, activity) {
        const contact = this.contacts.items.find(c => c.id === contactId);
        if (!contact) return false;

        if (!contact.activity) contact.activity = [];

        // Check if already exists
        const exists = contact.activity.some(a => a.type === activity.type && a.id === activity.id);
        if (!exists) {
            contact.activity.push({
                type: activity.type,
                id: activity.id,
                title: activity.title || '',
                date: activity.date || new Date().toISOString()
            });
            this.saveContacts();
        }
        return true;
    }

    /**
     * Track contact mentions from a conversation
     * @param {object} conversation 
     */
    trackContactsFromConversation(conversation) {
        if (!conversation.participants) return;

        for (const participantName of conversation.participants) {
            const contact = this.findContactByName(participantName);
            if (contact) {
                this.addContactActivity(contact.id, {
                    type: 'conversation',
                    id: conversation.id,
                    title: conversation.title || 'Untitled Conversation',
                    date: conversation.importedAt || new Date().toISOString()
                });
            }
        }
    }

    /**
     * Get unmatched participants from recent conversations
     * @returns {Array} - Unique names not in contacts
     */
    getUnmatchedParticipants() {
        const allParticipants = new Set();

        // Collect from conversations
        for (const conv of (this.conversations.items || [])) {
            (conv.participants || []).forEach(p => allParticipants.add(p));
        }

        // Filter out those already in contacts
        const unmatched = [];
        for (const name of allParticipants) {
            if (!this.findContactByName(name)) {
                unmatched.push(name);
            }
        }

        return unmatched.sort();
    }

    /**
     * Get all contacts
     * @param {object} filter - Optional filter
     * @returns {Array}
     */
    getContacts(filter = null) {
        let items = this.contacts.items || [];

        if (filter) {
            if (filter.organization) {
                items = items.filter(c =>
                    c.organization?.toLowerCase().includes(filter.organization.toLowerCase())
                );
            }
            if (filter.tag) {
                items = items.filter(c =>
                    c.tags?.some(t => t.toLowerCase() === filter.tag.toLowerCase())
                );
            }
            if (filter.search) {
                const q = filter.search.toLowerCase();
                items = items.filter(c =>
                    c.name?.toLowerCase().includes(q) ||
                    c.email?.toLowerCase().includes(q) ||
                    c.role?.toLowerCase().includes(q) ||
                    c.organization?.toLowerCase().includes(q)
                );
            }
        }

        return items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    /**
     * Get contact by ID
     * @param {string} id 
     * @returns {object|null}
     */
    getContactById(id) {
        return this.contacts.items.find(c => c.id === id) || null;
    }

    /**
     * Find contact by name (including aliases)
     * @param {string} name - Name to search
     * @returns {object|null}
     */
    findContactByName(name) {
        if (!name) return null;
        const normalizedName = name.toLowerCase().trim();

        return this.contacts.items.find(c => {
            if (c.name?.toLowerCase().trim() === normalizedName) return true;
            if (c.aliases?.some(a => a.toLowerCase().trim() === normalizedName)) return true;
            // Partial match for first name
            const firstName = c.name?.split(' ')[0]?.toLowerCase();
            if (firstName && firstName === normalizedName) return true;
            return false;
        }) || null;
    }

    /**
     * Update a contact
     * @param {string} id 
     * @param {object} updates 
     * @returns {boolean}
     */
    updateContact(id, updates) {
        const contact = this.contacts.items.find(c => c.id === id);
        if (!contact) return false;

        const allowedFields = [
            'name', 'email', 'role', 'rolePrompt', 'organization', 'department',
            'phone', 'linkedin', 'timezone', 'photoUrl', 'tags', 'notes', 'aliases'
        ];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                contact[field] = updates[field];
            }
        }

        contact.updatedAt = new Date().toISOString();
        this.saveContacts();
        return true;
    }

    /**
     * Delete a contact
     * @param {string} id 
     * @returns {boolean}
     */
    deleteContact(id) {
        const index = this.contacts.items.findIndex(c => c.id === id);
        if (index === -1) return false;

        this.contacts.items.splice(index, 1);
        this.saveContacts();
        return true;
    }

    /**
     * Get contacts context for AI prompts
     * @param {Array} names - Optional list of names to filter
     * @returns {string}
     */
    getContactsContextForAI(names = null) {
        let contacts = this.contacts.items;

        // If names provided, filter and match
        if (names && names.length > 0) {
            contacts = names
                .map(name => this.findContactByName(name))
                .filter(Boolean);
        }

        if (contacts.length === 0) return '';

        const contextLines = contacts.map(c => {
            const lines = [`**${c.name}**`];
            if (c.role) lines.push(`  Role: ${c.role}`);
            if (c.rolePrompt) lines.push(`  Context: ${c.rolePrompt}`);
            if (c.organization) lines.push(`  Organization: ${c.organization}`);
            if (c.department) lines.push(`  Department: ${c.department}`);
            if (c.notes) lines.push(`  Notes: ${c.notes}`);
            return lines.join('\n');
        });

        return `## Known Participants Context\n\n${contextLines.join('\n\n')}`;
    }

    /**
     * Get contact statistics
     * @returns {object}
     */
    getContactStats() {
        const items = this.contacts.items;
        const byOrg = {};
        const allTags = new Set();
        const byTeam = {};

        for (const c of items) {
            if (c.organization) {
                byOrg[c.organization] = (byOrg[c.organization] || 0) + 1;
            }
            (c.tags || []).forEach(t => allTags.add(t));
            if (c.teamId) {
                byTeam[c.teamId] = (byTeam[c.teamId] || 0) + 1;
            }
        }

        const teams = this.contacts.teams || [];

        return {
            total: items.length,
            byOrganization: byOrg,
            tags: [...allTags].sort(),
            teams: teams.length,
            byTeam
        };
    }

    // ==================== Teams/Groups ====================

    /**
     * Add a team/group
     * @param {object} team - {name, description, color}
     * @returns {string} - Team ID
     */
    addTeam(team) {
        if (!this.contacts.teams) this.contacts.teams = [];

        const id = require('crypto').randomUUID();
        const newTeam = {
            id,
            name: team.name || 'Unnamed Team',
            description: team.description || '',
            color: team.color || '#6366f1',
            createdAt: new Date().toISOString()
        };

        this.contacts.teams.push(newTeam);
        this.saveContacts();
        return id;
    }

    /**
     * Get all teams
     * @returns {Array}
     */
    getTeams() {
        return this.contacts.teams || [];
    }

    /**
     * Get team by ID
     * @param {string} id 
     * @returns {object|null}
     */
    getTeamById(id) {
        return (this.contacts.teams || []).find(t => t.id === id) || null;
    }

    /**
     * Update team
     * @param {string} id 
     * @param {object} updates 
     * @returns {boolean}
     */
    updateTeam(id, updates) {
        if (!this.contacts.teams) return false;
        const team = this.contacts.teams.find(t => t.id === id);
        if (!team) return false;

        if (updates.name !== undefined) team.name = updates.name;
        if (updates.description !== undefined) team.description = updates.description;
        if (updates.color !== undefined) team.color = updates.color;

        this.saveContacts();
        return true;
    }

    /**
     * Delete team
     * @param {string} id 
     * @returns {boolean}
     */
    deleteTeam(id) {
        if (!this.contacts.teams) return false;
        const index = this.contacts.teams.findIndex(t => t.id === id);
        if (index === -1) return false;

        // Remove team assignments from contacts
        for (const contact of this.contacts.items) {
            if (contact.teamId === id) {
                contact.teamId = null;
            }
        }

        this.contacts.teams.splice(index, 1);
        this.saveContacts();
        return true;
    }

    /**
     * Get contacts by team
     * @param {string} teamId 
     * @returns {Array}
     */
    getContactsByTeam(teamId) {
        return this.contacts.items.filter(c => c.teamId === teamId);
    }

    // ==================== Contact Relationships ====================

    /**
     * Add relationship between contacts
     * @param {string} fromContactId 
     * @param {string} toContactId 
     * @param {string} type - 'reports_to', 'manages', 'works_with', 'collaborates'
     * @returns {boolean}
     */
    addContactRelationship(fromContactId, toContactId, type) {
        const contact = this.contacts.items.find(c => c.id === fromContactId);
        if (!contact) return false;

        if (!contact.relationships) contact.relationships = [];

        // Check if relationship already exists
        const exists = contact.relationships.some(r => r.contactId === toContactId && r.type === type);
        if (!exists) {
            contact.relationships.push({ contactId: toContactId, type });
            this.saveContacts();
        }
        return true;
    }

    /**
     * Remove relationship
     * @param {string} fromContactId 
     * @param {string} toContactId 
     * @param {string} type 
     * @returns {boolean}
     */
    removeContactRelationship(fromContactId, toContactId, type) {
        const contact = this.contacts.items.find(c => c.id === fromContactId);
        if (!contact || !contact.relationships) return false;

        const index = contact.relationships.findIndex(r => r.contactId === toContactId && r.type === type);
        if (index === -1) return false;

        contact.relationships.splice(index, 1);
        this.saveContacts();
        return true;
    }

    /**
     * Get contact with relationships expanded
     * @param {string} id 
     * @returns {object|null}
     */
    getContactWithRelationships(id) {
        const contact = this.getContactById(id);
        if (!contact) return null;

        const expanded = { ...contact };
        expanded.expandedRelationships = (contact.relationships || []).map(r => {
            const relatedContact = this.getContactById(r.contactId);
            return {
                ...r,
                contact: relatedContact ? {
                    id: relatedContact.id,
                    name: relatedContact.name,
                    role: relatedContact.role,
                    organization: relatedContact.organization
                } : null
            };
        });

        return expanded;
    }

    // ==================== Merge Duplicates ====================

    /**
     * Find potential duplicate contacts
     * @returns {Array} - Groups of potential duplicates
     */
    findDuplicateContacts() {
        const items = this.contacts.items;
        const duplicates = [];
        const checked = new Set();

        for (let i = 0; i < items.length; i++) {
            if (checked.has(items[i].id)) continue;

            const group = [items[i]];

            for (let j = i + 1; j < items.length; j++) {
                if (checked.has(items[j].id)) continue;

                // Check similarity
                if (this._areContactsSimilar(items[i], items[j])) {
                    group.push(items[j]);
                    checked.add(items[j].id);
                }
            }

            if (group.length > 1) {
                duplicates.push(group);
                checked.add(items[i].id);
            }
        }

        return duplicates;
    }

    /**
     * Check if two contacts are similar
     * @private
     */
    _areContactsSimilar(a, b) {
        // Same email
        if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
            return true;
        }

        // Same phone
        if (a.phone && b.phone) {
            const phoneA = a.phone.replace(/\D/g, '');
            const phoneB = b.phone.replace(/\D/g, '');
            if (phoneA === phoneB) return true;
        }

        // Very similar names
        const nameA = (a.name || '').toLowerCase().trim();
        const nameB = (b.name || '').toLowerCase().trim();

        if (nameA === nameB) return true;

        // Check if one name contains the other (e.g., "John" vs "John Smith")
        if (nameA.includes(nameB) || nameB.includes(nameA)) {
            // Additional check: same organization
            if (a.organization && b.organization &&
                a.organization.toLowerCase() === b.organization.toLowerCase()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Merge contacts (keep first, merge data, delete others)
     * @param {Array} contactIds - IDs to merge (first one is kept)
     * @returns {string|null} - ID of merged contact
     */
    mergeContacts(contactIds) {
        if (!contactIds || contactIds.length < 2) return null;

        const primary = this.contacts.items.find(c => c.id === contactIds[0]);
        if (!primary) return null;

        // Merge data from other contacts
        for (let i = 1; i < contactIds.length; i++) {
            const other = this.contacts.items.find(c => c.id === contactIds[i]);
            if (!other) continue;

            // Merge fields (keep primary if exists, use other if not)
            ['email', 'phone', 'role', 'organization', 'department', 'linkedin', 'timezone', 'photoUrl', 'notes'].forEach(field => {
                if (!primary[field] && other[field]) {
                    primary[field] = other[field];
                }
            });

            // Merge arrays
            ['tags', 'aliases'].forEach(field => {
                if (other[field] && other[field].length > 0) {
                    primary[field] = [...new Set([...(primary[field] || []), ...other[field]])];
                }
            });

            // Merge activity
            if (other.activity && other.activity.length > 0) {
                if (!primary.activity) primary.activity = [];
                for (const act of other.activity) {
                    if (!primary.activity.some(a => a.type === act.type && a.id === act.id)) {
                        primary.activity.push(act);
                    }
                }
            }

            // Merge relationships
            if (other.relationships && other.relationships.length > 0) {
                if (!primary.relationships) primary.relationships = [];
                for (const rel of other.relationships) {
                    if (!primary.relationships.some(r => r.contactId === rel.contactId && r.type === rel.type)) {
                        primary.relationships.push(rel);
                    }
                }
            }

            // Add other's name as alias if different
            if (other.name && other.name !== primary.name) {
                if (!primary.aliases) primary.aliases = [];
                if (!primary.aliases.includes(other.name)) {
                    primary.aliases.push(other.name);
                }
            }

            // Delete merged contact
            const index = this.contacts.items.findIndex(c => c.id === contactIds[i]);
            if (index !== -1) {
                this.contacts.items.splice(index, 1);
            }
        }

        primary.updatedAt = new Date().toISOString();
        this.saveContacts();

        return primary.id;
    }

    // ==================== Import/Export ====================

    /**
     * Export contacts to JSON
     * @returns {object}
     */
    exportContactsJSON() {
        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            contacts: this.contacts.items,
            teams: this.contacts.teams || []
        };
    }

    /**
     * Export contacts to CSV format
     * @returns {string}
     */
    exportContactsCSV() {
        const headers = ['Name', 'Email', 'Phone', 'Role', 'Organization', 'Department', 'LinkedIn', 'Timezone', 'Tags', 'Aliases', 'Notes'];
        const rows = [headers.join(',')];

        for (const c of this.contacts.items) {
            const row = [
                this._csvEscape(c.name),
                this._csvEscape(c.email),
                this._csvEscape(c.phone),
                this._csvEscape(c.role),
                this._csvEscape(c.organization),
                this._csvEscape(c.department),
                this._csvEscape(c.linkedin),
                this._csvEscape(c.timezone),
                this._csvEscape((c.tags || []).join(';')),
                this._csvEscape((c.aliases || []).join(';')),
                this._csvEscape(c.notes)
            ];
            rows.push(row.join(','));
        }

        return rows.join('\n');
    }

    _csvEscape(value) {
        if (!value) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    /**
     * Import contacts from JSON
     * @param {object} data - Exported JSON data
     * @returns {object} - {imported, skipped}
     */
    importContactsJSON(data) {
        const contacts = data.contacts || [];
        const teams = data.teams || [];

        let imported = 0;
        let skipped = 0;

        // Import teams first
        for (const team of teams) {
            const exists = (this.contacts.teams || []).some(t => t.name === team.name);
            if (!exists) {
                this.addTeam(team);
            }
        }

        // Import contacts
        for (const contact of contacts) {
            // Check if already exists by email or name
            const exists = this.contacts.items.some(c =>
                (c.email && contact.email && c.email.toLowerCase() === contact.email.toLowerCase()) ||
                (c.name && contact.name && c.name.toLowerCase() === contact.name.toLowerCase())
            );

            if (!exists) {
                this.addContact(contact);
                imported++;
            } else {
                skipped++;
            }
        }

        return { imported, skipped };
    }

    /**
     * Import contacts from CSV
     * @param {string} csvContent 
     * @returns {object} - {imported, skipped, errors}
     */
    importContactsCSV(csvContent) {
        const lines = csvContent.split('\n').filter(l => l.trim());
        if (lines.length < 2) return { imported: 0, skipped: 0, errors: ['No data rows found'] };

        const headers = this._parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

        let imported = 0;
        let skipped = 0;
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
            try {
                const values = this._parseCSVLine(lines[i]);
                const contact = {};

                headers.forEach((header, idx) => {
                    const value = values[idx] || '';

                    switch (header) {
                        case 'name': contact.name = value; break;
                        case 'email': contact.email = value; break;
                        case 'phone': contact.phone = value; break;
                        case 'role': contact.role = value; break;
                        case 'organization': contact.organization = value; break;
                        case 'department': contact.department = value; break;
                        case 'linkedin': contact.linkedin = value; break;
                        case 'timezone': contact.timezone = value; break;
                        case 'tags': contact.tags = value.split(';').map(t => t.trim()).filter(Boolean); break;
                        case 'aliases': contact.aliases = value.split(';').map(a => a.trim()).filter(Boolean); break;
                        case 'notes': contact.notes = value; break;
                    }
                });

                if (!contact.name) {
                    errors.push(`Row ${i + 1}: Missing name`);
                    continue;
                }

                // Check if exists
                const exists = this.contacts.items.some(c =>
                    (c.email && contact.email && c.email.toLowerCase() === contact.email.toLowerCase()) ||
                    (c.name.toLowerCase() === contact.name.toLowerCase())
                );

                if (!exists) {
                    this.addContact(contact);
                    imported++;
                } else {
                    skipped++;
                }
            } catch (err) {
                errors.push(`Row ${i + 1}: ${err.message}`);
            }
        }

        return { imported, skipped, errors };
    }

    /**
     * Sync people from knowledge.people to contacts
     * This ensures extracted people appear in the Contacts Directory
     * - If person already exists: adds activity/relation to existing contact
     * - If person doesn't exist: creates new contact
     * @returns {object} - {added, updated, skipped, total}
     */
    syncPeopleToContacts() {
        const people = this.knowledge.people || [];
        let added = 0;
        let updated = 0;
        let skipped = 0;

        for (const person of people) {
            if (!person.name) continue;

            // Use findContactByName which checks name + aliases + first name
            const existingContact = this.findContactByName(person.name);

            if (existingContact) {
                // Contact already exists - add activity/mention instead of duplicating
                const sourceFile = person.source_file || person.meeting || 'document';

                // Add as activity (document mention)
                const activityAdded = this.addContactActivity(existingContact.id, {
                    type: 'document',
                    id: person.id || `person_${Date.now()}`,
                    title: `Mentioned in: ${sourceFile}`,
                    date: person.created_at || new Date().toISOString()
                });

                // Update role/organization if empty and we have new info
                let contactUpdated = false;
                if (!existingContact.role && person.role) {
                    existingContact.role = person.role;
                    contactUpdated = true;
                }
                if (!existingContact.organization && person.organization) {
                    existingContact.organization = person.organization;
                    contactUpdated = true;
                }
                if (contactUpdated) {
                    existingContact.updatedAt = new Date().toISOString();
                    this.saveContacts();
                }

                if (activityAdded || contactUpdated) {
                    updated++;
                } else {
                    skipped++;
                }
                continue;
            }

            // Add as new contact
            // Ensure role is not the same as organization (common extraction error)
            let personRole = person.role || '';
            const personOrg = person.organization || '';
            if (personRole && personOrg && personRole.toLowerCase() === personOrg.toLowerCase()) {
                personRole = ''; // Clear role if it's just the org name repeated
            }

            const newId = this.addContact({
                name: person.name,
                role: personRole,
                organization: personOrg,
                department: person.department || '',
                notes: `Auto-imported from document processing${person.source_file ? ` (${person.source_file})` : ''}`,
                tags: ['auto-extracted']
            });

            // Add initial activity for the source document
            if (person.source_file) {
                this.addContactActivity(newId, {
                    type: 'document',
                    id: person.id || `person_${Date.now()}`,
                    title: `Extracted from: ${person.source_file}`,
                    date: person.created_at || new Date().toISOString()
                });
            }

            added++;
        }

        log.debug({ event: 'storage_contacts_synced', added, updated, skipped }, 'Synced people');
        return { added, updated, skipped, total: people.length };
    }

    _parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);

        return result;
    }

    // ==================== Category Normalization ====================

    // Standard categories - all facts will be mapped to one of these
    static CATEGORIES = ['process', 'policy', 'technical', 'people', 'timeline', 'general'];

    normalizeCategory(category) {
        if (!category) return 'general';

        const cat = category.toLowerCase().trim();

        // Direct matches
        if (Storage.CATEGORIES.includes(cat)) return cat;

        // Map common variations
        const mapping = {
            // Process
            'business': 'process',
            'workflow': 'process',
            'procedure': 'process',
            'operation': 'process',
            'operations': 'process',
            // Policy
            'rule': 'policy',
            'rules': 'policy',
            'requirement': 'policy',
            'requirements': 'policy',
            'compliance': 'policy',
            // Technical
            'integration': 'technical',
            'system': 'technical',
            'data': 'technical',
            'api': 'technical',
            'infrastructure': 'technical',
            // People
            'contact': 'people',
            'contacts': 'people',
            'team': 'people',
            'organization': 'people',
            'hr': 'people',
            'admin': 'people',
            // Timeline
            'date': 'timeline',
            'dates': 'timeline',
            'schedule': 'timeline',
            'deadline': 'timeline',
            'milestone': 'timeline',
            // General
            'other': 'general',
            'misc': 'general',
            'unknown': 'general'
        };

        // Check for exact match in mapping
        if (mapping[cat]) return mapping[cat];

        // Handle pipe-separated categories (take first one)
        if (cat.includes('|')) {
            const first = cat.split('|')[0].trim();
            return this.normalizeCategory(first);
        }

        // Check if any mapping key is contained in the category
        for (const [key, value] of Object.entries(mapping)) {
            if (cat.includes(key)) return value;
        }

        return 'general';
    }

    // ==================== Facts ====================

    addFact(fact, skipDedup = false) {
        // Validate content - reject garbage
        if (!fact.content || typeof fact.content !== 'string') {
            return { id: null, action: 'skipped', reason: 'no_content' };
        }

        const content = fact.content.trim();

        // Reject too short content
        if (content.length < 10) {
            return { id: null, action: 'skipped', reason: 'too_short' };
        }

        // Reject placeholder content
        if (content === '...' || content === '…' || /^\.+$/.test(content)) {
            log.debug({ event: 'storage_skip_garbage_fact', contentPreview: content.substring(0, 80) }, 'Skipping garbage fact');
            return { id: null, action: 'skipped', reason: 'placeholder' };
        }

        // Reject content that starts with error indicators
        if (content.toLowerCase().startsWith('i\'m sorry') ||
            content.toLowerCase().startsWith('i cannot') ||
            content.toLowerCase().startsWith('/ ') ||
            content.startsWith('/proc/') ||
            content.startsWith('/sys/')) {
            log.debug({ event: 'storage_skip_invalid_fact', contentPreview: content.substring(0, 50) }, 'Skipping invalid fact');
            return { id: null, action: 'skipped', reason: 'invalid_content' };
        }

        if (!skipDedup) {
            const dupCheck = this.findDuplicate(content, this.knowledge.facts);
            if (dupCheck.isDuplicate) {
                log.debug({ event: 'storage_duplicate_fact', similarity: Math.round(dupCheck.similarity * 100), contentPreview: content.substring(0, 50) }, 'Duplicate fact');
                return { id: dupCheck.existingItem.id, action: 'duplicate', similarity: dupCheck.similarity };
            }
        }

        const id = Date.now();
        this.knowledge.facts.push({
            id,
            content: fact.content,
            category: this.normalizeCategory(fact.category),
            confidence: fact.confidence || 1.0,
            source_file: fact.source_file || null,
            created_at: new Date().toISOString()
        });
        this.logChange('add', 'fact', id, content, fact.source_file);
        this.saveKnowledge();
        return { id, action: 'added' };
    }

    getFacts(category = null) {
        return category
            ? this.knowledge.facts.filter(f => f.category === category)
            : this.knowledge.facts;
    }

    /**
     * Replace all facts with new synthesized facts
     * Used by knowledge synthesis to consolidate the knowledge base
     * @param {array} newFacts - Array of fact objects to replace existing facts
     */
    replaceFacts(newFacts) {
        const oldCount = this.knowledge.facts.length;
        this.knowledge.facts = newFacts;
        this.logChange('replace', 'facts', null, `Replaced ${oldCount} facts with ${newFacts.length} synthesized facts`);
        this.saveKnowledge();
        log.debug({ event: 'storage_knowledge_updated', oldCount, newCount: newFacts.length }, 'Knowledge base updated');
    }

    getAllKnowledge() {
        return {
            facts: this.knowledge.facts || [],
            decisions: this.knowledge.decisions || [],
            risks: this.knowledge.risks || [],
            people: this.knowledge.people || [],
            action_items: this.knowledge.action_items || [],
            questions: this.questions.items || []
        };
    }

    // ==================== Questions ====================

    addQuestion(question, skipDedup = false) {
        if (!skipDedup) {
            const dupCheck = this.findDuplicate(question.content, this.questions.items);
            if (dupCheck.isDuplicate) {
                log.debug({ event: 'storage_duplicate_question', similarity: Math.round(dupCheck.similarity * 100), contentPreview: question.content.substring(0, 50) }, 'Duplicate question');
                return { id: dupCheck.existingItem.id, action: 'duplicate', similarity: dupCheck.similarity };
            }
        }

        const id = Date.now();
        this.questions.items.push({
            id,
            content: question.content,
            context: question.context || null,
            priority: question.priority || 'medium',
            status: 'pending',
            assigned_to: question.assigned_to || null,
            source_file: question.source_file || null,
            created_at: new Date().toISOString()
        });
        this.logChange('add', 'question', id, question.content, question.source_file);
        this.saveQuestions();
        return { id, action: 'added' };
    }

    resolveQuestion(id, answer) {
        const q = this.questions.items.find(q => q.id === id);
        if (q) {
            q.status = 'resolved';
            q.answer = answer;
            q.resolved_at = new Date().toISOString();
            this.logChange('update', 'question', id, `Resolved: ${q.content?.substring(0, 50)}`, null);
            this.saveQuestions();
        }
    }

    /**
     * Update a question's fields (e.g., assigned_to, priority, context)
     */
    updateQuestion(id, updates) {
        const q = this.questions.items.find(q => q.id === id);
        if (q) {
            const oldValues = {};
            for (const [key, value] of Object.entries(updates)) {
                if (q[key] !== value) {
                    oldValues[key] = q[key];
                    q[key] = value;
                }
            }
            q.updated_at = new Date().toISOString();

            // Log the change
            const changedFields = Object.keys(oldValues).join(', ');
            if (changedFields) {
                this.logChange('update', 'question', id, `Updated: ${changedFields}`, oldValues);
            }

            this.saveQuestions();
            return true;
        }
        return false;
    }

    getQuestions(filters = {}) {
        let result = this.questions.items;
        if (filters.status) result = result.filter(q => q.status === filters.status);
        if (filters.priority) result = result.filter(q => q.priority === filters.priority);
        return result;
    }

    /**
     * Update a question (assign to person, change status, priority, etc.)
     * @param {number} id - Question ID
     * @param {object} updates - Fields to update
     * @returns {object} - Result with success status and updated question
     */
    updateQuestion(id, updates) {
        const q = this.questions.items.find(q => q.id === id);
        if (!q) {
            return { success: false, error: 'Question not found' };
        }

        // Update allowed fields
        if (updates.assigned_to !== undefined) q.assigned_to = updates.assigned_to;
        if (updates.priority !== undefined) q.priority = updates.priority;
        if (updates.content !== undefined) q.content = updates.content;
        if (updates.context !== undefined) q.context = updates.context;

        // Handle status change (especially reopening)
        if (updates.status !== undefined) {
            const oldStatus = q.status;
            q.status = updates.status;

            // If reopening a resolved question
            if (oldStatus === 'resolved' && updates.status === 'pending') {
                q.reopened_at = new Date().toISOString();
                q.reopen_reason = updates.reopen_reason || 'Manually reopened';
                // Keep the previous answer as a note
                if (q.answer) {
                    q.previous_answer = q.answer;
                    q.answer = null; // Clear current answer so it shows as pending
                }
                this.logChange('update', 'question', id, `Reopened: ${q.content?.substring(0, 50)}`);
            }
        }

        q.updated_at = new Date().toISOString();

        this.logChange('update', 'question', id, `Updated: ${updates.assigned_to ? 'assigned to ' + updates.assigned_to : updates.status || 'modified'}`);
        this.saveQuestions();

        return { success: true, question: q };
    }

    /**
     * Remove questions by IDs
     * @param {array} ids - Array of question IDs to remove
     * @returns {number} - Count of removed questions
     */
    removeQuestions(ids) {
        const idSet = new Set(ids);
        const originalCount = this.questions.items.length;
        this.questions.items = this.questions.items.filter(q => !idSet.has(q.id));
        const removedCount = originalCount - this.questions.items.length;
        if (removedCount > 0) {
            this.logChange('remove', 'questions', null, `Removed ${removedCount} garbage questions`);
            this.saveQuestions();
        }
        return removedCount;
    }

    categorizeQuestion(content) {
        if (!content) return 'General';
        const text = content.toLowerCase();

        const teamKeywords = {
            'Technical': ['api', 'database', 'server', 'code', 'bug', 'error', 'integration', 'system'],
            'Business': ['process', 'workflow', 'policy', 'procedure', 'approval', 'budget'],
            'Data': ['data', 'migration', 'export', 'import', 'format', 'mapping'],
            'Operations': ['timesheet', 'report', 'submit', 'portal', 'access', 'login'],
            'HR/Admin': ['employee', 'leave', 'vacation', 'holiday', 'contract', 'onboarding']
        };

        for (const [team, keywords] of Object.entries(teamKeywords)) {
            if (keywords.some(kw => text.includes(kw))) return team;
        }
        return 'General';
    }

    getQuestionsByTeam() {
        const pending = this.questions.items.filter(q => q.status !== 'resolved');
        const grouped = {};

        for (const q of pending) {
            const team = this.categorizeQuestion(q.content);
            if (!grouped[team]) grouped[team] = [];
            grouped[team].push(q);
        }
        return grouped;
    }

    getQuestionsByPerson() {
        const grouped = {};
        for (const q of this.questions.items) {
            const person = q.assigned_to || 'Unassigned';
            if (!grouped[person]) grouped[person] = [];
            grouped[person].push(q);
        }
        return grouped;
    }

    /**
     * Get expertise suggestions for a question
     * Analyzes past question assignments and resolutions to suggest who might handle it
     * @param {string} questionContent - The question content to analyze
     * @returns {Array} - Suggested assignees with confidence scores
     */
    getExpertiseSuggestions(questionContent) {
        const category = this.categorizeQuestion(questionContent);
        const expertiseMap = {};

        // Analyze resolved questions to build expertise profiles
        for (const q of this.questions.items) {
            const assignee = q.assigned_to || q.owner;
            if (!assignee || assignee === 'Unassigned') continue;

            const qCategory = this.categorizeQuestion(q.content);
            if (!expertiseMap[assignee]) {
                expertiseMap[assignee] = { total: 0, byCategory: {}, resolved: 0 };
            }
            expertiseMap[assignee].total++;
            expertiseMap[assignee].byCategory[qCategory] = (expertiseMap[assignee].byCategory[qCategory] || 0) + 1;
            if (q.status === 'resolved') {
                expertiseMap[assignee].resolved++;
            }
        }

        // Also analyze actions ownership
        if (this.knowledge?.actions) {
            for (const a of this.knowledge.actions) {
                const owner = a.owner;
                if (!owner) continue;
                if (!expertiseMap[owner]) {
                    expertiseMap[owner] = { total: 0, byCategory: {}, resolved: 0 };
                }
                expertiseMap[owner].total++;
                if (a.status === 'done' || a.status === 'completed') {
                    expertiseMap[owner].resolved++;
                }
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

            if (categoryCount > 0 || stats.total >= 2) {
                suggestions.push({
                    person,
                    score: Math.round(overallScore * 100),
                    categoryExperience: categoryCount,
                    totalExperience: stats.total,
                    resolved: stats.resolved,
                    reason: categoryCount > 0
                        ? `Handled ${categoryCount} ${category} question${categoryCount > 1 ? 's' : ''}`
                        : `Resolved ${stats.resolved} of ${stats.total} assigned items`
                });
            }
        }

        // Sort by score descending
        suggestions.sort((a, b) => b.score - a.score);

        // Return top 3 suggestions
        return suggestions.slice(0, 3);
    }

    // ==================== Decisions ====================

    addDecision(decision, skipDedup = false) {
        if (!decision.content || decision.content.length < 5) {
            return { id: null, action: 'skipped', reason: 'invalid_content' };
        }

        if (!skipDedup) {
            const dupCheck = this.findDuplicate(decision.content, this.knowledge.decisions);
            if (dupCheck.isDuplicate) {
                log.debug({ event: 'storage_duplicate_decision', similarity: Math.round(dupCheck.similarity * 100), contentPreview: decision.content.substring(0, 50) }, 'Duplicate decision');
                return { id: dupCheck.existingItem.id, action: 'duplicate', similarity: dupCheck.similarity };
            }
        }

        const id = Date.now();
        this.knowledge.decisions.push({
            id,
            content: decision.content,
            owner: decision.owner || null,
            decision_date: decision.decision_date || null,
            category: decision.category || null,
            source_file: decision.source_file || null,
            created_at: new Date().toISOString()
        });
        this.logChange('add', 'decision', id, decision.content, decision.source_file);
        this.saveKnowledge();
        return { id, action: 'added' };
    }

    getDecisions() {
        return this.knowledge.decisions;
    }

    // ==================== Risks ====================

    addRisk(risk, skipDedup = false) {
        // Validate content - reject garbage
        if (!risk.content || typeof risk.content !== 'string') {
            return { id: null, action: 'skipped', reason: 'no_content' };
        }

        const content = risk.content.trim();

        // Reject too short or placeholder content
        if (content.length < 10 || content === '...' || content === '…' || /^\.+$/.test(content)) {
            log.debug({ event: 'storage_skip_garbage_risk', contentPreview: content.substring(0, 80) }, 'Skipping garbage risk');
            return { id: null, action: 'skipped', reason: 'invalid_content' };
        }

        // Reject garbage impact/likelihood values
        if (risk.impact === '...' || risk.likelihood === '...') {
            log.debug({ event: 'storage_skip_placeholder_risk' }, 'Skipping risk with placeholder values');
            return { id: null, action: 'skipped', reason: 'placeholder_values' };
        }

        if (!skipDedup) {
            const dupCheck = this.findDuplicate(content, this.knowledge.risks);
            if (dupCheck.isDuplicate) {
                log.debug({ event: 'storage_duplicate_risk', similarity: Math.round(dupCheck.similarity * 100), contentPreview: content.substring(0, 50) }, 'Duplicate risk');
                return { id: dupCheck.existingItem.id, action: 'duplicate', similarity: dupCheck.similarity };
            }
        }

        const id = Date.now();
        this.knowledge.risks.push({
            id,
            content: risk.content,
            impact: risk.impact || 'medium',
            likelihood: risk.likelihood || 'medium',
            mitigation: risk.mitigation || null,
            status: 'open',
            source_file: risk.source_file || null,
            created_at: new Date().toISOString()
        });
        this.logChange('add', 'risk', id, risk.content, risk.source_file);
        this.saveKnowledge();
        return { id, action: 'added' };
    }

    getRisks(status = null) {
        return status
            ? this.knowledge.risks.filter(r => r.status === status)
            : this.knowledge.risks;
    }

    getRisksByCategory() {
        const risks = this.knowledge.risks.filter(r => r.status !== 'mitigated');
        const grouped = { 'High Impact': [], 'Medium Impact': [], 'Low Impact': [] };

        for (const r of risks) {
            const impact = (r.impact || 'medium').toLowerCase();
            if (impact === 'high' || impact === 'critical') grouped['High Impact'].push(r);
            else if (impact === 'medium') grouped['Medium Impact'].push(r);
            else grouped['Low Impact'].push(r);
        }

        // Remove empty
        for (const key of Object.keys(grouped)) {
            if (grouped[key].length === 0) delete grouped[key];
        }
        return grouped;
    }

    // ==================== Action Items ====================

    addActionItem(item, skipDedup = false) {
        if (!skipDedup) {
            const dupCheck = this.findDuplicate(item.task, this.knowledge.action_items, 'task');
            if (dupCheck.isDuplicate) {
                log.debug({ event: 'storage_duplicate_action', similarity: Math.round(dupCheck.similarity * 100), taskPreview: item.task.substring(0, 50) }, 'Duplicate action');
                return { id: dupCheck.existingItem.id, action: 'duplicate', similarity: dupCheck.similarity };
            }
        }

        const id = Date.now();
        this.knowledge.action_items.push({
            id,
            task: item.task,
            owner: item.owner || null,
            deadline: item.deadline || null,
            status: item.status || 'pending',
            source_file: item.source_file || null,
            created_at: new Date().toISOString(),
            parent_story_ref: item.parent_story_ref || item.parent_story || null,
            size_estimate: item.size_estimate || item.size || null,
            description: item.description || null,
            definition_of_done: Array.isArray(item.definition_of_done) ? item.definition_of_done : [],
            acceptance_criteria: Array.isArray(item.acceptance_criteria) ? item.acceptance_criteria : []
        });
        this.logChange('add', 'action_item', id, item.task, item.source_file);
        this.saveKnowledge();
        return { id, action: 'added' };
    }

    getActionItems(status = null) {
        return status
            ? this.knowledge.action_items.filter(a => a.status === status)
            : this.knowledge.action_items;
    }

    /**
     * Update an action item's status
     * @param {number} id - Action item ID
     * @param {object} updates - Fields to update (status, completed_at, etc.)
     */
    updateActionItem(id, updates) {
        const item = this.knowledge.action_items.find(a => a.id === id);
        if (!item) return null;

        Object.assign(item, updates);
        if (updates.status === 'completed' && !item.completed_at) {
            item.completed_at = new Date().toISOString();
        }
        this.logChange('update', 'action_item', id, `${updates.status || 'updated'}: ${item.task?.substring(0, 50)}`, null);
        this.saveKnowledge();
        return item;
    }

    /**
     * Find action item by matching task description
     * @param {string} taskDescription - Text to match against
     * @returns {object|null} - Matching action item or null
     */
    findActionItemByTask(taskDescription) {
        if (!taskDescription) return null;
        const normalized = taskDescription.toLowerCase().trim();

        // Try exact substring match first
        for (const item of this.knowledge.action_items) {
            const task = item.task?.toLowerCase() || '';
            if (task.includes(normalized) || normalized.includes(task)) {
                return item;
            }
        }

        // Try similarity match
        for (const item of this.knowledge.action_items) {
            const similarity = this.textSimilarity(taskDescription, item.task);
            if (similarity > 0.6) {
                return item;
            }
        }

        return null;
    }

    // ==================== People ====================

    addPerson(person) {
        if (!person.name || person.name.length < 2) return null;

        const name = person.name.trim();

        // Reject placeholder/garbage names
        if (name === '...' || name === '…' || /^\.+$/.test(name) || name.toLowerCase() === 'null') {
            log.debug({ event: 'storage_skip_garbage_person', name }, 'Skipping garbage person');
            return null;
        }

        // Reject names that are clearly not people (system paths, errors)
        if (name.startsWith('/') || name.includes('\\') || name.toLowerCase().includes('error')) {
            log.debug({ event: 'storage_skip_invalid_person', name }, 'Skipping invalid person name');
            return null;
        }

        const exists = this.knowledge.people.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (exists) return exists.id;

        // Generate unique ID: timestamp + random suffix to avoid collisions
        const id = Date.now().toString() + Math.random().toString(36).substring(2, 8);
        this.knowledge.people.push({
            id,
            name,
            role: person.role || null,
            organization: person.organization || null,
            source: person.source || null, // e.g., 'question_assignee', 'document_extraction'
            source_file: person.source_file || null,
            created_at: new Date().toISOString()
        });
        this.saveKnowledge();
        return id;
    }

    getPeople() {
        return this.knowledge.people;
    }

    // ==================== Relationships (Org Chart) ====================

    /**
     * Add a relationship between people/entities
     * @param {object} rel - {from, to, type, context, source_file}
     * Types: reports_to, manages, works_with, leads, member_of, part_of
     */
    addRelationship(rel) {
        if (!rel.from || !rel.to) return null;

        const from = rel.from.trim();
        const to = rel.to.trim();
        const type = rel.type || 'works_with';

        // Check for duplicate relationship
        const exists = this.knowledge.relationships.find(r =>
            r.from.toLowerCase() === from.toLowerCase() &&
            r.to.toLowerCase() === to.toLowerCase() &&
            r.type === type
        );
        if (exists) return exists.id;

        const id = Date.now();
        this.knowledge.relationships.push({
            id,
            from,
            to,
            type,
            context: rel.context || null,
            source_file: rel.source_file || null,
            created_at: new Date().toISOString()
        });
        this.saveKnowledge();
        return id;
    }

    getRelationships() {
        return this.knowledge.relationships;
    }

    /**
     * Get org chart data for visualization
     * Returns nodes and edges for vis.js
     * Now integrates Contacts Directory with Knowledge Base people
     */
    getOrgChartData() {
        const knowledgePeople = this.knowledge.people || [];
        const knowledgeRelationships = this.knowledge.relationships || [];
        const contacts = this.contacts.items || [];
        const teams = this.contacts.teams || [];

        // Create unified node map (merge contacts + knowledge people)
        const nameToNode = new Map(); // name.toLowerCase() -> node (for merging)
        const idToNode = new Map(); // id -> node
        const nodes = []; // Final array of unique nodes

        // First, add all contacts (they have richer data)
        for (const contact of contacts) {
            const team = teams.find(t => t.id === contact.teamId);
            const nodeKey = contact.name.toLowerCase().trim();

            // Skip if already processed (avoid duplicates)
            if (nameToNode.has(nodeKey)) continue;

            const node = {
                id: `contact_${contact.id}`,
                contactId: contact.id,
                label: contact.name,
                title: this._buildNodeTitle(contact, team),
                group: contact.teamId ? `team_${contact.teamId}` : (contact.organization || 'default'),
                role: contact.role,
                organization: contact.organization,
                email: contact.email,
                phone: contact.phone,
                isContact: true,
                teamColor: team?.color || null,
                activityCount: (contact.activity || []).length,
                shape: 'circularImage',
                image: contact.photoUrl || null,
                color: team ? { background: team.color, border: team.color } : undefined
            };

            // Use box shape if no photo
            if (!contact.photoUrl) {
                node.shape = 'box';
                node.font = { color: '#ffffff' };
                if (team) {
                    node.color = { background: team.color, border: team.color };
                } else {
                    node.color = { background: '#6366f1', border: '#4f46e5' };
                }
            }

            // Add to collections
            nodes.push(node);
            nameToNode.set(nodeKey, node);
            idToNode.set(contact.id, node);

            // Also map aliases (but don't create new nodes)
            for (const alias of (contact.aliases || [])) {
                const aliasKey = alias.toLowerCase().trim();
                if (!nameToNode.has(aliasKey)) {
                    nameToNode.set(aliasKey, node);
                }
            }
        }

        // Then add knowledge base people (if not already from contacts)
        for (const person of knowledgePeople) {
            const nameKey = person.name.toLowerCase().trim();

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

        // Add edges from contact relationships
        for (const contact of contacts) {
            const fromNode = idToNode.get(contact.id);
            if (!fromNode) continue;

            for (const rel of (contact.relationships || [])) {
                const toNode = idToNode.get(rel.contactId);
                if (!toNode) continue;

                const edgeKey = `${fromNode.id}_${toNode.id}_${rel.type}`;
                if (edgeSet.has(edgeKey)) continue;
                edgeSet.add(edgeKey);

                const edgeStyle = this._getRelationshipStyle(rel.type);
                edges.push({
                    from: fromNode.id,
                    to: toNode.id,
                    ...edgeStyle,
                    title: rel.type.replace('_', ' '),
                    source: 'contact'
                });
            }
        }

        // Add edges from knowledge relationships
        for (const rel of knowledgeRelationships) {
            const fromKey = rel.from.toLowerCase().trim();
            const toKey = rel.to.toLowerCase().trim();

            const fromNode = nameToNode.get(fromKey);
            const toNode = nameToNode.get(toKey);

            if (!fromNode || !toNode) continue;

            const edgeKey = `${fromNode.id}_${toNode.id}_${rel.type}`;
            if (edgeSet.has(edgeKey)) continue;
            edgeSet.add(edgeKey);

            const edgeStyle = this._getRelationshipStyle(rel.type);
            edges.push({
                from: fromNode.id,
                to: toNode.id,
                ...edgeStyle,
                title: rel.type.replace('_', ' '),
                source: 'knowledge'
            });
        }

        // Build team groups for legend
        const teamGroups = teams.map(t => ({
            id: `team_${t.id}`,
            name: t.name,
            color: t.color,
            memberCount: contacts.filter(c => c.teamId === t.id).length
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
        const activityCount = (contact.activity || []).length;
        if (activityCount > 0) title += `\n💬 ${activityCount} activities`;
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

    // ==================== Change Log (Version Tracking) ====================

    /**
     * Log a change to the knowledge base for version tracking
     * @param {string} action - 'add', 'update', 'delete'
     * @param {string} type - 'fact', 'decision', 'risk', 'question', 'person', 'action_item'
     * @param {number|string} id - ID of the item changed
     * @param {string} summary - Brief description of the change
     * @param {string} source - Source file or 'manual'
     */
    logChange(action, type, id, summary, source = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            type,
            id,
            summary: summary?.substring(0, 200) || '',
            source: source || 'system'
        };

        this.knowledge.change_log.push(entry);

        // Keep only last 500 entries to prevent unbounded growth
        if (this.knowledge.change_log.length > 500) {
            this.knowledge.change_log = this.knowledge.change_log.slice(-500);
        }

        // Note: saveKnowledge() should be called by the caller to batch changes
    }

    /**
     * Get change log with optional filtering
     * @param {object} options - {type, action, since, limit}
     */
    getChangeLog(options = {}) {
        let log = [...this.knowledge.change_log];

        if (options.type) {
            log = log.filter(e => e.type === options.type);
        }
        if (options.action) {
            log = log.filter(e => e.action === options.action);
        }
        if (options.since) {
            const sinceDate = new Date(options.since);
            log = log.filter(e => new Date(e.timestamp) >= sinceDate);
        }

        // Sort newest first
        log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (options.limit) {
            log = log.slice(0, options.limit);
        }

        return log;
    }

    // ==================== Statistics ====================

    getStats() {
        const pending = this.questions.items.filter(q => q.status === 'pending');
        const resolved = this.questions.items.filter(q => q.status === 'resolved');
        const critical = pending.filter(q => q.priority === 'critical');

        return {
            documents: {
                total: this.documents.items.length,
                processed: this.documents.items.filter(d => d.status === 'processed').length,
                pending: this.documents.items.filter(d => d.status === 'pending').length
            },
            facts: this.knowledge.facts.length,
            questions: {
                total: this.questions.items.length,
                pending: pending.length,
                resolved: resolved.length,
                critical: critical.length
            },
            decisions: this.knowledge.decisions.length,
            risks: this.knowledge.risks.length,
            people: this.knowledge.people.length
        };
    }

    // ==================== Search ====================

    search(query, options = {}) {
        const searchTerm = query.toLowerCase().trim();
        const limit = options.limit || 50;

        const results = {
            query,
            total: 0,
            facts: this.knowledge.facts.filter(f => f.content.toLowerCase().includes(searchTerm)).slice(0, limit),
            questions: this.questions.items.filter(q => q.content.toLowerCase().includes(searchTerm)).slice(0, limit),
            decisions: this.knowledge.decisions.filter(d => d.content.toLowerCase().includes(searchTerm)).slice(0, limit),
            risks: this.knowledge.risks.filter(r => r.content.toLowerCase().includes(searchTerm)).slice(0, limit),
            people: this.knowledge.people.filter(p => p.name.toLowerCase().includes(searchTerm)).slice(0, limit)
        };

        results.total = results.facts.length + results.questions.length + results.decisions.length + results.risks.length + results.people.length;
        return results;
    }

    // ==================== Advanced RAG Support ====================

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
            'erp': 'erp enterprise resource planning',
            'hr': 'hr human resources',
            'qa': 'qa quality assurance',
            'dev': 'developer development',
            'prod': 'production',
            'env': 'environment',
            'config': 'configuration',
            'auth': 'authentication authorization',
            'admin': 'administrator administration',
            'mgr': 'manager',
            'dept': 'department',
            'info': 'information',
            'req': 'request requirement',
            'spec': 'specification',
            'doc': 'document documentation',
            'impl': 'implementation',
            'perf': 'performance',
            'sync': 'synchronization',
            'async': 'asynchronous'
        };

        // Normalize: lowercase, trim, collapse whitespace
        let normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');

        // Remove common filler words for term extraction
        const fillerWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'who', 'where', 'when', 'why', 'how', 'can', 'could', 'would', 'should', 'do', 'does', 'did', 'have', 'has', 'had', 'be', 'been', 'being', 'this', 'that', 'these', 'those', 'for', 'with', 'about', 'into', 'from', 'and', 'or', 'but', 'not', 'all', 'any', 'some'];

        // Extract meaningful terms
        const terms = normalized
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 2 && !fillerWords.includes(t));

        // Expand abbreviations
        let expanded = normalized;
        for (const [abbr, full] of Object.entries(abbreviations)) {
            const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
            if (regex.test(normalized)) {
                expanded = expanded.replace(regex, full);
            }
        }

        // Add synonyms/related terms for common queries
        const synonyms = {
            'people': 'people person team member contact',
            'risk': 'risk danger issue problem concern',
            'decision': 'decision choice determination verdict',
            'question': 'question inquiry query ask',
            'action': 'action task todo item activity',
            'deadline': 'deadline due date timeline schedule',
            'status': 'status state condition progress',
            'owner': 'owner responsible assigned person'
        };

        for (const [term, expansion] of Object.entries(synonyms)) {
            if (terms.includes(term)) {
                expanded += ' ' + expansion;
            }
        }

        return {
            original: query,
            normalized: normalized,
            expanded: expanded.trim(),
            terms: [...new Set(terms)] // Unique terms
        };
    }

    /**
     * Classify query type for routing
     * @param {string} query - User query
     * @returns {string} - Query type: 'factual', 'list', 'status', 'person', 'comparison', 'unknown'
     */
    classifyQuery(query) {
        const q = query.toLowerCase();

        // Status/state queries
        if (/\b(status|state|progress|estado)\b/i.test(q)) return 'status';

        // List queries
        if (/^(list|show|get|what are|quais são)\b/i.test(q)) return 'list';

        // Person queries
        if (/\b(who|quem|person|people|contact|team)\b/i.test(q)) return 'person';

        // Count queries
        if (/\b(how many|count|total|quantos)\b/i.test(q)) return 'count';

        // Comparison queries
        if (/\b(compare|difference|versus|vs)\b/i.test(q)) return 'comparison';

        // Factual queries
        if (/^(what|when|where|why|how|o que|quando|onde)\b/i.test(q)) return 'factual';

        return 'general';
    }

    /**
     * Calculate BM25-style keyword relevance score
     * @param {string} query - Search query
     * @param {string} text - Text to score
     * @returns {number} - Score between 0 and 1
     */
    keywordScore(query, text) {
        if (!query || !text) return 0;

        const queryTerms = query.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 2);

        if (queryTerms.length === 0) return 0;

        const textLower = text.toLowerCase();
        const textTerms = textLower
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 2);

        let matchedTerms = 0;
        let exactMatches = 0;

        for (const term of queryTerms) {
            // Exact term match
            if (textTerms.includes(term)) {
                matchedTerms++;
                exactMatches++;
            }
            // Partial match (substring)
            else if (textLower.includes(term)) {
                matchedTerms += 0.5;
            }
        }

        // Boost for exact phrase match
        const phraseBoost = textLower.includes(query.toLowerCase()) ? 0.3 : 0;

        // Calculate score: term coverage + phrase boost
        const termScore = matchedTerms / queryTerms.length;
        return Math.min(1, termScore + phraseBoost);
    }

    /**
     * Hybrid search combining semantic and keyword scores
     * @param {string} query - Search query
     * @param {Array} semanticResults - Results from semantic search [{id, similarity}]
     * @param {object} options - {semanticWeight: 0.7, keywordWeight: 0.3, minScore: 0.2, limit: 10}
     * @returns {Array} - Combined and re-ranked results
     */
    hybridSearch(query, semanticResults = [], options = {}) {
        const {
            semanticWeight = 0.6,
            keywordWeight = 0.4,
            minScore = 0.15,
            limit = 15
        } = options;

        // Get all items for keyword scoring
        const allItems = this.getAllItemsForEmbedding();
        const itemMap = new Map(allItems.map(item => [item.id, item]));

        // Create a map for semantic scores
        const semanticScores = new Map(
            semanticResults.map(r => [r.id, r.similarity])
        );

        // Calculate hybrid scores for all items
        const scoredItems = allItems.map(item => {
            const semScore = semanticScores.get(item.id) || 0;
            const kwScore = this.keywordScore(query, item.text);

            // Hybrid score: weighted combination
            const hybridScore = (semScore * semanticWeight) + (kwScore * keywordWeight);

            // Boost if both methods agree (high scores in both)
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

        // Filter by minimum score and sort by hybrid score
        return scoredItems
            .filter(item => item.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Get items with source metadata for better context
     * @param {Array} ids - Item IDs to retrieve
     * @returns {Array} - Items with enhanced metadata
     */
    getItemsWithMetadata(ids) {
        const items = this.getAllItemsForEmbedding().filter(item => ids.includes(item.id));

        return items.map(item => {
            const enhanced = { ...item };

            // Add source document info if available
            if (item.data?.source_file) {
                enhanced.source = item.data.source_file;
            }

            // Add creation date
            if (item.data?.created_at) {
                enhanced.date = item.data.created_at.split('T')[0];
            }

            // Add category for facts
            if (item.type === 'fact' && item.data?.category) {
                enhanced.category = item.data.category;
            }

            // Add priority for questions
            if (item.type === 'question' && item.data?.priority) {
                enhanced.priority = item.data.priority;
            }

            // Add impact for risks
            if (item.type === 'risk' && item.data?.impact) {
                enhanced.impact = item.data.impact;
            }

            // Add conversation metadata
            if (item.type === 'conversation' && item.data) {
                enhanced.conversationId = item.data.conversationId;
                enhanced.sourceApp = item.data.sourceApp;
                enhanced.conversationTitle = item.data.conversationTitle || item.data.title;
                enhanced.participants = item.data.participants || item.data.chunkSpeakers;
                enhanced.source = item.data.conversationTitle || `Conversation (${item.data.sourceApp})`;
            }

            return enhanced;
        });
    }

    // ==================== RAG Support ====================

    getAllItemsForEmbedding() {
        const items = [];

        this.knowledge.facts.forEach(f => {
            items.push({ id: `fact_${f.id}`, type: 'fact', text: `[${f.category}] ${f.content}`, data: f });
        });

        this.knowledge.decisions.forEach(d => {
            items.push({ id: `decision_${d.id}`, type: 'decision', text: d.content, data: d });
        });

        this.knowledge.risks.forEach(r => {
            items.push({ id: `risk_${r.id}`, type: 'risk', text: `Risk: ${r.content}`, data: r });
        });

        this.questions.items.forEach(q => {
            let text = `Question: ${q.content}`;
            if (q.answer) text += ` Answer: ${q.answer}`;
            items.push({ id: `question_${q.id}`, type: 'question', text, data: q });
        });

        this.knowledge.people.forEach(p => {
            items.push({ id: `person_${p.id}`, type: 'person', text: `${p.name} - ${p.role || 'unknown role'}`, data: p });
        });

        // Add conversation chunks
        if (this.conversations && this.conversations.items) {
            const conversations = require('./conversations');
            const convItems = conversations.getConversationEmbeddingItems(this.conversations.items);
            items.push(...convItems);
        }

        return items;
    }

    saveEmbeddings(embeddings) {
        const data = {
            version: '2.0',
            generated_at: new Date().toISOString(),
            model: embeddings.model || 'unknown',
            count: embeddings.length,
            embeddings
        };
        fs.writeFileSync(this.embeddingsPath, JSON.stringify(data));
        return data;
    }

    loadEmbeddings(forceRefresh = false) {
        const now = Date.now();

        // Return cached if valid and not forcing refresh
        if (!forceRefresh &&
            this._embeddingsCache &&
            this._embeddingsCacheTime &&
            (now - this._embeddingsCacheTime) < this._embeddingsCacheTTL) {
            return this._embeddingsCache;
        }

        // Load from disk
        if (fs.existsSync(this.embeddingsPath)) {
            try {
                this._embeddingsCache = JSON.parse(fs.readFileSync(this.embeddingsPath, 'utf8'));
                this._embeddingsCacheTime = now;
                return this._embeddingsCache;
            } catch (e) {
                log.warn({ event: 'storage_embeddings_load_error', reason: e.message }, 'Error loading embeddings');
            }
        }
        return null;
    }

    /**
     * Invalidate embeddings cache (call after rebuilding)
     */
    invalidateEmbeddingsCache() {
        this._embeddingsCache = null;
        this._embeddingsCacheTime = null;
    }

    getEmbeddingStatus() {
        const embeddingsData = this.loadEmbeddings();
        const items = this.getAllItemsForEmbedding();

        if (!embeddingsData) {
            return { indexed: false, count: 0, total: items.length, model: null, generated_at: null };
        }

        return {
            indexed: true,
            count: embeddingsData.count || 0,
            total: items.length,
            model: embeddingsData.model,
            generated_at: embeddingsData.generated_at,
            stale: items.length !== (embeddingsData.count || 0)
        };
    }

    getItemsByIds(ids) {
        return this.getAllItemsForEmbedding().filter(item => ids.includes(item.id));
    }

    // ==================== Export to Markdown (on-demand) ====================

    exportToMarkdown() {
        const projectDir = this.getProjectDataDir();

        // SOURCE_OF_TRUTH.md
        let sot = `# SOURCE OF TRUTH\n\n`;
        sot += `> Generated: ${new Date().toISOString()}\n`;
        sot += `> Facts: ${this.knowledge.facts.length} | Decisions: ${this.knowledge.decisions.length} | Risks: ${this.knowledge.risks.length}\n\n`;

        if (this.knowledge.facts.length > 0) {
            sot += `## Facts\n\n`;
            const categories = [...new Set(this.knowledge.facts.map(f => f.category || 'general'))];
            for (const cat of categories) {
                sot += `### ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n\n`;
                this.knowledge.facts.filter(f => (f.category || 'general') === cat).forEach(f => {
                    sot += `- ${f.content}\n`;
                });
                sot += '\n';
            }
        }

        if (this.knowledge.decisions.length > 0) {
            sot += `## Decisions\n\n`;
            this.knowledge.decisions.forEach(d => {
                sot += `- **${d.content}**`;
                if (d.owner) sot += ` (${d.owner})`;
                sot += '\n';
            });
            sot += '\n';
        }

        if (this.knowledge.risks.length > 0) {
            sot += `## Risks\n\n`;
            this.knowledge.risks.forEach(r => {
                sot += `- **${r.content}** | Impact: ${r.impact} | Likelihood: ${r.likelihood}\n`;
            });
            sot += '\n';
        }

        fs.writeFileSync(path.join(projectDir, 'SOURCE_OF_TRUTH.md'), sot);

        // PENDING_QUESTIONS.md - Grouped by Person (like ENGIE)
        const pending = this.questions.items.filter(q => q.status === 'pending');
        let pq = `# PENDING QUESTIONS\n\n`;
        pq += `> Generated: ${new Date().toISOString()}\n`;
        pq += `> Pending: ${pending.length}\n\n`;

        // Group by person (assigned_to)
        const byPerson = {};
        for (const q of pending) {
            const person = q.assigned_to || 'Unassigned';
            if (!byPerson[person]) byPerson[person] = [];
            byPerson[person].push(q);
        }

        // Sort persons: Unassigned last
        const sortedPersons = Object.keys(byPerson).sort((a, b) => {
            if (a === 'Unassigned') return 1;
            if (b === 'Unassigned') return -1;
            return a.localeCompare(b);
        });

        for (const person of sortedPersons) {
            const qs = byPerson[person];
            pq += `## ${person}\n\n`;

            // Group by priority within person
            const critical = qs.filter(q => q.priority === 'critical');
            const high = qs.filter(q => q.priority === 'high');
            const medium = qs.filter(q => q.priority === 'medium' || !q.priority);

            if (critical.length > 0) {
                pq += `**Critical:**\n`;
                critical.forEach(q => {
                    pq += `- [ ] **Q-${q.id}**: ${q.content}\n`;
                    if (q.context) pq += `  - Context: ${q.context}\n`;
                });
                pq += '\n';
            }

            if (high.length > 0) {
                pq += `**High:**\n`;
                high.forEach(q => {
                    pq += `- [ ] **Q-${q.id}**: ${q.content}\n`;
                    if (q.context) pq += `  - Context: ${q.context}\n`;
                });
                pq += '\n';
            }

            if (medium.length > 0) {
                pq += `**Medium:**\n`;
                medium.forEach(q => {
                    pq += `- [ ] **Q-${q.id}**: ${q.content}\n`;
                    if (q.context) pq += `  - Context: ${q.context}\n`;
                });
                pq += '\n';
            }
        }

        fs.writeFileSync(path.join(projectDir, 'PENDING_QUESTIONS.md'), pq);

        log.debug({ event: 'storage_markdown_exported' }, 'Markdown files exported');
        return { sot, pq };
    }

    // Alias for backward compatibility
    regenerateMarkdown() {
        return this.exportToMarkdown();
    }

    // Alias for backward compatibility
    buildKnowledgeJSON() {
        return this.knowledge;
    }

    saveKnowledgeJSON() {
        this.saveKnowledge();
        return this.knowledge;
    }

    loadKnowledgeJSON() {
        return this.knowledge;
    }

    buildQuestionsJSON() {
        return this.questions;
    }

    saveQuestionsJSON() {
        this.saveQuestions();
        return this.questions;
    }

    // ==================== Data Cleanup ====================

    normalizeAllCategories() {
        let changed = 0;
        for (const fact of this.knowledge.facts) {
            const normalized = this.normalizeCategory(fact.category);
            if (normalized !== fact.category) {
                log.debug({ event: 'storage_category_normalized', from: fact.category, to: normalized }, 'Category normalized');
                fact.category = normalized;
                changed++;
            }
        }
        if (changed > 0) {
            this.saveKnowledge();
            log.debug({ event: 'storage_categories_normalized', changed }, 'Normalized fact categories');
        }
        return changed;
    }

    // ==================== Data Recovery ====================

    /**
     * Recover data from change_log when arrays are empty but change_log has entries
     * This can happen if there was a bug or reset that didn't preserve data
     */
    recoverFromChangeLog() {
        const changeLog = this.knowledge.change_log || [];

        if (changeLog.length === 0) {
            return { recovered: false, message: 'No change_log entries to recover from' };
        }

        const stats = {
            facts: 0,
            decisions: 0,
            risks: 0,
            action_items: 0,
            questions: 0
        };

        // Group entries by type (only 'add' actions)
        const addEntries = changeLog.filter(e => e.action === 'add');

        // Recover facts
        const factEntries = addEntries.filter(e => e.type === 'fact');
        for (const entry of factEntries) {
            // Check if already exists
            if (this.knowledge.facts.some(f => f.id === entry.id)) continue;

            this.knowledge.facts.push({
                id: entry.id,
                content: entry.summary,
                category: 'general',
                confidence: 1.0,
                source_file: entry.source || null,
                created_at: entry.timestamp
            });
            stats.facts++;
        }

        // Recover decisions
        const decisionEntries = addEntries.filter(e => e.type === 'decision');
        for (const entry of decisionEntries) {
            if (this.knowledge.decisions.some(d => d.id === entry.id)) continue;

            this.knowledge.decisions.push({
                id: entry.id,
                title: entry.summary,
                description: entry.summary,
                status: 'approved',
                date: entry.timestamp.split('T')[0],
                source_file: entry.source || null,
                created_at: entry.timestamp
            });
            stats.decisions++;
        }

        // Recover risks
        const riskEntries = addEntries.filter(e => e.type === 'risk');
        for (const entry of riskEntries) {
            if (this.knowledge.risks.some(r => r.id === entry.id)) continue;

            this.knowledge.risks.push({
                id: entry.id,
                title: entry.summary,
                description: entry.summary,
                severity: 'medium',
                probability: 'medium',
                status: 'open',
                source_file: entry.source || null,
                created_at: entry.timestamp
            });
            stats.risks++;
        }

        // Recover action items
        const actionEntries = addEntries.filter(e => e.type === 'action_item');
        for (const entry of actionEntries) {
            if (this.knowledge.action_items.some(a => a.id === entry.id)) continue;

            this.knowledge.action_items.push({
                id: entry.id,
                description: entry.summary,
                status: 'pending',
                priority: 'medium',
                source_file: entry.source || null,
                created_at: entry.timestamp
            });
            stats.action_items++;
        }

        // Recover questions
        const questionEntries = addEntries.filter(e => e.type === 'question');
        for (const entry of questionEntries) {
            if (this.questions.items.some(q => q.id === entry.id)) continue;

            this.questions.items.push({
                id: entry.id,
                content: entry.summary,
                status: 'open',
                priority: 'medium',
                source_file: entry.source || null,
                created_at: entry.timestamp
            });
            stats.questions++;
        }

        // Save if anything was recovered
        const totalRecovered = Object.values(stats).reduce((a, b) => a + b, 0);
        if (totalRecovered > 0) {
            this.saveKnowledge();
            this.saveQuestions();
            log.debug({ event: 'storage_recovery', stats }, 'Recovered from change_log');
        }

        return {
            recovered: totalRecovered > 0,
            stats,
            totalRecovered,
            changeLogEntries: changeLog.length
        };
    }

    // ==================== Reset ====================

    /**
     * Reset knowledge data for the current project. Preserves: contacts (and teams),
     * and any cost-tracking files in the project dir. Clears: facts, decisions, risks,
     * actions, questions, people, relationships, documents, conversations, history, embeddings.
     */
    reset() {
        this.knowledge = {
            version: '2.0',
            facts: [],
            decisions: [],
            risks: [],
            people: [],
            relationships: [],
            action_items: [],
            change_log: [],
            updated_at: new Date().toISOString()
        };
        this.questions = {
            version: '2.0',
            items: [],
            updated_at: new Date().toISOString()
        };
        this.documents = {
            version: '2.0',
            items: [],
            updated_at: new Date().toISOString()
        };
        this.history = {
            version: '2.0',
            sessions: [],
            file_logs: [],
            updated_at: new Date().toISOString()
        };

        // Also reset conversations
        this.conversations = {
            version: '1.0',
            items: [],
            updated_at: new Date().toISOString()
        };
        this.saveConversations();

        this.saveAll();
        this.saveHistory();

        // Remove embeddings
        if (fs.existsSync(this.embeddingsPath)) {
            fs.unlinkSync(this.embeddingsPath);
        }
    }

    /**
     * Clean orphan data - data without valid sources
     * Call this after deleting documents/conversations to clean up extracted data
     */
    cleanOrphanData() {
        const stats = {
            facts: 0,
            decisions: 0,
            risks: 0,
            actions: 0,
            people: 0,
            questions: 0
        };

        // Get valid source files from documents and conversations
        const validSources = new Set();

        // Add document sources
        if (this.documents && this.documents.items) {
            this.documents.items.forEach(doc => {
                if (doc.path) validSources.add(doc.path);
                if (doc.filename) validSources.add(doc.filename);
            });
        }

        // Add conversation sources
        if (this.conversations && this.conversations.items) {
            this.conversations.items.forEach(conv => {
                validSources.add(`conversation_${conv.id}`);
                if (conv.title) validSources.add(conv.title);
            });
        }

        // If no valid sources, clear all extracted data
        const hasNoSources = validSources.size === 0;

        // Clean facts
        const factsBefore = this.knowledge.facts.length;
        if (hasNoSources) {
            this.knowledge.facts = [];
        } else {
            this.knowledge.facts = this.knowledge.facts.filter(f => {
                if (!f.source_file) return false; // No source = orphan
                return validSources.has(f.source_file);
            });
        }
        stats.facts = factsBefore - this.knowledge.facts.length;

        // Clean decisions
        const decisionsBefore = this.knowledge.decisions.length;
        if (hasNoSources) {
            this.knowledge.decisions = [];
        } else {
            this.knowledge.decisions = this.knowledge.decisions.filter(d => {
                if (!d.source_file && !d.meeting) return false;
                return validSources.has(d.source_file) || validSources.has(d.meeting);
            });
        }
        stats.decisions = decisionsBefore - this.knowledge.decisions.length;

        // Clean risks
        const risksBefore = this.knowledge.risks.length;
        if (hasNoSources) {
            this.knowledge.risks = [];
        } else {
            this.knowledge.risks = this.knowledge.risks.filter(r => {
                if (!r.source_file) return false;
                return validSources.has(r.source_file);
            });
        }
        stats.risks = risksBefore - this.knowledge.risks.length;

        // Clean action items
        const actionsBefore = this.knowledge.action_items.length;
        if (hasNoSources) {
            this.knowledge.action_items = [];
        } else {
            this.knowledge.action_items = this.knowledge.action_items.filter(a => {
                if (!a.source_file && !a.meeting) return false;
                return validSources.has(a.source_file) || validSources.has(a.meeting);
            });
        }
        stats.actions = actionsBefore - this.knowledge.action_items.length;

        // Clean people (keep those with isContact flag, remove extracted ones without sources)
        const peopleBefore = this.knowledge.people.length;
        if (hasNoSources) {
            // Keep only contacts, remove extracted people
            this.knowledge.people = this.knowledge.people.filter(p => p.isContact);
        }
        stats.people = peopleBefore - this.knowledge.people.length;

        // Clean questions
        const questionsBefore = this.questions.items.length;
        if (hasNoSources) {
            this.questions.items = [];
        } else {
            this.questions.items = this.questions.items.filter(q => {
                if (!q.source_file && !q.meeting) return false;
                return validSources.has(q.source_file) || validSources.has(q.meeting);
            });
        }
        stats.questions = questionsBefore - this.questions.items.length;

        // Save if anything changed
        const totalCleaned = Object.values(stats).reduce((a, b) => a + b, 0);
        if (totalCleaned > 0) {
            this.saveAll();
            log.debug({ event: 'storage_cleaned_orphans', stats }, 'Cleaned orphan data');
        }

        return stats;
    }

    // Backward compatibility - no-op
    close() { }
    cleanupBadData() { return { decisions: 0, people: 0 }; }
    invalidateRAGCache() {
        // Clear embeddings cache
        this._embeddingsCache = null;
        this._embeddingsCacheTime = null;
    }

    // ==================== History & Logging ====================

    saveHistory() {
        this._saveJSON(this.historyPath, this.history);
    }

    logProcessing(action, details = {}) {
        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            action: action,
            files_processed: details.files_processed || 0,
            facts_extracted: details.facts_extracted || 0,
            questions_added: details.questions_added || 0,
            decisions_extracted: details.decisions_extracted || 0,
            errors: details.extra?.errors || 0
        };
        this.history.sessions.unshift(entry);
        // Keep only last 100 sessions
        if (this.history.sessions.length > 100) {
            this.history.sessions = this.history.sessions.slice(0, 100);
        }
        this.saveHistory();
        return entry;
    }

    logFileProcessing(details) {
        const entry = {
            id: Date.now(),
            timestamp: details.started_at || new Date().toISOString(),
            completed_at: details.completed_at || new Date().toISOString(),
            document_id: details.document_id,
            filename: details.filename,
            method: details.method,
            chunks_processed: details.chunks_processed || 0,
            pages_processed: details.pages_processed || 0,
            facts_extracted: details.facts_extracted || 0,
            questions_extracted: details.questions_extracted || 0,
            decisions_extracted: details.decisions_extracted || 0,
            risks_extracted: details.risks_extracted || 0,
            actions_extracted: details.actions_extracted || 0,
            people_extracted: details.people_extracted || 0,
            processing_time_ms: details.processing_time_ms || 0,
            status: details.status || 'unknown',
            error_message: details.error_message || null,
            // AI-generated metadata
            ai_title: details.ai_title || null,
            ai_summary: details.ai_summary || null
        };
        this.history.file_logs.unshift(entry);
        // Keep only last 500 file logs
        if (this.history.file_logs.length > 500) {
            this.history.file_logs = this.history.file_logs.slice(0, 500);
        }
        this.saveHistory();
        return entry;
    }

    getHistory() {
        return this.history.sessions || [];
    }

    getFileLogs(limit = 50) {
        const logs = this.history.file_logs || [];

        // Calculate extraction counts per document based on source_file references
        const extractionCounts = this._calculateExtractionCountsPerDocument();

        // Enrich logs with document info (filename, name, summary, counts)
        const enrichedLogs = logs.map(log => {
            // Find the corresponding document
            const doc = this.documents.items.find(d => d.id === log.document_id);

            // Get counts for this document
            const docName = doc ? (doc.name || doc.filename) : log.filename;
            const baseName = docName ? docName.replace(/\.[^/.]+$/, '') : '';
            const counts = extractionCounts[baseName.toLowerCase()] || {};

            if (doc) {
                return {
                    ...log,
                    filename: doc.name || doc.filename || 'Unknown',
                    ai_title: doc.ai_title || doc.name,
                    ai_summary: doc.ai_summary || doc.summary || null,
                    file_path: doc.path,
                    file_type: doc.type,
                    content_length: doc.content_length,
                    completed_at: log.timestamp || doc.processed_at,
                    // Override with calculated counts
                    facts_extracted: counts.facts || log.facts_extracted || 0,
                    decisions_extracted: counts.decisions || log.decisions_extracted || 0,
                    risks_extracted: counts.risks || log.risks_extracted || 0,
                    people_extracted: counts.people || log.people_extracted || 0,
                    actions_extracted: counts.actions || log.actions_extracted || 0
                };
            }

            return {
                ...log,
                filename: log.filename || 'Unknown Document',
                completed_at: log.timestamp,
                facts_extracted: counts.facts || log.facts_extracted || 0,
                decisions_extracted: counts.decisions || log.decisions_extracted || 0,
                risks_extracted: counts.risks || log.risks_extracted || 0,
                people_extracted: counts.people || log.people_extracted || 0,
                actions_extracted: counts.actions || log.actions_extracted || 0
            };
        });

        // Sort by timestamp descending (most recent first)
        enrichedLogs.sort((a, b) => {
            const dateA = new Date(a.completed_at || a.timestamp || 0);
            const dateB = new Date(b.completed_at || b.timestamp || 0);
            return dateB - dateA;
        });

        // Return limited results
        return enrichedLogs.slice(0, limit);
    }

    /**
     * Calculate extraction counts per document based on source_file references
     */
    _calculateExtractionCountsPerDocument() {
        const counts = {};

        // Helper to add count for a source
        const addCount = (sourceField, type) => {
            if (!sourceField) return;

            // source_file can be comma-separated
            const sources = sourceField.split(',').map(s => s.trim().toLowerCase());
            sources.forEach(source => {
                // Remove file extension and path for matching
                const baseName = source.replace(/\.[^/.]+$/, '').split(/[\/\\]/).pop();
                if (!counts[baseName]) {
                    counts[baseName] = { facts: 0, decisions: 0, risks: 0, people: 0, actions: 0 };
                }
                counts[baseName][type]++;
            });
        };

        // Count facts
        (this.knowledge.facts || []).forEach(f => addCount(f.source_file || f.meeting, 'facts'));

        // Count decisions
        (this.knowledge.decisions || []).forEach(d => addCount(d.source_file || d.meeting, 'decisions'));

        // Count risks
        (this.knowledge.risks || []).forEach(r => addCount(r.source_file || r.meeting, 'risks'));

        // Count people (from source_file if available)
        (this.knowledge.people || []).forEach(p => {
            if (p.source_file) addCount(p.source_file, 'people');
        });

        // Count action items
        (this.knowledge.actionItems || []).forEach(a => addCount(a.source_file || a.meeting, 'actions'));

        return counts;
    }

    // ==================== Stats History & Trends ====================

    /**
     * Load stats history from file
     */
    loadStatsHistory() {
        if (!this.statsHistoryPath) return;

        this.statsHistory = this._loadJSON(this.statsHistoryPath, {
            version: '1.0',
            snapshots: [],
            updated_at: new Date().toISOString()
        });
    }

    /**
     * Save stats history to file
     */
    saveStatsHistory() {
        if (!this.statsHistoryPath || !this.statsHistory) return;
        this._saveJSON(this.statsHistoryPath, this.statsHistory);
    }

    /**
     * Record a daily stats snapshot
     * Should be called once per day (on startup or periodically)
     */
    recordDailyStats() {
        if (!this.statsHistory) {
            this.loadStatsHistory();
        }

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Check if we already have a snapshot for today
        const existingToday = this.statsHistory.snapshots.find(s => s.date === today);
        if (existingToday) {
            // Update today's snapshot with current counts
            existingToday.facts = this.knowledge.facts.length;
            existingToday.questions = this.questions.items.filter(q => q.status !== 'resolved').length;
            existingToday.questionsResolved = this.questions.items.filter(q => q.status === 'resolved').length;
            existingToday.risks = this.knowledge.risks.filter(r => r.status !== 'mitigated').length;
            existingToday.risksMitigated = this.knowledge.risks.filter(r => r.status === 'mitigated').length;
            existingToday.actions = this.knowledge.action_items.filter(a => a.status !== 'completed').length;
            existingToday.actionsCompleted = this.knowledge.action_items.filter(a => a.status === 'completed').length;
            existingToday.decisions = this.knowledge.decisions.length;
            existingToday.people = this.knowledge.people.length;
            existingToday.documents = this.documents.items.filter(d => d.status === 'processed').length;
            this.saveStatsHistory();
            return existingToday;
        }

        // Create new snapshot
        const snapshot = {
            date: today,
            facts: this.knowledge.facts.length,
            questions: this.questions.items.filter(q => q.status !== 'resolved').length,
            questionsResolved: this.questions.items.filter(q => q.status === 'resolved').length,
            risks: this.knowledge.risks.filter(r => r.status !== 'mitigated').length,
            risksMitigated: this.knowledge.risks.filter(r => r.status === 'mitigated').length,
            actions: this.knowledge.action_items.filter(a => a.status !== 'completed').length,
            actionsCompleted: this.knowledge.action_items.filter(a => a.status === 'completed').length,
            decisions: this.knowledge.decisions.length,
            people: this.knowledge.people.length,
            documents: this.documents.items.filter(d => d.status === 'processed').length
        };

        this.statsHistory.snapshots.push(snapshot);

        // Keep only last 90 days of history
        if (this.statsHistory.snapshots.length > 90) {
            this.statsHistory.snapshots = this.statsHistory.snapshots.slice(-90);
        }

        this.saveStatsHistory();
        return snapshot;
    }

    /**
     * Calculate trends by comparing current stats to previous period
     * @param {number} daysBack - How many days to compare against (default: 7)
     * @returns {object} - Trend data with direction and delta for each metric
     */
    getTrends(daysBack = 7) {
        if (!this.statsHistory || this.statsHistory.snapshots.length === 0) {
            return { hasTrends: false };
        }

        // Get current stats
        const current = {
            facts: this.knowledge.facts.length,
            questions: this.questions.items.filter(q => q.status !== 'resolved').length,
            risks: this.knowledge.risks.filter(r => r.status !== 'mitigated').length,
            actions: this.knowledge.action_items.filter(a => a.status !== 'completed').length,
            decisions: this.knowledge.decisions.length
        };

        // Find snapshot from daysBack ago
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - daysBack);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        // Find the closest snapshot on or before target date
        const sortedSnapshots = [...this.statsHistory.snapshots].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        let previous = null;
        for (const snapshot of sortedSnapshots) {
            if (snapshot.date <= targetDateStr) {
                previous = snapshot;
                break;
            }
        }

        // If no historical data, return no trends
        if (!previous) {
            return { hasTrends: false, reason: 'no_historical_data' };
        }

        // Calculate trends for each metric
        const calculateTrend = (currentVal, previousVal, invertBetter = false) => {
            const delta = currentVal - previousVal;
            let direction = 'stable';
            if (delta > 0) direction = 'up';
            else if (delta < 0) direction = 'down';

            // For most metrics: down is good (fewer pending items)
            // For facts, decisions: up is good (more knowledge)
            let sentiment = 'neutral';
            if (delta !== 0) {
                if (invertBetter) {
                    // Facts, decisions - more is better
                    sentiment = delta > 0 ? 'positive' : 'negative';
                } else {
                    // Questions, risks, actions - fewer pending is better
                    sentiment = delta < 0 ? 'positive' : 'negative';
                }
            }

            return { current: currentVal, previous: previousVal, delta, direction, sentiment };
        };

        return {
            hasTrends: true,
            periodDays: daysBack,
            compareDate: previous.date,
            facts: calculateTrend(current.facts, previous.facts || 0, true), // More facts = good
            questions: calculateTrend(current.questions, previous.questions || 0, false), // Fewer = good
            risks: calculateTrend(current.risks, previous.risks || 0, false), // Fewer = good
            actions: calculateTrend(current.actions, previous.actions || 0, false), // Fewer = good
            decisions: calculateTrend(current.decisions, previous.decisions || 0, true) // More = good
        };
    }

    /**
     * Get stats history for charts
     * @param {number} days - Number of days of history to return
     * @returns {Array} - Array of daily snapshots
     */
    getStatsHistory(days = 30) {
        if (!this.statsHistory || !this.statsHistory.snapshots) {
            return [];
        }

        // Sort by date descending and take last N days
        return [...this.statsHistory.snapshots]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, days)
            .reverse(); // Return in chronological order
    }

    /**
     * Generate human-readable trend insights
     * @returns {Array} - Array of insight objects with type, message, and severity
     */
    getTrendInsights() {
        const trends = this.getTrends(7);
        if (!trends.hasTrends) {
            return [];
        }

        const insights = [];

        // Helper to generate insight
        const addInsight = (metric, trend, labels) => {
            if (!trend || trend.direction === 'stable') return;

            const { current, previous, delta, direction, sentiment } = trend;
            const absChange = Math.abs(delta);
            const percentChange = previous > 0 ? Math.round((absChange / previous) * 100) : 100;

            // Determine severity based on magnitude and sentiment
            let severity = 'info';
            if (sentiment === 'negative') {
                severity = absChange >= 3 || percentChange >= 50 ? 'warning' : 'info';
            } else if (sentiment === 'positive') {
                severity = 'success';
            }

            // Generate message
            let message = '';
            const changeWord = direction === 'up' ? labels.upWord : labels.downWord;
            const trendWord = direction === 'up' ? 'increased' : 'decreased';

            if (absChange === 1) {
                message = `${labels.singular} ${changeWord} (${previous} → ${current})`;
            } else {
                message = `${labels.plural} ${trendWord} by ${absChange} (${previous} → ${current})`;
            }

            if (percentChange > 0 && previous > 0) {
                message += ` — ${percentChange}% change`;
            }

            insights.push({
                metric,
                message,
                severity,
                direction,
                sentiment,
                delta,
                icon: labels.icon
            });
        };

        // Generate insights for each metric
        addInsight('facts', trends.facts, {
            singular: 'New fact added',
            plural: 'Facts',
            upWord: 'added',
            downWord: 'removed',
            icon: '📋'
        });

        addInsight('questions', trends.questions, {
            singular: 'Pending question',
            plural: 'Pending questions',
            upWord: 'added',
            downWord: 'resolved',
            icon: '❓'
        });

        addInsight('risks', trends.risks, {
            singular: 'Risk',
            plural: 'Open risks',
            upWord: 'identified',
            downWord: 'mitigated',
            icon: '⚠️'
        });

        addInsight('actions', trends.actions, {
            singular: 'Action item',
            plural: 'Pending actions',
            upWord: 'added',
            downWord: 'completed',
            icon: '✅'
        });

        addInsight('decisions', trends.decisions, {
            singular: 'Decision made',
            plural: 'Decisions',
            upWord: 'made',
            downWord: 'removed',
            icon: '🎯'
        });

        // Sort by severity (warning first, then info, then success)
        const severityOrder = { warning: 0, info: 1, success: 2 };
        insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        return insights;
    }

    // ==================== Graph Database Integration ====================

    /**
     * Initialize graph database connection
     * @param {object} graphConfig - Graph configuration
     * @returns {Promise<{ok: boolean, error?: string}>}
     */
    async initGraph(graphConfig) {
        if (!graphConfig?.enabled) {
            log.debug({ event: 'storage_graph_disabled' }, 'Graph database disabled');
            return { ok: true, message: 'Graph disabled' };
        }

        try {
            const GraphFactory = require('./graph/GraphFactory');

            const providerId = graphConfig.provider || 'supabase';
            const providerConfig = {
                ...graphConfig[providerId],
                graphName: graphConfig.graphName || 'godmode',
                storage: this // Pass storage reference for JSON provider
            };

            this.graphProvider = GraphFactory.createProvider(providerId, providerConfig);
            const connectResult = await this.graphProvider.connect();

            if (!connectResult.ok) {
                log.warn({ event: 'storage_graph_connect_failed', reason: connectResult.error }, 'Failed to connect to graph');
                this.graphProvider = null;
                return connectResult;
            }

            log.debug({ event: 'storage_graph_connected', providerId }, 'Connected to graph database');
            return { ok: true };
        } catch (error) {
            log.warn({ event: 'storage_graph_init_error', reason: error.message }, 'Graph init error');
            this.graphProvider = null;
            return { ok: false, error: error.message };
        }
    }

    /**
     * Get graph provider instance
     * @returns {GraphProvider|null}
     */
    getGraphProvider() {
        return this.graphProvider || null;
    }

    /**
     * Sync current storage data to graph database
     * Uses ontology for validation and relationship inference
     * Supports multi-graph architecture (shared + project graphs)
     * @param {object} options - Sync options
     * @param {boolean} options.useOntology - Enable ontology validation (default: true)
     * @param {boolean} options.multiGraph - Use multi-graph architecture (default: false)
     * @param {string} options.projectId - Project ID for multi-graph sync
     * @returns {Promise<{ok: boolean, synced?: object, errors?: Array}>}
     */
    async syncToGraph(options = {}) {
        if (!this.graphProvider) {
            return { ok: false, error: 'Graph provider not initialized' };
        }

        const GraphRAGEngine = require('./graphrag/GraphRAGEngine');

        // Use multi-graph manager if enabled
        let multiGraphManager = null;
        if (options.multiGraph && this.graphProvider.switchGraph) {
            const { getMultiGraphManager } = require('./graph/MultiGraphManager');
            multiGraphManager = getMultiGraphManager(this.graphProvider);

            // Initialize with project context
            const projectId = options.projectId || this.projectId || 'default';
            await multiGraphManager.initialize(projectId);
        }

        const engine = new GraphRAGEngine({
            graphProvider: this.graphProvider,
            storage: this,
            useOntology: options.useOntology !== false,
            multiGraphManager: multiGraphManager,
            projectId: options.projectId || this.projectId
        });

        // If using multi-graph, use the manager's sync method
        if (multiGraphManager && options.multiGraph) {
            const projectId = options.projectId || this.projectId || 'default';

            // Prepare data by type
            const data = {
                persons: this.knowledge.people || [],
                technologies: [], // Extract from facts if needed
                clients: [], // Extract from knowledge if available
                organizations: [],
                facts: this.knowledge.facts || [],
                meetings: [],
                decisions: this.knowledge.decisions || [],
                risks: this.knowledge.risks || [],
                tasks: this.knowledge.tasks || []
            };

            return await multiGraphManager.syncData(data, projectId);
        }

        return await engine.syncToGraph();
    }

    /**
     * Get the multi-graph manager instance
     * @returns {MultiGraphManager|null}
     */
    getMultiGraphManager() {
        if (!this.graphProvider || !this.graphProvider.switchGraph) {
            return null;
        }
        const { getMultiGraphManager } = require('./graph/MultiGraphManager');
        return getMultiGraphManager(this.graphProvider);
    }

    /**
     * Generate enriched embeddings using ontology
     * @returns {Promise<{ok: boolean, count: number, errors?: Array}>}
     */
    async generateEnrichedEmbeddings() {
        const GraphRAGEngine = require('./graphrag/GraphRAGEngine');
        const engine = new GraphRAGEngine({
            graphProvider: this.graphProvider,
            storage: this,
            useOntology: true
        });

        return await engine.generateEnrichedEmbeddings();
    }

    /**
     * Get graph statistics
     * @returns {Promise<object>}
     */
    async getGraphStats() {
        if (!this.graphProvider) {
            return { enabled: false };
        }

        const stats = await this.graphProvider.getStats();
        return {
            enabled: true,
            connected: this.graphProvider.connected,
            ...stats
        };
    }

    /**
     * Sync FalkorDB graphs with Supabase projects
     * Removes orphan graphs that don't have associated projects
     * @param {object} options
     * @param {boolean} options.dryRun - If true, only report what would be deleted
     * @returns {Promise<{ok: boolean, graphs: string[], validGraphs: string[], orphanGraphs: string[], deleted: string[]}>}
     */
    async syncFalkorDBGraphs(options = {}) {
        const { dryRun = false } = options;

        if (!this.graphProvider || typeof this.graphProvider.listGraphs !== 'function') {
            return { ok: false, error: 'FalkorDB provider not available or does not support listGraphs' };
        }

        log.debug({ event: 'storage_sync_falkordb_start' }, 'Syncing FalkorDB graphs with Supabase projects');

        try {
            // 1. List all graphs in FalkorDB
            const graphsResult = await this.graphProvider.listGraphs();
            if (!graphsResult.ok) {
                return { ok: false, error: graphsResult.error || 'Failed to list graphs' };
            }
            const allGraphs = graphsResult.graphs || [];
            log.debug({ event: 'storage_falkordb_graphs', count: allGraphs.length, graphNames: allGraphs }, 'Found graphs in FalkorDB');

            // 2. Get valid project IDs from Supabase
            let validProjectIds = [];
            if (this.supabaseStorage && typeof this.supabaseStorage.listProjects === 'function') {
                const projects = await this.supabaseStorage.listProjects();
                validProjectIds = projects.map(p => p.id);
                log.debug({ event: 'storage_supabase_projects', count: validProjectIds.length }, 'Found projects in Supabase');
            }

            // 3. Build valid graph names
            // Graph names follow pattern: godmode_{projectId} or Godmode_{projectId} or godmode_default
            const validGraphNames = new Set();
            validGraphNames.add('godmode_default');
            validGraphNames.add('Godmode_default');

            for (const projectId of validProjectIds) {
                validGraphNames.add(`godmode_${projectId}`);
                validGraphNames.add(`Godmode_${projectId}`);
                // Also handle shorter IDs (first 8 chars of UUID)
                const shortId = projectId.substring(0, 8);
                validGraphNames.add(`godmode_${shortId}`);
                validGraphNames.add(`Godmode_${shortId}`);
            }

            // 4. Find orphan graphs
            const orphanGraphs = allGraphs.filter(g => !validGraphNames.has(g));
            const validGraphs = allGraphs.filter(g => validGraphNames.has(g));

            log.debug({ event: 'storage_valid_orphan_counts', valid: validGraphs.length, orphan: orphanGraphs.length }, 'Valid and orphan graphs');
            if (orphanGraphs.length > 0) {
                log.debug({ event: 'storage_orphans_to_delete', orphanGraphs }, 'Orphan graphs to delete');
            }

            // 5. Delete orphan graphs (unless dry run)
            const deleted = [];
            if (!dryRun && orphanGraphs.length > 0) {
                for (const graphName of orphanGraphs) {
                    try {
                        const deleteResult = await this.graphProvider.deleteGraph(graphName);
                        if (deleteResult.ok) {
                            deleted.push(graphName);
                            log.debug({ event: 'storage_orphan_deleted', graphName }, 'Deleted orphan graph');
                        } else {
                            log.warn({ event: 'storage_orphan_delete_failed', graphName, reason: deleteResult.error }, 'Failed to delete graph');
                        }
                    } catch (err) {
                        log.warn({ event: 'storage_orphan_delete_error', graphName, reason: err.message }, 'Error deleting graph');
                    }
                }
            }

            return {
                ok: true,
                graphs: allGraphs,
                validGraphs,
                orphanGraphs,
                deleted,
                dryRun
            };
        } catch (error) {
            log.warn({ event: 'storage_sync_falkordb_error', reason: error?.message }, 'syncFalkorDBGraphs error');
            return { ok: false, error: error.message };
        }
    }

    // ==================== Data Cleanup Methods ====================

    /**
     * Clean up old data based on age
     * @param {object} options - Cleanup options
     * @param {number} options.factsMaxAgeDays - Max age for facts (default: 365)
     * @param {number} options.questionsMaxAgeDays - Max age for resolved questions (default: 180)
     * @param {boolean} options.archiveInsteadOfDelete - Archive instead of delete (default: true)
     * @returns {{cleaned: object, archived: object}}
     */
    cleanupOldData(options = {}) {
        const {
            factsMaxAgeDays = 365,
            questionsMaxAgeDays = 180,
            archiveInsteadOfDelete = true
        } = options;

        const now = Date.now();
        const factsMaxAge = factsMaxAgeDays * 24 * 60 * 60 * 1000;
        const questionsMaxAge = questionsMaxAgeDays * 24 * 60 * 60 * 1000;

        const cleaned = { facts: 0, questions: 0 };
        const archived = { facts: [], questions: [] };

        // Clean old facts
        if (this.knowledge.facts) {
            const originalCount = this.knowledge.facts.length;
            this.knowledge.facts = this.knowledge.facts.filter(fact => {
                const createdAt = fact.created_at ? new Date(fact.created_at).getTime() : now;
                const age = now - createdAt;

                if (age > factsMaxAge) {
                    if (archiveInsteadOfDelete) {
                        archived.facts.push({ ...fact, archived_at: new Date().toISOString() });
                    }
                    cleaned.facts++;
                    return false;
                }
                return true;
            });

            if (cleaned.facts > 0) {
                log.debug({ event: 'storage_cleaned_facts', count: cleaned.facts }, 'Cleaned old facts');
            }
        }

        // Clean resolved questions older than threshold
        if (this.questions?.items) {
            const originalCount = this.questions.items.length;
            this.questions.items = this.questions.items.filter(question => {
                // Only clean resolved questions
                if (question.status !== 'resolved') return true;

                const resolvedAt = question.resolved_at ? new Date(question.resolved_at).getTime() :
                    question.created_at ? new Date(question.created_at).getTime() : now;
                const age = now - resolvedAt;

                if (age > questionsMaxAge) {
                    if (archiveInsteadOfDelete) {
                        archived.questions.push({ ...question, archived_at: new Date().toISOString() });
                    }
                    cleaned.questions++;
                    return false;
                }
                return true;
            });

            if (cleaned.questions > 0) {
                log.debug({ event: 'storage_cleaned_questions', count: cleaned.questions }, 'Cleaned old resolved questions');
            }
        }

        // Save archive if items were archived
        if (archiveInsteadOfDelete && (archived.facts.length > 0 || archived.questions.length > 0)) {
            this.saveArchive(archived);
        }

        // Save updated data
        if (cleaned.facts > 0 || cleaned.questions > 0) {
            this.save();
        }

        return { cleaned, archived: archiveInsteadOfDelete ? archived : null };
    }

    /**
     * Save archived data to a separate file
     * @param {object} archived 
     */
    saveArchive(archived) {
        const fs = require('fs');
        const path = require('path');

        const archiveFile = path.join(this.dataDir, 'archive.json');
        let existingArchive = { facts: [], questions: [], archivedAt: [] };

        try {
            if (fs.existsSync(archiveFile)) {
                existingArchive = JSON.parse(fs.readFileSync(archiveFile, 'utf-8'));
            }
        } catch (e) {
            log.debug({ event: 'storage_archive_read_failed' }, 'Could not read existing archive');
        }

        // Append new archived items
        existingArchive.facts.push(...(archived.facts || []));
        existingArchive.questions.push(...(archived.questions || []));
        existingArchive.archivedAt.push(new Date().toISOString());

        try {
            fs.writeFileSync(archiveFile, JSON.stringify(existingArchive, null, 2));
            log.debug({ event: 'storage_archived', facts: archived.facts?.length || 0, questions: archived.questions?.length || 0 }, 'Archived');
        } catch (e) {
            log.warn({ event: 'storage_archive_save_failed', reason: e.message }, 'Failed to save archive');
        }
    }

    /**
     * Get data statistics including memory usage
     * @returns {object}
     */
    getDataStats() {
        const facts = this.knowledge.facts?.length || 0;
        const people = this.knowledge.people?.length || 0;
        const decisions = this.knowledge.decisions?.length || 0;
        const risks = this.knowledge.risks?.length || 0;
        const questions = this.questions?.items?.length || 0;
        const documents = this.documents?.length || 0;

        // Estimate memory usage (rough)
        const estimateSize = (obj) => {
            try {
                return JSON.stringify(obj).length;
            } catch {
                return 0;
            }
        };

        const memoryBytes = estimateSize(this.knowledge) +
            estimateSize(this.questions) +
            estimateSize(this.documents);

        return {
            counts: { facts, people, decisions, risks, questions, documents },
            total: facts + people + decisions + risks + questions + documents,
            memoryEstimateKB: Math.round(memoryBytes / 1024),
            memoryEstimateMB: (memoryBytes / 1024 / 1024).toFixed(2)
        };
    }

    /**
     * Remove duplicate entries
     * @returns {{removed: object}}
     */
    removeDuplicates() {
        const removed = { facts: 0, people: 0 };

        // Remove duplicate facts (by content hash)
        if (this.knowledge.facts) {
            const seen = new Set();
            const original = this.knowledge.facts.length;
            this.knowledge.facts = this.knowledge.facts.filter(fact => {
                const hash = fact.content?.substring(0, 100) || fact.id;
                if (seen.has(hash)) {
                    removed.facts++;
                    return false;
                }
                seen.add(hash);
                return true;
            });
        }

        // Remove duplicate people (by name)
        if (this.knowledge.people) {
            const seen = new Set();
            const original = this.knowledge.people.length;
            this.knowledge.people = this.knowledge.people.filter(person => {
                const key = person.name?.toLowerCase();
                if (seen.has(key)) {
                    removed.people++;
                    return false;
                }
                seen.add(key);
                return true;
            });
        }

        if (removed.facts > 0 || removed.people > 0) {
            this.save();
            log.debug({ event: 'storage_removed_duplicates', facts: removed.facts, people: removed.people }, 'Removed duplicates');
        }

        return { removed };
    }
}

module.exports = Storage;
