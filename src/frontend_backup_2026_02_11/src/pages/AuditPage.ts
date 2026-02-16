/**
 * Audit Panel Component
 * Audit logs viewer with export wizard
 */

import { createElement, on } from '@lib/dom';
import { http, fetchWithProject } from '@services/api';
import { toast } from '@services/toast';
import { formatRelativeTime } from '@lib/format';

export interface AuditPanelProps {
  projectId?: string;
}

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  ip_address?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

interface AuditFilters {
  action?: string;
  entity_type?: string;
  user_id?: string;
  from_date?: string;
  to_date?: string;
}

let currentFilters: AuditFilters = {};
let currentPage = 1;
const PAGE_SIZE = 50;

/**
 * Create audit panel
 */
export function createAuditPanel(props: AuditPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'audit-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Audit Log</h2>
        <span class="panel-count" id="audit-count">0</span>
      </div>
      <div class="panel-actions">
        <button class="btn btn-sm" id="export-audit-btn">Export</button>
        <button class="btn btn-sm" id="filter-audit-btn">Filter</button>
      </div>
    </div>
    <div class="audit-filters hidden" id="audit-filters">
      <div class="filter-row">
        <select id="filter-action" class="filter-select">
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
          <option value="export">Export</option>
        </select>
        <select id="filter-entity" class="filter-select">
          <option value="">All Entities</option>
          <option value="question">Questions</option>
          <option value="risk">Risks</option>
          <option value="action">Actions</option>
          <option value="decision">Decisions</option>
          <option value="contact">Contacts</option>
          <option value="document">Documents</option>
          <option value="user">Users</option>
          <option value="project">Projects</option>
        </select>
        <input type="date" id="filter-from" class="filter-date" placeholder="From">
        <input type="date" id="filter-to" class="filter-date" placeholder="To">
        <button class="btn btn-sm" id="apply-filters-btn">Apply</button>
        <button class="btn btn-sm" id="clear-filters-btn">Clear</button>
      </div>
    </div>
    <div class="panel-content" id="audit-content">
      <div class="loading">Loading audit logs...</div>
    </div>
    <div class="audit-pagination" id="audit-pagination"></div>
  `;

  // Bind filter toggle
  const filterBtn = panel.querySelector('#filter-audit-btn');
  if (filterBtn) {
    on(filterBtn as HTMLElement, 'click', () => {
      const filters = panel.querySelector('#audit-filters');
      filters?.classList.toggle('hidden');
    });
  }

  // Bind apply filters
  const applyBtn = panel.querySelector('#apply-filters-btn');
  if (applyBtn) {
    on(applyBtn as HTMLElement, 'click', () => {
      currentFilters = {
        action: (panel.querySelector('#filter-action') as HTMLSelectElement).value || undefined,
        entity_type: (panel.querySelector('#filter-entity') as HTMLSelectElement).value || undefined,
        from_date: (panel.querySelector('#filter-from') as HTMLInputElement).value || undefined,
        to_date: (panel.querySelector('#filter-to') as HTMLInputElement).value || undefined,
      };
      currentPage = 1;
      loadAuditLogs(panel, props);
    });
  }

  // Bind clear filters
  const clearBtn = panel.querySelector('#clear-filters-btn');
  if (clearBtn) {
    on(clearBtn as HTMLElement, 'click', () => {
      currentFilters = {};
      currentPage = 1;
      (panel.querySelector('#filter-action') as HTMLSelectElement).value = '';
      (panel.querySelector('#filter-entity') as HTMLSelectElement).value = '';
      (panel.querySelector('#filter-from') as HTMLInputElement).value = '';
      (panel.querySelector('#filter-to') as HTMLInputElement).value = '';
      loadAuditLogs(panel, props);
    });
  }

  // Bind export
  const exportBtn = panel.querySelector('#export-audit-btn');
  if (exportBtn) {
    on(exportBtn as HTMLElement, 'click', () => showExportWizard(props));
  }

  // Initial load
  loadAuditLogs(panel, props);

  return panel;
}

/**
 * Load audit logs
 */
async function loadAuditLogs(panel: HTMLElement, props: AuditPanelProps): Promise<void> {
  const content = panel.querySelector('#audit-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(PAGE_SIZE));

    if (currentFilters.action) params.set('action', currentFilters.action);
    if (currentFilters.entity_type) params.set('entity_type', currentFilters.entity_type);
    if (currentFilters.from_date) params.set('from_date', currentFilters.from_date);
    if (currentFilters.to_date) params.set('to_date', currentFilters.to_date);

    const response = await http.get<{ logs: AuditLog[]; total: number }>(`/api/audit?${params}`);
    renderAuditLogs(content, response.data.logs || []);
    updateCount(panel, response.data.total);
    renderPagination(panel, response.data.total, props);
  } catch {
    content.innerHTML = '<div class="error">Failed to load audit logs</div>';
  }
}

/**
 * Render audit logs
 */
function renderAuditLogs(container: HTMLElement, logs: AuditLog[]): void {
  if (logs.length === 0) {
    container.innerHTML = '<div class="empty">No audit logs found</div>';
    return;
  }

  container.innerHTML = `
    <div class="audit-table">
      <div class="audit-header">
        <span class="audit-col time">Time</span>
        <span class="audit-col user">User</span>
        <span class="audit-col action">Action</span>
        <span class="audit-col entity">Entity</span>
        <span class="audit-col details">Details</span>
      </div>
      <div class="audit-body">
        ${logs.map(log => `
          <div class="audit-row" data-id="${log.id}">
            <span class="audit-col time" title="${new Date(log.created_at).toLocaleString()}">
              ${formatRelativeTime(log.created_at)}
            </span>
            <span class="audit-col user">
              ${log.user_name || log.user_email || 'System'}
              ${log.ip_address ? `<span class="ip-address">${log.ip_address}</span>` : ''}
            </span>
            <span class="audit-col action">
              <span class="action-badge ${getActionClass(log.action)}">${log.action}</span>
            </span>
            <span class="audit-col entity">
              ${log.entity_type}${log.entity_id ? ` #${log.entity_id.slice(0, 8)}` : ''}
            </span>
            <span class="audit-col details">
              ${log.details ? `<button class="btn-link view-details-btn">View</button>` : '-'}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Bind view details buttons
  container.querySelectorAll('.view-details-btn').forEach((btn, index) => {
    on(btn as HTMLElement, 'click', () => {
      const log = logs[index];
      if (log?.details) {
        showDetailsModal(log);
      }
    });
  });
}

/**
 * Get action class for styling
 */
function getActionClass(action: string): string {
  if (action.includes('create')) return 'create';
  if (action.includes('update')) return 'update';
  if (action.includes('delete')) return 'delete';
  if (action.includes('login')) return 'login';
  if (action.includes('export')) return 'export';
  return '';
}

/**
 * Render pagination
 */
function renderPagination(panel: HTMLElement, total: number, props: AuditPanelProps): void {
  const container = panel.querySelector('#audit-pagination') as HTMLElement;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button class="btn btn-sm" id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
    <span class="page-info">Page ${currentPage} of ${totalPages}</span>
    <button class="btn btn-sm" id="next-page" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
  `;

  const prevBtn = container.querySelector('#prev-page');
  if (prevBtn) {
    on(prevBtn as HTMLElement, 'click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadAuditLogs(panel, props);
      }
    });
  }

  const nextBtn = container.querySelector('#next-page');
  if (nextBtn) {
    on(nextBtn as HTMLElement, 'click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        loadAuditLogs(panel, props);
      }
    });
  }
}

/**
 * Show details modal
 */
function showDetailsModal(log: AuditLog): void {
  const overlay = createElement('div', { className: 'modal-overlay' });

  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Audit Log Details</h2>
        <button class="btn-icon close-modal">×</button>
      </div>
      <div class="modal-body">
        <div class="detail-row">
          <span class="detail-label">ID:</span>
          <span class="detail-value">${log.id}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Time:</span>
          <span class="detail-value">${new Date(log.created_at).toLocaleString()}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Action:</span>
          <span class="detail-value">${log.action}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Entity:</span>
          <span class="detail-value">${log.entity_type} ${log.entity_id || ''}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">User:</span>
          <span class="detail-value">${log.user_name || log.user_email || 'System'}</span>
        </div>
        ${log.ip_address ? `
          <div class="detail-row">
            <span class="detail-label">IP Address:</span>
            <span class="detail-value">${log.ip_address}</span>
          </div>
        ` : ''}
        <div class="detail-row">
          <span class="detail-label">Details:</span>
          <pre class="detail-json">${JSON.stringify(log.details, null, 2)}</pre>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary close-modal">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelectorAll('.close-modal').forEach(btn => {
    on(btn as HTMLElement, 'click', () => overlay.remove());
  });

  on(overlay, 'click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

/**
 * Show export wizard
 */
function showExportWizard(props: AuditPanelProps): void {
  const overlay = createElement('div', { className: 'modal-overlay' });

  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Export Audit Logs</h2>
        <button class="btn-icon close-modal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Date Range</label>
          <div class="date-range">
            <input type="date" id="export-from" placeholder="From">
            <span>to</span>
            <input type="date" id="export-to" placeholder="To">
          </div>
        </div>
        <div class="form-group">
          <label>Format</label>
          <select id="export-format">
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </div>
        <div class="form-group">
          <label>Include</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" name="include" value="details" checked> Details
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="include" value="ip"> IP Addresses
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary close-modal">Cancel</button>
        <button class="btn btn-primary" id="export-btn">Export</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelectorAll('.close-modal').forEach(btn => {
    on(btn as HTMLElement, 'click', () => overlay.remove());
  });

  on(overlay, 'click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const exportBtn = overlay.querySelector('#export-btn');
  if (exportBtn) {
    on(exportBtn as HTMLElement, 'click', async () => {
      const fromDate = (overlay.querySelector('#export-from') as HTMLInputElement).value;
      const toDate = (overlay.querySelector('#export-to') as HTMLInputElement).value;
      const format = (overlay.querySelector('#export-format') as HTMLSelectElement).value;
      const includeCheckboxes = overlay.querySelectorAll('input[name="include"]:checked');
      const include = Array.from(includeCheckboxes).map(cb => (cb as HTMLInputElement).value);

      const btn = exportBtn as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Exporting...';

      try {
        const params = new URLSearchParams();
        params.set('format', format);
        if (fromDate) params.set('from_date', fromDate);
        if (toDate) params.set('to_date', toDate);
        include.forEach(i => params.append('include', i));

        const response = await fetchWithProject(`/api/audit/export?${params}`);
        if (!response.ok) throw new Error('Export failed');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success('Audit logs exported');
        overlay.remove();
      } catch {
        toast.error('Failed to export audit logs');
        btn.disabled = false;
        btn.textContent = 'Export';
      }
    });
  }
}

/**
 * Update count
 */
function updateCount(panel: HTMLElement, count: number): void {
  const countEl = panel.querySelector('#audit-count');
  if (countEl) countEl.textContent = String(count);
}

export default createAuditPanel;
