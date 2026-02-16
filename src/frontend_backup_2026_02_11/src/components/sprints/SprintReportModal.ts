/**
 * Sprint Report Modal
 * Full report: breakdown chart, task list, AI analysis, business report
 */

import { createElement, on } from '@lib/dom';
import { createModal, openModal, closeModal } from '../Modal';
import {
  getSprintReport,
  analyzeSprintReport,
  getSprintBusinessReport,
  generateSprintReportDocument,
  generateSprintReportPresentation,
  type SprintReport,
  type ReportDocumentStyle,
} from '@services/sprints';
import { createBreakdownChart } from '@components/widgets/BreakdownChart';
import { toast } from '@services/toast';

const MODAL_ID = 'sprint-report-modal';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export interface SprintReportModalProps {
  sprintId: string;
  sprintName?: string;
  onClose?: () => void;
}

export function showSprintReportModal(props: SprintReportModalProps): void {
  const { sprintId, sprintName = 'Sprint', onClose } = props;
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'sprint-report-modal-content' });
  content.innerHTML = `
    <div class="sprint-report-loading">Loading report...</div>
    <div id="sprint-report-body" class="sprint-report-body hidden">
      <div class="sprint-report-export-section">
        <h4>Export as</h4>
        <div class="sprint-report-format-row">
          <label class="sprint-report-format-option">
            <input type="radio" name="sprint-report-format" value="document" checked> Document (A4)
          </label>
          <label class="sprint-report-format-option">
            <input type="radio" name="sprint-report-format" value="presentation"> Presentation (PPT)
          </label>
        </div>
        <div id="sprint-report-document-options" class="sprint-report-format-options">
          <label class="sprint-report-style-row">
            <span>Style:</span>
            <select id="sprint-report-document-style">
              <option value="">Default</option>
              <option value="sprint_report_style_corporate_classic">Corporativo clássico</option>
              <option value="sprint_report_style_modern_minimal">Moderno minimalista</option>
              <option value="sprint_report_style_startup_tech">Startup / Tech</option>
              <option value="sprint_report_style_consultancy">Consultoria / Enterprise</option>
            </select>
          </label>
          <label class="sprint-report-check"><input type="checkbox" id="sprint-report-include-analysis"> Include AI analysis</label>
          <label class="sprint-report-check"><input type="checkbox" id="sprint-report-include-business"> Include business report</label>
        </div>
        <div id="sprint-report-presentation-options" class="sprint-report-format-options hidden">
          <label class="sprint-report-check"><input type="checkbox" id="sprint-report-ppt-include-analysis"> Include AI analysis</label>
          <label class="sprint-report-check"><input type="checkbox" id="sprint-report-ppt-include-business"> Include business report</label>
        </div>
        <div class="sprint-report-generate-row">
          <button type="button" class="btn btn-primary" id="sprint-report-generate-doc-btn">Generate document (A4)</button>
          <button type="button" class="btn btn-primary hidden" id="sprint-report-generate-ppt-btn">Generate presentation (PPT)</button>
          <label class="sprint-report-check sprint-report-pdf-option"><input type="checkbox" id="sprint-report-open-for-pdf"> Open for PDF (print dialog)</label>
        </div>
        <div id="sprint-report-generate-status" class="sprint-report-generate-status hidden"></div>
      </div>
      <div class="sprint-report-summary" id="sprint-report-summary"></div>
      <div class="sprint-report-chart" id="sprint-report-chart"></div>
      <div class="sprint-report-actions-list" id="sprint-report-actions"></div>
      <div class="sprint-report-ai-section">
        <h4>AI analysis</h4>
        <div id="sprint-report-ai-placeholder" class="sprint-report-ai-placeholder">Click "Analyze with AI" to generate.</div>
        <div id="sprint-report-ai-content" class="sprint-report-ai-content hidden"></div>
      </div>
      <div class="sprint-report-business-section">
        <h4>Business report</h4>
        <div id="sprint-report-business-placeholder" class="sprint-report-business-placeholder">Click "Business report" to generate.</div>
        <div id="sprint-report-business-content" class="sprint-report-business-content hidden"></div>
      </div>
    </div>
    <div id="sprint-report-error" class="sprint-report-error hidden"></div>
  `;

  const footer = createElement('div', { className: 'modal-footer' });
  footer.innerHTML = `
    <button type="button" class="btn btn-outline-secondary" id="sprint-report-export-pdf-btn">Export report as PDF</button>
    <button type="button" class="btn btn-secondary" id="sprint-report-analyze-btn">Analyze with AI</button>
    <button type="button" class="btn btn-outline-primary" id="sprint-report-business-btn">Business report</button>
    <button type="button" class="btn btn-primary" id="sprint-report-close-btn">Close</button>
  `;

  const modal = createModal({
    id: MODAL_ID,
    title: `Sprint report: ${escapeHtml(sprintName)}`,
    content,
    size: 'xl',
    closable: true,
    footer,
    onClose: () => {
      onClose?.();
    },
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  let reportData: SprintReport | null = null;

  async function loadReport(): Promise<void> {
    const loading = content.querySelector('.sprint-report-loading') as HTMLElement;
    const body = content.querySelector('#sprint-report-body') as HTMLElement;
    const errEl = content.querySelector('#sprint-report-error') as HTMLElement;
    if (!loading || !body || !errEl) return;

    try {
      const report = await getSprintReport(sprintId);
      if (!report) {
        errEl.textContent = 'Failed to load report';
        errEl.classList.remove('hidden');
        loading.classList.add('hidden');
        return;
      }
      reportData = report;
      loading.classList.add('hidden');
      errEl.classList.add('hidden');
      body.classList.remove('hidden');

      const summaryEl = content.querySelector('#sprint-report-summary') as HTMLElement;
      if (summaryEl) {
        const pct = report.total_tasks ? Math.round((report.completed_tasks / report.total_tasks) * 100) : 0;
        const pointsLine =
          report.total_task_points > 0
            ? ` · ${report.completed_task_points}/${report.total_task_points} points`
            : '';
        summaryEl.innerHTML = `
          <p><strong>${report.completed_tasks}</strong> / <strong>${report.total_tasks}</strong> tasks completed (${pct}%)${pointsLine}</p>
          <p class="sprint-report-dates">${report.sprint.start_date} – ${report.sprint.end_date}</p>
          ${report.sprint.context ? `<p class="sprint-report-context">${escapeHtml(report.sprint.context)}</p>` : ''}
        `;
      }

      const chartEl = content.querySelector('#sprint-report-chart') as HTMLElement;
      if (chartEl) {
        chartEl.innerHTML = '';
        chartEl.appendChild(
          createBreakdownChart({
            byStatus: report.breakdown.by_status,
            byAssignee: report.breakdown.by_assignee,
            height: 200,
            showAssignee: true,
          })
        );
      }

      const listEl = content.querySelector('#sprint-report-actions') as HTMLElement;
      if (listEl && report.actions.length > 0) {
        listEl.innerHTML = `
          <h4>Tasks (${report.actions.length})</h4>
          <ul class="sprint-report-task-list">
            ${report.actions
            .map(
              (a) =>
                `<li class="sprint-report-task-item" data-status="${escapeHtml((a.status || 'pending').toLowerCase())}">
                    <span class="task-status-dot"></span>
                    ${escapeHtml(a.task || a.content || '—')}
                    ${a.task_points != null ? `<span class="task-points">${a.task_points} pt</span>` : ''}
                  </li>`
            )
            .join('')}
          </ul>
        `;
      } else if (listEl) {
        listEl.innerHTML = '<p class="sprint-report-no-tasks">No tasks in this sprint.</p>';
      }
    } catch (e) {
      loading.classList.add('hidden');
      body.classList.add('hidden');
      errEl.textContent = e instanceof Error ? e.message : 'Failed to load report';
      errEl.classList.remove('hidden');
    }
  }

  on(footer.querySelector('#sprint-report-close-btn') as HTMLElement, 'click', () => closeModal(MODAL_ID));

  /** Build printable HTML from current report data and open print dialog (Save as PDF). */
  function exportReportAsPdf(): void {
    if (!reportData) {
      toast.error('Report not loaded yet');
      return;
    }
    const sprint = reportData.sprint;
    const aiEl = content.querySelector('#sprint-report-ai-content');
    const bizEl = content.querySelector('#sprint-report-business-content');
    const aiHtml = aiEl && !aiEl.classList.contains('hidden') ? aiEl.innerHTML : '';
    const bizHtml = bizEl && !bizEl.classList.contains('hidden') ? bizEl.innerHTML : '';
    const byStatus = reportData.breakdown.by_status || {};
    const byAssignee = reportData.breakdown.by_assignee || {};
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sprint Report – ${escapeHtml(sprint.name)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #333; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.15rem; margin-top: 1.5rem; margin-bottom: 0.5rem; }
  p, ul { margin: 0.5rem 0; }
  ul { padding-left: 1.5rem; }
  .meta { color: #666; font-size: 0.9rem; }
  .section { margin-top: 1rem; }
  @media print { body { margin: 1rem; } }
</style></head><body>
  <h1>${escapeHtml(sprint.name)}</h1>
  <p class="meta">${escapeHtml(sprint.start_date)} – ${escapeHtml(sprint.end_date)}</p>
  ${sprint.context ? `<p>${escapeHtml(sprint.context)}</p>` : ''}
  <div class="section">
    <h2>Summary</h2>
    <p><strong>${reportData.completed_tasks}</strong> / <strong>${reportData.total_tasks}</strong> tasks completed${reportData.total_task_points > 0 ? ` · ${reportData.completed_task_points}/${reportData.total_task_points} points` : ''}.</p>
  </div>
  <div class="section">
    <h2>By status</h2>
    <ul>${Object.entries(byStatus).map(([k, v]) => `<li>${escapeHtml(k)}: ${v}</li>`).join('')}</ul>
  </div>
  <div class="section">
    <h2>By assignee</h2>
    <ul>${Object.entries(byAssignee).map(([k, v]) => `<li>${escapeHtml(k)}: ${v}</li>`).join('')}</ul>
  </div>
  <div class="section">
    <h2>Tasks</h2>
    <ul>${reportData.actions.slice(0, 100).map(a => `<li>${escapeHtml((a.status || 'pending'))}: ${escapeHtml((a.task || a.content || '—').substring(0, 200))}${a.task_points != null ? ` (${a.task_points} pt)` : ''}</li>`).join('')}</ul>
    ${reportData.actions.length > 100 ? `<p class="meta">… and ${reportData.actions.length - 100} more tasks</p>` : ''}
  </div>
  ${aiHtml ? `<div class="section"><h2>AI analysis</h2><div>${aiHtml}</div></div>` : ''}
  ${bizHtml ? `<div class="section"><h2>Business report</h2><div>${bizHtml}</div></div>` : ''}
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener');
    if (w) {
      w.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
    } else {
      toast.error('Allow pop-ups to export PDF');
      URL.revokeObjectURL(url);
    }
  }

  const exportPdfBtn = footer.querySelector('#sprint-report-export-pdf-btn');
  if (exportPdfBtn) on(exportPdfBtn as HTMLElement, 'click', () => exportReportAsPdf());

  // Format: Document vs Presentation — toggle options and which generate button is visible
  const docOptions = content.querySelector('#sprint-report-document-options') as HTMLElement;
  const pptOptions = content.querySelector('#sprint-report-presentation-options') as HTMLElement;
  const docBtn = content.querySelector('#sprint-report-generate-doc-btn') as HTMLButtonElement;
  const pptBtn = content.querySelector('#sprint-report-generate-ppt-btn') as HTMLButtonElement;
  content.querySelectorAll('input[name="sprint-report-format"]').forEach((radio) => {
    on(radio as HTMLElement, 'change', () => {
      const isDoc = (content.querySelector('input[name="sprint-report-format"]:checked') as HTMLInputElement)?.value === 'document';
      if (docOptions) docOptions.classList.toggle('hidden', !isDoc);
      if (pptOptions) pptOptions.classList.toggle('hidden', isDoc);
      if (docBtn) docBtn.classList.toggle('hidden', !isDoc);
      if (pptBtn) pptBtn.classList.toggle('hidden', isDoc);
    });
  });

  /** Open generated HTML in new tab; if forPdf, inject script to open print dialog (user can Save as PDF). */
  function openHtmlInNewTab(html: string, forPdf = false): void {
    let out = html;
    if (forPdf) {
      const printScript = '<script>window.onload=function(){window.print();}<\/script>';
      if (out.includes('</body>')) {
        out = out.replace('</body>', printScript + '</body>');
      } else if (out.includes('</html>')) {
        out = out.replace('</html>', printScript + '</html>');
      } else {
        out = out + printScript;
      }
    }
    const blob = new Blob([out], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    URL.revokeObjectURL(url);
  }

  const statusEl = content.querySelector('#sprint-report-generate-status') as HTMLElement;
  if (docBtn) {
    on(docBtn, 'click', async () => {
      if (!statusEl) return;
      docBtn.disabled = true;
      statusEl.classList.remove('hidden');
      statusEl.textContent = 'Generating document…';
      try {
        const style = (content.querySelector('#sprint-report-document-style') as HTMLSelectElement)?.value as ReportDocumentStyle | '' || '';
        const includeAnalysis = (content.querySelector('#sprint-report-include-analysis') as HTMLInputElement)?.checked ?? false;
        const includeBusiness = (content.querySelector('#sprint-report-include-business') as HTMLInputElement)?.checked ?? false;
        const result = await generateSprintReportDocument(sprintId, { include_analysis: includeAnalysis, include_business: includeBusiness, style: style || undefined });
        const forPdf = (content.querySelector('#sprint-report-open-for-pdf') as HTMLInputElement)?.checked ?? false;
        statusEl.textContent = forPdf ? 'Done. Opening for PDF…' : 'Done. Opening in new tab…';
        openHtmlInNewTab(result.html, forPdf);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to generate document');
        statusEl.textContent = '';
      } finally {
        docBtn.disabled = false;
      }
    });
  }
  if (pptBtn) {
    on(pptBtn, 'click', async () => {
      if (!statusEl) return;
      pptBtn.disabled = true;
      statusEl.classList.remove('hidden');
      statusEl.textContent = 'Generating presentation…';
      try {
        const includeAnalysis = (content.querySelector('#sprint-report-ppt-include-analysis') as HTMLInputElement)?.checked ?? false;
        const includeBusiness = (content.querySelector('#sprint-report-ppt-include-business') as HTMLInputElement)?.checked ?? false;
        const result = await generateSprintReportPresentation(sprintId, { include_analysis: includeAnalysis, include_business: includeBusiness });
        const forPdf = (content.querySelector('#sprint-report-open-for-pdf') as HTMLInputElement)?.checked ?? false;
        statusEl.textContent = forPdf ? 'Done. Opening for PDF…' : 'Done. Opening in new tab…';
        openHtmlInNewTab(result.html, forPdf);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to generate presentation');
        statusEl.textContent = '';
      } finally {
        pptBtn.disabled = false;
      }
    });
  }

  on(footer.querySelector('#sprint-report-analyze-btn') as HTMLElement, 'click', async () => {
    const btn = footer.querySelector('#sprint-report-analyze-btn') as HTMLButtonElement;
    const placeholder = content.querySelector('#sprint-report-ai-placeholder') as HTMLElement;
    const aiContent = content.querySelector('#sprint-report-ai-content') as HTMLElement;
    if (!btn || !placeholder || !aiContent) return;
    btn.disabled = true;
    placeholder.textContent = 'Analyzing...';
    try {
      const result = await analyzeSprintReport(sprintId);
      placeholder.classList.add('hidden');
      aiContent.classList.remove('hidden');
      aiContent.innerHTML = result.ai_analysis
        ? `<div class="sprint-report-ai-text">${escapeHtml(result.ai_analysis).replace(/\n/g, '<br>')}</div>`
        : `<div class="sprint-report-ai-text">${escapeHtml(result.error || 'No analysis available.')}</div>`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Analysis failed');
      placeholder.textContent = 'Click "Analyze with AI" to generate.';
    } finally {
      btn.disabled = false;
    }
  });
  on(footer.querySelector('#sprint-report-business-btn') as HTMLElement, 'click', async () => {
    const btn = footer.querySelector('#sprint-report-business-btn') as HTMLButtonElement;
    const placeholder = content.querySelector('#sprint-report-business-placeholder') as HTMLElement;
    const bizContent = content.querySelector('#sprint-report-business-content') as HTMLElement;
    if (!btn || !placeholder || !bizContent) return;
    btn.disabled = true;
    placeholder.textContent = 'Generating...';
    try {
      const result = await getSprintBusinessReport(sprintId);
      placeholder.classList.add('hidden');
      bizContent.classList.remove('hidden');
      bizContent.innerHTML = result.business_report
        ? `<div class="sprint-report-business-text">${escapeHtml(result.business_report).replace(/\n/g, '<br>')}</div>`
        : `<div class="sprint-report-business-text">${escapeHtml(result.error || 'No business report available.')}</div>`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Business report failed');
      placeholder.textContent = 'Click "Business report" to generate.';
    } finally {
      btn.disabled = false;
    }
  });

  loadReport();
}
