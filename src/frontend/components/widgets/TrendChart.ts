/**
 * Trend Chart Widget
 * Displays trends over time using Chart.js
 */

import { createElement } from '../../utils/dom';
import { TrendHistory } from '../../services/dashboard';

export interface TrendChartProps {
  data: TrendHistory[];
  metrics?: ('facts' | 'questions' | 'risks' | 'actions' | 'decisions')[];
  height?: number;
}

// Color palette for metrics
const METRIC_COLORS: Record<string, { line: string; fill: string }> = {
  facts: { line: '#6366f1', fill: 'rgba(99, 102, 241, 0.1)' },
  questions: { line: '#f59e0b', fill: 'rgba(245, 158, 11, 0.1)' },
  risks: { line: '#ef4444', fill: 'rgba(239, 68, 68, 0.1)' },
  actions: { line: '#22c55e', fill: 'rgba(34, 197, 94, 0.1)' },
  decisions: { line: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.1)' },
};

/**
 * Create trend chart element
 */
export function createTrendChart(props: TrendChartProps): HTMLElement {
  const { data, metrics = ['facts', 'questions', 'risks'], height = 200 } = props;

  const container = createElement('div', { className: 'trend-chart-container' });
  container.style.height = `${height}px`;

  if (data.length === 0) {
    container.innerHTML = '<div class="empty-chart">No trend data available</div>';
    return container;
  }

  // Create canvas for Chart.js
  const canvas = createElement('canvas', { id: `trend-chart-${Date.now()}` }) as HTMLCanvasElement;
  container.appendChild(canvas);

  // Initialize chart (requires Chart.js to be loaded)
  initChart(canvas, data, metrics);

  return container;
}

/**
 * Initialize Chart.js chart
 */
function initChart(
  canvas: HTMLCanvasElement,
  data: TrendHistory[],
  metrics: string[]
): void {
  // Check if Chart.js is available
  if (typeof (window as unknown as { Chart?: unknown }).Chart === 'undefined') {
    console.warn('Chart.js not loaded, using fallback');
    renderFallbackChart(canvas.parentElement as HTMLElement, data, metrics);
    return;
  }

  const Chart = (window as unknown as { Chart: typeof import('chart.js').Chart }).Chart;

  const labels = data.map(d => formatDate(d.date));
  const datasets = metrics.map(metric => ({
    label: capitalize(metric),
    data: data.map(d => (d as Record<string, number>)[metric] || 0),
    borderColor: METRIC_COLORS[metric]?.line || '#6366f1',
    backgroundColor: METRIC_COLORS[metric]?.fill || 'rgba(99, 102, 241, 0.1)',
    fill: true,
    tension: 0.3,
  }));

  new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

/**
 * Render fallback chart (pure CSS/HTML)
 */
function renderFallbackChart(container: HTMLElement, data: TrendHistory[], metrics: string[]): void {
  const maxValue = Math.max(
    ...data.flatMap(d => metrics.map(m => (d as Record<string, number>)[m] || 0))
  );

  container.innerHTML = `
    <div class="fallback-chart">
      <div class="chart-legend">
        ${metrics.map(m => `
          <span class="legend-item">
            <span class="legend-color" style="background: ${METRIC_COLORS[m]?.line || '#6366f1'}"></span>
            ${capitalize(m)}
          </span>
        `).join('')}
      </div>
      <div class="chart-bars">
        ${data.slice(-7).map(d => `
          <div class="bar-group">
            ${metrics.map(m => {
              const value = (d as Record<string, number>)[m] || 0;
              const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
              return `<div class="bar" style="height: ${height}%; background: ${METRIC_COLORS[m]?.line || '#6366f1'}" title="${capitalize(m)}: ${value}"></div>`;
            }).join('')}
            <div class="bar-label">${formatDate(d.date)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default createTrendChart;
