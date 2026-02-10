/**
 * Krisp Speaker Matcher
 * Matches speaker names from transcripts to contacts
 * REUTILIZES existing logic from src/supabase/storage.js
 */

const { logger } = require('../logger');
const { getAdminClient } = require('../supabase/client');

const log = logger.child({ module: 'speaker-matcher' });

// Pattern for unidentified speakers
const UNIDENTIFIED_PATTERN = /^(Speaker\s*\d+|Unknown|Guest|Participant)$/i;

// Minimum confidence threshold for automatic project assignment
const PROJECT_CONFIDENCE_THRESHOLD = 0.70; // 70%

/**
 * Check if a speaker name is unidentified (generic)
 */
function isUnidentifiedSpeaker(speakerName) {
    return UNIDENTIFIED_PATTERN.test(speakerName);
}

/**
 * Check if any speakers are unidentified
 */
function hasUnidentifiedSpeakers(speakers) {
    if (!speakers || !Array.isArray(speakers)) return false;
    return speakers.some(s => isUnidentifiedSpeaker(s));
}

/**
 * SpeakerMatcher Class
 * Wraps existing storage functions for Krisp-specific matching
 */
class SpeakerMatcher {
    constructor(storage = null) {
        this.storage = storage;
        this.supabase = getAdminClient();
    }

    /**
     * Set storage instance (for reusing existing contact matching logic)
     */
    setStorage(storage) {
        this.storage = storage;
    }

    /**
     * Find Krisp-specific speaker mapping
     * These are mappings created by users specifically for Krisp
     */
    async findKrispMapping(speakerName, projectId) {
        const normalizedName = speakerName.toLowerCase().trim();
        
        const { data, error } = await this.supabase
            .from('krisp_speaker_mappings')
            .select(`
                *,
                contacts (*)
            `)
            .eq('project_id', projectId)
            .ilike('speaker_name', normalizedName)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        if (error) {
            log.warn({ event: 'speaker_matcher_find_error', reason: error?.message }, 'Error finding mapping');
            return null;
        }

        if (data?.contacts) {
            return {
                contact: data.contacts,
                action: 'matched_by_krisp_mapping',
                confidence: data.confidence || 0.95
            };
        }

        return null;
    }

    /**
     * Find global Krisp mapping (applies to all projects)
     */
    async findGlobalKrispMapping(speakerName) {
        const normalizedName = speakerName.toLowerCase().trim();
        
        const { data, error } = await this.supabase
            .from('krisp_speaker_mappings')
            .select(`
                *,
                contacts (*)
            `)
            .ilike('speaker_name', normalizedName)
            .eq('is_global', true)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        if (error) {
            log.warn({ event: 'speaker_matcher_global_find_error', reason: error?.message }, 'Error finding global mapping');
            return null;
        }

        if (data?.contacts) {
            return {
                contact: data.contacts,
                action: 'matched_by_global_mapping',
                confidence: data.confidence || 0.90
            };
        }

        return null;
    }

    /**
     * Match a single speaker to a contact
     * Uses existing storage.findOrCreateContact() logic
     */
    async matchSpeakerToContact(speakerName, projectId) {
        // 1. Check if it's an unidentified speaker
        if (isUnidentifiedSpeaker(speakerName)) {
            return {
                contact: null,
                action: 'unidentified_speaker',
                confidence: 0
            };
        }

        // 2. Check Krisp-specific project mapping
        const krispMapping = await this.findKrispMapping(speakerName, projectId);
        if (krispMapping) {
            return krispMapping;
        }

        // 3. Check global Krisp mapping
        const globalMapping = await this.findGlobalKrispMapping(speakerName);
        if (globalMapping) {
            return globalMapping;
        }

        // 4. REUSE existing storage logic if available
        if (this.storage && typeof this.storage.findOrCreateContact === 'function') {
            try {
                // Temporarily set project context
                const originalProjectId = this.storage.getProjectId?.();
                this.storage.setProjectId?.(projectId);

                const personData = { name: speakerName };
                const result = await this.storage.findOrCreateContact(personData);

                // Restore original project context
                if (originalProjectId) {
                    this.storage.setProjectId?.(originalProjectId);
                }

                return result;
            } catch (err) {
                log.warn({ event: 'speaker_matcher_storage_error', reason: err?.message }, 'Storage error');
            }
        }

        // 5. Fallback: Direct database lookup
        return await this.findContactDirect(speakerName, projectId);
    }

