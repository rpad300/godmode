/**
 * Purpose:
 *   Synchronises team-analysis artifacts (behavioral profiles, relationships,
 *   team dynamics) into the graph database (graph_nodes / graph_relationships
 *   tables in Supabase) and provides query helpers and visualisation data.
 *
 * Responsibilities:
 *   - Sync individual profiles as BehavioralProfile nodes linked to Person nodes
 *   - Sync behavioral relationships (influences, aligned_with, tension_with, etc.)
 *     with strength and evidence metadata
 *   - Sync team-level TeamDynamics nodes with cohesion/tension metrics
 *   - Provide a fullSync() that writes all three categories in order
 *   - Build vis.js-compatible graph data (nodes + edges) with colour coding
 *   - Execute pre-defined analytical queries: influence_map, power_centers,
 *     alliances, tensions, person_network, team_cohesion
 *
 * Key dependencies:
 *   - ../supabase/client: Supabase DB access
 *   - ../logger: Structured logging
 *
 * Side effects:
 *   - Upserts into graph_nodes and graph_relationships tables
 *   - Reads from team_profiles, behavioral_relationships, team_analysis, contacts
 *
 * Notes:
 *   - Foreign-key errors on relationship upserts are silently ignored because
 *     referenced nodes may not yet exist during partial syncs
 *   - Node size in visualisation data scales with influence_score
 *   - Edge dashes indicate tension relationships; arrows indicate influence direction
 *   - Relationship type mapping converts snake_case DB types to UPPER_CASE graph labels
 */

const { logger } = require('../logger');
const { getSupabaseClient } = require('../supabase/client');

const log = logger.child({ module: 'graph-sync' });

class GraphSync {
    constructor(options = {}) {
        this.supabase = options.supabase || getSupabaseClient();
        this.graphName = options.graphName || 'default';
    }

    /**
     * Sync all behavioral profiles to the graph
     * @param {string} projectId - Project ID
     */
    async syncProfilesToGraph(projectId) {
        log.debug({ event: 'graph_sync_profiles_start', projectId }, 'Syncing profiles to graph');

        // Get all profiles
        const { data: profiles, error } = await this.supabase
            .from('team_profiles')
            .select(`
                *,
                contact:contacts(id, name, role, organization)
            `)
            .eq('project_id', projectId);

        if (error) {
            throw new Error(`Failed to fetch profiles: ${error.message}`);
        }

        for (const profile of profiles) {
            // Create BehavioralProfile node
            const nodeId = `behavioral_profile_${profile.id}`;
            await this.upsertNode(nodeId, 'BehavioralProfile', {
                id: nodeId,
                contact_id: profile.contact_id,
                person_name: profile.contact?.name,
                confidence_level: profile.confidence_level,
                communication_style: profile.communication_style,
                dominant_motivation: profile.dominant_motivation,
                risk_tolerance: profile.risk_tolerance,
                influence_score: profile.influence_score,
                last_analysis_at: profile.last_analysis_at
            }, projectId);

            // Create HAS_BEHAVIORAL_PROFILE relationship
            const personNodeId = `person_${profile.contact_id}`;
            await this.upsertRelationship(
                personNodeId,
                nodeId,
                'HAS_BEHAVIORAL_PROFILE',
                {},
                projectId
            );

            // Create ANALYZED_FROM relationships to documents
            for (const docId of profile.transcripts_analyzed || []) {
                await this.upsertRelationship(
                    nodeId,
                    `document_${docId}`,
                    'ANALYZED_FROM',
                    { extracted_at: profile.last_analysis_at },
                    projectId
                );
            }
        }

        log.debug({ event: 'graph_sync_profiles_done', projectId, count: profiles.length }, 'Synced profiles to graph');
    }

