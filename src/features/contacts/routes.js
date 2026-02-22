/**
 * Purpose:
 *   Contact management API routes. Provides full CRUD, relationship management,
 *   team membership, project associations, participant linking, deduplication,
 *   import/export, and AI-powered contact enrichment.
 *
 * Responsibilities:
 *   - Contact CRUD: create, read (single + list with filters), update, delete
 *   - List contacts enriched with team memberships (N:N) from all teams
 *   - Contact roles list and creation
 *   - Companies metadata endpoint for dropdowns (uses admin client to bypass RLS)
 *   - Participant-to-contact linking and unlinking (alias management)
 *   - Unmatched participant discovery and name-based contact matching
 *   - Duplicate contact detection and merge
 *   - Import/export in JSON and CSV formats
 *   - Contact relationships CRUD (directional, typed relationships between contacts)
 *   - Contact mentions aggregation from documents/emails
 *   - Full association view (all teams + all projects for a contact)
 *   - Team membership management (add/remove contact from teams)
 *   - Project association sync and management
 *   - Contact activity feed
 *   - AI enrichment: LLM-powered suggestions for role, department, tags, notes
 *
 * Key dependencies:
 *   - storage: Contact data access layer with Supabase and local fallbacks
 *   - ../../sync (getGraphSync): Graph database sync for contact/team/alias changes
 *   - ../../llm/config: LLM provider resolution for AI enrichment
 *   - llm: Text generation for enrichment suggestions
 *
 * Side effects:
 *   - Database: creates/updates/deletes contacts, relationships, team memberships,
 *     project associations, and aliases in Supabase
 *   - Graph DB: syncs Contact nodes, MEMBER_OF edges, ALIAS_OF edges, and
 *     typed relationship edges on every mutation
 *   - LLM API: calls text generation for contact enrichment
 *
 * Notes:
 *   - Project context is resolved from X-Project-Id header or request body
 *   - Team enrichment on GET /api/contacts finds ALL teams per contact (not just primary)
 *   - Graph sync uses Cypher MERGE to be idempotent; failures are logged but non-blocking
 *   - The merge endpoint requires at least 2 contact IDs
 *   - Relationship type is used directly in Cypher edge labels (uppercased, spaces to underscores)
 */