    /**
     * Direct contact lookup (fallback when storage not available)
     * Implements same logic as storage.findOrCreateContact()
     */
    async findContactDirect(speakerName, projectId) {
        const normalizedName = speakerName.trim();

        // Try exact name match
        const { data: exactMatch } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('project_id', projectId)
            .ilike('name', normalizedName)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();

        if (exactMatch) {
            return {
                contact: exactMatch,
                action: 'matched_by_name_exact',
                confidence: 0.85
            };
        }

        // Try alias match
        const { data: aliasMatch } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('project_id', projectId)
            .contains('aliases', [normalizedName])
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();

        if (aliasMatch) {
            return {
                contact: aliasMatch,
                action: 'matched_by_alias',
                confidence: 0.85
            };
        }

        // Try partial name match
        const { data: partialMatch } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('project_id', projectId)
            .ilike('name', `%${normalizedName}%`)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();

        if (partialMatch) {
            return {
                contact: partialMatch,
                action: 'matched_by_name_partial',
                confidence: 0.6
            };
        }

        // No match found
        return {
            contact: null,
            action: 'no_match',
            confidence: 0
        };
    }

    /**
     * Match all speakers from a transcript
     */
    async matchAllSpeakers(speakers, projectId) {
        const results = [];
        let hasUnidentified = false;
        let allMatched = true;
        let matchedCount = 0;

        for (const speakerName of speakers) {
            const match = await this.matchSpeakerToContact(speakerName, projectId);

            if (match.action === 'unidentified_speaker') {
                hasUnidentified = true;
                allMatched = false;
            } else if (!match.contact) {
                allMatched = false;
            } else {
                matchedCount++;
            }

            results.push({
                speaker: speakerName,
                contact_id: match.contact?.id || null,
                contact_name: match.contact?.name || null,
                action: match.action,
                confidence: match.confidence
            });
        }

        return {
            results,
            hasUnidentified,
            allMatched,
            matchedCount,
            totalSpeakers: speakers.length
        };
    }

    /**
     * Get all projects where a user participates (any role)
     */
    async getUserProjects(userId) {
        const { data, error } = await this.supabase
            .from('project_members')
            .select(`
                project_id,
                role,
                projects (
                    id,
                    name
                )
            `)
            .eq('user_id', userId);

        if (error) {
            log.warn({ event: 'speaker_matcher_user_projects_error', reason: error?.message }, 'Error getting user projects');
            return [];
        }

        return data.map(pm => ({
            id: pm.projects.id,
            name: pm.projects.name,
            role: pm.role
        }));
    }

    /**
     * Get projects associated with a contact
     */
    async getContactProjects(contactId) {
        // Contacts belong to a single project in the current schema
        const { data: contact, error } = await this.supabase
            .from('contacts')
            .select('project_id, projects (id, name)')
            .eq('id', contactId)
            .single();

        if (error || !contact) {
            return [];
        }

        return [{
            id: contact.projects.id,
            name: contact.projects.name
        }];
    }

