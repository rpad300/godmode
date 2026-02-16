/**
 * Companies Panel - Integrated view for Settings page
 * Adapted from CompaniesModal to work as a sub-view
 */

import { createElement, on } from '@lib/dom';
import { toast } from '@services/toast';
import {
    listCompanies,
    getCompany,
    createCompany,
    updateCompany,
    deleteCompany,
    analyzeCompany,
    getTemplate,
    updateTemplate,
    generateTemplate,
    type Company,
    type CreateCompanyRequest,
    type TemplateType,
} from '@services/companies';

/** UI strings - centralised for i18n */
const S = {
    title: 'Companies',
    newCompany: '+ New company',
    noCompanies: 'No companies yet. Create one to use in projects.',
    edit: 'Edit',
    analyze: 'Analyze',
    reAnalyze: 'Re-analyze',
    viewDetail: 'View',
    detail: 'Company detail',
    analyzedOn: 'Analyzed',
    notAnalyzed: 'Not analyzed',
    delete: 'Delete',
    backToList: 'Companies', // Breadcrumb root
    name: 'Name *',
    description: 'Description',
    logoUrl: 'Logo URL',
    website: 'Website',
    linkedIn: 'LinkedIn',
    save: 'Save',
    create: 'Create',
    cancel: 'Cancel',
    invalidUrl: 'Please enter a valid URL',
    updateFailed: 'Update failed',
    createFailed: 'Create failed',
    loadFailed: 'Failed to load company',
    analysisComplete: 'Analysis complete',
    analysisFailed: 'Analysis failed',
    deleteConfirm: 'Delete this company? Projects using it must be reassigned first.',
    companyDeleted: 'Company deleted',
    templates: 'Templates (A4 / PPT)',
    templateA4: 'A4 document',
    templatePPT: 'Presentation',
    generateWithAI: 'Generate base with AI',
    loadCurrent: 'Load current',
    saveTemplate: 'Save template',
    templateLoaded: 'Template loaded',
    templateSaved: 'Template saved',
    templateGenerated: 'Template generated',
    templateLoadFailed: 'Failed to load template',
    templateSaveFailed: 'Failed to save template',
    templateGenerateFailed: 'Generation failed',
};

