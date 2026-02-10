/**
 * Breakdown Chart Widget
 * Bar/doughnut chart for sprint report: by status, by assignee
 */

import { createElement } from '../../utils/dom';

const STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  cancelled: '#64748b',
  overdue: '#ef4444',
};

export interface BreakdownChartProps {
  byStatus: Record<string, number>;
  byAssignee?: Record<string, number>;
  height?: number;
  showAssignee?: boolean;
}

function capitalize(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Create breakdown chart element (by status; optional by assignee)
 */
export function createBreakdownChart(props: BreakdownChartProps): HTMLElement {
  const { byStatus, byAssignee = {}, height = 220, showAssignee = true } = props;

  const container = createElement('div', { className: 'breakdown-chart-container' });
  container.style.height = `${height}px`;

  const statusEntries = Object.entries(byStatus).filter(([, v]) => v > 0);
  const assigneeEntries = Object.entries(byAssignee).filter(([, v]) => v > 0);

  if (statusEntries.length === 0 && assigneeEntries.length === 0) {
    container.innerHTML = '<div class="empty-chart">No data for breakdown</div>';
    return container;
  }

  const chartId = `breakdown-chart-${Date.now()}`;
  container.innerHTML = `
    <div class="breakdown-chart-wrapper">
      <div class="breakdown-chart-section">
        <div class="breakdown-chart-title">By status</div>
        <canvas id="${chartId}-status" width="280" height="${Math.min(180, height - 40)}"></canvas>
      </div>
      ${showAssignee && assigneeEntries.length > 0 ? `
      <div class="breakdown-chart-section">
        <div class="breakdown-chart-title">By assignee</div>
        <canvas id="${chartId}-assignee" width="280" height="${Math.min(180, height - 40)}"></canvas>
      </div>
      ` : ''}
    </div>
  `;

  const statusCanvas = container.querySelector(`#${chartId}-status`) as HTMLCanvasElement;
  if (statusCanvas && statusEntries.length > 0) {
    const statusLabels = statusEntries.map(([k]) => capitalize(k));
    const statusValues = statusEntries.map(([, v]) => v);
    const statusKeys = statusEntries.map(([k]) => k);
    initBarChart(statusCanvas, statusLabels, statusValues, (_, i) => STATUS_COLORS[statusKeys[i]] || '#6366f1');
  }

  if (showAssignee && assigneeEntries.length > 0) {
    const assigneeCanvas = container.querySelector(`#${chartId}-assignee`) as HTMLCanvasElement;
    if (assigneeCanvas) {
      const palette = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
      initBarChart(assigneeCanvas, assigneeEntries.map(([k]) => k || '(unassigned)'), assigneeEntries.map(([, v]) => v), (_, i) => palette[i % palette.length]);
    }
  }

  return container;
}

function initBarChart(
  canvas: HTMLCanvasElement,
  labels: string[],
  values: number[],
  colorFn: (label: string, index: number) => string
): void {
  if (typeof (window as unknown as { Chart?: unknown }).Chart === 'undefined') {
    renderFallbackBars(canvas.parentElement as HTMLElement, labels, values, (l, i) => colorFn(l, i));
    return;
  }

  const Chart = (window as unknown as { Chart: typeof import('chart.js').Chart }).Chart;
  const colors = labels.map((l, i) => colorFn(l, i));

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Count',
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(c => c),
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });
}

function renderFallbackBars(
  container: HTMLElement,
  labels: string[],
  values: number[],
  colorFn: (label: string, index: number) => string
): void {
  const max = Math.max(...values, 1);
  const bars = labels.map((label, i) => {
    const v = values[i];
    const pct = (v / max) * 100;
    const color = colorFn(label, i);
    return `<div class="breakdown-fallback-bar"><span class="bar-label">${escapeHtml(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div><span class="bar-value">${v}</span></div>`;
  }).join('');
  const wrap = document.createElement('div');
  wrap.className = 'breakdown-fallback';
  wrap.innerHTML = bars;
  container.appendChild(wrap);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createBreakdownChart;
