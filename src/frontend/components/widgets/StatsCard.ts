/**
 * Stats Card Widget
 * Displays a single statistic with icon and optional trend
 */

import { createElement, on } from '../../utils/dom';
import { formatNumber } from '../../utils/format';

export interface StatsCardProps {
  id: string;
  label: string;
  value: number | string;
  icon?: string;
  subValue?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: number;
    sentiment: 'positive' | 'negative' | 'neutral';
  };
  color?: string;
  onClick?: () => void;
}

/**
 * Create stats card element
 */
export function createStatsCard(props: StatsCardProps): HTMLElement {
  const card = createElement('div', {
    className: `stats-card ${props.onClick ? 'clickable' : ''} ${props.color ? `color-${props.color}` : ''}`,
  });
  card.setAttribute('data-stat-id', props.id);

  const trendHtml = props.trend ? `
    <div class="stat-trend ${props.trend.direction} ${props.trend.sentiment}">
      <span class="trend-arrow">${getTrendArrow(props.trend.direction)}</span>
      <span class="trend-value">${props.trend.value}%</span>
    </div>
  ` : '';

  card.innerHTML = `
    ${props.icon ? `<div class="stat-icon">${props.icon}</div>` : ''}
    <div class="stat-value">${typeof props.value === 'number' ? formatNumber(props.value) : props.value}</div>
    <div class="stat-label">${props.label}</div>
    ${props.subValue ? `<div class="stat-sub">${props.subValue}</div>` : ''}
    ${trendHtml}
  `;

  if (props.onClick) {
    on(card, 'click', props.onClick);
  }

  return card;
}

/**
 * Get trend arrow character
 */
function getTrendArrow(direction: 'up' | 'down' | 'stable'): string {
  switch (direction) {
    case 'up': return '↑';
    case 'down': return '↓';
    case 'stable': return '→';
  }
}

/**
 * Update stats card value
 */
export function updateStatsCard(card: HTMLElement, value: number | string, subValue?: string): void {
  const valueEl = card.querySelector('.stat-value');
  const subEl = card.querySelector('.stat-sub');
  
  if (valueEl) {
    valueEl.textContent = typeof value === 'number' ? formatNumber(value) : value;
  }
  
  if (subEl && subValue !== undefined) {
    subEl.textContent = subValue;
  }
}

/**
 * Create stats grid with multiple cards
 */
export function createStatsGrid(stats: StatsCardProps[]): HTMLElement {
  const grid = createElement('div', { className: 'stats-grid' });
  
  stats.forEach(stat => {
    const card = createStatsCard(stat);
    grid.appendChild(card);
  });

  return grid;
}

export default createStatsCard;
