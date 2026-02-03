/**
 * Costs Dashboard Component
 * LLM costs tracking and visualization
 */

import { createElement, on } from '../utils/dom';
import { createModal, openModal, closeModal } from './Modal';
import { costsService, CostSummary, RecentCostRequest } from '../services/graph';
import { formatCurrency, formatNumber } from '../utils/format';
import { toast } from '../services/toast';
import { billingService, type ProjectBillingSummary, formatEur, formatTokens } from '../services/billing';
import { appStore } from '../stores/app';

// Billing state
let billingSummary: ProjectBillingSummary | null = null;

const BUDGET_MODAL_ID = 'costs-budget-modal';

export interface CostsDashboardProps {
  period?: 'day' | 'week' | 'month' | 'all';
}

/**
 * Create costs dashboard component
 */
export function createCostsDashboard(props: CostsDashboardProps = {}): HTMLElement {
  const { period = 'month' } = props;

  const container = createElement('div', { className: 'costs-dashboard' });

  container.innerHTML = `
    <div class="costs-header">
      <div class="costs-header-title">
        <h3>LLM Costs</h3>
        <span class="costs-period-range" id="costs-period-range" aria-live="polite"></span>
      </div>
      <div class="costs-header-actions">
        <select id="costs-period" class="filter-select" aria-label="Time period">
          <option value="day" ${period === 'day' ? 'selected' : ''}>Today</option>
          <option value="week" ${period === 'week' ? 'selected' : ''}>This Week</option>
          <option value="month" ${period === 'month' ? 'selected' : ''}>This Month</option>
          <option value="all" ${period === 'all' ? 'selected' : ''}>All Time</option>
        </select>
        <button type="button" class="btn btn-secondary btn-sm" id="costs-export-btn" title="Export CSV or JSON">Export</button>
        <button type="button" class="btn btn-secondary btn-sm" id="costs-pricing-btn" title="View pricing table">Pricing</button>
        <button type="button" class="btn btn-secondary btn-sm" id="costs-budget-btn" title="Set budget and alert">Budget</button>
      </div>
    </div>
    <div class="costs-content" id="costs-content">
      <div class="loading">Loading costs...</div>
    </div>
    <div id="costs-pricing-panel" class="costs-pricing-panel hidden" aria-hidden="true"></div>
  `;

  // Bind events
  const periodSelect = container.querySelector('#costs-period') as HTMLSelectElement;
  on(periodSelect, 'change', () => {
    loadCosts(container, periodSelect.value as 'day' | 'week' | 'month' | 'all');
  });
  const exportBtn = container.querySelector('#costs-export-btn');
  if (exportBtn) {
    on(exportBtn, 'click', () => handleExport(periodSelect.value as 'day' | 'week' | 'month' | 'all'));
  }
  const pricingBtn = container.querySelector('#costs-pricing-btn');
  const pricingPanel = container.querySelector('#costs-pricing-panel') as HTMLElement;
  if (pricingBtn && pricingPanel) {
    on(pricingBtn, 'click', () => togglePricingPanel(pricingPanel));
  }
  on(container, 'click', (e: Event) => {
    if ((e.target as HTMLElement).id === 'costs-pricing-close') {
      pricingPanel?.classList.add('hidden');
      pricingPanel?.setAttribute('aria-hidden', 'true');
    }
  });
  const budgetBtn = container.querySelector('#costs-budget-btn');
  if (budgetBtn) {
    on(budgetBtn, 'click', () => showBudgetModal(container, periodSelect));
  }

  // Initial load
  loadCosts(container, period);

  return container;
}

/**
 * Load costs data
 */
async function loadCosts(container: HTMLElement, period: 'day' | 'week' | 'month' | 'all'): Promise<void> {
  const content = container.querySelector('#costs-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    // Get current project ID
    const state = appStore.getState();
    const projectId = state.currentProject?.id;
    
    const [data, recentRequests, billing] = await Promise.all([
      costsService.getSummary(period),
      costsService.getRecentRequests(20),
      projectId ? billingService.getProjectBillingSummary(projectId) : Promise.resolve(null)
    ]);
    
    billingSummary = billing;
    renderCosts(content, data, recentRequests);
    const periodRangeEl = container.querySelector('#costs-period-range');
    if (periodRangeEl) periodRangeEl.textContent = formatPeriod(data.period ?? { start: '', end: '' });
  } catch {
    content.innerHTML = '<div class="error">Failed to load costs</div>';
  }
}

/**
 * Render costs
 */
