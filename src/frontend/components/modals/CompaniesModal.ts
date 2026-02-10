/**
 * Companies Modal - List, create, edit, analyze company profiles and templates (A4/PPT)
 */

import { createElement, on } from '../../utils/dom';
import { toast } from '../../services/toast';
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
} from '../../services/companies';

const MODAL_ID = 'companies-modal';

/** UI strings - centralised for i18n */
const S = {
  title: 'Companies',
  close: 'Close',
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
  backToList: '← Back to list',
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

export function showCompaniesModal(): void {
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const overlay = createElement('div', { className: 'modal-overlay' });
  overlay.setAttribute('data-modal-id', MODAL_ID);

  const container = createElement('div', { className: 'modal-container', style: 'max-width: 640px;' });
  container.innerHTML = `
    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color, #e2e8f0);">
      <h2 style="margin: 0; font-size: 1.25rem;">${escapeHtml(S.title)}</h2>
      <button type="button" class="btn-icon" id="companies-close-btn" title="${escapeHtml(S.close)}">✕</button>
    </div>
    <div class="modal-body" style="padding: 20px; max-height: 60vh; overflow-y: auto;">
      <button type="button" class="btn btn-primary" id="companies-new-btn" style="margin-bottom: 16px;">${escapeHtml(S.newCompany)}</button>
      <div id="companies-list">Loading...</div>
    </div>
  `;

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
  }

  function renderList(items: Company[]) {
    const listEl = overlay.querySelector('#companies-list') as HTMLElement;
    if (!listEl) return;
    const list = Array.isArray(items) ? items : [];
    try {
      if (list.length === 0) {
        listEl.innerHTML = `<p style="color: var(--text-secondary);">${escapeHtml(S.noCompanies)}</p>`;
        return;
      }
      const analyzedAt = (c: Company) => c.brand_assets?.analyzed_at;
      listEl.innerHTML = list
      .map(
        (c) => {
          const analyzed = !!analyzedAt(c);
          const analyzeLabel = analyzed ? S.reAnalyze : S.analyze;
          const analyzedBadge = analyzed
            ? `<span class="companies-analyzed-badge" title="${escapeHtml(analyzedAt(c) || '')}" style="font-size: 11px; color: var(--text-secondary); margin-left: 6px;">${escapeHtml(S.analyzedOn)}</span>`
            : `<span class="companies-not-analyzed-badge" style="font-size: 11px; color: var(--text-muted, #94a3b8); margin-left: 6px;">${escapeHtml(S.notAnalyzed)}</span>`;
          return `
      <div class="companies-row" data-id="${c.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${c.logo_url ? `<img src="${escapeHtml(c.logo_url)}" alt="" style="width: 36px; height: 36px; object-fit: contain; border-radius: 6px;">` : '<span style="width: 36px; height: 36px; background: var(--bg-secondary); border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 18px;">🏢</span>'}
          <div>
            <strong>${escapeHtml(c.name)}</strong>${analyzedBadge}
            ${(c.brand_assets?.primary_color && c.brand_assets?.secondary_color) ? `<span style="display: inline-flex; gap: 4px; margin-left: 8px;"><i style="width: 12px; height: 12px; border-radius: 2px; background: ${escapeHtml(c.brand_assets.primary_color)};"></i><i style="width: 12px; height: 12px; border-radius: 2px; background: ${escapeHtml(c.brand_assets.secondary_color)};"></i></span>` : ''}
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-sm btn-secondary companies-detail-btn" data-id="${c.id}" title="View analysis">${escapeHtml(S.viewDetail)}</button>
          <button type="button" class="btn btn-sm btn-secondary companies-edit-btn" data-id="${c.id}">${escapeHtml(S.edit)}</button>
          <button type="button" class="btn btn-sm btn-secondary companies-analyze-btn" data-id="${c.id}" title="Analyze with AI">${escapeHtml(analyzeLabel)}</button>
          <button type="button" class="btn btn-sm btn-outline-danger companies-delete-btn" data-id="${c.id}">${escapeHtml(S.delete)}</button>
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
    const listEl = overlay.querySelector('#companies-list') as HTMLElement;
    if (listEl) listEl.innerHTML = 'Loading...';
    listCompanies()
      .then((list) => renderList(Array.isArray(list) ? list : []))
      .catch(() => {
        try {
          const el = overlay.querySelector('#companies-list') as HTMLElement;
          if (el) el.innerHTML = `<p class="text-error">${escapeHtml(S.loadFailed)}</p>`;
        } catch {
          // overlay may be gone
        }
      });
  }

  const listViewBodyHtml = `
    <button type="button" class="btn btn-primary" id="companies-new-btn" style="margin-bottom: 16px;">${escapeHtml(S.newCompany)}</button>
    <div id="companies-list">Loading...</div>
  `;

  function showListView() {
    const body = overlay.querySelector('.modal-body') as HTMLElement;
    if (!body) return;
    body.innerHTML = listViewBodyHtml;
    loadList();
    bindListEvents();
  }

  function showForm(company?: Company) {
    const body = overlay.querySelector('.modal-body') as HTMLElement;
    if (!body) return;
    const isEdit = !!company;
    body.innerHTML = `
      <div style="margin-bottom: 16px;">
        <button type="button" class="btn btn-secondary btn-sm" id="companies-back-btn">${escapeHtml(S.backToList)}</button>
      </div>
      <form id="company-form" style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <label>${escapeHtml(S.name)}</label>
          <input type="text" name="name" required value="${company ? escapeHtml(company.name) : ''}" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);">
        </div>
        <div>
          <label>${escapeHtml(S.description)}</label>
          <textarea name="description" rows="2" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);">${company?.description ? escapeHtml(company.description) : ''}</textarea>
        </div>
        <div>
          <label>${escapeHtml(S.logoUrl)}</label>
          <input type="url" name="logo_url" value="${company?.logo_url ? escapeHtml(company.logo_url) : ''}" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);" placeholder="https://...">
        </div>
        <div>
          <label>${escapeHtml(S.website)}</label>
          <input type="url" name="website_url" value="${company?.website_url ? escapeHtml(company.website_url) : ''}" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);" placeholder="https://...">
        </div>
        <div>
          <label>${escapeHtml(S.linkedIn)}</label>
          <input type="url" name="linkedin_url" value="${company?.linkedin_url ? escapeHtml(company.linkedin_url) : ''}" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);" placeholder="https://linkedin.com/...">
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="submit" class="btn btn-primary">${isEdit ? escapeHtml(S.save) : escapeHtml(S.create)}</button>
          <button type="button" class="btn btn-secondary" id="company-form-cancel">${escapeHtml(S.cancel)}</button>
        </div>
        ${isEdit && company ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
          <button type="button" class="btn btn-secondary btn-sm" id="companies-templates-btn">${escapeHtml(S.templates)}</button>
        </div>
        ` : ''}
      </form>
    `;

    on(body.querySelector('#companies-back-btn') as HTMLElement, 'click', showListView);

    on(body.querySelector('#company-form') as HTMLFormElement, 'submit', async (e) => {
      e.preventDefault();
      const form = body.querySelector('#company-form') as HTMLFormElement;
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

    on(body.querySelector('#company-form-cancel') as HTMLElement, 'click', showListView);

    if (isEdit && company) {
      const templatesBtn = body.querySelector('#companies-templates-btn');
      if (templatesBtn) on(templatesBtn as HTMLElement, 'click', () => showTemplateEditor(company));
    }
  }

  function showTemplateEditor(company: Company) {
    const body = overlay.querySelector('.modal-body') as HTMLElement;
    if (!body) return;
    let currentType: TemplateType = 'a4';
    body.innerHTML = `
      <div style="margin-bottom: 16px;">
        <button type="button" class="btn btn-secondary btn-sm" id="templates-back-btn">${escapeHtml(S.backToList)}</button>
      </div>
      <h3 style="margin: 0 0 12px 0; font-size: 1rem;">${escapeHtml(company.name)} – ${escapeHtml(S.templates)}</h3>
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <button type="button" class="btn btn-sm btn-secondary template-type-btn active" data-type="a4">${escapeHtml(S.templateA4)}</button>
        <button type="button" class="btn btn-sm btn-secondary template-type-btn" data-type="ppt">${escapeHtml(S.templatePPT)}</button>
      </div>
      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        <button type="button" class="btn btn-sm btn-secondary" id="template-load-btn">${escapeHtml(S.loadCurrent)}</button>
        <button type="button" class="btn btn-sm btn-primary" id="template-generate-btn">${escapeHtml(S.generateWithAI)}</button>
        <button type="button" class="btn btn-sm btn-primary" id="template-save-btn">${escapeHtml(S.saveTemplate)}</button>
      </div>
      <textarea id="template-html-editor" rows="14" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-family: monospace; font-size: 12px;" placeholder="HTML template..."></textarea>
    `;

    const editor = body.querySelector('#template-html-editor') as HTMLTextAreaElement;
    const loadBtn = body.querySelector('#template-load-btn') as HTMLButtonElement;
    const genBtn = body.querySelector('#template-generate-btn') as HTMLButtonElement;
    const saveBtn = body.querySelector('#template-save-btn') as HTMLButtonElement;

    function setType(type: TemplateType) {
      currentType = type;
      body.querySelectorAll('.template-type-btn').forEach((b) => b.classList.toggle('active', (b as HTMLElement).getAttribute('data-type') === type));
    }

    on(body.querySelector('#templates-back-btn') as HTMLElement, 'click', () => showForm(company));
    body.querySelectorAll('.template-type-btn').forEach((btn) => {
      on(btn as HTMLElement, 'click', () => setType((btn.getAttribute('data-type') as TemplateType) || 'a4'));
    });
    on(loadBtn, 'click', async () => {
      loadBtn.disabled = true;
      try {
        const html = await getTemplate(company.id, currentType);
        editor.value = html;
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
    getTemplate(company.id, currentType).then((html) => { editor.value = html; }).catch(() => {});
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
    const body = overlay.querySelector('.modal-body') as HTMLElement;
    if (!body) return;
    const ba = company.brand_assets;
    const analyzedAt = ba?.analyzed_at ? new Date(ba.analyzed_at).toLocaleString() : '—';
    const aiContext = (ba?.ai_context || '').trim() || '—';
    const primaryColor = ba?.primary_color || '—';
    const secondaryColor = ba?.secondary_color || '—';
    const report = ba?.analysis_report || {};
    const hasReport = Object.keys(report).length > 0;
    const reportSectionKeys = Object.keys(REPORT_SECTION_LABELS);
    const reportHtml = hasReport
      ? reportSectionKeys
          .map((key) => {
            const label = REPORT_SECTION_LABELS[key];
            const text = (report[key as keyof typeof report] || '').trim() || '—';
            return `<div class="companies-report-section"><strong>${escapeHtml(label)}</strong><div class="companies-report-text">${escapeHtml(text)}</div></div>`;
          })
          .join('')
      : `<div><strong>AI context</strong><div class="companies-report-text">${escapeHtml(aiContext)}</div></div>
        <div><strong>Primary color</strong> <span style="display: inline-flex; align-items: center; gap: 6px;">${primaryColor !== '—' ? `<span style="width: 20px; height: 20px; border-radius: 4px; background: ${escapeHtml(primaryColor)};"></span><code>${escapeHtml(primaryColor)}</code>` : '—'}</span></div>
        <div><strong>Secondary color</strong> <span style="display: inline-flex; align-items: center; gap: 6px;">${secondaryColor !== '—' ? `<span style="width: 20px; height: 20px; border-radius: 4px; background: ${escapeHtml(secondaryColor)};"></span><code>${escapeHtml(secondaryColor)}</code>` : '—'}</span></div>`;

    const logoBlock = company.logo_url
      ? `<img src="${escapeHtml(company.logo_url)}" alt="" class="companies-detail-logo" onerror="this.style.display='none'">`
      : '<span class="companies-detail-logo-placeholder">🏢</span>';

    body.innerHTML = `
      <div style="margin-bottom: 16px;">
        <button type="button" class="btn btn-secondary btn-sm" id="companies-detail-back-btn">${escapeHtml(S.backToList)}</button>
      </div>
      <div class="companies-detail-header" style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
        ${logoBlock}
        <div>
          <h3 style="margin: 0 0 4px 0; font-size: 1.25rem;">${escapeHtml(company.name)}</h3>
          <div style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(S.analyzedOn)} ${escapeHtml(analyzedAt)}</div>
        </div>
      </div>
      <div class="companies-detail-report" style="display: flex; flex-direction: column; gap: 14px; max-height: 55vh; overflow-y: auto;">
        ${reportHtml}
      </div>
      ${hasReport ? `<div style="margin-top: 8px;"><strong>Primary color</strong> ${primaryColor !== '—' ? `<span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 16px; height: 16px; border-radius: 4px; background: ${escapeHtml(primaryColor)};"></span><code>${escapeHtml(primaryColor)}</code></span>` : '—'} &nbsp; <strong>Secondary</strong> ${secondaryColor !== '—' ? `<span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 16px; height: 16px; border-radius: 4px; background: ${escapeHtml(secondaryColor)};"></span><code>${escapeHtml(secondaryColor)}</code></span>` : '—'}</div>` : ''}
      <div style="margin-top: 16px; display: flex; gap: 8px;">
        <button type="button" class="btn btn-primary" id="companies-detail-reanalyze-btn" data-id="${escapeHtml(company.id)}">${escapeHtml(S.reAnalyze)}</button>
        <button type="button" class="btn btn-secondary" id="companies-detail-edit-btn" data-id="${escapeHtml(company.id)}">${escapeHtml(S.edit)}</button>
      </div>
    `;
    on(body.querySelector('#companies-detail-back-btn') as HTMLElement, 'click', showListView);
    on(body.querySelector('#companies-detail-edit-btn') as HTMLElement, 'click', () => showForm(company));
    const reanalyzeBtn = body.querySelector('#companies-detail-reanalyze-btn') as HTMLButtonElement;
    on(reanalyzeBtn, 'click', async () => {
      reanalyzeBtn.disabled = true;
      reanalyzeBtn.textContent = '...';
      try {
        const updated = await analyzeCompany(company.id);
        toast.success(S.analysisComplete);
        showDetailView(updated);
      } catch {
        toast.error(S.analysisFailed);
      } finally {
        reanalyzeBtn.disabled = false;
        reanalyzeBtn.textContent = S.reAnalyze;
      }
    });
  }

  function bindListEvents() {
    on(overlay.querySelector('#companies-close-btn') as HTMLElement, 'click', close);
    on(overlay, 'click', (e) => { if (e.target === overlay) close(); });
    on(container, 'click', (e) => e.stopPropagation());

    /* Event delegation: list buttons and New are re-created when body is replaced, so bind once on container */
    on(container, 'click', async (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('#companies-new-btn')) {
        showForm();
        return;
      }
      const editBtn = target.closest('.companies-edit-btn');
      const analyzeBtn = target.closest('.companies-analyze-btn');
      const detailBtn = target.closest('.companies-detail-btn');
      const deleteBtn = target.closest('.companies-delete-btn');
      const id = (editBtn || analyzeBtn || detailBtn || deleteBtn)?.getAttribute('data-id');
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
        btn.textContent = '...';
        try {
          await analyzeCompany(id);
          toast.success(S.analysisComplete);
          loadList();
        } catch {
          toast.error(S.analysisFailed);
        } finally {
          btn.disabled = false;
          btn.textContent = origText || S.analyze;
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

  loadList();
  bindListEvents();
}
