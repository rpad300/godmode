/**
 * Dashboard Component
 * Main dashboard view with stats, health, trends, insights, and alerts
 */

import { createElement, on } from '../utils/dom';
import { dataStore } from '../stores/data';
import { appStore } from '../stores/app';
import { formatNumber, formatPercent, formatRelativeTime } from '../utils/format';
import { dashboardService, DashboardData, HealthData, Insight, Alert, TrendMetric } from '../services/dashboard';
import { http } from '../services/api';
import { risksService } from '../services/risks';

export interface DashboardStats {
  totalQuestions: number;
  answeredQuestions: number;
  totalRisks: number;
  highPriorityRisks: number;
  totalActions: number;
  completedActions: number;
  totalDecisions: number;
  totalContacts: number;
  healthScore: number;
}

export interface DashboardProps {
  onStatClick?: (statId: string) => void;
  onAlertClick?: (alert: Alert) => void;
  onInsightAction?: (insight: Insight) => void;
}

/**
 * Create dashboard element
 */
export function createDashboard(props: DashboardProps = {}): HTMLElement {
  const dashboard = createElement('div', { className: 'dashboard' });

  // Use system layout primitives
  dashboard.innerHTML = `
    <!-- Row 1: Stats Cards -->
    <div class="gm-stat-grid" id="dashboard-stats-grid"></div>

    <!-- Row 2: Insights (horizontal) -->
    <div id="dashboard-insights" class="gm-row gm-row--wrap gm-mt-4"></div>

    <!-- Row 3: Alerts if any -->
    <div id="dashboard-alerts-container" class="gm-stack gm-mt-4"></div>

    <!-- Row 4: Daily Briefing (full width) -->
    <div class="card gm-mt-6" id="dashboard-briefing"></div>

    <!-- Row 5: Golden Hours (includes Team info) -->
    <div id="dashboard-golden-hours" class="gm-mt-6"></div>

    <!-- Row 6: Charts (Questions priority, Facts by category, Trends) -->
    <div class="gm-grid-3 gm-mt-6">
      <div id="questions-chart" class="card chart-card"></div>
      <div id="facts-chart" class="card chart-card"></div>
      <div id="trends-chart" class="card chart-card"></div>
    </div>

    <!-- Row 7: Bottom - Health + Risk Summary -->
    <div class="gm-grid-2 gm-mt-6">
      <div id="dashboard-health" class="card"></div>
      <div id="risk-summary-container" class="card"></div>
    </div>
  `;

  // Load dashboard data
  loadFullDashboard(dashboard, props);

  return dashboard;
}

/**
 * Load full dashboard data from API
 */
