/**
 * Purpose:
 *   Team behavioral analysis API. Provides AI-driven person profiling,
 *   team dynamics analysis, relationship mapping, graph visualization,
 *   and configurable analysis settings per project.
 *
 * Responsibilities:
 *   - List and retrieve behavioral profiles for project participants
 *   - Trigger AI-powered person profile analysis (personality, sentiment, communication)
 *   - Generate team-level dynamics analysis
 *   - Map behavioral relationships between team members
 *   - Provide graph visualization data and sync analysis results to the graph
 *   - Execute graph queries (influence map, power centers, alliances, tensions, etc.)
 *   - Manage per-project analysis configuration
 *   - Admin: list all projects with analysis status, trigger analysis for any project
 *
 * Key dependencies:
 *   - ../../team-analysis (getTeamAnalyzer): person/team analysis with LLM
 *   - ../../team-analysis (getGraphSync): sync analysis results to graph and visualization
 *   - storage.supabase: direct Supabase access for projects, team_analysis tables
 *   - config: LLM configuration passed through to team analyzer
 *
 * Side effects:
 *   - Profile analysis invokes LLM and persists results to Supabase
 *   - Team dynamics analysis writes to team_analysis table
 *   - Graph sync creates/updates nodes and relationships in the graph database
 *   - Config update writes to the projects.settings JSONB column
 *
 * Notes:
 *   - All routes require an active project (projectId from storage.getCurrentProject)
 *   - Analysis can be forced (forceReanalysis) to bypass cached results
 *   - The config route maintains backward compatibility with a legacy
 *     team_analysis_enabled boolean column alongside the JSONB settings
 *   - Admin analyze endpoint allows analysis even if disabled in project settings
 *     (intentional: manual admin trigger should always work)
 *   - Query types: influence_map, power_centers, alliances, tensions, person_network,
 *     team_cohesion
 *
 * Routes:
 *   GET  /api/team-analysis/profiles                        - List all profiles
 *   GET  /api/team-analysis/profiles/:personId              - Single profile
 *   POST /api/team-analysis/profiles/:personId/analyze      - Trigger AI profile analysis
 *     Body: { relationshipContext?, objective?, forceReanalysis? }
 *   GET  /api/team-analysis/team                            - Team dynamics summary
 *   POST /api/team-analysis/team/analyze                    - Trigger team dynamics analysis
 *   GET  /api/team-analysis/relationships                   - Behavioral relationship map
 *   GET  /api/team-analysis/graph                           - Graph visualization data
 *   POST /api/team-analysis/sync-graph                      - Sync analysis to graph DB
 *   GET  /api/team-analysis/query                           - Execute graph query by type
 *     Query: ?type=influence_map|power_centers|...&personId=
 *   GET  /api/team-analysis/config                          - Get analysis configuration
 *   PUT  /api/team-analysis/config                          - Update analysis configuration
 *   GET  /api/team-analysis/admin/projects                  - List projects with analysis status
 *   POST /api/team-analysis/admin/projects/:projectId/analyze - Admin-trigger analysis
 */

