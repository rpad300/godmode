/**
 * Purpose:
 *   Company profile management API routes. Provides CRUD operations, AI-powered
 *   company analysis (web scraping + Brave Search + LLM), and branded document
 *   template generation (A4 reports and PPT-style presentations).
 *
 * Responsibilities:
 *   - Company CRUD: list (user's companies), create, get, update, delete
 *   - Authorization: owner-only for mutations; reader access for project members
 *   - AI company analysis: scrapes website, searches via Brave API, sends context
 *     to LLM for a structured 10-section Portuguese analysis report (SWOT, digital
 *     presence, competitive analysis, etc.)
 *   - Stores analysis results in company_analysis table and brand_assets on company
 *   - Template CRUD: get/update HTML templates for A4 and PPT formats
 *   - AI template generation: LLM generates branded HTML templates using company colors/logo
 *   - Rate limiting: 5-minute cooldown per company for analysis endpoint
 *
 * Key dependencies:
 *   - ../../supabase/companies: Data access layer for companies and company_analysis
 *   - ../../supabase/activity: Activity logging for company events
 *   - ./braveSearch: Brave Search API client for web research
 *   - ../../llm/config: LLM provider/model resolution
 *   - ../../supabase/secrets: Retrieves BRAVE_API_KEY from system secrets if not in env
 *
 * Side effects:
 *   - Database: creates/updates/deletes companies, company_analysis, brand_assets
 *   - Network: fetches company website HTML, calls Brave Search API, calls LLM API
 *   - Activity log: records company.created, company.updated, company.deleted events
 *
 * Notes:
 *   - Analysis prompt and report sections are in Portuguese (Portugal)
 *   - The in-memory analyzeLastCall Map enforces rate limiting but resets on server restart
 *   - Website scraping strips scripts/styles and truncates to 15K chars
 *   - Brave Search results are concatenated with site:-scoped queries for deeper coverage
 *   - Template placeholders: {{COMPANY_NAME}}, {{LOGO_URL}}, {{PRIMARY_COLOR}},
 *     {{SECONDARY_COLOR}}, {{REPORT_DATA}}
 *   - Default A4 and PPT templates are embedded as HTML string literals in this file
 *   - Template generation uses the reasoning model variant when available
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
        let braveApiKey = '';
        try {
            const secrets = require('../../supabase/secrets');
            // Try canonical name first, then legacy UPPERCASE
            let r = await secrets.getSecret('system', 'brave_api_key');
            if (!r.success || !r.value) {
                r = await secrets.getSecret('system', 'BRAVE_API_KEY');
            }
            if (r.success && r.value) braveApiKey = r.value;
        } catch (_) { /* Supabase not available */ }
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

    const DEFAULT_TEMPLATES = {
        a4: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{COMPANY_NAME}} - Report</title>
    <style>
        :root {
            --primary: {{PRIMARY_COLOR}};
            --secondary: {{SECONDARY_COLOR}};
            --text: #333333;
            --bg: #ffffff;
            --page-width: 210mm;
            --page-height: 297mm;
        }
        @page { size: A4; margin: 0; }
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #eee; color: var(--text); }
        .page {
            width: var(--page-width);
            height: var(--page-height);
            background: var(--bg);
            margin: 0 auto;
            position: relative;
            overflow: hidden;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .header { background: var(--primary); height: 80px; display: flex; align-items: center; justify-content: space-between; padding: 0 40px; color: white; }
        .logo { height: 50px; background: rgba(255,255,255,0.9); padding: 5px; border-radius: 4px; }
        .footer { position: absolute; bottom: 0; width: 100%; height: 50px; border-top: 1px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #777; }
        .content { padding: 40px; }
        h1 { color: var(--primary); }
        h2 { color: var(--secondary); border-bottom: 2px solid var(--secondary); padding-bottom: 5px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <h1 style="color: white; margin: 0; font-size: 24px;">{{COMPANY_NAME}}</h1>
            <img src="{{LOGO_URL}}" alt="Logo" class="logo" />
        </div>
        <div class="content">
            <h1>Relatório de Análise</h1>
            <p>Gerado para <strong>{{COMPANY_NAME}}</strong></p>
            <div style="margin-top: 20px;">
                {{REPORT_DATA}}
            </div>
        </div>
        <div class="footer">
            {{COMPANY_NAME}} &copy; 2024 - Confidential
        </div>
    </div>
</body>
</html>`,
        ppt: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{COMPANY_NAME}} - Presentation</title>
    <style>
        :root {
            --primary: {{PRIMARY_COLOR}};
            --secondary: {{SECONDARY_COLOR}};
            --slide-bg: #ffffff;
            --text: #333333;
            --slide-width: 297mm; /* A4 Landscape */
            --slide-height: 210mm;
        }
        @page { size: A4 landscape; margin: 0; }
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #eee; color: var(--text); }
        .slide {
            width: var(--slide-width);
            height: var(--slide-height);
            background: var(--slide-bg);
            margin: 0 auto 20px auto;
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
        }
        .slide-header { height: 15%; background: linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%); display: flex; align-items: center; justify-content: space-between; padding: 0 40px; }
        .slide-title { color: white; font-size: 28px; font-weight: bold; margin: 0; }
        .logo { height: 40px; background: rgba(255,255,255,0.9); padding: 5px; border-radius: 4px; }
        .slide-content { flex: 1; padding: 40px; display: flex; flex-direction: column; }
        .slide-footer { height: 8%; border-top: 1px solid #ddd; display: flex; align-items: center; justify-content: space-between; padding: 0 40px; font-size: 14px; color: #666; }
        h2 { color: var(--primary); margin-top: 0; }
        
        /* Cover Slide Style */
        .slide.cover { justify-content: center; align-items: center; text-align: center; background: url('https://source.unsplash.com/random/1600x900/?office') no-repeat center center; background-size: cover; position: relative; }
        .slide.cover::before { content: ''; position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.7); z-index: 1; }
        .slide.cover > * { z-index: 2; color: white; }
        .slide.cover h1 { font-size: 48px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px; }
        .slide.cover p { font-size: 24px; opacity: 0.9; }
        .slide.cover img.logo { height: 80px; margin-bottom: 20px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); background: rgba(255,255,255,0.9); padding: 10px; border-radius: 8px; }
    </style>
</head>
<body>
    <!-- Cover Slide -->
    <div class="slide cover">
        <img src="{{LOGO_URL}}" alt="Logo" class="logo" />
        <h1>{{COMPANY_NAME}}</h1>
        <p>Strategic Overview & Analysis</p>
    </div>

    <!-- Agenda Slide -->
    <div class="slide">
        <div class="slide-header">
            <h1 class="slide-title">Agenda</h1>
            <img src="{{LOGO_URL}}" alt="Logo" class="logo" />
        </div>
        <div class="slide-content">
            <ul>
                <li>Executive Summary</li>
                <li>Market Analysis</li>
                <li>Strategic Recommendations</li>
            </ul>
        </div>
        <div class="slide-footer">
            <span>{{COMPANY_NAME}}</span>
            <span>Page 1</span>
        </div>
    </div>

    <!-- Content Slide Placeholder -->
    <div class="slide">
        <div class="slide-header">
            <h1 class="slide-title">Analysis Data</h1>
            <img src="{{LOGO_URL}}" alt="Logo" class="logo" />
        </div>
        <div class="slide-content">
            {{REPORT_DATA}}
        </div>
        <div class="slide-footer">
            <span>{{COMPANY_NAME}}</span>
            <span>Page 2</span>
        </div>
    </div>
</body>
</html>`
    };

    // GET /api/companies/:id/templates/:type
    const getTplMatch = pathname.match(/^\/api\/companies\/([^/]+)\/templates\/(a4|ppt)$/);
    if (getTplMatch && req.method === 'GET') {
        const [, id, type] = getTplMatch;
        if (!isValidUUID(id)) { jsonResponse(res, { error: 'Invalid company ID' }, 400); return true; }
        const canRead = await canReadCompany(adminClient, id, user.id);
        if (!canRead) { jsonResponse(res, { error: 'Forbidden' }, 403); return true; }
        const result = await companiesModule.getTemplate(id, type);

        // Use default template if none exists
        let html = result.success ? result.html : null;
        if (!html) {
            html = DEFAULT_TEMPLATES[type] || '';
        }

        jsonResponse(res, { html });
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