async function loadFullDashboard(dashboard: HTMLElement, props: DashboardProps): Promise<void> {
  const healthSection = dashboard.querySelector('#dashboard-health');
  const briefingSection = dashboard.querySelector('#dashboard-briefing');
  const statsGrid = dashboard.querySelector('#dashboard-stats-grid');
  const alertsContainer = dashboard.querySelector('#dashboard-alerts-container');
  const insightsSection = dashboard.querySelector('#dashboard-insights');
  const riskSummaryContainer = dashboard.querySelector('#risk-summary-container');
  const goldenHoursSection = dashboard.querySelector('#dashboard-golden-hours');

  // Check if project is selected
  const currentProject = appStore.getState().currentProject;
  const currentProjectId = appStore.getState().currentProjectId;
  
  if (!currentProject && !currentProjectId) {
    if (statsGrid) {
      statsGrid.innerHTML = `
        <div class="card gm-center gm-pad-5" style="grid-column: 1/-1;">
          <div class="gm-icon-muted" style="font-size: 48px;">📂</div>
          <h2 class="gm-mb-2">No Project Selected</h2>
          <p class="gm-text-secondary gm-mb-4">Select a project to view your dashboard</p>
          <button class="gm-btn gm-btn--primary create-project-btn">Create New Project</button>
        </div>
      `;
      
      const createBtn = statsGrid.querySelector('.create-project-btn');
      if (createBtn) {
        createBtn.addEventListener('click', async () => {
          const { showProjectModal } = await import('./modals/ProjectModal');
          showProjectModal({
            mode: 'create',
            onSave: () => window.dispatchEvent(new CustomEvent('godmode:project-created'))
          });
        });
      }
    }
    return;
  }

  // Show loading state
  if (statsGrid) {
    statsGrid.innerHTML = '<div class="gm-loading gm-center-block"></div>';
  }

  // Load Briefing Panel (async)
  if (briefingSection && !briefingSection.hasChildNodes()) {
    import('./BriefingPanel').then(({ createBriefingPanel }) => {
      const briefingPanel = createBriefingPanel();
      briefingSection.appendChild(briefingPanel);
    }).catch(err => console.error('Failed to load BriefingPanel:', err));
  }

  try {
    const { dashboard: data, health, insights, alerts } = await dashboardService.loadAll();

    // Render health indicator
    if (healthSection && health) {
      renderHealthIndicator(healthSection as HTMLElement, health);
    }

    // Render stats
    if (statsGrid && data) {
      renderStatsGrid(statsGrid as HTMLElement, data, props.onStatClick);
    }

    // Render alerts & overdue combined
    if (alertsContainer) {
      alertsContainer.innerHTML = '';
      if (data && data.overdueActions > 0) {
        renderOverdueActionsAlert(alertsContainer as HTMLElement, data.overdueActions);
      }
      if (alerts.length > 0) {
        renderAlerts(alertsContainer as HTMLElement, alerts, props.onAlertClick);
      }
    }

    // Render insights
    if (insightsSection && insights.length > 0) {
      renderInsights(insightsSection as HTMLElement, insights, props.onInsightAction);
    }

    // Render charts
    if (data) {
      renderQuestionsPriorityChart(data);
      renderFactsChart(data);
      renderWeeklyTrendsChart(data).catch(err => console.error('Failed to render trends chart:', err));
    }

    // Load Risk Summary
    if (riskSummaryContainer && !riskSummaryContainer.hasChildNodes()) {
      risksService.getAll().then(risks => {
        renderRiskSummary(riskSummaryContainer as HTMLElement, risks);
      }).catch(err => console.error('Failed to load Risk Summary:', err));
    }

    // Load Golden Hours
    if (goldenHoursSection && !goldenHoursSection.hasChildNodes()) {
      const projectId = currentProjectId || currentProject?.id;
      if (projectId) {
        loadGoldenHours(goldenHoursSection as HTMLElement, projectId);
      }
    }
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    if (statsGrid) {
      statsGrid.innerHTML = '<div class="gm-text-danger gm-center">Failed to load dashboard data</div>';
    }
  }
}

/**
 * Render health indicator
 */
