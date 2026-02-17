/**
 * Purpose:
 *   Builds and maintains LLM-generated behavioral profiles for individual
 *   team members, and produces team-dynamics analyses (cohesion, alliances,
 *   tensions, influence maps) from accumulated transcript data.
 *
 * Responsibilities:
 *   - Look up persons across both `people` and `contacts` tables
 *   - Locate transcripts mentioning a person (by name and aliases)
 *   - Delegate intervention extraction to InterventionExtractor for
 *     efficient, person-scoped transcript chunking
 *   - Run full or incremental LLM analysis depending on what is new
 *   - Merge incremental results into existing profiles (communication style,
 *     motivations, influence tactics, vulnerabilities, warning signs)
 *   - Calculate summary metrics (influence score, speaking time, word counts)
 *   - Persist profiles, evidence, and analysis history to Supabase
 *   - Analyse team dynamics (cohesion, alliances, tensions) from all profiles
 *   - Sync behavioral relationships (influences, aligned_with, tension_with)
 *     to the `behavioral_relationships` table
 *   - Enforce role-based access control for team-analysis features
 *
 * Key dependencies:
 *   - ../llm (generateText): Provider-agnostic LLM calls
 *   - ../llm/config: Centralised model/provider resolution
 *   - ../supabase/client: Supabase DB access
 *   - ../supabase/prompts (getPrompt): DB-stored prompt templates
 *   - ./InterventionExtractor: Person-specific transcript extraction
 *   - ../integrations/googleDrive/drive: Fallback content loading from Drive
 *   - ../logger: Structured logging
 *
 * Side effects:
 *   - LLM API calls (text generation) for both individual and team analyses
 *   - Reads/writes Supabase tables: team_profiles, profile_evidence,
 *     team_analysis, team_analysis_history, behavioral_relationships,
 *     people, contacts, documents, projects, project_members
 *   - May read transcript files from local disk or Google Drive
 *
 * Notes:
 *   - Incremental analysis only processes transcripts not yet in the profile's
 *     transcripts_analyzed array, significantly reducing LLM cost
 *   - generateNameVariants() produces first-name, last-name, and initial+last
 *     variants for fuzzy speaker matching
 *   - inferRiskTolerance() uses keyword heuristics on motivations/avoids arrays
 *   - Speaking time is estimated at 150 words per minute
 *   - Team dynamics requires at least 2 profiles
 */

const { logger } = require('../logger');
const { getSupabaseClient } = require('../supabase/client');

const log = logger.child({ module: 'team-analyzer' });
const { generateText } = require('../llm');
const { getPrompt } = require('../supabase/prompts');
const llmConfig = require('../llm/config');
const InterventionExtractor = require('./InterventionExtractor');

/**
 * Builds and maintains LLM-generated behavioral profiles for individual contacts
 * and produces team-dynamics analyses (cohesion, alliances, tensions, influence
 * maps) from accumulated transcript data. Supports both full and incremental
 * analysis modes to minimise LLM cost when new transcripts are added.
 */
class TeamAnalyzer {
    constructor(options = {}) {
        this.supabase = options.supabase || getSupabaseClient();
        this.getPrompt = options.getPrompt || getPrompt; // Use the function directly
        this.config = options.config || {};
        this.interventionExtractor = new InterventionExtractor({ supabase: this.supabase });
    }

    /**
     * Get LLM configuration from app config (centralized via llm/config).
     * @returns {{ provider: string, model: string, providerConfig: object } | null}
     */
    getLLMConfig() {
        const textCfg = llmConfig.getTextConfig(this.config);
        if (!textCfg?.provider || !textCfg?.model) {
            log.warn({ event: 'team_analyzer_no_llm' }, 'No text provider/model configured in Settings > LLM');
            return null;
        }
        return {
            provider: textCfg.provider,
            model: textCfg.model,
            providerConfig: textCfg.providerConfig || {}
        };
    }

