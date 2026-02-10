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
const CELL_COLORS: Record<string, string> = {
  'critical-high': '#dc2626',   // dark red
  'critical-medium': '#ef4444', // red
  'critical-low': '#f87171',    // light red
  'high-high': '#ef4444',       // red
  'high-medium': '#f97316',     // orange
  'high-low': '#fb923c',        // light orange
  'medium-high': '#f97316',     // orange
  'medium-medium': '#eab308',   // yellow
  'medium-low': '#facc15',      // light yellow
  'low-high': '#eab308',        // yellow
  'low-medium': '#84cc16',      // lime
  'low-low': '#22c55e',         // green
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
                     style="background-color: ${count > 0 ? color : 'var(--color-surface-hover)'}">
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
      <span class="legend-item"><span class="legend-color risk-legend-low"></span> Low</span>
      <span class="legend-item"><span class="legend-color risk-legend-medium"></span> Medium</span>
      <span class="legend-item"><span class="legend-color risk-legend-high"></span> High</span>
      <span class="legend-item"><span class="legend-color risk-legend-critical"></span> Critical</span>
    </div>
  `;

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
            <div class="bar-fill impact-${level}" style="--bar-width: ${Math.min(count * 20, 100)}"></div>
          </div>
          <span class="bar-count">${count}</span>
        </div>
      `).join('')}
    </div>
  `;

  return summary;
}

export default createRiskMatrix;