    /**
     * Sync behavioral relationships to the graph
     * @param {string} projectId - Project ID
     */
    async syncBehavioralRelationshipsToGraph(projectId) {
        log.debug({ event: 'graph_sync_relationships_start', projectId }, 'Syncing behavioral relationships to graph');

        // Get all behavioral relationships
        const { data: relationships, error } = await this.supabase
            .from('behavioral_relationships')
            .select(`
                *,
                from_contact:contacts!from_contact_id(id, name),
                to_contact:contacts!to_contact_id(id, name)
            `)
            .eq('project_id', projectId);

        if (error) {
            throw new Error(`Failed to fetch relationships: ${error.message}`);
        }

        // Map relationship types to graph relationship types
        const typeMapping = {
            'influences': 'INFLUENCES',
            'aligned_with': 'ALIGNED_WITH',
            'tension_with': 'TENSION_WITH',
            'defers_to': 'DEFERS_TO',
            'competes_with': 'COMPETES_WITH',
            'mentors': 'MENTORS',
            'supports': 'SUPPORTS'
        };

        for (const rel of relationships) {
            const graphType = typeMapping[rel.relationship_type] || rel.relationship_type.toUpperCase();
            
            await this.upsertRelationship(
                `person_${rel.from_contact_id}`,
                `person_${rel.to_contact_id}`,
                graphType,
                {
                    strength: rel.strength,
                    confidence: rel.confidence,
                    evidence_count: rel.evidence_count,
                    first_observed_at: rel.first_observed_at,
                    last_observed_at: rel.last_observed_at
                },
                projectId
            );
        }

        log.debug({ event: 'graph_sync_relationships_done', projectId, count: relationships.length }, 'Synced behavioral relationships to graph');
    }

    /**
     * Sync team analysis to the graph
     * @param {string} projectId - Project ID
     */
    async syncTeamAnalysisToGraph(projectId) {
        log.debug({ event: 'graph_sync_team_analysis_start', projectId }, 'Syncing team analysis to graph');

        // Get team analysis
        const { data: analysis, error } = await this.supabase
            .from('team_analysis')
            .select('*')
            .eq('project_id', projectId)
            .single();

        if (error || !analysis) {
            log.debug({ event: 'graph_sync_no_team_analysis', projectId }, 'No team analysis found');
            return;
        }

        // Create TeamDynamics node
        const nodeId = `team_dynamics_${analysis.id}`;
        await this.upsertNode(nodeId, 'TeamDynamics', {
            id: nodeId,
            project_id: projectId,
            team_size: analysis.team_size,
            cohesion_score: analysis.cohesion_score,
            tension_level: analysis.tension_level,
            dominant_communication_pattern: analysis.dominant_communication_pattern,
            last_analysis_at: analysis.last_analysis_at
        }, projectId);

        // Create MEMBER_OF_ANALYSIS relationships
        for (const memberId of analysis.members_included || []) {
            await this.upsertRelationship(
                `person_${memberId}`,
                nodeId,
                'MEMBER_OF_ANALYSIS',
                {},
                projectId
            );
        }

        log.debug({ event: 'graph_sync_team_analysis_done', projectId }, 'Team analysis synced to graph');
    }

    /**
     * Full sync of all team analysis data to graph
     * @param {string} projectId - Project ID
     */
    async fullSync(projectId) {
        await this.syncProfilesToGraph(projectId);
        await this.syncBehavioralRelationshipsToGraph(projectId);
        await this.syncTeamAnalysisToGraph(projectId);
    }

    /**
     * Get graph data for visualization
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} Graph data with nodes and edges
     */
    async getVisualizationData(projectId) {
        const nodes = [];
        const edges = [];

        // Get all contacts with profiles
        const { data: profiles } = await this.supabase
            .from('team_profiles')
            .select(`
                *,
                contact:contacts(id, name, role, organization)
            `)
            .eq('project_id', projectId);

        // Create person nodes
        for (const profile of profiles || []) {
            const contact = profile.contact || {};
            nodes.push({
                id: profile.contact_id,
                label: contact.name || 'Unknown',
                group: 'person',
                size: 10 + (profile.influence_score / 5), // Size based on influence
                title: `${contact.name || 'Unknown'}\n${contact.role || ''}\nInfluence: ${profile.influence_score}`,
                color: this.getNodeColor(profile.confidence_level),
                properties: {
                    role: contact.role,
                    organization: contact.organization,
                    communicationStyle: profile.communication_style,
                    dominantMotivation: profile.dominant_motivation,
                    influenceScore: profile.influence_score,
                    confidenceLevel: profile.confidence_level
                }
            });
        }

        // Get all behavioral relationships
        const { data: relationships } = await this.supabase
            .from('behavioral_relationships')
            .select('*')
            .eq('project_id', projectId);

        // Create edges
        for (const rel of relationships || []) {
            edges.push({
                from: rel.from_contact_id,
                to: rel.to_contact_id,
                type: rel.relationship_type,
                label: this.formatRelationshipLabel(rel.relationship_type),
                width: Math.max(1, rel.strength * 5),
                dashes: rel.relationship_type === 'tension_with',
                color: this.getEdgeColor(rel.relationship_type),
                arrows: rel.relationship_type === 'influences' ? 'to' : undefined,
                title: `${rel.relationship_type}\nStrength: ${(rel.strength * 100).toFixed(0)}%\nEvidence: ${rel.evidence_count}`,
                properties: {
                    strength: rel.strength,
                    confidence: rel.confidence,
                    evidenceCount: rel.evidence_count
                }
            });
        }

        return { nodes, edges };
    }

