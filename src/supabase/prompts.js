/**
 * Purpose:
 *   Dynamic prompt template storage and context-variable generation for AI
 *   extraction pipelines. Replaces hardcoded prompt strings with DB-managed
 *   templates that can be edited at runtime, and builds per-project context
 *   variables (contacts, orgs, usernames, domains) injected into those templates.
 *
 * Responsibilities:
 *   - Load and cache active prompt templates from the `system_prompts` table
 *   - Retrieve individual prompts by key with 5-minute TTL in-memory cache
 *   - Save/update prompt templates with user attribution
 *   - Build context variables (CONTACTS_INDEX, ORG_INDEX, PROJECT_INDEX,
 *     USERNAME_MAP, DOMAIN_MAP, company branding) from project data
 *   - Render prompt templates by substituting {{PLACEHOLDER}} variables
 *   - Generate deterministic short hashes for content deduplication
 *
 * Key dependencies:
 *   - ./client (getAdminClient): Supabase admin client
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - `loadPrompts` reads from `system_prompts` and populates the module-level cache
 *   - `savePrompt` writes to `system_prompts` and updates the local cache
 *   - Context builders read from `contacts`, `teams`, `projects`, `companies`
 *
 * Notes:
 *   - Cache TTL is 5 minutes; `clearCache` forces an immediate reload on next access.
 *   - Context variable builders enforce a token budget (1 token ~ 4 chars) to
 *     prevent prompt bloat; budget is allocated proportionally (contacts get 50%).
 *   - `renderPrompt` strips any unmatched {{PLACEHOLDER}} tags after substitution
 *     so prompts degrade gracefully when variables are unavailable.
 *   - `buildContextVariables` fetches company branding from `projects` -> `companies`
 *     join; errors are silently swallowed to avoid breaking the extraction pipeline.
 */

const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'prompts' });

// Cache prompts in memory
let promptsCache = {};
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load all active prompts from database
 */
async function loadPrompts() {
    const admin = getAdminClient();
    if (!admin) {
        log.debug({ event: 'prompts_no_client' }, 'No database client, using defaults');
        return null;
    }

    try {
        const { data, error } = await admin
            .from('system_prompts')
            .select('key, name, description, category, prompt_template, uses_ontology, ontology_section')
            .eq('is_active', true);

        if (error) {
            log.warn({ event: 'prompts_load_failed', reason: error.message }, 'Failed to load');
            return null;
        }

        // Index by key
        const prompts = {};
        for (const prompt of data || []) {
            prompts[prompt.key] = prompt;
        }

        promptsCache = prompts;
        cacheTimestamp = Date.now();
        log.debug({ event: 'prompts_loaded', count: Object.keys(prompts).length }, 'Loaded prompts from database');

        return prompts;
    } catch (err) {
        log.warn({ event: 'prompts_exception', reason: err.message }, 'Exception');
        return null;
    }
}

/**
 * Get a prompt template by key
 * @param {string} key - Prompt key (document, transcript, vision, conversation, email, summary)
 * @returns {Promise<object|null>} Prompt object or null
 */
async function getPrompt(key) {
    // Check cache freshness
    if (Date.now() - cacheTimestamp > CACHE_TTL || Object.keys(promptsCache).length === 0) {
        await loadPrompts();
    }

    return promptsCache[key] || null;
}

/**
 * Get all prompts
 * @returns {Promise<object>} All prompts indexed by key
 */
async function getAllPrompts() {
    if (Date.now() - cacheTimestamp > CACHE_TTL || Object.keys(promptsCache).length === 0) {
        await loadPrompts();
    }

    return promptsCache;
}

/**
 * Save/update a prompt
 * @param {string} key - Prompt key
 * @param {string} promptTemplate - New prompt template
 * @param {string} userId - User making the change
 */
