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

  // Layout: Stats → Insights → Briefing → Bottom Row (Health + Charts)
  dashboard.innerHTML = `
    <!-- Row 1: Stats Cards -->
    <div class="dashboard-row">
      <div id="dashboard-stats-grid" class="stats-grid"></div>
    </div>

    <!-- Row 2: Insights (horizontal) -->
    <div id="dashboard-insights" class="dashboard-insights-row"></div>

    <!-- Row 3: Alerts if any -->
    <div id="dashboard-overdue" class="dashboard-overdue-section"></div>
    <div id="dashboard-alerts" class="dashboard-alerts-section"></div>

    <!-- Row 4: Daily Briefing (full width) -->
    <div class="dashboard-briefing-section" id="dashboard-briefing"></div>

    <!-- Row 5: Golden Hours (includes Team info) -->
    <div id="dashboard-golden-hours" class="dashboard-golden-hours-section"></div>

    <!-- Row 6: Charts (Questions priority, Facts by category, Trends) -->
    <div class="dashboard-charts-row">
      <div id="questions-chart" class="chart-container"></div>
      <div id="facts-chart" class="chart-container"></div>
      <div id="trends-chart" class="chart-container"></div>
    </div>

    <!-- Row 7: Bottom - Health + Risk Summary -->
    <div class="dashboard-bottom-row">
      <div id="dashboard-health" class="dashboard-health-card"></div>
      <div id="risk-summary-container" class="dashboard-risk-summary-card"></div>
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
  const overdueSection = dashboard.querySelector('#dashboard-overdue');
  const alertsSection = dashboard.querySelector('#dashboard-alerts');
  const insightsSection = dashboard.querySelector('#dashboard-insights');
  const riskSummaryContainer = dashboard.querySelector('#risk-summary-container');
  const goldenHoursSection = dashboard.querySelector('#dashboard-golden-hours');

  // Check if project is selected
  const currentProject = appStore.getState().currentProject;
  const currentProjectId = appStore.getState().currentProjectId;
  
  if (!currentProject && !currentProjectId) {
    // No project selected - show empty state
    if (statsGrid) {
      statsGrid.innerHTML = `
        <div class="no-project-state" style="
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 24px;
          text-align: center;
          background: linear-gradient(135deg, rgba(225,29,72,0.05) 0%, rgba(225,29,72,0.02) 100%);
          border-radius: 16px;
          border: 2px dashed rgba(225,29,72,0.2);
          min-height: 300px;
        ">
          <svg width="80" height="80" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: #e11d48; margin-bottom: 20px; opacity: 0.6;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
          </svg>
          <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: var(--text-primary);">No Project Selected</h2>
          <p style="margin: 0 0 24px 0; font-size: 15px; color: var(--text-secondary); max-width: 450px; line-height: 1.6;">
            Select a project from the dropdown in the header to view your dashboard, or create a new project to get started.
          </p>
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-primary create-project-btn" style="
              padding: 12px 28px;
              font-size: 14px;
              font-weight: 600;
              display: inline-flex;
              align-items: center;
              gap: 8px;
            ">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Create New Project
            </button>
          </div>
        </div>
      `;
      
      // Bind create project button
      const createBtn = statsGrid.querySelector('.create-project-btn');
      if (createBtn) {
        createBtn.addEventListener('click', async () => {
          const { showProjectModal } = await import('./modals/ProjectModal');
          showProjectModal({
            mode: 'create',
            onSave: () => {
              // Trigger refresh
              window.dispatchEvent(new CustomEvent('godmode:project-created'));
            }
          });
        });
      }
    }
    
    // Hide other sections
    if (healthSection) (healthSection as HTMLElement).innerHTML = '';
    if (briefingSection) (briefingSection as HTMLElement).innerHTML = '';
    if (overdueSection) (overdueSection as HTMLElement).innerHTML = '';
    if (alertsSection) (alertsSection as HTMLElement).innerHTML = '';
    if (insightsSection) (insightsSection as HTMLElement).innerHTML = '';
    if (riskSummaryContainer) (riskSummaryContainer as HTMLElement).innerHTML = '';
    if (goldenHoursSection) (goldenHoursSection as HTMLElement).innerHTML = '';
    
    return;
  }

  // Show loading state
  if (statsGrid) {
    statsGrid.innerHTML = '<div class="loading-placeholder">Loading dashboard...</div>';
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

    // Render overdue actions alert
    if (overdueSection && data && data.overdueActions > 0) {
      renderOverdueActionsAlert(overdueSection as HTMLElement, data.overdueActions);
    }

    // Render alerts
    if (alertsSection && alerts.length > 0) {
      renderAlerts(alertsSection as HTMLElement, alerts, props.onAlertClick);
    }

    // Render insights
    if (insightsSection && insights.length > 0) {
      renderInsights(insightsSection as HTMLElement, insights, props.onInsightAction);
    }

    // Render charts
    if (data) {
      renderQuestionsPriorityChart(data);
      renderFactsChart(data);
      // Load trends asynchronously (don't block)
      renderWeeklyTrendsChart(data).catch(err => 
        console.error('Failed to render trends chart:', err)
      );
    }

    // Load Risk Summary with risks data (donut, bars, and 2D matrix)
    if (riskSummaryContainer && !riskSummaryContainer.hasChildNodes()) {
      risksService.getAll().then(risks => {
        renderRiskSummary(riskSummaryContainer as HTMLElement, risks);
      }).catch(err => console.error('Failed to load Risk Summary:', err));
    }

    // Load Golden Hours section (includes Team info)
    if (goldenHoursSection && !goldenHoursSection.hasChildNodes()) {
      const projectId = currentProjectId || currentProject?.id;
      if (projectId) {
        loadGoldenHours(goldenHoursSection as HTMLElement, projectId);
      }
    }
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    if (statsGrid) {
      statsGrid.innerHTML = '<div class="error-message">Failed to load dashboard data</div>';
    }
  }
}

/**
 * Render health indicator
 */
function renderHealthIndicator(container: HTMLElement, health: HealthData): void {
  // Handle missing or incomplete health data
  if (!health || typeof health.status !== 'string') {
    container.innerHTML = `
      <div class="health-indicator unknown">
        <div class="health-gauge">
          <span class="score-value">--</span>
          <span class="score-label">Health</span>
        </div>
        <p class="health-status">Health data unavailable</p>
      </div>
    `;
    return;
  }

  const statusClass = health.status.toLowerCase().replace(/\s+/g, '-');
  const score = health.score ?? 0;
  const color = health.color || '#888';
  const factors = health.factors || [];
  
  container.innerHTML = `
    <div class="health-indicator ${statusClass}">
      <div class="health-gauge">
        <div class="health-score" style="--score: ${score}%">
          <span class="score-value">${score}</span>
          <span class="score-label">Health</span>
        </div>
        <div class="health-bar">
          <div class="health-fill" style="width: ${score}%; background: ${color}"></div>
        </div>
      </div>
      <div class="health-status">
        <span class="status-text" style="color: ${color}">${health.status}</span>
      </div>
      <div class="health-factors">
        ${factors.slice(0, 3).map(f => `
          <div class="factor ${f.type}">
            <span class="factor-icon">${f.type === 'positive' ? '✓' : '!'}</span>
            <span class="factor-text">${f.factor}</span>
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
  // Safe access to nested properties with defaults
  const docs = data.documents || { total: 0, processed: 0, pending: 0 };
  const qPriority = data.questionsByPriority || { critical: 0, high: 0, medium: 0, resolved: 0 };
  const rImpact = data.risksByImpact || { high: 0, medium: 0, low: 0 };

  const factsVerified = data.factsVerifiedCount ?? 0;
  const stats = [
    { id: 'facts', label: 'Facts', value: data.totalFacts ?? 0, sub: factsVerified > 0 ? `${factsVerified} verified` : undefined, icon: '💡' },
    { id: 'questions', label: 'Questions', value: data.totalQuestions ?? 0, sub: `${qPriority.resolved} resolved`, icon: '❓' },
    { id: 'decisions', label: 'Decisions', value: data.totalDecisions ?? 0, icon: '🎯' },
    { id: 'risks', label: 'Risks', value: data.totalRisks ?? 0, sub: `${rImpact.high} high`, icon: '⚠️' },
    { id: 'actions', label: 'Actions', value: data.totalActions ?? 0, sub: `${data.overdueActions ?? 0} overdue`, icon: '✅' },
  ];

  container.innerHTML = stats.map(stat => `
    <div class="stat-card" data-stat-id="${stat.id}">
      <div class="stat-value">${stat.value}</div>
      <div class="stat-label">${stat.label}</div>
      ${stat.sub ? `<div class="stat-sub">${stat.sub}</div>` : ''}
    </div>
  `).join('');

  // Bind click events
  if (onClick) {
    container.querySelectorAll('.stat-card[data-stat-id]').forEach(card => {
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
  container.innerHTML = `
    <div class="alerts-header">
      <h3>Alerts</h3>
      <span class="alerts-count">${alerts.length}</span>
    </div>
    <div class="alerts-list">
      ${alerts.slice(0, 5).map((alert, i) => `
        <div class="alert-item ${alert.severity}" data-alert-index="${i}">
          <span class="alert-icon">${getAlertIcon(alert.severity)}</span>
          <div class="alert-content">
            <div class="alert-title">${alert.title}</div>
            <div class="alert-message">${alert.message}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Bind click events
  if (onClick) {
    container.querySelectorAll('.alert-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.getAttribute('data-alert-index') || '0', 10);
        onClick(alerts[index]);
      });
    });
  }
}

/**
 * Render insights
 */
function renderInsights(container: HTMLElement, insights: Insight[], onAction?: (insight: Insight) => void): void {
  // Render insights directly as horizontal cards
  container.innerHTML = insights.slice(0, 4).map((insight, i) => `
    <div class="insight-item ${insight.type}" data-insight-index="${i}">
      <span class="insight-icon">${insight.icon}</span>
      <div class="insight-content">
        <div class="insight-title">${insight.title}</div>
        <div class="insight-message">${insight.message}</div>
      </div>
    </div>
  `).join('');
}

/**
 * Render Risk Summary Chart (compact donut + bars)
 */
function renderRiskSummary(container: HTMLElement, risks: Array<{ impact?: string; likelihood?: string; status?: string }>): void {
  // Count risks by severity
  const getSeverity = (impact?: string, likelihood?: string): string => {
    const impactLevel = ['low', 'medium', 'high', 'critical'].indexOf(impact?.toLowerCase() || 'low');
    const likelihoodLevel = ['low', 'medium', 'high'].indexOf(likelihood?.toLowerCase() || 'low');
    const score = impactLevel + likelihoodLevel;
    if (score >= 4) return 'critical';
    if (score >= 3) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  };

  const activeRisks = risks.filter(r => r.status !== 'mitigated' && r.status !== 'closed');
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  
  activeRisks.forEach(risk => {
    const severity = getSeverity(risk.impact, risk.likelihood);
    counts[severity as keyof typeof counts]++;
  });

  const total = activeRisks.length;
  const mitigated = risks.length - activeRisks.length;

  // Calculate percentages for donut
  const getPercent = (count: number) => total > 0 ? Math.round((count / total) * 100) : 0;
  
  // Create conic gradient for donut
  let conicStops = '';
  let currentDeg = 0;
  
  const colors = {
    critical: '#ef4444',
    high: '#f97316', 
    medium: '#eab308',
    low: '#22c55e'
  };

  (['critical', 'high', 'medium', 'low'] as const).forEach(level => {
    const percent = getPercent(counts[level]);
    const degrees = (percent / 100) * 360;
    if (degrees > 0) {
      conicStops += `${colors[level]} ${currentDeg}deg ${currentDeg + degrees}deg, `;
      currentDeg += degrees;
    }
  });

  // Default to gray if no risks
  if (!conicStops) {
    conicStops = 'var(--color-border) 0deg 360deg';
  } else {
    conicStops = conicStops.slice(0, -2); // Remove trailing comma
  }

  container.innerHTML = `
    <div class="risk-summary">
      <div class="risk-summary-header">
        <h4>Risk Overview</h4>
        <span class="risk-total">${total} active</span>
      </div>
      
      <div class="risk-summary-content">
        <div class="risk-donut-container">
          <div class="risk-donut" style="background: conic-gradient(${conicStops})">
            <div class="risk-donut-center">
              <span class="donut-value">${total}</span>
              <span class="donut-label">Risks</span>
            </div>
          </div>
        </div>
        
        <div class="risk-bars">
          <div class="risk-bar-item critical">
            <span class="bar-icon">🔴</span>
            <span class="bar-label">Critical</span>
            <div class="bar-track"><div class="bar-fill" style="width: ${getPercent(counts.critical)}%"></div></div>
            <span class="bar-count">${counts.critical}</span>
          </div>
          <div class="risk-bar-item high">
            <span class="bar-icon">🟠</span>
            <span class="bar-label">High</span>
            <div class="bar-track"><div class="bar-fill" style="width: ${getPercent(counts.high)}%"></div></div>
            <span class="bar-count">${counts.high}</span>
          </div>
          <div class="risk-bar-item medium">
            <span class="bar-icon">🟡</span>
            <span class="bar-label">Medium</span>
            <div class="bar-track"><div class="bar-fill" style="width: ${getPercent(counts.medium)}%"></div></div>
            <span class="bar-count">${counts.medium}</span>
          </div>
          <div class="risk-bar-item low">
            <span class="bar-icon">🟢</span>
            <span class="bar-label">Low</span>
            <div class="bar-track"><div class="bar-fill" style="width: ${getPercent(counts.low)}%"></div></div>
            <span class="bar-count">${counts.low}</span>
          </div>
        </div>
      </div>
      
      ${mitigated > 0 ? `
        <div class="risk-mitigated">
          <span class="mitigated-icon">✓</span>
          <span>${mitigated} risk${mitigated > 1 ? 's' : ''} mitigated</span>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render facts by category chart
 */
function renderFactsChart(data: DashboardData): void {
  const container = document.getElementById('facts-chart');
  if (!container) return;

  const byCat = data.factsByCategory || {};
  const categories = ['technical', 'process', 'policy', 'people', 'timeline', 'general'] as const;
  const total = categories.reduce((sum, c) => sum + (byCat[c] ?? 0), 0);

  if (total === 0) {
    container.innerHTML = '<div class="empty-chart">No facts yet</div>';
    return;
  }

  container.innerHTML = `
    <div class="facts-chart-title">Facts by category</div>
    <div class="priority-bars">
      ${categories.map(cat => {
        const count = byCat[cat] ?? 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return `
        <div class="priority-bar">
          <div class="bar-label">${cat}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%"></div>
          </div>
          <div class="bar-value">${count}</div>
        </div>`;
      }).join('')}
    </div>
  `;
}

/**
 * Render questions by priority chart
 */
function renderQuestionsPriorityChart(data: DashboardData): void {
  const container = document.getElementById('questions-chart');
  if (!container) return;

  const { critical, high, medium, resolved } = data.questionsByPriority;
  const total = critical + high + medium + resolved;
  
  if (total === 0) {
    container.innerHTML = '<div class="empty-chart">No questions yet</div>';
    return;
  }

  container.innerHTML = `
    <div class="priority-bars">
      <div class="priority-bar">
        <div class="bar-label">Critical</div>
        <div class="bar-track">
          <div class="bar-fill critical" style="width: ${(critical / total) * 100}%"></div>
        </div>
        <div class="bar-value">${critical}</div>
      </div>
      <div class="priority-bar">
        <div class="bar-label">High</div>
        <div class="bar-track">
          <div class="bar-fill high" style="width: ${(high / total) * 100}%"></div>
        </div>
        <div class="bar-value">${high}</div>
      </div>
      <div class="priority-bar">
        <div class="bar-label">Medium</div>
        <div class="bar-track">
          <div class="bar-fill medium" style="width: ${(medium / total) * 100}%"></div>
        </div>
        <div class="bar-value">${medium}</div>
      </div>
      <div class="priority-bar">
        <div class="bar-label">Resolved</div>
        <div class="bar-track">
          <div class="bar-fill resolved" style="width: ${(resolved / total) * 100}%"></div>
        </div>
        <div class="bar-value">${resolved}</div>
      </div>
    </div>
  `;
}

/**
 * Render weekly trends chart with real API data
 */
async function renderWeeklyTrendsChart(data: DashboardData): Promise<void> {
  const container = document.getElementById('trends-chart');
  if (!container) return;

  // Show loading state
  container.innerHTML = '<div class="loading">Loading trends...</div>';

  try {
    // Fetch real trends data from API
    const trendsData = await dashboardService.getTrends(7);
    
    if (!trendsData || !trendsData.history || trendsData.history.length === 0) {
      container.innerHTML = '<div class="empty-chart">No trend data available yet</div>';
      return;
    }

    // Use real history data
    const history = trendsData.history;
    
    // Build arrays from history
    const days: string[] = [];
    const trends = {
      facts: [] as number[],
      questions: [] as number[],
      risks: [] as number[],
      actions: [] as number[],
    };

    history.forEach(entry => {
      const d = new Date(entry.date);
      days.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
      trends.facts.push(entry.facts || 0);
      trends.questions.push(entry.questions || 0);
      trends.risks.push(entry.risks || 0);
      trends.actions.push(entry.actions || 0);
    });

    const maxValue = Math.max(
      ...trends.facts, 
      ...trends.questions, 
      ...trends.risks, 
      ...trends.actions, 
      1
    );

    container.innerHTML = `
      <div class="trends-chart">
        <div class="trends-legend">
          <span class="legend-item"><span class="legend-dot facts"></span>Facts</span>
          <span class="legend-item"><span class="legend-dot questions"></span>Questions</span>
          <span class="legend-item"><span class="legend-dot risks"></span>Risks</span>
          <span class="legend-item"><span class="legend-dot actions"></span>Actions</span>
        </div>
        <div class="trends-bars">
          ${days.map((day, i) => `
            <div class="trend-column">
              <div class="trend-bars-group">
                <div class="trend-bar facts" style="height: ${(trends.facts[i] / maxValue) * 100}%" title="Facts: ${trends.facts[i]}"></div>
                <div class="trend-bar questions" style="height: ${(trends.questions[i] / maxValue) * 100}%" title="Questions: ${trends.questions[i]}"></div>
                <div class="trend-bar risks" style="height: ${(trends.risks[i] / maxValue) * 100}%" title="Risks: ${trends.risks[i]}"></div>
                <div class="trend-bar actions" style="height: ${(trends.actions[i] / maxValue) * 100}%" title="Actions: ${trends.actions[i]}"></div>
              </div>
              <div class="trend-label">${day}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load trends:', error);
    container.innerHTML = '<div class="error">Failed to load trend data</div>';
  }
}

/**
 * Render overdue actions alert
 */
function renderOverdueActionsAlert(container: HTMLElement, overdueCount: number): void {
  if (overdueCount === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="overdue-alert">
      <div class="overdue-icon">⚠️</div>
      <div class="overdue-content">
        <strong>${overdueCount} Overdue Action${overdueCount !== 1 ? 's' : ''}</strong>
        <span>Action items past their due date require immediate attention</span>
      </div>
      <button class="btn btn-sm btn-warning" id="view-overdue-btn">View Actions</button>
    </div>
  `;

  // Bind view button
  const viewBtn = container.querySelector('#view-overdue-btn');
  if (viewBtn) {
    viewBtn.addEventListener('click', () => {
      // Navigate to actions tab with overdue filter
      window.dispatchEvent(new CustomEvent('godmode:navigate', { 
        detail: { tab: 'sot', view: 'actions', filter: 'overdue' }
      }));
    });
  }
}

/**
 * Get alert icon based on severity
 */
function getAlertIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'warning': return '🟡';
    default: return '⚪';
  }
}

/**
 * Create a stat card element
 */
function createStatCard(
  config: {
    id: string;
    label: string;
    icon: string;
    getValue: (s: DashboardStats) => string | number;
    subValue?: (s: DashboardStats) => string;
    isScore?: boolean;
  },
  onClick?: (statId: string) => void
): HTMLElement {
  const card = createElement('div', {
    className: `stat-item ${onClick ? 'clickable' : ''}`,
  });
  card.setAttribute('data-stat-id', config.id);

  if (onClick) {
    on(card, 'click', () => onClick(config.id));
  }

  card.innerHTML = `
    <div class="stat-icon">${config.icon}</div>
    <div class="value" data-value>-</div>
    <div class="label">${config.label}</div>
    ${config.subValue ? '<div class="sub-value" data-sub-value></div>' : ''}
  `;

  return card;
}

/**
 * Update dashboard with current data
 */
function updateDashboard(
  statsGrid: HTMLElement,
  statConfigs: Array<{
    id: string;
    getValue: (s: DashboardStats) => string | number;
    subValue?: (s: DashboardStats) => string;
    isScore?: boolean;
  }>
): void {
  const data = dataStore.getState();

  // Only count active questions (not dismissed/resolved/closed)
  const activeQuestions = data.questions.filter(q => 
    q.status !== 'dismissed' && q.status !== 'resolved' && q.status !== 'closed' && q.status !== 'answered'
  );
  
  const stats: DashboardStats = {
    totalQuestions: activeQuestions.length,
    answeredQuestions: data.questions.filter(q => q.status === 'answered' || q.status === 'resolved').length,
    totalRisks: data.risks.length,
    highPriorityRisks: data.risks.filter(r => r.impact === 'high').length,
    totalActions: data.actions.length,
    completedActions: data.actions.filter(a => a.status === 'completed').length,
    totalDecisions: data.decisions.length,
    totalContacts: data.contacts.length,
    healthScore: calculateHealthScore(data),
  };

  statConfigs.forEach(config => {
    const card = statsGrid.querySelector(`[data-stat-id="${config.id}"]`);
    if (!card) return;

    const valueEl = card.querySelector('[data-value]');
    const subValueEl = card.querySelector('[data-sub-value]');

    if (valueEl) {
      const value = config.getValue(stats);
      valueEl.textContent = typeof value === 'number' ? formatNumber(value) : value;

      // Add color for health score
      if (config.isScore && typeof value === 'number') {
        valueEl.className = 'value ' + getHealthClass(value);
      }
    }

    if (subValueEl && config.subValue) {
      subValueEl.textContent = config.subValue(stats);
    }
  });
}

/**
 * Calculate health score from data
 */
function calculateHealthScore(data: ReturnType<typeof dataStore.getState>): number {
  const weights = {
    questionsAnswered: 25,
    risksManaged: 25,
    actionsCompleted: 25,
    decisionsProgress: 25,
  };

  let score = 0;

  // Questions answered
  if (data.questions.length > 0) {
    const answered = data.questions.filter(q => q.status === 'answered').length;
    score += (answered / data.questions.length) * weights.questionsAnswered;
  } else {
    score += weights.questionsAnswered;
  }

  // Risks managed
  if (data.risks.length > 0) {
    const managed = data.risks.filter(r => r.status !== 'open').length;
    score += (managed / data.risks.length) * weights.risksManaged;
  } else {
    score += weights.risksManaged;
  }

  // Actions completed
  if (data.actions.length > 0) {
    const completed = data.actions.filter(a => a.status === 'completed').length;
    score += (completed / data.actions.length) * weights.actionsCompleted;
  } else {
    score += weights.actionsCompleted;
  }

  // Decisions made
  if (data.decisions.length > 0) {
    const approved = data.decisions.filter(d => d.status === 'approved').length;
    score += (approved / data.decisions.length) * weights.decisionsProgress;
  } else {
    score += weights.decisionsProgress;
  }

  return Math.round(score);
}

/**
 * Get CSS class for health score
 */
function getHealthClass(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
}

/**
 * Load and render project team section
 */
async function loadProjectTeam(container: HTMLElement, projectId: string): Promise<void> {
  try {
    const response = await http.get<{ members: ProjectMember[] }>(`/api/projects/${projectId}/members`);
    const members = response.data?.members || [];
    
    if (members.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <style>
        .team-section {
          background: var(--bg-primary);
          border-radius: 16px;
          padding: 24px;
          border: 1px solid var(--border-color);
        }
        
        .team-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        
        .team-section-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .team-section-header h3 svg {
          color: #e11d48;
        }
        
        .team-section-header .member-count {
          background: linear-gradient(135deg, #e11d48, #be123c);
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .team-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        
        .team-member-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: all 0.2s ease;
        }
        
        [data-theme="dark"] .team-member-card {
          background: linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(30,41,59,0.4) 100%);
        }
        
        .team-member-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          border-color: rgba(225,29,72,0.3);
        }
        
        .team-member-avatar {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: linear-gradient(135deg, #e11d48, #be123c);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 18px;
          color: white;
          flex-shrink: 0;
          overflow: hidden;
        }
        
        .team-member-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .team-member-avatar.owner {
          background: linear-gradient(135deg, #f59e0b, #d97706);
        }
        
        .team-member-info {
          flex: 1;
          min-width: 0;
        }
        
        .team-member-info h4 {
          margin: 0 0 4px 0;
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .team-member-info .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          background: rgba(225,29,72,0.1);
          color: #e11d48;
          margin-bottom: 4px;
        }
        
        .team-member-info .role-badge.owner {
          background: rgba(245,158,11,0.15);
          color: #d97706;
        }
        
        .team-member-info .role-badge.admin {
          background: rgba(59,130,246,0.1);
          color: #3b82f6;
        }
        
        .team-member-info .user-role {
          font-size: 13px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .team-member-info .linked-contact {
          font-size: 11px;
          color: #e11d48;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
        }
        
        .team-member-info .linked-contact svg {
          width: 12px;
          height: 12px;
        }
      </style>
      
      <div class="team-section">
        <div class="team-section-header">
          <h3>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            Project Team
          </h3>
          <span class="member-count">${members.length} member${members.length !== 1 ? 's' : ''}</span>
        </div>
        
        <div class="team-grid">
          ${members.map(member => {
            const isOwner = member.role === 'owner';
            const isAdmin = member.role === 'admin';
            const initials = getInitials(member.display_name || member.username || member.email || '?');
            // Use linked contact avatar if member doesn't have one
            const avatarUrl = member.avatar_url || member.linked_contact?.avatar_url || member.linked_contact?.photo_url;
            
            return `
              <div class="team-member-card">
                <div class="team-member-avatar ${isOwner ? 'owner' : ''}">
                  ${avatarUrl 
                    ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(member.display_name || '')}">`
                    : initials
                  }
                </div>
                <div class="team-member-info">
                  <h4>${escapeHtml(member.display_name || member.username || member.email || 'Unknown')}</h4>
                  <span class="role-badge ${isOwner ? 'owner' : isAdmin ? 'admin' : ''}">
                    ${isOwner ? '👑 Owner' : isAdmin ? 'Admin' : member.role === 'write' ? 'Write' : 'Read'}
                  </span>
                  ${member.user_role ? `<div class="user-role">${escapeHtml(member.user_role)}</div>` : ''}
                  ${member.linked_contact ? `
                    <div class="linked-contact">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                      </svg>
                      ${escapeHtml(member.linked_contact.name)}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load project team:', error);
  }
}

// Types for team section
interface ProjectMember {
  user_id: string;
  role: string;
  user_role?: string;
  user_role_prompt?: string;
  linked_contact_id?: string;
  linked_contact?: {
    id: string;
    name: string;
    email?: string;
    organization?: string;
    avatar_url?: string;
    photo_url?: string;
    timezone?: string;
  };
  username?: string;
  display_name?: string;
  avatar_url?: string;
  email?: string;
  timezone?: string;
}

interface TimezoneEntry {
  name: string;
  timezone: string;
  type: 'member' | 'contact';
  avatarUrl?: string;
  localTime?: string;
  localHour?: number;
  isOnline?: boolean;
  role?: string;
  linkedContactId?: string; // For deduplication
  contactId?: string; // For contacts
}

/**
 * Get local time info for a timezone
 */
function getLocalTimeInfo(timezone: string): { localTime: string; localHour: number; isOnline: boolean } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const localTime = formatter.format(now);
    const localHour = parseInt(localTime.split(':')[0], 10);
    // Consider online if between 8:00 and 18:00
    const isOnline = localHour >= 8 && localHour < 18;
    return { localTime, localHour, isOnline };
  } catch {
    return { localTime: '--:--', localHour: 12, isOnline: false };
  }
}

/**
 * Find best meeting times for all participants
 */
function findBestMeetingTimes(entries: TimezoneEntry[]): { time: string; score: number; available: number }[] {
  if (entries.length === 0) return [];

  const suggestions: { time: string; score: number; available: number }[] = [];
  const now = new Date();

  // Check each hour of the day
  for (let hour = 0; hour < 24; hour++) {
    let available = 0;
    let totalScore = 0;

    for (const entry of entries) {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: entry.timezone,
          hour: 'numeric',
          hour12: false,
        });
        const localHour = parseInt(formatter.format(now), 10);
        const utcHour = now.getUTCHours();
        let offset = localHour - utcHour;
        if (offset > 12) offset -= 24;
        if (offset < -12) offset += 24;

        // What hour would it be for this person?
        const theirHour = (hour + offset + 24) % 24;

        // Score based on how "comfortable" the hour is
        if (theirHour >= 9 && theirHour <= 17) {
          available++;
          // Peak hours (10-12, 14-16) get higher score
          if (theirHour >= 10 && theirHour <= 12) totalScore += 10;
          else if (theirHour >= 14 && theirHour <= 16) totalScore += 10;
          else totalScore += 7;
        } else if (theirHour >= 8 && theirHour <= 18) {
          available++;
          totalScore += 4;
        }
      } catch { /* ignore */ }
    }

    if (available > 0) {
      suggestions.push({
        time: `${hour.toString().padStart(2, '0')}:00 UTC`,
        score: totalScore,
        available,
      });
    }
  }

  // Sort by number available (desc), then by score (desc)
  suggestions.sort((a, b) => {
    if (b.available !== a.available) return b.available - a.available;
    return b.score - a.score;
  });

  return suggestions.slice(0, 3); // Top 3 suggestions
}

/**
 * Load Golden Hours section
 * Shows working hours overlap for team members and contacts
 */
async function loadGoldenHours(container: HTMLElement, projectId: string): Promise<void> {
  try {
    // Fetch team members and contacts in parallel
    const [membersRes, contactsRes] = await Promise.all([
      http.get<{ members: ProjectMember[] }>(`/api/projects/${projectId}/members`).catch(() => ({ data: { members: [] } })),
      http.get<{ contacts: { name: string; timezone?: string; avatarUrl?: string; photoUrl?: string; photo_url?: string; avatar_url?: string }[] }>('/api/contacts').catch(() => ({ data: { contacts: [] } })),
    ]);

    const members = membersRes.data?.members || [];
    const contacts = contactsRes.data?.contacts || [];

    // Extract timezone entries - use linked contact data if member doesn't have one
    // Also track linked_contact_id for deduplication
    const linkedContactIds = new Set<string>();
    
    const memberEntries = members
      .map(m => {
        // Check if member has linked contact with timezone and role
        const linkedContact = m.linked_contact as { id?: string; timezone?: string; avatar_url?: string; photo_url?: string; role?: string } | undefined;
        const tz = m.timezone || linkedContact?.timezone;
        if (!tz) return null;
        
        const timeInfo = getLocalTimeInfo(tz);
        // Use linked contact avatar if member doesn't have one
        const avatarUrl = m.avatar_url || linkedContact?.avatar_url || linkedContact?.photo_url;
        // Use user_role or linked contact role
        const role = m.user_role || linkedContact?.role || (m.role === 'owner' ? 'Owner' : m.role === 'admin' ? 'Admin' : undefined);
        
        // Track linked contact id for deduplication
        const linkedContactId = m.linked_contact_id || linkedContact?.id;
        if (linkedContactId) {
          linkedContactIds.add(linkedContactId);
        }
        
        return {
          name: m.display_name || m.username || m.email || 'Unknown',
          timezone: tz,
          type: 'member' as const,
          avatarUrl,
          role,
          linkedContactId,
          ...timeInfo,
        } as TimezoneEntry;
      })
      .filter((m): m is TimezoneEntry => m !== null);

    const contactEntries: TimezoneEntry[] = contacts
      .filter(c => c.timezone)
      .map(c => {
        const timeInfo = getLocalTimeInfo(c.timezone || 'UTC');
        const contactId = (c as { id?: string }).id;
        return {
          name: c.name,
          timezone: c.timezone || 'UTC',
          type: 'contact' as const,
          avatarUrl: c.avatarUrl || c.photoUrl || c.photo_url || c.avatar_url,
          role: (c as { role?: string }).role,
          contactId,
          ...timeInfo,
        };
      });

    // If no timezone data, don't show the section
    if (memberEntries.length === 0 && contactEntries.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Calculate golden hours for each group
    const memberGolden = calculateGoldenHours(memberEntries);
    const contactGolden = calculateGoldenHours(contactEntries);
    
    // For combined view, deduplicate: remove contacts that are already represented by team members
    const deduplicatedContactEntries = contactEntries.filter(c => !c.contactId || !linkedContactIds.has(c.contactId));
    const allEntries = [...memberEntries, ...deduplicatedContactEntries];
    const allGolden = calculateGoldenHours(allEntries);
    
    // Find best meeting times
    const meetingSuggestions = findBestMeetingTimes(allEntries);
    
    // Count online people
    const onlineMembers = memberEntries.filter(m => m.isOnline).length;
    const onlineContacts = contactEntries.filter(c => c.isOnline).length;
    const onlineDeduplicatedContacts = deduplicatedContactEntries.filter(c => c.isOnline).length;
    const onlineAll = onlineMembers + onlineDeduplicatedContacts;

    container.innerHTML = `
      <style>
        .golden-hours-section {
          background: var(--bg-primary);
          border-radius: 16px;
          padding: 24px;
          border: 1px solid var(--border-color);
          margin-bottom: 24px;
        }
        
        .golden-hours-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        
        .golden-hours-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .golden-hours-header h3 svg {
          color: #f59e0b;
        }
        
        .golden-hours-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 20px;
        }
        
        .golden-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.9) 100%);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 20px;
        }
        
        [data-theme="dark"] .golden-card {
          background: linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(30,41,59,0.6) 100%);
        }
        
        .golden-card h4 {
          margin: 0 0 16px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .golden-card h4 .count {
          background: var(--bg-secondary);
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
        }
        
        .timezone-bars {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }
        
        .timezone-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .tz-name {
          width: 100px;
          font-size: 12px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .tz-bar-container {
          flex: 1;
          height: 24px;
          background: var(--bg-secondary);
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }
        
        .tz-bar {
          position: absolute;
          height: 100%;
          border-radius: 2px;
        }
        
        .tz-bar.work-hours {
          background: linear-gradient(90deg, #10b981, #34d399);
          opacity: 0.6;
        }
        
        .tz-bar.golden {
          background: linear-gradient(90deg, #f59e0b, #fbbf24);
          opacity: 0.9;
        }
        
        .hour-labels {
          display: flex;
          justify-content: space-between;
          padding: 0 110px 0 0;
          margin-bottom: 4px;
        }
        
        .hour-label {
          font-size: 10px;
          color: var(--text-muted);
          width: 20px;
          text-align: center;
        }
        
        .golden-summary {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(251,191,36,0.05) 100%);
          border-radius: 8px;
          border: 1px solid rgba(245,158,11,0.2);
        }
        
        .golden-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 18px;
        }
        
        .golden-text {
          flex: 1;
        }
        
        .golden-text .label {
          font-size: 12px;
          color: var(--text-secondary);
        }
        
        .golden-text .hours {
          font-size: 16px;
          font-weight: 700;
          color: #d97706;
        }
        
        .no-overlap {
          color: var(--text-muted);
          font-size: 13px;
          font-style: italic;
        }
        
        .participants-row {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 12px;
        }
        
        .participant-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 10px;
          font-weight: 600;
          border: 2px solid var(--bg-primary);
          margin-left: -8px;
        }
        
        .participant-avatar:first-child {
          margin-left: 0;
        }
        
        .participant-avatar img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .participant-avatar.more {
          background: var(--bg-secondary);
          color: var(--text-secondary);
        }
        
        .online-status-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(52,211,153,0.05) 100%);
          border-radius: 12px;
          border: 1px solid rgba(16,185,129,0.2);
          margin-bottom: 20px;
        }
        
        .online-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .online-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px rgba(16,185,129,0.6);
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
        }
        
        .online-count {
          font-size: 14px;
          font-weight: 600;
          color: #059669;
        }
        
        .people-list {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 16px;
        }
        
        .person-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--bg-secondary);
          border-radius: 20px;
          border: 1px solid var(--border-color);
          transition: all 0.2s ease;
        }
        
        .person-chip.online {
          background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.05) 100%);
          border-color: rgba(16,185,129,0.3);
        }
        
        .person-chip.offline {
          opacity: 0.6;
        }
        
        .person-avatar-small {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 11px;
          font-weight: 600;
          position: relative;
        }
        
        .person-avatar-small img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .person-avatar-small .status-dot {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 2px solid var(--bg-primary);
        }
        
        .person-avatar-small .status-dot.online {
          background: #10b981;
        }
        
        .person-avatar-small .status-dot.offline {
          background: #9ca3af;
        }
        
        .person-info {
          display: flex;
          flex-direction: column;
        }
        
        .person-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
        }
        
        .person-time {
          font-size: 11px;
          color: var(--text-secondary);
        }
        
        .person-role {
          font-size: 10px;
          color: #e11d48;
          font-weight: 500;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 120px;
        }
        
        .meeting-suggestions {
          margin-top: 20px;
          padding: 16px;
          background: linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.05) 100%);
          border-radius: 12px;
          border: 1px solid rgba(99,102,241,0.2);
        }
        
        .meeting-suggestions h5 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .meeting-suggestions h5 svg {
          color: #6366f1;
        }
        
        .suggestion-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .suggestion-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: white;
          border-radius: 20px;
          border: 1px solid rgba(99,102,241,0.3);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        [data-theme="dark"] .suggestion-pill {
          background: rgba(30,41,59,0.8);
        }
        
        .suggestion-pill:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(99,102,241,0.2);
        }
        
        .suggestion-pill .time {
          font-weight: 600;
          color: #6366f1;
        }
        
        .suggestion-pill .availability {
          font-size: 11px;
          color: var(--text-secondary);
          padding: 2px 6px;
          background: rgba(16,185,129,0.1);
          border-radius: 8px;
          color: #059669;
        }
      </style>
      
      <div class="golden-hours-section">
        <div class="golden-hours-header">
          <h3>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            Golden Hours
          </h3>
          <span style="font-size: 13px; color: var(--text-secondary);">
            ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} your time
          </span>
        </div>
        
        <div class="golden-hours-grid">
          <!-- Team Members Section -->
          ${memberEntries.length > 0 ? `
            <div class="golden-card">
              <h4>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                Team Members
                <span class="count">${memberEntries.length}</span>
                ${onlineMembers > 0 ? `<span style="margin-left: auto; font-size: 11px; color: #10b981;">● ${onlineMembers} online</span>` : ''}
              </h4>
              
              <!-- Team People List -->
              <div class="people-list" style="margin-bottom: 16px;">
                ${memberEntries.map(e => {
                  const initials = e.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                  return `
                    <div class="person-chip ${e.isOnline ? 'online' : 'offline'}">
                      <div class="person-avatar-small">
                        ${e.avatarUrl ? `<img src="${escapeHtmlSimple(e.avatarUrl)}" alt="${escapeHtmlSimple(e.name)}">` : initials}
                        <span class="status-dot ${e.isOnline ? 'online' : 'offline'}"></span>
                      </div>
                      <div class="person-info">
                        <span class="person-name">${escapeHtmlSimple(e.name)}</span>
                        ${e.role ? `<span class="person-role">${escapeHtmlSimple(e.role)}</span>` : ''}
                        <span class="person-time">${e.localTime || '--:--'} ${e.timezone.split('/').pop()?.replace(/_/g, ' ') || ''}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
              
              ${renderTimezoneChart(memberEntries, memberGolden)}
              ${renderGoldenSummary(memberGolden, memberEntries)}
              
              <!-- Team Meeting Suggestions -->
              ${(() => {
                const teamSuggestions = findBestMeetingTimes(memberEntries);
                return teamSuggestions.length > 0 ? `
                  <div class="meeting-suggestions" style="margin-top: 16px;">
                    <h5>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                      Best Times for Team
                    </h5>
                    <div class="suggestion-list">
                      ${teamSuggestions.map((s, i) => `
                        <div class="suggestion-pill">
                          <span style="color: ${i === 0 ? '#f59e0b' : 'var(--text-muted)'};">${i === 0 ? '⭐' : '🕐'}</span>
                          <span class="time">${s.time}</span>
                          <span class="availability">${s.available}/${memberEntries.length}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : '';
              })()}
            </div>
          ` : ''}
          
          <!-- Contacts Section -->
          ${contactEntries.length > 0 ? `
            <div class="golden-card">
              <h4>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
                </svg>
                Contacts
                <span class="count">${contactEntries.length}</span>
                ${onlineContacts > 0 ? `<span style="margin-left: auto; font-size: 11px; color: #10b981;">● ${onlineContacts} online</span>` : ''}
              </h4>
              
              <!-- Contacts People List -->
              <div class="people-list" style="margin-bottom: 16px;">
                ${contactEntries.map(e => {
                  const initials = e.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                  return `
                    <div class="person-chip ${e.isOnline ? 'online' : 'offline'}">
                      <div class="person-avatar-small">
                        ${e.avatarUrl ? `<img src="${escapeHtmlSimple(e.avatarUrl)}" alt="${escapeHtmlSimple(e.name)}">` : initials}
                        <span class="status-dot ${e.isOnline ? 'online' : 'offline'}"></span>
                      </div>
                      <div class="person-info">
                        <span class="person-name">${escapeHtmlSimple(e.name)}</span>
                        ${e.role ? `<span class="person-role">${escapeHtmlSimple(e.role)}</span>` : ''}
                        <span class="person-time">${e.localTime || '--:--'} ${e.timezone.split('/').pop()?.replace(/_/g, ' ') || ''}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
              
              ${renderTimezoneChart(contactEntries, contactGolden)}
              ${renderGoldenSummary(contactGolden, contactEntries)}
              
              <!-- Contacts Meeting Suggestions -->
              ${(() => {
                const contactSuggestions = findBestMeetingTimes(contactEntries);
                return contactSuggestions.length > 0 ? `
                  <div class="meeting-suggestions" style="margin-top: 16px;">
                    <h5>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                      Best Times for Contacts
                    </h5>
                    <div class="suggestion-list">
                      ${contactSuggestions.map((s, i) => `
                        <div class="suggestion-pill">
                          <span style="color: ${i === 0 ? '#f59e0b' : 'var(--text-muted)'};">${i === 0 ? '⭐' : '🕐'}</span>
                          <span class="time">${s.time}</span>
                          <span class="availability">${s.available}/${contactEntries.length}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : '';
              })()}
            </div>
          ` : ''}
        </div>
        
        <!-- Combined Section (only if both exist) -->
        ${memberEntries.length > 0 && contactEntries.length > 0 ? `
          <div class="golden-card" style="margin-top: 20px;">
            <h4>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Combined: Team + Contacts
              <span class="count">${allEntries.length}</span>
              <span style="margin-left: auto; font-size: 11px; color: #10b981;">● ${onlineAll} online</span>
            </h4>
            ${renderGoldenSummary(allGolden, allEntries)}
            
            <!-- Combined Meeting Suggestions -->
            ${meetingSuggestions.length > 0 ? `
              <div class="meeting-suggestions" style="margin-top: 16px;">
                <h5>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  Best Times for Everyone
                </h5>
                <div class="suggestion-list">
                  ${meetingSuggestions.map((s, i) => `
                    <div class="suggestion-pill">
                      <span style="color: ${i === 0 ? '#f59e0b' : 'var(--text-muted)'};">${i === 0 ? '⭐' : '🕐'}</span>
                      <span class="time">${s.time}</span>
                      <span class="availability">${s.available}/${allEntries.length}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  } catch (error) {
    console.error('Failed to load golden hours:', error);
  }
}

/**
 * Calculate golden hours (9-18 work hours overlap) for a set of timezone entries
 */
function calculateGoldenHours(entries: TimezoneEntry[]): { start: number; end: number } | null {
  if (entries.length === 0) return null;

  // Get unique timezones
  const uniqueTimezones = [...new Set(entries.map(e => e.timezone))];
  
  if (uniqueTimezones.length === 1) {
    // All same timezone - work hours are 8-18
    return { start: 8, end: 18 };
  }

  // Calculate UTC offsets for each timezone
  const now = new Date();
  const offsets: number[] = [];

  for (const tz of uniqueTimezones) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        hour12: false,
      });
      const localHour = parseInt(formatter.format(now), 10);
      const utcHour = now.getUTCHours();
      let offset = localHour - utcHour;
      if (offset > 12) offset -= 24;
      if (offset < -12) offset += 24;
      offsets.push(offset);
    } catch {
      offsets.push(0); // Default to UTC if timezone is invalid
    }
  }

  // Find overlap of 8-18 work hours across all timezones
  // Convert each timezone's work hours to UTC, then find intersection
  let overlapStart = 0;
  let overlapEnd = 24;

  for (const offset of offsets) {
    // Work hours in UTC for this timezone
    const workStartUtc = (8 - offset + 24) % 24;
    const workEndUtc = (18 - offset + 24) % 24;

    // Handle wraparound
    if (workStartUtc < workEndUtc) {
      overlapStart = Math.max(overlapStart, workStartUtc);
      overlapEnd = Math.min(overlapEnd, workEndUtc);
    }
  }

  if (overlapStart >= overlapEnd) {
    return null; // No overlap
  }

  // Convert back to first timezone for display
  const firstOffset = offsets[0];
  return {
    start: (overlapStart + firstOffset + 24) % 24,
    end: (overlapEnd + firstOffset + 24) % 24,
  };
}

/**
 * Render timezone chart showing work hours for each participant
 */
function renderTimezoneChart(entries: TimezoneEntry[], golden: { start: number; end: number } | null): string {
  // Get unique timezones with count
  const tzCounts = new Map<string, number>();
  for (const e of entries) {
    tzCounts.set(e.timezone, (tzCounts.get(e.timezone) || 0) + 1);
  }

  const uniqueTzs = [...tzCounts.keys()].slice(0, 5); // Max 5 timezones

  if (uniqueTzs.length === 0) {
    return '<div class="no-overlap">No timezone data available</div>';
  }

  const now = new Date();

  return `
    <div class="hour-labels">
      ${[0, 6, 12, 18, 24].map(h => `<span class="hour-label">${h}</span>`).join('')}
    </div>
    <div class="timezone-bars">
      ${uniqueTzs.map(tz => {
        // Calculate work hours position (9-18)
        let offset = 0;
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: 'numeric',
            hour12: false,
          });
          const localHour = parseInt(formatter.format(now), 10);
          const utcHour = now.getUTCHours();
          offset = localHour - utcHour;
          if (offset > 12) offset -= 24;
          if (offset < -12) offset += 24;
        } catch { /* ignore */ }

        // Work hours 9-18 in this timezone
        const workStart = 9;
        const workEnd = 18;
        const workLeft = ((workStart) / 24) * 100;
        const workWidth = ((workEnd - workStart) / 24) * 100;

        // Display name
        const displayTz = tz.split('/').pop()?.replace(/_/g, ' ') || tz;
        const count = tzCounts.get(tz) || 1;

        return `
          <div class="timezone-row">
            <span class="tz-name" title="${tz}">${displayTz} ${count > 1 ? `(${count})` : ''}</span>
            <div class="tz-bar-container">
              <div class="tz-bar work-hours" style="left: ${workLeft}%; width: ${workWidth}%;"></div>
              ${golden ? `<div class="tz-bar golden" style="left: ${(golden.start / 24) * 100}%; width: ${((golden.end - golden.start) / 24) * 100}%;"></div>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Render golden hours summary
 */
function renderGoldenSummary(golden: { start: number; end: number } | null, entries: TimezoneEntry[]): string {
  if (!golden) {
    return `
      <div class="golden-summary" style="background: linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.05) 100%); border-color: rgba(239,68,68,0.2);">
        <div class="golden-icon" style="background: linear-gradient(135deg, #ef4444, #dc2626);">⚠</div>
        <div class="golden-text">
          <div class="label">No overlap found</div>
          <div class="hours" style="color: #dc2626;">Timezones too far apart</div>
        </div>
      </div>
    `;
  }

  const formatHour = (h: number) => `${h.toString().padStart(2, '0')}:00`;
  const duration = golden.end - golden.start;

  // Show participant avatars
  const maxAvatars = 5;
  const showEntries = entries.slice(0, maxAvatars);
  const moreCount = entries.length - maxAvatars;

  return `
    <div class="golden-summary">
      <div class="golden-icon">☀️</div>
      <div class="golden-text">
        <div class="label">Golden Hours</div>
        <div class="hours">${formatHour(golden.start)} - ${formatHour(golden.end)} (${duration}h overlap)</div>
      </div>
    </div>
    <div class="participants-row">
      ${showEntries.map(e => {
        const initials = e.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        return `
          <div class="participant-avatar" title="${escapeHtmlSimple(e.name)}">
            ${e.avatarUrl ? `<img src="${escapeHtmlSimple(e.avatarUrl)}" alt="${escapeHtmlSimple(e.name)}">` : initials}
          </div>
        `;
      }).join('')}
      ${moreCount > 0 ? `<div class="participant-avatar more">+${moreCount}</div>` : ''}
    </div>
  `;
}

function escapeHtmlSimple(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Helper functions
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Mount dashboard to container
 */
export function mountDashboard(selector: string, props: DashboardProps = {}): HTMLElement | null {
  const container = document.querySelector(selector);
  if (!container) {
    console.warn(`Dashboard: Container not found: ${selector}`);
    return null;
  }

  const dashboard = createDashboard(props);
  container.appendChild(dashboard);
  return dashboard;
}

export default createDashboard;
