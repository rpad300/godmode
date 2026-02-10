/**
 * Team Analysis API
 * Extracted from server.js
 *
 * Handles: /api/team-analysis/profiles, team, relationships, graph,
 * sync-graph, query, config
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
                .select('team_analysis_access, team_analysis_enabled')
                .eq('id', projectId)
                .single();
            jsonResponse(res, {
                ok: true,
                config: {
                    enabled: project?.team_analysis_enabled ?? true,
                    access: project?.team_analysis_access ?? 'admin_only'
                }
            });
            return true;
        }

        // PUT /api/team-analysis/config
        if (pathname === '/api/team-analysis/config' && req.method === 'PUT') {
            const body = await parseBody(req);
            await storage.supabase
                .from('projects')
                .update({
                    team_analysis_enabled: body.enabled,
                    team_analysis_access: body.access
                })
                .eq('id', projectId);
            jsonResponse(res, { ok: true, message: 'Configuration updated' });
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
