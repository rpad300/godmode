/**
 * Companies Module
 * CRUD and templates for user company profiles (branding, A4/PPT templates)
 */

const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'companies' });

const ALLOWED_FIELDS = ['name', 'description', 'logo_url', 'website_url', 'linkedin_url', 'brand_assets', 'a4_template_html', 'ppt_template_html'];
const TEMPLATE_TYPES = ['a4', 'ppt'];
const MAX_TEMPLATE_HTML_LENGTH = 500 * 1024; // 500 KB

const ANALYSIS_SECTION_COLUMNS = [
    'ficha_identidade', 'visao_geral', 'produtos_servicos', 'publico_alvo', 'equipa_lideranca',
    'presenca_digital', 'analise_competitiva', 'indicadores_crescimento', 'swot', 'conclusoes'
];

/**
 * List companies owned by a user
 */
async function listByUser(userId) {
    const supabase = getAdminClient();
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .eq('owner_id', userId)
            .order('name', { ascending: true });
        if (error) throw error;
        return { success: true, companies: data || [] };
    } catch (e) {
        log.warn({ event: 'companies_list_error', reason: e?.message }, 'List error');
        return { success: false, error: e.message };
    }
}

/**
 * Get a company by ID (admin client bypasses RLS; caller must enforce auth).
 * Attaches analysis_report from company_analyses table when present.
 */
async function getCompany(id) {
    const supabase = getAdminClient();
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        const company = data;
        const analysisResult = await getCompanyAnalysis(id);
        if (analysisResult.success && analysisResult.analysis) {
            const ba = company.brand_assets || {};
            const report = {};
            for (const key of ANALYSIS_SECTION_COLUMNS) {
                const v = analysisResult.analysis[key];
                report[key] = (typeof v === 'string' ? v : (v != null ? String(v) : '')) || '';
            }
            company.brand_assets = { ...ba, analysis_report: report };
            if (analysisResult.analysis.analyzed_at) company.brand_assets.analyzed_at = analysisResult.analysis.analyzed_at;
            if (analysisResult.analysis.primary_color != null) company.brand_assets.primary_color = analysisResult.analysis.primary_color;
            if (analysisResult.analysis.secondary_color != null) company.brand_assets.secondary_color = analysisResult.analysis.secondary_color;
            if (analysisResult.analysis.ai_context != null) company.brand_assets.ai_context = analysisResult.analysis.ai_context;
        }
        return { success: true, company };
    } catch (e) {
        log.warn({ event: 'companies_get_error', id, reason: e?.message }, 'Get error');
        return { success: false, error: e.message };
    }
}

/**
 * Get company analysis row (for ontology/graph and getCompany merge)
 */
async function getCompanyAnalysis(companyId) {
    const supabase = getAdminClient();
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
        const { data, error } = await supabase
            .from('company_analyses')
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();
        if (error) throw error;
        return { success: true, analysis: data };
    } catch (e) {
        log.warn({ event: 'company_analysis_get_error', companyId, reason: e?.message }, 'Get analysis error');
        return { success: false, error: e.message };
    }
}

/**
 * Upsert company analysis (one row per company; used after analyze)
 */
async function upsertCompanyAnalysis(companyId, payload) {
    const supabase = getAdminClient();
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
        const row = {
            company_id: companyId,
            analyzed_at: payload.analyzed_at || new Date().toISOString(),
            primary_color: payload.primary_color ?? null,
            secondary_color: payload.secondary_color ?? null,
            ai_context: payload.ai_context ?? null,
            ficha_identidade: payload.ficha_identidade ?? null,
            visao_geral: payload.visao_geral ?? null,
            produtos_servicos: payload.produtos_servicos ?? null,
            publico_alvo: payload.publico_alvo ?? null,
            equipa_lideranca: payload.equipa_lideranca ?? null,
            presenca_digital: payload.presenca_digital ?? null,
            analise_competitiva: payload.analise_competitiva ?? null,
            indicadores_crescimento: payload.indicadores_crescimento ?? null,
            swot: payload.swot ?? null,
            conclusoes: payload.conclusoes ?? null
        };
        const { data, error } = await supabase
            .from('company_analyses')
            .upsert(row, { onConflict: 'company_id' })
            .select()
            .single();
        if (error) throw error;
        return { success: true, analysis: data };
    } catch (e) {
        log.warn({ event: 'company_analysis_upsert_error', companyId, reason: e?.message }, 'Upsert analysis error');
        return { success: false, error: e.message };
    }
}