    /**
     * Identify project from matched speakers
     * Uses majority voting with confidence threshold
     */
    async identifyProjectFromSpeakers(matchedContacts, userId) {
        // Get user's projects (scope)
        const userProjects = await this.getUserProjects(userId);
        const userProjectIds = new Set(userProjects.map(p => p.id));

        if (userProjects.length === 0) {
            return {
                status: 'no_project',
                reason: 'User has no projects'
            };
        }

        // Count contacts per project
        const projectCounts = new Map();
        const projectDetails = new Map();

        for (const match of matchedContacts) {
            if (!match.contact_id) continue;

            const projects = await this.getContactProjects(match.contact_id);
            
            for (const project of projects) {
                // Only count if user participates in this project
                if (!userProjectIds.has(project.id)) continue;

                const count = (projectCounts.get(project.id) || 0) + 1;
                projectCounts.set(project.id, count);
                projectDetails.set(project.id, project);
            }
        }

        // Calculate percentages
        const totalMatched = matchedContacts.filter(m => m.contact_id).length;
        
        if (totalMatched === 0) {
            return {
                status: 'no_project',
                reason: 'No speakers matched to contacts'
            };
        }

        const projectScores = [];
        for (const [projectId, count] of projectCounts) {
            const percentage = count / totalMatched;
            const details = projectDetails.get(projectId);
            projectScores.push({
                projectId,
                projectName: details?.name,
                projectNumber: details?.projectNumber,
                count,
                percentage
            });
        }

        // Sort by percentage (highest first)
        projectScores.sort((a, b) => b.percentage - a.percentage);

        if (projectScores.length === 0) {
            return {
                status: 'no_project',
                reason: 'No contacts associated with user projects'
            };
        }

        const best = projectScores[0];
        const second = projectScores[1];

        // Check for tie
        if (second && best.percentage === second.percentage) {
            return {
                status: 'ambiguous',
                reason: 'Tie between projects',
                candidates: projectScores.filter(p => p.percentage === best.percentage)
            };
        }

        // Check threshold
        if (best.percentage < PROJECT_CONFIDENCE_THRESHOLD) {
            return {
                status: 'low_confidence',
                reason: `Only ${Math.round(best.percentage * 100)}% of speakers in project (min: 70%)`,
                candidates: projectScores
            };
        }

        // Success - clear winner above threshold
        return {
            status: 'matched',
            projectId: best.projectId,
            projectName: best.projectName,
            projectNumber: best.projectNumber,
            confidence: best.percentage,
            speakersInProject: best.count,
            totalMatched
        };
    }

    /**
     * Create a speaker mapping for future matching
     */
    async createMapping(userId, speakerName, contactId, projectId, options = {}) {
        const { isGlobal = false, confidence = 1.0, source = 'manual' } = options;

        const { data, error } = await this.supabase
            .from('krisp_speaker_mappings')
            .insert({
                user_id: isGlobal ? null : userId,
                speaker_name: speakerName.toLowerCase().trim(),
                contact_id: contactId,
                project_id: projectId,
                is_global: isGlobal,
                confidence,
                source,
                created_by: userId
            })
            .select()
            .single();

        if (error) {
            log.warn({ event: 'speaker_matcher_create_error', reason: error?.message }, 'Error creating mapping');
            return { success: false, error: error.message };
        }

        return { success: true, mapping: data };
    }

    /**
     * Delete a speaker mapping
     */
    async deleteMapping(mappingId, userId) {
        const { error } = await this.supabase
            .from('krisp_speaker_mappings')
            .update({ is_active: false })
            .eq('id', mappingId)
            .eq('user_id', userId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    /**
     * Get all mappings for a user
     */
    async getUserMappings(userId) {
        const { data, error } = await this.supabase
            .from('krisp_speaker_mappings')
            .select(`
                *,
                contacts (id, name)
            `)
            .or(`user_id.eq.${userId},is_global.eq.true`)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            log.warn({ event: 'speaker_matcher_get_mappings_error', reason: error?.message }, 'Error getting mappings');
            return [];
        }

        return data;
    }
}

module.exports = {
    SpeakerMatcher,
    isUnidentifiedSpeaker,
    hasUnidentifiedSpeakers,
    PROJECT_CONFIDENCE_THRESHOLD,
    UNIDENTIFIED_PATTERN
};
