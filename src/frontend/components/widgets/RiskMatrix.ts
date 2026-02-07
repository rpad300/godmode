/**
 * Risk Matrix Widget
 * 5x4 matrix showing risks by impact and likelihood
 */

import { createElement, on } from '../../utils/dom';
import { Risk, risksService } from '../../services/risks';

export interface RiskMatrixProps {
  risks: Risk[];
  onCellClick?: (risks: Risk[], impact: string, likelihood: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

const IMPACTS = ['critical', 'high', 'medium', 'low'];
const LIKELIHOODS = ['high', 'medium', 'low'];

// Cell colors based on risk level
// NOTE: tokenized / CSS-var friendly values (avoid hardcoded hex in templates)
const CELL_COLORS: Record<string, string> = {
  'critical-high': 'var(--color-danger)',
  'critical-medium': 'color-mix(in srgb, var(--color-danger) 85%, transparent)',
  'critical-low': 'color-mix(in srgb, var(--color-danger) 65%, transparent)',
  'high-high': 'color-mix(in srgb, var(--color-danger) 85%, transparent)',
  'high-medium': 'var(--color-warning)',
  'high-low': 'color-mix(in srgb, var(--color-warning) 70%, transparent)',
  'medium-high': 'var(--color-warning)',
  'medium-medium': 'color-mix(in srgb, var(--color-warning) 85%, transparent)',
  'medium-low': 'color-mix(in srgb, var(--color-warning) 65%, transparent)',
  'low-high': 'color-mix(in srgb, var(--color-warning) 85%, transparent)',
  'low-medium': 'color-mix(in srgb, var(--color-success) 70%, transparent)',
  'low-low': 'var(--color-success)',
};

/**
 * Create risk matrix element
 */
export function createRiskMatrix(props: RiskMatrixProps): HTMLElement {
  const { risks, onCellClick, size = 'md' } = props;

  const matrix = createElement('div', { className: `risk-matrix size-${size}` });
  
  // Group risks by cell
  const grouped = groupRisksByCell(risks);

  matrix.innerHTML = `
    <div class="matrix-container">
      <div class="matrix-y-label">Impact</div>
      <div class="matrix-grid">
        <div class="matrix-header">
          <div class="matrix-corner"></div>
          ${LIKELIHOODS.map(l => `<div class="matrix-col-header">${capitalize(l)}</div>`).join('')}
        </div>
        ${IMPACTS.map(impact => `
          <div class="matrix-row">
            <div class="matrix-row-header">${capitalize(impact)}</div>
            ${LIKELIHOODS.map(likelihood => {
              const key = `${impact}-${likelihood}`;
              const cellRisks = grouped[key] || [];
              const color = CELL_COLORS[key] || '#e5e7eb';
              const count = cellRisks.length;
              return `
                <div class="matrix-cell ${count > 0 ? 'has-risks' : ''}" 
                     data-impact="${impact}" 
                     data-likelihood="${likelihood}"
                     data-color="${count > 0 ? color : 'var(--color-surface-hover)'}">
                  ${count > 0 ? `<span class="cell-count">${count}</span>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>
      <div class="matrix-x-label">Likelihood</div>
    </div>
    <div class="matrix-legend">
      <span class="legend-item"><span class="legend-color legend-color--low"></span> Low</span>
      <span class="legend-item"><span class="legend-color legend-color--medium"></span> Medium</span>
      <span class="legend-item"><span class="legend-color legend-color--high"></span> High</span>
      <span class="legend-item"><span class="legend-color legend-color--critical"></span> Critical</span>
    </div>
  `;

  // Apply dynamic cell colors (avoid style="..." in templates)
  matrix.querySelectorAll<HTMLElement>('.matrix-cell[data-color]').forEach(cell => {
    const c = cell.dataset.color || '';
    if (c) cell.style.backgroundColor = c;
  });

  // Bind cell click events
  if (onCellClick) {
    matrix.querySelectorAll('.matrix-cell.has-risks').forEach(cell => {
      on(cell as HTMLElement, 'click', () => {
        const impact = cell.getAttribute('data-impact') || '';
        const likelihood = cell.getAttribute('data-likelihood') || '';
        const key = `${impact}-${likelihood}`;
        const cellRisks = grouped[key] || [];
        onCellClick(cellRisks, impact, likelihood);
      });
    });
  }

  return matrix;
}

/**
 * Group risks by matrix cell
 */
function groupRisksByCell(risks: Risk[]): Record<string, Risk[]> {
  const grouped: Record<string, Risk[]> = {};
  
  risks
    .filter(r => r.status !== 'mitigated' && r.status !== 'closed')
    .forEach(risk => {
      const key = `${risk.impact}-${risk.likelihood}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(risk);
    });
  
  return grouped;
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Create compact risk summary (for dashboard)
 */
export function createRiskSummary(risks: Risk[]): HTMLElement {
  const summary = createElement('div', { className: 'risk-summary' });
  
  const bySeverity = {
    critical: risks.filter(r => r.impact === 'critical' && r.status === 'open').length,
    high: risks.filter(r => r.impact === 'high' && r.status === 'open').length,
    medium: risks.filter(r => r.impact === 'medium' && r.status === 'open').length,
    low: risks.filter(r => r.impact === 'low' && r.status === 'open').length,
  };

  summary.innerHTML = `
    <div class="summary-bars">
      ${Object.entries(bySeverity).map(([level, count]) => `
        <div class="summary-bar">
          <span class="bar-label">${capitalize(level)}</span>
          <div class="bar-track">
            <div class="bar-fill impact-${level}" data-width="${Math.min(count * 20, 100)}"></div>
          </div>
          <span class="bar-count">${count}</span>
        </div>
      `).join('')}
    </div>
  `;

  summary.querySelectorAll<HTMLElement>('.bar-fill[data-width]').forEach(el => {
    const w = Number(el.dataset.width || '0');
    el.style.width = `${Math.max(0, Math.min(100, w))}%`;
  });

  return summary;
}

export default createRiskMatrix;
