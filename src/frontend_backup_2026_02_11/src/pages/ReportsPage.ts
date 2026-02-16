/**
 * Reports Panel Component
 * Weekly reports and executive summaries with export
 */

import { createElement, on } from '@lib/dom';
import { chatService } from '@services/chat';
import { toast } from '@services/toast';

export interface ReportsPanelProps {
  onExport?: (type: 'pdf' | 'md', content: string) => void;
}

type ReportType = 'weekly' | 'executive';

let currentReport: string = '';
let currentType: ReportType = 'weekly';

/**
 * Create reports panel
 */
export function createReportsPanel(props: ReportsPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'reports-panel' });

  panel.innerHTML = `
    <div class="reports-header">
      <h2>Reports</h2>
      <div class="reports-actions">
        <button class="btn btn-sm" id="export-md-btn">Export MD</button>
        <button class="btn btn-sm btn-primary" id="export-pdf-btn">Export PDF</button>
      </div>
    </div>
    <div class="reports-tabs">
      <button class="report-tab active" data-type="weekly">Weekly Report</button>
      <button class="report-tab" data-type="executive">Executive Summary</button>
    </div>
    <div class="reports-content" id="reports-content">
      <div class="loading">Generating report...</div>
    </div>
  `;

  // Bind tab events
  const tabs = panel.querySelectorAll('.report-tab');
  tabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentType = tab.getAttribute('data-type') as ReportType;
      loadReport(panel, currentType);
    });
  });

  // Export buttons
  const exportMdBtn = panel.querySelector('#export-md-btn');
  if (exportMdBtn) {
    on(exportMdBtn as HTMLElement, 'click', () => exportReport('md', props));
  }

  const exportPdfBtn = panel.querySelector('#export-pdf-btn');
  if (exportPdfBtn) {
    on(exportPdfBtn as HTMLElement, 'click', () => exportReport('pdf', props));
  }

  // Initial load
  loadReport(panel, 'weekly');

  return panel;
}

/**
 * Load report
 */
async function loadReport(panel: HTMLElement, type: ReportType): Promise<void> {
  const content = panel.querySelector('#reports-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Generating report...</div>';

  try {
    let report: string;

    if (type === 'weekly') {
      report = await chatService.getWeeklyReport();
    } else {
      report = await chatService.generateExecutiveSummary();
    }

    currentReport = report;
    renderReport(content, report);
  } catch {
    content.innerHTML = '<div class="error">Failed to generate report</div>';
  }
}

/**
 * Render report
 */
function renderReport(container: HTMLElement, markdown: string): void {
  container.innerHTML = `
    <div class="report-preview">
      ${renderMarkdown(markdown)}
    </div>
  `;
}

/**
 * Export report
 */
async function exportReport(format: 'pdf' | 'md', props: ReportsPanelProps): Promise<void> {
  if (!currentReport) {
    toast.error('No report to export');
    return;
  }

  if (props.onExport) {
    props.onExport(format, currentReport);
    return;
  }

  if (format === 'md') {
    downloadFile(`${currentType}-report.md`, currentReport, 'text/markdown');
    toast.success('Report downloaded');
  } else if (format === 'pdf') {
    await exportToPdf(currentReport, `${currentType}-report`);
  }
}

/**
 * Download file
 */
function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export to PDF using html2pdf.js
 */
async function exportToPdf(markdown: string, filename: string): Promise<void> {
  // Check if html2pdf is available
  const html2pdf = (window as unknown as { html2pdf?: unknown }).html2pdf;

  if (!html2pdf) {
    // Fallback: download as HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${filename}</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
          h1 { color: #1a1a2e; }
          h2 { color: #16213e; border-bottom: 1px solid #eee; padding-bottom: 10px; }
          h3 { color: #0f3460; }
          ul { padding-left: 20px; }
          li { margin: 5px 0; }
        </style>
      </head>
      <body>
        ${renderMarkdown(markdown)}
      </body>
      </html>
    `;
    downloadFile(`${filename}.html`, html, 'text/html');
    toast.info('Downloaded as HTML (PDF library not available)');
    return;
  }

  // Create temporary element for PDF generation
  const tempDiv = document.createElement('div');
  tempDiv.className = 'report-pdf-container';
  tempDiv.innerHTML = renderMarkdown(markdown);
  document.body.appendChild(tempDiv);

  try {
    await (html2pdf as (element: HTMLElement) => { save: (filename: string) => Promise<void> })(tempDiv)
      .save(`${filename}.pdf`);
    toast.success('PDF exported');
  } catch {
    toast.error('Failed to export PDF');
  } finally {
    document.body.removeChild(tempDiv);
  }
}

/**
 * Simple markdown renderer
 */
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[hul])/g, '$1')
    .replace(/(<\/[hul][^>]*>)<\/p>/g, '$1');
}

export default createReportsPanel;