function renderHealthIndicator(container: HTMLElement, health: HealthData): void {
  if (!health || typeof health.status !== 'string') {
    container.innerHTML = `
      <div class="gm-center">
        <p class="gm-text-secondary">Health data unavailable</p>
      </div>
    `;
    return;
  }

  const score = health.score ?? 0;
  const color = health.color || 'var(--color-text-muted)';
  
  container.innerHTML = `
    <div class="gm-center">
      <div style="position: relative; width: 80px; height: 80px; margin: 0 auto 16px; border-radius: 50%; background: conic-gradient(${color} ${score}%, var(--color-border) 0); display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; inset: 8px; background: var(--color-surface); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <span style="font-size: 24px; font-weight: 700; color: var(--color-text);">${score}</span>
          <span style="font-size: 10px; text-transform: uppercase; color: var(--color-text-muted);">Health</span>
        </div>
      </div>
      <h4 style="color: ${color}; margin-bottom: 8px;">${health.status}</h4>
      <div class="gm-stack">
        ${(health.factors || []).slice(0, 3).map(f => `
          <div class="gm-row gm-surface--sm ${f.type === 'positive' ? 'gm-text-success' : 'gm-text-danger'}">
            <span>${f.type === 'positive' ? '✓' : '!'}</span>
            <span class="gm-fs-12">${f.factor}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Render stats grid
 */
function renderStatsGrid(container: HTMLElement, data: DashboardData, onClick?: (statId: string) => void): void {
  const qPriority = data.questionsByPriority || { resolved: 0 };
  const rImpact = data.risksByImpact || { high: 0 };
  const factsVerified = data.factsVerifiedCount ?? 0;

  const stats = [
    { id: 'facts', label: 'Facts', value: data.totalFacts ?? 0, sub: factsVerified > 0 ? `${factsVerified} verified` : undefined, color: 'var(--color-primary)' },
    { id: 'questions', label: 'Questions', value: data.totalQuestions ?? 0, sub: `${qPriority.resolved} resolved`, color: 'var(--color-warning)' },
    { id: 'decisions', label: 'Decisions', value: data.totalDecisions ?? 0, color: 'var(--color-success)' },
    { id: 'risks', label: 'Risks', value: data.totalRisks ?? 0, sub: `${rImpact.high} high`, color: 'var(--color-danger)' },
    { id: 'actions', label: 'Actions', value: data.totalActions ?? 0, sub: `${data.overdueActions ?? 0} overdue`, color: 'var(--color-info)' },
  ];

  container.innerHTML = stats.map(stat => `
    <div class="gm-stat card gm-pointer" data-stat-id="${stat.id}" style="border-top: 3px solid ${stat.color};">
      <div class="gm-stat__value">${stat.value}</div>
      <div class="gm-stat__label">${stat.label}</div>
      ${stat.sub ? `<div class="gm-fs-11 gm-text-secondary gm-mt-1">${stat.sub}</div>` : ''}
    </div>
  `).join('');

  if (onClick) {
    container.querySelectorAll('[data-stat-id]').forEach(card => {
      card.addEventListener('click', () => {
        const statId = card.getAttribute('data-stat-id');
        if (statId) onClick(statId);
      });
    });
  }
}

/**
 * Render alerts
 */
function renderAlerts(container: HTMLElement, alerts: Alert[], onClick?: (alert: Alert) => void): void {
  alerts.slice(0, 5).forEach((alert, i) => {
    const el = createElement('div', { className: `gm-alert gm-alert--${alert.severity === 'critical' ? 'danger' : 'warning'} gm-pointer` });
    el.innerHTML = `
      <div class="gm-alert__header">
        <span class="gm-alert__icon">${alert.severity === 'critical' ? '🔴' : '⚠️'}</span>
        <span class="gm-strong">${alert.title}</span>
      </div>
      <div class="gm-alert__message">${alert.message}</div>
    `;
    if (onClick) {
      el.addEventListener('click', () => onClick(alert));
    }
    container.appendChild(el);
  });
}

/**
 * Render insights
 */
function renderInsights(container: HTMLElement, insights: Insight[], onAction?: (insight: Insight) => void): void {
  container.innerHTML = insights.slice(0, 4).map((insight, i) => `
    <div class="card gm-row gm-ai-start gm-pointer" style="flex: 1; min-width: 280px; padding: var(--space-3);" data-insight-index="${i}">
      <div class="gm-avatar" style="background: var(--color-surface-2); color: var(--color-primary);">${insight.icon}</div>
      <div>
        <div class="gm-strong gm-fs-13">${insight.title}</div>
        <div class="gm-text-secondary gm-fs-12">${insight.message}</div>
      </div>
    </div>
  `).join('');
}

/**
 * Render overdue actions alert
 */
function renderOverdueActionsAlert(container: HTMLElement, overdueCount: number): void {
  const el = createElement('div', { className: 'gm-alert gm-alert--danger gm-row gm-row--between' });
  el.innerHTML = `
    <div class="gm-row">
      <span class="gm-fs-16">⚠️</span>
      <div>
        <div class="gm-strong">${overdueCount} Overdue Action${overdueCount !== 1 ? 's' : ''}</div>
        <div class="gm-fs-12">Immediate attention required</div>
      </div>
    </div>
    <button class="gm-btn gm-btn--sm gm-btn--secondary" id="view-overdue-btn">View</button>
  `;
  
  el.querySelector('#view-overdue-btn')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('godmode:navigate', { 
      detail: { tab: 'sot', view: 'actions', filter: 'overdue' }
    }));
  });
  
  container.appendChild(el);
}