const { parseBody, parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

function isTeamAnalysisRoute(pathname) {
    return pathname.startsWith('/api/team-analysis/');
}

async function handleTeamAnalysis(ctx) {
    const { req, res, pathname, storage, config } = ctx;
    const log = getLogger().child({ module: 'team-analysis' });
    if (!isTeamAnalysisRoute(pathname)) return false;

    const projectId = storage.getCurrentProject()?.id;
    const urlParsed = parseUrl(req.url);

    if (!projectId) {
        jsonResponse(res, { error: 'No project selected' }, 400);
        return true;
    }

    try {
        // GET /api/team-analysis/profiles
        if (pathname === '/api/team-analysis/profiles' && req.method === 'GET') {
            const { getTeamAnalyzer } = require('../../team-analysis');
            const teamAnalyzer = getTeamAnalyzer({ supabase: storage.supabase, config });
            const profiles = await teamAnalyzer.getProfiles(projectId);
            jsonResponse(res, { ok: true, profiles });
            return true;
        }

        // GET /api/team-analysis/profiles/:personId
        const profileMatch = pathname.match(/^\/api\/team-analysis\/profiles\/([^/]+)$/);
        if (profileMatch && req.method === 'GET') {
            const { getTeamAnalyzer } = require('../../team-analysis');
            const teamAnalyzer = getTeamAnalyzer({ supabase: storage.supabase, config });
            const profile = await teamAnalyzer.getProfile(projectId, profileMatch[1]);
            if (!profile) {
                jsonResponse(res, { error: 'Profile not found' }, 404);
                return true;
            }
            jsonResponse(res, { ok: true, profile });
            return true;
        }

        // POST /api/team-analysis/profiles/:personId/analyze
        const analyzeMatch = pathname.match(/^\/api\/team-analysis\/profiles\/([^/]+)\/analyze$/);
        if (analyzeMatch && req.method === 'POST') {
            const body = await parseBody(req);
            const { getTeamAnalyzer } = require('../../team-analysis');
            const teamAnalyzer = getTeamAnalyzer({ supabase: storage.supabase, config });
            const profile = await teamAnalyzer.analyzePersonProfile(projectId, analyzeMatch[1], {
                relationshipContext: body.relationshipContext || 'colleague',
                objective: body.objective || 'development of partnership',
                forceReanalysis: body.forceReanalysis || false
            });
            jsonResponse(res, { ok: true, profile });
            return true;
        }

        // GET /api/team-analysis/team
        if (pathname === '/api/team-analysis/team' && req.method === 'GET') {
            const { getTeamAnalyzer } = require('../../team-analysis');
            const teamAnalyzer = getTeamAnalyzer({ supabase: storage.supabase, config });
            const analysis = await teamAnalyzer.getTeamAnalysis(projectId);
            jsonResponse(res, { ok: true, analysis });
            return true;
        }

        // POST /api/team-analysis/team/analyze
        if (pathname === '/api/team-analysis/team/analyze' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getTeamAnalyzer } = require('../../team-analysis');
            const teamAnalyzer = getTeamAnalyzer({ supabase: storage.supabase, config });
            const analysis = await teamAnalyzer.analyzeTeamDynamics(projectId, {
                forceReanalysis: body.forceReanalysis || false
            });
            jsonResponse(res, { ok: true, analysis });
            return true;
        }

        // GET /api/team-analysis/relationships
        if (pathname === '/api/team-analysis/relationships' && req.method === 'GET') {
            const { getTeamAnalyzer } = require('../../team-analysis');
            const teamAnalyzer = getTeamAnalyzer({ supabase: storage.supabase, config });
            const relationships = await teamAnalyzer.getBehavioralRelationships(projectId);
            jsonResponse(res, { ok: true, relationships });
            return true;
        }

        // GET /api/team-analysis/graph
        if (pathname === '/api/team-analysis/graph' && req.method === 'GET') {
            const { getGraphSync } = require('../../team-analysis');
            const graphSync = getGraphSync({ supabase: storage.supabase });
            const graphData = await graphSync.getVisualizationData(projectId);
            jsonResponse(res, { ok: true, ...graphData });
            return true;
        }

        // POST /api/team-analysis/sync-graph
        if (pathname === '/api/team-analysis/sync-graph' && req.method === 'POST') {
            const { getGraphSync } = require('../../team-analysis');
            const graphSync = getGraphSync({ supabase: storage.supabase });
            await graphSync.fullSync(projectId);
            jsonResponse(res, { ok: true, message: 'Team analysis synced to graph' });
            return true;
        }

        // GET /api/team-analysis/query
        if (pathname === '/api/team-analysis/query' && req.method === 'GET') {
            const { getGraphSync } = require('../../team-analysis');
            const graphSync = getGraphSync({ supabase: storage.supabase });
            const queryType = urlParsed.query?.type;
            const personId = urlParsed.query?.personId;
            if (!queryType) {
                jsonResponse(res, { error: 'Query type required (influence_map, power_centers, alliances, tensions, person_network, team_cohesion)' }, 400);
                return true;
            }
            const results = await graphSync.executeQuery(queryType, { projectId, personId });
            jsonResponse(res, { ok: true, queryType, results });
            return true;
        }

        // GET /api/team-analysis/config
        if (pathname === '/api/team-analysis/config' && req.method === 'GET') {
            const { data: project } = await storage.supabase
                .from('projects')
                .select('settings, team_analysis_enabled')
                .eq('id', projectId)
                .single();

            const settings = project?.settings || {};
            const teamAnalysisConfig = settings.teamAnalysis || {
                analysisFrequency: 'weekly',
                includePersonality: true,
                includeSentiment: true,
                includeCommunication: true,
                includeCollaboration: true,
                minMeetingsForAnalysis: 3,
                sentimentThreshold: -0.3
            };

            // Backwards compatibility with the boolean column if needed, 
            // but primarily relying on settings now.

            jsonResponse(res, {
                ok: true,
                config: teamAnalysisConfig
            });
            return true;
        }

        // PUT /api/team-analysis/config
        if (pathname === '/api/team-analysis/config' && req.method === 'PUT') {
            const body = await parseBody(req);

            // Fetch current settings first to merge
            const { data: project } = await storage.supabase
                .from('projects')
                .select('settings')
                .eq('id', projectId)
                .single();

            const currentSettings = project?.settings || {};
            const newSettings = {
                ...currentSettings,
                teamAnalysis: {
                    ...currentSettings.teamAnalysis,
                    ...body // Merge new config
                }
            };

            await storage.supabase
                .from('projects')
                .update({
                    settings: newSettings,
                    // Keep the legacy column in sync just in case, active if any feature is enabled
                    team_analysis_enabled: body.includePersonality || body.includeSentiment || body.includeCommunication || body.includeCollaboration
                })
                .eq('id', projectId);

            jsonResponse(res, { ok: true, message: 'Configuration updated' });
            return true;
        }

        // GET /api/team-analysis/admin/projects
        // Returns list of all projects with their team analysis status
        if (pathname === '/api/team-analysis/admin/projects' && req.method === 'GET') {
            // Get all projects
            const { data: projects, error: projError } = await storage.supabase
                .from('projects')
                .select('id, name, created_at, team_analysis_enabled')
                .order('name');

            if (projError) throw new Error(projError.message);

            // Get all team analysis records to map timestamps
            const { data: analyses, error: analysisError } = await storage.supabase
                .from('team_analysis')
                .select('project_id, last_analysis_at');

            if (analysisError) throw new Error(analysisError.message);

            // Map analysis data to projects
            const analysisMap = new Map();
            analyses?.forEach(a => analysisMap.set(a.project_id, a.last_analysis_at));

            const result = projects.map(p => ({
                id: p.id,
                name: p.name,
                isEnabled: p.team_analysis_enabled,
                lastAnalysisAt: analysisMap.get(p.id) || null
            }));

            jsonResponse(res, { ok: true, projects: result });
            return true;
        }

        // POST /api/team-analysis/admin/projects/:projectId/analyze
        // Trigger analysis for a specific project
        const adminAnalyzeMatch = pathname.match(/^\/api\/team-analysis\/admin\/projects\/([^/]+)\/analyze$/);
        if (adminAnalyzeMatch && req.method === 'POST') {
            const targetProjectId = adminAnalyzeMatch[1];
            const body = await parseBody(req);

            const { getTeamAnalyzer } = require('../../team-analysis');
            const teamAnalyzer = getTeamAnalyzer({ supabase: storage.supabase, config });

            // Check if project exists and has team analysis enabled
            const { data: project } = await storage.supabase
                .from('projects')
                .select('team_analysis_enabled, settings')
                .eq('id', targetProjectId)
                .single();

            if (!project) {
                jsonResponse(res, { error: 'Project not found' }, 404);
                return true;
            }

            // Note: We allow analyzing even if disabled in settings, as this is an admin manual trigger

            const analysis = await teamAnalyzer.analyzeTeamDynamics(targetProjectId, {
                forceReanalysis: body.forceReanalysis || true
            });

            jsonResponse(res, { ok: true, analysis });
            return true;
        }
    } catch (error) {
        log.warn({ event: 'team_analysis_error', reason: error?.message }, 'TeamAnalysis error');
        jsonResponse(res, { ok: false, error: error.message }, 500);
        return true;
    }

    return false;
}

module.exports = { handleTeamAnalysis };
