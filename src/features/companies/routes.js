/**
 * Companies feature routes
 * CRUD, analyze, and template (A4/PPT) endpoints for company profiles
 */

const { parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');
const { isValidUUID } = require('../../server/security');
const companiesModule = require('../../supabase/companies');
const activity = require('../../supabase/activity');
const braveSearch = require('./braveSearch');

const RATE_LIMIT_ANALYZE_MS = 5 * 60 * 1000; // 5 minutes per company

/** Full company analysis report structure (PT) - sections for LLM output */
const ANALYSIS_REPORT_SECTIONS = [
    'ficha_identidade', 'visao_geral', 'produtos_servicos', 'publico_alvo', 'equipa_lideranca',
    'presenca_digital', 'analise_competitiva', 'indicadores_crescimento', 'swot', 'conclusoes'
];
const analyzeLastCall = new Map(); // companyId -> timestamp

/**
 * Get current user from request (Supabase auth)
 */
async function getCurrentUser(supabase, req) {
    if (!supabase?.auth?.extractToken || !supabase?.auth?.getUser) return null;
    const token = supabase.auth.extractToken(req);
    const result = await supabase.auth.getUser(token);
    return result?.success ? result.user : null;
}

/**
 * Check if user can read company (owner or project member)
 */
async function canReadCompany(adminClient, companyId, userId) {
    const { data: company } = await adminClient.from('companies').select('owner_id').eq('id', companyId).single();
    if (!company) return false;
    if (company.owner_id === userId) return true;
    const { data: projs } = await adminClient.from('projects').select('id').eq('company_id', companyId);
    if (!projs?.length) return false;
    const projectIds = projs.map(p => p.id);
    const { data: member } = await adminClient.from('project_members').select('project_id').in('project_id', projectIds).eq('user_id', userId).limit(1).maybeSingle();
    return !!member;
}

/**
 * Check if user owns company
 */
async function isOwner(adminClient, companyId, userId) {
    const { data } = await adminClient.from('companies').select('owner_id').eq('id', companyId).single();
    return data && data.owner_id === userId;
}

/**
 * Handle companies routes
 * @param {object} ctx - { req, res, pathname, supabase, config?, llm? }
 */
async function handleCompanies(ctx) {
    const { req, res, pathname, supabase, config = {}, llm } = ctx;
    const log = getLogger().child({ module: 'companies' });

    if (!pathname.startsWith('/api/companies')) return false;
    if (!supabase?.isConfigured?.()) {
        jsonResponse(res, { error: 'Not configured' }, 503);
        return true;
    }

    const user = await getCurrentUser(supabase, req);
    if (!user) {
        jsonResponse(res, { error: 'Authentication required' }, 401);
        return true;
    }
    const adminClient = supabase.getAdminClient ? supabase.getAdminClient() : null;
    if (!adminClient) {
        jsonResponse(res, { error: 'Server error' }, 500);
        return true;
    }

    // GET /api/companies - list user's companies
    if (pathname === '/api/companies' && req.method === 'GET') {
        const result = await companiesModule.listByUser(user.id);
        if (result.success) jsonResponse(res, { companies: result.companies });
        else jsonResponse(res, { error: result.error || 'Failed to list companies' }, 500);
        return true;
    }

    // POST /api/companies - create
    if (pathname === '/api/companies' && req.method === 'POST') {
        const body = await parseBody(req).catch(() => ({}));
        const name = body.name?.trim();
        if (!name) {
            jsonResponse(res, { error: 'Company name is required' }, 400);
            return true;
        }
        const result = await companiesModule.createCompany({
            name,
            description: body.description?.trim() || null,
            logo_url: body.logo_url?.trim() || null,
            website_url: body.website_url?.trim() || null,
            linkedin_url: body.linkedin_url?.trim() || null,
            ownerId: user.id
        });
        if (result.success) {
            if (activity.logActivity) activity.logActivity({ projectId: null, actorId: user.id, action: 'company.created', targetType: 'company', targetId: result.company.id, metadata: { name: result.company.name } });
            jsonResponse(res, { company: result.company });
        } else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // GET /api/companies/:id
    const getOneMatch = pathname.match(/^\/api\/companies\/([^/]+)$/);
    if (getOneMatch && req.method === 'GET') {
        const id = getOneMatch[1];
        if (!isValidUUID(id)) { jsonResponse(res, { error: 'Invalid company ID' }, 400); return true; }
        const result = await companiesModule.getCompany(id);
        if (!result.success) { jsonResponse(res, { error: result.error || 'Not found' }, 404); return true; }
        const canRead = await canReadCompany(adminClient, id, user.id);
        if (!canRead) { jsonResponse(res, { error: 'Forbidden' }, 403); return true; }
        jsonResponse(res, { company: result.company });
        return true;
    }

    // PUT /api/companies/:id
    const putMatch = pathname.match(/^\/api\/companies\/([^/]+)$/);
    if (putMatch && req.method === 'PUT') {
        const id = putMatch[1];
        if (!isValidUUID(id)) { jsonResponse(res, { error: 'Invalid company ID' }, 400); return true; }
        const owned = await isOwner(adminClient, id, user.id);
        if (!owned) { jsonResponse(res, { error: 'Only the owner can update this company' }, 403); return true; }
        const body = await parseBody(req).catch(() => ({}));
        const updates = {};
        if (body.name !== undefined) updates.name = body.name;
        if (body.description !== undefined) updates.description = body.description;
        if (body.logo_url !== undefined) updates.logo_url = body.logo_url;
        if (body.website_url !== undefined) updates.website_url = body.website_url;
        if (body.linkedin_url !== undefined) updates.linkedin_url = body.linkedin_url;
        if (body.brand_assets !== undefined) updates.brand_assets = body.brand_assets;
        const result = await companiesModule.updateCompany(id, updates);
        if (result.success) {
            if (activity.logActivity) activity.logActivity({ projectId: null, actorId: user.id, action: 'company.updated', targetType: 'company', targetId: id, metadata: { keys: Object.keys(updates) } });
            jsonResponse(res, { company: result.company });
        } else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // DELETE /api/companies/:id
    const delMatch = pathname.match(/^\/api\/companies\/([^/]+)$/);
    if (delMatch && req.method === 'DELETE') {
        const id = delMatch[1];
        if (!isValidUUID(id)) { jsonResponse(res, { error: 'Invalid company ID' }, 400); return true; }
        const owned = await isOwner(adminClient, id, user.id);
        if (!owned) { jsonResponse(res, { error: 'Only the owner can delete this company' }, 403); return true; }
        const result = await companiesModule.deleteCompany(id);
        if (result.success) {
            if (activity.logActivity) activity.logActivity({ projectId: null, actorId: user.id, action: 'company.deleted', targetType: 'company', targetId: id });
            jsonResponse(res, { success: true });
        } else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // POST /api/companies/:id/analyze - AI analysis (rate limited)
    const analyzeMatch = pathname.match(/^\/api\/companies\/([^/]+)\/analyze$/);
    if (analyzeMatch && req.method === 'POST') {
        const id = analyzeMatch[1];
        if (!isValidUUID(id)) { jsonResponse(res, { error: 'Invalid company ID' }, 400); return true; }
        const owned = await isOwner(adminClient, id, user.id);
        if (!owned) { jsonResponse(res, { error: 'Only the owner can run analysis' }, 403); return true; }
        const now = Date.now();
        if (analyzeLastCall.get(id) && (now - analyzeLastCall.get(id)) < RATE_LIMIT_ANALYZE_MS) {
            jsonResponse(res, { error: 'Please wait a few minutes before analyzing again' }, 429);
            return true;
        }
        const getRes = await companiesModule.getCompany(id);
        if (!getRes.success || !getRes.company) { jsonResponse(res, { error: 'Company not found' }, 404); return true; }
        const company = getRes.company;
        let websiteText = '';
        if (company.website_url) {
            try {
                const controller = new AbortController();
                const t = setTimeout(() => controller.abort(), 10000);
                const resp = await fetch(company.website_url, { signal: controller.signal, headers: { 'User-Agent': 'GodMode/1.0' } });
                clearTimeout(t);
                if (resp.ok) {
                    const html = await resp.text();
                    if (html.length < 200000) websiteText = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 15000);
                }
            } catch (e) { log.debug({ event: 'company_analyze_fetch_skip', reason: e.message }, 'Fetch website skipped'); }
        }

        let braveSnippets = '';
        let braveApiKey = process.env.BRAVE_API_KEY || '';
        if (!braveApiKey && supabase?.isConfigured?.()) {
            try {
                const secrets = require('../../supabase/secrets');
                const r = await secrets.getSecret('system', 'BRAVE_API_KEY');
                if (r.success && r.value) braveApiKey = r.value;
            } catch (_) { /* ignore */ }
        }
        if (braveApiKey && (company.name || company.website_url || company.linkedin_url)) {
            const queries = [];
            if (company.name) queries.push(company.name);
            try {
                const searchQuery = queries.length ? queries.join(' ') : (company.website_url || company.linkedin_url || '');
                const braveRes = await braveSearch.webSearch(braveApiKey, searchQuery, { count: 12 });
                if (braveRes.success) braveSnippets = braveSearch.snippetsFromResult(braveRes, 14000);
                if (company.website_url && company.name) {
                    try {
                        const u = new URL(company.website_url);
                        const siteQuery = `${company.name} site:${u.hostname}`;
                        const siteRes = await braveSearch.webSearch(braveApiKey, siteQuery, { count: 8 });
                        if (siteRes.success) {
                            const siteSnip = braveSearch.snippetsFromResult(siteRes, 8000);
                            if (siteSnip) braveSnippets = (braveSnippets ? braveSnippets + '\n\n' : '') + siteSnip;
                        }
                    } catch (_) { /* ignore */ }
                }
            } catch (e) { log.debug({ event: 'company_analyze_brave_skip', reason: e.message }, 'Brave search skipped'); }
        }

        const llmConfig = (require('../../llm/config') || {}).getTextConfig?.(config) || {};
        const provider = llmConfig.provider;
        const model = llmConfig.model;
        const providerConfig = llmConfig.providerConfig || {};
        if (!provider || !model || !llm?.generateText) {
            jsonResponse(res, { error: 'LLM not configured' }, 400);
            return true;
        }

        const reportSectionsStr = ANALYSIS_REPORT_SECTIONS.map(s => `"${s}"`).join(', ');
        const prompt = `És um analista de empresas. Produz uma análise profunda e detalhada em português (Portugal) com base nas fontes abaixo.

Fontes:
- Nome: ${company.name || ''}
- Site: ${company.website_url || ''}
- LinkedIn: ${company.linkedin_url || ''}
${websiteText ? `\nTexto do site (excerpt):\n${websiteText.slice(0, 10000)}` : ''}
${braveSnippets ? `\nResultados de pesquisa (Brave):\n${braveSnippets.slice(0, 12000)}` : ''}

Estrutura do relatório (usa "Informação não disponível publicamente" quando não houver dados):
1. ficha_identidade: Nome, slogan, sede, ano fundação, dimensão, setor, website/redes, contactos
2. visao_geral: Missão, visão, valores, proposta de valor, posicionamento, tom de marca, mensagens-chave
3. produtos_servicos: Lista de produtos/serviços, modelo de negócio, pricing, benefícios
4. publico_alvo: Segmentos (B2B/B2C/B2G), perfil do cliente, casos de sucesso
5. equipa_lideranca: Fundadores/C-Level, dimensão da equipa, cultura, vagas
6. presenca_digital: Website (UX), conteúdo, LinkedIn, redes, SEO, CTAs
7. analise_competitiva: Concorrentes, diferenciação, pontos fortes/fracos
8. indicadores_crescimento: Crescimento, investimento, prémios, parcerias, milestones
9. swot: Strengths, Weaknesses, Opportunities, Threats (resumido)
10. conclusoes: Resumo executivo 3-4 frases, maturidade digital (1-5), oportunidades, perguntas em aberto

Devolve UM ÚNICO objeto JSON com as chaves: "primary_color" (hex, ex: "#1a1a2e"), "secondary_color" (hex), "ai_context" (1-2 frases para branding), e as 10 secções: ${reportSectionsStr}. Cada secção é uma string (pode ter parágrafos). Sem markdown à volta do JSON.`;

        try {
            const result = await llm.generateText({ provider, providerConfig, model, prompt, temperature: 0.2, maxTokens: 6500, context: 'company-analyze' });
            const text = (result.text || result.response || '').trim();
            let parsed = {};
            try {
                const cleaned = text.replace(/^```json?\s*|\s*```$/g, '').trim();
                parsed = JSON.parse(cleaned);
            } catch (_) { parsed = {}; }

            const analyzedAt = new Date().toISOString();
            const primaryColor = (parsed.primary_color || (company.brand_assets && company.brand_assets.primary_color) || '').trim();
            const secondaryColor = (parsed.secondary_color || (company.brand_assets && company.brand_assets.secondary_color) || '').trim();
            const aiContext = (parsed.ai_context || (company.brand_assets && company.brand_assets.ai_context) || '').trim().slice(0, 500);

            const analysisPayload = {
                analyzed_at: analyzedAt,
                primary_color: primaryColor || null,
                secondary_color: secondaryColor || null,
                ai_context: aiContext || null
            };
            for (const key of ANALYSIS_REPORT_SECTIONS) {
                const v = parsed[key];
                analysisPayload[key] = (typeof v === 'string' ? v : (v ? String(v) : '')).trim() || 'Informação não disponível publicamente.';
            }
            const upsertRes = await companiesModule.upsertCompanyAnalysis(id, analysisPayload);
            if (!upsertRes.success) {
                log.warn({ event: 'company_analysis_upsert_failed', id, reason: upsertRes.error }, 'Analysis table upsert failed');
            }

            const brand_assets = {
                ...(company.brand_assets || {}),
                primary_color: primaryColor,
                secondary_color: secondaryColor,
                ai_context: aiContext,
                analyzed_at: analyzedAt
            };
            await companiesModule.updateCompany(id, { brand_assets });
            analyzeLastCall.set(id, now);
            jsonResponse(res, { success: true, company: (await companiesModule.getCompany(id)).company });
        } catch (e) {
            log.warn({ event: 'company_analyze_error', id, reason: e.message }, 'Analyze failed');
            jsonResponse(res, { error: e.message || 'Analysis failed' }, 500);
        }
        return true;
    }

    // GET /api/companies/:id/templates/:type
    const getTplMatch = pathname.match(/^\/api\/companies\/([^/]+)\/templates\/(a4|ppt)$/);
    if (getTplMatch && req.method === 'GET') {
        const [, id, type] = getTplMatch;
        if (!isValidUUID(id)) { jsonResponse(res, { error: 'Invalid company ID' }, 400); return true; }
        const canRead = await canReadCompany(adminClient, id, user.id);
        if (!canRead) { jsonResponse(res, { error: 'Forbidden' }, 403); return true; }
        const result = await companiesModule.getTemplate(id, type);
        if (result.success) jsonResponse(res, { html: result.html });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // PUT /api/companies/:id/templates/:type
    const putTplMatch = pathname.match(/^\/api\/companies\/([^/]+)\/templates\/(a4|ppt)$/);
    if (putTplMatch && req.method === 'PUT') {
        const [, id, type] = putTplMatch;
        if (!isValidUUID(id)) { jsonResponse(res, { error: 'Invalid company ID' }, 400); return true; }
        const owned = await isOwner(adminClient, id, user.id);
        if (!owned) { jsonResponse(res, { error: 'Only the owner can update templates' }, 403); return true; }
        const body = await parseBody(req).catch(() => ({}));
        const html = body.html != null ? String(body.html) : '';
        const result = await companiesModule.updateTemplate(id, type, html);
        if (result.success) jsonResponse(res, { success: true, company: result.company });
        else jsonResponse(res, { error: result.error }, 400);
        return true;
    }

    // POST /api/companies/:id/templates/generate
    const genTplMatch = pathname.match(/^\/api\/companies\/([^/]+)\/templates\/generate$/);
    if (genTplMatch && req.method === 'POST') {
        const id = genTplMatch[1];
        if (!isValidUUID(id)) { jsonResponse(res, { error: 'Invalid company ID' }, 400); return true; }
        const owned = await isOwner(adminClient, id, user.id);
        if (!owned) { jsonResponse(res, { error: 'Only the owner can generate templates' }, 403); return true; }
        const body = await parseBody(req).catch(() => ({}));
        const type = (body.type || 'a4') === 'ppt' ? 'ppt' : 'a4';
        const getRes = await companiesModule.getCompany(id);
        if (!getRes.success || !getRes.company) { jsonResponse(res, { error: 'Company not found' }, 404); return true; }
        const company = getRes.company;
        const llmCfg = (require('../../llm/config') || {}).getTextConfigForReasoning?.(config) || (require('../../llm/config') || {}).getTextConfig?.(config) || {};
        const provider = llmCfg.provider;
        const model = llmCfg.model;
        const providerConfig = llmCfg.providerConfig || {};
        if (!provider || !model || !llm?.generateText) {
            jsonResponse(res, { error: 'LLM not configured' }, 400);
            return true;
        }
        const isA4 = type === 'a4';
        const placeholders = 'Use these placeholders: {{COMPANY_NAME}}, {{COMPANY_LOGO_URL}}, {{PRIMARY_COLOR}}, {{SECONDARY_COLOR}}, {{REPORT_DATA}}.';
        const prompt = `Generate a single complete HTML file for a ${isA4 ? 'professional A4 document' : 'presentation (PPT-style slides)'} template for this company.
Company: ${company.name || 'Company'}
Logo URL: ${company.logo_url || ''}
Primary color: ${(company.brand_assets && company.brand_assets.primary_color) || '#1a1a2e'}
Secondary color: ${(company.brand_assets && company.brand_assets.secondary_color) || '#16213e'}
${placeholders}
${isA4 ? 'Use A4 dimensions (e.g. 794px x 1123px per page), header with logo and company name, footer with page numbers. Include a main content area where {{REPORT_DATA}} will be injected.' : 'Use slide-based layout (each section is a slide), title slide with logo, content slides with {{REPORT_DATA}} area.'}
Return only the HTML code, no markdown or explanation.`;
        try {
            const result = await llm.generateText({ provider, providerConfig, model, prompt, temperature: 0.3, maxTokens: 8192, context: 'company-template-generate' });
            let html = (result.text || result.response || '').trim();
            html = html.replace(/^```html?\s*|\s*```$/g, '').trim();
            if (!html) { jsonResponse(res, { error: 'No HTML generated' }, 500); return true; }
            const updateResult = await companiesModule.updateTemplate(id, type, html);
            if (updateResult.success) jsonResponse(res, { success: true, html, company: updateResult.company });
            else jsonResponse(res, { error: updateResult.error }, 400);
        } catch (e) {
            log.warn({ event: 'company_template_generate_error', id, type, reason: e.message }, 'Generate failed');
            jsonResponse(res, { error: e.message || 'Generation failed' }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleCompanies };
