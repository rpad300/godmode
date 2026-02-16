/**
 * Health Indicator Widget
 * Displays project health score with gauge and factors
 */

import { createElement } from '@lib/dom';
import { HealthData } from '@services/dashboard';

export interface HealthIndicatorProps {
  health: HealthData;
  showFactors?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Create health indicator element
 */
export function createHealthIndicator(props: HealthIndicatorProps): HTMLElement {
  const { health, showFactors = true, size = 'md' } = props;
  const statusClass = health.status.toLowerCase().replace(/\s+/g, '-');

  const indicator = createElement('div', {
    className: `health-indicator ${statusClass} size-${size}`,
  });

  indicator.innerHTML = `
    <div class="health-gauge">
      <svg class="gauge-svg" viewBox="0 0 100 50">
        <path class="gauge-bg" d="M 10 50 A 40 40 0 0 1 90 50" />
        <path class="gauge-fill" d="M 10 50 A 40 40 0 0 1 90 50" 
              style="stroke-dasharray: ${(health.score / 100) * 126} 126; stroke: ${health.color};" />
      </svg>
      <div class="gauge-center">
        <span class="score-value">${health.score}</span>
        <span class="score-label">Health</span>
      </div>
    </div>
    <div class="health-status" style="--health-status-color: ${health.color}">${health.status}</div>
    ${showFactors && health.factors.length > 0 ? `
      <div class="health-factors">
        ${health.factors.slice(0, 4).map(f => `
          <div class="factor ${f.type}">
            <span class="factor-icon">${f.type === 'positive' ? '✓' : '!'}</span>
            <span class="factor-text">${f.factor}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  return indicator;
}

/**
 * Create mini health badge (for header/compact views)
 */
export function createHealthBadge(score: number, status: string, color: string): HTMLElement {
  const badge = createElement('div', { className: 'health-badge' });

  badge.innerHTML = `
    <span class="badge-score" style="--badge-bg: ${color}">${score}</span>
    <span class="badge-status">${status}</span>
  `;

  return badge;
}

/**
 * Get health color based on score
 */
export function getHealthColor(score: number): string {
  if (score >= 80) return 'var(--color-success-500)'; // green
  if (score >= 60) return 'var(--color-success-500)'; // lime
  if (score >= 40) return 'var(--color-warning-500)'; // yellow
  if (score >= 20) return 'var(--color-warning-600)'; // orange
  return 'var(--color-danger-500)'; // red
}

/**
 * Get health status based on score
 */
export function getHealthStatus(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Attention';
  if (score >= 20) return 'At Risk';
  return 'Critical';
}

export default createHealthIndicator;