    /**
     * Analyze a person's behavioral profile based on transcripts
     * Uses intelligent chunking - extracts only person's interventions
     * Uses incremental analysis if profile already exists
     * @param {string} projectId - Project ID
     * @param {string} personId - Person ID to analyze
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Behavioral profile
     */
    async analyzePersonProfile(projectId, personId, options = {}) {
        const {
            relationshipContext = 'colleague',
            objective = 'development of partnership',
            forceReanalysis = false,
            useIncrementalAnalysis = true
        } = options;

        // Store projectId for billing in LLM calls
        this.currentProjectId = projectId;

        // Get person details - try people table first, then contacts
        let person = null;
        let aliases = [];

        // Try people table first
        const { data: personData, error: personError } = await this.supabase
            .from('people')
            .select('*')
            .eq('id', personId)
            .single();

        if (!personError && personData) {
            person = personData;
        } else {
            // Fallback to contacts table (includes aliases)
            const { data: contactData, error: contactError } = await this.supabase
                .from('contacts')
                .select('*')
                .eq('id', personId)
                .single();

            if (!contactError && contactData) {
                // Map contact fields to person format
                person = {
                    id: contactData.id,
                    name: contactData.name,
                    role: contactData.role,
                    organization: contactData.organization,
                    email: contactData.email
                };
                // Get aliases from contact
                aliases = contactData.aliases || [];
            }
        }

        if (!person) {
            throw new Error(`Person not found: ${personId}`);
        }

        // Get existing profile if any
        const { data: existingProfile } = await this.supabase
            .from('team_profiles')
            .select('*')
            .eq('project_id', projectId)
            .eq('contact_id', personId)
            .single();

        // Get transcripts where this person appears (using name and aliases)
        const transcripts = await this.getTranscriptsForPerson(projectId, person.name, aliases);

        if (transcripts.length === 0) {
            throw new Error(`No transcripts found for ${person.name}`);
        }

        // Check if we need to reanalyze
        const transcriptIds = transcripts.map(t => t.id);
        const existingTranscriptIds = existingProfile?.transcripts_analyzed || [];
        const newTranscriptIds = transcriptIds.filter(id => !existingTranscriptIds.includes(id));

        if (existingProfile && !forceReanalysis && newTranscriptIds.length === 0) {
            log.debug({ event: 'team_analyzer_profile_up_to_date', personName: person.name }, 'Profile is up to date');
            return existingProfile;
        }

        // INTELLIGENT CHUNKING: Extract interventions for this person
        log.debug({ event: 'team_analyzer_extracting', personName: person.name, transcriptCount: transcripts.length }, 'Extracting interventions');
        const allInterventions = await this.interventionExtractor.extractAllForPerson(
            projectId,
            personId,
            person.name,
            transcripts,
            aliases  // Pass aliases for better matching
        );

        // Calculate total stats
        const totalInterventions = allInterventions.reduce((sum, t) => sum + (t.interventionCount || 0), 0);
        const totalWords = allInterventions.reduce((sum, t) => sum + (t.totalWordCount || 0), 0);

        log.debug({ event: 'team_analyzer_extracted', personName: person.name, totalInterventions, totalWords }, 'Extracted interventions');

        // Get existing evidence
        const existingEvidence = await this.getExistingEvidence(projectId, existingProfile?.id);

        // Decide analysis type
        const shouldUseIncremental = useIncrementalAnalysis &&
            existingProfile &&
            existingProfile.profile_data &&
            newTranscriptIds.length > 0 &&
            newTranscriptIds.length < transcriptIds.length; // Has some history

        let profileData;
        let analysisType;

        if (shouldUseIncremental) {
            // INCREMENTAL ANALYSIS: Only analyze new transcripts
            log.debug({ event: 'team_analyzer_incremental', personName: person.name, newCount: newTranscriptIds.length }, 'Running incremental analysis');

            const newInterventions = allInterventions.filter(t => newTranscriptIds.includes(t.documentId));
            profileData = await this.runIncrementalAnalysis(
                person.name,
                existingProfile.profile_data,
                existingEvidence,
                newInterventions,
                objective
            );
            analysisType = 'incremental';

            // Merge incremental results with existing profile
            profileData = this.mergeIncrementalResults(existingProfile.profile_data, profileData);
        } else {
            // FULL ANALYSIS: Analyze all interventions
            log.debug({ event: 'team_analyzer_full', personName: person.name }, 'Running full analysis');

            profileData = await this.runFullAnalysis(
                allInterventions,
                person.name,
                relationshipContext,
                objective,
                existingProfile?.profile_data
            );
            analysisType = 'full';
        }

        // Calculate summary metrics
        const summaryMetrics = this.calculateSummaryMetrics(profileData, transcripts, allInterventions);

        // Upsert profile
        const profileRecord = {
            project_id: projectId,
            contact_id: personId,
            profile_data: profileData,
            confidence_level: profileData.confidence_level || 'medium',
            communication_style: profileData.communication_identity?.dominant_style,
            dominant_motivation: profileData.motivations_and_priorities?.values_most?.[0],
            risk_tolerance: this.inferRiskTolerance(profileData),
            influence_score: summaryMetrics.influenceScore,
            transcripts_analyzed: transcriptIds,
            transcript_count: transcripts.length,
            total_speaking_time_seconds: summaryMetrics.totalSpeakingTime,
            limitations: profileData.limitations || [],
            recommended_update_after: profileData.recommended_update_after,
            last_analysis_at: new Date().toISOString(),
            last_incremental_analysis_at: analysisType === 'incremental' ? new Date().toISOString() : existingProfile?.last_incremental_analysis_at,
            analysis_version: '2.0',
            evidence_count: (existingEvidence?.length || 0) + (profileData.key_new_evidence?.length || 0)
        };

        const { data: savedProfile, error: saveError } = await this.supabase
            .from('team_profiles')
            .upsert(profileRecord, {
                onConflict: 'project_id,contact_id'
            })
            .select()
            .single();

        if (saveError) {
            throw new Error(`Failed to save profile: ${saveError.message}`);
        }

        // Save new evidence to evidence bank
        if (profileData.key_new_evidence?.length > 0) {
            await this.saveEvidence(projectId, savedProfile.id, personId, profileData.key_new_evidence);
        }

        // Save to history
        await this.saveAnalysisHistory(projectId, 'profile', savedProfile.id, profileData, analysisType);

        // Extract and save behavioral relationships
        await this.extractBehavioralRelationships(projectId, personId, profileData, transcripts);

        log.info({ event: 'team_analyzer_profile_saved', personName: person.name, analysisType }, 'Profile saved successfully');
        return savedProfile;
    }

    /**
     * Run full behavioral analysis
     */
    async runFullAnalysis(allInterventions, personName, relationshipContext, objective, existingProfile) {
        // Format interventions for prompt (with token limit)
        const allIntervs = allInterventions.flatMap(t => t.interventions || []);
        const formatted = this.interventionExtractor.formatForPrompt(allIntervs, { maxTokens: 12000 });

        log.debug({ event: 'team_analyzer_formatted', includedCount: formatted.includedCount, totalCount: formatted.totalCount, estimatedTokens: formatted.estimatedTokens }, 'Formatted interventions');

        // Build prompt
        const prompt = await this.buildBehavioralPrompt(
            formatted.formattedText,
            personName,
            relationshipContext,
            objective,
            existingProfile
        );

        const cfg = this.getLLMConfig();
        if (!cfg) throw new Error('No LLM configured. Set Text provider and model in Settings > LLM.');
        const { provider, model, providerConfig } = cfg;
        const response = await generateText({
            provider,
            model,
            providerConfig,
            prompt: prompt,
            temperature: 0.3,
            maxTokens: 8000,
            context: 'team-analysis',
            projectId: this.currentProjectId // Pass projectId for billing
        });

        if (!response.success) {
            throw new Error(`LLM call failed: ${response.error}`);
        }

        return this.parseJsonResponse(response.text);
    }

