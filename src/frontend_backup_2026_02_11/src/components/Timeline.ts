/**
 * Timeline Component
 * Vertical timeline with events
 */

import { createElement, on } from '@lib/dom';
import { timelineService, TimelineEvent } from '@services/graph';
import { formatRelativeTime, formatDate } from '@lib/format';

export interface TimelineProps {
  days?: number;
  onEventClick?: (event: TimelineEvent) => void;
}

/**
 * Create timeline component
 */
export function createTimeline(props: TimelineProps = {}): HTMLElement {
  const { days = 30 } = props;

  const container = createElement('div', { className: 'timeline-container' });

  container.innerHTML = `
    <div class="timeline-header">
      <h3>Timeline</h3>
      <select id="timeline-days" class="filter-select">
        <option value="7" ${days === 7 ? 'selected' : ''}>Last 7 days</option>
        <option value="14" ${days === 14 ? 'selected' : ''}>Last 14 days</option>
        <option value="30" ${days === 30 ? 'selected' : ''}>Last 30 days</option>
        <option value="90" ${days === 90 ? 'selected' : ''}>Last 90 days</option>
      </select>
    </div>
    <div class="timeline-filters">
      <button class="filter-btn active" data-type="all">All</button>
      <button class="filter-btn" data-type="document">Documents</button>
      <button class="filter-btn" data-type="question">Questions</button>
      <button class="filter-btn" data-type="decision">Decisions</button>
      <button class="filter-btn" data-type="risk">Risks</button>
    </div>
    <div class="timeline-content" id="timeline-content">
      <div class="loading">Loading timeline...</div>
    </div>
  `;

  // Bind events
  const daysSelect = container.querySelector('#timeline-days') as HTMLSelectElement;
  on(daysSelect, 'change', () => {
    loadTimeline(container, parseInt(daysSelect.value), props);
  });

  const filterBtns = container.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    on(btn as HTMLElement, 'click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterEvents(container, btn.getAttribute('data-type') || 'all');
    });
  });

  // Initial load
  loadTimeline(container, days, props);

  return container;
}

/**
 * Load timeline events
 */
async function loadTimeline(container: HTMLElement, days: number, props: TimelineProps): Promise<void> {
  const content = container.querySelector('#timeline-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const data = await timelineService.getAll({ limit: days * 10 }); // Approximate events per day
    renderTimeline(content, data.events || [], props);
  } catch {
    content.innerHTML = '<div class="error">Failed to load timeline</div>';
  }
}

/**
 * Render timeline
 */
function renderTimeline(container: HTMLElement, events: TimelineEvent[], props: TimelineProps): void {
  if (events.length === 0) {
    container.innerHTML = '<div class="empty-state">No events in this period</div>';
    return;
  }

  // Group by date
  const grouped = groupByDate(events);

  container.innerHTML = `
    <div class="timeline">
      ${Object.entries(grouped).map(([date, dayEvents]) => `
        <div class="timeline-day">
          <div class="timeline-date">${formatDate(date)}</div>
          ${dayEvents.map(event => `
            <div class="timeline-event" data-type="${event.type}" data-id="${event.id}">
              <div class="event-marker ${event.type}"></div>
              <div class="event-content">
                <div class="event-header">
                  <span class="event-type">${event.type}</span>
                  <span class="event-time">${formatTime(event.date)}</span>
                </div>
                <div class="event-title">${escapeHtml(event.title)}</div>
                ${event.description ? `<div class="event-description">${escapeHtml(event.description)}</div>` : ''}
                ${event.user ? `<div class="event-user">by ${escapeHtml(event.user)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `;

  // Bind click events
  container.querySelectorAll('.timeline-event').forEach(el => {
    on(el as HTMLElement, 'click', () => {
      const id = el.getAttribute('data-id');
      const event = events.find(e => String(e.id) === id);
      if (event && props.onEventClick) {
        props.onEventClick(event);
      }
    });
  });
}

/**
 * Group events by date
 */
function groupByDate(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  const grouped: Record<string, TimelineEvent[]> = {};

  events.forEach(event => {
    const date = event.date.split('T')[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(event);
  });

  // Sort by date descending
  return Object.fromEntries(
    Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a))
  );
}

/**
 * Filter events by type
 */
function filterEvents(container: HTMLElement, type: string): void {
  const events = container.querySelectorAll('.timeline-event');
  events.forEach(el => {
    if (type === 'all' || el.getAttribute('data-type') === type) {
      (el as HTMLElement).classList.remove('hidden');
    } else {
      (el as HTMLElement).classList.add('hidden');
    }
  });

  // Hide empty days
  container.querySelectorAll('.timeline-day').forEach(day => {
    const visibleEvents = day.querySelectorAll('.timeline-event:not(.hidden)');
    (day as HTMLElement).classList.toggle('hidden', visibleEvents.length === 0);
  });
}

/**
 * Format time
 */
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createTimeline;
