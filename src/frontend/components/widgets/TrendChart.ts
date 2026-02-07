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
// NOTE: use token-friendly values (CSS vars), not hardcoded hex
const METRIC_COLORS: Record<string, { line: string; fill: string }> = {
  facts: { line: 'var(--color-primary)', fill: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' },
  questions: { line: 'var(--color-warning)', fill: 'color-mix(in srgb, var(--color-warning) 14%, transparent)' },
  risks: { line: 'var(--color-danger)', fill: 'color-mix(in srgb, var(--color-danger) 12%, transparent)' },
  actions: { line: 'var(--color-success)', fill: 'color-mix(in srgb, var(--color-success) 12%, transparent)' },
  decisions: { line: 'color-mix(in srgb, var(--color-primary) 65%, var(--color-text) 0%)', fill: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' },
};

/**
 * Create trend chart element
 */
export function createTrendChart(props: TrendChartProps): HTMLElement {
  const { data, metrics = ['facts', 'questions', 'risks'], height = 200 } = props;

  const container = createElement('div', { className: 'trend-chart-container' });
  container.style.setProperty('--trend-height', `${height}px`);

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
    borderColor: METRIC_COLORS[metric]?.line || 'var(--color-primary)',
    backgroundColor: METRIC_COLORS[metric]?.fill || 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
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
          <span class="legend-item" data-metric="${m}">
            <span class="legend-color"></span>
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
              return `<div class="bar" data-height="${height}" data-color="${METRIC_COLORS[m]?.line || 'var(--color-primary)'}" title="${capitalize(m)}: ${value}"></div>`;
            }).join('')}
            <div class="bar-label">${formatDate(d.date)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Apply styles without embedding inline style="..." in templates
  container.querySelectorAll<HTMLElement>('.legend-item[data-metric]').forEach(item => {
    const m = item.dataset.metric || '';
    const color = METRIC_COLORS[m]?.line || 'var(--color-primary)';
    const swatch = item.querySelector<HTMLElement>('.legend-color');
    if (swatch) swatch.style.background = color;
  });

  container.querySelectorAll<HTMLElement>('.bar[data-height][data-color]').forEach(el => {
    const h = Number(el.dataset.height || '0');
    el.style.height = `${Math.max(0, Math.min(100, h))}%`;
    el.style.background = el.dataset.color || 'var(--color-primary)';
  });
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