/**
 * Create a company
 */
async function createCompany({ name, description = null, logo_url = null, website_url = null, linkedin_url = null, ownerId }) {
    const supabase = getAdminClient();
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    if (!name || !name.trim()) return { success: false, error: 'Company name is required' };
    try {
        const { data, error } = await supabase
            .from('companies')
            .insert({
                name: name.trim(),
                description: description?.trim() || null,
                logo_url: logo_url?.trim() || null,
                website_url: website_url?.trim() || null,
                linkedin_url: linkedin_url?.trim() || null,
                owner_id: ownerId
            })
            .select()
            .single();
        if (error) throw error;
        return { success: true, company: data };
    } catch (e) {
        log.warn({ event: 'companies_create_error', reason: e?.message }, 'Create error');
        return { success: false, error: e.message };
    }
}

/**
 * Update a company (only allowed fields)
 */
async function updateCompany(id, updates) {
    const supabase = getAdminClient();
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    const filtered = {};
    for (const k of ALLOWED_FIELDS) {
        if (updates[k] !== undefined) {
            if (k === 'a4_template_html' || k === 'ppt_template_html') {
                if (typeof updates[k] === 'string' && updates[k].length > MAX_TEMPLATE_HTML_LENGTH)
                    return { success: false, error: 'Template HTML exceeds maximum size' };
            }
            filtered[k] = updates[k];
        }
    }
    if (Object.keys(filtered).length === 0) return await getCompany(id);
    try {
        const { data, error } = await supabase
            .from('companies')
            .update(filtered)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, company: data };
    } catch (e) {
        log.warn({ event: 'companies_update_error', id, reason: e?.message }, 'Update error');
        return { success: false, error: e.message };
    }
}

/**
 * Delete a company (fails if any project references it, per RESTRICT)
 */
async function deleteCompany(id) {
    const supabase = getAdminClient();
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
        const { error } = await supabase.from('companies').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (e) {
        log.warn({ event: 'companies_delete_error', id, reason: e?.message }, 'Delete error');
        return { success: false, error: e.message };
    }
}

/**
 * Get template HTML for a company (a4 or ppt)
 */
async function getTemplate(companyId, type) {
    if (!TEMPLATE_TYPES.includes(type)) return { success: false, error: 'Invalid template type' };
    const key = type === 'a4' ? 'a4_template_html' : 'ppt_template_html';
    const r = await getCompany(companyId);
    if (!r.success) return r;
    return { success: true, html: r.company[key] || '' };
}

/**
 * Update template HTML for a company
 */
async function updateTemplate(companyId, type, html) {
    if (!TEMPLATE_TYPES.includes(type)) return { success: false, error: 'Invalid template type' };
    if (typeof html !== 'string') return { success: false, error: 'HTML must be a string' };
    if (html.length > MAX_TEMPLATE_HTML_LENGTH) return { success: false, error: 'Template HTML exceeds maximum size' };
    const key = type === 'a4' ? 'a4_template_html' : 'ppt_template_html';
    return await updateCompany(companyId, { [key]: html });
}

module.exports = {
    listByUser,
    getCompany,
    getCompanyAnalysis,
    upsertCompanyAnalysis,
    createCompany,
    updateCompany,
    deleteCompany,
    getTemplate,
    updateTemplate,
    TEMPLATE_TYPES,
    MAX_TEMPLATE_HTML_LENGTH
};