function escapeHtml(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function isValidUrl(value: string): boolean {
    if (!value || !value.trim()) return true;
    try {
        const u = new URL(value.trim());
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Renders a breadcrumb navigation
 */
function renderBreadcrumbs(parts: { label: string; onClick?: () => void }[]): string {
    return `
    <div class="companies-breadcrumbs">
      ${parts.map((part, index) => {
        const isLast = index === parts.length - 1;
        if (isLast) {
            return `<span class="companies-breadcrumb-active">${escapeHtml(part.label)}</span>`;
        }
        return `
          <span class="breadcrumb-link companies-breadcrumb-link">${escapeHtml(part.label)}</span>
          <span class="companies-breadcrumb-separator">/</span>
        `;
    }).join('')}
    </div>
  `;
}

export function initCompaniesPanel(container: HTMLElement): void {
    // Clear container
    container.innerHTML = '';

    // Create a content wrapper
    const contentWrapper = createElement('div', { className: 'companies-panel-content' });
    container.appendChild(contentWrapper);

    function renderList(items: Company[]) {
        const listEl = contentWrapper.querySelector('#companies-list');
        if (!listEl) return;

        // Breadcrumbs for root
        const breadcrumbsContainer = contentWrapper.querySelector('.breadcrumbs-slot');
        if (breadcrumbsContainer) {
            breadcrumbsContainer.innerHTML = renderBreadcrumbs([{ label: 'Settings' }, { label: 'Companies' }]);
        }

        const list = Array.isArray(items) ? items : [];

        try {
            if (list.length === 0) {
                listEl.innerHTML = `<p class="companies-empty-state">${escapeHtml(S.noCompanies)}</p>`;
                return;
            }
            const analyzedAt = (c: Company) => c.brand_assets?.analyzed_at;
            listEl.innerHTML = list
                .map(
                    (c) => {
                        const analyzed = !!analyzedAt(c);
                        const analyzeLabel = analyzed ? S.reAnalyze : S.analyze;
                        const analyzedBadge = analyzed
                            ? `<span class="companies-analyzed-badge" title="${escapeHtml(analyzedAt(c) || '')}">${escapeHtml(S.analyzedOn)}</span>`
                            : `<span class="companies-not-analyzed-badge">${escapeHtml(S.notAnalyzed)}</span>`;

                        return `
      <div class="companies-row" data-id="${c.id}">
        <div class="companies-logo-wrapper">
          ${c.logo_url ? `<img src="${escapeHtml(c.logo_url)}" alt="" class="companies-logo">` : '<span class="companies-logo-placeholder">🏢</span>'}
          <div>
            <div class="companies-name-group">
                <strong class="companies-name">${escapeHtml(c.name)}</strong>
                ${analyzedBadge}
            </div>
            ${(c.brand_assets?.primary_color && c.brand_assets?.secondary_color) ? `<div class="companies-colors"><div class="companies-color-pill" style="background: ${escapeHtml(c.brand_assets.primary_color)};"></div><div class="companies-color-pill" style="background: ${escapeHtml(c.brand_assets.secondary_color)};"></div></div>` : ''}
            ${c.website_url ? `<a href="${escapeHtml(c.website_url)}" target="_blank" class="companies-website-link">${escapeHtml(c.website_url.replace(/^https?:\/\//, ''))}</a>` : ''}
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-sm btn-secondary companies-detail-btn" data-id="${c.id}" title="View analysis">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg> 
            <span class="desktop-only">${escapeHtml(S.viewDetail)}</span>
          </button>
          <button type="button" class="btn btn-sm btn-secondary companies-edit-btn" data-id="${c.id}" title="${escapeHtml(S.edit)}">
             <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
             <span class="desktop-only">${escapeHtml(S.edit)}</span>
          </button>
          <button type="button" class="btn btn-sm btn-secondary companies-templates-list-btn" data-id="${c.id}" title="${escapeHtml(S.templates)}">
             <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
             <span class="desktop-only">${escapeHtml(S.templates)}</span>
          </button>
          <button type="button" class="btn btn-sm btn-secondary companies-analyze-btn" data-id="${c.id}" title="Analyze with AI">
             <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
             <span class="desktop-only">${escapeHtml(analyzeLabel)}</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger companies-delete-btn" data-id="${c.id}">
             <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>
    `;
                    }
                )
                .join('');
        } catch {
            listEl.innerHTML = `<p class="text-error">${escapeHtml(S.loadFailed)}</p>`;
        }
    }

    function loadList() {
        const listEl = contentWrapper.querySelector('#companies-list');
        if (listEl) listEl.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-secondary);"><div class="spinner"></div> Loading companies...</div>';
        listCompanies()
            .then((list) => renderList(Array.isArray(list) ? list : []))
            .catch(() => {
                const el = contentWrapper.querySelector('#companies-list');
                if (el) el.innerHTML = `<p class="text-error">${escapeHtml(S.loadFailed)}</p>`;
            });
    }

    function showListView() {
        contentWrapper.innerHTML = `
      <div class="breadcrumbs-slot"></div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <h2 style="font-size: 1.5rem; margin: 0; font-weight: 600;">Companies</h2>
             <p style="margin: 4px 0 0 0; color: var(--text-secondary);">Manage company profiles and assets</p>
          </div>
          <button type="button" class="btn btn-primary" id="companies-new-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="margin-right: 6px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            ${escapeHtml(S.newCompany)}
          </button>
      </div>
      <div id="companies-list" style="max-width: 800px;">Loading...</div>
    `;

        bindListEvents(); // Re-bind since we replaced HTML
        loadList();
    }

    function showForm(company?: Company) {
        const isEdit = !!company;
        const title = isEdit ? `Edit ${company.name}` : 'New Company';

        // Breadcrumbs
        const crumbs = [
            { label: 'Settings' },
            { label: 'Companies', onClick: showListView },
            { label: isEdit ? 'Edit' : 'New' }
        ];

        contentWrapper.innerHTML = `
      <div class="settings-breadcrumbs-container"></div>
      
      <div style="max-width: 600px;">
          <h2 style="font-size: 1.5rem; margin: 0 0 24px 0; font-weight: 600;">${escapeHtml(title)}</h2>
          
          <form id="company-form" class="company-form">
            <div class="form-group">
              <label>${escapeHtml(S.name)}</label>
              <input type="text" name="name" required value="${company ? escapeHtml(company.name) : ''}" class="form-input">
            </div>
            
            <div class="form-group">
              <label>${escapeHtml(S.description)}</label>
              <textarea name="description" rows="3" class="form-textarea">${company?.description ? escapeHtml(company.description) : ''}</textarea>
            </div>
            
            <div class="form-group">
              <label>${escapeHtml(S.logoUrl)}</label>
              <input type="url" name="logo_url" value="${company?.logo_url ? escapeHtml(company.logo_url) : ''}" class="form-input" placeholder="https://...">
            </div>
            
            <div class="form-row">
                <div class="form-group">
                  <label>${escapeHtml(S.website)}</label>
                  <input type="url" name="website_url" value="${company?.website_url ? escapeHtml(company.website_url) : ''}" class="form-input" placeholder="https://...">
                </div>
                <div class="form-group">
                  <label>${escapeHtml(S.linkedIn)}</label>
                  <input type="url" name="linkedin_url" value="${company?.linkedin_url ? escapeHtml(company.linkedin_url) : ''}" class="form-input" placeholder="https://linkedin.com/...">
                </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" style="min-width: 100px;">${isEdit ? escapeHtml(S.save) : escapeHtml(S.create)}</button>
              <button type="button" class="btn btn-secondary" id="company-form-cancel">${escapeHtml(S.cancel)}</button>
            </div>
            
            ${isEdit && company ? `
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border-color);">
              <h3 style="font-size: 1rem; margin-bottom: 12px;">Documents</h3>
              <button type="button" class="btn btn-outline-secondary" id="companies-templates-btn" style="display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                ${escapeHtml(S.templates)}
              </button>
            </div>
            ` : ''}
          </form>
      </div>
    `;

        const breadcrumbsContainer = contentWrapper.querySelector('.settings-breadcrumbs-container');
        if (breadcrumbsContainer) breadcrumbsContainer.innerHTML = renderBreadcrumbs(crumbs);

        // Bind breadcrumbs clicks
        const listLink = breadcrumbsContainer?.querySelector('.breadcrumb-link');
        if (listLink) on(listLink as HTMLElement, 'click', showListView);

        on(contentWrapper.querySelector('#company-form') as HTMLFormElement, 'submit', async (e) => {
            e.preventDefault();
            const form = contentWrapper.querySelector('#company-form') as HTMLFormElement;
            const fd = new FormData(form);
            const logoUrl = (fd.get('logo_url') as string)?.trim() || undefined;
            const websiteUrl = (fd.get('website_url') as string)?.trim() || undefined;
            const linkedinUrl = (fd.get('linkedin_url') as string)?.trim() || undefined;
            if (logoUrl && !isValidUrl(logoUrl)) { toast.error(S.invalidUrl + ' (Logo)'); return; }
            if (websiteUrl && !isValidUrl(websiteUrl)) { toast.error(S.invalidUrl + ' (Website)'); return; }
            if (linkedinUrl && !isValidUrl(linkedinUrl)) { toast.error(S.invalidUrl + ' (LinkedIn)'); return; }
            const data: CreateCompanyRequest = {
                name: (fd.get('name') as string).trim(),
                description: (fd.get('description') as string)?.trim() || undefined,
                logo_url: logoUrl,
                website_url: websiteUrl,
                linkedin_url: linkedinUrl,
            };
            try {
                if (isEdit && company) {
                    await updateCompany(company.id, data);
                    toast.success('Company updated');
                } else {
                    await createCompany(data);
                    toast.success('Company created');
                }
                showListView();
            } catch {
                toast.error(isEdit ? S.updateFailed : S.createFailed);
            }
        });

        on(contentWrapper.querySelector('#company-form-cancel') as HTMLElement, 'click', showListView);

        if (isEdit && company) {
            const templatesBtn = contentWrapper.querySelector('#companies-templates-btn');
            if (templatesBtn) on(templatesBtn as HTMLElement, 'click', () => showTemplateEditor(company));
        }
    }

    function showTemplateEditor(company: Company) {
        let currentType: TemplateType = 'a4';
        let activeTab: 'code' | 'theme' = 'code';

        const crumbs = [
            { label: 'Settings' },
            { label: 'Companies', onClick: showListView },
            { label: 'Edit ' + company.name, onClick: () => showForm(company) },
            { label: 'Templates' }
        ];

        contentWrapper.innerHTML = `
      <div class="settings-breadcrumbs-container"></div>
      
      <div class="template-editor-layout">
          <h2 class="companies-title">${escapeHtml(company.name)} – ${escapeHtml(S.templates)}</h2>
          <p class="companies-subtitle">Manage the document templates for this company.</p>

          <div class="template-toolbar">
              <div class="template-toolbar-group">
                <button type="button" class="btn btn-sm template-type-btn active" data-type="a4">${escapeHtml(S.templateA4)}</button>
                <button type="button" class="btn btn-sm template-type-btn" data-type="ppt">${escapeHtml(S.templatePPT)}</button>
              </div>
              <div class="template-toolbar-group">
                <button type="button" class="btn btn-sm btn-secondary" id="template-load-btn">${escapeHtml(S.loadCurrent)}</button>
                <button type="button" class="btn btn-sm btn-primary" id="template-generate-btn">${escapeHtml(S.generateWithAI)}</button>
                <button type="button" class="btn btn-sm btn-primary" id="template-save-btn">${escapeHtml(S.saveTemplate)}</button>
              </div>
          </div>
          
          <div class="template-workspace">
            <!-- Left Column: Editor & Controls -->
            <div class="template-sidebar">
                <!-- Tabs -->
                <div class="template-tabs">
                    <button type="button" class="template-tab-btn active" data-tab="code">Code</button>
                    <button type="button" class="template-tab-btn" data-tab="theme">Theme</button>
                </div>

                <!-- Code Tab -->
                <div id="editor-tab-code" class="flex-1 flex-col">
                    <textarea id="template-html-editor" class="template-code-area" placeholder="HTML template..."></textarea>
                </div>

                <!-- Theme Tab -->
                <div id="editor-tab-theme" class="template-theme-list hidden">
                    <p class="text-secondary mb-4 text-sm">Detected styles from <code>:root</code> variables. Change colors to update the template.</p>
                    <div id="theme-variables-list" class="flex flex-col gap-3"></div>
                </div>
            </div>

            <!-- Right Column: Preview -->
            <div class="template-preview-pane">
                <div class="template-preview-label">Preview</div>
                <div class="template-preview-container">
                    <iframe id="template-preview-frame" class="template-preview-frame" sandbox="allow-same-origin allow-scripts"></iframe>
                </div>
            </div>
          </div>
      </div>
      <style>
        /* Template Type Buttons */
        .template-type-btn {
            background: var(--bg-surface);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
        }
        .template-type-btn:hover {
            background: var(--bg-hover);
        }
        .template-type-btn.active {
            background: var(--primary);
            color: #ffffff !important;
            border-color: var(--primary);
        }
      </style>
    `;

        const breadcrumbsContainer = contentWrapper.querySelector('.settings-breadcrumbs-container');
        if (breadcrumbsContainer) {
            breadcrumbsContainer.innerHTML = renderBreadcrumbs(crumbs);
            const links = breadcrumbsContainer.querySelectorAll('.breadcrumb-link');
            if (links[0]) on(links[0] as HTMLElement, 'click', showListView);
            if (links[1]) on(links[1] as HTMLElement, 'click', () => showForm(company));
        }

        const editor = contentWrapper.querySelector('#template-html-editor') as HTMLTextAreaElement;
        const loadBtn = contentWrapper.querySelector('#template-load-btn') as HTMLButtonElement;
        const genBtn = contentWrapper.querySelector('#template-generate-btn') as HTMLButtonElement;
        const saveBtn = contentWrapper.querySelector('#template-save-btn') as HTMLButtonElement;
        const iframe = contentWrapper.querySelector('#template-preview-frame') as HTMLIFrameElement;
        const themeList = contentWrapper.querySelector('#theme-variables-list') as HTMLElement;
        const codeTabBtn = contentWrapper.querySelector('.template-tab-btn[data-tab="code"]') as HTMLElement;
        const themeTabBtn = contentWrapper.querySelector('.template-tab-btn[data-tab="theme"]') as HTMLElement;
        const codeTab = contentWrapper.querySelector('#editor-tab-code') as HTMLElement;
        const themeTab = contentWrapper.querySelector('#editor-tab-theme') as HTMLElement;

        // --- Preview Logic ---
        function processTemplateForPreview(html: string): string {
            if (!html) return '';
            let processed = html;

            // Basic Replacements
            processed = processed.replace(/\{\{COMPANY_NAME\}\}/g, escapeHtml(company.name));
            processed = processed.replace(/\{\{COMPANY_DESCRIPTION\}\}/g, escapeHtml(company.description || ''));
            processed = processed.replace(/\{\{WEBSITE_URL\}\}/g, escapeHtml(company.website_url || ''));

            // Color Replacements (from brand assets)
            const primary = company.brand_assets?.primary_color || '#000000';
            const secondary = company.brand_assets?.secondary_color || '#666666';
            processed = processed.replace(/\{\{PRIMARY_COLOR\}\}/g, primary);
            processed = processed.replace(/\{\{SECONDARY_COLOR\}\}/g, secondary);

            // Logo Replacement:
            // 1. If we have a logo URL on the company, always try to use it.
            //    This replaces any existing {{LOGO_URL}} in the template.
            if (company.logo_url) {
                processed = processed.replace(/\{\{LOGO_URL\}\}/gi, company.logo_url);
            } else {
                // 2. If no logo URL, replace with a nice placeholder
                processed = processed.replace(/\{\{LOGO_URL\}\}/gi, 'https://placehold.co/200x80/EEE/31343C?text=LOGO');
            }

            // Mock Report Data for Preview (so it looks populated)
            const mockData = `
            <h2>1. Ficha de Identidade</h2>
                <p><strong>Nome: </strong> ${escapeHtml(company.name)}</p>
                    <p><strong>Setor: </strong> Consultoria Tecnológica</p>
                        <p><strong>Descrição: </strong> ${escapeHtml(company.description || 'Empresa líder em inovação...')}</p>

                            <h2>2. Visão Geral</h2>
                                <p>A ${escapeHtml(company.name)} demonstra um forte posicionamento no mercado...</p>

                                    <h2>3. Análise SWOT</h2>
                                        <ul>
                                        <li><strong>Forças: </strong> Tecnologia proprietária, Equipa experiente</li>
                                            <li><strong>Fraquezas: </strong> Baixa presença internacional</li>
                                                </ul>
                                                    `;
            processed = processed.replace(/\{\{REPORT_DATA\}\}/g, mockData);

            return processed;
        }

        function updatePreview() {
            const doc = iframe.contentDocument;
            if (!doc) return;

            const rawHtml = editor.value || '';
            const processedHtml = processTemplateForPreview(rawHtml);

            doc.open();
            doc.write(processedHtml);
            doc.close();
        }

        // Debounce update
        let debounceTimer: any;
        editor.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                updatePreview();
                if (activeTab === 'theme') extractAndRenderTheme();
            }, 300);
        });

        // --- Tab Logic ---
        function switchTab(tab: 'code' | 'theme') {
            activeTab = tab;
            if (tab === 'code') {
                codeTabBtn.classList.add('active');
                themeTabBtn.classList.remove('active');
                codeTab.style.display = 'flex';
                themeTab.style.display = 'none';
            } else {
                codeTabBtn.classList.remove('active');
                themeTabBtn.classList.add('active');
                codeTab.style.display = 'none';
                themeTab.style.display = 'flex';
                extractAndRenderTheme();
            }
        }
        on(codeTabBtn, 'click', () => switchTab('code'));
        on(themeTabBtn, 'click', () => switchTab('theme'));

        // --- Visual Editor Logic ---
        function extractAndRenderTheme() {
            const html = editor.value || '';

            // 1. Try to find style block content first
            const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
            const cssContent = styleMatch ? styleMatch[1] : html;

            // 2. Match :root block (case insensitive, multiline)
            const rootMatch = cssContent.match(/:root\s*\{([\s\S]*?)\}/i);

            if (!rootMatch) {
                themeList.innerHTML = '<p style="color: var(--text-secondary);">No <code>:root</code> CSS variables found. Ensure your template has a <code>&lt;style&gt;:root { ... }&lt;/style&gt;</code> block.</p>';
                return;
            }

            const rootContent = rootMatch[1];
            // Regex to find --variable: value;
            // Improved to handle value ending with ; or } (last item)
            // and ignore comments /* ... */ (basic handling)
            const cleanContent = rootContent.replace(/\/\*[\s\S]*?\*\//g, '');

            const varRegex = /--([a-zA-Z0-9-]+):\s*([^;\}]+)/g;
            let match;
            const vars: { name: string, value: string }[] = [];

            while ((match = varRegex.exec(cleanContent)) !== null) {
                vars.push({ name: match[1], value: match[2].trim() });
            }

            themeList.innerHTML = '';

            vars.forEach(v => {
                // Determine input type
                const isColor = /^#[0-9A-Fa-f]{3,8}$|^rgb|^hsl/.test(v.value);

                const div = document.createElement('div');
                div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px; background: var(--bg-hover); border-radius: 6px;';

                div.innerHTML = `
                                                <div style="font-weight: 500; font-size: 0.9em; color: var(--text-primary);">${escapeHtml(v.name)}</div>
                                                    <div style="display: flex; align-items: center; gap: 8px;">
                                                        ${isColor ? `<input type="color" data-var="${v.name}" value="${v.value.startsWith('#') ? v.value.substring(0, 7) : '#000000'}" style="width: 32px; height: 32px; padding: 0; border: none; border-radius: 4px; cursor: pointer;">` : ''}
        <input type="text" data-var="${v.name}" value="${escapeHtml(v.value)}" style="width: 100px; padding: 4px 8px; font-size: 0.85em; border-radius: 4px; border: 1px solid var(--border-color); color: var(--text-primary); background: var(--bg-surface);">
            </div>
                `;
                themeList.appendChild(div);

                // Bind change events
                const inputs = div.querySelectorAll('input');
                inputs.forEach(input => {
                    input.addEventListener('input', (e) => {
                        const newVal = (e.target as HTMLInputElement).value;
                        const otherInput = inputs.length > 1 ? (input.type === 'color' ? inputs[1] : inputs[0]) : null;
                        if (otherInput) otherInput.value = newVal; // Sync hex text <-> color picker

                        updateVariable(v.name, newVal);
                    });
                });
            });
        }

        function updateVariable(name: string, value: string) {
            let css = editor.value;
            // Replace the specific variable value in :root
            // We use a safe regex that looks for the variable definition
            const re = new RegExp(`(--${name}: \\s *)([^;]+) (;)`);
            if (re.test(css)) {
                editor.value = css.replace(re, `$1${value} $3`);
                updatePreview();
            }
        }

        function setType(type: TemplateType) {
            currentType = type;
            contentWrapper.querySelectorAll('.template-type-btn').forEach((b) => b.classList.toggle('active', (b as HTMLElement).getAttribute('data-type') === type));

            // Adjust Preview Dimensions
            if (type === 'ppt') {
                iframe.style.width = '297mm'; // Landscape A4 / Slide
                iframe.style.minHeight = '210mm';
            } else {
                iframe.style.width = '210mm'; // Portrait A4
                iframe.style.minHeight = '297mm';
            }

            // Reload template
            getTemplate(company.id, currentType).then((html) => {
                editor.value = html;
                updatePreview();
                if (activeTab === 'theme') extractAndRenderTheme();
            }).catch(() => { editor.value = ''; updatePreview(); });
        }

        contentWrapper.querySelectorAll('.template-type-btn').forEach((btn) => {
            on(btn as HTMLElement, 'click', () => setType((btn.getAttribute('data-type') as TemplateType) || 'a4'));
        });

        // Button Listeners
        on(loadBtn, 'click', async () => {
            loadBtn.disabled = true;
            try {
                const html = await getTemplate(company.id, currentType);
                editor.value = html;
                updatePreview();
                if (activeTab === 'theme') extractAndRenderTheme();
                toast.success(S.templateLoaded);
            } catch {
                toast.error(S.templateLoadFailed);
            } finally {
                loadBtn.disabled = false;
            }
        });

        on(genBtn, 'click', async () => {
            genBtn.disabled = true;
            genBtn.textContent = '...';
            try {
                const { html } = await generateTemplate(company.id, currentType);
                editor.value = html;
                updatePreview();
                if (activeTab === 'theme') extractAndRenderTheme();
                toast.success(S.templateGenerated);
            } catch {
                toast.error(S.templateGenerateFailed);
            } finally {
                genBtn.disabled = false;
                genBtn.textContent = S.generateWithAI;
            }
        });

        on(saveBtn, 'click', async () => {
            saveBtn.disabled = true;
            try {
                await updateTemplate(company.id, currentType, editor.value);
                toast.success(S.templateSaved);
            } catch {
                toast.error(S.templateSaveFailed);
            } finally {
                saveBtn.disabled = false;
            }
        });

        // Initial load
        getTemplate(company.id, currentType).then((html) => {
            editor.value = html;
            updatePreview();
        }).catch(() => { });
    }

    const REPORT_SECTION_LABELS: Record<string, string> = {
        ficha_identidade: '1. Ficha de Identidade',
        visao_geral: '2. Visão Geral e Posicionamento',
        produtos_servicos: '3. Produtos e Serviços',
        publico_alvo: '4. Público-Alvo e Clientes',
        equipa_lideranca: '5. Equipa e Liderança',
        presenca_digital: '6. Presença Digital e Marketing',
        analise_competitiva: '7. Análise Competitiva',
        indicadores_crescimento: '8. Indicadores de Crescimento',
        swot: '9. Análise SWOT',
        conclusoes: '10. Conclusões e Insights',
    };

    function showDetailView(company: Company) {
        const ba = company.brand_assets;
        const report = ba?.analysis_report || {};
        const hasReport = Object.keys(report).length > 0;

        // Section Keys
        const identityKey = 'ficha_identidade';
        const otherKeys = Object.keys(REPORT_SECTION_LABELS).filter(k => k !== identityKey);
        const allKeys = [identityKey, ...otherKeys];

        // State for active section
        let activeSectionKey = identityKey;

        // Breadcrumbs
        const crumbs = [
            { label: 'Settings' },
            { label: 'Companies', onClick: showListView },
            { label: company.name }
        ];

        // Header Elements (Logo, etc)
        const logoBlock = company.logo_url
            ? `<img src="${escapeHtml(company.logo_url)}" alt="" class="companies-detail-logo" style="width: 56px; height: 56px; object-fit: contain; background: white; padding: 4px; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 1px 3px rgba(0,0,0,0.05);" onerror="this.style.display='none'">`
            : '<span class="companies-detail-logo-placeholder" style="width: 56px; height: 56px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--border-color) 100%); border-radius: 8px; font-size: 24px; color: var(--text-secondary);">🏢</span>';

        const baPrimary = ba?.primary_color || '—';
        const baSecondary = ba?.secondary_color || '—';
        const colorBlock = (baPrimary !== '—' || baSecondary !== '—')
            ? `
            <div style="display: flex; gap: 6px; align-items: center; justify-content: center; padding: 4px 8px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px;" title="Brand Colors">
                ${baPrimary !== '—' ? `<span style="width: 14px; height: 14px; border-radius: 3px; background: ${escapeHtml(baPrimary)}; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);"></span>` : ''}
            ${baSecondary !== '—' ? `<span style="width: 14px; height: 14px; border-radius: 3px; background: ${escapeHtml(baSecondary)}; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);"></span>` : ''}
        </div>
            ` : '';

        // Main Layout Template
        // Main Layout Template
        contentWrapper.innerHTML = `
            <div class="settings-breadcrumbs-container"></div>

            <div class="companies-list-container">

                <!-- Header -->
                <div class="detail-header-card">
                    ${logoBlock}
                    <div class="flex-1">
                        <div class="flex-item-center gap-sm mb-1">
                            <h3 class="companies-title" style="font-size: 1.4rem;">${escapeHtml(company.name)}</h3>
                            ${colorBlock}
                        </div>
                        <div class="flex-item-center gap-md">
                            ${company.website_url ? `<a href="${escapeHtml(company.website_url)}" target="_blank" class="companies-website-link flex-item-center gap-xs"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg> ${escapeHtml(company.website_url.replace(/^https?:\/\//, ''))}</a>` : ''}
                            ${company.linkedin_url ? `<a href="${escapeHtml(company.linkedin_url)}" target="_blank" class="companies-website-link flex-item-center gap-xs" style="color: #0077b5;"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg> LinkedIn</a>` : ''}
                        </div>
                    </div>

                    <div class="companies-actions">
                        <button type="button" class="btn btn-sm btn-primary" id="companies-detail-reanalyze-btn" data-id="${escapeHtml(company.id)}">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="margin-right: 6px;"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            ${escapeHtml(S.reAnalyze)}
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary" id="companies-detail-edit-btn" data-id="${escapeHtml(company.id)}">
                            ${escapeHtml(S.edit)}
                        </button>
                    </div>
                </div>

                <!-- Content Grid -->
                <div class="companies-detail-grid">
                    
                    <!-- Sidebar -->
                    <div class="detail-sidebar">
                        <div class="detail-sidebar-header">Report Sections</div>
                        
                        ${hasReport ? allKeys.map(key => {
            const label = REPORT_SECTION_LABELS[key] || key;
            const cleanLabel = label.replace(/^\d+\.\s*/, '');
            return `
                            <div class="detail-sidebar-item ${key === activeSectionKey ? 'active' : ''}" data-key="${key}" role="button">
                                <span>${escapeHtml(cleanLabel)}</span>
                                ${key === activeSectionKey ? '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>' : ''}
                            </div>
                            `;
        }).join('') : `<div class="companies-empty-state-sm">No report data available.</div>`}
                    </div>

                    <!-- Main Content Area -->
                    <div class="detail-content-area custom-scrollbar" id="detail-content-main">
                        <!-- Content injected via JS -->
                    </div>
                </div>
            </div>
        `;
        // Wire Breadcrumbs
        const breadcrumbsContainer = contentWrapper.querySelector('.settings-breadcrumbs-container');
        if (breadcrumbsContainer) {
            breadcrumbsContainer.innerHTML = renderBreadcrumbs(crumbs);
            const links = breadcrumbsContainer.querySelectorAll('.breadcrumb-link');
            if (links[0]) on(links[0] as HTMLElement, 'click', showListView);
        }

        // Header Actions
        on(contentWrapper.querySelector('#companies-detail-edit-btn') as HTMLElement, 'click', () => showForm(company));

        const reanalyzeBtn = contentWrapper.querySelector('#companies-detail-reanalyze-btn') as HTMLButtonElement;
        on(reanalyzeBtn, 'click', async () => {
            reanalyzeBtn.disabled = true;
            reanalyzeBtn.innerHTML = '<span class="spinner-sm"></span> Analyzing...';
            try {
                const updated = await analyzeCompany(company.id);
                toast.success(S.analysisComplete);
                showDetailView(updated);
            } catch {
                toast.error(S.analysisFailed);
                reanalyzeBtn.innerHTML = S.reAnalyze; // Restore icon too
                reanalyzeBtn.disabled = false;
            }
        });

        // Content Rendering Logic
        const contentArea = contentWrapper.querySelector('#detail-content-main') as HTMLElement;
        const sidebarItems = contentWrapper.querySelectorAll('.detail-sidebar-item');

        function renderActiveContent() {
            if (!hasReport) {
                contentArea.innerHTML = `< div style = "display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); text-align: center;" >
            <div style="font-size: 32px; margin-bottom: 16px;" >📊</div>
                < p > No analysis data available yet.</p>
                    < p style = "font-size: 0.9rem;" > Click < strong > Re - analyze < /strong> to generate a comprehensive report.</p >
                        </div>`;
                return;
            }

            const label = REPORT_SECTION_LABELS[activeSectionKey] || activeSectionKey;
            const cleanLabel = label.replace(/^\d+\.\s*/, '');
            const rawText = report[activeSectionKey as keyof typeof report] || 'No content for this section.';

            // Format text (Basic markdown-like to HTML)
            // Note: In production we might want a real markdown renderer, for now use escape + line breaks
            const formattedText = escapeHtml(rawText)
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Simple bold support

            contentArea.innerHTML = `
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 24px 0; padding-bottom: 16px; border-bottom: 1px solid var(--border-color);">${escapeHtml(cleanLabel)}</h2>
                <div class="content-prose">
                    <p>${formattedText}</p>
                </div>
            `;
        }

        // Sidebar Interactions
        sidebarItems.forEach(item => {
            on(item as HTMLElement, 'click', () => {
                const key = item.getAttribute('data-key');
                if (key && key !== activeSectionKey) {
                    activeSectionKey = key;

                    // Update active state in sidebar
                    sidebarItems.forEach(i => {
                        if (i.getAttribute('data-key') === activeSectionKey) {
                            i.classList.add('active');
                            // Re-inject the SVG arrow for the active item
                            if (!i.querySelector('svg')) {
                                const span = i.querySelector('span');
                                if (span) span.insertAdjacentHTML('afterend', '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>');
                            }
                        } else {
                            i.classList.remove('active');
                            const svg = i.querySelector('svg');
                            if (svg) svg.remove();
                        }
                    });

                    // Render content
                    renderActiveContent();
                }
            });
        });

        // Initial render
        renderActiveContent();
    }
    function bindListEvents() {
        /* Event delegation for list */
        on(contentWrapper, 'click', async (e) => {
            const target = e.target as HTMLElement;

            // New Company
            if (target.closest('#companies-new-btn')) {
                showForm();
                return;
            }

            const editBtn = target.closest('.companies-edit-btn');
            const templatesBtn = target.closest('.companies-templates-list-btn');
            const analyzeBtn = target.closest('.companies-analyze-btn');
            const detailBtn = target.closest('.companies-detail-btn');
            const deleteBtn = target.closest('.companies-delete-btn');
            const id = (editBtn || templatesBtn || analyzeBtn || detailBtn || deleteBtn)?.getAttribute('data-id');

            if (!id) return;

            if (detailBtn) {
                try {
                    const c = await getCompany(id);
                    if (c) showDetailView(c);
                } catch {
                    toast.error(S.loadFailed);
                }
                return;
            }
            if (templatesBtn) {
                try {
                    const c = await getCompany(id);
                    if (c) showTemplateEditor(c);
                } catch {
                    toast.error(S.loadFailed);
                }
                return;
            }
            if (editBtn) {
                try {
                    const c = await getCompany(id);
                    if (c) showForm(c);
                } catch {
                    toast.error(S.loadFailed);
                }
                return;
            }
            if (analyzeBtn) {
                const btn = analyzeBtn as HTMLButtonElement;
                btn.disabled = true;
                const origText = btn.textContent;
                // Find the text node to replace if it exists, or just append spinner
                // Simple way:
                btn.innerHTML = '<span class="spinner-sm"></span>';

                try {
                    await analyzeCompany(id);
                    toast.success(S.analysisComplete);
                    loadList();
                } catch {
                    toast.error(S.analysisFailed);
                    btn.innerHTML = origText || ''; // Restore
                    btn.disabled = false;
                }
                return;
            }
            if (deleteBtn) {
                if (!confirm(S.deleteConfirm)) return;
                try {
                    await deleteCompany(id);
                    toast.success(S.companyDeleted);
                    loadList();
                } catch {
                    // API client already shows error toast
                }
            }
        });
    }

    // Start with list view
    showListView();
}