function renderCosts(
  container: HTMLElement,
  data: CostSummary,
  recentRequests: RecentCostRequest[] = []
): void {
  const dailyBreakdown = data.dailyBreakdown ?? [];
  const byProvider = data.byProvider ?? {};
  const byModel = data.byModel ?? {};
  const totalCalls = dailyBreakdown.reduce((sum, d) => sum + (d.calls ?? 0), 0);
  const avgPerCall = totalCalls > 0 ? data.total / totalCalls : 0;

  // Convert records to arrays for rendering (normalize empty operation keys to "other")
  const byProviderArray = Object.entries(byProvider)
    .map(([provider, cost]) => ({ provider, cost }))
    .sort((a, b) => b.cost - a.cost);
  const byModelArray = Object.entries(byModel)
    .map(([model, cost]) => ({ model, cost }))
    .sort((a, b) => b.cost - a.cost);
  const byOperationMap = new Map<string, number>();
  for (const [op, cost] of Object.entries(data.byOperation || {})) {
    const key = (op && String(op).trim()) ? String(op).trim() : 'other';
    byOperationMap.set(key, (byOperationMap.get(key) ?? 0) + cost);
  }
  const byOperationArray = Array.from(byOperationMap.entries())
    .map(([operation, cost]) => ({ operation, cost }))
    .sort((a, b) => b.cost - a.cost);
  // By context: sort by cost desc, show "unknown" as "Other"
  const byContextArray = Object.entries(data.byContext || {})
    .map(([ctx, cost]) => ({ context: (ctx === 'unknown' || !ctx?.trim()) ? 'Other' : ctx, cost }))
    .sort((a, b) => b.cost - a.cost);
  const totalInput = data.totalInputTokens ?? 0;
  const totalOutput = data.totalOutputTokens ?? 0;
  const hasNoData =
    (data.total ?? 0) === 0 &&
    dailyBreakdown.length === 0 &&
    Object.keys(byProvider).length === 0 &&
    Object.keys(byModel).length === 0;
  const periodChangeHtml =
    data.previousPeriodCost != null && data.percentChange != null
      ? `<div class="card-sub period-change ${data.percentChange >= 0 ? 'up' : 'down'}">vs previous period: ${data.percentChange >= 0 ? '+' : ''}${data.percentChange.toFixed(1)}%</div>`
      : '';

  const budgetHtml =
    data.budgetLimit != null && data.budgetUsedPercent != null
      ? `
    <div class="costs-budget-bar ${data.budgetAlertTriggered ? 'alert' : ''}">
      <div class="costs-budget-bar-fill" style="width: ${Math.min(100, data.budgetUsedPercent)}%"></div>
      <span class="costs-budget-label">${formatCurrency(data.total)} / ${formatCurrency(data.budgetLimit)} (${data.budgetUsedPercent}%)</span>
      ${data.budgetAlertTriggered ? '<span class="costs-budget-alert">Alert threshold reached</span>' : ''}
    </div>`
      : !hasNoData
      ? '<div class="costs-budget-bar costs-budget-bar-empty"><span class="costs-budget-label">No budget set</span><span class="costs-budget-set-hint">Use the Budget button above to set a limit.</span></div>'
      : '';

  const emptyStateHtml =
    hasNoData
      ? '<div class="costs-empty-state">No cost data for this period. LLM usage from Chat, document processing, and other features will appear here.</div>'
      : '';

  // Build billing banner HTML
  let billingBannerHtml = '';
  if (billingSummary) {
    const balanceDisplay = billingSummary.unlimited_balance 
      ? '<span style="color: var(--success-color); font-weight: 600;">∞ Unlimited</span>'
      : formatEur(billingSummary.balance_eur);
    
    const statusBadge = billingSummary.unlimited_balance
      ? '<span class="badge badge-success" style="font-size: 11px;">Unlimited</span>'
      : billingSummary.balance_eur <= 0
        ? '<span class="badge badge-danger" style="font-size: 11px;">Blocked</span>'
        : billingSummary.balance_percent_used >= 80
          ? '<span class="badge badge-warning" style="font-size: 11px;">Low Balance</span>'
          : '<span class="badge badge-primary" style="font-size: 11px;">Active</span>';
    
    billingBannerHtml = `
      <div class="billing-summary-banner" style="background: var(--bg-secondary); border-radius: 8px; padding: 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 24px;">
          <div>
            <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 4px;">Project Balance</div>
            <div style="font-size: 18px; font-weight: 600;">${balanceDisplay}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 4px;">Status</div>
            <div>${statusBadge}</div>
          </div>
          ${billingSummary.current_tier_name ? `
          <div>
            <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 4px;">Current Tier</div>
            <div style="font-size: 14px;">${billingSummary.current_tier_name} (+${billingSummary.current_markup_percent}%)</div>
          </div>
          ` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 24px; color: var(--text-secondary); font-size: 13px;">
          <div>
            <strong>${formatTokens(billingSummary.tokens_this_period)}</strong> tokens this period
          </div>
          <div>
            <strong>${formatEur(billingSummary.billable_cost_this_period)}</strong> billed (${billingSummary.period_key})
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    ${billingBannerHtml}
    <div class="costs-dashboard-row">
      <div class="costs-stats-grid stats-grid">
        <div class="costs-stat-card stat-card" data-stat-id="cost-total">
          <div class="stat-value">${formatCurrency(data.total)}</div>
          <div class="stat-label">Total Cost</div>
          ${periodChangeHtml}
        </div>
        <div class="costs-stat-card stat-card" data-stat-id="cost-calls">
          <div class="stat-value">${formatNumber(totalCalls)}</div>
          <div class="stat-label">API Calls</div>
        </div>
        <div class="costs-stat-card stat-card" data-stat-id="cost-avg">
          <div class="stat-value">${formatCurrency(avgPerCall)}</div>
          <div class="stat-label">Avg per Call</div>
        </div>
        <div class="costs-stat-card stat-card" data-stat-id="cost-input">
          <div class="stat-value">${formatNumber(totalInput)}</div>
          <div class="stat-label">Input Tokens</div>
        </div>
        <div class="costs-stat-card stat-card" data-stat-id="cost-output">
          <div class="stat-value">${formatNumber(totalOutput)}</div>
          <div class="stat-label">Output Tokens</div>
        </div>
      </div>
    </div>
    ${budgetHtml}
    ${emptyStateHtml}

    <div class="costs-chart-section chart-container">
      <h4 class="costs-chart-title">Daily Costs</h4>
      <div class="costs-chart-inner">
        ${renderDailyChart(dailyBreakdown, data.period ?? { start: '', end: '' })}
      </div>
    </div>

    <div class="costs-breakdown">
      <div class="breakdown-section">
        <h4>By Provider</h4>
        <div class="breakdown-list">
          ${byProviderArray.length > 0 ? byProviderArray.map(p => `
            <div class="breakdown-item">
              <span class="item-name">${escapeHtml(p.provider)}</span>
              <span class="item-value">${formatCurrency(p.cost)}</span>
            </div>
          `).join('') : '<div class="empty">No data</div>'}
        </div>
      </div>

      <div class="breakdown-section">
        <h4>By Model</h4>
        <div class="breakdown-list">
          ${byModelArray.length > 0 ? byModelArray.map(m => `
            <div class="breakdown-item">
              <span class="item-name">${escapeHtml(m.model)}</span>
              <span class="item-value">${formatCurrency(m.cost)}</span>
            </div>
          `).join('') : '<div class="empty">No data</div>'}
        </div>
      </div>

      <div class="breakdown-section">
        <h4>By Operation</h4>
        <div class="breakdown-list">
          ${byOperationArray.length > 0 ? byOperationArray.map(o => `
            <div class="breakdown-item">
              <span class="item-name">${escapeHtml(o.operation)}</span>
              <span class="item-value">${formatCurrency(o.cost)}</span>
            </div>
          `).join('') : '<div class="empty">No data</div>'}
        </div>
      </div>

      ${byContextArray.length > 0 ? `
      <div class="breakdown-section">
        <h4>By Context</h4>
        <div class="breakdown-list">
          ${byContextArray.map(c => `
            <div class="breakdown-item">
              <span class="item-name">${escapeHtml(c.context)}</span>
              <span class="item-value">${formatCurrency(c.cost)}</span>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>

    <div class="costs-recent-section">
      <h4>Recent Requests <span class="costs-recent-caption">(last 20, all time)</span></h4>
      ${renderRecentRequests(recentRequests)}
    </div>
  `;
}

/**
 * Render recent requests table
 */
function renderRecentRequests(requests: RecentCostRequest[]): string {
  if (!requests.length) {
    return '<div class="empty-recent">No recent requests</div>';
  }
  return `
    <div class="costs-recent-table-wrap">
      <table class="costs-recent-table" aria-label="Recent LLM requests">
        <thead>
          <tr>
            <th>Time</th>
            <th>Provider / Model</th>
            <th>Operation</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          ${requests
            .slice(0, 20)
            .map(
              (r) => `
            <tr>
              <td>${formatRequestTime(r.timestamp)}</td>
              <td>${escapeHtml(r.provider)} / ${escapeHtml(r.model)}</td>
              <td>${escapeHtml(r.request_type || r.operation || '—')}</td>
              <td>${(r.input_tokens ?? 0)}+${r.output_tokens ?? 0}</td>
              <td>${r.cost != null ? formatCurrency(r.cost) : '—'}</td>
              <td>${r.latency_ms != null ? `${r.latency_ms}ms` : '—'}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function formatRequestTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60000) return 'Just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Export costs as CSV or JSON (user chooses via prompt)
 */
async function handleExport(period: 'day' | 'week' | 'month' | 'all'): Promise<void> {
  const format = window.confirm('Download as JSON?\n\nCancel = CSV, OK = JSON') ? 'json' : 'csv';
  const ext = format === 'json' ? 'json' : 'csv';
  const url = `/api/costs/export?period=${period}&format=${format}`;
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(res.statusText);
    const blob = await res.blob();
    const name = `llm-costs-${period}-${new Date().toISOString().split('T')[0]}.${ext}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    console.error('Export failed:', e);
    alert('Export failed. Try again.');
  }
}

/**
 * Toggle pricing panel (fetch on first open)
 */
async function togglePricingPanel(panel: HTMLElement): Promise<void> {
  const isHidden = panel.classList.contains('hidden');
  if (isHidden && !panel.innerHTML.trim()) {
    panel.innerHTML = '<div class="loading">Loading pricing...</div>';
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
    try {
      const pricing = await costsService.getPricing();
      panel.innerHTML = renderPricingTable(pricing);
    } catch {
      panel.innerHTML = '<div class="error">Failed to load pricing</div>';
    }
  } else {
    panel.classList.toggle('hidden');
    panel.setAttribute('aria-hidden', String(panel.classList.contains('hidden')));
  }
}

async function showBudgetModal(container: HTMLElement, periodSelect: HTMLSelectElement): Promise<void> {
  const period = periodSelect.value as 'day' | 'week' | 'month' | 'all';
  const budgetPeriod: 'week' | 'month' =
    period === 'week' ? 'week' : period === 'month' ? 'month' : 'month';

  const existing = document.querySelector(`[data-modal-id="${BUDGET_MODAL_ID}"]`);
  if (existing) existing.remove();

  let currentLimit = 100;
  let currentThreshold = 80;
  try {
    const budget = await costsService.getBudget(budgetPeriod);
    if (budget?.limitUsd != null && budget.limitUsd > 0) currentLimit = budget.limitUsd;
    if (budget?.alertThresholdPercent != null) currentThreshold = Math.min(100, Math.max(0, budget.alertThresholdPercent));
  } catch {
    // use defaults
  }

  const body = createElement('div', { className: 'costs-budget-modal-body' });
  body.innerHTML = `
    <p class="costs-budget-modal-desc">Set a ${budgetPeriod}ly spending limit and get an alert when usage reaches a percentage of that limit.</p>
    <div class="form-group">
      <label for="costs-budget-limit">Budget limit (USD)</label>
      <input type="number" id="costs-budget-limit" class="form-input" min="1" max="999999" step="0.01" value="${currentLimit}" placeholder="e.g. 100" aria-label="Budget limit in USD">
      <span class="form-hint">Min 1 USD</span>
    </div>
    <div class="form-group">
      <label for="costs-budget-threshold">Alert when usage reaches (%)</label>
      <input type="number" id="costs-budget-threshold" class="form-input" min="0" max="100" value="${currentThreshold}" placeholder="e.g. 80" aria-label="Alert threshold percentage">
      <span class="form-hint">0–100%</span>
    </div>
    <p class="costs-budget-modal-hint" role="status">You will be notified when LLM costs reach this percentage of your budget.</p>
  `;

  const footer = createElement('div', { className: 'modal-footer' });
  const cancelBtn = createElement('button', { className: 'btn btn-secondary', textContent: 'Cancel' });
  const saveBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Save budget' });

  const modal = createModal({
    id: BUDGET_MODAL_ID,
    title: `Set ${budgetPeriod === 'week' ? 'weekly' : 'monthly'} budget`,
    content: body,
    size: 'md',
    closable: true,
    footer,
  });

  modal.classList.add('costs-budget-modal');

  const hintEl = body.querySelector('.costs-budget-modal-hint') as HTMLElement;

  on(cancelBtn, 'click', () => closeModal(BUDGET_MODAL_ID));
  on(saveBtn, 'click', async () => {
    const limitEl = body.querySelector('#costs-budget-limit') as HTMLInputElement;
    const thresholdEl = body.querySelector('#costs-budget-threshold') as HTMLInputElement;
    const limitUsd = limitEl ? parseFloat(limitEl.value) : NaN;
    const thresholdRaw = thresholdEl != null ? parseInt(thresholdEl.value, 10) : NaN;
    const threshold = Number.isFinite(thresholdRaw) ? Math.min(100, Math.max(0, thresholdRaw)) : 80;

    hintEl.textContent = 'You will be notified when LLM costs reach this percentage of your budget.';
    if (!Number.isFinite(limitUsd) || limitUsd < 1) {
      hintEl.textContent = 'Enter a valid budget (min 1 USD).';
      hintEl.classList.add('costs-budget-modal-hint-error');
      limitEl?.focus();
      return;
    }
    if (!Number.isFinite(thresholdRaw) || thresholdRaw < 0 || thresholdRaw > 100) {
      hintEl.textContent = 'Alert threshold must be between 0 and 100%.';
      hintEl.classList.add('costs-budget-modal-hint-error');
      thresholdEl?.focus();
      return;
    }
    hintEl.classList.remove('costs-budget-modal-hint-error');
    saveBtn.setAttribute('disabled', 'true');
    saveBtn.textContent = 'Saving…';
    try {
      await costsService.setBudget(budgetPeriod, limitUsd, threshold);
      closeModal(BUDGET_MODAL_ID);
      loadCosts(container, periodSelect.value as 'day' | 'week' | 'month' | 'all');
      toast.success('Budget saved');
    } catch (e) {
      console.error('Set budget failed:', e);
      hintEl.textContent = 'Failed to save. Please try again.';
      hintEl.classList.add('costs-budget-modal-hint-error');
      toast.error('Failed to save budget');
    } finally {
      saveBtn.removeAttribute('disabled');
      saveBtn.textContent = 'Save budget';
    }
  });

  footer.append(cancelBtn, saveBtn);
  document.body.appendChild(modal);
  openModal(BUDGET_MODAL_ID);
}

function renderPricingTable(rows: Array<{ model: string; inputPer1M: number; outputPer1M: number }>): string {
  if (!rows.length) return '<div class="empty">No pricing data</div>';
  return `
    <div class="costs-pricing-header">
      <h4>Model pricing (USD per 1M tokens)</h4>
      <button type="button" class="btn btn-sm" id="costs-pricing-close" aria-label="Close">×</button>
    </div>
    <div class="costs-pricing-table-wrap">
      <table class="costs-pricing-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Input</th>
            <th>Output</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td>${escapeHtml(r.model)}</td>
              <td>$${r.inputPer1M.toFixed(2)}</td>
              <td>$${r.outputPer1M.toFixed(2)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Build skeleton daily array for period so chart always shows structure
 */
function skeletonDailyForPeriod(period: { start: string; end: string }): Array<{ date: string; cost: number; calls: number }> {
  const days = 14;
  const result: Array<{ date: string; cost: number; calls: number }> = [];
  const d = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(d);
    date.setDate(date.getDate() - i);
    result.push({
      date: date.toISOString().split('T')[0],
      cost: 0,
      calls: 0,
    });
  }
  return result;
}

/**
 * Render daily costs chart. When no data, show skeleton bars so chart area is visible.
 */
function renderDailyChart(
  daily: Array<{ date: string; cost: number; calls: number }>,
  period?: { start: string; end: string }
): string {
  const chartDaily = daily.length > 0 ? daily : skeletonDailyForPeriod(period ?? { start: '', end: '' });
  const maxCost = Math.max(1e-9, ...chartDaily.map(d => d.cost));
  const isPlaceholder = daily.length === 0;

  return `
    <div class="daily-chart">
      <div class="chart-bars">
        ${chartDaily.map(d => {
          const height = maxCost > 0 ? Math.max(2, (d.cost / maxCost) * 100) : 2;
          return `
            <div class="bar-column" title="${d.date}: ${formatCurrency(d.cost)} (${d.calls} calls)">
              <div class="bar ${isPlaceholder && d.cost === 0 ? 'bar-placeholder' : ''}" style="height: ${height}%"></div>
              <div class="bar-label">${formatDateShort(d.date)}</div>
            </div>
          `;
        }).join('')}
      </div>
      ${isPlaceholder ? '<p class="chart-placeholder-hint">No cost data for this period. Usage will appear here as you use LLM features.</p>' : ''}
    </div>
  `;
}

/**
 * Format period display
 */
function formatPeriod(period: { start: string; end: string }): string {
  if (!period.start || !period.end) return 'All time';
  
  const start = new Date(period.start);
  const end = new Date(period.end);
  
  const formatDate = (d: Date) => d.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric' 
  });
  
  return `${formatDate(start)} - ${formatDate(end)}`;
}

/**
 * Format date short
 */
function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createCostsDashboard;