    /**
     * Run incremental analysis on new interventions only
     */
    async runIncrementalAnalysis(personName, existingProfileData, existingEvidence, newInterventions, objective) {
        // Format new interventions
        const newIntervs = newInterventions.flatMap(t => t.interventions || []);
        const formatted = this.interventionExtractor.formatForPrompt(newIntervs, { maxTokens: 8000 });

        log.debug({ event: 'team_analyzer_incremental_formatted', includedCount: formatted.includedCount }, 'Formatted new interventions for incremental analysis');

        // Get incremental prompt template
        let template;
        try {
            const promptObj = await this.getPrompt('team_behavioral_analysis_incremental');
            template = promptObj?.prompt_template || promptObj;
            if (typeof template !== 'string') {
                template = this.getDefaultIncrementalPromptTemplate();
            }
        } catch (e) {
            template = this.getDefaultIncrementalPromptTemplate();
        }

        // Format existing evidence for prompt
        const evidenceSummary = existingEvidence?.slice(0, 20).map(e =>
            `[${e.evidence_type}] "${e.quote.substring(0, 100)}..." -> ${e.supports_trait}`
        ).join('\n') || 'None';

        // Build prompt
        const prompt = template
            .replace('{{TARGET_NAME}}', personName)
            .replace('{{EXISTING_PROFILE}}', JSON.stringify(existingProfileData, null, 2))
            .replace('{{EXISTING_EVIDENCE}}', evidenceSummary)
            .replace('{{NEW_INTERVENTIONS}}', formatted.formattedText)
            .replace('{{OBJECTIVE}}', objective);

        const cfg = this.getLLMConfig();
        if (!cfg) throw new Error('No LLM configured. Set Text provider and model in Settings > LLM.');
        const { provider, model, providerConfig } = cfg;
        const response = await generateText({
            provider,
            model,
            providerConfig,
            prompt: prompt,
            temperature: 0.3,
            maxTokens: 6000,
            context: 'team-analysis-incremental',
            projectId: this.currentProjectId
        });

        if (!response.success) {
            throw new Error(`LLM call failed: ${response.error}`);
        }

        return this.parseJsonResponse(response.text);
    }

    /**
     * Merge incremental analysis results with existing profile
     */
    mergeIncrementalResults(existingProfile, incrementalResults) {
        const merged = { ...existingProfile };

        // Update confidence level if changed
        if (incrementalResults.profile_updates?.confidence_level_change?.new) {
            merged.confidence_level = incrementalResults.profile_updates.confidence_level_change.new;
        }

        // Merge each section based on update status
        const updates = incrementalResults.profile_updates || {};

        // Communication identity
        if (updates.communication_identity?.status === 'refined' && updates.communication_identity.updates) {
            merged.communication_identity = {
                ...merged.communication_identity,
                ...updates.communication_identity.updates
            };
        }

        // Motivations
        if (updates.motivations_and_priorities) {
            const mp = updates.motivations_and_priorities;
            if (mp.new_values_identified?.length > 0) {
                merged.motivations_and_priorities = merged.motivations_and_priorities || {};
                merged.motivations_and_priorities.values_most = [
                    ...(merged.motivations_and_priorities.values_most || []),
                    ...mp.new_values_identified
                ];
            }
            if (mp.new_avoids_identified?.length > 0) {
                merged.motivations_and_priorities = merged.motivations_and_priorities || {};
                merged.motivations_and_priorities.avoids = [
                    ...(merged.motivations_and_priorities.avoids || []),
                    ...mp.new_avoids_identified
                ];
            }
        }

        // Behavior under pressure
        if (updates.behavior_under_pressure?.new_observations?.length > 0) {
            merged.behavior_under_pressure = [
                ...(merged.behavior_under_pressure || []),
                ...updates.behavior_under_pressure.new_observations
            ];
        }

        // Influence tactics
        if (updates.influence_tactics?.new_tactics?.length > 0) {
            merged.influence_tactics = [
                ...(merged.influence_tactics || []),
                ...updates.influence_tactics.new_tactics
            ];
        }

        // Vulnerabilities
        if (updates.vulnerabilities) {
            merged.vulnerabilities = merged.vulnerabilities || {};
            if (updates.vulnerabilities.new_triggers?.length > 0) {
                merged.vulnerabilities.defense_triggers = [
                    ...(merged.vulnerabilities.defense_triggers || []),
                    ...updates.vulnerabilities.new_triggers
                ];
            }
            if (updates.vulnerabilities.new_blind_spots?.length > 0) {
                merged.vulnerabilities.blind_spots = [
                    ...(merged.vulnerabilities.blind_spots || []),
                    ...updates.vulnerabilities.new_blind_spots
                ];
            }
        }

        // Warning signs
        if (updates.warning_signs?.new_signs?.length > 0) {
            merged.early_warning_signs = [
                ...(merged.early_warning_signs || []),
                ...updates.warning_signs.new_signs
            ];
        }

        // Add contradictions and evolution data
        merged.contradictions_detected = incrementalResults.contradictions_detected;
        merged.behavior_evolution = incrementalResults.behavior_evolution;
        merged.key_new_evidence = incrementalResults.key_new_evidence;
        merged.last_analysis_summary = incrementalResults.analysis_summary;

        return merged;
    }

