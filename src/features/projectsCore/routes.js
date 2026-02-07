/**
 * Project Management core routes (extracted from src/server.js)
 *
 * Non-negotiable: keep runtime behavior identical.
 */

async function handleProjectsCore(ctx) {
    // NOTE: This module uses many dependencies; to avoid deep rewrites,
    // we simply keep the original logic and use ctx bindings.

    const {
        req,
        res,
        pathname,
        supabase,
        storage,
        processor,
        invalidateBriefingCache,
        config,
        saveConfig,
        fs,
        path,
        parseUrl,
        parseBody,
        parseMultipart,
        jsonResponse,
    } = ctx;

    // ==================== Project Management API ====================

    // GET /api/projects - List projects (filtered by user membership)
    if (pathname === '/api/projects' && req.method === 'GET') {
        try {
            // Check if user is authenticated
            if (supabase && supabase.isConfigured()) {
                const authResult = await supabase.auth.verifyRequest(req);

                if (authResult.authenticated) {
                    const userId = authResult.user.id;
                    const client = supabase.getAdminClient();

                    // Check if user is superadmin (can see all projects)
                    const isSuperAdmin = await supabase.auth.isSuperAdmin(userId);

                    if (isSuperAdmin) {
                        // Superadmins can see all projects
                        const { data: allProjects, error } = await client
                            .from('projects')
                            .select('*')
                            .order('name', { ascending: true });

                        if (error) {
                            console.error('[API] Error listing all projects:', error.message);
                            jsonResponse(res, { projects: [] });
                            return true;
                        }

                        jsonResponse(res, { projects: allProjects || [] });
                        return true;
                    }

                    // Regular users: only see projects they are members of
                    const { data: memberProjects, error } = await client
                        .from('project_members')
                        .select(`
                                project_id,
                                role,
                                user_role,
                                projects:project_id (
                                    id,
                                    name,
                                    description,
                                    status,
                                    settings,
                                    created_at,
                                    updated_at
                                )
                            `)
                        .eq('user_id', userId);

                    if (error) {
                        console.error('[API] Error listing user projects:', error.message);
                        jsonResponse(res, { projects: [] });
                        return true;
                    }

                    // Extract and format projects with user's role
                    const projects = (memberProjects || [])
                        .filter(m => m.projects) // Filter out any null references
                        .map(m => ({
                            ...m.projects,
                            member_role: m.role,        // owner/admin/write/read
                            user_role: m.user_role      // Custom role like "Tech Lead"
                        }))
                        .sort((a, b) => a.name.localeCompare(b.name));

                    jsonResponse(res, { projects });
                    return true;
                }
            }

            // Fallback: not authenticated or Supabase not configured
            const projects = await storage.listProjects();
            jsonResponse(res, { projects: projects || [] });
        } catch (e) {
            console.error('[API] Error listing projects:', e.message);
            jsonResponse(res, { projects: [] });
        }
        return true;
    }

    // POST /api/projects - Create a new project
    if (pathname === '/api/projects' && req.method === 'POST') {
        const body = await parseBody(req);
        const name = body.name;
        const userRole = body.userRole || '';

        if (!name || name.trim().length === 0) {
            jsonResponse(res, { error: 'Project name is required' }, 400);
            return true;
        }

        try {
            const project = await storage.createProject(name.trim(), userRole.trim());
            jsonResponse(res, { success: true, project });
        } catch (e) {
            console.error('[API] Error creating project:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/projects/:id - Get project by ID
    if (pathname.match(/^\/api\/projects\/([^/]+)$/) && req.method === 'GET') {
        const projectId = pathname.match(/^\/api\/projects\/([^/]+)$/)[1];

        // Skip special routes
        if (projectId === 'current') {
            // Fall through to next handler
        } else {
            try {
                if (supabase && supabase.isConfigured()) {
                    const client = supabase.getAdminClient();
                    const { data: project, error } = await client
                        .from('projects')
                        .select('*')
                        .eq('id', projectId)
                        .single();

                    if (error) {
                        jsonResponse(res, { error: 'Project not found' }, 404);
                        return true;
                    }

                    jsonResponse(res, { project });
                    return true;
                }

                // Fallback to storage
                const projects = await storage.listProjects();
                const project = projects.find(p => p.id === projectId);
                if (project) {
                    jsonResponse(res, { project });
                } else {
                    jsonResponse(res, { error: 'Project not found' }, 404);
                }
            } catch (e) {
                console.error('[API] Error getting project:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return true;
        }
    }

    // GET /api/projects/:id/config - Get project configuration
    if (pathname.match(/^\/api\/projects\/([^/]+)\/config$/) && req.method === 'GET') {
        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/config$/)[1];

        try {
            if (supabase && supabase.isConfigured()) {
                const client = supabase.getAdminClient();
                const { data: config, error } = await client
                    .from('project_config')
                    .select('*')
                    .eq('project_id', projectId)
                    .single();

                if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
                    console.error('[API] Error getting project config:', error.message);
                }

                jsonResponse(res, { config: config || { project_id: projectId } });
                return true;
            }

            jsonResponse(res, { config: { project_id: projectId } });
        } catch (e) {
            console.error('[API] Error getting project config:', e.message);
            jsonResponse(res, { config: { project_id: projectId } });
        }
        return true;
    }

    // PUT /api/projects/:id/config - Update project configuration
    if (pathname.match(/^\/api\/projects\/([^/]+)\/config$/) && req.method === 'PUT') {
        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/config$/)[1];
        const body = await parseBody(req);

        try {
            if (supabase && supabase.isConfigured()) {
                const client = supabase.getAdminClient();

                // Upsert config
                const { error } = await client
                    .from('project_config')
                    .upsert({
                        project_id: projectId,
                        llm_config: body.llm_config || {},
                        ollama_config: body.ollama_config || {},
                        prompts: body.prompts || {},
                        processing_settings: body.processing_settings || {},
                        ui_preferences: body.ui_preferences || {},
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'project_id' });

                if (error) {
                    console.error('[API] Error saving project config:', error.message);
                    jsonResponse(res, { error: error.message }, 500);
                    return true;
                }

                jsonResponse(res, { success: true });
                return true;
            }

            jsonResponse(res, { success: true });
        } catch (e) {
            console.error('[API] Error saving project config:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/role-templates - List role templates
    if (pathname === '/api/role-templates' && req.method === 'GET') {
        try {
            if (supabase && supabase.isConfigured()) {
                const client = supabase.getAdminClient();
                const { data: roles, error } = await client
                    .from('role_templates')
                    .select('*')
                    .order('category', { ascending: true })
                    .order('display_name', { ascending: true });

                if (error) {
                    console.error('[API] Error listing role templates:', error.message);
                    jsonResponse(res, { roles: [] });
                    return true;
                }

                jsonResponse(res, { roles: roles || [] });
                return true;
            }

            jsonResponse(res, { roles: [] });
        } catch (e) {
            console.error('[API] Error listing role templates:', e.message);
            jsonResponse(res, { roles: [] });
        }
        return true;
    }

    // POST /api/role-templates - Create role template
    if (pathname === '/api/role-templates' && req.method === 'POST') {
        try {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Database not configured' }, 503);
                return true;
            }

            const body = await parseBody(req);
            const client = supabase.getAdminClient();

            const roleData = {
                name: body.name,
                display_name: body.display_name || body.name,
                description: body.description || null,
                role_context: body.role_context || null,
                category: body.category || 'custom',
                color: body.color || '#e11d48',
                permissions: body.permissions || [],
                is_template: body.is_template || false,
                is_system: false,
            };

            const { data, error } = await client
                .from('role_templates')
                .insert(roleData)
                .select()
                .single();

            if (error) {
                console.error('[API] Error creating role template:', error.message);
                jsonResponse(res, { error: error.message }, 400);
                return true;
            }

            jsonResponse(res, { success: true, role: data });
        } catch (e) {
            console.error('[API] Error creating role template:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/role-templates/:id - Update role template
    if (pathname.match(/^\/api\/role-templates\/([^/]+)$/) && req.method === 'PUT') {
        try {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Database not configured' }, 503);
                return true;
            }

            const roleId = pathname.match(/^\/api\/role-templates\/([^/]+)$/)[1];
            const body = await parseBody(req);
            const client = supabase.getAdminClient();

            const updateData = {};
            if (body.name !== undefined) updateData.name = body.name;
            if (body.display_name !== undefined) updateData.display_name = body.display_name;
            if (body.description !== undefined) updateData.description = body.description;
            if (body.role_context !== undefined) updateData.role_context = body.role_context;
            if (body.category !== undefined) updateData.category = body.category;
            if (body.color !== undefined) updateData.color = body.color;
            if (body.permissions !== undefined) updateData.permissions = body.permissions;
            if (body.is_template !== undefined) updateData.is_template = body.is_template;
            updateData.updated_at = new Date().toISOString();

            const { data, error } = await client
                .from('role_templates')
                .update(updateData)
                .eq('id', roleId)
                .select()
                .single();

            if (error) {
                console.error('[API] Error updating role template:', error.message);
                jsonResponse(res, { error: error.message }, 400);
                return true;
            }

            jsonResponse(res, { success: true, role: data });
        } catch (e) {
            console.error('[API] Error updating role template:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // DELETE /api/role-templates/:id - Delete role template
    if (pathname.match(/^\/api\/role-templates\/([^/]+)$/) && req.method === 'DELETE') {
        try {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Database not configured' }, 503);
                return true;
            }

            const roleId = pathname.match(/^\/api\/role-templates\/([^/]+)$/)[1];
            const client = supabase.getAdminClient();

            // Don't allow deleting system roles
            const { data: existing } = await client
                .from('role_templates')
                .select('is_system')
                .eq('id', roleId)
                .single();

            if (existing?.is_system) {
                jsonResponse(res, { error: 'Cannot delete system role' }, 400);
                return true;
            }

            const { error } = await client
                .from('role_templates')
                .delete()
                .eq('id', roleId);

            if (error) {
                console.error('[API] Error deleting role template:', error.message);
                jsonResponse(res, { error: error.message }, 400);
                return true;
            }

            jsonResponse(res, { success: true });
        } catch (e) {
            console.error('[API] Error deleting role template:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/projects/current - Get currently active project
    if (pathname === '/api/projects/current' && req.method === 'GET') {
        try {
            // Get project with member role
            const project = await storage.getCurrentProjectWithRole();
            jsonResponse(res, { project });
        } catch (e) {
            const project = storage.getCurrentProject();
            jsonResponse(res, { project });
        }
        return true;
    }

    // POST /api/projects/deactivate - Deactivate current project (select none)
    if (pathname === '/api/projects/deactivate' && req.method === 'POST') {
        try {
            // Use switchProject with null to clear current project
            await storage.switchProject(null, null);
            jsonResponse(res, { success: true });
        } catch (e) {
            console.error('[API] Error deactivating project:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/projects/current/role - Update current user's role in project
    if (pathname === '/api/projects/current/role' && req.method === 'PUT') {
        try {
            const body = await parseBody(req);
            const project = storage.getCurrentProject();

            if (!project) {
                jsonResponse(res, { error: 'No current project' }, 400);
                return true;
            }

            const result = await storage.updateMemberRole(project.id, {
                userRole: body.userRole,
                userRolePrompt: body.userRolePrompt,
                roleTemplateId: body.roleTemplateId
            });

            // Invalidate briefing cache when role changes
            invalidateBriefingCache();

            jsonResponse(res, {
                success: true,
                userRole: result.userRole,
                userRolePrompt: result.userRolePrompt,
                roleTemplateId: result.roleTemplateId
            });
        } catch (e) {
            console.error('[API] Error updating member role:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/projects/:id/activate - Switch to a project
    if (pathname.match(/^\/api\/projects\/([^/]+)\/activate$/) && req.method === 'PUT') {
        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/activate$/)[1];

        const success = storage.switchProject(projectId);
        if (success) {
            const project = storage.getCurrentProject();
            const newDataDir = storage.getProjectDataDir();

            // Reinitialize processor with new project data directory
            processor.updateDataDir(newDataDir);

            // Update config.dataDir to keep in sync
            config.dataDir = newDataDir;
            saveConfig(config);

            // Record stats for new project
            storage.recordDailyStats();

            // Switch FalkorDB graph to project-specific graph
            // First try to load graph config from Supabase, then fall back to local config
            let projectGraphConfig = null;

            if (supabase) {
                try {
                    const { data: projectConfig } = await supabase
                        .from('project_config')
                        .select('graph_config')
                        .eq('project_id', projectId)
                        .single();

                    if (projectConfig?.graph_config?.enabled) {
                        projectGraphConfig = projectConfig.graph_config;
                        // Get password from env var or secrets - never store in Supabase
                        const falkorPassword = process.env.FALKORDB_PASSWORD || process.env.FAKORDB_PASSWORD;
                        if (projectGraphConfig.falkordb && falkorPassword) {
                            projectGraphConfig.falkordb.password = falkorPassword;
                        }
                        console.log(`[Graph] Loaded config from Supabase for project: ${projectId}`);
                    }
                } catch (supaErr) {
                    // Supabase config not found, will use local config
                }
            }

            // Use Supabase config if available, otherwise local config
            const effectiveGraphConfig = projectGraphConfig || config.graph;

            if (effectiveGraphConfig && effectiveGraphConfig.enabled && effectiveGraphConfig.autoConnect !== false) {
                try {
                    const baseGraphName = effectiveGraphConfig.baseGraphName || effectiveGraphConfig.graphName?.split('_')[0] || 'godmode';
                    const projectGraphName = `${baseGraphName}_${projectId}`;

                    const graphConfig = {
                        ...effectiveGraphConfig,
                        graphName: projectGraphName
                    };

                    console.log(`[Graph] Switching to graph: ${projectGraphName}`);
                    const graphResult = await storage.initGraph(graphConfig);

                    if (graphResult.ok) {
                        console.log(`[Graph] ✓ Switched to graph: ${projectGraphName}`);
                    } else {
                        console.log(`[Graph] ✗ Failed to switch graph: ${graphResult.error}`);
                    }
                } catch (e) {
                    console.log(`[Graph] Error switching graph: ${e.message}`);
                }
            }

            console.log(`Project switched to: ${project.name} (${projectId}), dataDir: ${newDataDir}`);
            jsonResponse(res, { success: true, project });
        } else {
            jsonResponse(res, { error: 'Project not found' }, 404);
        }
        return true;
    }

    // PUT /api/projects/:id - Update project (name, description, settings)
    if (pathname.match(/^\/api\/projects\/([^/]+)$/) && req.method === 'PUT') {
        const projectId = pathname.match(/^\/api\/projects\/([^/]+)$/)[1];
        const body = await parseBody(req);

        // Build updates object
        const updates = {};
        if (body.name !== undefined) {
            if (!body.name || body.name.trim().length === 0) {
                jsonResponse(res, { error: 'Project name cannot be empty' }, 400);
                return true;
            }
            updates.name = body.name.trim();
        }
        if (body.description !== undefined) {
            updates.description = body.description?.trim() || null;
        }
        if (body.settings !== undefined) {
            updates.settings = body.settings;
        }
        if (body.userRole !== undefined) {
            updates.userRole = body.userRole.trim();
        }
        if (body.userRolePrompt !== undefined) {
            updates.userRolePrompt = body.userRolePrompt.trim();
        }

        // Handle isDefault flag
        if (body.isDefault === true) {
            storage.setDefaultProject(projectId);
        }

        try {
            // Use Supabase if configured
            if (supabase && supabase.isConfigured()) {
                const client = supabase.getAdminClient();

                // Build Supabase update object
                const supabaseUpdates = {
                    updated_at: new Date().toISOString()
                };
                if (updates.name) supabaseUpdates.name = updates.name;
                if (updates.description !== undefined) supabaseUpdates.description = updates.description;
                if (updates.settings) {
                    // Merge with existing settings
                    const { data: existing } = await client
                        .from('projects')
                        .select('settings')
                        .eq('id', projectId)
                        .single();

                    supabaseUpdates.settings = {
                        ...(existing?.settings || {}),
                        ...updates.settings
                    };
                }

                const { data: project, error } = await client
                    .from('projects')
                    .update(supabaseUpdates)
                    .eq('id', projectId)
                    .select()
                    .single();

                if (error) {
                    console.error('[API] Error updating project:', error.message);
                    jsonResponse(res, { error: error.message }, 500);
                    return true;
                }

                jsonResponse(res, { success: true, project });
                return true;
            }

            // Fallback to storage
            const project = await storage.updateProject(projectId, updates);
            if (project) {
                const isDefault = storage.getDefaultProjectId() === projectId;
                jsonResponse(res, { success: true, project: { ...project, isDefault } });
            } else {
                jsonResponse(res, { error: 'Project not found' }, 404);
            }
        } catch (e) {
            console.error('[API] Error updating project:', e.message);
            jsonResponse(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/projects/:id/set-default - Set a project as the default
    if (pathname.match(/^\/api\/projects\/([^/]+)\/set-default$/) && req.method === 'POST') {
        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/set-default$/)[1];

        const project = await storage.getProject(projectId);
        if (!project) {
            jsonResponse(res, { error: 'Project not found' }, 404);
            return true;
        }

        storage.setDefaultProject(projectId);
        console.log(`[Projects] Set default project: ${project.name} (${projectId})`);
        jsonResponse(res, { success: true, defaultProjectId: projectId, project });
        return true;
    }

    // DELETE /api/projects/:id - Delete a project
    if (pathname.match(/^\/api\/projects\/([^/]+)$/) && req.method === 'DELETE') {
        const projectId = pathname.match(/^\/api\/projects\/([^/]+)$/)[1];

        // Check if this is the only project
        const projects = await storage.listProjects();
        if (projects.length <= 1) {
            jsonResponse(res, { error: 'Cannot delete the last remaining project' }, 400);
            return true;
        }

        // Get project info before deleting
        const project = await storage.getProject(projectId);

        const success = await storage.deleteProject(projectId);
        if (success) {
            // Sync with graph - remove Project from FalkorDB
            try {
                const { getGraphSync } = require('../../sync');
                const graphSync = getGraphSync({ graphProvider: storage.getGraphProvider() });
                await graphSync.onProjectDeleted(projectId, project?.name);
            } catch (syncErr) {
                console.log(`[Projects] Graph sync warning: ${syncErr.message}`);
            }

            // If we deleted the current project, processor needs new data dir
            processor.updateDataDir(storage.getProjectDataDir());
            jsonResponse(res, { success: true, graphSynced: true });
        } else {
            jsonResponse(res, { error: 'Project not found' }, 404);
        }
        return true;
    }

    // GET /api/projects/:id/export - Export a project as JSON
    if (pathname.match(/^\/api\/projects\/([^/]+)\/export$/) && req.method === 'GET') {
        const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/export$/)[1];
        const project = storage.listProjects().find(p => p.id === projectId);

        if (!project) {
            jsonResponse(res, { error: 'Project not found' }, 404);
            return true;
        }

        try {
            const projectDir = storage.getProjectDir(projectId);
            const exportData = {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                project: {
                    name: project.name,
                    userRole: project.userRole || ''
                },
                data: {}
            };

            // Read all JSON files from the project
            const jsonFiles = ['knowledge.json', 'questions.json', 'documents.json', 'history.json'];
            for (const file of jsonFiles) {
                const filePath = path.join(projectDir, file);
                if (fs.existsSync(filePath)) {
                    exportData.data[file.replace('.json', '')] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                }
            }

            // Set headers for file download
            const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.json`;
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify(exportData, null, 2));
        } catch (e) {
            console.error('Export error:', e);
            jsonResponse(res, { error: 'Export failed: ' + e.message }, 500);
        }
        return true;
    }

    // POST /api/projects/import - Import a project from JSON
    if (pathname === '/api/projects/import' && req.method === 'POST') {
        const contentType = req.headers['content-type'] || '';

        if (!contentType.includes('multipart/form-data')) {
            jsonResponse(res, { error: 'Content-Type must be multipart/form-data' }, 400);
            return true;
        }

        try {
            const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
            if (!boundaryMatch) {
                jsonResponse(res, { error: 'No boundary found' }, 400);
                return true;
            }
            const boundary = boundaryMatch[1] || boundaryMatch[2];

            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            const body = Buffer.concat(chunks);
            const parts = parseMultipart(body, boundary);

            if (parts.files.length === 0) {
                jsonResponse(res, { error: 'No file provided' }, 400);
                return true;
            }

            const fileContent = parts.files[0].data.toString('utf8');
            const importData = JSON.parse(fileContent);

            // Validate import data
            if (!importData.project || !importData.project.name) {
                jsonResponse(res, { error: 'Invalid import file: missing project name' }, 400);
                return true;
            }

            // Create new project
            const projectName = importData.project.name + ' (Imported)';
            const newProject = storage.createProject(projectName, importData.project.userRole || '');
            const projectDir = storage.getProjectDir(newProject.id);

            // Write data files
            if (importData.data) {
                for (const [key, value] of Object.entries(importData.data)) {
                    const filePath = path.join(projectDir, `${key}.json`);
                    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
                }
            }

            // Reload the project
            storage.switchProject(newProject.id);

            jsonResponse(res, { success: true, project: newProject });
        } catch (e) {
            console.error('Import error:', e);
            jsonResponse(res, { error: 'Import failed: ' + e.message }, 500);
        }
        return true;
    }

    // ==================== End Project Management API ====================

    return false;
}

module.exports = {
    handleProjectsCore,
};
