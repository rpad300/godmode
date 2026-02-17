/**
 * Teams Routes
 * Extracted from src/server.js for modularization
 */

const { parseUrl, parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

/**
 * Handle all teams-related routes
 * @param {Object} ctx - Context object with req, res, pathname, storage
 * @returns {Promise<boolean>} - true if route was handled, false otherwise
 */
async function handleTeams(ctx) {
    const { req, res, pathname, storage } = ctx;
    const log = getLogger().child({ module: 'teams' });
    // Quick check - if not a teams route, return false immediately
    if (!pathname.startsWith('/api/teams')) {
        return false;
    }

    // POST /api/teams - Create team
    if (pathname === '/api/teams' && req.method === 'POST') {
        const body = await parseBody(req);
        
        if (!body.name) {
            jsonResponse(res, { ok: false, error: 'name is required' }, 400);
            return true;
        }
        
        try {
            const id = await storage.addTeam(body);
            
            // Sync with graph - create Team node
            let graphSynced = false;
            try {
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    await graphProvider.query(
                        `MERGE (t:Team {id: $id})
                         SET t.name = $name,
                             t.description = $description,
                             t.color = $color,
                             t.team_type = $team_type,
                             t.created_at = datetime(),
                             t.entity_type = 'Team'`,
                        { 
                            id: id,
                            name: body.name,
                            description: body.description || '',
                            color: body.color || '#3b82f6',
                            team_type: body.team_type || 'team'
                        }
                    );
                    graphSynced = true;
                    log.debug({ event: 'teams_graph_synced', teamName: body.name }, 'Synced to graph');
                }
            } catch (syncErr) {
                log.warn({ event: 'teams_graph_sync_warning', reason: syncErr.message }, 'Graph sync warning');
            }
            
            jsonResponse(res, { ok: true, id, graphSynced });
        } catch (error) {
            // Return 400 for duplicate name errors
            const status = error.message?.includes('already exists') ? 400 : 500;
            jsonResponse(res, { ok: false, error: error.message }, status);
        }
        return true;
    }

    // GET /api/teams - List teams
    if (pathname === '/api/teams' && req.method === 'GET') {
        try {
            const teams = await storage.getTeams();
            // Add member count to each team (from members array or team_members)
            const teamsWithCounts = teams.map(t => ({
                ...t,
                memberCount: t.members?.length || 0,
                // Include member details for UI
                memberDetails: (t.members || []).map(m => ({
                    contactId: m.contact_id || m.contactId,
                    name: m.contact?.name || m.name,
                    role: m.role,
                    isLead: m.is_lead
                }))
            }));
            jsonResponse(res, { ok: true, teams: teamsWithCounts });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/teams/:id - Get team with members
    const teamGetMatch = pathname.match(/^\/api\/teams\/([a-f0-9\-]+)$/);
    if (teamGetMatch && req.method === 'GET') {
        const teamId = teamGetMatch[1];
        try {
            const team = await storage.getTeamById(teamId);
            if (!team) {
                jsonResponse(res, { ok: false, error: 'Team not found' }, 404);
                return true;
            }
            const members = storage.getContactsByTeam(teamId);
            jsonResponse(res, { ok: true, team, members });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // PUT /api/teams/:id - Update team
    const teamPutMatch = pathname.match(/^\/api\/teams\/([a-f0-9\-]+)$/);
    if (teamPutMatch && req.method === 'PUT') {
        const teamId = teamPutMatch[1];
        const body = await parseBody(req);
        
        try {
            const success = await storage.updateTeam(teamId, body);
            if (!success) {
                jsonResponse(res, { ok: false, error: 'Team not found' }, 404);
                return true;
            }
            
            // Sync with graph - update Team node
            let graphSynced = false;
            try {
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    const updates = [];
                    const params = { id: teamId };
                    if (body.name) { updates.push('t.name = $name'); params.name = body.name; }
                    if (body.description !== undefined) { updates.push('t.description = $description'); params.description = body.description; }
                    if (body.color) { updates.push('t.color = $color'); params.color = body.color; }
                    if (body.team_type) { updates.push('t.team_type = $team_type'); params.team_type = body.team_type; }
                    
                    if (updates.length > 0) {
                        await graphProvider.query(
                            `MATCH (t:Team {id: $id}) SET ${updates.join(', ')}, t.updated_at = datetime()`,
                            params
                        );
                        graphSynced = true;
                    }
                }
            } catch (syncErr) {
                log.warn({ event: 'teams_graph_sync_warning', reason: syncErr.message }, 'Graph sync warning');
            }
            
            jsonResponse(res, { ok: true, graphSynced });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // DELETE /api/teams/:id - Delete team
    const teamDeleteMatch = pathname.match(/^\/api\/teams\/([a-f0-9\-]+)$/);
    if (teamDeleteMatch && req.method === 'DELETE') {
        const teamId = teamDeleteMatch[1];
        
        try {
            // Get team info before deleting
            const team = await storage.getTeam(teamId);
            
            const success = await storage.deleteTeam(teamId);
            if (!success) {
                jsonResponse(res, { ok: false, error: 'Team not found' }, 404);
                return true;
            }
            
            // Sync with graph - remove Team from graph
            try {
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    await graphProvider.query(
                        'MATCH (t:Team) WHERE t.id = $id OR t.name = $name DETACH DELETE t',
                        { id: teamId, name: team?.name }
                    );
                }
            } catch (syncErr) {
                log.warn({ event: 'teams_graph_sync_warning', reason: syncErr.message }, 'Graph sync warning');
            }
            
            jsonResponse(res, { ok: true, graphSynced: true });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/teams/:id/members - Add member to team
    const teamAddMemberMatch = pathname.match(/^\/api\/teams\/([a-f0-9\-]+)\/members$/);
    if (teamAddMemberMatch && req.method === 'POST') {
        const teamId = teamAddMemberMatch[1];
        const body = await parseBody(req);
        
        if (!body.contactId) {
            jsonResponse(res, { ok: false, error: 'contactId is required' }, 400);
            return true;
        }
        
        try {
            const result = await storage.addTeamMember(teamId, body.contactId, body.role, body.isLead);
            
            // Sync with graph - create MEMBER_OF relationship
            let graphSynced = false;
            try {
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    // Get team and contact info for graph
                    const team = await storage.getTeamById(teamId);
                    const contact = storage.getContactById(body.contactId);
                    
                    // Create or update Contact node and MEMBER_OF relationship
                    await graphProvider.query(
                        `MERGE (c:Contact {id: $contactId})
                         SET c.name = $contactName, c.entity_type = 'Contact'
                         WITH c
                         MATCH (t:Team {id: $teamId})
                         MERGE (c)-[r:MEMBER_OF]->(t)
                         SET r.role = $role, r.is_lead = $isLead, r.created_at = datetime()`,
                        {
                            contactId: body.contactId,
                            contactName: contact?.name || 'Unknown',
                            teamId: teamId,
                            role: body.role || null,
                            isLead: body.isLead || false
                        }
                    );
                    graphSynced = true;
                    log.debug({ event: 'teams_member_added', contactName: contact?.name, teamName: team?.name }, 'Member added to team in graph');
                }
            } catch (syncErr) {
                log.warn({ event: 'teams_graph_sync_warning', reason: syncErr.message }, 'Graph sync warning');
            }
            
            jsonResponse(res, { ok: true, member: result, graphSynced });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // DELETE /api/teams/:teamId/members/:contactId - Remove member from team
    const teamRemoveMemberMatch = pathname.match(/^\/api\/teams\/([a-f0-9\-]+)\/members\/([a-f0-9\-]+)$/);
    if (teamRemoveMemberMatch && req.method === 'DELETE') {
        const teamId = teamRemoveMemberMatch[1];
        const contactId = teamRemoveMemberMatch[2];
        
        try {
            await storage.removeTeamMember(teamId, contactId);
            
            // Sync with graph - remove MEMBER_OF relationship
            let graphSynced = false;
            try {
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    await graphProvider.query(
                        `MATCH (c:Contact {id: $contactId})-[r:MEMBER_OF]->(t:Team {id: $teamId})
                         DELETE r`,
                        { contactId, teamId }
                    );
                    graphSynced = true;
                    log.debug({ event: 'teams_member_removed' }, 'Member removed from team in graph');
                }
            } catch (syncErr) {
                log.warn({ event: 'teams_graph_sync_warning', reason: syncErr.message }, 'Graph sync warning');
            }
            
            jsonResponse(res, { ok: true, graphSynced });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/teams/:id/members - Get team members
    const teamGetMembersMatch = pathname.match(/^\/api\/teams\/([a-f0-9\-]+)\/members$/);
    if (teamGetMembersMatch && req.method === 'GET') {
        const teamId = teamGetMembersMatch[1];
        
        try {
            const members = await storage.getTeamMembers(teamId);
            jsonResponse(res, { ok: true, members, total: members.length });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // Route not handled by this module
    return false;
}

module.exports = { handleTeams };