    /**
     * Get existing evidence for a profile
     */
    async getExistingEvidence(projectId, profileId) {
        if (!profileId) return [];

        try {
            const { data } = await this.supabase
                .from('profile_evidence')
                .select('*')
                .eq('profile_id', profileId)
                .order('is_primary', { ascending: false })
                .limit(50);

            return data || [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Save new evidence to evidence bank
     */
    async saveEvidence(projectId, profileId, personId, evidenceList) {
        if (!evidenceList?.length) return;

        const records = evidenceList.map(e => ({
            project_id: projectId,
            profile_id: profileId,
            contact_id: personId,
            quote: e.quote,
            context: e.context,
            timestamp_in_transcript: e.timestamp,
            evidence_type: e.evidence_type || 'communication_style',
            supports_trait: e.supports_trait,
            confidence: e.confidence || 'medium',
            is_primary: e.is_primary || false
        }));

        try {
            await this.supabase
                .from('profile_evidence')
                .insert(records);

            log.debug({ event: 'team_analyzer_evidence_saved', count: records.length }, 'Saved evidence pieces');
        } catch (error) {
            log.warn({ event: 'team_analyzer_evidence_save_failed', reason: error.message }, 'Failed to save evidence');
        }
    }

    /**
     * Parse JSON response from LLM
     */
    parseJsonResponse(response) {
        try {
            return JSON.parse(response);
        } catch (e) {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('Failed to parse LLM response as JSON');
        }
    }

    /**
     * Default incremental prompt template (fallback)
     */
    getDefaultIncrementalPromptTemplate() {
        return `Analyze the following NEW interventions for {{TARGET_NAME}} and refine the existing profile.

EXISTING PROFILE:
{{EXISTING_PROFILE}}

EXISTING EVIDENCE:
{{EXISTING_EVIDENCE}}

OBJECTIVE: {{OBJECTIVE}}

NEW INTERVENTIONS TO ANALYZE:
{{NEW_INTERVENTIONS}}

Provide your analysis as JSON with:
- profile_updates: changes to each section (status: confirmed/refined/new_discovered/unchanged)
- contradictions_detected: any inconsistencies with existing profile
- behavior_evolution: detected changes over time
- key_new_evidence: important quotes supporting conclusions
- analysis_summary: counts of patterns confirmed/refined/discovered`;
    }

    /**
     * Analyze team dynamics for a project
     * @param {string} projectId - Project ID
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Team dynamics analysis
     */
    async analyzeTeamDynamics(projectId, options = {}) {
        const { forceReanalysis = false } = options;

        // Store projectId for billing in LLM calls
        this.currentProjectId = projectId;

        // Get all profiles for the project
        const { data: profiles, error: profilesError } = await this.supabase
            .from('team_profiles')
            .select(`
                *,
                contact:contacts(id, name, role, organization)
            `)
            .eq('project_id', projectId);

        if (profilesError) {
            throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
        }

        if (profiles.length < 2) {
            throw new Error('Need at least 2 profiles for team dynamics analysis');
        }

        // Get existing analysis
        const { data: existingAnalysis } = await this.supabase
            .from('team_analysis')
            .select('*')
            .eq('project_id', projectId)
            .single();

        // Check if we need to reanalyze
        const memberIds = profiles.map(p => p.contact_id);
        if (existingAnalysis && !forceReanalysis) {
            const existingMemberIds = existingAnalysis.members_included || [];
            const sameMembers = memberIds.length === existingMemberIds.length &&
                memberIds.every(id => existingMemberIds.includes(id));

            if (sameMembers) {
                // Check if any profile was updated after the analysis
                const latestProfileUpdate = Math.max(...profiles.map(p => new Date(p.last_analysis_at)));
                const analysisDate = new Date(existingAnalysis.last_analysis_at);

                if (latestProfileUpdate <= analysisDate) {
                    log.debug({ event: 'team_analyzer_team_up_to_date' }, 'Team analysis is up to date');
                    return existingAnalysis;
                }
            }
        }

        // Build team analysis prompt
        const prompt = await this.buildTeamDynamicsPrompt(profiles);

        log.info({ event: 'team_analyzer_dynamics_start' }, 'Analyzing team dynamics');
        const cfg = this.getLLMConfig();
        if (!cfg) throw new Error('No LLM configured. Set Text provider and model in Settings > LLM.');
        const { provider, model, providerConfig } = cfg;
        const response = await generateText({
            provider,
            model,
            providerConfig,
            prompt: prompt,
            temperature: 0.3,
            maxTokens: 8000,
            context: 'team-dynamics',
            projectId: this.currentProjectId
        });

        // Parse response
        if (!response.success) {
            throw new Error(`LLM call failed: ${response.error}`);
        }

        let analysisData;
        try {
            analysisData = JSON.parse(response.text);
        } catch (e) {
            const jsonMatch = response.text?.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysisData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Failed to parse LLM response as JSON');
            }
        }

        // Collect all transcript IDs from profiles
        const allTranscriptIds = [...new Set(
            profiles.flatMap(p => p.transcripts_analyzed || [])
        )];

        // Upsert team analysis
        const analysisRecord = {
            project_id: projectId,
            analysis_data: analysisData,
            team_size: profiles.length,
            cohesion_score: analysisData.cohesion_score,
            tension_level: analysisData.tension_level,
            dominant_communication_pattern: analysisData.dominant_communication_pattern,
            influence_map: analysisData.influence_map || [],
            alliances: analysisData.alliances || [],
            tensions: analysisData.tensions || [],
            members_included: memberIds,
            transcripts_analyzed: allTranscriptIds,
            last_analysis_at: new Date().toISOString()
        };

        const { data: savedAnalysis, error: saveError } = await this.supabase
            .from('team_analysis')
            .upsert(analysisRecord, {
                onConflict: 'project_id'
            })
            .select()
            .single();

        if (saveError) {
            throw new Error(`Failed to save team analysis: ${saveError.message}`);
        }

        // Save to history
        await this.saveAnalysisHistory(projectId, 'team_analysis', savedAnalysis.id, analysisData, 'manual');

        // Sync behavioral relationships from team analysis
        await this.syncBehavioralRelationshipsFromTeamAnalysis(projectId, analysisData, profiles);

        log.info({ event: 'team_analyzer_dynamics_saved' }, 'Team dynamics analysis saved successfully');
        return savedAnalysis;
    }

    /**
     * Update profiles after a new transcript is processed
     * @param {string} projectId - Project ID
     * @param {string} documentId - Document ID of the new transcript
     * @param {string[]} participantNames - Names of participants in the transcript
     */
    async updateProfilesFromTranscript(projectId, documentId, participantNames) {
        log.debug({ event: 'team_analyzer_updating_from_transcript', documentId }, 'Updating profiles from transcript');

        for (const name of participantNames) {
            try {
                // Find person by name - try people table first, then contacts
                let personId = null;

                // Try people table
                const { data: person } = await this.supabase
                    .from('people')
                    .select('id')
                    .eq('project_id', projectId)
                    .ilike('name', name)
                    .single();

                if (person) {
                    personId = person.id;
                } else {
                    // Fallback to contacts table
                    const { data: contact } = await this.supabase
                        .from('contacts')
                        .select('id')
                        .eq('project_id', projectId)
                        .ilike('name', name)
                        .single();

                    if (contact) {
                        personId = contact.id;
                    }
                }

                if (personId) {
                    // Get existing profile
                    const { data: profile } = await this.supabase
                        .from('team_profiles')
                        .select('id, transcripts_analyzed')
                        .eq('project_id', projectId)
                        .eq('contact_id', personId)
                        .single();

                    if (profile) {
                        // Check if this transcript is already analyzed
                        const existingTranscripts = profile.transcripts_analyzed || [];
                        if (!existingTranscripts.includes(documentId)) {
                            // Queue for re-analysis
                            log.debug({ event: 'team_analyzer_queuing', name }, 'Queuing profile update');
                            await this.analyzePersonProfile(projectId, personId, {
                                forceReanalysis: true
                            });
                        }
                    } else {
                        // Create new profile
                        log.debug({ event: 'team_analyzer_creating_profile', name }, 'Creating new profile');
                        await this.analyzePersonProfile(projectId, personId);
                    }
                }
            } catch (error) {
                log.error({ event: 'team_analyzer_profile_update_error', name, reason: error.message }, 'Error updating profile');
            }
        }
    }

    /**
     * Get transcripts where a person appears
     * @param {string} projectId - Project ID
     * @param {string} personName - Person's name
     * @param {string[]} aliases - Alternative names/aliases for the person
     * @returns {Promise<Object[]>} Array of transcripts
     */
    async getTranscriptsForPerson(projectId, personName, aliases = []) {
        log.debug({ event: 'team_analyzer_get_transcripts', projectId, personName, aliases: aliases.join(', ') || 'none' }, 'getTranscriptsForPerson');

        // Get all transcripts for the project (include filepath for fallback reading)
        const { data: documents, error } = await this.supabase
            .from('documents')
            .select('id, filename, filepath, content, extraction_result, created_at')
            .eq('project_id', projectId)
            .eq('doc_type', 'transcript')
            .in('status', ['completed', 'processed'])
            .order('created_at', { ascending: true });

        if (error) {
            log.error({ event: 'team_analyzer_fetch_documents_error', reason: error.message }, 'Error fetching documents');
            throw new Error(`Failed to fetch transcripts: ${error.message}`);
        }

        log.debug({ event: 'team_analyzer_transcripts_found', count: documents?.length || 0 }, 'Found transcripts in project');

        // Try to load content from file if not in DB
        const drive = require('../integrations/googleDrive/drive');
        for (const doc of documents) {
            if (!doc.content && doc.filepath) {
                try {
                    if (doc.filepath.startsWith('gdrive:')) {
                        const fileId = doc.filepath.replace(/^gdrive:/, '').trim();
                        const client = await drive.getDriveClientForRead(projectId);
                        if (client && client.drive) {
                            const buffer = await drive.downloadFile(client, fileId);
                            doc.content = buffer.toString('utf-8');
                            log.debug({ event: 'team_analyzer_loaded_gdrive', filename: doc.filename, length: doc.content.length }, 'Loaded content from Google Drive');
                        }
                    } else {
                        const fs = require('fs');
                        const path = require('path');
                        const baseName = doc.filename.replace(/\.[^/.]+$/, '');
                        const possiblePaths = [
                            doc.filepath,
                            path.resolve(doc.filepath),
                            path.join(process.cwd(), 'data', 'projects', projectId, 'content', baseName + '.md'),
                            path.join(process.cwd(), 'data', 'projects', projectId, 'content', doc.filename),
                            path.join(process.cwd(), 'data', 'projects', projectId, 'transcripts', doc.filename),
                            path.join(process.cwd(), 'data', 'projects', projectId, 'newtranscripts', doc.filename),
                            path.join(process.cwd(), 'data', 'newtranscripts', doc.filename)
                        ];
                        for (const fpath of possiblePaths) {
                            if (fs.existsSync(fpath)) {
                                doc.content = fs.readFileSync(fpath, 'utf-8');
                                log.debug({ event: 'team_analyzer_loaded_file', fpath, length: doc.content.length }, 'Loaded content from file');
                                break;
                            }
                        }
                    }
                } catch (e) {
                    log.warn({ event: 'team_analyzer_load_file_failed', reason: e.message }, 'Could not load content from file');
                }
            }
            log.debug({ event: 'team_analyzer_doc_info', filename: doc.filename, contentLength: doc.content?.length || 0, people: doc.extraction_result?.people?.map(p => p.name).join(', ') || 'none' }, 'Document info');
        }

        // Filter transcripts where person appears
        const transcriptsWithPerson = [];
        const nameLower = personName.toLowerCase();
        // Generate variants from main name and all aliases
        let nameVariants = this.generateNameVariants(personName);
        for (const alias of aliases) {
            if (alias && alias.trim()) {
                nameVariants = [...nameVariants, ...this.generateNameVariants(alias.trim())];
            }
        }
        // Remove duplicates
        nameVariants = [...new Set(nameVariants)];
        log.debug({ event: 'team_analyzer_name_variants', nameVariants }, 'Searching for variants');

        for (const doc of documents) {
            const content = doc.content || '';
            const extraction = doc.extraction_result || {};

            // Check if person is in participants
            const people = extraction.people || [];
            const isParticipant = people.some(p =>
                nameVariants.some(v => p.name?.toLowerCase().includes(v))
            );

            // Check if name appears in content
            const inContent = nameVariants.some(v => content.toLowerCase().includes(v));

            if (isParticipant || inContent) {
                transcriptsWithPerson.push({
                    id: doc.id,
                    filename: doc.filename,
                    content: content,
                    extraction: extraction,
                    created_at: doc.created_at
                });
            }
        }

        return transcriptsWithPerson;
    }

    /**
     * Generate name variants for matching
     * @param {string} name - Full name
     * @returns {string[]} Name variants
     */
    generateNameVariants(name) {
        const parts = name.toLowerCase().split(/\s+/);
        const variants = [name.toLowerCase()];

        // First name only
        if (parts.length > 0) {
            variants.push(parts[0]);
        }

        // Last name only
        if (parts.length > 1) {
            variants.push(parts[parts.length - 1]);
        }

        // Initials + last name (e.g., "J. Smith", "J Smith")
        if (parts.length > 1) {
            variants.push(`${parts[0][0]}. ${parts[parts.length - 1]}`);
            variants.push(`${parts[0][0]} ${parts[parts.length - 1]}`);
        }

        return variants;
    }

    /**
     * Build behavioral analysis prompt
     * @param {string} interventionsText - Pre-formatted interventions text (already chunked)
     * @param {string} targetName - Name of person being analyzed
     * @param {string} relationshipContext - Context of relationship
     * @param {string} objective - Analysis objective
     * @param {Object} existingProfile - Previous profile data if any
     */
    async buildBehavioralPrompt(interventionsText, targetName, relationshipContext, objective, existingProfile) {
        // Get prompt template
        let template;
        try {
            const promptObj = await this.getPrompt('team_behavioral_analysis');
            // getPrompt returns an object with prompt_template property
            template = promptObj?.prompt_template || null;
            if (!template) {
                log.warn({ event: 'team_analyzer_no_prompt' }, 'No team_behavioral_analysis prompt found, using fallback');
                template = this.getDefaultBehavioralPromptTemplate();
            }
        } catch (e) {
            log.warn({ event: 'team_analyzer_prompt_load_error', reason: e.message }, 'Error loading prompt');
            // Fallback to basic template
            template = this.getDefaultBehavioralPromptTemplate();
        }

        // Replace placeholders - interventionsText is already formatted by InterventionExtractor
        const prompt = template
            .replace(/\{\{TARGET_NAME\}\}/g, targetName)
            .replace(/\{\{RELATIONSHIP_CONTEXT\}\}/g, relationshipContext)
            .replace(/\{\{OBJECTIVE\}\}/g, objective)
            .replace(/\{\{EXISTING_PROFILE\}\}/g, existingProfile ? JSON.stringify(existingProfile, null, 2) : 'None')
            .replace(/\{\{TRANSCRIPTS_CONTENT\}\}/g, interventionsText);

        return prompt;
    }

    /**
     * Build team dynamics prompt
     */
    async buildTeamDynamicsPrompt(profiles) {
        // Get prompt template
        let template;
        try {
            const promptObj = await this.getPrompt('team_dynamics_analysis');
            template = promptObj?.prompt_template || promptObj;
            if (typeof template !== 'string') {
                template = this.getDefaultTeamDynamicsPromptTemplate();
            }
        } catch (e) {
            template = this.getDefaultTeamDynamicsPromptTemplate();
        }

        // Format individual profiles
        const individualProfiles = profiles.map(p => ({
            name: p.contact?.name || p.person?.name,
            role: p.contact?.role || p.person?.role,
            communication_style: p.communication_style,
            dominant_motivation: p.dominant_motivation,
            influence_score: p.influence_score,
            profile_summary: {
                values: p.profile_data?.motivations_and_priorities?.values_most,
                avoids: p.profile_data?.motivations_and_priorities?.avoids,
                influence_tactics: p.profile_data?.influence_tactics?.map(t => t.objective),
                vulnerabilities: p.profile_data?.vulnerabilities?.defense_triggers?.map(t => t.trigger)
            }
        }));

        const teamMembers = profiles.map(p => p.contact?.name || p.person?.name).filter(Boolean).join(', ');

        // Replace placeholders
        const prompt = template
            .replace('{{INDIVIDUAL_PROFILES}}', JSON.stringify(individualProfiles, null, 2))
            .replace('{{PROJECT_CONTEXT}}', this.config.projectContext || 'Not specified')
            .replace('{{TEAM_MEMBERS}}', teamMembers);

        return prompt;
    }

    /**
     * Calculate summary metrics from profile data
     * @param {Object} profileData - Analyzed profile data
     * @param {Array} transcripts - Source transcripts
     * @param {Array} allInterventions - Extracted interventions per transcript
     */
    calculateSummaryMetrics(profileData, transcripts, allInterventions = []) {
        let influenceScore = 50; // Base score

        // Adjust based on influence tactics
        const tacticCount = profileData.influence_tactics?.length || 0;
        influenceScore += tacticCount * 5;

        // Adjust based on power analysis
        const powerFactors = profileData.power_analysis || [];
        for (const factor of powerFactors) {
            if (factor.assessment?.toLowerCase().includes('high') ||
                factor.assessment?.toLowerCase().includes('strong')) {
                influenceScore += 10;
            }
        }

        // Cap at 100
        influenceScore = Math.min(100, Math.max(0, influenceScore));

        // Calculate speaking time from interventions
        // Estimate: average speaking rate is ~150 words per minute
        const totalWords = allInterventions.reduce((sum, t) => sum + (t.totalWordCount || 0), 0);
        const totalSpeakingTime = Math.round((totalWords / 150) * 60); // Convert to seconds

        // Calculate additional metrics
        const totalInterventions = allInterventions.reduce((sum, t) => sum + (t.interventionCount || 0), 0);
        const avgWordsPerIntervention = totalInterventions > 0
            ? Math.round(totalWords / totalInterventions)
            : 0;

        return {
            influenceScore,
            totalSpeakingTime,
            totalWords,
            totalInterventions,
            avgWordsPerIntervention
        };
    }

    /**
     * Infer risk tolerance from profile data
     */
    inferRiskTolerance(profileData) {
        const avoids = profileData.motivations_and_priorities?.avoids || [];
        const values = profileData.motivations_and_priorities?.values_most || [];

        // Check for risk-averse indicators
        const riskAverseIndicators = ['ambiguity', 'conflict', 'uncertainty', 'change', 'risk'];
        const riskAverseCount = avoids.filter(a =>
            riskAverseIndicators.some(i => a.toLowerCase().includes(i))
        ).length;

        // Check for risk-seeking indicators
        const riskSeekingIndicators = ['innovation', 'challenge', 'speed', 'growth', 'opportunity'];
        const riskSeekingCount = values.filter(v =>
            riskSeekingIndicators.some(i => v.toLowerCase().includes(i))
        ).length;

        if (riskAverseCount > riskSeekingCount) {
            return 'low';
        } else if (riskSeekingCount > riskAverseCount) {
            return 'high';
        }
        return 'medium';
    }

    /**
     * Save analysis to history
     */
    async saveAnalysisHistory(projectId, entityType, entityId, snapshotData, triggerType, documentId = null) {
        await this.supabase
            .from('team_analysis_history')
            .insert({
                project_id: projectId,
                entity_type: entityType,
                entity_id: entityId,
                snapshot_data: snapshotData,
                trigger_type: triggerType,
                trigger_document_id: documentId
            });
    }

    /**
     * Extract behavioral relationships from profile
     */
    async extractBehavioralRelationships(projectId, personId, profileData, transcripts) {
        // This would extract relationships mentioned in the profile
        // For example, from influence tactics or interaction patterns
        // Implementation depends on how detailed the profile analysis is
    }

    /**
     * Sync behavioral relationships from team analysis
     */
    async syncBehavioralRelationshipsFromTeamAnalysis(projectId, analysisData, profiles) {
        // Create multiple mappings to find person IDs
        const nameToPersonId = {};

        // Map by real name (e.g., "alexander lee" -> contact_id)
        for (const profile of profiles) {
            const name = profile.contact?.name || profile.person?.name;
            if (name) {
                nameToPersonId[name.toLowerCase()] = profile.contact_id;
                // Also add first name only
                const firstName = name.split(' ')[0];
                if (firstName) {
                    nameToPersonId[firstName.toLowerCase()] = profile.contact_id;
                }
            }
        }

        // Map by Person_N pattern (e.g., "person_1" -> first profile's contact_id)
        profiles.forEach((profile, index) => {
            nameToPersonId[`person_${index + 1}`] = profile.contact_id;
            nameToPersonId[`person ${index + 1}`] = profile.contact_id;
        });

        // Helper to resolve person ID from various formats
        const resolvePersonId = (name) => {
            if (!name) return null;
            const normalized = name.toLowerCase().trim();
            return nameToPersonId[normalized] || null;
        };

        log.debug({ event: 'team_analyzer_name_mapping', keys: Object.keys(nameToPersonId) }, 'Name mapping for relationships');

        // Sync influence relationships
        for (const influence of analysisData.influence_map || []) {
            const fromId = resolvePersonId(influence.from_person);
            const toId = resolvePersonId(influence.to_person);

            if (fromId && toId && fromId !== toId) {
                await this.upsertBehavioralRelationship(projectId, fromId, toId, 'influences', {
                    strength: influence.strength || 0.5,
                    evidence: [{ description: influence.evidence }]
                });
                log.debug({ event: 'team_analyzer_influence_created', from: influence.from_person, to: influence.to_person }, 'Created influence');
            }
        }

        // Sync alliances
        for (const alliance of analysisData.alliances || []) {
            // alliance.members can be a string "Person_1 Person_2" or an array
            let members = alliance.members || [];
            if (typeof members === 'string') {
                members = members.split(/\s+/).filter(m => m.trim());
            }

            for (let i = 0; i < members.length; i++) {
                for (let j = i + 1; j < members.length; j++) {
                    const person1Id = resolvePersonId(members[i]);
                    const person2Id = resolvePersonId(members[j]);

                    if (person1Id && person2Id) {
                        await this.upsertBehavioralRelationship(projectId, person1Id, person2Id, 'aligned_with', {
                            strength: alliance.strength || 0.5,
                            evidence: [{ description: alliance.evidence }]
                        });
                        log.debug({ event: 'team_analyzer_alliance_created', member1: members[i], member2: members[j] }, 'Created alliance');
                    }
                }
            }
        }

        // Sync tensions
        for (const tension of analysisData.tensions || []) {
            // tension.between can be a string "Person_1 Person_2" or an array
            let between = tension.between || [];
            if (typeof between === 'string') {
                between = between.split(/\s+/).filter(m => m.trim());
            }

            if (between.length >= 2) {
                const person1Id = resolvePersonId(between[0]);
                const person2Id = resolvePersonId(between[1]);

                if (person1Id && person2Id) {
                    await this.upsertBehavioralRelationship(projectId, person1Id, person2Id, 'tension_with', {
                        strength: tension.level === 'high' ? 0.9 : tension.level === 'medium' ? 0.6 : 0.3,
                        evidence: [{ description: tension.evidence, triggers: tension.triggers }]
                    });
                    log.debug({ event: 'team_analyzer_tension_created', between1: between[0], between2: between[1] }, 'Created tension');
                }
            }
        }
    }

    /**
     * Upsert a behavioral relationship
     */
    async upsertBehavioralRelationship(projectId, fromPersonId, toPersonId, relationshipType, data) {
        const { strength, evidence } = data;

        // Check for existing relationship
        const { data: existing } = await this.supabase
            .from('behavioral_relationships')
            .select('*')
            .eq('project_id', projectId)
            .eq('from_contact_id', fromPersonId)
            .eq('to_contact_id', toPersonId)
            .eq('relationship_type', relationshipType)
            .single();

        if (existing) {
            // Update existing
            const existingEvidence = existing.evidence || [];
            const combinedEvidence = [...existingEvidence, ...evidence].slice(-10); // Keep last 10

            await this.supabase
                .from('behavioral_relationships')
                .update({
                    strength: Math.max(existing.strength, strength),
                    evidence: combinedEvidence,
                    evidence_count: combinedEvidence.length,
                    last_observed_at: new Date().toISOString()
                })
                .eq('id', existing.id);
        } else {
            // Insert new
            await this.supabase
                .from('behavioral_relationships')
                .insert({
                    project_id: projectId,
                    from_contact_id: fromPersonId,
                    to_contact_id: toPersonId,
                    relationship_type: relationshipType,
                    strength,
                    evidence,
                    evidence_count: evidence.length
                });
        }
    }

    /**
     * Get all profiles for a project
     */
    async getProfiles(projectId) {
        const { data, error } = await this.supabase
            .from('team_profiles')
            .select(`
                *,
                contact:contacts(id, name, role, organization, email, avatar_url, photo_url, aliases)
            `)
            .eq('project_id', projectId)
            .order('influence_score', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch profiles: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Get a single profile
     */
    async getProfile(projectId, personId) {
        const { data, error } = await this.supabase
            .from('team_profiles')
            .select(`
                *,
                contact:contacts(id, name, role, organization, email, avatar_url, photo_url, aliases)
            `)
            .eq('project_id', projectId)
            .eq('contact_id', personId)
            .single();

        if (error) {
            throw new Error(`Failed to fetch profile: ${error.message}`);
        }

        return data;
    }

    /**
     * Get team analysis for a project
     */
    async getTeamAnalysis(projectId) {
        const { data, error } = await this.supabase
            .from('team_analysis')
            .select('*')
            .eq('project_id', projectId)
            .single();

        if (error && error.code !== 'PGRST116') { // Not found is ok
            throw new Error(`Failed to fetch team analysis: ${error.message}`);
        }

        return data;
    }

    /**
     * Get behavioral relationships for a project
     */
    async getBehavioralRelationships(projectId) {
        const { data, error } = await this.supabase
            .from('behavioral_relationships')
            .select(`
                *,
                from_contact:contacts!from_contact_id(id, name),
                to_contact:contacts!to_contact_id(id, name)
            `)
            .eq('project_id', projectId)
            .order('strength', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch relationships: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Check access permission for team analysis
     */
    async checkAccess(projectId, userId) {
        // Get project config
        const { data: project } = await this.supabase
            .from('projects')
            .select('team_analysis_access, team_analysis_enabled, owner_id')
            .eq('id', projectId)
            .single();

        if (!project) return false;
        if (!project.team_analysis_enabled) return false;

        // Owner always has access
        if (project.owner_id === userId) return true;

        // Check access level
        if (project.team_analysis_access === 'all') return true;

        if (project.team_analysis_access === 'admin_only') {
            // Check if user is admin
            const { data: member } = await this.supabase
                .from('project_members')
                .select('role')
                .eq('project_id', projectId)
                .eq('user_id', userId)
                .single();

            return member?.role === 'admin' || member?.role === 'owner';
        }

        return false;
    }

    /**
     * Default behavioral prompt template (fallback)
     */
    getDefaultBehavioralPromptTemplate() {
        return `Analyze the following transcripts and create a behavioral profile for {{TARGET_NAME}}.

Relationship context: {{RELATIONSHIP_CONTEXT}}
Analysis objective: {{OBJECTIVE}}

Existing profile (if any): {{EXISTING_PROFILE}}

Transcripts:
{{TRANSCRIPTS_CONTENT}}

Provide your analysis as a JSON object with the following structure:
- communication_identity
- motivations_and_priorities
- behavior_under_pressure
- influence_tactics
- vulnerabilities
- interaction_strategy
- early_warning_signs
- power_analysis
- confidence_level
- limitations
- recommended_update_after`;
    }

    /**
     * Default team dynamics prompt template (fallback)
     */
    getDefaultTeamDynamicsPromptTemplate() {
        return `Analyze the following individual behavioral profiles and identify team dynamics.

Team members: {{TEAM_MEMBERS}}

Individual profiles:
{{INDIVIDUAL_PROFILES}}

Project context: {{PROJECT_CONTEXT}}

Provide your analysis as a JSON object with the following structure:
- team_size
- cohesion_score (0-100)
- tension_level (low/medium/high)
- dominant_communication_pattern
- influence_map
- alliances
- tensions
- power_centers
- communication_flow
- recommendations
- risk_factors`;
    }
}

module.exports = TeamAnalyzer;
