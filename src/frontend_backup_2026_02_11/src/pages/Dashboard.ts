/**
 * Dashboard Component
 * Main dashboard view with stats, health, trends, insights, and alerts
 */

import { createElement, on } from '@lib/dom';
import { dataStore } from '@stores/data';
import { appStore } from '@stores/app';
import { formatNumber, formatPercent, formatRelativeTime } from '@lib/format';
import { dashboardService, DashboardData, HealthData, Insight, Alert, TrendMetric } from '@services/dashboard';
import { http } from '@services/api';
import { risksService } from '@services/risks';
import { actionsService } from '@services/actions';

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

import { createIcon } from '@components/ui/Icon';

/**
 * Create dashboard element
 */
export function createDashboard(props: DashboardProps = {}): HTMLElement {
  const dashboard = createElement('div', { className: 'dashboard' });
  // ... (omitting huge chunk, target carefully)
  // Actually I should just target the imports.

  // Wait, replace_file_content replaces the whole block. I need to be precise.
  // I will split this into multiple replacement chunks using multi_replace_file_content if possible, OR just careful replace_file_content.
  // But I don't have multi_replace_file_content available in my tool definitions?
  // CHECK TOOLS: I DO have multi_replace_file_content.

  // I will use multi_replace_file_content for Dashboard.ts

  // Row 1: Top (Health + Briefing)
  const topRow = createElement('div', { className: 'dashboard-top-row' });
  const healthCard = createElement('div', { id: 'dashboard-health', className: 'dashboard-health-card' });
  const briefingSection = createElement('div', { id: 'dashboard-briefing', className: 'dashboard-briefing-section' });

  topRow.appendChild(healthCard);
  topRow.appendChild(briefingSection);

  // Row 2: Stats Cards
  const statsRow = createElement('div', { className: 'dashboard-row' });
  const statsGrid = createElement('div', { id: 'dashboard-stats-grid', className: 'stats-grid' });
  statsRow.appendChild(statsGrid);

  // Row 3: Charts
  const chartsRow = createElement('div', { className: 'dashboard-charts-row' });
  const actionsChart = createElement('div', { id: 'actions-chart', className: 'chart-container' }); // Renamed from questions to actions based on screenshot
  // Wait, screenshot shows "Actions by Status", "Facts by Category", "Weekly Activity"
  const factsChart = createElement('div', { id: 'facts-chart', className: 'chart-container' });
  const weeklyChart = createElement('div', { id: 'trends-chart', className: 'chart-container' }); // Renamed trend to weekly

  chartsRow.appendChild(actionsChart);
  chartsRow.appendChild(factsChart);
  chartsRow.appendChild(weeklyChart);

  // Assemble Dashboard
  dashboard.appendChild(topRow);
  dashboard.appendChild(statsRow);
  dashboard.appendChild(chartsRow);

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

  // Charts
  const actionsChartContainer = dashboard.querySelector('#actions-chart');
  const factsChartContainer = dashboard.querySelector('#facts-chart');
  const weeklyChartContainer = dashboard.querySelector('#trends-chart');

  // Check if project is selected
  const currentProject = appStore.getState().currentProject;
  const currentProjectId = appStore.getState().currentProjectId;

  if (!currentProject && !currentProjectId) {
    // No project selected - show empty state
    if (statsGrid) {
      statsGrid.innerHTML = `
        <div class="no-project-state">
          <svg class="no-project-icon" width="80" height="80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
          </svg>
          <h2 class="no-project-title">No Project Selected</h2>
          <p class="no-project-desc">
            Select a project from the dropdown in the header to view your dashboard, or create a new project to get started.
          </p>
          <div class="no-project-actions">
            <button class="btn btn-primary create-project-btn no-project-btn">
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
          const { showProjectModal } = await import('@components/modals/ProjectModal');
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
    if (actionsChartContainer) (actionsChartContainer as HTMLElement).innerHTML = '';
    if (factsChartContainer) (factsChartContainer as HTMLElement).innerHTML = '';
    if (weeklyChartContainer) (weeklyChartContainer as HTMLElement).innerHTML = '';

    return;
  }

  // Show loading state
  if (statsGrid) {
    statsGrid.innerHTML = '<div class="loading-placeholder">Loading dashboard...</div>';
  }

  // Load Briefing Panel (async)
  if (briefingSection && !briefingSection.hasChildNodes()) {
    import('@components/BriefingPanel').then(({ createBriefingPanel }) => {
      const briefingPanel = createBriefingPanel();
      briefingSection.appendChild(briefingPanel);
    }).catch(err => console.error('Failed to load BriefingPanel:', err));
  }

  try {
    const { dashboard: data, health } = await dashboardService.loadAll();

    // SOTA: Safety Check - stop if component was unmounted during await
    if (!dashboard.isConnected) {
      console.log('[Dashboard] Component unmounted during load, aborting render.');
      return;
    }

    // Render health indicator (Top Left)
    if (healthSection && health) {
      renderHealthIndicator(healthSection as HTMLElement, health);
    }

    // Render stats (Middle Row)
    if (statsGrid && data) {
      renderStatsGrid(statsGrid as HTMLElement, data, props.onStatClick);
    }

    // Render charts (Bottom Row)
    if (data) {
      // Actions Status Chart (was Questions Priority)
      if (actionsChartContainer) renderActionsStatusChart(actionsChartContainer as HTMLElement, data);

      // Facts Category Chart
      renderFactsChart(data); // This function looks for id element inside, we should update it to accept container or fix id

      // Weekly Activity Chart
      renderWeeklyTrendsChart(data).catch(err =>
        console.error('Failed to render trends chart:', err)
      );
    }

  } catch (error) {
    // Check if dashboard is still validating before logging error
    if (dashboard.isConnected) {
      console.error('Failed to load dashboard:', error);
      if (statsGrid) {
        statsGrid.innerHTML = '<div class="error-message">Failed to load dashboard data</div>';
      }
    }
  }
}

/**
 * Render health indicator
 */
/**
 * Render health indicator
 */
function renderHealthIndicator(container: HTMLElement, health: HealthData): void {
  // Clear container
  container.innerHTML = '';

  // Handle missing or incomplete health data
  if (!health || typeof health.status !== 'string') {
    const wrapper = createElement('div', { className: 'health-indicator unknown' });

    const gauge = createElement('div', { className: 'health-gauge' });
    const scoreVal = createElement('span', { className: 'score-value' }, ['--']);
    const scoreLabel = createElement('span', { className: 'score-label' }, ['Health']);

    gauge.appendChild(scoreVal);
    gauge.appendChild(scoreLabel);

    const status = createElement('p', { className: 'health-status' }, ['Health data unavailable']);

    wrapper.appendChild(gauge);
    wrapper.appendChild(status);
    container.appendChild(wrapper);
    return;
  }

  const statusClass = health.status.toLowerCase().replace(/\s+/g, '-');
  const score = health.score ?? 0;
  const color = health.color || '#888';
  const factors = health.factors || [];

  const wrapper = createElement('div', { className: `health-indicator ${statusClass}` });

  // Gauge Section
  const gauge = createElement('div', { className: 'health-gauge' });

  const healthScore = createElement('div', {
    className: 'health-score',
    style: `--score: ${score}%`
  });
  healthScore.appendChild(createElement('span', { className: 'score-value' }, [String(score)]));
  healthScore.appendChild(createElement('span', { className: 'score-label' }, ['Health']));

  const healthBar = createElement('div', { className: 'health-bar' });
  const healthFill = createElement('div', {
    className: 'health-fill',
    style: `--fill-width: ${score}%; --fill-color: ${color}`
  });
  healthBar.appendChild(healthFill);

  gauge.appendChild(healthScore);
  gauge.appendChild(healthBar);

  // Status Section
  const statusDiv = createElement('div', { className: 'health-status' });
  const statusText = createElement('span', {
    className: 'status-text',
    style: `--status-color: ${color}`
  }, [health.status]);
  statusDiv.appendChild(statusText);

  // Factors Section
  const factorsDiv = createElement('div', { className: 'health-factors' });
  factors.slice(0, 3).forEach(f => {
    const factorItem = createElement('div', { className: `factor ${f.type}` });

    // Use SOTA Icon for factors
    const iconName = f.type === 'positive' ? 'check' : 'alert';
    const icon = createIcon(iconName, { size: 14, className: 'factor-icon' });

    const text = createElement('span', { className: 'factor-text' }, [f.factor]);

    factorItem.appendChild(icon);
    factorItem.appendChild(text);
    factorsDiv.appendChild(factorItem);
  });

  wrapper.appendChild(gauge);
  wrapper.appendChild(statusDiv);
  wrapper.appendChild(factorsDiv);

  container.appendChild(wrapper);
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

  // SOTA: stats array matching the 8-grid layout
  const stats = [
    { id: 'documents', label: 'Documents', value: docs.total ?? 0, sub: `+${docs.pending || 0}`, icon: '📄' },
    { id: 'facts', label: 'Facts', value: data.totalFacts ?? 0, sub: `+${factsVerified}`, icon: '💡' },
    { id: 'questions', label: 'Questions', value: data.totalQuestions ?? 0, sub: `+${qPriority.critical || 0}`, icon: '❓' }, // Using +critical as "new"? Or just placeholder
    { id: 'risks', label: 'Risks', value: data.totalRisks ?? 0, sub: `-${rImpact.high || 0}`, icon: '⚠️' },
    { id: 'actions', label: 'Actions', value: data.totalActions ?? 0, sub: `+${data.overdueActions || 0}`, icon: '✅' },
    { id: 'decisions', label: 'Decisions', value: data.totalDecisions ?? 0, sub: `+${0}`, icon: '' }, // Placeholder sub
    { id: 'contacts', label: 'People', value: data.totalPeople ?? 0, sub: '', icon: '👥' },
    { id: 'overdue', label: 'Overdue', value: data.overdueActions ?? 0, sub: 'Actions', icon: '❗' },
  ];

  // Clear container
  container.innerHTML = '';

  // Render stats using DOM API (SOTA Safety)
  stats.forEach(stat => {
    const card = createElement('div', {
      className: 'stat-card',
      'data-stat-id': stat.id
    });

    // Icon (SOTA Visuals)
    const iconEl = createElement('div', { className: 'stat-icon' }, [stat.icon]);

    // Value
    const valueEl = createElement('div', { className: 'stat-value' }, [String(stat.value)]);

    // Label
    const labelEl = createElement('div', { className: 'stat-label' }, [stat.label]);

    // Sub-text (trend)
    const subEl = createElement('div', { className: 'stat-sub' }, [stat.sub || '']);
    if (stat.sub && stat.sub.startsWith('+')) subEl.classList.add('positive');
    if (stat.sub && stat.sub.startsWith('-')) subEl.classList.add('negative');
    if (stat.id === 'overdue' && stat.value > 0) subEl.classList.add('negative');

    // Assemble
    card.appendChild(iconEl);
    card.appendChild(valueEl);
    card.appendChild(labelEl);
    card.appendChild(subEl);

    // Click handler
    if (onClick) {
      card.classList.add('clickable');
      card.addEventListener('click', () => onClick(stat.id));
    }

    container.appendChild(card);
  });
}







/**
 * Render facts by category chart
 */
/**
 * Render facts by category chart
 */
function renderFactsChart(data: DashboardData): void {
  const container = document.getElementById('facts-chart');
  if (!container) return;

  // Clear container
  container.innerHTML = '';

  const byCat = data.factsByCategory || {};
  const categories = ['technical', 'process', 'policy', 'people', 'timeline', 'general'] as const;
  const total = categories.reduce((sum, c) => sum + (byCat[c] ?? 0), 0);

  if (total === 0) {
    container.appendChild(createElement('div', { className: 'empty-chart' }, ['No facts yet']));
    return;
  }

  container.appendChild(createElement('div', { className: 'facts-chart-title' }, ['Facts by category']));

  const barsContainer = createElement('div', { className: 'priority-bars' });

  categories.forEach(cat => {
    const count = byCat[cat] ?? 0;
    const pct = total > 0 ? (count / total) * 100 : 0;

    const bar = createElement('div', { className: 'priority-bar' });

    bar.appendChild(createElement('div', { className: 'bar-label' }, [cat]));

    const track = createElement('div', { className: 'bar-track' });
    const fill = createElement('div', {
      className: 'bar-fill',
      style: `--bar-width: ${pct}%`
    });
    track.appendChild(fill);
    bar.appendChild(track);

    bar.appendChild(createElement('div', { className: 'bar-value' }, [String(count)]));

    barsContainer.appendChild(bar);
  });

  container.appendChild(barsContainer);
}

/**
 * Render questions by priority chart
 */
/**
 * Render questions by priority chart
 */
/**
 * Render actions by status chart (Donut)
 */
async function renderActionsStatusChart(container: HTMLElement, data: DashboardData): Promise<void> {
  // Show loading
  container.innerHTML = '';
  container.appendChild(createElement('div', { className: 'loading' }, ['Loading actions...']));

  try {
    const actions = await actionsService.getAll();

    const total = actions.length;
    if (total === 0) {
      container.innerHTML = '';
      container.appendChild(createElement('div', { className: 'empty-chart' }, ['No actions yet']));
      return;
    }

    const counts = {
      completed: actions.filter(a => a.status === 'completed').length,
      in_progress: actions.filter(a => a.status === 'in_progress').length,
      pending: actions.filter(a => a.status === 'pending').length,
      cancelled: actions.filter(a => a.status === 'cancelled').length
    };

    // Calculate percentages for donut
    const getPercent = (count: number) => total > 0 ? Math.round((count / total) * 100) : 0;

    // Create conic gradient
    let conicStops = '';
    let currentDeg = 0;

    const colors = {
      completed: '#10b981', // green
      in_progress: '#3b82f6', // blue
      pending: '#f59e0b', // amber
      cancelled: '#9ca3af' // neutral gray
    };

    (['completed', 'in_progress', 'pending', 'cancelled'] as const).forEach(status => {
      const percent = getPercent(counts[status]);
      const degrees = (percent / 100) * 360;
      if (degrees > 0) {
        conicStops += `${colors[status]} ${currentDeg}deg ${currentDeg + degrees}deg, `;
        currentDeg += degrees;
      }
    });

    if (!conicStops) {
      conicStops = 'var(--color-border) 0deg 360deg';
    } else {
      conicStops = conicStops.slice(0, -2);
    }

    container.innerHTML = '';

    // Title
    container.appendChild(createElement('div', { className: 'chart-title' }, ['Actions by Status']));

    const chartContent = createElement('div', { className: 'donut-chart-content' });

    // Donut
    const donutContainer = createElement('div', { className: 'chart-donut-container' });
    const donut = createElement('div', {
      className: 'chart-donut',
      style: `--donut-conic: conic-gradient(${conicStops})`
    });

    const center = createElement('div', { className: 'chart-donut-center' });
    center.appendChild(createElement('span', { className: 'donut-value' }, [String(total)]));
    center.appendChild(createElement('span', { className: 'donut-label' }, ['Total']));

    donut.appendChild(center);
    donutContainer.appendChild(donut);
    chartContent.appendChild(donutContainer);

    // Legend
    const legend = createElement('div', { className: 'chart-legend' });
    const statuses = [
      { id: 'completed', label: 'Completed', color: colors.completed },
      { id: 'in_progress', label: 'In Progress', color: colors.in_progress },
      { id: 'pending', label: 'Pending', color: colors.pending },
      { id: 'cancelled', label: 'Cancelled', color: colors.cancelled }
    ] as const;

    statuses.forEach(s => {
      const count = counts[s.id];
      if (count === 0) return; // Optional: hide zero counts

      const item = createElement('div', { className: 'legend-item' });
      const dot = createElement('span', {
        className: 'legend-dot',
        style: `background-color: ${s.color}`
      });
      const text = createElement('span', { className: 'legend-text' }, [`${s.label}: ${count}`]);

      item.appendChild(dot);
      item.appendChild(text);
      legend.appendChild(item);
    });

    chartContent.appendChild(legend);
    container.appendChild(chartContent);

  } catch (error) {
    console.error('Failed to load actions stats:', error);
    container.innerHTML = '<div class="error">Failed to load actions</div>';
  }
}

/**
 * Render weekly trends chart with real API data
 */
/**
 * Render weekly trends chart with real API data
 */
async function renderWeeklyTrendsChart(data: DashboardData): Promise<void> {
  const container = document.getElementById('trends-chart');
  if (!container) return;

  // Show loading state
  container.innerHTML = '';
  container.appendChild(createElement('div', { className: 'loading' }, ['Loading trends...']));

  try {
    // Fetch real trends data from API
    const trendsData = await dashboardService.getTrends(7);

    container.innerHTML = '';

    if (!trendsData || !trendsData.history || trendsData.history.length === 0) {
      container.appendChild(createElement('div', { className: 'empty-chart' }, ['No trend data available yet']));
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

    const chart = createElement('div', { className: 'trends-chart' });

    // Legend
    const legend = createElement('div', { className: 'trends-legend' });
    const items = [
      { cls: 'facts', label: 'Facts' },
      { cls: 'questions', label: 'Questions' },
      { cls: 'risks', label: 'Risks' },
      { cls: 'actions', label: 'Actions' }
    ];

    items.forEach(item => {
      const span = createElement('span', { className: 'legend-item' });
      span.appendChild(createElement('span', { className: `legend-dot ${item.cls}` }));
      span.appendChild(document.createTextNode(item.label));
      legend.appendChild(span);
    });
    chart.appendChild(legend);

    // Bars
    const barsContainer = createElement('div', { className: 'trends-bars' });

    days.forEach((day, i) => {
      const col = createElement('div', { className: 'trend-column' });

      const group = createElement('div', { className: 'trend-bars-group' });

      const barData = [
        { cls: 'facts', val: trends.facts[i] },
        { cls: 'questions', val: trends.questions[i] },
        { cls: 'risks', val: trends.risks[i] },
        { cls: 'actions', val: trends.actions[i] }
      ];

      barData.forEach(d => {
        const bar = createElement('div', {
          className: `trend-bar ${d.cls}`,
          style: `--trend-height: ${(d.val / maxValue) * 100}%`,
          title: `${d.cls.charAt(0).toUpperCase() + d.cls.slice(1)}: ${d.val}`
        });
        group.appendChild(bar);
      });

      col.appendChild(group);
      col.appendChild(createElement('div', { className: 'trend-label' }, [day]));

      barsContainer.appendChild(col);
    });

    chart.appendChild(barsContainer);
    container.appendChild(chart);

  } catch (error) {
    console.error('Failed to load trends:', error);
    container.innerHTML = '';
    container.appendChild(createElement('div', { className: 'error' }, ['Failed to load trend data']));
  }
}

/**
 * Render overdue actions alert
 */


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