const { parseUrl, parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { logError } = require('../../logger');
const { jsonResponse } = require('../../server/response');
const llmRouter = require('../../llm/router');

/**
 * Handle all contacts-related routes
 * @param {Object} ctx - Context object with req, res, pathname, storage, llm
 * @returns {Promise<boolean>} - true if route was handled, false otherwise
 */
async function handleContacts(ctx) {
    const { req, res, pathname, storage, supabase, config } = ctx;
    const log = getLogger().child({ module: 'contacts' });

    // Quick check - if not a contacts route, return false immediately
    if (!pathname.startsWith('/api/contacts')) {
        return false;
    }

    // GET /api/contacts/roles - Get all unique contact roles
    if (pathname === '/api/contacts/roles' && req.method === 'GET') {
        try {
            const projectId = req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);

            const roles = await storage.getContactRoles();
            jsonResponse(res, { ok: true, roles });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts/roles - Add a new role
    if (pathname === '/api/contacts/roles' && req.method === 'POST') {
        const body = await parseBody(req);
        const projectId = body?.project_id || req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        try {
            if (storage._supabase && typeof storage._supabase.addRole === 'function') {
                const role = await storage._supabase.addRole(body.name);
                jsonResponse(res, { ok: true, role: role || { id: body.name, name: body.name } });
            } else {
                jsonResponse(res, { ok: true, role: { id: body.name, name: body.name } });
            }
        } catch (error) {
            jsonResponse(res, { ok: true, role: { id: body.name, name: body.name } });
        }
        return true;
    }

    // GET /api/contacts/metadata/companies - Get companies for dropdown (using admin client to bypass RLS)
    if (pathname === '/api/contacts/metadata/companies' && req.method === 'GET') {
        try {
            let companies = [];
            // Use admin client if available to ensure we get the list regardless of restrictive RLS
            // This is safe because it's just a name/id list for a dropdown
            if (supabase && supabase.isConfigured()) {
                const client = supabase.getAdminClient();
                const { data, error } = await client
                    .from('companies')
                    .select('id, name, logo_url')
                    .order('name');
                if (!error) {
                    companies = data;
                }
            } else {
                // Fallback to storage method (might return empty if auth fails)
                companies = await storage.getCompanies();
            }
            jsonResponse(res, { ok: true, companies });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts - Create contact
    if (pathname === '/api/contacts' && req.method === 'POST') {
        const body = await parseBody(req);
        const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        if (!body.name || typeof body.name !== 'string') {
            jsonResponse(res, { ok: false, error: 'name is required' }, 400);
            return true;
        }

        try {
            const result = await storage.addContact(body);
            const contactId = result?.id || result;
            log.debug({ event: 'contacts_added', name: body.name, contactId }, 'Added contact');
            // Sync with graph
            let graphSynced = false;
            try {
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    const { getGraphSync } = require('../../sync');
                    const graphSync = getGraphSync({ graphProvider, storage });
                    await graphSync.syncContact({ id: contactId, ...body });
                    graphSynced = true;
                }
            } catch (syncErr) {
                log.warn({ event: 'contacts_graph_sync_warning', reason: syncErr.message }, 'Graph sync warning');
            }

            jsonResponse(res, {
                ok: true,
                id: contactId,
                contact: { id: contactId, name: body.name },
                graphSynced
            });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/contacts - List contacts
    if (pathname === '/api/contacts' && req.method === 'GET') {
        try {
            const parsedUrl = parseUrl(req.url);
            const projectId = parsedUrl.query?.project_id || req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);

            const filter = {};
            if (parsedUrl.query.organization) filter.organization = parsedUrl.query.organization;
            if (parsedUrl.query.tag) filter.tag = parsedUrl.query.tag;
            if (parsedUrl.query.search) filter.search = parsedUrl.query.search;

            const contacts = await storage.getContacts(Object.keys(filter).length > 0 ? filter : null);

            // Enrich contacts with ALL team memberships (N:N)
            const allTeams = await storage.getTeams() || [];
            const enrichedContacts = contacts.map(c => {
                // Find ALL teams this contact belongs to
                const memberTeams = allTeams.filter(t =>
                    t.members?.some(m =>
                        m.contact?.id === c.id ||
                        m.contactId === c.id ||
                        m.contact_id === c.id
                    )
                ).map(t => ({
                    id: t.id,
                    name: t.name,
                    color: t.color || 'var(--accent)'
                }));

                // Primary team (first one) for backwards compatibility
                const primaryTeam = memberTeams[0] || null;

                return {
                    ...c,
                    teams: memberTeams, // Array of all teams
                    teamId: primaryTeam?.id || c.teamId || null,
                    teamName: primaryTeam?.name || null,
                    teamColor: primaryTeam?.color || null
                };
            });

            jsonResponse(res, { ok: true, contacts: enrichedContacts, total: enrichedContacts.length });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/contacts/stats - Get contact statistics
    if (pathname === '/api/contacts/stats' && req.method === 'GET') {
        try {
            const projectId = req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);

            const stats = storage.getContactStats();
            jsonResponse(res, { ok: true, ...stats });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/contacts/:id - Get single contact
    const contactGetMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)$/);
    if (contactGetMatch && req.method === 'GET') {
        const contactId = contactGetMatch[1];
        const projectId = req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        try {
            const contact = storage.getContactById(contactId);
            if (!contact) {
                jsonResponse(res, { ok: false, error: 'Contact not found' }, 404);
                return true;
            }
            jsonResponse(res, { ok: true, contact });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // PUT /api/contacts/:id - Update contact
    const contactPutMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)$/);
    if (contactPutMatch && req.method === 'PUT') {
        const contactId = contactPutMatch[1];
        const body = await parseBody(req);
        const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        try {
            // Get current contact to check team changes
            const currentContact = storage.getContactById(contactId);
            const oldTeamId = currentContact?.teamId;
            const newTeamId = body.teamId;

            const success = await storage.updateContact(contactId, body);
            if (!success) {
                jsonResponse(res, { ok: false, error: 'Contact not found' }, 404);
                return true;
            }

            // Handle team membership changes
            if (oldTeamId !== newTeamId) {
                // Remove from old team
                if (oldTeamId) {
                    try {
                        await storage.removeTeamMember(oldTeamId, contactId);
                    } catch (e) {
                        log.debug({ event: 'contacts_team_remove_failed', reason: e.message }, 'Could not remove from old team');
                    }
                }
                // Add to new team
                if (newTeamId) {
                    try {
                        await storage.addTeamMember(newTeamId, contactId);
                    } catch (e) {
                        log.debug({ event: 'contacts_team_add_failed', reason: e.message }, 'Could not add to new team');
                    }
                }
            }
            // Sync with graph
            let graphSynced = false;
            try {
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    await graphProvider.query(
                        `MERGE (c:Contact {id: $id})
                         SET c.name = $name, c.email = $email, c.role = $role,
                             c.organization = $organization, c.timezone = $timezone,
                             c.entity_type = 'Contact', c.updated_at = datetime()`,
                        {
                            id: contactId,
                            name: body.name || currentContact?.name,
                            email: body.email || null,
                            role: body.role || null,
                            organization: body.organization || null,
                            timezone: body.timezone || null
                        }
                    );

                    // Update team relationship
                    if (newTeamId) {
                        await graphProvider.query(
                            `MATCH (c:Contact {id: $contactId})
                             OPTIONAL MATCH (c)-[r:MEMBER_OF]->(:Team)
                             DELETE r
                             WITH c
                             MATCH (t:Team {id: $teamId})
                             MERGE (c)-[:MEMBER_OF]->(t)`,
                            { contactId, teamId: newTeamId }
                        );
                    } else if (oldTeamId) {
                        // Remove team relationship
                        await graphProvider.query(
                            `MATCH (c:Contact {id: $contactId})-[r:MEMBER_OF]->(:Team)
                             DELETE r`,
                            { contactId }
                        );
                    }
                    graphSynced = true;
                }
            } catch (syncErr) {
                log.warn({ event: 'contacts_graph_sync_warning', reason: syncErr.message }, 'Graph sync warning');
            }

            jsonResponse(res, { ok: true, message: 'Contact updated', graphSynced });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // DELETE /api/contacts/:id - Delete contact
    const contactDeleteMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)$/);
    if (contactDeleteMatch && req.method === 'DELETE') {
        const contactId = contactDeleteMatch[1];
        const projectId = req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        try {
            // Get contact info before deleting
            const contact = storage.getContact(contactId);

            const success = storage.deleteContact(contactId);
            if (!success) {
                jsonResponse(res, { ok: false, error: 'Contact not found' }, 404);
                return true;
            }

            // Sync with graph - remove from graph
            try {
                const { getGraphSync } = require('../../sync');
                const graphSync = getGraphSync({ graphProvider: storage.getGraphProvider() });
                await graphSync.onContactDeleted(contactId, contact?.name, contact?.email);
            } catch (syncErr) {
                log.warn({ event: 'contacts_graph_sync_warning', reason: syncErr.message }, 'Graph sync warning');
            }

            log.debug({ event: 'contacts_deleted', contactId }, 'Deleted contact');
            jsonResponse(res, { ok: true, message: 'Contact deleted', graphSynced: true });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts/match - Match names to contacts
    if (pathname === '/api/contacts/match' && req.method === 'POST') {
        const body = await parseBody(req);
        const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        const { names } = body;

        if (!names || !Array.isArray(names)) {
            jsonResponse(res, { ok: false, error: 'names array is required' }, 400);
            return true;
        }

        try {
            const matches = names.map(name => {
                const contact = storage.findContactByName(name);
                return {
                    name,
                    matched: !!contact,
                    contact: contact ? {
                        id: contact.id,
                        name: contact.name,
                        role: contact.role,
                        organization: contact.organization
                    } : null
                };
            });

            jsonResponse(res, {
                ok: true,
                matches,
                matchedCount: matches.filter(m => m.matched).length,
                unmatchedCount: matches.filter(m => !m.matched).length
            });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/contacts/unmatched - Get unmatched participants
    if (pathname === '/api/contacts/unmatched' && req.method === 'GET') {
        try {
            const projectId = req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);

            const unmatched = storage.getUnmatchedParticipants();
            jsonResponse(res, { ok: true, unmatched, total: unmatched.length });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts/link-participant - Link a participant to an existing contact
    if (pathname === '/api/contacts/link-participant' && req.method === 'POST') {
        const body = await parseBody(req);
        const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        log.debug({ event: 'contacts_link_participant', participantName: body?.participantName, contactId: body?.contactId, projectId }, 'link-participant');
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        if (!body.participantName || !body.contactId) {
            jsonResponse(res, { ok: false, error: 'participantName and contactId are required' }, 400);
            return true;
        }

        try {
            const result = await storage.linkParticipantToContact(body.participantName, body.contactId);

            // Sync with graph - create alias relationship
            if (result.linked) {
                try {
                    const graphProvider = storage.getGraphProvider();
                    if (graphProvider && graphProvider.connected) {
                        await graphProvider.query(
                            `MERGE (p:Person {name: $participantName})
                             WITH p
                             MATCH (c:Contact {id: $contactId})
                             MERGE (p)-[:ALIAS_OF]->(c)
                             SET p.linked_contact_id = $contactId`,
                            { participantName: body.participantName, contactId: body.contactId }
                        );
                    }
                } catch (syncErr) {
                    log.warn({ event: 'contacts_graph_sync_warning', reason: syncErr.message }, 'Graph sync warning');
                }
            }

            jsonResponse(res, { ok: true, ...result });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts/unlink-participant - Unlink a participant from a contact
    if (pathname === '/api/contacts/unlink-participant' && req.method === 'POST') {
        const body = await parseBody(req);
        const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        if (!body.participantName) {
            jsonResponse(res, { ok: false, error: 'participantName is required' }, 400);
            return true;
        }

        try {
            // Remove alias from contact if exists
            const result = await storage.unlinkParticipant(body.participantName);

            // Sync with graph - remove alias relationship
            if (result.unlinked) {
                try {
                    const graphProvider = storage.getGraphProvider();
                    if (graphProvider && graphProvider.connected) {
                        await graphProvider.query(
                            `MATCH (p:Person {name: $participantName})-[r:ALIAS_OF]->(c:Contact)
                             DELETE r
                             SET p.linked_contact_id = null`,
                            { participantName: body.participantName }
                        );
                    }
                } catch (syncErr) {
                    log.warn({ event: 'contacts_graph_sync_warning', reason: syncErr.message }, 'Graph sync warning');
                }
            }

            jsonResponse(res, { ok: true, ...result });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/contacts/find-by-name - Find contact by name or alias (for auto-matching)
    if (pathname === '/api/contacts/find-by-name' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const projectId = parsedUrl.query?.project_id || req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        const name = parsedUrl.query.name;

        if (!name) {
            jsonResponse(res, { ok: false, error: 'name query parameter is required' }, 400);
            return true;
        }

        try {
            const contact = storage.findContactByNameOrAlias(name);
            jsonResponse(res, { ok: true, found: !!contact, contact });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/contacts/duplicates - Find duplicate contacts
    if (pathname === '/api/contacts/duplicates' && req.method === 'GET') {
        try {
            const projectId = req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);

            const duplicates = await storage.findDuplicateContacts();
            jsonResponse(res, { ok: true, duplicates, groups: duplicates.length });
        } catch (error) {
            log.warn({ event: 'contacts_find_duplicates_error', reason: error?.message }, 'Find duplicates error');
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts/sync-from-people - Sync extracted people to contacts
    if (pathname === '/api/contacts/sync-from-people' && req.method === 'POST') {
        try {
            const projectId = req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);

            const result = await storage.syncPeopleToContacts();
            log.debug({ event: 'contacts_synced_people', added: result?.added }, 'Synced people to contacts');
            jsonResponse(res, { ok: true, ...result });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts/merge - Merge duplicate contacts
    if (pathname === '/api/contacts/merge' && req.method === 'POST') {
        const body = await parseBody(req);
        const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        const { contactIds } = body;

        if (!contactIds || !Array.isArray(contactIds) || contactIds.length < 2) {
            jsonResponse(res, { ok: false, error: 'At least 2 contact IDs required' }, 400);
            return true;
        }

        try {
            const mergedId = await storage.mergeContacts(contactIds);
            if (!mergedId) {
                jsonResponse(res, { ok: false, error: 'Failed to merge contacts' }, 400);
                return true;
            }
            jsonResponse(res, { ok: true, mergedId });
        } catch (error) {
            logError(error, { event: 'contacts_merge_error' });
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/contacts/export/json - Export contacts as JSON
    if (pathname === '/api/contacts/export/json' && req.method === 'GET') {
        try {
            const projectId = req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);

            const data = storage.exportContactsJSON();
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename="contacts.json"'
            });
            res.end(JSON.stringify(data, null, 2));
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/contacts/export/csv - Export contacts as CSV
    if (pathname === '/api/contacts/export/csv' && req.method === 'GET') {
        try {
            const projectId = req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);

            const csv = storage.exportContactsCSV();
            res.writeHead(200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="contacts.csv"'
            });
            res.end(csv);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts/import/json - Import contacts from JSON
    if (pathname === '/api/contacts/import/json' && req.method === 'POST') {
        const body = await parseBody(req);
        const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        try {
            const result = await storage.importContactsJSON(body);
            jsonResponse(res, { ok: true, ...result });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts/import/csv - Import contacts from CSV
    if (pathname === '/api/contacts/import/csv' && req.method === 'POST') {
        const body = await parseBody(req);
        const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        if (!body.csv || typeof body.csv !== 'string') {
            jsonResponse(res, { ok: false, error: 'csv content is required' }, 400);
            return true;
        }

        try {
            const result = await storage.importContactsCSV(body.csv);
            jsonResponse(res, { ok: true, ...result });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/contacts/:id/relationships - Get contact relationships
    const contactRelMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/relationships$/);
    if (contactRelMatch && req.method === 'GET') {
        const contactId = contactRelMatch[1];
        const projectId = req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        try {
            const relationships = await storage.getContactRelationships(contactId);
            jsonResponse(res, { ok: true, relationships });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts/:id/relationships - Add relationship
    const contactAddRelMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/relationships$/);
    if (contactAddRelMatch && req.method === 'POST') {
        const contactId = contactAddRelMatch[1];
        const body = await parseBody(req);
        const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        if (!body.toContactId || !body.type) {
            jsonResponse(res, { ok: false, error: 'toContactId and type are required' }, 400);
            return true;
        }

        try {
            const relationship = await storage.addContactRelationship(contactId, body.toContactId, body.type, {
                strength: body.strength,
                notes: body.notes
            });
            jsonResponse(res, { ok: true, relationship });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // DELETE /api/contacts/:id/relationships - Remove relationship
    const contactDelRelMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/relationships$/);
    if (contactDelRelMatch && req.method === 'DELETE') {
        const contactId = contactDelRelMatch[1];
        const body = await parseBody(req);
        const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        if (!body.toContactId || !body.type) {
            jsonResponse(res, { ok: false, error: 'toContactId and type are required' }, 400);
            return true;
        }

        try {
            storage.removeContactRelationship(contactId, body.toContactId, body.type);

            // Sync with graph - remove relationship edge from graph
            try {
                const contact1 = storage.getContact(contactId);
                const contact2 = storage.getContact(body.toContactId);
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected && contact1 && contact2) {
                    await graphProvider.query(
                        `MATCH (a:Person {name: $name1})-[r:${body.type.toUpperCase().replace(/\s+/g, '_')}]->(b:Person {name: $name2}) DELETE r`,
                        { name1: contact1.name, name2: contact2.name }
                    );
                }
            } catch (syncErr) {
                log.warn({ event: 'contacts_graph_sync_relationship_warning', reason: syncErr.message }, 'Graph sync relationship warning');
            }

            jsonResponse(res, { ok: true, graphSynced: true });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/contacts/:id/mentions - Get contact mentions
    const contactMentionsMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/mentions$/);
    if (contactMentionsMatch && req.method === 'GET') {
        const contactId = contactMentionsMatch[1];
        const projectId = req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        try {
            const mentions = await storage.getContactMentions(contactId);
            jsonResponse(res, { ok: true, mentions });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/contacts/:id/associations - Get contact with all teams and projects
    const contactAssocMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/associations$/);
    if (contactAssocMatch && req.method === 'GET') {
        const contactId = contactAssocMatch[1];
        const projectId = req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        try {
            const contactWithAssoc = await storage.getContactWithAssociations(contactId);
            if (!contactWithAssoc) {
                jsonResponse(res, { ok: false, error: 'Contact not found' }, 404);
                return true;
            }
            jsonResponse(res, { ok: true, contact: contactWithAssoc });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts/:id/teams - Add contact to a team
    const contactAddTeamMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/teams$/);
    if (contactAddTeamMatch && req.method === 'POST') {
        const contactId = contactAddTeamMatch[1];
        const body = await parseBody(req);
        const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        if (!body.teamId) {
            jsonResponse(res, { ok: false, error: 'teamId is required' }, 400);
            return true;
        }

        try {
            await storage.addTeamMember(body.teamId, contactId, body.role, body.isLead);

            // Sync with graph
            const graphProvider = storage.getGraphProvider();
            if (graphProvider && graphProvider.connected) {
                try {
                    await graphProvider.query(
                        `MATCH (c:Contact {id: $contactId}), (t:Team {id: $teamId})
                         MERGE (c)-[:MEMBER_OF]->(t)`,
                        { contactId, teamId: body.teamId }
                    );
                } catch (e) {
                    log.warn({ event: 'contacts_graph_sync_warning', reason: e.message }, 'Graph sync warning');
                }
            }
            jsonResponse(res, { ok: true });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // DELETE /api/contacts/:id/teams/:teamId - Remove contact from a team
    const contactDelTeamMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/teams\/([a-f0-9\-]+)$/);
    if (contactDelTeamMatch && req.method === 'DELETE') {
        const contactId = contactDelTeamMatch[1];
        const teamId = contactDelTeamMatch[2];
        const projectId = req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        try {
            await storage.removeTeamMember(teamId, contactId);

            // Sync with graph
            const graphProvider = storage.getGraphProvider();
            if (graphProvider && graphProvider.connected) {
                try {
                    await graphProvider.query(
                        `MATCH (c:Contact {id: $contactId})-[r:MEMBER_OF]->(t:Team {id: $teamId})
                         DELETE r`,
                        { contactId, teamId }
                    );
                } catch (e) {
                    log.warn({ event: 'contacts_graph_sync_warning', reason: e.message }, 'Graph sync warning');
                }
            }

            jsonResponse(res, { ok: true });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/contacts/:id/projects - Get contact's projects
    const contactGetProjMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/projects$/);
    if (contactGetProjMatch && req.method === 'GET') {
        const contactId = contactGetProjMatch[1];
        const projectId = req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        try {
            const rawProjects = await storage.getContactProjects(contactId);
            const projects = (rawProjects || []).map(cp => ({
                id: cp.project_id || cp.id,
                name: cp.projects?.name || cp.name || 'Unknown',
                role: cp.role,
                is_primary: cp.is_primary
            }));
            jsonResponse(res, { ok: true, projects });
        } catch (error) {
            log.warn({ event: 'contacts_get_projects_error', reason: error?.message }, 'Get projects error');
            jsonResponse(res, { ok: true, projects: [] });
        }
        return true;
    }

    // GET /api/contacts/:id/activity - Get contact's activity
    const contactGetActivityMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/activity$/);
    if (contactGetActivityMatch && req.method === 'GET') {
        const contactId = contactGetActivityMatch[1];
        const projectId = req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        try {
            const activities = await storage.getContactActivity(contactId);
            jsonResponse(res, { ok: true, activities: activities || [] });
        } catch (error) {
            log.warn({ event: 'contacts_get_activity_error', reason: error?.message }, 'Get activity error');
            jsonResponse(res, { ok: true, activities: [] });
        }
        return true;
    }

    // POST /api/contacts/:id/projects/sync - Sync contact project associations
    const contactSyncProjMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/projects\/sync$/);
    if (contactSyncProjMatch && req.method === 'POST') {
        const contactId = contactSyncProjMatch[1];
        const body = await parseBody(req);
        const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        if (projectId && storage._supabase) storage._supabase.setProject(projectId);

        const projectIds = body.projectIds || [];

        try {
            const currentProjects = await storage.getContactProjects(contactId);
            const currentIds = new Set((currentProjects || []).map(p => p.project_id || p.id));
            const newIds = new Set(projectIds);

            const toRemove = [...currentIds].filter(id => !newIds.has(id));
            const toAdd = [...newIds].filter(id => !currentIds.has(id));

            for (const rid of toRemove) {
                try { await storage.removeContactFromProject(contactId, rid); } catch (e) {
                    log.warn({ event: 'contacts_remove_project_error', reason: e?.message }, 'Error removing project');
                }
            }

            for (const aid of toAdd) {
                try { await storage.addContactToProject(contactId, aid, { isPrimary: toAdd.indexOf(aid) === 0 && currentIds.size === 0 }); } catch (e) {
                    log.warn({ event: 'contacts_add_project_error', reason: e?.message }, 'Error adding project');
                }
            }

            log.debug({ event: 'contacts_sync_projects', contactId, removed: toRemove.length, added: toAdd.length }, 'Synced projects for contact');
            jsonResponse(res, { ok: true, removed: toRemove.length, added: toAdd.length });
        } catch (error) {
            log.warn({ event: 'contacts_sync_projects_error', reason: error?.message }, 'Sync projects error');
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts/:id/projects - Add contact to a project
    const contactAddProjMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/projects$/);
    if (contactAddProjMatch && req.method === 'POST') {
        const contactId = contactAddProjMatch[1];
        const body = await parseBody(req);
        const currentProjectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
        if (currentProjectId && storage._supabase) storage._supabase.setProject(currentProjectId);

        if (!body.projectId) {
            jsonResponse(res, { ok: false, error: 'projectId is required' }, 400);
            return true;
        }

        try {
            await storage.addContactToProject(contactId, body.projectId, {
                role: body.role,
                isPrimary: body.isPrimary
            });
            jsonResponse(res, { ok: true });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // DELETE /api/contacts/:id/projects/:projectId - Remove contact from a project
    const contactDelProjMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/projects\/([a-f0-9\-]+)$/);
    if (contactDelProjMatch && req.method === 'DELETE') {
        const contactId = contactDelProjMatch[1];
        const projectId = contactDelProjMatch[2];
        const currentProjectId = req.headers['x-project-id'];
        if (currentProjectId && storage._supabase) storage._supabase.setProject(currentProjectId);

        try {
            await storage.removeContactFromProject(contactId, projectId);
            jsonResponse(res, { ok: true });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts/:id/enrich - AI enrichment for contact
    const contactEnrichMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/enrich$/);
    if (contactEnrichMatch && req.method === 'POST') {
        const contactId = contactEnrichMatch[1];

        try {
            const contact = storage.getContactById(contactId);
            if (!contact) {
                jsonResponse(res, { ok: false, error: 'Contact not found' }, 404);
                return true;
            }

            // Get context from activity
            const activityContext = (contact.activity || [])
                .slice(0, 10)
                .map(a => `${a.type}: ${a.title}`)
                .join('\n');

            const prompt = `Based on the following information about a contact and their activities, suggest any additional details I should add to complete their profile.

Contact:
- Name: ${contact.name}
- Email: ${contact.email || 'Unknown'}
- Role: ${contact.role || 'Unknown'}
- Organization: ${contact.organization || 'Unknown'}
- Department: ${contact.department || 'Unknown'}
- Notes: ${contact.notes || 'None'}

Recent activity:
${activityContext || 'No activity recorded'}

Provide suggestions in this format:
ROLE_SUGGESTION: <suggested role if unknown>
DEPARTMENT_SUGGESTION: <suggested department if unknown>
TAGS_SUGGESTION: <comma-separated suggested tags>
NOTES_SUGGESTION: <additional notes to add>`;

            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                prompt,
                temperature: 0.3,
                maxTokens: 1024,
                context: 'contacts-enrich'
            }, config);
            const aiResponse = routerResult.success ? (routerResult.result?.text || '') : '';

            // Parse suggestions
            const suggestions = {};
            const roleMatch = aiResponse.match(/ROLE_SUGGESTION:\s*(.+)/);
            const deptMatch = aiResponse.match(/DEPARTMENT_SUGGESTION:\s*(.+)/);
            const tagsMatch = aiResponse.match(/TAGS_SUGGESTION:\s*(.+)/);
            const notesMatch = aiResponse.match(/NOTES_SUGGESTION:\s*(.+)/);

            if (roleMatch && !contact.role) suggestions.role = roleMatch[1].trim();
            if (deptMatch && !contact.department) suggestions.department = deptMatch[1].trim();
            if (tagsMatch) suggestions.tags = tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
            if (notesMatch) suggestions.additionalNotes = notesMatch[1].trim();

            jsonResponse(res, { ok: true, suggestions, rawResponse: aiResponse });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/contacts/:id/avatar - Upload contact avatar (Google Drive > Supabase Storage)
    const avatarUploadMatch = pathname.match(/^\/api\/contacts\/([^/]+)\/avatar$/);
    if (avatarUploadMatch && req.method === 'POST') {
        const contactId = avatarUploadMatch[1];
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Storage not configured' }, 503);
            return true;
        }

        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Not authenticated' }, 401);
            return true;
        }

        try {
            const boundary = req.headers['content-type']?.split('boundary=')[1];
            if (!boundary) {
                jsonResponse(res, { error: 'Invalid content type' }, 400);
                return true;
            }

            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);
            const data = buffer.toString('binary');
            const parts = data.split('--' + boundary);

            let fileBuffer = null;
            let fileName = 'avatar.jpg';
            let contentType = 'image/jpeg';

            for (const part of parts) {
                if (part.includes('filename=')) {
                    const match = part.match(/filename="([^"]+)"/);
                    if (match) fileName = match[1];
                    const typeMatch = part.match(/Content-Type:\s*([^\r\n]+)/i);
                    if (typeMatch) contentType = typeMatch[1].trim();
                    const contentStart = part.indexOf('\r\n\r\n') + 4;
                    const contentEnd = part.lastIndexOf('\r\n');
                    if (contentStart > 3 && contentEnd > contentStart) {
                        fileBuffer = Buffer.from(part.substring(contentStart, contentEnd), 'binary');
                    }
                }
            }

            if (!fileBuffer) {
                jsonResponse(res, { error: 'No file uploaded' }, 400);
                return true;
            }

            const ext = fileName.split('.').pop() || 'jpg';
            let avatarUrl;

            // Try Google Drive first, fallback to Supabase Storage
            const driveModule = require('../../integrations/googleDrive/drive');
            const driveAvailable = await driveModule.isDriveAvailable();

            if (driveAvailable) {
                log.info({ event: 'contact_avatar_upload_drive', contactId }, 'Uploading contact avatar to Google Drive');
                const result = await driveModule.uploadAvatar(fileBuffer, contentType, `contact-${contactId}`, ext);
                avatarUrl = result.url;
            } else {
                const storagePath = `contacts/${contactId}.${ext}`;
                const client = supabase.getAdminClient();
                const { error: uploadError } = await client.storage
                    .from('avatars')
                    .upload(storagePath, fileBuffer, { contentType, upsert: true });

                if (uploadError) {
                    if (uploadError.message.includes('not found')) {
                        await client.storage.createBucket('avatars', { public: true });
                        const { error: retryError } = await client.storage
                            .from('avatars')
                            .upload(storagePath, fileBuffer, { contentType, upsert: true });
                        if (retryError) throw retryError;
                    } else {
                        throw uploadError;
                    }
                }

                const { data: urlData } = client.storage.from('avatars').getPublicUrl(storagePath);
                avatarUrl = urlData.publicUrl;
            }

            const projectId = req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);
            await storage.updateContact(contactId, { photo_url: avatarUrl, avatar_url: avatarUrl });

            jsonResponse(res, { ok: true, avatar_url: avatarUrl, storage: driveAvailable ? 'google_drive' : 'supabase' });
        } catch (error) {
            log.warn({ event: 'contact_avatar_upload_error', contactId, reason: error.message });
            jsonResponse(res, { error: 'Avatar upload failed: ' + error.message }, 500);
        }
        return true;
    }

    // DELETE /api/contacts/:id/avatar - Remove contact avatar
    const avatarDeleteMatch = pathname.match(/^\/api\/contacts\/([^/]+)\/avatar$/);
    if (avatarDeleteMatch && req.method === 'DELETE') {
        const contactId = avatarDeleteMatch[1];
        if (!supabase || !supabase.isConfigured()) {
            jsonResponse(res, { error: 'Storage not configured' }, 503);
            return true;
        }

        const authResult = await supabase.auth.verifyRequest(req);
        if (!authResult.authenticated) {
            jsonResponse(res, { error: 'Not authenticated' }, 401);
            return true;
        }

        try {
            // Delete from Google Drive (if configured)
            try {
                const driveModule = require('../../integrations/googleDrive/drive');
                await driveModule.deleteAvatar(`contact-${contactId}`);
            } catch {}

            // Delete from Supabase Storage
            const client = supabase.getAdminClient();
            for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp']) {
                try { await client.storage.from('avatars').remove([`contacts/${contactId}.${ext}`]); } catch {}
            }

            const projectId = req.headers['x-project-id'];
            if (projectId && storage._supabase) storage._supabase.setProject(projectId);
            await storage.updateContact(contactId, { photo_url: null, avatar_url: null });

            jsonResponse(res, { ok: true });
        } catch (error) {
            log.warn({ event: 'contact_avatar_delete_error', contactId, reason: error.message });
            jsonResponse(res, { error: 'Failed to remove avatar' }, 500);
        }
        return true;
    }

    // Route not handled by this module
    return false;
}

module.exports = { handleContacts };