async function savePrompt(key, promptTemplate, userId = null) {
    const admin = getAdminClient();
    if (!admin) {
        return { success: false, error: 'Database not configured' };
    }

    try {
        const { data, error } = await admin
            .from('system_prompts')
            .update({
                prompt_template: promptTemplate,
                updated_at: new Date().toISOString(),
                updated_by: userId
            })
            .eq('key', key)
            .select()
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        // Update cache
        if (promptsCache[key]) {
            promptsCache[key] = data;
        }

        return { success: true, prompt: data };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Clear the cache to force reload
 */
function clearCache() {
    promptsCache = {};
    cacheTimestamp = 0;
}

// ============================================
// CONTEXT VARIABLE GENERATORS (v1.6)
// ============================================

/**
 * Build CONTACTS_INDEX for entity resolution
 * @param {string} projectId - Project ID
 * @param {number} maxTokens - Max tokens for this section (optional)
 * @returns {Promise<string>} Formatted contacts index
 */
async function buildContactsIndex(projectId, maxTokens = 2000) {
    const admin = getAdminClient();
    if (!admin || !projectId) return '';

    try {
        const { data, error } = await admin
            .from('contacts')
            .select('name, email, organization, role, aliases')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .order('interaction_count', { ascending: false })
            .limit(100);

        if (error || !data?.length) return '';

        let result = '## KNOWN CONTACTS\n';
        let charCount = result.length;
        const maxChars = maxTokens * 4; // Rough estimate: 1 token ≈ 4 chars

        for (const contact of data) {
            const aliasStr = contact.aliases?.length 
                ? ` [aliases: ${contact.aliases.join(', ')}]` 
                : '';
            const emailStr = contact.email ? ` (${contact.email})` : '';
            const roleOrgStr = [contact.role, contact.organization]
                .filter(Boolean)
                .join(' at ');
            
            const line = `- ${contact.name}${emailStr}${roleOrgStr ? ` - ${roleOrgStr}` : ''}${aliasStr}\n`;
            
            if (charCount + line.length > maxChars) break;
            result += line;
            charCount += line.length;
        }

        return result;
    } catch (err) {
        log.warn({ event: 'prompts_build_contacts_index_failed', reason: err.message }, 'Failed to build CONTACTS_INDEX');
        return '';
    }
}

/**
 * Build ORG_INDEX for organization resolution
 * @param {string} projectId - Project ID
 * @param {number} maxTokens - Max tokens for this section
 * @returns {Promise<string>} Formatted organizations index
 */
async function buildOrgIndex(projectId, maxTokens = 500) {
    const admin = getAdminClient();
    if (!admin || !projectId) return '';

    try {
        // Get organizations from teams table
        const { data: teams, error: teamsError } = await admin
            .from('teams')
            .select('name')
            .eq('project_id', projectId)
            .eq('team_type', 'organization')
            .is('deleted_at', null)
            .limit(50);

        // Get unique organizations from contacts
        const { data: contacts, error: contactsError } = await admin
            .from('contacts')
            .select('organization')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .not('organization', 'is', null);

        if ((teamsError && contactsError) || (!teams?.length && !contacts?.length)) return '';

        // Combine and deduplicate
        const orgs = new Set();
        teams?.forEach(t => orgs.add(t.name));
        contacts?.forEach(c => c.organization && orgs.add(c.organization));

        if (!orgs.size) return '';

        let result = '## KNOWN ORGANIZATIONS\n';
        let charCount = result.length;
        const maxChars = maxTokens * 4;

        for (const org of orgs) {
            const line = `- ${org}\n`;
            if (charCount + line.length > maxChars) break;
            result += line;
            charCount += line.length;
        }

        return result;
    } catch (err) {
        log.warn({ event: 'prompts_build_org_index_failed', reason: err.message }, 'Failed to build ORG_INDEX');
        return '';
    }
}

/**
 * Build PROJECT_INDEX for project linking
 * @param {string} projectId - Project ID (current project)
 * @param {number} maxTokens - Max tokens for this section
 * @returns {Promise<string>} Formatted projects index
 */
async function buildProjectIndex(projectId, maxTokens = 500) {
    const admin = getAdminClient();
    if (!admin) return '';

    try {
        // Get projects the user has access to
        const { data, error } = await admin
            .from('projects')
            .select('name, code, owner_id')
            .is('deleted_at', null)
            .limit(20);

        if (error || !data?.length) return '';

        let result = '## KNOWN PROJECTS\n';
        let charCount = result.length;
        const maxChars = maxTokens * 4;

        for (const project of data) {
            const codeStr = project.code ? ` (code: ${project.code})` : '';
            const line = `- ${project.name}${codeStr}\n`;
            if (charCount + line.length > maxChars) break;
            result += line;
            charCount += line.length;
        }

        return result;
    } catch (err) {
        log.warn({ event: 'prompts_build_project_index_failed', reason: err.message }, 'Failed to build PROJECT_INDEX');
        return '';
    }
}

/**
 * Build USERNAME_MAP for chat handle resolution
 * @param {string} projectId - Project ID
 * @param {number} maxTokens - Max tokens for this section
 * @returns {Promise<string>} Formatted username mappings
 */
async function buildUsernameMap(projectId, maxTokens = 500) {
    const admin = getAdminClient();
    if (!admin || !projectId) return '';

    try {
        // Get contacts with metadata that might contain handles
        const { data, error } = await admin
            .from('contacts')
            .select('name, email, metadata')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .not('metadata', 'is', null);

        if (error || !data?.length) return '';

        let result = '## USERNAME MAPPINGS\n';
        let charCount = result.length;
        const maxChars = maxTokens * 4;
        let hasEntries = false;

        for (const contact of data) {
            const meta = contact.metadata || {};
            const handles = [];
            
            // Look for common handle fields
            if (meta.slack_handle) handles.push(`@${meta.slack_handle}`);
            if (meta.teams_handle) handles.push(`@${meta.teams_handle}`);
            if (meta.github_handle) handles.push(`@${meta.github_handle}`);
            if (meta.username) handles.push(`@${meta.username}`);

            for (const handle of handles) {
                const emailStr = contact.email ? ` (${contact.email})` : '';
                const line = `${handle} -> ${contact.name}${emailStr}\n`;
                if (charCount + line.length > maxChars) break;
                result += line;
                charCount += line.length;
                hasEntries = true;
            }
        }

        return hasEntries ? result : '';
    } catch (err) {
        log.warn({ event: 'prompts_build_username_map_failed', reason: err.message }, 'Failed to build USERNAME_MAP');
        return '';
    }
}

/**
 * Build DOMAIN_MAP for email domain resolution
 * @param {string} projectId - Project ID
 * @param {number} maxTokens - Max tokens for this section
 * @returns {Promise<string>} Formatted domain mappings
 */
async function buildDomainMap(projectId, maxTokens = 300) {
    const admin = getAdminClient();
    if (!admin || !projectId) return '';

    try {
        // Get contacts with email and organization
        const { data, error } = await admin
            .from('contacts')
            .select('email, organization')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .not('email', 'is', null)
            .not('organization', 'is', null);

        if (error || !data?.length) return '';

        // Build domain to org mapping
        const domainMap = new Map();
        for (const contact of data) {
            const domain = contact.email.split('@')[1]?.toLowerCase();
            if (domain && !domainMap.has(domain)) {
                domainMap.set(domain, contact.organization);
            }
        }

        if (!domainMap.size) return '';

        let result = '## EMAIL DOMAINS\n';
        let charCount = result.length;
        const maxChars = maxTokens * 4;

        for (const [domain, org] of domainMap) {
            const line = `${domain} -> ${org}\n`;
            if (charCount + line.length > maxChars) break;
            result += line;
            charCount += line.length;
        }

        return result;
    } catch (err) {
        log.warn({ event: 'prompts_build_domain_map_failed', reason: err.message }, 'Failed to build DOMAIN_MAP');
        return '';
    }
}

/**
 * Build all context variables for a project in parallel.
 * Allocates a token budget proportionally across variable types
 * (contacts 50%, orgs 15%, projects 15%, usernames 10%, domains 10%).
 * Also fetches company branding from the projects -> companies join.
 * @param {string} projectId - Project ID
 * @param {number} [availableTokens=4000] - Total available tokens for context
 * @returns {Promise<object>} Object with all context variable strings plus company vars
 */
async function buildContextVariables(projectId, availableTokens = 4000) {
    if (!projectId) {
        return {
            CONTACTS_INDEX: '',
            ORG_INDEX: '',
            PROJECT_INDEX: '',
            USERNAME_MAP: '',
            DOMAIN_MAP: ''
        };
    }

    // Allocate tokens by priority (CONTACTS_INDEX gets most)
    const budget = {
        contacts: Math.floor(availableTokens * 0.50),  // 50%
        orgs: Math.floor(availableTokens * 0.15),      // 15%
        projects: Math.floor(availableTokens * 0.15), // 15%
        usernames: Math.floor(availableTokens * 0.10), // 10%
        domains: Math.floor(availableTokens * 0.10)    // 10%
    };

    // Build all in parallel
    const [contacts, orgs, projects, usernames, domains] = await Promise.all([
        buildContactsIndex(projectId, budget.contacts),
        buildOrgIndex(projectId, budget.orgs),
        buildProjectIndex(projectId, budget.projects),
        buildUsernameMap(projectId, budget.usernames),
        buildDomainMap(projectId, budget.domains)
    ]);

    // Company vars for project (branding in documents)
    let companyVars = { COMPANY_NAME: '', COMPANY_LOGO_URL: '', COMPANY_PRIMARY_COLOR: '', COMPANY_SECONDARY_COLOR: '', COMPANY_AI_CONTEXT: '' };
    try {
        const admin = getAdminClient();
        if (admin && projectId) {
            const { data: proj } = await admin.from('projects').select('company_id, company:companies(id, name, logo_url, brand_assets)').eq('id', projectId).single();
            if (proj?.company) {
                const c = proj.company;
                const brand = c.brand_assets || {};
                companyVars = {
                    COMPANY_NAME: c.name || '',
                    COMPANY_LOGO_URL: c.logo_url || '',
                    COMPANY_PRIMARY_COLOR: brand.primary_color || '',
                    COMPANY_SECONDARY_COLOR: brand.secondary_color || '',
                    COMPANY_AI_CONTEXT: brand.ai_context || ''
                };
            }
        }
    } catch (e) { /* ignore */ }

    return {
        CONTACTS_INDEX: contacts,
        ORG_INDEX: orgs,
        PROJECT_INDEX: projects,
        USERNAME_MAP: usernames,
        DOMAIN_MAP: domains,
        ...companyVars
    };
}

/**
 * Generate a short hash from content for deterministic IDs
 * @param {string} content - Content to hash
 * @returns {string} Short hash (8 chars)
 */
function generateContentHash(content) {
    if (!content) return 'unknown';
    
    // Simple hash function for deterministic IDs
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    // Convert to base36 and take first 8 chars
    return Math.abs(hash).toString(36).substring(0, 8).padStart(8, '0');
}

/**
 * Render a prompt template by substituting {{PLACEHOLDER}} variables.
 * Auto-generates CONTENT_HASH from CONTENT if not explicitly provided.
 * Strips any unmatched {{UPPERCASE_PLACEHOLDERS}} after substitution so
 * prompts degrade gracefully when context variables are unavailable.
 * @param {string} template - Prompt template with {{PLACEHOLDERS}}
 * @param {object} variables - Variables to substitute
 * @returns {string} Rendered prompt
 */
function renderPrompt(template, variables = {}) {
    let rendered = template;

    // Auto-generate CONTENT_HASH if CONTENT is provided but CONTENT_HASH is not
    if (variables.CONTENT && !variables.CONTENT_HASH) {
        variables.CONTENT_HASH = generateContentHash(variables.CONTENT);
    }

    for (const [key, value] of Object.entries(variables)) {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        rendered = rendered.replace(placeholder, value || '');
    }

    // Remove any unmatched placeholders
    rendered = rendered.replace(/\{\{[A-Z_]+\}\}/g, '');

    return rendered;
}

module.exports = {
    loadPrompts,
    getPrompt,
    getAllPrompts,
    savePrompt,
    clearCache,
    renderPrompt,
    generateContentHash,
    // Context variable builders (v1.6)
    buildContactsIndex,
    buildOrgIndex,
    buildProjectIndex,
    buildUsernameMap,
    buildDomainMap,
    buildContextVariables
};