    /**
     * Get node color based on confidence level
     */
    getNodeColor(confidenceLevel) {
        const colors = {
            'very_high': '#27ae60', // Green
            'high': '#2ecc71',      // Light green
            'medium': '#f39c12',    // Orange
            'low': '#e74c3c'        // Red
        };
        return colors[confidenceLevel] || '#95a5a6';
    }

    /**
     * Get edge color based on relationship type
     */
    getEdgeColor(relationshipType) {
        const colors = {
            'influences': '#3498db',    // Blue
            'aligned_with': '#27ae60',  // Green
            'tension_with': '#e74c3c',  // Red
            'defers_to': '#9b59b6',     // Purple
            'competes_with': '#f39c12', // Orange
            'mentors': '#1abc9c',       // Teal
            'supports': '#2ecc71'       // Light green
        };
        return colors[relationshipType] || '#7f8c8d';
    }

    /**
     * Format relationship label for display
     */
    formatRelationshipLabel(type) {
        const labels = {
            'influences': 'influences',
            'aligned_with': 'aligned with',
            'tension_with': 'tension',
            'defers_to': 'defers to',
            'competes_with': 'competes with',
            'mentors': 'mentors',
            'supports': 'supports'
        };
        return labels[type] || type;
    }

    /**
     * Upsert a node in the graph
     */
    async upsertNode(nodeId, label, properties, projectId) {
        const { error } = await this.supabase
            .from('graph_nodes')
            .upsert({
                id: nodeId,
                label,
                properties,
                graph_name: this.graphName,
                project_id: projectId
            }, {
                onConflict: 'id'
            });

        if (error) {
            log.error({ event: 'graph_sync_upsert_node_failed', nodeId, reason: error.message }, 'Failed to upsert node');
        }
    }

    /**
     * Upsert a relationship in the graph
     */
    async upsertRelationship(fromId, toId, type, properties, projectId) {
        const relId = `${fromId}_${type}_${toId}`;

        const { error } = await this.supabase
            .from('graph_relationships')
            .upsert({
                id: relId,
                from_id: fromId,
                to_id: toId,
                type,
                properties,
                graph_name: this.graphName,
                project_id: projectId
            }, {
                onConflict: 'id'
            });

        if (error && !error.message.includes('violates foreign key')) {
            // Ignore foreign key errors (nodes might not exist yet)
            log.error({ event: 'graph_sync_upsert_relationship_failed', relId, reason: error.message }, 'Failed to upsert relationship');
        }
    }

    /**
     * Execute a Cypher-like query for team analysis
     * @param {string} queryType - Type of query to execute
     * @param {Object} params - Query parameters
     * @returns {Promise<Object[]>} Query results
     */
    async executeQuery(queryType, params = {}) {
        const { projectId } = params;

        switch (queryType) {
            case 'influence_map':
                return this.queryInfluenceMap(projectId);
            case 'power_centers':
                return this.queryPowerCenters(projectId);
            case 'alliances':
                return this.queryAlliances(projectId);
            case 'tensions':
                return this.queryTensions(projectId);
            case 'person_network':
                return this.queryPersonNetwork(projectId, params.personId);
            case 'team_cohesion':
                return this.queryTeamCohesion(projectId);
            default:
                throw new Error(`Unknown query type: ${queryType}`);
        }
    }

