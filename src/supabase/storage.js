/**
 * Purpose:
 *   Full-featured storage class that replaces the legacy JSON-file-based
 *   storage layer. Every data operation (facts, documents, decisions,
 *   contacts, projects, etc.) is persisted in Supabase PostgreSQL and
 *   optionally synced to the knowledge graph via an outbox pattern.
 *
 * Responsibilities:
 *   - CRUD for projects, facts, documents, decisions, risks, actions,
 *     questions, contacts, meeting notes, and project configuration
 *   - Manage per-instance auth context (currentUserId, currentProjectId)
 *   - In-memory cache with configurable TTL to reduce redundant reads
 *   - Legacy ID resolution: transparently map non-UUID project IDs to
 *     Supabase UUIDs for backward compatibility during migration
 *   - Create local filesystem directories for uploaded files per project
 *   - Push mutation events to the graph outbox for asynchronous sync
 *   - Provide a SupabaseGraphProvider instance for graph queries
 *
 * Key dependencies:
 *   - @supabase/supabase-js: Supabase client (created per instance)
 *   - ../graph/providers/supabase: SupabaseGraphProvider for graph layer
 *   - ../logger: structured logging
 *   - Node fs / path: local file directories for uploads
 *
 * Side effects:
 *   - Creates directories under `data/projects/<id>/` on project creation
 *   - Writes to numerous Supabase tables (projects, project_members,
 *     project_config, facts, documents, decisions, etc.)
 *   - Posts events to the `outbox` table for graph synchronization
 *
 * Notes:
 *   - This is a class-based module; consumers instantiate via
 *     `createSupabaseStorage()` (see storageHelper.js for the singleton).
 *   - The constructor eagerly initializes a SupabaseGraphProvider. If the
 *     graph provider module is unavailable, this will throw at require time.
 *   - `setProject()` clears the in-memory cache to avoid cross-project
 *     data leakage.
 *   - `createProjectWithServiceKey()` creates/reuses a "system@godmode.local"
 *     admin user for server-side automation -- the hardcoded password is
 *     acceptable because the user is only accessible via service_role key.
 *   - Deduplication uses a configurable `similarityThreshold` (default 0.90).
 *
 * Supabase tables accessed:
 *   - projects, project_members, project_config, companies
 *   - facts, documents, decisions, risks, actions, questions
 *   - contacts, meeting_notes, stats_history
 *   - graph_sync_status, outbox
 *   - user_profiles (for owner info and system user creation)
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { logger: rootLogger, logError } = require('../logger');

const log = rootLogger.child({ module: 'supabase' });

// Fix module resolution for project named 'node_modules'
const modulePath = path.join(__dirname, '..', '..', 'node_modules');
if (!module.paths.includes(modulePath)) {
    module.paths.unshift(modulePath);
}

const { createClient } = require('@supabase/supabase-js');

class SupabaseStorage {
    constructor(supabaseUrl, supabaseKey, options = {}) {
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;
        this.supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        });

        // Current context
        this.currentProjectId = null;
        this.currentUserId = null;

        // Local file storage base path (for uploaded files, not data)
        this.filesBasePath = options.filesBasePath || path.join(process.cwd(), 'data', 'projects');

        // Deduplication threshold
        this.similarityThreshold = options.similarityThreshold || 0.90;

        // Cache settings
        this._cache = new Map();
        this._cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes

        // Initialize Graph Provider
        const { SupabaseGraphProvider } = require('../graph/providers/supabase'); // This might need adjustment based on export
        // Actually, SupabaseGraphProvider is the class export based on previous view
        const SupabaseGraphProviderClass = require('../graph/providers/supabase').SupabaseGraphProvider || require('../graph/providers/supabase');

        this.graphProvider = new SupabaseGraphProviderClass({
            supabase: this.supabase,
            graphName: 'default',
            projectId: this.currentProjectId
        });
    }

    /**
     * Get the graph provider instance
     */
    getGraphProvider() {
        return this.graphProvider;
    }

    // ==================== Authentication & Context ====================

    /**
     * Set current user from Supabase Auth session
     */
    async setUser(user) {
        this.currentUserId = user?.id || null;
    }

    /**
     * Get current authenticated user
     */
    async getCurrentUser() {
        const { data: { user } } = await this.supabase.auth.getUser();
        return user;
    }

    /**
     * Set current project context
     */
    setProject(projectId) {
        this.currentProjectId = projectId;
        this._cache.clear(); // Clear cache on project switch

        if (this.graphProvider) {
            this.graphProvider.setProjectContext(projectId);
        }
    }

    /**
     * Get current project ID
     */
    getProjectId() {
        if (!this.currentProjectId) {
            throw new Error('No project selected. Call setProject() first.');
        }
        return this.currentProjectId;
    }

    // ==================== Project Management ====================

    /**
     * Check if a string is a valid UUID
     */
    _isValidUUID(str) {
        if (!str) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
    }

    /**
     * Find project by legacy ID or create if not exists
     * Works with service key (no auth required)
     * @param {string} legacyId - Legacy project ID (non-UUID)
     * @param {string} projectName - Name for new project if creating
     * @returns {object} Project data with UUID
     */
    async findOrCreateProjectByLegacyId(legacyId, projectName = 'Migrated Project') {
        // First, try to find existing project by legacy_id
        const { data: existingProject, error: findError } = await this.supabase
            .from('projects')
            .select('*')
            .eq('legacy_id', legacyId)
            .single();

        if (existingProject) {
            log.debug({ event: 'legacy_project_found', legacyId, resolvedId: existingProject.id }, 'Found project by legacy_id');
            return existingProject;
        }

        // Not found - create new project with legacy_id
        // Note: This requires a system user or service-level operation
        log.info({ event: 'legacy_project_create', legacyId }, 'Creating new project for legacy_id');

        const { data: newProject, error: createError } = await this.supabase
            .from('projects')
            .insert({
                name: projectName,
                legacy_id: legacyId,
                settings: { migratedFrom: 'local', originalId: legacyId }
            })
            .select()
            .single();

        if (createError) {
            log.warn({ event: 'project_create_failed', legacyId, err: createError.message }, 'Could not create project');
            return null;
        }

        log.info({ event: 'project_created', projectId: newProject.id, name: newProject.name }, 'Created project');
        return newProject;
    }

    /**
     * Set project, resolving legacy ID if needed
     * @param {string} projectId - UUID or legacy ID
     * @returns {Promise<string>} Resolved UUID
     */
    async setProjectWithLegacySupport(projectId, projectName = 'Default Project') {
        if (!projectId) {
            throw new Error('Project ID is required');
        }

        // If it's already a valid UUID, use it directly
        if (this._isValidUUID(projectId)) {
            this.currentProjectId = projectId;
            this._cache.clear();
            return projectId;
        }

        // It's a legacy ID - find or create the project
        const project = await this.findOrCreateProjectByLegacyId(projectId, projectName);

        if (project) {
            this.currentProjectId = project.id;
            this._cache.clear();
            log.debug({ event: 'legacy_id_mapped', projectId, resolvedId: project.id }, 'Mapped legacy ID');
            return project.id;
        }

        // Fallback: use the legacy ID directly (queries will fail but at least we don't crash)
        log.warn({ event: 'legacy_id_unresolved', projectId }, 'Using legacy ID directly (may cause query errors)');
        this.currentProjectId = projectId;
        this._cache.clear();
        return projectId;
    }

    /**
     * Create a new project
     * @param {string} name
     * @param {string} userRole
     * @param {string} [companyId] - optional; if missing, uses first company of user or creates "Minha Empresa"
     */
    async createProject(name, userRole = '', companyId = null, ownerId = null, accessToken = null) {
        if (!name || name.trim().length === 0) {
            throw new Error('Project name is required');
        }

        const user = ownerId ? { id: ownerId } : await this.getCurrentUser();
        if (!user) throw new Error('Authentication required');

        // Use scoped client if token is provided (to respect RLS)
        let client = this.supabase;
        if (accessToken) {
            const { createClient } = require('@supabase/supabase-js');
            client = createClient(this.supabaseUrl, this.supabaseKey, {
                global: {
                    headers: { Authorization: `Bearer ${accessToken}` }
                }
            });
        }

        if (!companyId) {
            const { data: list } = await client.from('companies').select('id').eq('owner_id', user.id).order('name').limit(1);
            if (list?.length) companyId = list[0].id;
            else {
                const { data: created, error: createErr } = await client.from('companies').insert({ name: 'Minha Empresa', owner_id: user.id }).select('id').single();
                if (createErr || !created?.id) throw new Error(createErr?.message || 'Could not create default company');
                companyId = created.id;
            }
        }

        const { data, error } = await client
            .from('projects')
            .insert({
                name: name.trim(),
                owner_id: user.id,
                company_id: companyId,
                settings: { userRole: userRole || '' }
            })
            .select()
            .single();

        if (error) throw error;

        // Create local file directory for this project
        const projectFilesDir = path.join(this.filesBasePath, data.id, 'files');
        fs.mkdirSync(projectFilesDir, { recursive: true });
        fs.mkdirSync(path.join(this.filesBasePath, data.id, 'archived'), { recursive: true });
        fs.mkdirSync(path.join(this.filesBasePath, data.id, 'temp'), { recursive: true });

        // Add owner as project member
        await client.from('project_members').insert({
            project_id: data.id,
            user_id: user.id,
            role: 'owner'
        });

        // Create default config
        await client.from('project_config').insert({
            project_id: data.id,
            user_role: userRole || '',
            updated_by: user.id
        });

        // Sync to graph via outbox
        await this._addToOutbox('project.created', 'CREATE', 'Project', data.id, data);

        log.info({ event: 'project_created', projectId: data.id, name }, 'Project created');
        return data;
    }

    /**
     * Create a new project using service key (no user auth required)
     * Used for server-side project creation
     */
    async createProjectWithServiceKey(name, userRole = '') {
        if (!name || name.trim().length === 0) {
            throw new Error('Project name is required');
        }

        // Find or create system user
        const systemEmail = 'system@godmode.local';
        let systemUserId = null;

        // Try to find system user
        const { data: users } = await this.supabase.auth.admin.listUsers();
        const systemUser = users?.users?.find(u => u.email === systemEmail);

        if (systemUser) {
            systemUserId = systemUser.id;
        } else {
            // Create system user
            const { data: newUser, error: userError } = await this.supabase.auth.admin.createUser({
                email: systemEmail,
                password: 'GodMode2026!SystemUser',
                email_confirm: true,
                user_metadata: { username: 'system', display_name: 'System User' }
            });

            if (userError) {
                log.error({ event: 'system_user_create_failed', err: userError.message }, 'Could not create system user');
                throw new Error('Could not create system user');
            }

            systemUserId = newUser.user.id;

            // Create user profile
            await this.supabase.from('user_profiles').upsert({
                id: systemUserId,
                username: 'system',
                display_name: 'System User',
                role: 'superadmin'
            }, { onConflict: 'id' });
        }

        // Get or create company for system user
        let companyId = null;
        const { data: companyList } = await this.supabase.from('companies').select('id').eq('owner_id', systemUserId).limit(1);
        if (companyList?.length) companyId = companyList[0].id;
        else {
            const { data: newCompany, error: companyErr } = await this.supabase.from('companies').insert({ name: 'System', owner_id: systemUserId }).select('id').single();
            if (companyErr || !newCompany?.id) throw new Error(companyErr?.message || 'Could not create system company');
            companyId = newCompany.id;
        }

        // Create the project
        const { data, error } = await this.supabase
            .from('projects')
            .insert({
                name: name.trim(),
                owner_id: systemUserId,
                company_id: companyId,
                settings: { userRole: userRole || '' }
            })
            .select()
            .single();

        if (error) throw error;

        // Add owner as project member with user_role
        await this.supabase.from('project_members').upsert({
            project_id: data.id,
            user_id: systemUserId,
            role: 'owner',
            user_role: userRole || null,
            user_role_prompt: null
        }, { onConflict: 'project_id,user_id' });

        log.info({ event: 'project_created_service_key', projectId: data.id, name }, 'Project created with service key');
        return {
            id: data.id,
            name: data.name,
            userRole: userRole || '',
            created_at: data.created_at,
            updated_at: data.updated_at
        };
    }

    /**
     * Get current user's role in a project
     */
    async getMemberRole(projectId, userId = null) {
        let uid = userId;

        // Try to get current user
        if (!uid) {
            try {
                const user = await this.getCurrentUser();
                uid = user?.id;
            } catch (e) {
                // No authenticated user
            }
        }

        // If still no user, get the owner's role
        if (!uid) {
            const { data: owner } = await this.supabase
                .from('project_members')
                .select('user_id, user_role, user_role_prompt, role_template_id, role')
                .eq('project_id', projectId)
                .eq('role', 'owner')
                .single();

            if (owner) {
                return {
                    userRole: owner.user_role || '',
                    userRolePrompt: owner.user_role_prompt || '',
                    roleTemplateId: owner.role_template_id || null,
                    accessRole: owner.role
                };
            }
            return null;
        }

        const { data, error } = await this.supabase
            .from('project_members')
            .select('user_role, user_role_prompt, role_template_id, role')
            .eq('project_id', projectId)
            .eq('user_id', uid)
            .single();

        if (error) {
            log.warn({ event: 'db_query_failed', table: 'project_members', operation: 'select', err: error.message }, 'getMemberRole error');
            return null;
        }

        return {
            userRole: data.user_role || '',
            userRolePrompt: data.user_role_prompt || '',
            roleTemplateId: data.role_template_id || null,
            accessRole: data.role
        };
    }

    /**
     * Update current user's role in a project
     */
    async updateMemberRole(projectId, updates, userId = null) {
        const uid = userId || (await this.getCurrentUser())?.id;
        if (!uid) throw new Error('No user specified');

        const updateData = {};
        if (updates.userRole !== undefined) {
            updateData.user_role = updates.userRole;
        }
        if (updates.userRolePrompt !== undefined) {
            updateData.user_role_prompt = updates.userRolePrompt;
        }
        if (updates.roleTemplateId !== undefined) {
            updateData.role_template_id = updates.roleTemplateId;
        }

        const { data, error } = await this.supabase
            .from('project_members')
            .update(updateData)
            .eq('project_id', projectId)
            .eq('user_id', uid)
            .select()
            .single();

        if (error) {
            log.error({ event: 'db_query_failed', table: 'project_members', operation: 'update', err: error.message }, 'updateMemberRole error');
            throw error;
        }

        return {
            userRole: data.user_role || '',
            userRolePrompt: data.user_role_prompt || '',
            roleTemplateId: data.role_template_id || null
        };
    }


    /**
     * Close storage connection
     */
    close() {
        // No persistent connection to close for Supabase REST client
        // But we can clear intervals or listeners if any were added
        if (this._realtimeSubscription) {
            this._realtimeSubscription.unsubscribe();
        }
    }

    /**
     * Get projects for current user
     */
    async listProjectsForUser() {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Authentication required');

        const { data, error } = await this.supabase
            .from('projects')
            .select(`
                *,
                company_id,
                company:companies(id, name, logo_url, brand_assets),
                project_members!inner(role),
                _stats:stats_history(
                    facts_count, questions_count, documents_count,
                    decisions_count, risks_count, actions_count
                )
            `)
            .eq('project_members.user_id', user.id)
            .is('deleted_at', null)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        return data.map(p => ({
            ...p,
            isCurrent: p.id === this.currentProjectId,
            graphName: `project_${p.id}`,
            stats: p._stats?.[0] || { facts_count: 0, questions_count: 0, documents_count: 0 }
        }));
    }

    /**
     * List all projects (service key - no auth required)
     */
    async listProjects() {
        // Try with user auth first
        try {
            const user = await this.getCurrentUser();
            if (user) {
                // Check if system user (super admin)
                if (user.email === 'system@godmode.local') {
                    // System user sees ALL projects
                    const { data, error } = await this.supabase
                        .from('projects')
                        .select(`
                            *,
                            company:companies(id, name, logo_url, brand_assets),
                            project_members(role),
                            _stats:stats_history(
                                facts_count, questions_count, documents_count,
                                decisions_count, risks_count, actions_count
                            )
                        `)
                        .is('deleted_at', null)
                        .order('updated_at', { ascending: false });

                    if (error) throw error;

                    return data.map(p => ({
                        ...p,
                        isCurrent: p.id === this.currentProjectId,
                        graphName: `project_${p.id}`,
                        userRole: 'owner', // System user is effectively owner
                        stats: p._stats?.[0] || { facts_count: 0, questions_count: 0, documents_count: 0 }
                    }));
                }
                return this.listProjectsForUser();
            }
        } catch (e) {
            // No user - use service key query
        }

        // Service key query - list all projects with member roles (bypasses RLS)
        const { data, error } = await this.supabase
            .from('projects')
            .select(`
                id, name, legacy_id, company_id, settings, created_at, updated_at,
                company:companies(id, name, logo_url, brand_assets),
                project_members(user_role, user_role_prompt, role)
            `)
            .order('updated_at', { ascending: false });

        if (error) {
            log.warn({ event: 'db_query_failed', table: 'projects', operation: 'select', err: error.message }, 'listProjects error');
            return [];
        }

        return (data || []).map(p => {
            const owner = p.project_members?.find(m => m.role === 'owner') || p.project_members?.[0];
            return {
                id: p.id,
                name: p.name,
                legacyId: p.legacy_id,
                company_id: p.company_id,
                company: p.company,
                userRole: owner?.user_role || p.settings?.userRole || '',
                userRolePrompt: owner?.user_role_prompt || p.settings?.userRolePrompt || '',
                created_at: p.created_at,
                updated_at: p.updated_at,
                isCurrent: p.id === this.currentProjectId
            };
        });
    }

    /**
     * Get a single project by ID (with company for branding/templates)
     */
    async getProject(projectId) {
        if (!projectId) return null;
        const { data, error } = await this.supabase
            .from('projects')
            .select('*, company:companies(id, name, logo_url, brand_assets, a4_template_html, ppt_template_html)')
            .eq('id', projectId)
            .single();
        if (error || !data) return null;
        return { ...data, company: data.company };
    }

    /**
     * Get all projects (simple list)
     */
    async getProjects() {
        const projects = await this.listProjects();
        return projects.map(({ id, name, created_at, updated_at, settings }) => ({
            id, name, created_at, updated_at,
            userRole: settings?.userRole || ''
        }));
    }

    /**
     * Switch to a different project
     */
    async switchProject(projectId) {
        const { data, error } = await this.supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (error || !data) {
            throw new Error(`Project not found: ${projectId}`);
        }

        this.currentProjectId = projectId;
        this._cache.clear();

        // Update last accessed
        await this.supabase
            .from('projects')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', projectId);

        log.debug({ event: 'project_switched', projectId, name: data?.name }, 'Switched to project');
        return data;
    }

    /**
     * Get current project
     */
    async getCurrentProject() {
        if (!this.currentProjectId) return null;

        const { data, error } = await this.supabase
            .from('projects')
            .select('*')
            .eq('id', this.currentProjectId)
            .single();

        return error ? null : data;
    }

    /**
     * Delete a project
     */
    async deleteProject(projectId) {
        const user = await this.getCurrentUser();

        // Soft delete
        const { error } = await this.supabase
            .from('projects')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', projectId)
            .eq('owner_id', user.id);

        if (error) throw error;

        // Sync to graph
        await this._addToOutbox('project.deleted', 'DELETE', 'Project', projectId, { id: projectId });

        if (this.currentProjectId === projectId) {
            this.currentProjectId = null;
        }

        log.info({ event: 'project_deleted', projectId }, 'Project deleted');
    }

    /**
     * Rename a project
     */
    async renameProject(projectId, newName) {
        if (!newName || newName.trim().length === 0) {
            throw new Error('Project name is required');
        }

        const { data, error } = await this.supabase
            .from('projects')
            .update({ name: newName.trim() })
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Update project settings
     */
    async updateProject(projectId, updates) {
        const updateData = {};

        if (updates.name !== undefined) {
            updateData.name = updates.name.trim();
        }

        // User role is now stored in project_members, not project settings
        if (updates.userRole !== undefined || updates.userRolePrompt !== undefined) {
            try {
                // Get current user or system user
                let userId = null;
                try {
                    const user = await this.getCurrentUser();
                    userId = user?.id;
                } catch (e) {
                    // No authenticated user, find owner
                    const { data: owner } = await this.supabase
                        .from('project_members')
                        .select('user_id')
                        .eq('project_id', projectId)
                        .eq('role', 'owner')
                        .single();
                    userId = owner?.user_id;
                }

                if (userId) {
                    await this.updateMemberRole(projectId, {
                        userRole: updates.userRole,
                        userRolePrompt: updates.userRolePrompt
                    }, userId);
                }
            } catch (e) {
                log.warn({ event: 'db_query_failed', table: 'project_members', operation: 'update', err: e.message }, 'Could not update member role');
            }
        }

        const { data, error } = await this.supabase
            .from('projects')
            .update(updateData)
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get project stats
     */
    async getProjectStats(projectId = null) {
        const pid = projectId || this.getProjectId();

        const { data, error } = await this.supabase.rpc('get_project_stats', { p_project_id: pid });

        if (error) {
            // Fallback: calculate manually
            const [facts, questions, documents, decisions, risks, actions, people] = await Promise.all([
                this.supabase.from('facts').select('id', { count: 'exact', head: true }).eq('project_id', pid).is('deleted_at', null),
                this.supabase.from('knowledge_questions').select('id', { count: 'exact', head: true }).eq('project_id', pid).is('deleted_at', null),
                this.supabase.from('documents').select('id', { count: 'exact', head: true }).eq('project_id', pid).is('deleted_at', null),
                this.supabase.from('decisions').select('id', { count: 'exact', head: true }).eq('project_id', pid).is('deleted_at', null),
                this.supabase.from('risks').select('id', { count: 'exact', head: true }).eq('project_id', pid).is('deleted_at', null),
                this.supabase.from('action_items').select('id', { count: 'exact', head: true }).eq('project_id', pid).is('deleted_at', null),
                this.supabase.from('people').select('id', { count: 'exact', head: true }).eq('project_id', pid).is('deleted_at', null)
            ]);

            return {
                facts: facts.count || 0,
                questions: questions.count || 0,
                documents: documents.count || 0,
                decisions: decisions.count || 0,
                risks: risks.count || 0,
                actions: actions.count || 0,
                people: people.count || 0
            };
        }

        return data;
    }

    // ==================== Documents ====================

    /**
     * Add a new document
     */
    async addDocument(doc) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        // Calculate file hash if path provided, otherwise generate one
        let fileHash = doc.hash || doc.file_hash;
        if (!fileHash && doc.path && doc.path.startsWith && !doc.path.startsWith('local-')) {
            try {
                fileHash = await this.calculateFileHash(doc.path);
            } catch (e) {
                // File might not exist, generate hash from content
                fileHash = require('crypto').createHash('md5').update(doc.filename + Date.now()).digest('hex');
            }
        }
        if (!fileHash) {
            // Fallback hash
            fileHash = require('crypto').createHash('md5').update(doc.filename + Date.now()).digest('hex');
        }

        const { data, error } = await this.supabase
            .from('documents')
            .insert({
                project_id: projectId,
                filename: doc.filename,
                filepath: doc.path || doc.filepath || 'uploaded',
                file_hash: fileHash,
                file_type: doc.type || this._getFileType(doc.filename),
                file_size: doc.size || 0,
                document_date: doc.date || null,
                document_time: doc.time || null,
                title: doc.title || doc.filename,
                summary: doc.summary || null,
                content: doc.content || null,  // Store raw content for analysis
                status: doc.status || 'pending',
                doc_type: doc.doc_type || 'document',
                uploaded_by: user?.id,
                sprint_id: doc.sprint_id || doc.sprintId || null,
                action_id: doc.action_id || doc.actionId || null
            })
            .select()
            .single();

        if (error) throw error;

        // Add to processing history
        await this.supabase.from('processing_history').insert({
            project_id: projectId,
            document_id: data.id,
            action: 'upload',
            status: 'pending',
            created_by: user?.id
        });

        // Sync to graph
        await this._addToOutbox('document.created', 'CREATE', 'Document', data.id, data);

        return data;
    }

    /**
     * Check if document already exists
     */
    async checkDocumentExists(filename, fileSize, filePath = null) {
        const projectId = this.getProjectId();

        // Check by hash if path provided
        if (filePath) {
            const hash = await this.calculateFileHash(filePath);
            if (hash) {
                const { data } = await this.supabase
                    .from('documents')
                    .select('*')
                    .eq('project_id', projectId)
                    .eq('file_hash', hash)
                    .is('deleted_at', null)
                    .single();

                if (data) {
                    return { exists: true, matchType: 'hash', document: data };
                }
            }
        }

        // Check by filename and size
        const { data } = await this.supabase
            .from('documents')
            .select('*')
            .eq('project_id', projectId)
            .eq('filename', filename)
            .eq('file_size', fileSize)
            .is('deleted_at', null)
            .single();

        if (data) {
            return { exists: true, matchType: 'name_size', document: data };
        }

        return { exists: false };
    }

    /**
     * Update document status
     */
    async updateDocumentStatus(id, status, archivedPath = null) {
        const updateData = {
            status,
            processed_at: (status === 'completed' || status === 'processed') ? new Date().toISOString() : null
        };

        if (archivedPath) {
            updateData.filepath = archivedPath;
        }

        const { data, error } = await this.supabase
            .from('documents')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Sync status change
        await this._addToOutbox('document.updated', 'UPDATE', 'Document', id, { id, status });

        return data;
    }

    /**
     * Update a document with AI-generated metadata (title, summary)
     */
    async updateDocument(id, updates) {
        const allowedFields = ['title', 'summary', 'ai_title', 'ai_summary', 'status', 'extraction_result', 'content', 'content_path'];
        const updateData = {};

        for (const [key, value] of Object.entries(updates)) {
            // Map ai_title/ai_summary to title/summary (Supabase uses simpler names)
            if (key === 'ai_title') {
                updateData.title = value;
            } else if (key === 'ai_summary') {
                updateData.summary = value;
            } else if (allowedFields.includes(key)) {
                updateData[key] = value;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return null;
        }

        updateData.updated_at = new Date().toISOString();

        const { data, error } = await this.supabase
            .from('documents')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            log.error({ event: 'db_query_failed', table: 'documents', operation: 'update', err: error.message }, 'Failed to update document');
            throw error;
        }

        log.debug({ event: 'document_updated', documentId: id, keys: Object.keys(updateData) }, 'Document updated');
        return data;
    }

    /**
     * Get documents
     */
    async getDocuments(status = null) {
        const projectId = this.getProjectId();

        let query = this.supabase
            .from('documents')
            .select('*')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    /**
     * Get document by ID
     */
    async getDocumentById(id) {
        const { data, error } = await this.supabase
            .from('documents')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return data;
    }

    /**
     * Delete a document and its related data
     */
    async deleteDocument(documentId, options = {}) {
        const { softDelete = true, deletePhysicalFile = false, backupData = true } = options;
        const user = await this.getCurrentUser();
        const projectId = this.getProjectId();

        // Get document
        const doc = await this.getDocumentById(documentId);
        if (!doc) {
            throw new Error(`Document not found: ${documentId}`);
        }

        const results = { deleted: { facts: 0, decisions: 0, risks: 0, actions: 0, questions: 0, people: 0, embeddings: 0 } };

        // Backup before delete
        if (backupData) {
            const backupContent = await this._getDocumentFullData(documentId);
            await this.supabase.from('delete_backups').insert({
                project_id: projectId,
                entity_type: 'document',
                entity_id: documentId,
                backup_data: backupContent,
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
                created_by: user?.id
            });
        }

        // Delete related entities (parallel)
        const entitiesToDelete = ['facts', 'decisions', 'risks', 'action_items', 'knowledge_questions', 'people'];
        const entityPromises = entitiesToDelete.map(async (entity) => {
            const key = entity.replace('action_items', 'actions').replace('knowledge_questions', 'questions');
            if (softDelete) {
                const { count } = await this.supabase
                    .from(entity)
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('source_document_id', documentId)
                    .select('id', { count: 'exact', head: true });
                return { key, count: count || 0 };
            }
            const { count } = await this.supabase
                .from(entity)
                .delete()
                .eq('source_document_id', documentId)
                .select('id', { count: 'exact', head: true });
            return { key, count: count || 0 };
        });
        const entityResults = await Promise.all(entityPromises);
        entityResults.forEach(({ key, count }) => { results.deleted[key] = count; });

        // Delete embeddings
        const { count: embeddingsCount } = await this.supabase
            .from('embeddings')
            .delete()
            .eq('entity_type', 'document')
            .eq('entity_id', documentId);
        results.deleted.embeddings = embeddingsCount || 0;

        // Delete/soft delete the document
        if (softDelete) {
            await this.supabase
                .from('documents')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', documentId);
        } else {
            await this.supabase
                .from('documents')
                .delete()
                .eq('id', documentId);
        }

        // Delete physical file if requested
        if (deletePhysicalFile && doc.filepath) {
            try {
                if (fs.existsSync(doc.filepath)) {
                    fs.unlinkSync(doc.filepath);
                }
            } catch (e) {
                log.warn({ event: 'file_delete_failed', err: e.message }, 'Could not delete physical file');
            }
        }

        // Audit log
        await this.supabase.from('delete_audit_log').insert({
            project_id: projectId,
            action: softDelete ? 'soft_delete' : 'delete',
            entity_type: 'document',
            entity_id: documentId,
            entity_snapshot: doc,
            cascade_count: Object.values(results.deleted).reduce((a, b) => a + b, 0),
            performed_by: user?.id
        });

        // Sync to graph
        await this._addToOutbox('document.deleted', 'DELETE', 'Document', documentId, { id: documentId });

        return results;
    }

    // ==================== Facts ====================

    /**
     * Add a new fact
     */
    async addFact(fact, skipDedup = false) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        if (!fact.content || typeof fact.content !== 'string') {
            throw new Error('Fact must have content');
        }

        const content = fact.content.trim();
        if (content.length < 10) {
            throw new Error('Fact content too short (min 10 chars)');
        }

        // Check for duplicates
        if (!skipDedup) {
            const existing = await this.getFacts();
            const dupCheck = this._findDuplicate(content, existing);
            if (dupCheck.isDuplicate) {
                log.debug({ event: 'fact_duplicate_found', similarity: dupCheck.similarity }, 'Duplicate fact found');
                return { duplicate: true, existing: dupCheck.match, similarity: dupCheck.similarity };
            }
        }

        const category = this._normalizeCategory(fact.category);

        // Map document_id to source_document_id (processor uses document_id)
        const sourceDocId = fact.source_document_id || fact.document_id || null;
        const generationSource = sourceDocId ? 'extracted' : (fact.source_file === 'quick_capture' ? 'quick_capture' : 'manual');

        const { data, error } = await this.supabase
            .from('facts')
            .insert({
                project_id: projectId,
                content: content,
                category: category,
                confidence: fact.confidence || 0.8,
                source_document_id: sourceDocId,
                source_file: fact.source_file,
                generation_source: generationSource,
                metadata: fact.metadata || {},
                created_by: user?.id,
                verified: fact.verified === true,
                verified_by: fact.verified === true ? user?.id : null,
                verified_at: fact.verified === true ? new Date().toISOString() : null
            })
            .select()
            .single();

        if (error) throw error;

        // Add to change log
        await this._addChangeLog('add', 'fact', data.id, null, fact.source_file);

        // Timeline: fact_events
        await this._addFactEvent(data.id, 'created', {}, user?.id, user?.user_metadata?.name || user?.email);

        // Sync to graph
        await this._addToOutbox('fact.created', 'CREATE', 'Fact', data.id, data);

        return data;
    }

    /**
     * Add multiple facts in one insert (batch). Use for bulk extract/import to avoid N+1.
     * Does not run per-fact duplicate check when skipDedup is true; does not emit per-fact
     * events or outbox (graph sync) for performance.
     * @param {Array<object>} facts - Array of fact objects (same shape as addFact)
     * @param {{ skipDedup?: boolean }} [options] - skipDedup: true to skip duplicate check (default true for bulk)
     * @returns {{ data: Array<object>, inserted: number }}
     */
    async addFacts(facts, options = {}) {
        const skipDedup = options.skipDedup !== false;
        if (!Array.isArray(facts) || facts.length === 0) {
            return { data: [], inserted: 0 };
        }

        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        const rows = [];
        for (const fact of facts) {
            const content = (fact.content && typeof fact.content === 'string') ? fact.content.trim() : '';
            if (content.length < 10) continue;

            const category = this._normalizeCategory(fact.category);
            const sourceDocId = fact.source_document_id || fact.document_id || null;
            const generationSource = sourceDocId ? 'extracted' : (fact.source_file === 'quick_capture' ? 'quick_capture' : 'manual');

            rows.push({
                project_id: projectId,
                content,
                category,
                confidence: fact.confidence ?? 0.8,
                source_document_id: sourceDocId,
                source_file: fact.source_file ?? null,
                generation_source: generationSource,
                metadata: fact.metadata || {},
                created_by: user?.id,
                verified: fact.verified === true,
                verified_by: fact.verified === true ? user?.id : null,
                verified_at: fact.verified === true ? new Date().toISOString() : null
            });
        }

        if (rows.length === 0) return { data: [], inserted: 0 };

        if (!skipDedup) {
            const existing = await this.getFacts();
            const existingSet = new Set(existing.map(f => f.content?.toLowerCase().trim()));
            const filtered = rows.filter(r => !existingSet.has(r.content?.toLowerCase().trim()));
            if (filtered.length === 0) return { data: [], inserted: 0 };
            rows.length = 0;
            rows.push(...filtered);
        }

        const { data: inserted, error } = await this.supabase
            .from('facts')
            .insert(rows)
            .select();

        if (error) throw error;

        const count = Array.isArray(inserted) ? inserted.length : 0;
        if (count > 0) {
            await this._addChangeLogBulk((inserted || []).map(row => ({
                action: 'add',
                entityType: 'fact',
                entityId: row.id,
                sourceFile: row.source_file
            })));
        }

        return { data: inserted || [], inserted: count };
    }

    /**
     * Get facts with optional category filter
     */
    async getFacts(category = null) {
        const projectId = this.getProjectId();

        let query = this.supabase
            .from('facts')
            .select('*')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (category) {
            query = query.eq('category', this._normalizeCategory(category));
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    /**
     * Get a single fact by id
     */
    async getFact(id) {
        const { data, error } = await this.supabase
            .from('facts')
            .select('*')
            .eq('id', id)
            .is('deleted_at', null)
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    /**
     * Get facts by source document
     */
    async getFactsByDocument(documentId) {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('facts')
            .select('*')
            .eq('project_id', projectId)
            .eq('source_document_id', documentId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    /**
     * Get fact events (timeline) for a fact
     */
    async getFactEvents(factId) {
        const { data, error } = await this.supabase
            .from('fact_events')
            .select('*')
            .eq('fact_id', factId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    /**
     * Get similar facts (from fact_similarities cache, or compute and cache)
     * @param {string} factId - Fact ID
     * @param {number} limit - Max number of similar facts to return
     * @returns {Promise<Array<{ fact: object, similarityScore: number }>>}
     */
    async getSimilarFacts(factId, limit = 10) {
        const projectId = this.getProjectId();

        const { data: cached } = await this.supabase
            .from('fact_similarities')
            .select('similar_fact_id, similarity_score')
            .eq('fact_id', factId)
            .order('similarity_score', { ascending: false })
            .limit(limit);

        const allFacts = await this.getFacts();
        const currentFact = allFacts.find(f => String(f.id) === String(factId));
        if (!currentFact) return [];

        const result = [];
        if (cached && cached.length > 0) {
            for (const row of cached) {
                const simFact = allFacts.find(f => String(f.id) === String(row.similar_fact_id));
                if (simFact) {
                    result.push({ fact: simFact, similarityScore: Number(row.similarity_score) });
                }
            }
        }

        if (result.length < limit) {
            const seenIds = new Set(result.map(r => String(r.fact.id)));
            const computed = [];
            const contentField = 'content';
            const normalizedCurrent = this._normalizeText(currentFact[contentField] || '');
            for (const f of allFacts) {
                if (String(f.id) === String(factId)) continue;
                if (seenIds.has(String(f.id))) continue;
                const normalizedOther = this._normalizeText(f[contentField] || '');
                const score = this._textSimilarity(normalizedCurrent, normalizedOther);
                if (score >= 0.15) computed.push({ fact: f, similarityScore: Math.round(score * 10000) / 10000 });
            }
            computed.sort((a, b) => b.similarityScore - a.similarityScore);
            const toCache = computed.slice(0, limit - result.length);
            const toUpsert = [];
            for (const { fact, similarityScore } of toCache) {
                toUpsert.push({ fact_id: factId, similar_fact_id: fact.id, similarity_score: similarityScore });
                toUpsert.push({ fact_id: fact.id, similar_fact_id: factId, similarity_score: similarityScore });
            }
            if (toUpsert.length > 0) {
                try {
                    await this.supabase.from('fact_similarities').upsert(toUpsert, {
                        onConflict: 'fact_id,similar_fact_id',
                        ignoreDuplicates: false
                    });
                } catch (e) {
                    log.warn({ event: 'fact_similarities_upsert_failed', reason: e.message }, 'fact_similarities upsert failed');
                }
            }
            return [...result, ...toCache];
        }

        return result;
    }

    /**
     * Add fact event (timeline/audit)
     */
    async _addFactEvent(factId, eventType, eventData = {}, actorUserId = null, actorName = null) {
        try {
            await this.supabase.from('fact_events').insert({
                fact_id: factId,
                event_type: eventType,
                event_data: eventData,
                actor_user_id: actorUserId,
                actor_name: actorName
            });
        } catch (e) {
            log.warn({ event: 'fact_event_add_failed', factId, eventType, reason: e.message }, 'Failed to add fact event');
        }
    }

    /**
     * Update a fact
     */
    async updateFact(id, updates) {
        const projectId = this.getProjectId();
        const { data: existing } = await this.supabase.from('facts').select('*').eq('id', id).eq('project_id', projectId).single();
        const user = await this.getCurrentUser();

        const updatePayload = {
            content: updates.content,
            category: updates.category ? this._normalizeCategory(updates.category) : undefined,
            confidence: updates.confidence,
            metadata: updates.metadata
        };
        if (updates.verified !== undefined) {
            updatePayload.verified = updates.verified === true;
            updatePayload.verified_by = updates.verified === true ? (user?.id ?? updates.verified_by) : null;
            updatePayload.verified_at = updates.verified === true ? new Date().toISOString() : null;
        }

        const { data, error } = await this.supabase
            .from('facts')
            .update(updatePayload)
            .eq('id', id)
            .eq('project_id', projectId)
            .select()
            .single();

        if (error) throw error;

        // Add to change log
        await this._addChangeLog('update', 'fact', id, existing);

        // Timeline: updated and optionally verified
        await this._addFactEvent(id, 'updated', { previous: existing ? { content: existing.content, category: existing.category } : {} }, user?.id, user?.user_metadata?.name || user?.email);
        if (updates.verified === true && (!existing || !existing.verified)) {
            await this._addFactEvent(id, 'verified', {}, user?.id, user?.user_metadata?.name || user?.email);
        }

        // Sync to graph
        await this._addToOutbox('fact.updated', 'UPDATE', 'Fact', id, data);

        return data;
    }

    /**
     * Delete a fact
     */
    async deleteFact(id, soft = true) {
        const projectId = this.getProjectId();
        const { data: existing } = await this.supabase.from('facts').select('*').eq('id', id).eq('project_id', projectId).single();

        const user = await this.getCurrentUser();
        await this._addFactEvent(id, 'deleted', { reason: soft ? 'soft' : 'hard' }, user?.id, user?.user_metadata?.name || user?.email);

        if (soft) {
            await this.supabase
                .from('facts')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id)
                .eq('project_id', projectId);
        } else {
            await this.supabase.from('facts').delete().eq('id', id).eq('project_id', projectId);
        }

        await this._addChangeLog('delete', 'fact', id, existing);
        await this._addToOutbox('fact.deleted', 'DELETE', 'Fact', id, { id });

        return existing;
    }

    /**
     * Delete facts by source document ID
     */
    async deleteFactsByDocument(documentId) {
        if (!documentId) return 0;
        const projectId = this.getProjectId();
        const { count, error } = await this.supabase
            .from('facts')
            .delete({ count: 'exact' })
            .eq('source_document_id', documentId)
            .eq('project_id', projectId);

        if (error) throw error;
        // Optionally add to outbox/log? Skipping for bulk/audit reasons or implementing simplistic log
        return count;
    }

    /**
     * List facts that were soft-deleted (for restore / undo)
     */
    async getDeletedFacts() {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('facts')
            .select('*')
            .eq('project_id', projectId)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    /**
     * Restore a soft-deleted fact (undo). Sets deleted_at = null and syncs to graph so the Fact node is recreated.
     */
    async restoreFact(id) {
        const projectId = this.getProjectId();
        const { data: existing } = await this.supabase.from('facts').select('*').eq('id', id).eq('project_id', projectId).single();
        if (!existing) throw new Error('Fact not found');
        if (existing.deleted_at == null) throw new Error('Fact is not deleted');

        const { data, error } = await this.supabase
            .from('facts')
            .update({ deleted_at: null })
            .eq('id', id)
            .eq('project_id', projectId)
            .select()
            .single();
        if (error) throw error;

        const user = await this.getCurrentUser();
        await this._addFactEvent(data.id, 'restored', {}, user?.id, user?.user_metadata?.name || user?.email);
        await this._addChangeLog('restore', 'fact', data.id, existing);

        // Sync to graph (ontology/graph: recreate Fact node with same properties)
        await this._addToOutbox('fact.restored', 'CREATE', 'Fact', data.id, data);

        return data;
    }

    /**
     * Replace all facts (used for imports)
     */
    async replaceFacts(newFacts) {
        const projectId = this.getProjectId();

        // Soft delete existing
        await this.supabase
            .from('facts')
            .update({ deleted_at: new Date().toISOString() })
            .eq('project_id', projectId)
            .is('deleted_at', null);

        // Insert new facts
        const results = [];
        for (const fact of newFacts) {
            const result = await this.addFact(fact, true);
            results.push(result);
        }

        return results;
    }

    // ==================== Decisions ====================

    /**
     * Add a decision
     */
    async addDecision(decision) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        const payload = {
            project_id: projectId,
            content: decision.content?.trim(),
            owner: decision.owner,
            decision_date: decision.date || decision.decision_date,
            context: decision.context || decision.rationale,
            status: decision.status || 'active',
            source_document_id: decision.source_document_id || decision.document_id || null,
            source_file: decision.source_file,
            created_by: user?.id,
            generation_source: decision.generation_source || (decision.source_document_id ? 'extracted' : 'manual'),
            rationale: decision.rationale,
            made_by: decision.made_by || decision.owner,
            approved_by: decision.approved_by,
            decided_at: decision.decided_at,
            impact: decision.impact,
            reversible: decision.reversible,
            summary: decision.summary
        };
        const { data, error } = await this.supabase
            .from('decisions')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        await this._addDecisionEvent(data.id, 'created', {}, user?.id, user?.user_metadata?.name || user?.email);
        await this._addToOutbox('decision.created', 'CREATE', 'Decision', data.id, data);
        return data;
    }

    /**
     * Add multiple decisions in one insert (batch). No per-item events/outbox.
     * @param {Array<object>} decisions - Same shape as addDecision
     * @returns {{ data: Array<object>, inserted: number }}
     */
    async addDecisions(decisions) {
        if (!Array.isArray(decisions) || decisions.length === 0) return { data: [], inserted: 0 };
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();
        const rows = decisions.map(d => ({
            project_id: projectId,
            content: d.content?.trim() ?? null,
            owner: d.owner ?? null,
            decision_date: (d.date || d.decision_date) ?? null,
            context: (d.context || d.rationale) ?? null,
            status: d.status || 'active',
            source_document_id: d.source_document_id || d.document_id || null,
            source_file: d.source_file ?? null,
            created_by: user?.id,
            generation_source: d.generation_source || (d.source_document_id ? 'extracted' : 'manual'),
            rationale: d.rationale ?? null,
            made_by: (d.made_by || d.owner) ?? null,
            approved_by: d.approved_by ?? null,
            decided_at: d.decided_at ?? null,
            impact: d.impact ?? null,
            reversible: d.reversible ?? null,
            summary: d.summary ?? null
        })).filter(r => r.content);
        if (rows.length === 0) return { data: [], inserted: 0 };
        const { data: inserted, error } = await this.supabase.from('decisions').insert(rows).select();
        if (error) throw error;
        const count = Array.isArray(inserted) ? inserted.length : 0;
        return { data: inserted || [], inserted: count };
    }

    /**
     * Get decisions
     */
    async getDecisions(status = null) {
        const projectId = this.getProjectId();

        let query = this.supabase
            .from('decisions')
            .select('*')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    /**
     * Get a single decision by id
     */
    async getDecision(id) {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('decisions')
            .select('*')
            .eq('id', id)
            .eq('project_id', projectId)
            .single();
        if (error || !data) return null;
        return data;
    }

    /**
     * Add decision event (timeline/audit)
     */
    async _addDecisionEvent(decisionId, eventType, eventData = {}, actorUserId = null, actorName = null) {
        try {
            await this.supabase.from('decision_events').insert({
                decision_id: decisionId,
                event_type: eventType,
                event_data: eventData,
                actor_user_id: actorUserId,
                actor_name: actorName
            });
        } catch (e) {
            log.warn({ event: 'decision_event_add_failed', decisionId, eventType, reason: e.message }, 'Failed to add decision event');
        }
    }

    /**
     * Get decision events (timeline)
     */
    async getDecisionEvents(decisionId) {
        const { data, error } = await this.supabase
            .from('decision_events')
            .select('*')
            .eq('decision_id', decisionId)
            .order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
    }

    /**
     * Delete decisions by source document ID
     */
    async deleteDecisionsByDocument(documentId) {
        if (!documentId) return 0;
        const projectId = this.getProjectId();
        const { count, error } = await this.supabase
            .from('decisions')
            .delete({ count: 'exact' })
            .eq('source_document_id', documentId)
            .eq('project_id', projectId);

        if (error) throw error;
        return count;
    }

    /**
     * List soft-deleted decisions (for restore / undo)
     */
    async getDeletedDecisions() {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('decisions')
            .select('*')
            .eq('project_id', projectId)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    /**
     * Restore a soft-deleted decision; syncs back to graph
     */
    async restoreDecision(id) {
        const projectId = this.getProjectId();
        const { data: existing } = await this.supabase.from('decisions').select('*').eq('id', id).eq('project_id', projectId).single();
        if (!existing) throw new Error('Decision not found');
        if (existing.deleted_at == null) throw new Error('Decision is not deleted');

        const { data, error } = await this.supabase
            .from('decisions')
            .update({ deleted_at: null })
            .eq('id', id)
            .eq('project_id', projectId)
            .select()
            .single();
        if (error) throw error;

        const user = await this.getCurrentUser();
        await this._addDecisionEvent(data.id, 'restored', {}, user?.id, user?.user_metadata?.name || user?.email);
        await this._addToOutbox('decision.restored', 'CREATE', 'Decision', data.id, data);
        return data;
    }

    /**
     * Update a decision
     */
    async updateDecision(id, updates) {
        const user = await this.getCurrentUser();
        const updatePayload = {
            content: updates.content,
            owner: updates.owner,
            decision_date: updates.date || updates.decision_date,
            context: updates.context,
            status: updates.status,
            rationale: updates.rationale,
            made_by: updates.made_by,
            approved_by: updates.approved_by,
            decided_at: updates.decided_at,
            impact: updates.impact,
            reversible: updates.reversible,
            summary: updates.summary
        };
        Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k]);

        const { data, error } = await this.supabase
            .from('decisions')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await this._addDecisionEvent(id, 'updated', {}, user?.id, user?.user_metadata?.name || user?.email);
        await this._addToOutbox('decision.updated', 'UPDATE', 'Decision', id, data);
        return data;
    }

    /**
     * Delete a decision
     */
    async deleteDecision(id, soft = true) {
        const user = await this.getCurrentUser();
        await this._addDecisionEvent(id, 'deleted', { reason: soft ? 'soft' : 'hard' }, user?.id, user?.user_metadata?.name || user?.email);

        if (soft) {
            await this.supabase
                .from('decisions')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);
        } else {
            await this.supabase.from('decisions').delete().eq('id', id);
        }

        await this._addToOutbox('decision.deleted', 'DELETE', 'Decision', id, { id });
    }

    /**
     * Get similar decisions (from decision_similarities cache or computed)
     */
    async getSimilarDecisions(decisionId, limit = 10) {
        const projectId = this.getProjectId();

        const { data: cached } = await this.supabase
            .from('decision_similarities')
            .select('similar_decision_id, similarity_score')
            .eq('decision_id', decisionId)
            .order('similarity_score', { ascending: false })
            .limit(limit);

        const allDecisions = await this.getDecisions();
        const currentDecision = allDecisions.find(d => String(d.id) === String(decisionId));
        if (!currentDecision) return [];

        const result = [];
        if (cached && cached.length > 0) {
            for (const row of cached) {
                const simDec = allDecisions.find(d => String(d.id) === String(row.similar_decision_id));
                if (simDec) {
                    result.push({ decision: simDec, similarityScore: Number(row.similarity_score) });
                }
            }
        }

        if (result.length < limit) {
            const seenIds = new Set(result.map(r => String(r.decision.id)));
            const computed = [];
            const contentField = 'content';
            const normalizedCurrent = this._normalizeText(currentDecision[contentField] || '');
            for (const d of allDecisions) {
                if (String(d.id) === String(decisionId)) continue;
                if (seenIds.has(String(d.id))) continue;
                const normalizedOther = this._normalizeText(d[contentField] || '');
                const score = this._textSimilarity(normalizedCurrent, normalizedOther);
                if (score >= 0.15) computed.push({ decision: d, similarityScore: Math.round(score * 10000) / 10000 });
            }
            computed.sort((a, b) => b.similarityScore - a.similarityScore);
            const toCache = computed.slice(0, limit - result.length);
            const toUpsert = [];
            for (const { decision, similarityScore } of toCache) {
                toUpsert.push({ decision_id: decisionId, similar_decision_id: decision.id, similarity_score: similarityScore });
                toUpsert.push({ decision_id: decision.id, similar_decision_id: decisionId, similarity_score: similarityScore });
            }
            if (toUpsert.length > 0) {
                try {
                    await this.supabase.from('decision_similarities').upsert(toUpsert, {
                        onConflict: 'decision_id,similar_decision_id',
                        ignoreDuplicates: false
                    });
                } catch (e) {
                    log.warn({ event: 'decision_similarities_upsert_failed', reason: e.message }, 'decision_similarities upsert failed');
                }
            }
            return [...result, ...toCache];
        }

        return result;
    }

    // ==================== Risks ====================

    /**
     * Add a risk
     */
    async addRisk(risk) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        const { data, error } = await this.supabase
            .from('risks')
            .insert({
                project_id: projectId,
                content: risk.content?.trim(),
                impact: risk.impact || 'medium',
                likelihood: risk.likelihood || 'medium',
                mitigation: risk.mitigation,
                status: risk.status || 'open',
                owner: risk.owner,
                source_document_id: risk.source_document_id || risk.document_id || null,
                source_file: risk.source_file,
                generation_source: risk.generation_source || 'manual',
                created_by: user?.id
            })
            .select()
            .single();

        if (error) throw error;

        await this._addRiskEvent(data.id, 'created', {}, user?.id, user?.user_metadata?.name || user?.email);
        await this._addToOutbox('risk.created', 'CREATE', 'Risk', data.id, data);
        return data;
    }

    /**
     * Get a single risk by id
     */
    async getRisk(id) {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('risks')
            .select('*')
            .eq('id', id)
            .eq('project_id', projectId)
            .single();
        if (error || !data) return null;
        return data;
    }

    /**
     * Add risk event (timeline/audit)
     */
    async _addRiskEvent(riskId, eventType, eventData = {}, actorUserId = null, actorName = null) {
        try {
            await this.supabase.from('risk_events').insert({
                risk_id: riskId,
                event_type: eventType,
                event_data: eventData,
                actor_user_id: actorUserId,
                actor_name: actorName
            });
        } catch (e) {
            log.warn({ event: 'risk_event_add_failed', riskId, eventType, reason: e.message }, 'Failed to add risk event');
        }
    }

    /**
     * Get risk events (timeline)
     */
    async getRiskEvents(riskId) {
        const { data, error } = await this.supabase
            .from('risk_events')
            .select('*')
            .eq('risk_id', riskId)
            .order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
    }

    /**
     * Delete risks by source document ID
     */
    async deleteRisksByDocument(documentId) {
        if (!documentId) return 0;
        const projectId = this.getProjectId();
        const { count, error } = await this.supabase
            .from('risks')
            .delete({ count: 'exact' })
            .eq('source_document_id', documentId)
            .eq('project_id', projectId);

        if (error) throw error;
        return count;
    }

    /**
     * List soft-deleted risks (for restore / undo)
     */
    async getDeletedRisks() {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('risks')
            .select('*')
            .eq('project_id', projectId)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    /**
     * Restore a soft-deleted risk; syncs back to graph
     */
    async restoreRisk(id) {
        const projectId = this.getProjectId();
        const { data: existing } = await this.supabase.from('risks').select('*').eq('id', id).eq('project_id', projectId).single();
        if (!existing) throw new Error('Risk not found');
        if (existing.deleted_at == null) throw new Error('Risk is not deleted');

        const { data, error } = await this.supabase
            .from('risks')
            .update({ deleted_at: null })
            .eq('id', id)
            .eq('project_id', projectId)
            .select()
            .single();
        if (error) throw error;

        const user = await this.getCurrentUser();
        await this._addRiskEvent(data.id, 'restored', {}, user?.id, user?.user_metadata?.name || user?.email);
        await this._addToOutbox('risk.restored', 'CREATE', 'Risk', data.id, data);
        return data;
    }

    /**
     * Get risks
     */
    async getRisks(status = null) {
        const projectId = this.getProjectId();

        let query = this.supabase
            .from('risks')
            .select('*')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    /**
     * Update a risk
     */
    async updateRisk(id, updates) {
        const user = await this.getCurrentUser();
        const previous = await this.getRisk(id);
        const updatePayload = {
            content: updates.content,
            impact: updates.impact,
            likelihood: updates.likelihood,
            mitigation: updates.mitigation,
            status: updates.status,
            owner: updates.owner,
            source_file: updates.source_file
        };
        Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k]);

        const { data, error } = await this.supabase
            .from('risks')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        const changes = [];
        const fieldLabels = { content: 'Description', impact: 'Impact', likelihood: 'Likelihood', mitigation: 'Mitigation', status: 'Status', owner: 'Owner', source_file: 'Source file' };
        for (const [key, to] of Object.entries(updatePayload)) {
            const from = previous?.[key];
            if (from !== to && (from !== undefined || to !== undefined)) {
                changes.push({ field: fieldLabels[key] || key, from: from ?? '', to: to ?? '' });
            }
        }
        await this._addRiskEvent(id, 'updated', { changes }, user?.id, user?.user_metadata?.name || user?.email);
        await this._addToOutbox('risk.updated', 'UPDATE', 'Risk', id, data);
        return data;
    }

    /**
     * Delete a risk
     */
    async deleteRisk(id, soft = true) {
        const user = await this.getCurrentUser();
        await this._addRiskEvent(id, 'deleted', { reason: soft ? 'soft' : 'hard' }, user?.id, user?.user_metadata?.name || user?.email);

        if (soft) {
            await this.supabase
                .from('risks')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);
        } else {
            await this.supabase.from('risks').delete().eq('id', id);
        }

        await this._addToOutbox('risk.deleted', 'DELETE', 'Risk', id, { id });
    }

    // ==================== Action Items ====================

    /**
     * Add action event (timeline/audit)
     */
    async _addActionEvent(actionId, eventType, eventData = {}, actorUserId = null, actorName = null) {
        try {
            await this.supabase.from('action_events').insert({
                action_id: actionId,
                event_type: eventType,
                event_data: eventData,
                actor_user_id: actorUserId,
                actor_name: actorName
            });
        } catch (e) {
            log.warn({ event: 'action_event_add_failed', actionId, eventType, reason: e.message }, 'Failed to add action event');
        }
    }

    /**
     * Get action events (timeline)
     */
    async getActionEvents(actionId) {
        const { data, error } = await this.supabase
            .from('action_events')
            .select('*')
            .eq('action_id', actionId)
            .order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
    }

    /**
     * Get a single action by id (includes depends_on from task_dependencies)
     */
    async getAction(id) {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('action_items')
            .select('*, sprints(name)')
            .eq('id', id)
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .single();
        if (error || !data) return null;
        try {
            data.depends_on = await this.getTaskDependencies(id);
        } catch (_) {
            data.depends_on = [];
        }
        return data;
    }

    /**
     * Add an action item
     */
    async addAction(action) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        const generationSource = action.generation_source || (action.source_document_id ? 'extracted' : (action.source_email_id ? 'extracted' : 'manual'));
        const sourceType = action.source_type || (action.source_document_id ? 'transcript' : (action.source_email_id ? 'email' : 'manual'));
        const supportingIds = Array.isArray(action.supporting_document_ids) ? action.supporting_document_ids : (action.supporting_document_ids ? [action.supporting_document_ids] : []);

        const { data, error } = await this.supabase
            .from('action_items')
            .insert({
                project_id: projectId,
                task: action.task?.trim() || action.content?.trim(),
                owner: action.owner,
                deadline: action.deadline,
                priority: action.priority || 'medium',
                status: action.status || 'pending',
                source_document_id: action.source_document_id || action.document_id || null,
                source_file: action.source_file,
                source_email_id: action.source_email_id ?? null,
                source_type: sourceType,
                generation_source: generationSource,
                requested_by: action.requested_by ?? null,
                requested_by_contact_id: action.requested_by_contact_id ?? null,
                supporting_document_ids: supportingIds,
                created_by: user?.id,
                parent_story_ref: action.parent_story_ref ?? action.parent_story ?? null,
                parent_story_id: action.parent_story_id ?? null,
                size_estimate: action.size_estimate ?? action.size ?? null,
                description: action.description ?? null,
                definition_of_done: Array.isArray(action.definition_of_done) ? action.definition_of_done : (action.definition_of_done ? [action.definition_of_done] : []),
                acceptance_criteria: Array.isArray(action.acceptance_criteria) ? action.acceptance_criteria : (action.acceptance_criteria ? [action.acceptance_criteria] : []),
                sprint_id: action.sprint_id ?? null,
                task_points: action.task_points != null ? action.task_points : null,
                decision_id: action.decision_id ?? null
            })
            .select()
            .single();

        if (error) throw error;

        if (Array.isArray(action.depends_on) && action.depends_on.length > 0) {
            await this.setTaskDependencies(data.id, action.depends_on);
        }

        await this._addActionEvent(data.id, 'created', {}, user?.id, user?.user_metadata?.name || user?.email);
        await this._addToOutbox('action.created', 'CREATE', 'Action', data.id, data);
        return data;
    }

    /**
     * Get task dependency IDs (task_ids this task depends on)
     */
    async getTaskDependencies(taskId) {
        const { data, error } = await this.supabase
            .from('task_dependencies')
            .select('depends_on_id')
            .eq('task_id', taskId);
        if (error) throw error;
        return (data || []).map(r => r.depends_on_id);
    }

    /**
     * Get dependencies for multiple tasks at once (task_id -> depends_on_id[])
     */
    async getTaskDependenciesBatch(taskIds) {
        if (!Array.isArray(taskIds) || taskIds.length === 0) return {};
        const { data, error } = await this.supabase
            .from('task_dependencies')
            .select('task_id, depends_on_id')
            .in('task_id', taskIds);
        if (error) throw error;
        const map = {};
        for (const id of taskIds) map[id] = [];
        for (const row of data || []) {
            if (!map[row.task_id]) map[row.task_id] = [];
            map[row.task_id].push(row.depends_on_id);
        }
        return map;
    }

    /**
     * Set task dependencies (replaces existing). dependsOnIds = array of action_item UUIDs.
     */
    async setTaskDependencies(taskId, dependsOnIds) {
        await this.supabase.from('task_dependencies').delete().eq('task_id', taskId);
        if (!Array.isArray(dependsOnIds) || dependsOnIds.length === 0) return;
        const rows = dependsOnIds
            .filter(id => id && String(id) !== String(taskId))
            .map(depends_on_id => ({ task_id: taskId, depends_on_id }));
        if (rows.length === 0) return;
        const { error } = await this.supabase.from('task_dependencies').insert(rows);
        if (error) throw error;
    }

    // ==================== User Stories ====================

    async _addUserStoryEvent(userStoryId, eventType, eventData = {}, actorUserId = null, actorName = null) {
        try {
            await this.supabase.from('user_story_events').insert({
                user_story_id: userStoryId,
                event_type: eventType,
                event_data: eventData,
                actor_user_id: actorUserId,
                actor_name: actorName
            });
        } catch (e) {
            log.warn({ event: 'user_story_event_add_failed', userStoryId, eventType, reason: e.message }, 'Failed to add user story event');
        }
    }

    async addUserStory(story) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();
        const supportingIds = Array.isArray(story.supporting_document_ids) ? story.supporting_document_ids : (story.supporting_document_ids ? [story.supporting_document_ids] : []);
        const { data, error } = await this.supabase
            .from('user_stories')
            .insert({
                project_id: projectId,
                title: (story.title || '').trim(),
                description: story.description || null,
                status: story.status || 'draft',
                acceptance_criteria: Array.isArray(story.acceptance_criteria) ? story.acceptance_criteria : [],
                source_document_id: story.source_document_id ?? null,
                source_file: story.source_file ?? null,
                source_email_id: story.source_email_id ?? null,
                source_type: story.source_type ?? 'manual',
                requested_by: story.requested_by ?? null,
                requested_by_contact_id: story.requested_by_contact_id ?? null,
                supporting_document_ids: supportingIds,
                generation_source: story.generation_source ?? 'manual',
                created_by: user?.id,
                story_points: story.story_points != null ? story.story_points : null
            })
            .select()
            .single();
        if (error) throw error;
        await this._addUserStoryEvent(data.id, 'created', {}, user?.id, user?.user_metadata?.name || user?.email);
        return data;
    }

    async getUserStory(id) {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('user_stories')
            .select('*')
            .eq('id', id)
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .single();
        if (error || !data) return null;
        return data;
    }

    async getUserStories(status = null) {
        const projectId = this.getProjectId();
        let query = this.supabase
            .from('user_stories')
            .select('*')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async updateUserStory(id, updates) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();
        const updatePayload = {};
        if (updates.title !== undefined) updatePayload.title = String(updates.title).trim();
        if (updates.description !== undefined) updatePayload.description = updates.description;
        if (updates.status !== undefined) updatePayload.status = updates.status;
        if (updates.acceptance_criteria !== undefined) updatePayload.acceptance_criteria = Array.isArray(updates.acceptance_criteria) ? updates.acceptance_criteria : [];
        if (updates.source_document_id !== undefined) updatePayload.source_document_id = updates.source_document_id;
        if (updates.source_file !== undefined) updatePayload.source_file = updates.source_file;
        if (updates.source_email_id !== undefined) updatePayload.source_email_id = updates.source_email_id;
        if (updates.source_type !== undefined) updatePayload.source_type = updates.source_type;
        if (updates.requested_by !== undefined) updatePayload.requested_by = updates.requested_by;
        if (updates.requested_by_contact_id !== undefined) updatePayload.requested_by_contact_id = updates.requested_by_contact_id;
        if (updates.supporting_document_ids !== undefined) updatePayload.supporting_document_ids = Array.isArray(updates.supporting_document_ids) ? updates.supporting_document_ids : [];
        if (updates.generation_source !== undefined) updatePayload.generation_source = updates.generation_source;
        if (updates.story_points !== undefined) updatePayload.story_points = updates.story_points;
        if (Object.keys(updatePayload).length === 0) return await this.getUserStory(id);
        const { data, error } = await this.supabase
            .from('user_stories')
            .update(updatePayload)
            .eq('id', id)
            .eq('project_id', projectId)
            .select()
            .single();
        if (error) throw error;
        await this._addUserStoryEvent(id, 'updated', { changes: Object.keys(updatePayload) }, user?.id, user?.user_metadata?.name || user?.email);
        return data;
    }

    async deleteUserStory(id, soft = true) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();
        if (soft) {
            await this.supabase.from('user_stories').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('project_id', projectId);
            await this._addUserStoryEvent(id, 'deleted', { reason: 'soft' }, user?.id, user?.user_metadata?.name || user?.email);
        } else {
            await this.supabase.from('user_stories').delete().eq('id', id).eq('project_id', projectId);
        }
    }

    /**
     * List soft-deleted user stories (for restore)
     */
    async getDeletedUserStories() {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('user_stories')
            .select('*')
            .eq('project_id', projectId)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    /**
     * Restore a soft-deleted user story
     */
    async restoreUserStory(id) {
        const projectId = this.getProjectId();
        const { data: existing } = await this.supabase.from('user_stories').select('*').eq('id', id).eq('project_id', projectId).single();
        if (!existing) throw new Error('User story not found');
        if (existing.deleted_at == null) throw new Error('User story is not deleted');

        const { data, error } = await this.supabase
            .from('user_stories')
            .update({ deleted_at: null })
            .eq('id', id)
            .eq('project_id', projectId)
            .select()
            .single();
        if (error) throw error;

        const user = await this.getCurrentUser();
        await this._addUserStoryEvent(data.id, 'restored', {}, user?.id, user?.user_metadata?.name || user?.email);
        return data;
    }

    // ==================== Sprints ====================

    /**
     * Create a sprint
     */
    async createSprint(projectId, data) {
        const user = await this.getCurrentUser();
        const { data: row, error } = await this.supabase
            .from('sprints')
            .insert({
                project_id: projectId,
                name: data.name,
                start_date: data.start_date,
                end_date: data.end_date,
                context: data.context ?? null,
                analysis_start_date: data.analysis_start_date ?? null,
                analysis_end_date: data.analysis_end_date ?? null,
                created_by: user?.id
            })
            .select()
            .single();
        if (error) throw error;
        await this._addToOutbox('sprint.created', 'CREATE', 'Sprint', row.id, { id: row.id, name: row.name, start_date: row.start_date, end_date: row.end_date, context: row.context, project_id: row.project_id });
        return row;
    }

    /**
     * Get a single sprint by id
     */
    async getSprint(id) {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('sprints')
            .select('*')
            .eq('id', id)
            .eq('project_id', projectId)
            .single();
        if (error || !data) return null;
        return data;
    }

    /**
     * List sprints for the current project
     */
    async getSprints(projectId) {
        const pid = projectId || this.getProjectId();
        const { data, error } = await this.supabase
            .from('sprints')
            .select('*')
            .eq('project_id', pid)
            .order('start_date', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    /**
     * Update a sprint
     */
    async updateSprint(id, updates) {
        const projectId = this.getProjectId();
        const payload = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.start_date !== undefined) payload.start_date = updates.start_date;
        if (updates.end_date !== undefined) payload.end_date = updates.end_date;
        if (updates.context !== undefined) payload.context = updates.context;
        if (updates.analysis_start_date !== undefined) payload.analysis_start_date = updates.analysis_start_date;
        if (updates.analysis_end_date !== undefined) payload.analysis_end_date = updates.analysis_end_date;
        if (Object.keys(payload).length === 0) return await this.getSprint(id);
        payload.updated_at = new Date().toISOString();
        const { data, error } = await this.supabase
            .from('sprints')
            .update(payload)
            .eq('id', id)
            .eq('project_id', projectId)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    /**
     * Get action items
     * @param {string|null} status - Filter by status
     * @param {string|null} owner - Filter by owner
     * @param {string|null} sprintId - Filter by sprint_id
     * @param {string|null} decisionId - Filter by decision_id (tasks implementing this decision)
     */
    async getActions(status = null, owner = null, sprintId = null, decisionId = null) {
        const projectId = this.getProjectId();

        let query = this.supabase
            .from('action_items')
            .select('*, sprints(name)')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .order('deadline', { ascending: true, nullsFirst: false });

        if (status) {
            query = query.eq('status', status);
        }
        if (owner) {
            query = query.eq('owner', owner);
        }
        if (sprintId) {
            query = query.eq('sprint_id', sprintId);
        }
        if (decisionId) {
            query = query.eq('decision_id', decisionId);
        }

        const { data, error } = await query;
        if (error) throw error;
        const actions = data || [];
        if (actions.length > 0) {
            const depMap = await this.getTaskDependenciesBatch(actions.map(a => a.id));
            actions.forEach(a => { a.depends_on = depMap[a.id] || []; });
        }
        return actions;
    }

    /**
     * Truncate a value for timeline display (avoid wall of text in event_data.changes)
     */
    _truncateForTimeline(value, maxLen = 80) {
        if (value == null) return value;
        if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : '—';
        const s = String(value);
        return s.length > maxLen ? s.substring(0, maxLen) + '…' : s;
    }

    /**
     * Update an action item
     * Supports refined_with_ai (emit refined_with_ai event + snapshot for rollback) and restore_snapshot (apply snapshot, no full changes in timeline).
     */
    async updateAction(id, updates) {
        const user = await this.getCurrentUser();
        const previous = await this.getAction(id);
        const refinedWithAi = updates.refined_with_ai === true;
        const restoreSnapshot = updates.restore_snapshot && typeof updates.restore_snapshot === 'object';

        // Build update payload (exclude internal flags and restore_snapshot)
        const updateData = {};
        if (restoreSnapshot) {
            const s = updates.restore_snapshot;
            if (s.content !== undefined) updateData.task = s.content;
            if (s.task !== undefined) updateData.task = s.task;
            if (s.description !== undefined) updateData.description = s.description;
            if (s.definition_of_done !== undefined) updateData.definition_of_done = Array.isArray(s.definition_of_done) ? s.definition_of_done : (s.definition_of_done ? [s.definition_of_done] : []);
            if (s.acceptance_criteria !== undefined) updateData.acceptance_criteria = Array.isArray(s.acceptance_criteria) ? s.acceptance_criteria : (s.acceptance_criteria ? [s.acceptance_criteria] : []);
            if (s.size_estimate !== undefined) updateData.size_estimate = s.size_estimate;
        } else {
            updateData.task = updates.task || updates.content;
            updateData.owner = updates.owner;
            updateData.deadline = updates.deadline;
            updateData.priority = updates.priority;
            updateData.status = updates.status;
            updateData.parent_story_ref = updates.parent_story_ref ?? updates.parent_story;
            updateData.parent_story_id = updates.parent_story_id;
            updateData.size_estimate = updates.size_estimate ?? updates.size;
            updateData.description = updates.description;
            updateData.definition_of_done = updates.definition_of_done;
            updateData.acceptance_criteria = updates.acceptance_criteria;
            updateData.source_email_id = updates.source_email_id;
            updateData.source_type = updates.source_type;
            updateData.requested_by = updates.requested_by;
            updateData.requested_by_contact_id = updates.requested_by_contact_id;
            updateData.supporting_document_ids = Array.isArray(updates.supporting_document_ids) ? updates.supporting_document_ids : undefined;
            updateData.sprint_id = updates.sprint_id;
            updateData.task_points = updates.task_points;
            updateData.decision_id = updates.decision_id !== undefined ? updates.decision_id : undefined;
        }
        Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);
        if (Array.isArray(updates.depends_on)) {
            await this.setTaskDependencies(id, updates.depends_on);
        }

        if (updates.status === 'completed') {
            updateData.completed_at = new Date().toISOString();
        }

        // Only one task "Active" (in_progress) per assignee: clear in_progress on others for this owner
        const owner = updates.owner !== undefined ? updates.owner : previous?.owner;
        if (updateData.status === 'in_progress' && owner) {
            await this.supabase
                .from('action_items')
                .update({ status: 'pending' })
                .eq('project_id', this.getProjectId())
                .eq('owner', owner)
                .neq('id', id)
                .is('deleted_at', null)
                .eq('status', 'in_progress');
        }

        // Snapshot of previous state for refine rollback (before applying update)
        let refineSnapshot = null;
        if (refinedWithAi && previous) {
            refineSnapshot = {
                content: previous.task ?? previous.content ?? '',
                description: previous.description ?? null,
                definition_of_done: Array.isArray(previous.definition_of_done) ? previous.definition_of_done : (previous.definition_of_done ? [previous.definition_of_done] : []),
                acceptance_criteria: Array.isArray(previous.acceptance_criteria) ? previous.acceptance_criteria : (previous.acceptance_criteria ? [previous.acceptance_criteria] : []),
                size_estimate: previous.size_estimate ?? null
            };
        }

        const { data, error } = await this.supabase
            .from('action_items')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        const actorName = user?.user_metadata?.name || user?.email || null;
        const actorUserId = user?.id || null;

        if (refinedWithAi && refineSnapshot) {
            await this._addActionEvent(id, 'refined_with_ai', { snapshot: refineSnapshot, actor_name: actorName, actor_user_id: actorUserId }, actorUserId, actorName);
        } else if (restoreSnapshot) {
            await this._addActionEvent(id, 'rollback', { reason: 'restore_snapshot' }, actorUserId, actorName);
        } else {
            const changes = [];
            const fieldLabels = { task: 'Task', owner: 'Assignee', deadline: 'Due date', priority: 'Priority', status: 'Status', parent_story_ref: 'Parent Story', size_estimate: 'Size', description: 'Description', definition_of_done: 'DoD', acceptance_criteria: 'Acceptance criteria', requested_by: 'Requested by', supporting_document_ids: 'Supporting documents', sprint_id: 'Sprint', task_points: 'Task points', decision_id: 'Decision' };
            for (const [key, to] of Object.entries(updateData)) {
                const from = previous?.[key];
                if (from !== to && (from !== undefined || to !== undefined)) {
                    const fromVal = from ?? '';
                    const toVal = to ?? '';
                    changes.push({
                        field: fieldLabels[key] || key,
                        from: this._truncateForTimeline(fromVal),
                        to: this._truncateForTimeline(toVal)
                    });
                }
            }
            await this._addActionEvent(id, 'updated', { changes }, actorUserId, actorName);
        }
        await this._addToOutbox('action.updated', 'UPDATE', 'Action', id, data);
        return data;
    }

    /**
     * Delete an action item
     */
    async deleteAction(id, soft = true) {
        const user = await this.getCurrentUser();
        await this._addActionEvent(id, 'deleted', { reason: soft ? 'soft' : 'hard' }, user?.id, user?.user_metadata?.name || user?.email);
        if (soft) {
            await this.supabase
                .from('action_items')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);
        } else {
            await this.supabase.from('action_items').delete().eq('id', id);
        }

        await this._addToOutbox('action.deleted', 'DELETE', 'Action', id, { id });
    }

    /**
     * Delete actions by source document ID (Hard delete for reprocessing)
     */
    async deleteActionsByDocument(documentId) {
        if (!documentId) return 0;
        const projectId = this.getProjectId();
        const { count, error } = await this.supabase
            .from('action_items')
            .delete({ count: 'exact' })
            .eq('source_document_id', documentId)
            .eq('project_id', projectId);

        if (error) throw error;
        return count;
    }

    /**
     * List soft-deleted actions (for restore / undo)
     */
    async getDeletedActions() {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('action_items')
            .select('*')
            .eq('project_id', projectId)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) throw error;
        const actions = data || [];
        for (const a of actions) {
            try { a.depends_on = await this.getTaskDependencies(a.id); } catch (_) { a.depends_on = []; }
        }
        return actions;
    }

    /**
     * Restore a soft-deleted action (undo). Sets deleted_at = null and syncs to graph.
     */
    async restoreAction(id) {
        const projectId = this.getProjectId();
        const { data: existing } = await this.supabase.from('action_items').select('*').eq('id', id).eq('project_id', projectId).single();
        if (!existing) throw new Error('Action not found');
        if (existing.deleted_at == null) throw new Error('Action is not deleted');

        const { data, error } = await this.supabase
            .from('action_items')
            .update({ deleted_at: null })
            .eq('id', id)
            .eq('project_id', projectId)
            .select()
            .single();
        if (error) throw error;

        const user = await this.getCurrentUser();
        await this._addActionEvent(data.id, 'restored', {}, user?.id, user?.user_metadata?.name || user?.email);
        await this._addToOutbox('action.restored', 'CREATE', 'Action', data.id, data);

        try { data.depends_on = await this.getTaskDependencies(data.id); } catch (_) { data.depends_on = []; }
        return data;
    }

    // ==================== Questions ====================

    /**
     * Add a question
     */
    async addQuestion(question, skipDedup = false) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        if (!question.content || typeof question.content !== 'string') {
            throw new Error('Question must have content');
        }

        const content = question.content.trim();

        // Check for duplicates
        if (!skipDedup) {
            const existing = await this.getQuestions();
            const dupCheck = this._findDuplicate(content, existing);
            if (dupCheck.isDuplicate) {
                return { duplicate: true, existing: dupCheck.match, similarity: dupCheck.similarity };
            }
        }

        const { data, error } = await this.supabase
            .from('knowledge_questions')
            .insert({
                project_id: projectId,
                content: content,
                priority: question.priority || 'medium',
                status: question.status || 'open',
                category: question.category,
                context: question.context,
                assigned_to: question.assigned_to,
                source_document_id: question.source_document_id || question.document_id || null,
                source_file: question.source_file,
                created_by: user?.id,
                // AI Generation fields
                requester_role: question.requester_role || null,
                requester_role_prompt: question.requester_role_prompt || null,
                requester_contact_id: question.requester_contact_id || null,
                requester_name: question.requester_name || null,
                ai_generated: question.ai_generated || false,
                generation_source: question.generation_source || null,
                generated_for_role: question.generated_for_role || null
            })
            .select()
            .single();

        if (error) throw error;

        await this._addToOutbox('question.created', 'CREATE', 'Question', data.id, data);
        return data;
    }

    /**
     * Add multiple questions in one insert (batch). No per-item outbox/events.
     * @param {Array<object>} questions - Same shape as addQuestion
     * @param {{ skipDedup?: boolean }} [options]
     * @returns {{ data: Array<object>, inserted: number }}
     */
    async addQuestions(questions, options = {}) {
        const skipDedup = options.skipDedup !== false;
        if (!Array.isArray(questions) || questions.length === 0) return { data: [], inserted: 0 };
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();
        const rows = [];
        for (const q of questions) {
            const content = (q.content && typeof q.content === 'string') ? q.content.trim() : '';
            if (!content) continue;
            rows.push({
                project_id: projectId,
                content,
                priority: q.priority || 'medium',
                status: q.status || 'open',
                category: q.category ?? null,
                context: q.context ?? null,
                assigned_to: q.assigned_to ?? null,
                source_document_id: q.source_document_id || q.document_id || null,
                source_file: q.source_file ?? null,
                created_by: user?.id,
                requester_role: q.requester_role ?? null,
                requester_role_prompt: q.requester_role_prompt ?? null,
                requester_contact_id: q.requester_contact_id ?? null,
                requester_name: q.requester_name ?? null,
                ai_generated: q.ai_generated || false,
                generation_source: q.generation_source ?? null,
                generated_for_role: q.generated_for_role ?? null
            });
        }
        if (rows.length === 0) return { data: [], inserted: 0 };
        const { data: inserted, error } = await this.supabase.from('knowledge_questions').insert(rows).select();
        if (error) throw error;
        const count = Array.isArray(inserted) ? inserted.length : 0;
        return { data: inserted || [], inserted: count };
    }

    /**
     * Get questions
     */
    async getQuestions(status = null, priority = null) {
        const projectId = this.getProjectId();

        let query = this.supabase
            .from('knowledge_questions')
            .select('*')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }
        if (priority) {
            query = query.eq('priority', priority);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    /**
     * Get question by ID
     */
    async getQuestionById(id) {
        const { data, error } = await this.supabase
            .from('knowledge_questions')
            .select('*')
            .eq('id', id)
            .single();

        return error ? null : data;
    }

    /**
     * Update a question
     */
    async updateQuestion(id, updates) {
        // Build update data with only defined fields
        const updateData = {};

        if (updates.content !== undefined) updateData.content = updates.content;
        if (updates.priority !== undefined) updateData.priority = updates.priority;
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.category !== undefined) updateData.category = updates.category;
        if (updates.context !== undefined) updateData.context = updates.context;
        if (updates.assigned_to !== undefined) updateData.assigned_to = updates.assigned_to;
        if (updates.resolution !== undefined) updateData.resolution = updates.resolution;

        // New fields for caching and answers
        if (updates.cached_suggestions !== undefined) updateData.cached_suggestions = updates.cached_suggestions;
        if (updates.suggestions_generated_at !== undefined) updateData.suggestions_generated_at = updates.suggestions_generated_at;
        if (updates.answer !== undefined) updateData.answer = updates.answer;
        if (updates.answered_by !== undefined) updateData.answered_by = updates.answered_by;
        if (updates.answered_at !== undefined) updateData.answered_at = updates.answered_at;
        if (updates.follow_up_to !== undefined) updateData.follow_up_to = updates.follow_up_to;

        if (updates.status === 'answered' || updates.status === 'closed') {
            updateData.resolved_at = new Date().toISOString();
            const user = await this.getCurrentUser();
            updateData.resolved_by = user?.id;
        }

        // If answering, set answered_at
        if (updates.answer && !updates.answered_at) {
            updateData.answered_at = new Date().toISOString();
        }

        const { data, error } = await this.supabase
            .from('knowledge_questions')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await this._addToOutbox('question.updated', 'UPDATE', 'Question', id, data);
        return data;
    }

    /**
     * Delete a question
     */
    async deleteQuestion(id, soft = true) {
        if (soft) {
            await this.supabase
                .from('knowledge_questions')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);
        } else {
            await this.supabase.from('knowledge_questions').delete().eq('id', id);
        }

        await this._addToOutbox('question.deleted', 'DELETE', 'Question', id, { id });
    }

    /**
     * Delete questions by source document ID
     */
    async deleteQuestionsByDocument(documentId) {
        if (!documentId) return 0;
        const projectId = this.getProjectId();
        const { count, error } = await this.supabase
            .from('knowledge_questions')
            .delete({ count: 'exact' })
            .eq('source_document_id', documentId)
            .eq('project_id', projectId);

        if (error) throw error;
        return count;
    }

    // ==================== People ====================

    /**
     * Add a person
     */
    async addPerson(person) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        // Check for existing person with same name
        const { data: existing } = await this.supabase
            .from('people')
            .select('*')
            .eq('project_id', projectId)
            .ilike('name', person.name?.trim())
            .is('deleted_at', null)
            .single();

        if (existing) {
            // Update existing person
            return this.updatePerson(existing.id, person);
        }

        // Build initial context snippets array if we have context
        const contextSnippets = [];
        if (person.context_snippet || person.contextSnippet) {
            contextSnippets.push({
                source: person.source_file || 'Unknown',
                snippet: (person.context_snippet || person.contextSnippet || '').substring(0, 300),
                detected_at: new Date().toISOString()
            });
        }

        const { data, error } = await this.supabase
            .from('people')
            .insert({
                project_id: projectId,
                name: person.name?.trim(),
                role: person.role,
                organization: person.organization,
                email: person.email,
                notes: person.notes,
                source_document_id: person.source_document_id || person.document_id || null,
                source_file: person.source_file,
                first_seen_in: person.source_file || person.first_seen_in,
                role_context: person.role_context || person.roleContext,
                context_snippets: contextSnippets.length > 0 ? contextSnippets : [],
                created_by: user?.id
            })
            .select()
            .single();

        if (error) throw error;

        await this._addToOutbox('person.created', 'CREATE', 'Person', data.id, data);
        return data;
    }

    /**
     * Get people
     */
    async getPeople() {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('people')
            .select('*')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .order('name');

        if (error) throw error;
        return data;
    }

    /**
     * Update a person
     */
    async updatePerson(id, updates) {
        const { data, error } = await this.supabase
            .from('people')
            .update({
                name: updates.name,
                role: updates.role,
                organization: updates.organization,
                email: updates.email,
                notes: updates.notes
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await this._addToOutbox('person.updated', 'UPDATE', 'Person', id, data);
        return data;
    }

    /**
     * Add context snippet to an existing person
     */
    async addPersonContextSnippet(personId, source, snippet) {
        // Get current snippets
        const { data: person, error: fetchError } = await this.supabase
            .from('people')
            .select('context_snippets')
            .eq('id', personId)
            .single();

        if (fetchError) throw fetchError;

        const currentSnippets = person.context_snippets || [];

        // Don't add duplicate snippets (check by source + first 50 chars of snippet)
        const snippetKey = `${source}:${(snippet || '').substring(0, 50)}`;
        const isDuplicate = currentSnippets.some(s =>
            `${s.source}:${(s.snippet || '').substring(0, 50)}` === snippetKey
        );

        if (isDuplicate) {
            return person;
        }

        // Add new snippet (max 5 snippets per person)
        const newSnippets = [
            ...currentSnippets,
            {
                source: source,
                snippet: (snippet || '').substring(0, 300),
                detected_at: new Date().toISOString()
            }
        ].slice(-5); // Keep only last 5

        const { data, error } = await this.supabase
            .from('people')
            .update({ context_snippets: newSnippets })
            .eq('id', personId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Delete a person
     */
    async deletePerson(id, soft = true) {
        if (soft) {
            await this.supabase
                .from('people')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);
        } else {
            await this.supabase.from('people').delete().eq('id', id);
        }

        await this._addToOutbox('person.deleted', 'DELETE', 'Person', id, { id });
    }

    // ==================== Relationships ====================

    /**
     * Add a relationship between people
     */
    async addRelationship(fromPersonId, toPersonId, type, context = null) {
        const projectId = this.getProjectId();

        // Get person names (scoped to current project)
        const [from, to] = await Promise.all([
            this.supabase.from('people').select('name').eq('id', fromPersonId).eq('project_id', projectId).single(),
            this.supabase.from('people').select('name').eq('id', toPersonId).eq('project_id', projectId).single()
        ]);

        const { data, error } = await this.supabase
            .from('relationships')
            .insert({
                project_id: projectId,
                from_person_id: fromPersonId,
                to_person_id: toPersonId,
                from_name: from.data?.name,
                to_name: to.data?.name,
                relationship_type: type,
                context: context
            })
            .select()
            .single();

        if (error) throw error;

        await this._addToOutbox('relationship.created', 'CREATE', 'Relationship', data.id, data);
        return data;
    }

    /**
     * Get relationships
     */
    async getRelationships(personId = null) {
        const projectId = this.getProjectId();

        let query = this.supabase
            .from('relationships')
            .select('*')
            .eq('project_id', projectId)
            .is('deleted_at', null);

        if (personId) {
            query = query.or(`from_person_id.eq.${personId},to_person_id.eq.${personId}`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    /**
     * Delete a relationship
     */
    async deleteRelationship(id) {
        await this.supabase
            .from('relationships')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        await this._addToOutbox('relationship.deleted', 'DELETE', 'Relationship', id, { id });
    }

    // ==================== Contacts ====================

    /**
     * Get role templates (global + custom)
     */
    async getRoleTemplates() {
        const { data, error } = await this.supabase
            .from('role_templates')
            .select('*')
            .eq('is_active', true)
            .order('display_name');

        if (error) {
            log.warn({ event: 'db_query_failed', table: 'role_templates', err: error.message }, 'Error fetching role templates');
            return [];
        }
        return data;
    }

    /**
     * Get all timezones
     */
    async getTimezones() {
        const { data, error } = await this.supabase
            .from('timezones')
            .select('*')
            .order('name');

        if (error) {
            log.warn({ event: 'db_query_failed', table: 'timezones', err: error.message }, 'Error fetching timezones');
            return [];
        }
        return data;
    }

    /**
     * Get companies for the current project context
     */
    async getCompanies() {
        const projectId = this.getProjectId();
        // Companies policy allows reading if member of project, so we filter by project association if needed
        // But companies are project-segregated via RLS or owner?
        // Migration 098 says: "Project members read project company".
        // Also users can own companies.
        // For a normalized list of "Organizations" available to the project, strictly speaking we might just want to return
        // the company associated with the project, OR all companies the user has access to.
        // Given the UI is "Organization" (text usually), but now we want a dropdown.
        // Let's return all companies the user can see.

        const { data, error } = await this.supabase
            .from('companies')
            .select('*')
            .order('name');

        if (error) {
            log.warn({ event: 'db_query_failed', table: 'companies', err: error.message }, 'Error fetching companies');
            return [];
        }
        return data;
    }

    /**
     * Add a contact (global, but linked to current project)
     */
    async addContact(contact) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        // Create global contact (project_id kept for backwards compatibility)
        const { data, error } = await this.supabase
            .from('contacts')
            .insert({
                project_id: projectId, // Legacy field, will be deprecated
                name: contact.name?.trim(),
                email: contact.email,
                phone: contact.phone,
                organization: contact.organization,
                role: contact.role,
                department: contact.department,
                aliases: contact.aliases || [],
                tags: contact.tags || [],
                notes: contact.notes,
                is_favorite: contact.is_favorite || false,
                metadata: contact.metadata || {},
                created_by: user?.id,
                timezone: contact.timezone || null,
                linkedin: contact.linkedin || null,
                photo_url: contact.photo_url || contact.photoUrl || contact.avatar || contact.avatarUrl || null,
                role_context: contact.role_context || contact.roleContext || null
            })
            .select()
            .single();

        if (error) throw error;

        // Also add to contact_projects for N:N relationship
        if (data && projectId) {
            try {
                await this.addContactToProject(data.id, projectId, {
                    role: contact.role,
                    isPrimary: true,
                    addedBy: user?.id
                });
            } catch (e) {
                log.error({ event: 'db_query_failed', table: 'contact_projects', operation: 'insert', err: e.message }, 'Failed to add contact_project link');
            }
        }

        return data;
    }

    /**
     * Get contacts for current project (via contact_projects or legacy project_id)
     */
    async getContacts(filter = null) {
        const projectId = this.getProjectId();

        // First, get contact IDs from contact_projects table
        const { data: contactProjectLinks, error: linkError } = await this.supabase
            .from('contact_projects')
            .select('contact_id')
            .eq('project_id', projectId);

        if (linkError) {
            log.warn({ event: 'db_query_failed', table: 'contact_projects', operation: 'select', projectId, code: linkError.code, err: linkError.message }, 'Error fetching contact_projects');
        }

        const linkedContactIds = (contactProjectLinks || []).map(cp => cp.contact_id);

        // Get contacts with legacy project_id
        const { data: legacyContacts, error: legacyError } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('project_id', projectId)
            .is('deleted_at', null);

        if (legacyError) {
            log.warn({ event: 'db_query_failed', table: 'contacts', operation: 'select', projectId, code: legacyError.code, err: legacyError.message }, 'Error fetching legacy contacts');
        }

        // Get contacts linked via contact_projects
        let linkedContacts = [];
        if (linkedContactIds.length > 0) {
            const { data: linked, error: linkedError } = await this.supabase
                .from('contacts')
                .select('*')
                .in('id', linkedContactIds)
                .is('deleted_at', null);

            if (linkedError) {
                log.warn({ event: 'db_query_failed', table: 'contacts', operation: 'select', projectId, code: linkedError.code, err: linkedError.message }, 'Error fetching linked contacts');
            }
            linkedContacts = linked || [];
        }

        // Merge and deduplicate
        const allContacts = [...(legacyContacts || []), ...linkedContacts];
        const uniqueContactsMap = new Map();
        for (const contact of allContacts) {
            // Map photo_url to avatar and avatarUrl for frontend compatibility
            if (contact.photo_url) {
                contact.avatar = contact.photo_url;
                contact.avatarUrl = contact.photo_url;
            }
            uniqueContactsMap.set(contact.id, contact);
        }
        let contacts = Array.from(uniqueContactsMap.values());

        // Apply filters
        if (filter) {
            if (filter.organization) {
                contacts = contacts.filter(c => c.organization === filter.organization);
            }
            if (filter.tag) {
                contacts = contacts.filter(c => c.tags?.includes(filter.tag));
            }
            if (filter.search) {
                const search = filter.search.toLowerCase();
                contacts = contacts.filter(c =>
                    c.name?.toLowerCase().includes(search) ||
                    c.email?.toLowerCase().includes(search)
                );
            }
            if (filter.is_favorite) {
                contacts = contacts.filter(c => c.is_favorite);
            }
        }

        // Calculate mentionCount based on people (extracted entities)
        try {
            const people = await this.getPeople();
            const normalizeName = (name) => (name || '').toLowerCase().trim();

            // Create a lookup map for people mentions
            const mentionsMap = new Map();
            for (const person of people || []) {
                const name = normalizeName(person.name);
                if (name) {
                    // Count context_snippets as mentions
                    const count = (person.context_snippets || []).length;
                    mentionsMap.set(name, (mentionsMap.get(name) || 0) + count + 1); // +1 for the person record itself
                }
            }

            // Assign mentionCount to contacts
            for (const contact of contacts) {
                let count = 0;
                const namesToCheck = new Set();

                // Add main name
                const mainName = normalizeName(contact.name);
                if (mainName) namesToCheck.add(mainName);

                // Add aliases
                if (contact.aliases && Array.isArray(contact.aliases)) {
                    contact.aliases.forEach(alias => {
                        const aliasName = normalizeName(alias);
                        if (aliasName) namesToCheck.add(aliasName);
                    });
                }

                // Sum counts for unique names
                for (const name of namesToCheck) {
                    if (mentionsMap.has(name)) {
                        count += mentionsMap.get(name);
                    }
                }

                contact.mentionCount = count;
            }
        } catch (e) {
            log.warn({ event: 'mention_count_calc_error', err: e.message }, 'Failed to calculate mention counts');
            // Ensure mentionCount is at least 0
            contacts.forEach(c => { if (c.mentionCount === undefined) c.mentionCount = 0; });
        }

        // Sort by name
        contacts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        return contacts;
    }

    /**
     * Add contact to a project (N:N relationship)
     */
    async addContactToProject(contactId, projectId, options = {}) {
        const { data, error } = await this.supabase
            .from('contact_projects')
            .upsert({
                contact_id: contactId,
                project_id: projectId,
                role: options.role || null,
                is_primary: options.isPrimary || false,
                added_by: options.addedBy || null,
                notes: options.notes || null
            }, { onConflict: 'contact_id,project_id' })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Remove contact from a project
     */
    async removeContactFromProject(contactId, projectId) {
        const { error } = await this.supabase
            .from('contact_projects')
            .delete()
            .eq('contact_id', contactId)
            .eq('project_id', projectId);

        if (error) throw error;
        return true;
    }

    /**
     * Get all projects a contact belongs to
     */
    async getContactProjects(contactId) {
        const { data, error } = await this.supabase
            .from('contact_projects')
            .select(`
                project_id,
                role,
                is_primary,
                added_at,
                projects:project_id (id, name, description)
            `)
            .eq('contact_id', contactId);

        if (error) throw error;
        return data;
    }

    /**
     * Get all teams a contact belongs to
     */
    async getContactTeams(contactId) {
        const { data, error } = await this.supabase
            .from('team_members')
            .select(`
                team_id,
                role,
                is_lead,
                joined_at,
                teams:team_id (id, name, color, description, project_id)
            `)
            .eq('contact_id', contactId);

        if (error) throw error;
        return data;
    }

    /**
     * Get contact by ID
     */
    async getContactById(id) {
        const { data, error } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            log.warn({ event: 'db_query_failed', table: 'contacts', operation: 'select', id, err: error.message }, 'getContactById error');
            return null;
        }

        if (data && data.photo_url) {
            data.avatar = data.photo_url;
            data.avatarUrl = data.photo_url;
        }

        return data;
    }

    /**
     * Get mentions of a contact across all content (documents, emails, conversations)
     * @param {string} contactId - Contact ID
     * @returns {Promise<Array>} List of mentions
     */
    async getContactMentions(contactId) {
        try {
            const projectId = this.getProjectId();
            // log.info({ contactId }, 'Fetching contact mentions');

            const contact = await this.getContactById(contactId);
            if (!contact) return [];

            const names = [contact.name, ...(contact.aliases || [])].filter(Boolean);
            const emails = [contact.email].filter(Boolean);

            const mentions = [];

            // 1. Documents (via People table context_snippets)
            // Use getPeople() and filter in-memory to ensure consistency with getContacts()
            const people = await this.getPeople();
            const normalizeName = (name) => String(name || '').toLowerCase().trim();

            // Create set of normalized contact names
            const targetNames = new Set();
            const mainName = normalizeName(contact.name);
            if (mainName) targetNames.add(mainName);

            if (contact.aliases && Array.isArray(contact.aliases)) {
                contact.aliases.forEach(alias => {
                    const aliasName = normalizeName(alias);
                    if (aliasName) targetNames.add(aliasName);
                });
            }

            if (people) {
                for (const person of people) {
                    const personName = normalizeName(person.name);
                    // Check if this person record matches our contact
                    if (personName && targetNames.has(personName)) {
                        if (person.context_snippets && Array.isArray(person.context_snippets)) {
                            for (const snippet of person.context_snippets) {
                                // Deduce type from source
                                let type = 'document';
                                const source = snippet.source || person.source_file || '';
                                let link = null;

                                if (source.startsWith('Email:')) {
                                    type = 'email';
                                } else if (source.startsWith('Conversation:')) {
                                    type = 'conversation';
                                } else if (source.startsWith('Transcription:')) {
                                    type = 'transcription';
                                    if (person.source_document_id && (snippet.source === person.source_file || !person.source_file)) {
                                        link = `/documents/${person.source_document_id}`;
                                    }
                                } else {
                                    // Default document
                                    if (person.source_document_id && (snippet.source === person.source_file || !person.source_file)) {
                                        link = `/documents/${person.source_document_id}`;
                                    }
                                }

                                mentions.push({
                                    id: `snippet_${person.id}_${mentions.length}`,
                                    type: type,
                                    text: snippet.snippet || '',
                                    source: source,
                                    date: snippet.detected_at || person.created_at,
                                    link: link
                                });
                            }
                        }
                    }
                }
            }


            // 2. Emails (Sender or Recipient)
            if (emails.length > 0) {
                // Sender: emails where from_email IN emails
                const { data: sentEmails } = await this.supabase
                    .from('emails')
                    .select('id, subject, date_sent, body_text')
                    .eq('project_id', projectId)
                    .in('from_email', emails)
                    .is('deleted_at', null)
                    .limit(50);

                if (sentEmails) {
                    for (const email of sentEmails) {
                        mentions.push({
                            id: `email_sent_${email.id}`,
                            type: 'email',
                            text: `Sent email: ${email.subject}`,
                            source: email.subject,
                            date: email.date_sent,
                            link: `/emails/${email.id}`
                        });
                    }
                }

                // Recipient: email_recipients where contact_id = contactId
                const { data: received } = await this.supabase
                    .from('email_recipients')
                    .select('email:emails(id, subject, date_sent, from_name)')
                    .eq('contact_id', contactId)
                    .limit(50);

                if (received) {
                    for (const r of received) {
                        if (r.email) {
                            mentions.push({
                                id: `email_received_${r.email.id}`,
                                type: 'email',
                                text: `Received email from ${r.email.from_name || 'Unknown'}: ${r.email.subject}`,
                                source: r.email.subject,
                                date: r.email.date_sent,
                                link: `/emails/${r.email.id}`
                            });
                        }
                    }
                }
            }

            // 3. Conversations (Participants)
            // Fetch recent conversations and check participants array
            const { data: conversations } = await this.supabase
                .from('conversations')
                .select('id, title, conversation_date, participants, summary, created_at')
                .eq('project_id', projectId)
                .is('deleted_at', null)
                .limit(50);

            if (conversations) {
                for (const conv of conversations) {
                    const participants = conv.participants || [];
                    // Check if any of the contact names are in participants
                    // Ensure safe string comparison
                    const isParticipant = Array.isArray(participants) && participants.some(p =>
                        names.some(n => String(n).toLowerCase().trim() === String(p || '').toLowerCase().trim())
                    );

                    if (isParticipant) {
                        mentions.push({
                            id: `conv_${conv.id}`,
                            type: 'conversation',
                            text: conv.summary || `Participated in conversation: ${conv.title || 'Untitled'}`,
                            source: conv.title || 'Conversation',
                            date: conv.conversation_date || conv.created_at,
                            link: `/chat/${conv.id}`
                        });
                    }
                }
            }

            // Remove potential duplicates by ID if any logic overlaps, though IDs are distinct prefixes.
            // Sort by date descending
            return mentions.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (error) {
            log.error({ err: error, contactId, stack: error.stack }, 'Failed to get contact mentions');
            throw error; // Re-throw to ensure 500 is still returned but logged
        }
    }

    /**
     * Find contact by name
     */
    async findContactByName(name) {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('project_id', projectId)
            .ilike('name', name)
            .is('deleted_at', null)
            .single();

        return error ? null : data;
    }

    /**
     * Find contact by name or alias
     */
    async findContactByNameOrAlias(name) {
        if (!name) return null;
        const projectId = this.getProjectId();
        const normalizedName = name.toLowerCase().trim();

        // Try exact name match first
        let contact = await this.findContactByName(name);
        if (contact) return contact;

        // Try searching in aliases
        // Note: This is an expensive query if not indexed properly, 
        // but Postgres JSONB support is good
        const { data, error } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('project_id', projectId)
            .contains('aliases', [name]) // precise match in array
            .is('deleted_at', null)
            .limit(1)
            .mayBeSingle();

        if (data) return data;

        // Try case-insensitive search on aliases if exact failed
        // We'll need to fetch contacts with non-empty aliases and filter in memory 
        // OR use a more complex query. For now, let's keep it simple and safe.
        // A full scan is bad, so we might skip the loose alias match for now
        // or rely on the frontend/calls to be precise.

        return null;
    }

    /**
     * Update a contact
     */
    async updateContact(id, updates) {
        // Build update object with only defined fields
        const updateData = {};

        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.email !== undefined) updateData.email = updates.email;
        if (updates.phone !== undefined) updateData.phone = updates.phone;
        if (updates.organization !== undefined) updateData.organization = updates.organization;
        if (updates.role !== undefined) updateData.role = updates.role;
        if (updates.department !== undefined) updateData.department = updates.department;
        if (updates.aliases !== undefined) updateData.aliases = updates.aliases;
        if (updates.tags !== undefined) updateData.tags = updates.tags;
        if (updates.notes !== undefined) updateData.notes = updates.notes;
        if (updates.is_favorite !== undefined) updateData.is_favorite = updates.is_favorite;
        if (updates.is_archived !== undefined) updateData.is_archived = updates.is_archived;
        if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
        // New fields
        if (updates.timezone !== undefined) updateData.timezone = updates.timezone;
        if (updates.linkedin !== undefined) updateData.linkedin = updates.linkedin;
        if (updates.location !== undefined) updateData.location = updates.location;
        if (updates.photo_url !== undefined) updateData.photo_url = updates.photo_url;
        if (updates.photoUrl !== undefined) updateData.photo_url = updates.photoUrl;
        if (updates.avatar !== undefined) updateData.photo_url = updates.avatar;
        if (updates.avatarUrl !== undefined) updateData.photo_url = updates.avatarUrl;
        if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url;
        if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl;
        if (updates.role_context !== undefined) updateData.role_context = updates.role_context;
        if (updates.roleContext !== undefined) updateData.role_context = updates.roleContext;

        const { data, error } = await this.supabase
            .from('contacts')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Delete a contact
     */
    async deleteContact(id, soft = true) {
        if (soft) {
            await this.supabase
                .from('contacts')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);
        } else {
            await this.supabase
                .from('contacts')
                .delete()
                .eq('id', id);
        }
        return true;
    }

    /**
     * Get roles for the current project
     */
    async getRoles() {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('contact_roles')
            .select('*')
            .eq('project_id', projectId)
            .order('name');

        if (error) {
            log.warn({ event: 'db_query_failed', table: 'contact_roles', operation: 'select', projectId, err: error.message }, 'Error fetching roles');
            return [];
        }
        return data;
    }

    /**
     * Get roles for the current project
     */
    async getRoles() {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('contact_roles')
            .select('*')
            .eq('project_id', projectId)
            .order('name');

        if (error) {
            log.warn({ event: 'db_query_failed', table: 'contact_roles', operation: 'select', projectId, err: error.message }, 'Error fetching roles');
            return [];
        }
        return data;
    }

    /**
     * Update a project member
     */
    async updateProjectMember(userId, updates) {
        const projectId = this.getProjectId();
        if (!projectId) throw new Error('No active project');

        const { data, error } = await this.supabase
            .from('project_members')
            .update(updates)
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Add a new role
     */
    async addRole(name) {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('contact_roles')
            .insert({ project_id: projectId, name })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get relationships for a contact
     */
    async getContactRelationships(contactId) {
        // Get relationships where contact is 'from' or 'to'
        const { data: fromRels, error: fromError } = await this.supabase
            .from('contact_relationships')
            .select(`
                id, type, strength, notes, created_at,
                other_contact:to_contact_id (id, name, role, avatar_url, photo_url)
            `)
            .eq('from_contact_id', contactId);

        if (fromError) throw fromError;

        const { data: toRels, error: toError } = await this.supabase
            .from('contact_relationships')
            .select(`
                id, type, strength, notes, created_at,
                other_contact:from_contact_id (id, name, role, avatar_url, photo_url)
            `)
            .eq('to_contact_id', contactId);

        if (toError) throw toError;

        // Normalize and combine
        const relationships = [
            ...(fromRels || []).map(r => ({ ...r, direction: 'forward' })),
            ...(toRels || []).map(r => ({ ...r, direction: 'backward' }))
        ];

        return relationships;
    }

    /**
     * Add a relationship between contacts
     */
    async addContactRelationship(data) {
        const { data: rel, error } = await this.supabase
            .from('contact_relationships')
            .insert({
                project_id: this.getProjectId(),
                from_contact_id: data.fromId,
                to_contact_id: data.toId,
                type: data.type,
                strength: data.strength || 1,
                notes: data.notes
            })
            .select()
            .single();

        if (error) throw error;
        return rel;
    }

    /**
     * Remove a relationship
     */
    async removeContactRelationship(id) {
        const { error } = await this.supabase
            .from('contact_relationships')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }

    /**
     * Get activity for a contact
     */
    async getContactActivity(contactId) {
        // 1. Get direct activity records
        const { data: directActivity, error: activityError } = await this.supabase
            .from('contact_activity')
            .select('*')
            .eq('contact_id', contactId)
            .order('occurred_at', { ascending: false })
            .limit(20);

        if (activityError && activityError.code !== 'PGRST116') { // Ignore if table doesn't exist yet
            log.warn({ err: activityError }, 'Error fetching contact_activity');
        }

        // 2. Get actions/tasks owned by this contact
        const { data: actions, error: actionsError } = await this.supabase
            .from('action_items')
            .select('*')
            .eq('owner', (await this.getContactById(contactId))?.name) // Fallback to name matching for now if owner is string
            .limit(20);

        // Merge and sort
        const activity = [
            ...(directActivity || []).map(a => ({
                id: a.id,
                type: a.activity_type,
                description: a.description,
                date: a.occurred_at || a.created_at,
                source: 'activity'
            })),
            ...(actions || []).map(a => ({
                id: a.id,
                type: 'action',
                description: `Action assigned: ${a.title}`,
                date: a.created_at,
                status: a.status,
                source: 'action_items'
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        return activity;
    }


    /**
     * Add contact activity
     */
    async addContactActivity(contactId, activity) {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('contact_activity')
            .insert({
                contact_id: contactId,
                project_id: projectId,
                activity_type: activity.type,
                description: activity.description,
                source_type: activity.source_type,
                source_id: activity.source_id,
                source_name: activity.source_name,
                occurred_at: activity.occurred_at || new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Track contacts from conversation
     */
    async trackContactsFromConversation(conversation) {
        if (!conversation || !conversation.participants || conversation.participants.length === 0) return;

        const projectId = this.getProjectId();

        for (const participantName of conversation.participants) {
            // Skip if it's the user (handled by logic elsewhere usually, but good safeguard)
            if (participantName === 'User' || participantName === 'You') continue;

            const contact = await this.findContactByNameOrAlias(participantName);

            if (contact) {
                // Add activity
                await this.addContactActivity(contact.id, {
                    type: 'conversation',
                    description: conversation.title || 'Untitled Conversation',
                    source_type: 'conversation',
                    source_id: conversation.id,
                    source_name: conversation.title || 'Conversation',
                    occurred_at: conversation.created_at || new Date().toISOString()
                });
            }
        }
    }

    /**
     * Sync people from knowledge base to contacts
     */
    async syncPeopleToContacts() {
        const projectId = this.getProjectId();
        const people = await this.getPeople();

        let stats = { added: 0, updated: 0, skipped: 0, errors: 0 };

        for (const person of people) {
            try {
                if (!person.name) continue;

                const existingContact = await this.findContactByNameOrAlias(person.name);

                if (existingContact) {
                    // Add activity from source if available
                    if (person.source_document_id || person.source_id) {
                        // Check if we already have this activity to avoid dupes?
                        // addContactActivity usually just inserts. 
                        // For now we just add it.

                        await this.addContactActivity(existingContact.id, {
                            type: 'document',
                            description: `Mentioned in ${person.source_name || 'document'}`,
                            source_type: 'document',
                            source_id: person.source_document_id || person.source_id,
                            source_name: person.source_name,
                            occurred_at: person.created_at || new Date().toISOString()
                        });
                        stats.updated++;
                    } else {
                        stats.skipped++;
                    }
                } else {
                    // Create new contact
                    const newContact = await this.addContact({
                        name: person.name,
                        role: person.role,
                        organization: person.organization,
                        notes: person.description || `Imported from ${person.source_name || 'knowledge base'}`,
                        tags: ['auto-imported']
                    });

                    if (newContact) {
                        stats.added++;
                        // Add activity
                        if (person.source_document_id || person.source_id) {
                            await this.addContactActivity(newContact.id, {
                                type: 'document',
                                description: `Mentioned in ${person.source_name || 'document'}`,
                                source_type: 'document',
                                source_id: person.source_document_id || person.source_id,
                                source_name: person.source_name,
                                occurred_at: person.created_at || new Date().toISOString()
                            });
                        }
                    }
                }
            } catch (err) {
                stats.errors++;
                log.error({ err, person: person.name }, 'Error syncing person to contact');
            }
        }

        return stats;
    }

    // ==================== Contact Relationships ====================

    /**
     * Add a relationship between contacts
     */
    async addContactRelationship(fromContactId, toContactId, type, options = {}) {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('contact_relationships')
            .insert({
                project_id: projectId,
                from_contact_id: fromContactId,
                to_contact_id: toContactId,
                relationship_type: type,
                strength: options.strength || 3,
                notes: options.notes || null
            })
            .select()
            .single();

        if (error) {
            // Check if duplicate
            if (error.code === '23505') {
                throw new Error('This relationship already exists');
            }
            throw error;
        }

        await this._addToOutbox('contact_relationship.created', 'CREATE', 'ContactRelationship', data.id, data);
        return data;
    }

    /**
     * Get contact relationships for the project
     */
    async getContactRelationships(contactId = null) {
        const projectId = this.getProjectId();

        let query = this.supabase
            .from('contact_relationships')
            .select(`
                *,
                from_contact:contacts!contact_relationships_from_contact_id_fkey(id, name, role, organization),
                to_contact:contacts!contact_relationships_to_contact_id_fkey(id, name, role, organization)
            `)
            .eq('project_id', projectId)
            .is('deleted_at', null);

        if (contactId) {
            query = query.or(`from_contact_id.eq.${contactId},to_contact_id.eq.${contactId}`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    /**
     * Delete a contact relationship
     */
    async deleteContactRelationship(id) {
        const { error } = await this.supabase
            .from('contact_relationships')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
        await this._addToOutbox('contact_relationship.deleted', 'DELETE', 'ContactRelationship', id, { id });
    }

    /**
     * Remove specific relationship between two contacts
     */
    async removeContactRelationshipByContacts(fromContactId, toContactId, type) {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('contact_relationships')
            .update({ deleted_at: new Date().toISOString() })
            .eq('project_id', projectId)
            .eq('from_contact_id', fromContactId)
            .eq('to_contact_id', toContactId)
            .eq('relationship_type', type)
            .is('deleted_at', null)
            .select();

        if (error) throw error;
        return data && data.length > 0;
    }

    // ==================== Contact Duplicates ====================

    /**
     * Find duplicate contacts based on name similarity and aliases
     * Returns groups of contacts that might be the same person
     */
    async findDuplicateContacts() {
        const projectId = this.getProjectId();

        // Get all contacts for the project
        const { data: contacts, error } = await this.supabase
            .from('contacts')
            .select('id, name, email, organization, aliases, phone')
            .eq('project_id', projectId)
            .is('deleted_at', null);

        if (error) throw error;
        if (!contacts || contacts.length === 0) return [];

        const duplicateGroups = [];
        const processed = new Set();

        // Normalize name for comparison
        const normalizeName = (name) => {
            if (!name) return '';
            return name.toLowerCase().replace(/[^a-z0-9]/g, '');
        };

        // Check if two contacts might be the same person
        const mightBeSamePerson = (c1, c2) => {
            const name1 = normalizeName(c1.name);
            const name2 = normalizeName(c2.name);
            const aliases1 = (c1.aliases || []).map(normalizeName);
            const aliases2 = (c2.aliases || []).map(normalizeName);

            // Check exact name match
            if (name1 === name2 && name1.length > 2) return true;

            // Check if name matches any alias
            if (aliases1.includes(name2) || aliases2.includes(name1)) return true;

            // Check if any aliases match
            for (const alias of aliases1) {
                if (alias && aliases2.includes(alias)) return true;
            }

            // Check email match
            if (c1.email && c2.email && c1.email.toLowerCase() === c2.email.toLowerCase()) return true;

            // Check phone match (normalize phone)
            if (c1.phone && c2.phone) {
                const p1 = c1.phone.replace(/\D/g, '');
                const p2 = c2.phone.replace(/\D/g, '');
                if (p1.length >= 8 && p1 === p2) return true;
            }

            // Check partial name match (first name + last initial or similar)
            const parts1 = c1.name?.toLowerCase().split(/\s+/) || [];
            const parts2 = c2.name?.toLowerCase().split(/\s+/) || [];
            if (parts1.length >= 1 && parts2.length >= 1) {
                // First names match and same organization
                if (parts1[0] === parts2[0] && parts1[0].length > 2 &&
                    c1.organization && c2.organization &&
                    c1.organization.toLowerCase() === c2.organization.toLowerCase()) {
                    return true;
                }
            }

            return false;
        };

        // Find duplicate groups
        for (let i = 0; i < contacts.length; i++) {
            if (processed.has(contacts[i].id)) continue;

            const group = [contacts[i]];
            processed.add(contacts[i].id);

            for (let j = i + 1; j < contacts.length; j++) {
                if (processed.has(contacts[j].id)) continue;

                if (mightBeSamePerson(contacts[i], contacts[j])) {
                    group.push(contacts[j]);
                    processed.add(contacts[j].id);
                }
            }

            if (group.length > 1) {
                duplicateGroups.push(group);
            }
        }

        log.debug({ event: 'duplicate_groups_found', count: duplicateGroups.length }, 'Potential duplicate groups');
        return duplicateGroups;
    }

    /**
     * Merge multiple contacts into one
     * Keeps the first contact as primary and merges data from others
     */
    async mergeContacts(contactIds) {
        if (!contactIds || contactIds.length < 2) {
            throw new Error('At least 2 contact IDs required for merge');
        }

        const projectId = this.getProjectId();

        // Get all contacts to merge
        const { data: contacts, error: fetchError } = await this.supabase
            .from('contacts')
            .select('*')
            .in('id', contactIds)
            .eq('project_id', projectId)
            .is('deleted_at', null);

        if (fetchError) throw fetchError;
        if (!contacts || contacts.length < 2) {
            throw new Error('Could not find contacts to merge');
        }

        // Primary contact is the first one (usually the one with most data)
        const primary = contacts[0];
        const others = contacts.slice(1);

        // Collect all aliases from all contacts
        const allAliases = new Set(primary.aliases || []);
        for (const contact of others) {
            // Add the name as an alias
            if (contact.name && contact.name !== primary.name) {
                allAliases.add(contact.name);
            }
            // Add existing aliases
            for (const alias of contact.aliases || []) {
                allAliases.add(alias);
            }
        }

        // Merge tags
        const allTags = new Set(primary.tags || []);
        for (const contact of others) {
            for (const tag of contact.tags || []) {
                allTags.add(tag);
            }
        }

        // Merge notes
        let mergedNotes = primary.notes || '';
        for (const contact of others) {
            if (contact.notes) {
                mergedNotes += (mergedNotes ? '\n---\n' : '') + contact.notes;
            }
        }

        // Fill in missing fields from other contacts
        const mergedData = {
            aliases: Array.from(allAliases),
            tags: Array.from(allTags),
            notes: mergedNotes,
            email: primary.email || others.find(c => c.email)?.email,
            phone: primary.phone || others.find(c => c.phone)?.phone,
            organization: primary.organization || others.find(c => c.organization)?.organization,
            department: primary.department || others.find(c => c.department)?.department,
            role: primary.role || others.find(c => c.role)?.role,
            linkedin: primary.linkedin || others.find(c => c.linkedin)?.linkedin,
            timezone: primary.timezone || others.find(c => c.timezone)?.timezone,
            location: primary.location || others.find(c => c.location)?.location,
            photo_url: primary.photo_url || others.find(c => c.photo_url)?.photo_url,
            interaction_count: contacts.reduce((sum, c) => sum + (c.interaction_count || 0), 0),
            updated_at: new Date().toISOString()
        };

        // Update primary contact
        const { error: updateError } = await this.supabase
            .from('contacts')
            .update(mergedData)
            .eq('id', primary.id);

        if (updateError) throw updateError;

        // Transfer relationships from other contacts to primary
        const otherIds = others.map(c => c.id);

        // Update contact_relationships - from_contact_id
        await this.supabase
            .from('contact_relationships')
            .update({ from_contact_id: primary.id })
            .in('from_contact_id', otherIds);

        // Update contact_relationships - to_contact_id
        await this.supabase
            .from('contact_relationships')
            .update({ to_contact_id: primary.id })
            .in('to_contact_id', otherIds);

        // Update contact_activity
        await this.supabase
            .from('contact_activity')
            .update({ contact_id: primary.id })
            .in('contact_id', otherIds);

        // Update contact_projects
        const { data: existingProjects } = await this.supabase
            .from('contact_projects')
            .select('project_id')
            .eq('contact_id', primary.id);

        const existingProjectIds = new Set((existingProjects || []).map(p => p.project_id));

        // Get projects from other contacts
        const { data: otherProjects } = await this.supabase
            .from('contact_projects')
            .select('*')
            .in('contact_id', otherIds);

        // Add new project associations
        for (const proj of otherProjects || []) {
            if (!existingProjectIds.has(proj.project_id)) {
                await this.supabase
                    .from('contact_projects')
                    .insert({
                        contact_id: primary.id,
                        project_id: proj.project_id,
                        role: proj.role,
                        is_primary: false
                    })
                    .onConflict(['contact_id', 'project_id'])
                    .ignore();
            }
        }

        // Handle team_profiles (unique constraint on project_id, contact_id)
        // Check if primary already has a profile for this project
        const { data: primaryProfile } = await this.supabase
            .from('team_profiles')
            .select('id')
            .eq('contact_id', primary.id)
            .eq('project_id', projectId)
            .single();

        if (primaryProfile) {
            // Primary already has profile - delete profiles from merged contacts
            await this.supabase
                .from('team_profiles')
                .delete()
                .in('contact_id', otherIds)
                .eq('project_id', projectId);
        } else {
            // Transfer the first profile found to primary, delete the rest
            const { data: otherProfiles } = await this.supabase
                .from('team_profiles')
                .select('id')
                .in('contact_id', otherIds)
                .eq('project_id', projectId)
                .limit(1);

            if (otherProfiles && otherProfiles.length > 0) {
                // Update first profile to use primary contact_id
                await this.supabase
                    .from('team_profiles')
                    .update({ contact_id: primary.id })
                    .eq('id', otherProfiles[0].id);

                // Delete remaining duplicate profiles
                await this.supabase
                    .from('team_profiles')
                    .delete()
                    .in('contact_id', otherIds)
                    .eq('project_id', projectId);
            }
        }

        // Handle behavioral_relationships (unique constraint on project_id, from/to, type)
        // First delete any relationships that would become self-referential
        await this.supabase
            .from('behavioral_relationships')
            .delete()
            .in('from_contact_id', otherIds)
            .eq('to_contact_id', primary.id);

        await this.supabase
            .from('behavioral_relationships')
            .delete()
            .eq('from_contact_id', primary.id)
            .in('to_contact_id', otherIds);

        await this.supabase
            .from('behavioral_relationships')
            .delete()
            .in('from_contact_id', otherIds)
            .in('to_contact_id', otherIds);

        // Update remaining behavioral_relationships - from_contact_id
        // Use RPC or ignore conflicts
        const { data: fromRels } = await this.supabase
            .from('behavioral_relationships')
            .select('*')
            .in('from_contact_id', otherIds);

        for (const rel of fromRels || []) {
            await this.supabase
                .from('behavioral_relationships')
                .upsert({
                    ...rel,
                    from_contact_id: primary.id
                }, { onConflict: 'project_id,from_contact_id,to_contact_id,relationship_type' });
        }

        // Delete original relationships from merged contacts
        await this.supabase
            .from('behavioral_relationships')
            .delete()
            .in('from_contact_id', otherIds);

        // Update remaining behavioral_relationships - to_contact_id
        const { data: toRels } = await this.supabase
            .from('behavioral_relationships')
            .select('*')
            .in('to_contact_id', otherIds);

        for (const rel of toRels || []) {
            await this.supabase
                .from('behavioral_relationships')
                .upsert({
                    ...rel,
                    to_contact_id: primary.id
                }, { onConflict: 'project_id,from_contact_id,to_contact_id,relationship_type' });
        }

        // Delete original relationships to merged contacts
        await this.supabase
            .from('behavioral_relationships')
            .delete()
            .in('to_contact_id', otherIds);

        // Handle profile_evidence - just transfer (no unique constraint on contact_id alone)
        await this.supabase
            .from('profile_evidence')
            .update({ contact_id: primary.id })
            .in('contact_id', otherIds);

        // Update emails - sender_contact_id
        await this.supabase
            .from('emails')
            .update({ sender_contact_id: primary.id })
            .in('sender_contact_id', otherIds);

        // Update email_contacts - contact_id
        await this.supabase
            .from('email_contacts')
            .update({ contact_id: primary.id })
            .in('contact_id', otherIds);

        // Update questions - requester_contact_id and answered_by_contact_id
        await this.supabase
            .from('questions')
            .update({ requester_contact_id: primary.id })
            .in('requester_contact_id', otherIds);

        await this.supabase
            .from('questions')
            .update({ answered_by_contact_id: primary.id })
            .in('answered_by_contact_id', otherIds);

        // Update question_updates - actor_contact_id
        await this.supabase
            .from('question_updates')
            .update({ actor_contact_id: primary.id })
            .in('actor_contact_id', otherIds);

        // Update chat_messages - context_contact_id
        await this.supabase
            .from('chat_messages')
            .update({ context_contact_id: primary.id })
            .in('context_contact_id', otherIds);

        // Update team_members - contact_id (already handled by contact_projects, but check)
        await this.supabase
            .from('team_members')
            .update({ contact_id: primary.id })
            .in('contact_id', otherIds);

        // Update project_members - linked_contact_id
        await this.supabase
            .from('project_members')
            .update({ linked_contact_id: primary.id })
            .in('linked_contact_id', otherIds);

        // Soft delete the merged contacts
        const { error: deleteError } = await this.supabase
            .from('contacts')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', otherIds);

        if (deleteError) throw deleteError;

        log.info({ event: 'contacts_merged', count: contacts.length, primaryId: primary.id }, 'Merged contacts');
        await this._addToOutbox('contacts.merged', 'UPDATE', 'Contact', primary.id, {
            mergedIds: otherIds,
            primaryId: primary.id
        });

        return primary.id;
    }

    // ==================== Teams ====================

    /**
     * Add a team
     */
    async addTeam(team) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        const { data, error } = await this.supabase
            .from('teams')
            .insert({
                project_id: projectId,
                name: team.name?.trim(),
                description: team.description,
                color: team.color,
                icon: team.icon,
                team_type: team.team_type || 'team',
                parent_team_id: team.parent_team_id,
                created_by: user?.id
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get teams
     */
    async getTeams() {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('teams')
            .select(`
                *,
                members:team_members(
                    contact:contacts(id, name, email, role)
                )
            `)
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .order('name');

        if (error) throw error;
        return data;
    }

    /**
     * Get team by ID
     */
    async getTeamById(id) {
        const { data, error } = await this.supabase
            .from('teams')
            .select(`
                *,
                members:team_members(
                    contact:contacts(*)
                )
            `)
            .eq('id', id)
            .single();

        return error ? null : data;
    }

    /**
     * Update a team
     */
    async updateTeam(id, updates) {
        const { data, error } = await this.supabase
            .from('teams')
            .update({
                name: updates.name,
                description: updates.description,
                color: updates.color,
                icon: updates.icon,
                team_type: updates.team_type,
                parent_team_id: updates.parent_team_id
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Delete a team
     */
    async deleteTeam(id, soft = true) {
        if (soft) {
            await this.supabase
                .from('teams')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);
        } else {
            await this.supabase.from('teams').delete().eq('id', id);
        }
    }

    // ==================== Timezones ====================

    /**
     * Get all timezones from database
     */
    async getTimezones() {
        const { data, error } = await this.supabase
            .from('timezones')
            .select('*')
            .order('region')
            .order('name');

        if (error) {
            log.warn({ event: 'timezones_get_failed', reason: error.message }, 'getTimezones error');
            return [];
        }
        return data || [];
    }

    /**
     * Get timezones grouped by region
     */
    async getTimezonesGrouped() {
        const timezones = await this.getTimezones();
        const grouped = {};

        for (const tz of timezones) {
            if (!grouped[tz.region]) {
                grouped[tz.region] = [];
            }
            grouped[tz.region].push(tz);
        }

        return grouped;
    }

    /**
     * Ensure timezones table exists and has data
     * Called on startup to bootstrap timezone data
     */
    async ensureTimezonesExist() {
        try {
            // Check if timezones table has data
            const { data, error } = await this.supabase
                .from('timezones')
                .select('code')
                .limit(1);

            if (error) {
                log.debug({ event: 'timezones_table_missing' }, 'Timezones table may not exist yet, migration needed');
                return false;
            }

            if (data && data.length > 0) {
                log.debug({ event: 'timezones_already_populated' }, 'Timezones table already populated');
                return true;
            }

            log.info({ event: 'timezones_populating' }, 'Populating timezones table');
            const timezoneData = this._getTimezoneData();

            const { error: insertError } = await this.supabase
                .from('timezones')
                .upsert(timezoneData, { onConflict: 'code' });

            if (insertError) {
                log.warn({ event: 'timezones_populate_failed', reason: insertError.message }, 'Error populating timezones');
                return false;
            }

            log.info({ event: 'timezones_inserted', count: timezoneData.length }, 'Inserted timezones');
            return true;
        } catch (e) {
            log.warn({ event: 'timezones_ensure_failed', reason: e.message }, 'ensureTimezonesExist error');
            return false;
        }
    }

    /**
     * Get timezone seed data
     */
    _getTimezoneData() {
        return [
            // UTC
            { code: 'UTC', name: 'Coordinated Universal Time', region: 'UTC', utc_offset: '+00:00', abbreviation: 'UTC' },
            // Europe
            { code: 'Europe/Lisbon', name: 'Lisbon, Portugal', region: 'Europe', utc_offset: '+00:00', abbreviation: 'WET/WEST' },
            { code: 'Europe/London', name: 'London, United Kingdom', region: 'Europe', utc_offset: '+00:00', abbreviation: 'GMT/BST' },
            { code: 'Europe/Dublin', name: 'Dublin, Ireland', region: 'Europe', utc_offset: '+00:00', abbreviation: 'GMT/IST' },
            { code: 'Europe/Paris', name: 'Paris, France', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Brussels', name: 'Brussels, Belgium', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Amsterdam', name: 'Amsterdam, Netherlands', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Berlin', name: 'Berlin, Germany', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Madrid', name: 'Madrid, Spain', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Rome', name: 'Rome, Italy', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Vienna', name: 'Vienna, Austria', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Zurich', name: 'Zurich, Switzerland', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Stockholm', name: 'Stockholm, Sweden', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Oslo', name: 'Oslo, Norway', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Copenhagen', name: 'Copenhagen, Denmark', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Warsaw', name: 'Warsaw, Poland', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Prague', name: 'Prague, Czech Republic', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Budapest', name: 'Budapest, Hungary', region: 'Europe', utc_offset: '+01:00', abbreviation: 'CET/CEST' },
            { code: 'Europe/Helsinki', name: 'Helsinki, Finland', region: 'Europe', utc_offset: '+02:00', abbreviation: 'EET/EEST' },
            { code: 'Europe/Athens', name: 'Athens, Greece', region: 'Europe', utc_offset: '+02:00', abbreviation: 'EET/EEST' },
            { code: 'Europe/Bucharest', name: 'Bucharest, Romania', region: 'Europe', utc_offset: '+02:00', abbreviation: 'EET/EEST' },
            { code: 'Europe/Sofia', name: 'Sofia, Bulgaria', region: 'Europe', utc_offset: '+02:00', abbreviation: 'EET/EEST' },
            { code: 'Europe/Kyiv', name: 'Kyiv, Ukraine', region: 'Europe', utc_offset: '+02:00', abbreviation: 'EET/EEST' },
            { code: 'Europe/Istanbul', name: 'Istanbul, Turkey', region: 'Europe', utc_offset: '+03:00', abbreviation: 'TRT' },
            { code: 'Europe/Moscow', name: 'Moscow, Russia', region: 'Europe', utc_offset: '+03:00', abbreviation: 'MSK' },
            // Americas
            { code: 'America/New_York', name: 'New York, USA', region: 'Americas', utc_offset: '-05:00', abbreviation: 'EST/EDT' },
            { code: 'America/Toronto', name: 'Toronto, Canada', region: 'Americas', utc_offset: '-05:00', abbreviation: 'EST/EDT' },
            { code: 'America/Chicago', name: 'Chicago, USA', region: 'Americas', utc_offset: '-06:00', abbreviation: 'CST/CDT' },
            { code: 'America/Denver', name: 'Denver, USA', region: 'Americas', utc_offset: '-07:00', abbreviation: 'MST/MDT' },
            { code: 'America/Phoenix', name: 'Phoenix, USA', region: 'Americas', utc_offset: '-07:00', abbreviation: 'MST' },
            { code: 'America/Los_Angeles', name: 'Los Angeles, USA', region: 'Americas', utc_offset: '-08:00', abbreviation: 'PST/PDT' },
            { code: 'America/Vancouver', name: 'Vancouver, Canada', region: 'Americas', utc_offset: '-08:00', abbreviation: 'PST/PDT' },
            { code: 'America/Anchorage', name: 'Anchorage, USA', region: 'Americas', utc_offset: '-09:00', abbreviation: 'AKST/AKDT' },
            { code: 'Pacific/Honolulu', name: 'Honolulu, Hawaii', region: 'Americas', utc_offset: '-10:00', abbreviation: 'HST' },
            { code: 'America/Mexico_City', name: 'Mexico City, Mexico', region: 'Americas', utc_offset: '-06:00', abbreviation: 'CST/CDT' },
            { code: 'America/Bogota', name: 'Bogota, Colombia', region: 'Americas', utc_offset: '-05:00', abbreviation: 'COT' },
            { code: 'America/Lima', name: 'Lima, Peru', region: 'Americas', utc_offset: '-05:00', abbreviation: 'PET' },
            { code: 'America/Santiago', name: 'Santiago, Chile', region: 'Americas', utc_offset: '-04:00', abbreviation: 'CLT/CLST' },
            { code: 'America/Buenos_Aires', name: 'Buenos Aires, Argentina', region: 'Americas', utc_offset: '-03:00', abbreviation: 'ART' },
            { code: 'America/Sao_Paulo', name: 'Sao Paulo, Brazil', region: 'Americas', utc_offset: '-03:00', abbreviation: 'BRT/BRST' },
            // Asia
            { code: 'Asia/Tokyo', name: 'Tokyo, Japan', region: 'Asia', utc_offset: '+09:00', abbreviation: 'JST' },
            { code: 'Asia/Seoul', name: 'Seoul, South Korea', region: 'Asia', utc_offset: '+09:00', abbreviation: 'KST' },
            { code: 'Asia/Shanghai', name: 'Shanghai, China', region: 'Asia', utc_offset: '+08:00', abbreviation: 'CST' },
            { code: 'Asia/Hong_Kong', name: 'Hong Kong', region: 'Asia', utc_offset: '+08:00', abbreviation: 'HKT' },
            { code: 'Asia/Singapore', name: 'Singapore', region: 'Asia', utc_offset: '+08:00', abbreviation: 'SGT' },
            { code: 'Asia/Kuala_Lumpur', name: 'Kuala Lumpur, Malaysia', region: 'Asia', utc_offset: '+08:00', abbreviation: 'MYT' },
            { code: 'Asia/Bangkok', name: 'Bangkok, Thailand', region: 'Asia', utc_offset: '+07:00', abbreviation: 'ICT' },
            { code: 'Asia/Jakarta', name: 'Jakarta, Indonesia', region: 'Asia', utc_offset: '+07:00', abbreviation: 'WIB' },
            { code: 'Asia/Manila', name: 'Manila, Philippines', region: 'Asia', utc_offset: '+08:00', abbreviation: 'PHT' },
            { code: 'Asia/Kolkata', name: 'Kolkata, India', region: 'Asia', utc_offset: '+05:30', abbreviation: 'IST' },
            { code: 'Asia/Mumbai', name: 'Mumbai, India', region: 'Asia', utc_offset: '+05:30', abbreviation: 'IST' },
            { code: 'Asia/Dubai', name: 'Dubai, UAE', region: 'Asia', utc_offset: '+04:00', abbreviation: 'GST' },
            { code: 'Asia/Riyadh', name: 'Riyadh, Saudi Arabia', region: 'Asia', utc_offset: '+03:00', abbreviation: 'AST' },
            { code: 'Asia/Jerusalem', name: 'Jerusalem, Israel', region: 'Asia', utc_offset: '+02:00', abbreviation: 'IST/IDT' },
            { code: 'Asia/Tehran', name: 'Tehran, Iran', region: 'Asia', utc_offset: '+03:30', abbreviation: 'IRST/IRDT' },
            // Africa
            { code: 'Africa/Cairo', name: 'Cairo, Egypt', region: 'Africa', utc_offset: '+02:00', abbreviation: 'EET' },
            { code: 'Africa/Johannesburg', name: 'Johannesburg, South Africa', region: 'Africa', utc_offset: '+02:00', abbreviation: 'SAST' },
            { code: 'Africa/Lagos', name: 'Lagos, Nigeria', region: 'Africa', utc_offset: '+01:00', abbreviation: 'WAT' },
            { code: 'Africa/Nairobi', name: 'Nairobi, Kenya', region: 'Africa', utc_offset: '+03:00', abbreviation: 'EAT' },
            { code: 'Africa/Casablanca', name: 'Casablanca, Morocco', region: 'Africa', utc_offset: '+01:00', abbreviation: 'WEST' },
            // Oceania
            { code: 'Australia/Sydney', name: 'Sydney, Australia', region: 'Oceania', utc_offset: '+10:00', abbreviation: 'AEST/AEDT' },
            { code: 'Australia/Melbourne', name: 'Melbourne, Australia', region: 'Oceania', utc_offset: '+10:00', abbreviation: 'AEST/AEDT' },
            { code: 'Australia/Brisbane', name: 'Brisbane, Australia', region: 'Oceania', utc_offset: '+10:00', abbreviation: 'AEST' },
            { code: 'Australia/Perth', name: 'Perth, Australia', region: 'Oceania', utc_offset: '+08:00', abbreviation: 'AWST' },
            { code: 'Pacific/Auckland', name: 'Auckland, New Zealand', region: 'Oceania', utc_offset: '+12:00', abbreviation: 'NZST/NZDT' },
            // Atlantic
            { code: 'Atlantic/Azores', name: 'Azores, Portugal', region: 'Atlantic', utc_offset: '-01:00', abbreviation: 'AZOT/AZOST' },
            { code: 'Atlantic/Reykjavik', name: 'Reykjavik, Iceland', region: 'Atlantic', utc_offset: '+00:00', abbreviation: 'GMT' }
        ];
    }

    /**
     * Add member to team
     */
    async addTeamMember(teamId, contactId, role = null, isLead = false) {
        const { data, error } = await this.supabase
            .from('team_members')
            .insert({
                team_id: teamId,
                contact_id: contactId,
                role: role,
                is_lead: isLead
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Remove member from team
     */
    async removeTeamMember(teamId, contactId) {
        await this.supabase
            .from('team_members')
            .delete()
            .eq('team_id', teamId)
            .eq('contact_id', contactId);
    }

    // ==================== Conversations ====================

    /**
     * Add a conversation
     */
    async addConversation(conversation) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        const { data, error } = await this.supabase
            .from('conversations')
            .insert({
                project_id: projectId,
                title: conversation.title,
                conversation_type: conversation.type || 'chat',
                source: conversation.source,
                participants: conversation.participants || [],
                conversation_date: conversation.date,
                messages: conversation.messages || [],
                metadata: conversation.metadata || {},
                created_by: user?.id
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get conversations
     */
    async getConversations(filter = null) {
        const projectId = this.getProjectId();

        let query = this.supabase
            .from('conversations')
            .select('*')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (filter) {
            if (filter.type) {
                query = query.eq('conversation_type', filter.type);
            }
            if (filter.source) {
                query = query.eq('source', filter.source);
            }
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    /**
     * Get conversation by ID
     */
    async getConversationById(id) {
        const { data, error } = await this.supabase
            .from('conversations')
            .select('*')
            .eq('id', id)
            .single();

        return error ? null : data;
    }

    /**
     * Update a conversation
     */
    async updateConversation(id, updates) {
        // Build update object only with provided fields
        const updateData = {};
        if (updates.title !== undefined) updateData.title = updates.title;
        if (updates.type !== undefined) updateData.conversation_type = updates.type;
        if (updates.messages !== undefined) updateData.messages = updates.messages;

        // Handle metadata - merge with existing if needed
        if (updates.metadata !== undefined ||
            updates.extractedEntities !== undefined ||
            updates.extractedRelationships !== undefined ||
            updates.extraction_result !== undefined ||
            updates.aiProcessedAt !== undefined) {

            // Get existing conversation to merge metadata
            const existing = await this.getConversationById(id);
            const existingMeta = existing?.metadata || {};

            updateData.metadata = {
                ...existingMeta,
                ...(updates.metadata || {}),
                ...(updates.extractedEntities !== undefined && { extractedEntities: updates.extractedEntities }),
                ...(updates.extractedRelationships !== undefined && { extractedRelationships: updates.extractedRelationships }),
                ...(updates.extraction_result !== undefined && { extraction_result: updates.extraction_result }),
                ...(updates.aiProcessedAt !== undefined && { aiProcessedAt: updates.aiProcessedAt })
            };
        }

        const { data, error } = await this.supabase
            .from('conversations')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Delete a conversation
     */
    async deleteConversation(id, soft = true) {
        if (soft) {
            await this.supabase
                .from('conversations')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);
        } else {
            await this.supabase.from('conversations').delete().eq('id', id);
        }
    }

    // ==================== Chat Sessions (Main Chat) ====================

    /**
     * Create a new chat session
     * @param {object} options - { projectId, userId, title }
     * @returns {Promise<object>}
     */
    async createChatSession(options = {}) {
        const projectId = options.projectId || this.getProjectId();
        const { data, error } = await this.supabase
            .from('chat_sessions')
            .insert({
                project_id: projectId,
                user_id: options.userId || null,
                title: options.title || 'Nova conversa',
                context_contact_id: options.contextContactId || null
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get a single chat session by ID
     * @param {string} sessionId - Session ID
     * @returns {Promise<object|null>}
     */
    async getChatSession(sessionId) {
        const { data, error } = await this.supabase
            .from('chat_sessions')
            .select('id, project_id, title, context_contact_id, created_at, updated_at')
            .eq('id', sessionId)
            .single();

        if (error) return null;
        return data;
    }

    /**
     * Get chat sessions for a project
     * @param {string} projectId - Project ID
     * @returns {Promise<Array>}
     */
    async getChatSessions(projectId = null) {
        const pid = projectId || this.getProjectId();
        const { data, error } = await this.supabase
            .from('chat_sessions')
            .select('id, project_id, title, context_contact_id, created_at, updated_at')
            .eq('project_id', pid)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Get messages for a chat session
     * @param {string} sessionId - Session ID
     * @returns {Promise<Array>}
     */
    async getChatMessages(sessionId) {
        const { data, error } = await this.supabase
            .from('chat_messages')
            .select('id, role, content, sources, metadata, created_at')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
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
        const { data, error } = await this.supabase
            .from('chat_messages')
            .insert({
                session_id: sessionId,
                role,
                content,
                sources: extras.sources || [],
                metadata: extras.metadata || {}
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Update chat session title
     * @param {string} sessionId - Session ID
     * @param {string} title - New title
     * @returns {Promise<object>}
     */
    async updateChatSessionTitle(sessionId, title) {
        const { data, error } = await this.supabase
            .from('chat_sessions')
            .update({ title })
            .eq('id', sessionId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Update chat session (title, contextContactId, etc.)
     * @param {string} sessionId - Session ID
     * @param {object} updates - { title?, contextContactId? }
     * @returns {Promise<object>}
     */
    async updateChatSession(sessionId, updates = {}) {
        const updateData = {};
        if (updates.title !== undefined) updateData.title = updates.title;
        if (updates.contextContactId !== undefined) updateData.context_contact_id = updates.contextContactId || null;
        if (Object.keys(updateData).length === 0) return this.getChatSession(sessionId);
        const { data, error } = await this.supabase
            .from('chat_sessions')
            .update(updateData)
            .eq('id', sessionId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Add message to conversation
     */
    async addMessageToConversation(conversationId, message) {
        const { data: conv } = await this.supabase
            .from('conversations')
            .select('messages')
            .eq('id', conversationId)
            .single();

        const messages = conv?.messages || [];
        messages.push({
            ...message,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString()
        });

        const { data, error } = await this.supabase
            .from('conversations')
            .update({ messages })
            .eq('id', conversationId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // ==================== Embeddings ====================

    /**
     * Add or update embedding
     */
    async upsertEmbedding(entityType, entityId, content, embedding, model = 'snowflake-arctic-embed') {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('embeddings')
            .upsert({
                project_id: projectId,
                entity_type: entityType,
                entity_id: entityId,
                content: content,
                embedding: embedding,
                model: model
            }, {
                onConflict: 'entity_type,entity_id'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Search by similarity
     */
    async searchBySimilarity(queryEmbedding, entityTypes = null, limit = 10, threshold = 0.7) {
        const projectId = this.getProjectId();

        let query = this.supabase.rpc('match_embeddings', {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: limit,
            filter_project_id: projectId
        });

        const { data, error } = await query;
        if (error) throw error;

        if (entityTypes) {
            return data.filter(item => entityTypes.includes(item.entity_type));
        }

        return data;
    }

    /**
     * Get embeddings for entity
     */
    async getEmbedding(entityType, entityId) {
        const { data, error } = await this.supabase
            .from('embeddings')
            .select('*')
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .single();

        return error ? null : data;
    }

    /**
     * Delete embedding
     */
    async deleteEmbedding(entityType, entityId) {
        await this.supabase
            .from('embeddings')
            .delete()
            .eq('entity_type', entityType)
            .eq('entity_id', entityId);
    }

    // ==================== Config ====================

    /**
     * Get project config
     */
    async getConfig() {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('project_config')
            .select('*')
            .eq('project_id', projectId)
            .single();

        if (error) {
            // Return defaults
            return {
                user_role: '',
                user_role_prompt: '',
                llm_config: {},
                ollama_config: {
                    host: '127.0.0.1',
                    port: '11434',
                    model: 'qwen3:30b',
                    visionModel: 'qwen3-vl:8b',
                    reasoningModel: 'qwen3:30b'
                },
                prompts: { document: '', vision: '', transcript: '' },
                processing_settings: { pdfToImages: true, chunkSize: 4000, chunkOverlap: 200, similarityThreshold: 0.90 },
                ui_preferences: { theme: 'system', locale: 'pt' }
            };
        }

        return data;
    }

    /**
     * Update project config
     */
    async updateConfig(updates) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        const { data, error } = await this.supabase
            .from('project_config')
            .upsert({
                project_id: projectId,
                ...updates,
                updated_by: user?.id,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'project_id'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get Ollama config
     */
    async getOllamaConfig() {
        const config = await this.getConfig();
        return config.ollama_config || {
            host: '127.0.0.1',
            port: '11434',
            model: 'qwen3:30b',
            visionModel: 'qwen3-vl:8b',
            reasoningModel: 'qwen3:30b'
        };
    }

    /**
     * Update Ollama config
     */
    async updateOllamaConfig(ollamaConfig) {
        return this.updateConfig({ ollama_config: ollamaConfig });
    }

    // ==================== Query History ====================

    /**
     * Add query to history
     */
    async addQueryHistory(query, type = 'search', executionTimeMs = null, resultCount = null) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        const { data, error } = await this.supabase
            .from('query_history')
            .insert({
                project_id: projectId,
                query_text: query,
                query_type: type,
                execution_time_ms: executionTimeMs,
                result_count: resultCount,
                user_id: user?.id
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get query history
     */
    async getQueryHistory(limit = 50) {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('query_history')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    }

    /**
     * Get query suggestions
     */
    async getQuerySuggestions(prefix, limit = 5) {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('query_history')
            .select('query_text')
            .eq('project_id', projectId)
            .ilike('query_text', `${prefix}%`)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return [...new Set(data.map(d => d.query_text))];
    }

    // ==================== Saved Searches ====================

    /**
     * Save a search
     */
    async saveSearch(name, query, filters = {}) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        const { data, error } = await this.supabase
            .from('saved_searches')
            .upsert({
                project_id: projectId,
                user_id: user?.id,
                name: name,
                query: query,
                type_filter: filters.type,
                date_filter: filters.date,
                owner_filter: filters.owner
            }, {
                onConflict: 'project_id,user_id,name'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get saved searches
     */
    async getSavedSearches() {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        const { data, error } = await this.supabase
            .from('saved_searches')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', user?.id)
            .order('use_count', { ascending: false });

        if (error) throw error;
        return data;
    }

    /**
     * Delete saved search
     */
    async deleteSavedSearch(name) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        await this.supabase
            .from('saved_searches')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', user?.id)
            .eq('name', name);
    }

    // ==================== LLM Costs ====================

    /**
     * Track LLM cost
     */
    async trackLLMCost(provider, model, operation, inputTokens, outputTokens, cost, latencyMs = null, success = true, context = null) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        // Use RPC if available, otherwise direct insert
        try {
            const { data, error } = await this.supabase.rpc('track_llm_cost', {
                p_project_id: projectId,
                p_provider: provider,
                p_model: model,
                p_operation: operation,
                p_input_tokens: inputTokens,
                p_output_tokens: outputTokens,
                p_cost: cost,
                p_latency_ms: latencyMs,
                p_success: success,
                p_user_id: user?.id
            });

            if (error) throw error;

            // Update context separately if provided (RPC doesn't support it yet)
            if (context && data) {
                await this.supabase
                    .from('llm_cost_requests')
                    .update({ request_type: context })
                    .eq('id', data);
            }

            return data;
        } catch (e) {
            // Fallback: direct insert without RPC
            const { data, error } = await this.supabase
                .from('llm_cost_requests')
                .insert({
                    project_id: projectId,
                    provider,
                    model,
                    operation,
                    input_tokens: inputTokens,
                    output_tokens: outputTokens,
                    cost,
                    latency_ms: latencyMs,
                    success,
                    request_type: context,
                    created_by: user?.id
                })
                .select('id')
                .single();

            if (error) throw error;
            return data?.id;
        }
    }

    /**
     * Track LLM cost with billing information (EUR costs, markup, tier)
     * Used by billing system for detailed cost tracking
     * @param {object} options - Tracking options
     * @returns {Promise<string|null>} Request ID
     */
    async trackLLMCostWithBilling({
        projectId,
        provider,
        model,
        operation,
        inputTokens,
        outputTokens,
        providerCostEur,
        billableCostEur,
        markupPercent,
        tierId,
        periodKey,
        latencyMs = null,
        success = true,
        context = null,
        userId = null
    }) {
        // Use provided projectId or current project
        const pid = projectId || this.currentProjectId;
        if (!pid) {
            log.warn({ event: 'llm_cost_no_project' }, 'No projectId for trackLLMCostWithBilling');
            return null;
        }

        try {
            const { data, error } = await this.supabase
                .from('llm_cost_requests')
                .insert({
                    project_id: pid,
                    provider,
                    model,
                    operation,
                    input_tokens: inputTokens,
                    output_tokens: outputTokens,
                    cost: billableCostEur, // Main cost field uses billable
                    provider_cost_eur: providerCostEur,
                    billable_cost_eur: billableCostEur,
                    markup_percent_applied: markupPercent,
                    tier_applied_id: tierId,
                    period_key: periodKey,
                    latency_ms: latencyMs,
                    success,
                    request_type: context,
                    created_by: userId
                })
                .select('id')
                .single();

            if (error) throw error;
            return data?.id;
        } catch (e) {
            logError(e, { module: 'supabase', event: 'llm_cost_track_error' });
            return null;
        }
    }

    /**
     * Get LLM cost summary
     */
    async getLLMCostSummary() {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase.rpc('get_llm_cost_summary', {
            p_project_id: projectId
        });

        if (error) throw error;
        return data?.[0] || null;
    }

    /**
     * Get daily LLM costs
     */
    async getLLMCostsDaily(days = 30) {
        if (!this.currentProjectId) return [];
        const projectId = this.currentProjectId;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await this.supabase
            .from('llm_cost_daily')
            .select('*')
            .eq('project_id', projectId)
            .gte('date', startDate.toISOString().split('T')[0])
            .order('date', { ascending: true });

        if (error) throw error;
        return data;
    }

    /**
     * Get costs by model
     */
    async getLLMCostsByModel() {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('llm_cost_by_model')
            .select('*')
            .eq('project_id', projectId)
            .order('cost', { ascending: false });

        if (error) throw error;
        return data;
    }

    /**
     * Get recent LLM requests
     */
    async getRecentLLMRequests(limit = 20) {
        if (!this.currentProjectId) return [];
        const projectId = this.currentProjectId;

        const { data, error } = await this.supabase
            .from('llm_cost_requests')
            .select('*')
            .eq('project_id', projectId)
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    /**
     * Get LLM budget for a period (week or month)
     */
    async getLLMBudget(period = 'month') {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('llm_cost_budgets')
            .select('*')
            .eq('project_id', projectId)
            .eq('period', period)
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    /**
     * Set LLM budget for a period
     */
    async setLLMBudget(period, limitUsd, alertThresholdPercent = 80) {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('llm_cost_budgets')
            .upsert(
                {
                    project_id: projectId,
                    period,
                    limit_usd: limitUsd,
                    alert_threshold_percent: alertThresholdPercent ?? 80,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'project_id,period' }
            )
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    /**
     * Get LLM cost budget for a period (week or month)
     */
    async getLLMBudget(period) {
        const projectId = this.getProjectId();
        const { data, error } = await this.supabase
            .from('llm_cost_budgets')
            .select('*')
            .eq('project_id', projectId)
            .eq('period', period)
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return {
            period: data.period,
            limitUsd: parseFloat(data.limit_usd) || 0,
            alertThresholdPercent: data.alert_threshold_percent ?? 80,
            notifiedAt: data.notified_at
        };
    }

    /**
     * Set LLM cost budget for a period
     */
    async setLLMBudget(period, limitUsd, alertThresholdPercent) {
        const projectId = this.getProjectId();
        const { error } = await this.supabase
            .from('llm_cost_budgets')
            .upsert(
                {
                    project_id: projectId,
                    period,
                    limit_usd: limitUsd,
                    alert_threshold_percent: Math.min(100, Math.max(0, alertThresholdPercent)),
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'project_id,period' }
            );
        if (error) throw error;
        return this.getLLMBudget(period);
    }

    /**
     * Get LLM cost breakdown for a date range (for summary by period)
     */
    async getLLMCostBreakdownForPeriod(startDate, endDate) {
        if (!this.currentProjectId) {
            return {
                total_cost: 0,
                total_requests: 0,
                total_input_tokens: 0,
                total_output_tokens: 0,
                by_provider: {},
                by_model: {},
                by_operation: {},
                by_context: {}
            };
        }
        const projectId = this.currentProjectId;
        const start = startDate instanceof Date ? startDate.toISOString() : startDate;
        const end = endDate instanceof Date ? endDate.toISOString() : endDate;

        const { data, error } = await this.supabase.rpc('get_llm_cost_breakdown_for_period', {
            p_project_id: projectId,
            p_start: start,
            p_end: end
        });

        if (error) throw error;
        const row = data?.[0] || null;
        if (!row) {
            return {
                total_cost: 0,
                total_requests: 0,
                total_input_tokens: 0,
                total_output_tokens: 0,
                by_provider: {},
                by_model: {},
                by_operation: {},
                by_context: {}
            };
        }
        return {
            total_cost: parseFloat(row.total_cost) || 0,
            total_requests: Number(row.total_requests) || 0,
            total_input_tokens: Number(row.total_input_tokens) || 0,
            total_output_tokens: Number(row.total_output_tokens) || 0,
            by_provider: row.by_provider || {},
            by_model: row.by_model || {},
            by_operation: row.by_operation || {},
            by_context: row.by_context || {}
        };
    }

    // ==================== Stats History ====================

    /**
     * Record daily stats
     */
    async recordDailyStats() {
        const projectId = this.getProjectId();

        const { error } = await this.supabase.rpc('record_daily_stats', {
            p_project_id: projectId
        });

        if (error) throw error;
    }

    /**
     * Get stats history
     */
    async getStatsHistory(days = 30) {
        const projectId = this.getProjectId();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await this.supabase
            .from('stats_history')
            .select('*')
            .eq('project_id', projectId)
            .gte('snapshot_date', startDate.toISOString().split('T')[0])
            .order('snapshot_date', { ascending: true });

        if (error) throw error;
        return data;
    }

    // ==================== Processing History ====================

    /**
     * Add processing history entry
     */
    async addProcessingHistory(documentId, action, status, details = {}, modelUsed = null, tokensUsed = null, durationMs = null) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        const { data, error } = await this.supabase
            .from('processing_history')
            .insert({
                project_id: projectId,
                document_id: documentId,
                action: action,
                status: status,
                details: details,
                duration_ms: durationMs,
                model_used: modelUsed,
                tokens_used: tokensUsed,
                created_by: user?.id
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get processing history with document info
     */
    async getProcessingHistory(documentId = null, limit = 50) {
        const projectId = this.getProjectId();

        // First try with join, fallback to simple query
        try {
            let query = this.supabase
                .from('processing_history')
                .select(`
                    *,
                    documents:document_id (
                        id,
                        filename,
                        title,
                        summary
                    )
                `)
                .eq('project_id', projectId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (documentId) {
                query = query.eq('document_id', documentId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        } catch (joinError) {
            log.warn({ event: 'processing_history_join_failed', reason: joinError.message }, 'Using simple query');

            let query = this.supabase
                .from('processing_history')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (documentId) {
                query = query.eq('document_id', documentId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        }
    }

    // ==================== SOT Versions ====================

    /**
     * Save SOT version
     */
    async saveSOTVersion(content, summary = null, changes = null) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        // Get next version number
        const { data: lastVersion } = await this.supabase
            .from('sot_versions')
            .select('version_number')
            .eq('project_id', projectId)
            .order('version_number', { ascending: false })
            .limit(1)
            .single();

        const versionNumber = (lastVersion?.version_number || 0) + 1;

        // Get current counts
        const stats = await this.getProjectStats();

        const { data, error } = await this.supabase
            .from('sot_versions')
            .insert({
                project_id: projectId,
                version_number: versionNumber,
                content: content,
                executive_summary: summary,
                changes_summary: changes || {},
                facts_count: stats.facts,
                decisions_count: stats.decisions,
                risks_count: stats.risks,
                created_by: user?.id
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get SOT versions
     */
    async getSOTVersions(limit = 10) {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('sot_versions')
            .select('*')
            .eq('project_id', projectId)
            .order('version_number', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    }

    /**
     * Get latest SOT version
     */
    async getLatestSOTVersion() {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('sot_versions')
            .select('*')
            .eq('project_id', projectId)
            .order('version_number', { ascending: false })
            .limit(1)
            .single();

        return error ? null : data;
    }

    // ==================== Calendar Events ====================

    /**
     * Add calendar event
     */
    async addCalendarEvent(event) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        const { data, error } = await this.supabase
            .from('calendar_events')
            .insert({
                project_id: projectId,
                title: event.title,
                description: event.description,
                event_type: event.type || 'other',
                start_at: event.start_at,
                end_at: event.end_at,
                all_day: event.all_day || false,
                timezone: event.timezone || 'UTC',
                location: event.location,
                meeting_url: event.meeting_url,
                linked_document_id: event.linked_document_id,
                linked_action_id: event.linked_action_id,
                linked_contact_ids: event.linked_contact_ids || [],
                status: event.status || 'scheduled',
                created_by: user?.id
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get calendar events
     */
    async getCalendarEvents(startDate = null, endDate = null, type = null) {
        const projectId = this.getProjectId();

        let query = this.supabase
            .from('calendar_events')
            .select('*')
            .eq('project_id', projectId)
            .order('start_at', { ascending: true });

        if (startDate) {
            query = query.gte('start_at', startDate);
        }
        if (endDate) {
            query = query.lte('start_at', endDate);
        }
        if (type) {
            query = query.eq('event_type', type);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    /**
     * Update calendar event
     */
    async updateCalendarEvent(id, updates) {
        const { data, error } = await this.supabase
            .from('calendar_events')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Delete calendar event
     */
    async deleteCalendarEvent(id) {
        await this.supabase
            .from('calendar_events')
            .delete()
            .eq('id', id);
    }

    // ==================== Cache ====================

    /**
     * Get from cache
     */
    async getCache(key) {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('cache_entries')
            .select('cache_value, expires_at')
            .eq('project_id', projectId)
            .eq('cache_key', key)
            .single();

        if (error || !data) return null;

        // Check expiration
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
            await this.deleteCache(key);
            return null;
        }

        // Update hit count
        await this.supabase.rpc('increment_cache_hit', { p_key: key, p_project_id: projectId });

        return data.cache_value;
    }

    /**
     * Set cache
     */
    async setCache(key, value, ttlSeconds = null) {
        const projectId = this.getProjectId();

        const expiresAt = ttlSeconds
            ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
            : null;

        const { data, error } = await this.supabase
            .from('cache_entries')
            .upsert({
                project_id: projectId,
                cache_key: key,
                cache_value: value,
                expires_at: expiresAt
            }, {
                onConflict: 'project_id,cache_key'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Delete cache entry
     */
    async deleteCache(key) {
        const projectId = this.getProjectId();

        await this.supabase
            .from('cache_entries')
            .delete()
            .eq('project_id', projectId)
            .eq('cache_key', key);
    }

    /**
     * Clear all cache for project
     */
    async clearCache() {
        const projectId = this.getProjectId();

        await this.supabase
            .from('cache_entries')
            .delete()
            .eq('project_id', projectId);
    }

    // ==================== User Feedback ====================

    /**
     * Add user feedback
     */
    async addFeedback(entityType, entityId, feedbackType, feedbackText = null, correction = null) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        const { data, error } = await this.supabase
            .from('user_feedback')
            .insert({
                project_id: projectId,
                entity_type: entityType,
                entity_id: entityId,
                feedback_type: feedbackType,
                feedback_text: feedbackText,
                original_value: correction?.original,
                corrected_value: correction?.corrected,
                user_id: user?.id
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get feedback
     */
    async getFeedback(status = null) {
        const projectId = this.getProjectId();

        let query = this.supabase
            .from('user_feedback')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    // ==================== Utility Methods ====================

    /**
     * Calculate file hash
     */
    async calculateFileHash(filePath) {
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

    /**
     * Get file type from filename
     */
    _getFileType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const typeMap = {
            '.pdf': 'pdf',
            '.doc': 'word',
            '.docx': 'word',
            '.txt': 'text',
            '.md': 'markdown',
            '.jpg': 'image',
            '.jpeg': 'image',
            '.png': 'image',
            '.gif': 'image',
            '.mp3': 'audio',
            '.wav': 'audio',
            '.mp4': 'video'
        };
        return typeMap[ext] || 'unknown';
    }

    /**
     * Normalize category
     */
    _normalizeCategory(category) {
        if (!category) return 'general';

        const normalized = category.toLowerCase().trim();
        const validCategories = ['technical', 'process', 'policy', 'people', 'timeline', 'general'];

        if (validCategories.includes(normalized)) {
            return normalized;
        }

        // Map common variations
        const categoryMap = {
            'tech': 'technical',
            'technology': 'technical',
            'proc': 'process',
            'workflow': 'process',
            'pol': 'policy',
            'rule': 'policy',
            'person': 'people',
            'team': 'people',
            'org': 'people',
            'time': 'timeline',
            'date': 'timeline',
            'schedule': 'timeline'
        };

        return categoryMap[normalized] || 'general';
    }

    /**
     * Find duplicate content
     */
    _findDuplicate(newContent, existingItems, contentField = 'content') {
        if (!newContent || !existingItems || existingItems.length === 0) {
            return { isDuplicate: false };
        }

        const normalizedNew = this._normalizeText(newContent);
        let bestMatch = null;
        let bestSimilarity = 0;

        for (const item of existingItems) {
            const normalizedExisting = this._normalizeText(item[contentField]);
            const similarity = this._textSimilarity(normalizedNew, normalizedExisting);

            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = item;
            }
        }

        if (bestSimilarity >= this.similarityThreshold) {
            return { isDuplicate: true, match: bestMatch, similarity: bestSimilarity };
        }

        return { isDuplicate: false };
    }

    /**
     * Normalize text for comparison
     */
    _normalizeText(text) {
        if (!text) return '';
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Calculate text similarity (Jaccard)
     */
    _textSimilarity(text1, text2) {
        const words1 = new Set(text1.split(' ').filter(w => w.length > 2));
        const words2 = new Set(text2.split(' ').filter(w => w.length > 2));

        if (words1.size === 0 || words2.size === 0) return 0;

        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    }

    /**
     * Add to graph outbox for sync
     */
    async _addToOutbox(eventType, operation, entityType, entityId, payload) {
        const projectId = this.getProjectId();

        try {
            await this.supabase.rpc('add_to_outbox', {
                p_project_id: projectId,
                p_graph_name: `project_${projectId}`,
                p_event_type: eventType,
                p_operation: operation,
                p_entity_type: entityType,
                p_entity_id: entityId,
                p_payload: payload
            });
        } catch (e) {
            log.warn({ event: 'outbox_add_failed', entityType, entityId, reason: e.message }, 'Failed to add to outbox');
        }
    }

    /**
     * Add to change log
     */
    async _addChangeLog(action, entityType, entityId, previousData = null, sourceFile = null) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();

        try {
            await this.supabase.from('knowledge_change_log').insert({
                project_id: projectId,
                action: action,
                entity_type: entityType,
                entity_id: entityId,
                previous_data: previousData,
                source_file: sourceFile,
                created_by: user?.id
            });
        } catch (e) {
            log.warn({ event: 'changelog_add_failed', entityType, entityId, reason: e.message }, 'Failed to add change log');
        }
    }

    /**
     * Add multiple change log entries in one insert (for bulk fact/entity creation).
     * @param {Array<{ action: string, entityType: string, entityId: string, previousData?: object, sourceFile?: string }>} entries
     */
    async _addChangeLogBulk(entries) {
        if (!Array.isArray(entries) || entries.length === 0) return;
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();
        const rows = entries.map(e => ({
            project_id: projectId,
            action: e.action,
            entity_type: e.entityType,
            entity_id: e.entityId,
            previous_data: e.previousData ?? null,
            source_file: e.sourceFile ?? null,
            created_by: user?.id
        }));
        try {
            await this.supabase.from('knowledge_change_log').insert(rows);
        } catch (e) {
            log.warn({ event: 'changelog_bulk_add_failed', reason: e.message, count: entries.length }, 'Failed to add change log bulk');
        }
    }

    /**
     * Get full document data for backup
     */
    async _getDocumentFullData(documentId) {
        const projectId = this.getProjectId();
        const [doc, facts, decisions, risks, actions, questions] = await Promise.all([
            this.getDocumentById(documentId),
            this.supabase.from('facts').select('*').eq('source_document_id', documentId).eq('project_id', projectId),
            this.supabase.from('decisions').select('*').eq('source_document_id', documentId).eq('project_id', projectId),
            this.supabase.from('risks').select('*').eq('source_document_id', documentId).eq('project_id', projectId),
            this.supabase.from('action_items').select('*').eq('source_document_id', documentId).eq('project_id', projectId),
            this.supabase.from('knowledge_questions').select('*').eq('source_document_id', documentId).eq('project_id', projectId)
        ]);

        return {
            document: doc,
            facts: facts.data || [],
            decisions: decisions.data || [],
            risks: risks.data || [],
            actions: actions.data || [],
            questions: questions.data || []
        };
    }

    // ==================== Bulk Operations ====================

    /**
     * Get all knowledge for project
     */
    async getAllKnowledge() {
        const [facts, decisions, risks, actions, questions, people, relationships] = await Promise.all([
            this.getFacts(),
            this.getDecisions(),
            this.getRisks(),
            this.getActions(),
            this.getQuestions(),
            this.getPeople(),
            this.getRelationships()
        ]);

        return {
            facts,
            decisions,
            risks,
            actions,
            questions,
            people,
            relationships
        };
    }

    /**
     * Search across all knowledge
     */
    async searchKnowledge(query, types = null) {
        const projectId = this.getProjectId();
        const searchPattern = `%${query}%`;

        const searches = [];
        const typeList = types || ['facts', 'decisions', 'risks', 'action_items', 'knowledge_questions'];

        if (typeList.includes('facts')) {
            searches.push(
                this.supabase.from('facts').select('*, _type:id').eq('project_id', projectId)
                    .is('deleted_at', null).ilike('content', searchPattern)
                    .then(r => r.data?.map(d => ({ ...d, _type: 'fact' })) || [])
            );
        }

        if (typeList.includes('decisions')) {
            searches.push(
                this.supabase.from('decisions').select('*').eq('project_id', projectId)
                    .is('deleted_at', null).ilike('content', searchPattern)
                    .then(r => r.data?.map(d => ({ ...d, _type: 'decision' })) || [])
            );
        }

        if (typeList.includes('risks')) {
            searches.push(
                this.supabase.from('risks').select('*').eq('project_id', projectId)
                    .is('deleted_at', null).ilike('content', searchPattern)
                    .then(r => r.data?.map(d => ({ ...d, _type: 'risk' })) || [])
            );
        }

        if (typeList.includes('action_items')) {
            searches.push(
                this.supabase.from('action_items').select('*').eq('project_id', projectId)
                    .is('deleted_at', null).ilike('task', searchPattern)
                    .then(r => r.data?.map(d => ({ ...d, _type: 'action' })) || [])
            );
        }

        if (typeList.includes('knowledge_questions')) {
            searches.push(
                this.supabase.from('knowledge_questions').select('*').eq('project_id', projectId)
                    .is('deleted_at', null).ilike('content', searchPattern)
                    .then(r => r.data?.map(d => ({ ...d, _type: 'question' })) || [])
            );
        }

        const results = await Promise.all(searches);
        return results.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // ==================== Export ====================

    /**
     * Export all project data
     */
    async exportProjectData() {
        const [
            knowledge,
            documents,
            contacts,
            teams,
            conversations,
            config,
            stats
        ] = await Promise.all([
            this.getAllKnowledge(),
            this.getDocuments(),
            this.getContacts(),
            this.getTeams(),
            this.getConversations(),
            this.getConfig(),
            this.getProjectStats()
        ]);

        return {
            exportedAt: new Date().toISOString(),
            project: await this.getCurrentProject(),
            stats,
            config,
            knowledge,
            documents,
            contacts,
            teams,
            conversations
        };
    }

    /**
     * Cleanup bad data - stub for Supabase (data validation handled by DB constraints)
     * @returns {Object} Cleanup results
     */
    cleanupBadData() {
        // In Supabase mode, data validation is handled by database constraints and RLS
        // This is a no-op stub for compatibility with legacy code
        return { decisions: 0, people: 0 };
    }

    // ==================== BRIEFINGS ====================

    /**
     * Calculate hash of current project data state for change detection
     */
    async calculateDataHash() {
        const projectId = this.getProjectId();

        // Get counts of all entities
        const [
            { count: factsCount },
            { count: decisionsCount },
            { count: risksCount },
            { count: questionsCount },
            { count: actionsCount },
            { count: peopleCount },
            { count: docsCount }
        ] = await Promise.all([
            this.supabase.from('facts').select('*', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
            this.supabase.from('decisions').select('*', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
            this.supabase.from('risks').select('*', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
            this.supabase.from('knowledge_questions').select('*', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
            this.supabase.from('action_items').select('*', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
            this.supabase.from('people').select('*', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
            this.supabase.from('documents').select('*', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null)
        ]);

        // Get latest modification time
        const { data: latestFact } = await this.supabase
            .from('facts')
            .select('updated_at')
            .eq('project_id', projectId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        const stats = {
            facts: factsCount || 0,
            decisions: decisionsCount || 0,
            risks: risksCount || 0,
            questions: questionsCount || 0,
            actions: actionsCount || 0,
            people: peopleCount || 0,
            documents: docsCount || 0,
            lastUpdate: latestFact?.updated_at || null
        };

        // Create hash from stats
        const crypto = require('crypto');
        const hash = crypto.createHash('md5')
            .update(JSON.stringify(stats))
            .digest('hex');

        return { hash, stats };
    }

    /**
     * Get cached briefing if data hasn't changed
     */
    async getCachedBriefing() {
        const projectId = this.getProjectId();
        const { hash: currentHash, stats } = await this.calculateDataHash();

        // Look for briefing with matching hash
        const { data: cached, error } = await this.supabase
            .from('briefings')
            .select('*')
            .eq('project_id', projectId)
            .eq('data_hash', currentHash)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (cached && !error) {
            log.debug({ event: 'briefing_cache_hit' }, 'Using existing briefing');
            return {
                cached: true,
                briefing: cached.content,
                summary: cached.summary,
                createdAt: cached.created_at,
                stats: cached.stats_snapshot
            };
        }

        return { cached: false, currentHash, stats };
    }

    /**
     * Get the latest briefing regardless of hash
     */
    async getLatestBriefing() {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('briefings')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) return null;
        return data;
    }

    /**
     * Save a new briefing
     */
    async saveBriefing(briefingContent, options = {}) {
        const projectId = this.getProjectId();
        const user = await this.getCurrentUser();
        const { hash, stats } = await this.calculateDataHash();

        const { data, error } = await this.supabase
            .from('briefings')
            .insert({
                project_id: projectId,
                content: briefingContent,
                summary: options.summary || briefingContent.summary || null,
                data_hash: hash,
                stats_snapshot: stats,
                provider: options.provider || null,
                model: options.model || null,
                tokens_used: options.tokensUsed || null,
                generation_time_ms: options.generationTime || null,
                created_by: user?.id
            })
            .select()
            .single();

        if (error) {
            log.warn({ event: 'briefing_save_failed', reason: error.message }, 'Failed to save briefing');
            return null;
        }
        log.info({ event: 'briefing_saved', hashPrefix: hash.substring(0, 8) }, 'Saved new briefing');
        return data;
    }

    /**
     * Get briefing history
     */
    async getBriefingHistory(limit = 30) {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('briefings')
            .select('id, summary, stats_snapshot, provider, model, tokens_used, created_at')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) return [];
        return data;
    }

    // ==================== Ontology Suggestions ====================

    /**
     * Get ontology suggestions by status
     */
    async getOntologySuggestions(status = 'pending') {
        const projectId = this.getProjectId();

        let query = this.supabase
            .from('ontology_suggestions')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            log.warn({ event: 'ontology_suggestions_get_failed', reason: error.message }, 'Failed to get ontology suggestions');
            return [];
        }
        return data;
    }

    /**
     * Add a new ontology suggestion
     */
    async addOntologySuggestion(suggestion) {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('ontology_suggestions')
            .insert({
                project_id: projectId,
                suggestion_type: suggestion.type || suggestion.suggestion_type,
                name: suggestion.name,
                description: suggestion.description,
                from_types: suggestion.fromTypes || suggestion.from_types,
                to_types: suggestion.toTypes || suggestion.to_types,
                properties: suggestion.properties || [],
                source_file: suggestion.source || suggestion.source_file,
                example: suggestion.example
            })
            .select()
            .single();

        if (error) {
            log.warn({ event: 'ontology_suggestion_add_failed', reason: error.message }, 'Failed to add ontology suggestion');
            return null;
        }
        log.info({ event: 'ontology_suggestion_added', name: suggestion.name }, 'Added ontology suggestion');
        return data;
    }

    /**
     * Update ontology suggestion status (approve/reject)
     */
    async updateOntologySuggestion(id, updates) {
        const user = await this.getCurrentUser();

        const updateData = {
            ...updates,
            updated_at: new Date().toISOString()
        };

        if (updates.status === 'approved') {
            updateData.approved_at = new Date().toISOString();
            updateData.processed_by = user?.id;
        } else if (updates.status === 'rejected') {
            updateData.rejected_at = new Date().toISOString();
            updateData.processed_by = user?.id;
        }

        const { data, error } = await this.supabase
            .from('ontology_suggestions')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            log.warn({ event: 'ontology_suggestion_update_failed', reason: error.message }, 'Failed to update ontology suggestion');
            return null;
        }
        return data;
    }

    /**
     * Bulk add ontology suggestions
     */
    async addOntologySuggestions(suggestions) {
        const projectId = this.getProjectId();

        const records = suggestions.map(s => ({
            project_id: projectId,
            suggestion_type: s.type || s.suggestion_type,
            name: s.name,
            description: s.description,
            from_types: s.fromTypes || s.from_types,
            to_types: s.toTypes || s.to_types,
            properties: s.properties || [],
            source_file: s.source || s.source_file,
            example: s.example
        }));

        const { data, error } = await this.supabase
            .from('ontology_suggestions')
            .insert(records)
            .select();

        if (error) {
            log.warn({ event: 'ontology_suggestions_bulk_add_failed', reason: error.message }, 'Failed to bulk add suggestions');
            return [];
        }
        log.info({ event: 'ontology_suggestions_added', count: data.length }, 'Added ontology suggestions');
        return data;
    }

    // ==================== Ontology Schema Persistence ====================

    /**
     * Get ontology schema from Supabase
     * @param {string|null} projectId - null for global schemas, project ID for project-specific
     * @param {string|null} schemaType - 'entity', 'relation', 'query_pattern', 'inference_rule'
     * @returns {Promise<Array>} Schema records
     */
    async getOntologySchema(projectId = null, schemaType = null) {
        let query = this.supabase
            .from('ontology_schema')
            .select('*')
            .eq('is_active', true);

        if (projectId === null) {
            query = query.is('project_id', null); // Global schemas only
        } else {
            // Get both global and project-specific schemas
            query = query.or(`project_id.is.null,project_id.eq.${projectId}`);
        }

        if (schemaType) {
            query = query.eq('schema_type', schemaType);
        }

        const { data, error } = await query
            .order('schema_type')
            .order('schema_name');

        if (error) {
            log.warn({ event: 'ontology_schema_get_failed', reason: error.message }, 'Failed to get ontology schema');
            return [];
        }
        return data || [];
    }

    /**
     * Save a single ontology schema item
     * @param {string} schemaType - 'entity', 'relation', 'query_pattern', 'inference_rule'
     * @param {string} schemaName - Name of the schema item
     * @param {object} definition - Full definition object
     * @param {string|null} projectId - null for global
     * @param {number} version - Version number
     * @returns {Promise<object>} Saved record
     */
    async saveOntologySchemaItem(schemaType, schemaName, definition, projectId = null, version = 1) {
        const record = {
            project_id: projectId,
            schema_type: schemaType,
            schema_name: schemaName,
            schema_definition: definition,
            version: version,
            is_active: true,
            created_by: this.currentUserId
        };

        const { data, error } = await this.supabase
            .from('ontology_schema')
            .upsert(record, {
                onConflict: 'project_id,schema_type,schema_name',
                ignoreDuplicates: false
            })
            .select()
            .single();

        if (error) {
            log.warn({ event: 'ontology_schema_save_failed', schemaType, schemaName, reason: error.message }, 'Failed to save ontology schema item');
            throw error;
        }
        return data;
    }

    /**
     * Save full ontology schema to Supabase
     * Converts schema.json format to individual records
     * @param {object} schema - Full schema object with entityTypes, relationTypes, etc.
     * @param {string|null} projectId - null for global schema
     * @param {string|null} userId - User performing the save
     * @returns {Promise<{success: boolean, counts: object}>}
     */
    async saveOntologySchema(schema, projectId = null, userId = null) {
        const records = [];
        const version = parseInt(schema.version) || 1;

        // Entity types
        for (const [name, def] of Object.entries(schema.entityTypes || {})) {
            records.push({
                project_id: projectId,
                schema_type: 'entity',
                schema_name: name,
                schema_definition: def,
                version: version,
                is_active: true,
                created_by: userId || this.currentUserId
            });
        }

        // Relation types
        for (const [name, def] of Object.entries(schema.relationTypes || {})) {
            records.push({
                project_id: projectId,
                schema_type: 'relation',
                schema_name: name,
                schema_definition: def,
                version: version,
                is_active: true,
                created_by: userId || this.currentUserId
            });
        }

        // Query patterns
        for (const [name, pattern] of Object.entries(schema.queryPatterns || {})) {
            records.push({
                project_id: projectId,
                schema_type: 'query_pattern',
                schema_name: name,
                schema_definition: pattern,
                version: version,
                is_active: true,
                created_by: userId || this.currentUserId
            });
        }

        // Inference rules
        for (const rule of schema.inferenceRules || []) {
            records.push({
                project_id: projectId,
                schema_type: 'inference_rule',
                schema_name: rule.name || `rule_${Date.now()}`,
                schema_definition: rule,
                version: version,
                is_active: true,
                created_by: userId || this.currentUserId
            });
        }

        if (records.length === 0) {
            return { success: true, counts: { total: 0 } };
        }

        // Upsert all records in batches
        const batchSize = 50;
        let totalInserted = 0;

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            const { data, error } = await this.supabase
                .from('ontology_schema')
                .upsert(batch, {
                    onConflict: 'project_id,schema_type,schema_name',
                    ignoreDuplicates: false
                })
                .select();

            if (error) {
                log.warn({ event: 'ontology_schema_batch_save_failed', reason: error.message }, 'Failed to save ontology schema batch');
                throw error;
            }
            totalInserted += data?.length || 0;
        }
        const counts = {
            total: totalInserted,
            entities: Object.keys(schema.entityTypes || {}).length,
            relations: Object.keys(schema.relationTypes || {}).length,
            patterns: Object.keys(schema.queryPatterns || {}).length,
            rules: (schema.inferenceRules || []).length
        };
        log.info({ event: 'ontology_schema_saved', ...counts }, 'Saved ontology schema');
        return { success: true, counts };
    }

    /**
     * Build schema object from Supabase records
     * Reconstructs the schema.json format from individual records
     * @param {string|null} projectId - null for global, project ID for merged schema
     * @returns {Promise<object>} Schema object compatible with OntologyManager
     */
    async buildSchemaFromSupabase(projectId = null) {
        const records = await this.getOntologySchema(projectId);

        if (!records || records.length === 0) {
            return null; // No schema in Supabase
        }

        const schema = {
            version: '1.0',
            entityTypes: {},
            relationTypes: {},
            queryPatterns: {},
            inferenceRules: []
        };

        for (const record of records) {
            // Track highest version
            if (record.version > parseFloat(schema.version)) {
                schema.version = String(record.version);
            }

            switch (record.schema_type) {
                case 'entity':
                    schema.entityTypes[record.schema_name] = record.schema_definition;
                    break;
                case 'relation':
                    schema.relationTypes[record.schema_name] = record.schema_definition;
                    break;
                case 'query_pattern':
                    schema.queryPatterns[record.schema_name] = record.schema_definition;
                    break;
                case 'inference_rule':
                    schema.inferenceRules.push(record.schema_definition);
                    break;
            }
        }

        log.debug({ event: 'ontology_schema_built', version: schema.version, entities: Object.keys(schema.entityTypes || {}).length, relations: Object.keys(schema.relationTypes || {}).length }, 'Built schema from DB');
        return schema;
    }

    /**
     * Deactivate an ontology schema item (soft delete)
     * @param {string} schemaType - Type of schema item
     * @param {string} schemaName - Name of the item
     * @param {string|null} projectId - Project ID or null for global
     * @returns {Promise<boolean>}
     */
    async deactivateOntologySchemaItem(schemaType, schemaName, projectId = null) {
        let query = this.supabase
            .from('ontology_schema')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('schema_type', schemaType)
            .eq('schema_name', schemaName);

        if (projectId === null) {
            query = query.is('project_id', null);
        } else {
            query = query.eq('project_id', projectId);
        }

        const { error } = await query;

        if (error) {
            log.warn({ event: 'ontology_schema_deactivate_failed', schemaType, schemaName, reason: error.message }, 'Failed to deactivate');
            return false;
        }

        return true;
    }

    /**
     * Get ontology schema version from Supabase
     * @param {string|null} projectId - Project ID or null for global
     * @returns {Promise<string|null>} Version string or null
     */
    async getOntologySchemaVersion(projectId = null) {
        let query = this.supabase
            .from('ontology_schema')
            .select('version')
            .eq('is_active', true);

        if (projectId === null) {
            query = query.is('project_id', null);
        } else {
            query = query.eq('project_id', projectId);
        }

        const { data, error } = await query
            .order('version', { ascending: false })
            .limit(1);

        if (error || !data || data.length === 0) {
            return null;
        }

        return String(data[0].version);
    }

    /**
     * Log an ontology change for audit trail
     * @param {object} changeData - Change details
     * @returns {Promise<object>} Created change record
     */
    async logOntologyChange(changeData) {
        const record = {
            project_id: changeData.projectId || null,
            change_type: changeData.changeType,
            target_type: changeData.targetType,
            target_name: changeData.targetName,
            old_definition: changeData.oldDefinition || null,
            new_definition: changeData.newDefinition || null,
            diff: changeData.diff || null,
            reason: changeData.reason || null,
            source: changeData.source || 'manual',
            suggestion_id: changeData.suggestionId || null,
            changed_by: changeData.changedBy || this.currentUserId
        };

        const { data, error } = await this.supabase
            .from('ontology_changes')
            .insert(record)
            .select()
            .single();

        if (error) {
            // Table might not exist yet - log but don't fail
            log.warn({ event: 'ontology_change_log_failed', reason: error.message }, 'Could not log ontology change');
            return null;
        }

        return data;
    }

    /**
     * Get ontology change history
     * @param {object} options - Filter options
     * @returns {Promise<Array>} Change records
     */
    async getOntologyChanges(options = {}) {
        const { projectId, targetType, targetName, limit = 50 } = options;

        let query = this.supabase
            .from('ontology_changes')
            .select('*')
            .order('changed_at', { ascending: false })
            .limit(limit);

        if (projectId !== undefined) {
            if (projectId === null) {
                query = query.is('project_id', null);
            } else {
                query = query.eq('project_id', projectId);
            }
        }

        if (targetType) {
            query = query.eq('target_type', targetType);
        }

        if (targetName) {
            query = query.eq('target_name', targetName);
        }

        const { data, error } = await query;

        if (error) {
            log.warn({ event: 'ontology_changes_get_failed', reason: error.message }, 'Could not get ontology changes');
            return [];
        }

        return data || [];
    }

    // ==================== Email Methods ====================

    /**
     * Save a new email
     * @param {Object} emailData - Parsed email data
     * @returns {Promise<Object>} Saved email record
     */
    async saveEmail(emailData) {
        const projectId = this.getProjectId();

        const record = {
            project_id: projectId,
            subject: emailData.subject || null,
            from_email: emailData.from?.email || emailData.from_email || '',
            from_name: emailData.from?.name || emailData.from_name || null,
            to_emails: (emailData.to || []).map(t => t.email).filter(e => e),
            to_names: (emailData.to || []).map(t => t.name).filter(n => n),
            cc_emails: (emailData.cc || []).map(c => c.email).filter(e => e),
            cc_names: (emailData.cc || []).map(c => c.name).filter(n => n),
            date_sent: emailData.date || emailData.date_sent || null,
            message_id: emailData.messageId || emailData.message_id || null,
            in_reply_to: emailData.inReplyTo || emailData.in_reply_to || null,
            body_text: emailData.text || emailData.body_text || '',
            body_html: emailData.html || emailData.body_html || null,
            direction: emailData.direction || 'inbound',
            requires_response: emailData.requires_response || false,
            source_type: emailData.source_type || 'paste',
            original_filename: emailData.original_filename || null,
            attachment_count: emailData.attachments?.length || 0,
            sprint_id: emailData.sprint_id || null,
            action_id: emailData.action_id || null,
        };

        const { data, error } = await this.supabase
            .from('emails')
            .insert(record)
            .select()
            .single();

        if (error) {
            log.warn({ event: 'email_save_failed', reason: error.message }, 'Failed to save email');
            throw error;
        }

        log.info({ event: 'email_saved', subject: record.subject || '(no subject)' }, 'Saved email');
        return data;
    }

    /**
     * Update email with extracted entities and analysis
     * @param {string} id - Email ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>}
     */
    async updateEmail(id, updates) {
        const allowedFields = [
            'extracted_entities', 'ai_summary', 'detected_intent', 'sentiment',
            'requires_response', 'response_drafted', 'response_sent',
            'draft_response', 'draft_generated_at', 'sender_contact_id',
            'processed_at', 'thread_id', 'sprint_id', 'action_id'
        ];

        const updateData = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        }
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await this.supabase
            .from('emails')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            log.warn({ event: 'email_update_failed', reason: error.message }, 'Failed to update email');
            return null;
        }

        return data;
    }

    // ==================== Graph Provider ====================

    /**
     * Get Graph Provider instance
     */
    getGraphProvider() {
        if (!this._graphProvider) {
            const SupabaseGraphProvider = require('../graph/providers/supabase');
            this._graphProvider = new SupabaseGraphProvider({
                supabase: this.supabase,
                projectId: this.currentProjectId
            });
        }
        // Update project context if changed
        if (this.currentProjectId && this._graphProvider.projectId !== this.currentProjectId) {
            this._graphProvider.setProjectContext(this.currentProjectId);
        }
        return this._graphProvider;
    }

    /**
     * Get emails for the current project
     * @param {Object} options - Filter options
     * @returns {Promise<Array>}
     */
    async getEmails(options = {}) {
        const projectId = this.getProjectId();
        const { limit = 50, requiresResponse, direction, includeDeleted = false, sinceDate, untilDate } = options;

        let query = this.supabase
            .from('emails')
            .select('*')
            .eq('project_id', projectId)
            .order('date_sent', { ascending: false })
            .limit(limit);

        if (!includeDeleted) {
            query = query.is('deleted_at', null);
        }

        if (requiresResponse !== undefined) {
            query = query.eq('requires_response', requiresResponse);
        }

        if (direction) {
            query = query.eq('direction', direction);
        }

        if (sinceDate) {
            query = query.gte('date_sent', sinceDate);
        }
        if (untilDate) {
            query = query.lte('date_sent', untilDate);
        }

        const { data, error } = await query;

        if (error) {
            log.warn({ event: 'emails_get_failed', reason: error.message }, 'Failed to get emails');
            return [];
        }

        return data;
    }

    /**
     * Get a single email by ID
     * @param {string} id - Email ID
     * @returns {Promise<Object|null>}
     */
    async getEmail(id) {
        const { data, error } = await this.supabase
            .from('emails')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            log.warn({ event: 'email_get_failed', reason: error.message }, 'Failed to get email');
            return null;
        }

        return data;
    }

    /**
     * Find email by content hash (for duplicate detection)
     * @param {string} contentHash - MD5 hash of email content
     * @returns {Promise<Object|null>}
     */
    async findEmailByHash(contentHash) {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('emails')
            .select('id, subject, from_email, created_at')
            .eq('project_id', projectId)
            .eq('content_hash', contentHash)
            .is('deleted_at', null)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            log.warn({ event: 'email_find_by_hash_failed', reason: error.message }, 'Failed to find email by hash');
        }

        return data || null;
    }

    /**
     * Soft delete an email
     * @param {string} id - Email ID
     * @returns {Promise<boolean>}
     */
    async deleteEmail(id) {
        const { error } = await this.supabase
            .from('emails')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            log.warn({ event: 'email_delete_failed', reason: error.message }, 'Failed to delete email');
            return false;
        }

        return true;
    }

    /**
     * Add email recipient link
     * @param {string} emailId - Email ID
     * @param {Object} recipient - Recipient data
     * @returns {Promise<Object|null>}
     */
    async addEmailRecipient(emailId, recipient) {
        const { data, error } = await this.supabase
            .from('email_recipients')
            .insert({
                email_id: emailId,
                contact_id: recipient.contact_id || null,
                recipient_type: recipient.type || 'to',
                email_address: recipient.email,
                display_name: recipient.name || null,
            })
            .select()
            .single();

        if (error) {
            // Ignore duplicate errors
            if (!error.message.includes('duplicate')) {
                log.warn({ event: 'email_recipient_add_failed', reason: error.message }, 'Failed to add email recipient');
            }
            return null;
        }

        return data;
    }

    /**
     * Get email recipients
     * @param {string} emailId - Email ID
     * @returns {Promise<Array>}
     */
    async getEmailRecipients(emailId) {
        const { data, error } = await this.supabase
            .from('email_recipients')
            .select(`
                *,
                contact:contacts(id, name, email)
            `)
            .eq('email_id', emailId);

        if (error) {
            log.warn({ event: 'email_recipients_get_failed', reason: error.message }, 'Failed to get email recipients');
            return [];
        }

        return data;
    }

    /**
     * Add email attachment link
     * @param {string} emailId - Email ID
     * @param {string} documentId - Document ID
     * @param {Object} metadata - Attachment metadata
     * @returns {Promise<Object|null>}
     */
    async addEmailAttachment(emailId, documentId, metadata = {}) {
        const { data, error } = await this.supabase
            .from('email_attachments')
            .insert({
                email_id: emailId,
                document_id: documentId,
                filename: metadata.filename || null,
                content_type: metadata.contentType || null,
                size_bytes: metadata.size || null,
            })
            .select()
            .single();

        if (error) {
            log.warn({ event: 'email_attachment_add_failed', reason: error.message }, 'Failed to add email attachment');
            return null;
        }

        return data;
    }

    /**
     * Get emails that need a response
     * @returns {Promise<Array>}
     */
    async getEmailsNeedingResponse() {
        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('emails')
            .select('*')
            .eq('project_id', projectId)
            .eq('requires_response', true)
            .eq('response_drafted', false)
            .is('deleted_at', null)
            .order('date_sent', { ascending: true });

        if (error) {
            log.warn({ event: 'emails_needing_response_failed', reason: error.message }, 'Failed to get emails needing response');
            return [];
        }

        return data;
    }

    /**
     * Find contact by email address
     * @param {string} email - Email address
     * @returns {Promise<Object|null>}
     */
    async findContactByEmail(email) {
        if (!email) return null;

        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('project_id', projectId)
            .ilike('email', email)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();

        if (error) {
            log.warn({ event: 'contact_find_by_email_failed', reason: error.message }, 'Failed to find contact by email');
            return null;
        }

        return data;
    }

    /**
     * Find contact by name (fuzzy match)
     * @param {string} name - Contact name
     * @returns {Promise<Object|null>}
     */
    async findContactByName(name) {
        if (!name) return null;

        const projectId = this.getProjectId();

        // Try exact match first
        const { data: exactMatch, error: exactError } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('project_id', projectId)
            .ilike('name', name)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();

        if (exactMatch) return exactMatch;

        // Try partial match (contains)
        const { data: partialMatch, error: partialError } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('project_id', projectId)
            .ilike('name', `%${name}%`)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();

        return partialMatch || null;
    }

    /**
     * Create a new contact from email data
     * @param {Object} contactData - Contact data
     * @returns {Promise<Object>}
     */
    async createContactFromEmail(contactData) {
        const projectId = this.getProjectId();

        const record = {
            project_id: projectId,
            name: contactData.name || 'Unknown',
            email: contactData.email || null,
            phone: contactData.phone || null,
            role: contactData.role || null,
            organization: contactData.organization || null,
            location: contactData.location || null,
            notes: contactData.source ? `Created from email: ${contactData.source}` : 'Created from email',
        };

        const { data, error } = await this.supabase
            .from('contacts')
            .insert(record)
            .select()
            .single();

        if (error) {
            log.warn({ event: 'contact_create_from_email_failed', reason: error.message }, 'Failed to create contact');
            throw error;
        }
        log.info({ event: 'contact_created_from_email', name: record.name }, 'Created contact from email');
        return data;
    }

    // ============================================
    // ENTITY RESOLUTION FUNCTIONS (v1.6)
    // ============================================

    /**
     * Find contact by name AND organization (stronger match)
     * @param {string} name - Contact name
     * @param {string} organization - Organization name
     * @returns {Promise<Object|null>}
     */
    async findContactByNameAndOrg(name, organization) {
        if (!name || !organization) return null;

        const projectId = this.getProjectId();

        const { data, error } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('project_id', projectId)
            .ilike('name', name)
            .ilike('organization', organization)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();

        if (error) {
            log.warn({ event: 'contact_find_by_name_org_failed', reason: error.message }, 'Failed to find contact by name+org');
            return null;
        }

        return data;
    }

    /**
     * Find contact by alias
     * @param {string} alias - Alias to search for
     * @returns {Promise<Object|null>}
     */
    async findContactByAlias(alias) {
        if (!alias) return null;

        const projectId = this.getProjectId();

        // PostgreSQL array contains check
        const { data, error } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('project_id', projectId)
            .contains('aliases', [alias])
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();

        if (error) {
            log.warn({ event: 'contact_find_by_alias_failed', reason: error.message }, 'Failed to find contact by alias');
            return null;
        }

        return data;
    }

    /**
     * Find or create contact with email-priority deduplication
     * @param {Object} personData - Person data from extraction
     * @param {string} personData.name - Person name (required)
     * @param {string} personData.email - Email address (optional but preferred)
     * @param {string} personData.organization - Organization (optional)
     * @param {string} personData.role - Role/title (optional)
     * @param {string[]} personData.aliases - Known aliases (optional)
     * @param {string} personData.sourceDocumentId - Source document (optional)
     * @returns {Promise<{contact: Object, action: string, confidence: number}>}
     */
    async findOrCreateContact(personData) {
        if (!personData?.name) {
            return { contact: null, action: 'skipped', confidence: 0 };
        }

        const projectId = this.getProjectId();

        // Priority 1: Match by email (strongest identifier)
        if (personData.email) {
            const byEmail = await this.findContactByEmail(personData.email);
            if (byEmail) {
                // Update with any new info
                await this.updateContactFromExtraction(byEmail.id, personData);
                return { contact: byEmail, action: 'matched_by_email', confidence: 1.0 };
            }
        }

        // Priority 2: Match by name + organization (strong)
        if (personData.name && personData.organization) {
            const byNameOrg = await this.findContactByNameAndOrg(personData.name, personData.organization);
            if (byNameOrg) {
                await this.updateContactFromExtraction(byNameOrg.id, personData);
                return { contact: byNameOrg, action: 'matched_by_name_org', confidence: 0.9 };
            }
        }

        // Priority 3: Match by alias
        if (personData.name) {
            const byAlias = await this.findContactByAlias(personData.name);
            if (byAlias) {
                await this.updateContactFromExtraction(byAlias.id, personData);
                return { contact: byAlias, action: 'matched_by_alias', confidence: 0.85 };
            }
        }

        // Priority 4: Fuzzy name match (weak - could be different person)
        const fuzzyMatch = await this.findContactByName(personData.name);
        if (fuzzyMatch) {
            // Only use fuzzy match if we have corroborating info
            const hasCorroboration =
                (personData.role && fuzzyMatch.role && personData.role.toLowerCase().includes(fuzzyMatch.role.toLowerCase())) ||
                (personData.organization && fuzzyMatch.organization && personData.organization.toLowerCase().includes(fuzzyMatch.organization.toLowerCase()));

            if (hasCorroboration) {
                await this.updateContactFromExtraction(fuzzyMatch.id, personData);
                return { contact: fuzzyMatch, action: 'matched_by_fuzzy_corroborated', confidence: 0.7 };
            }
        }

        // No match - create new contact
        try {
            const newContact = await this.createContactFromExtraction(personData);
            return { contact: newContact, action: 'created', confidence: 1.0 };
        } catch (err) {
            log.warn({ event: 'contact_create_failed', reason: err.message }, 'Failed to create contact');
            return { contact: null, action: 'error', confidence: 0 };
        }
    }

    /**
     * Create contact from entity extraction
     * @param {Object} personData - Person data
     * @returns {Promise<Object>}
     */
    async createContactFromExtraction(personData) {
        const projectId = this.getProjectId();

        const record = {
            project_id: projectId,
            name: personData.name,
            email: personData.email || null,
            role: personData.role || null,
            organization: personData.organization || null,
            aliases: personData.aliases || [],
            notes: `Created from extraction${personData.sourceDocumentId ? ` (doc: ${personData.sourceDocumentId})` : ''}`,
            first_seen_at: new Date().toISOString(),
            interaction_count: 1
        };

        const { data, error } = await this.supabase
            .from('contacts')
            .insert(record)
            .select()
            .single();

        if (error) {
            throw error;
        }

        log.info({ event: 'contact_created_from_extraction', name: record.name }, 'Created contact from extraction');
        return data;
    }

    /**
     * Update contact with new extraction data (merge, don't overwrite)
     * @param {string} contactId - Contact ID
     * @param {Object} personData - New data to merge
     */
    async updateContactFromExtraction(contactId, personData) {
        const updates = {
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Only update empty fields
        const { data: current } = await this.supabase
            .from('contacts')
            .select('email, organization, role, aliases')
            .eq('id', contactId)
            .single();

        if (current) {
            if (!current.email && personData.email) updates.email = personData.email;
            if (!current.organization && personData.organization) updates.organization = personData.organization;
            if (!current.role && personData.role) updates.role = personData.role;

            // Merge aliases
            if (personData.aliases?.length) {
                const existingAliases = current.aliases || [];
                const newAliases = personData.aliases.filter(a => !existingAliases.includes(a));
                if (newAliases.length) {
                    updates.aliases = [...existingAliases, ...newAliases];
                }
            }

            // Add name as alias if different
            if (personData.name && current.name && personData.name !== current.name) {
                const aliases = updates.aliases || current.aliases || [];
                if (!aliases.includes(personData.name)) {
                    updates.aliases = [...aliases, personData.name];
                }
            }
        }

        // Increment interaction count
        await this.supabase
            .from('contacts')
            .update(updates)
            .eq('id', contactId);

        await this.supabase.rpc('increment_contact_interaction', { contact_id: contactId }).catch(() => {
            // Fallback if RPC doesn't exist
            this.supabase
                .from('contacts')
                .update({ interaction_count: (current?.interaction_count || 0) + 1 })
                .eq('id', contactId);
        });
    }

    /**
     * Update contact aliases (merge with existing)
     * @param {string} contactId - Contact ID
     * @param {string[]} newAliases - Aliases to add
     */
    async updateContactAliases(contactId, newAliases) {
        if (!contactId || !newAliases?.length) return;

        const { data: current } = await this.supabase
            .from('contacts')
            .select('aliases')
            .eq('id', contactId)
            .single();

        const existingAliases = current?.aliases || [];
        const mergedAliases = [...new Set([...existingAliases, ...newAliases])];

        await this.supabase
            .from('contacts')
            .update({
                aliases: mergedAliases,
                updated_at: new Date().toISOString()
            })
            .eq('id', contactId);
    }

    /**
     * Reset all knowledge/data for the current project.
     * Only tables in RESET_KEEP_TABLES (and llm_cost_*) are preserved; everything else is deleted in FK-safe order.
     * When you add new project-scoped tables in migrations, add a delete step to RESET_DELETE_STEPS in the correct order.
     * @returns {Promise<{ success: boolean; message?: string; error?: string }>}
     */
    async resetProjectData() {
        const projectId = this.currentProjectId;
        if (!projectId) {
            return { success: false, error: 'No project selected' };
        }

        const del = async (table, filter = {}) => {
            let q = this.supabase.from(table).delete();
            if (filter.column && filter.value !== undefined) {
                if (Array.isArray(filter.value)) {
                    if (filter.value.length === 0) return { error: null };
                    q = q.in(filter.column, filter.value);
                } else {
                    q = q.eq(filter.column, filter.value);
                }
            }
            const { error } = await q;
            return { error };
        };

        const idsFor = async (table, idColumn = 'id') => {
            const { data, error } = await this.supabase
                .from(table)
                .select(idColumn)
                .eq('project_id', projectId);
            if (error) return [];
            return (data || []).map(r => r[idColumn]).filter(Boolean);
        };

        const steps = SupabaseStorage.RESET_DELETE_STEPS;

        try {
            for (const step of steps) {
                if (step.op === 'self_ref') {
                    await this.supabase.from(step.table).update(step.set).eq('project_id', projectId);
                } else if (step.op === 'child_by_parent') {
                    const ids = await idsFor(step.parentTable, step.parentIdColumn || 'id');
                    if (ids.length) await del(step.childTable, { column: step.childColumn, value: ids });
                } else if (step.op === 'delete') {
                    await del(step.table, { column: 'project_id', value: projectId });
                }
            }
            return { success: true, message: 'Project knowledge data reset; team, contacts and cost preserved.' };
        } catch (err) {
            log.error({ event: 'reset_project_data_error', err: err?.message }, 'resetProjectData error');
            return { success: false, error: err.message };
        }
    }
}

// =============================================================================
// RESET PROJECT DATA – single source of truth
// =============================================================================
// Preserved (never deleted):
//   - RESET_KEEP_TABLES below (team, contacts, config, secrets, api_keys, webhooks, etc.)
//   - Any table whose name starts with "llm_cost_" (cost tracking)
//
// When you add a NEW project-scoped table in a migration:
//   1. Open this file and find RESET_DELETE_STEPS below.
//   2. Add one step in the correct FK order (children before parents).
//   3. Step types:
//      - Simple delete by project_id:
//        { op: 'delete', table: 'your_new_table' }
//      - Child table (references another table by id): add a child_by_parent step
//        before the parent's delete, e.g.:
//        { op: 'child_by_parent', childTable: 'child_table', parentTable: 'parent_table', childColumn: 'parent_id' }
//      - Self-referencing table: first clear the self-ref column(s), then delete:
//        { op: 'self_ref', table: 'table_name', set: { self_ref_column: null } }
//        { op: 'delete', table: 'table_name' }
// =============================================================================
SupabaseStorage.RESET_KEEP_TABLES = new Set([
    'project_members', 'projects', 'invites', 'contacts', 'teams', 'team_members',
    'contact_relationships', 'contact_activity', 'contact_projects',
    'project_config', 'secrets', 'api_keys', 'webhooks', 'audit_exports',
    'user_profiles', 'timezones', 'system_prompts', 'system_config'
]);

SupabaseStorage.RESET_DELETE_STEPS = [
    // 1. Self-refs so we can delete
    { op: 'self_ref', table: 'knowledge_questions', set: { follow_up_to: null, merged_into_id: null, superseded_by_id: null, template_id: null } },
    // 2. Event/similarity tables (by parent ids)
    { op: 'child_by_parent', childTable: 'fact_events', parentTable: 'facts', childColumn: 'fact_id' },
    { op: 'child_by_parent', childTable: 'fact_similarities', parentTable: 'facts', childColumn: 'fact_id' },
    { op: 'child_by_parent', childTable: 'decision_events', parentTable: 'decisions', childColumn: 'decision_id' },
    { op: 'child_by_parent', childTable: 'decision_similarities', parentTable: 'decisions', childColumn: 'decision_id' },
    { op: 'child_by_parent', childTable: 'risk_events', parentTable: 'risks', childColumn: 'risk_id' },
    { op: 'child_by_parent', childTable: 'action_events', parentTable: 'action_items', childColumn: 'action_id' },
    { op: 'child_by_parent', childTable: 'question_events', parentTable: 'knowledge_questions', childColumn: 'question_id' },
    { op: 'child_by_parent', childTable: 'question_similarities', parentTable: 'knowledge_questions', childColumn: 'question_id' },
    // Team analysis evidence (before team_profiles, documents, people)
    { op: 'delete', table: 'profile_evidence' },
    { op: 'delete', table: 'transcript_interventions' },
    { op: 'delete', table: 'team_analysis_history' },
    // 3. Core knowledge entities
    { op: 'delete', table: 'facts' },
    { op: 'delete', table: 'decisions' },
    { op: 'delete', table: 'risks' },
    { op: 'delete', table: 'action_items' },
    { op: 'delete', table: 'knowledge_questions' },
    // Behavioral + team profiles (reference people) before people
    { op: 'delete', table: 'behavioral_relationships' },
    { op: 'delete', table: 'team_profiles' },
    { op: 'delete', table: 'team_analysis' },
    { op: 'delete', table: 'people' },
    { op: 'delete', table: 'relationships' },
    // 4. ai_analysis_log
    { op: 'self_ref', table: 'ai_analysis_log', set: { parent_analysis_id: null } },
    { op: 'delete', table: 'ai_analysis_log' },
    // 5. Document-related (before documents)
    { op: 'delete', table: 'document_versions' },
    { op: 'delete', table: 'document_activity' },
    { op: 'delete', table: 'document_shares' },
    { op: 'delete', table: 'raw_content' },
    { op: 'delete', table: 'document_metadata' },
    { op: 'delete', table: 'processing_history' },
    { op: 'child_by_parent', childTable: 'email_attachments', parentTable: 'emails', childColumn: 'email_id' },
    { op: 'child_by_parent', childTable: 'email_recipients', parentTable: 'emails', childColumn: 'email_id' },
    { op: 'delete', table: 'emails' },
    // 6. Documents and rest of knowledge
    { op: 'delete', table: 'documents' },
    { op: 'delete', table: 'embeddings' },
    { op: 'delete', table: 'conversations' },
    { op: 'delete', table: 'knowledge_change_log' },
    // 7. SOT, stats, briefings
    { op: 'delete', table: 'sot_last_view' },
    { op: 'delete', table: 'sot_versions' },
    { op: 'delete', table: 'stats_history' },
    { op: 'delete', table: 'synthesized_files' },
    { op: 'delete', table: 'briefings' },
    // 8. Comments, notifications, watched
    { op: 'delete', table: 'comments' },
    { op: 'delete', table: 'notifications' },
    { op: 'delete', table: 'watched_items' },
    // 9. Ontology, calendar, roles
    { op: 'delete', table: 'ontology_changes' },
    { op: 'delete', table: 'ontology_suggestions' },
    { op: 'delete', table: 'calendar_events' },
    { op: 'delete', table: 'role_analytics' },
    { op: 'delete', table: 'role_history' },
    { op: 'delete', table: 'role_question_templates' },
    // 10. Graph
    { op: 'delete', table: 'graph_relationships' },
    { op: 'delete', table: 'graph_nodes' },
    // 11. Graph UI, outbox
    { op: 'delete', table: 'graph_query_history' },
    { op: 'delete', table: 'graph_saved_views' },
    { op: 'delete', table: 'graph_bookmarks' },
    { op: 'delete', table: 'graph_annotations' },
    { op: 'delete', table: 'graph_chat_history' },
    { op: 'delete', table: 'graph_snapshots' },
    { op: 'delete', table: 'graph_dead_letter' },
    { op: 'delete', table: 'graph_outbox' },
    { op: 'delete', table: 'graph_sync_status' },
    // 12. Chat
    { op: 'child_by_parent', childTable: 'chat_messages', parentTable: 'chat_sessions', childColumn: 'session_id' },
    { op: 'delete', table: 'chat_sessions' },
    // 13. Optimizations / sync / usage (llm_requests is usage, not llm_cost_*)
    { op: 'delete', table: 'query_history' },
    { op: 'delete', table: 'saved_searches' },
    { op: 'delete', table: 'user_feedback' },
    { op: 'delete', table: 'cache_entries' },
    { op: 'delete', table: 'scheduled_jobs' },
    { op: 'delete', table: 'sync_states' },
    { op: 'delete', table: 'usage_analytics' },
    { op: 'delete', table: 'project_usage_limits' },
    { op: 'delete', table: 'usage_alerts' },
    { op: 'delete', table: 'config_audit_log' },
    { op: 'delete', table: 'delete_stats' },
    { op: 'delete', table: 'delete_audit_log' },
    { op: 'delete', table: 'delete_backups' },
    { op: 'delete', table: 'retention_policies' },
    { op: 'delete', table: 'soft_deletes' },
    { op: 'delete', table: 'archive' },
    { op: 'delete', table: 'llm_requests' }
];

// Factory function for creating storage instance
function createSupabaseStorage(options = {}) {
    const supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
    // Prefer service key for server-side operations (bypasses RLS)
    const supabaseKey = options.supabaseKey ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_PROJECT_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_PROJECT_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY (or SERVICE_KEY) are required');
    }

    return new SupabaseStorage(supabaseUrl, supabaseKey, options);
}

module.exports = { SupabaseStorage, createSupabaseStorage };