/**
 * Render Risk Summary Chart
 */
function renderRiskSummary(container: HTMLElement, risks: Array<{ impact?: string; likelihood?: string; status?: string }>): void {
  const activeRisks = risks.filter(r => r.status !== 'mitigated' && r.status !== 'closed');
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  
  activeRisks.forEach(risk => {
    const impact = (risk.impact || 'low').toLowerCase();
    const likelihood = (risk.likelihood || 'low').toLowerCase();
    let severity = 'low';
    if (impact === 'critical' || (impact === 'high' && likelihood === 'high')) severity = 'critical';
    else if (impact === 'high' || (impact === 'medium' && likelihood === 'high')) severity = 'high';
    else if (impact === 'medium') severity = 'medium';
    
    counts[severity as keyof typeof counts]++;
  });

  const total = activeRisks.length;
  
  container.innerHTML = `
    <div class="gm-row gm-row--between gm-mb-4">
      <h4>Risk Overview</h4>
      <span class="badge badge--outline">${total} active</span>
    </div>
    
    <div class="gm-stack">
      ${(['critical', 'high', 'medium', 'low'] as const).map(level => `
        <div class="gm-row gm-fs-12">
          <span class="gm-w-80" style="text-transform: capitalize;">${level}</span>
          <div style="flex: 1; height: 6px; background: var(--color-surface-2); border-radius: 3px; overflow: hidden;">
            <div style="height: 100%; width: ${total > 0 ? (counts[level] / total) * 100 : 0}%; background: var(--color-${level === 'critical' ? 'danger' : level === 'high' ? 'warning' : level === 'medium' ? 'info' : 'success'});"></div>
          </div>
          <span class="gm-text-secondary" style="width: 24px; text-align: right;">${counts[level]}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Render facts chart
 */
function renderFactsChart(data: DashboardData): void {
  const container = document.getElementById('facts-chart');
  if (!container) return;

  const byCat = data.factsByCategory || {};
  const categories = ['technical', 'process', 'policy', 'people', 'timeline', 'general'] as const;
  const total = categories.reduce((sum, c) => sum + (byCat[c] ?? 0), 0);

  if (total === 0) {
    container.innerHTML = '<div class="gm-center gm-text-secondary gm-pad-5">No facts yet</div>';
    return;
  }

  container.innerHTML = `
    <h4 class="gm-mb-4">Facts by Category</h4>
    <div class="gm-stack">
      ${categories.map(cat => {
        const count = byCat[cat] ?? 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return `
        <div class="gm-row gm-fs-12">
          <span class="gm-w-80" style="text-transform: capitalize;">${cat}</span>
          <div style="flex: 1; height: 6px; background: var(--color-surface-2); border-radius: 3px; overflow: hidden;">
            <div style="height: 100%; width: ${pct}%; background: var(--color-primary);"></div>
          </div>
          <span class="gm-text-secondary" style="width: 24px; text-align: right;">${count}</span>
        </div>`;
      }).join('')}
    </div>
  `;
}

/**
 * Render questions chart
 */
function renderQuestionsPriorityChart(data: DashboardData): void {
  const container = document.getElementById('questions-chart');
  if (!container) return;

  const { critical, high, medium, resolved } = data.questionsByPriority || { critical: 0, high: 0, medium: 0, resolved: 0 };
  const total = critical + high + medium + resolved;
  
  if (total === 0) {
    container.innerHTML = '<div class="gm-center gm-text-secondary gm-pad-5">No questions yet</div>';
    return;
  }

  container.innerHTML = `
    <h4 class="gm-mb-4">Questions Status</h4>
    <div class="gm-stack">
      <div class="gm-row gm-fs-12">
        <span class="gm-w-80">Critical</span>
        <div style="flex: 1; height: 6px; background: var(--color-surface-2); border-radius: 3px; overflow: hidden;">
          <div style="height: 100%; width: ${(critical / total) * 100}%; background: var(--color-danger);"></div>
        </div>
        <span class="gm-text-secondary" style="width: 24px; text-align: right;">${critical}</span>
      </div>
      <div class="gm-row gm-fs-12">
        <span class="gm-w-80">High</span>
        <div style="flex: 1; height: 6px; background: var(--color-surface-2); border-radius: 3px; overflow: hidden;">
          <div style="height: 100%; width: ${(high / total) * 100}%; background: var(--color-warning);"></div>
        </div>
        <span class="gm-text-secondary" style="width: 24px; text-align: right;">${high}</span>
      </div>
      <div class="gm-row gm-fs-12">
        <span class="gm-w-80">Resolved</span>
        <div style="flex: 1; height: 6px; background: var(--color-surface-2); border-radius: 3px; overflow: hidden;">
          <div style="height: 100%; width: ${(resolved / total) * 100}%; background: var(--color-success);"></div>
        </div>
        <span class="gm-text-secondary" style="width: 24px; text-align: right;">${resolved}</span>
      </div>
    </div>
  `;
}

/**
 * Render weekly trends chart
 */
async function renderWeeklyTrendsChart(data: DashboardData): Promise<void> {
  const container = document.getElementById('trends-chart');
  if (!container) return;

  container.innerHTML = '<div class="gm-loading gm-center-block"></div>';

  try {
    const trendsData = await dashboardService.getTrends(7);
    
    if (!trendsData || !trendsData.history || trendsData.history.length === 0) {
      container.innerHTML = '<div class="gm-center gm-text-secondary gm-pad-5">No trend data</div>';
      return;
    }

    const history = trendsData.history;
    const maxVal = Math.max(...history.map(h => Math.max(h.facts || 0, h.questions || 0, h.risks || 0)), 1);

    container.innerHTML = `
      <h4 class="gm-mb-4">Weekly Trends</h4>
      <div style="display: flex; align-items: flex-end; height: 120px; gap: 8px;">
        ${history.map(day => `
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;">
            <div style="display: flex; gap: 2px; align-items: flex-end; height: 100%; width: 100%;">
              <div style="flex: 1; background: var(--color-primary); border-radius: 2px 2px 0 0; height: ${((day.facts || 0) / maxVal) * 100}%;"></div>
              <div style="flex: 1; background: var(--color-warning); border-radius: 2px 2px 0 0; height: ${((day.questions || 0) / maxVal) * 100}%;"></div>
            </div>
            <span class="gm-fs-10 gm-text-secondary">${new Date(day.date).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    container.innerHTML = '<div class="gm-text-danger">Failed to load trends</div>';
  }
}

/**
 * Load Golden Hours section
 */
async function loadGoldenHours(container: HTMLElement, projectId: string): Promise<void> {
  // Placeholder for simple view
  container.innerHTML = `
    <div class="card">
      <div class="gm-row gm-row--between gm-mb-4">
        <h4>Golden Hours</h4>
        <span class="badge badge--outline">${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
      </div>
      <div class="gm-center gm-text-secondary gm-pad-5">
        Team availability view
      </div>
    </div>
  `;
}

// Helpers
function getHealthClass(score: number): string {
  if (score >= 80) return 'gm-text-success';
  if (score >= 60) return 'gm-text-primary';
  if (score >= 40) return 'gm-text-warning';
  return 'gm-text-danger';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createDashboard;