    /**
     * Query influence map
     */
    async queryInfluenceMap(projectId) {
        const { data } = await this.supabase
            .from('behavioral_relationships')
            .select(`
                *,
                from_contact:contacts!from_contact_id(name),
                to_contact:contacts!to_contact_id(name)
            `)
            .eq('project_id', projectId)
            .eq('relationship_type', 'influences')
            .order('strength', { ascending: false });

        return (data || []).map(r => ({
            influencer: r.from_contact?.name,
            influenced: r.to_contact?.name,
            strength: r.strength,
            evidence: r.evidence_count
        }));
    }

    /**
     * Query power centers (most influential contacts)
     */
    async queryPowerCenters(projectId) {
        const { data: profiles } = await this.supabase
            .from('team_profiles')
            .select(`
                influence_score,
                contact:contacts(name, role)
            `)
            .eq('project_id', projectId)
            .order('influence_score', { ascending: false })
            .limit(5);

        return (profiles || []).map(p => ({
            name: p.contact?.name,
            role: p.contact?.role,
            influenceScore: p.influence_score
        }));
    }

    /**
     * Query alliances
     */
    async queryAlliances(projectId) {
        const { data } = await this.supabase
            .from('behavioral_relationships')
            .select(`
                *,
                from_contact:contacts!from_contact_id(name),
                to_contact:contacts!to_contact_id(name)
            `)
            .eq('project_id', projectId)
            .eq('relationship_type', 'aligned_with')
            .order('strength', { ascending: false });

        return (data || []).map(r => ({
            person1: r.from_contact?.name,
            person2: r.to_contact?.name,
            strength: r.strength
        }));
    }

    /**
     * Query tensions
     */
    async queryTensions(projectId) {
        const { data } = await this.supabase
            .from('behavioral_relationships')
            .select(`
                *,
                from_contact:contacts!from_contact_id(name),
                to_contact:contacts!to_contact_id(name)
            `)
            .eq('project_id', projectId)
            .eq('relationship_type', 'tension_with')
            .order('strength', { ascending: false });

        return (data || []).map(r => ({
            person1: r.from_contact?.name,
            person2: r.to_contact?.name,
            level: r.strength > 0.7 ? 'high' : r.strength > 0.4 ? 'medium' : 'low',
            triggers: r.evidence?.[0]?.triggers || []
        }));
    }

    /**
     * Query a person's full network
     */
    async queryPersonNetwork(projectId, personId) {
        const { data } = await this.supabase
            .from('behavioral_relationships')
            .select(`
                *,
                from_contact:contacts!from_contact_id(id, name),
                to_contact:contacts!to_contact_id(id, name)
            `)
            .eq('project_id', projectId)
            .or(`from_contact_id.eq.${personId},to_contact_id.eq.${personId}`);

        const influences = [];
        const influencedBy = [];
        const allies = [];
        const tensions = [];

        for (const rel of data || []) {
            const isFrom = rel.from_contact_id === personId;
            const otherPerson = isFrom ? rel.to_contact?.name : rel.from_contact?.name;

            switch (rel.relationship_type) {
                case 'influences':
                    if (isFrom) influences.push(otherPerson);
                    else influencedBy.push(otherPerson);
                    break;
                case 'aligned_with':
                    allies.push(otherPerson);
                    break;
                case 'tension_with':
                    tensions.push(otherPerson);
                    break;
            }
        }

        return { influences, influencedBy, allies, tensions };
    }

    /**
     * Query team cohesion metrics
     */
    async queryTeamCohesion(projectId) {
        const { data: analysis } = await this.supabase
            .from('team_analysis')
            .select('team_size, cohesion_score, tension_level')
            .eq('project_id', projectId)
            .single();

        const { count: allianceCount } = await this.supabase
            .from('behavioral_relationships')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('relationship_type', 'aligned_with');

        const { count: tensionCount } = await this.supabase
            .from('behavioral_relationships')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('relationship_type', 'tension_with');

        return {
            teamSize: analysis?.team_size || 0,
            cohesionScore: analysis?.cohesion_score || 0,
            tensionLevel: analysis?.tension_level || 'unknown',
            allianceCount: allianceCount || 0,
            tensionCount: tensionCount || 0
        };
    }
}

module.exports = GraphSync;
