/**
 * TimelinePanel - SOTA Timeline Component
 * 
 * Features:
 * - Sticky date headers
 * - "Today" line marker
 * - Density toggle (compact, comfortable, spacious)
 * - Rich event cards with avatars, icons, status badges
 * - Relative time formatting with tooltip
 * - In-timeline search
 * - Keyboard navigation (J/K, Enter, /, Esc)
 * - Type filters with counts
 * - Skeleton loading
 * - Empty states with illustrations
 * - Export options
 */

import { createElement, on } from '@lib/dom';
import { getTimeline, TimelineEvent, TimelineData } from '@services/graph';
import { formatRelativeTime, formatDate, formatDateTime } from '@lib/format';

// ============================================
// TYPES
// ============================================

export interface TimelinePanelProps {
  onEventClick?: (event: TimelineEvent) => void;
  containerElement?: HTMLElement;
}

interface EventTypeConfig {
  label: string;
  icon: string;
  color: string;
}

type Density = 'compact' | 'comfortable' | 'spacious';

// ============================================
// CONSTANTS
// ============================================

const EVENT_TYPES: Record<string, EventTypeConfig> = {
  document: { label: 'Documents', icon: '📄', color: '#1abc9c' },
  transcript: { label: 'Transcripts', icon: '🎙️', color: '#8b5cf6' },
  email: { label: 'Emails', icon: '📧', color: '#6366f1' },
  conversation: { label: 'Conversations', icon: '💬', color: '#ec4899' },
  chat_session: { label: 'Chat Sessions', icon: '🤖', color: '#0ea5e9' },
  fact: { label: 'Facts', icon: '📌', color: '#3b82f6' },
  question: { label: 'Questions', icon: '❓', color: '#f59e0b' },
  question_answered: { label: 'Answered', icon: '✅', color: '#10b981' },
  decision: { label: 'Decisions', icon: '📋', color: '#3498db' },
  risk: { label: 'Risks', icon: '⚠️', color: '#f39c12' },
  action: { label: 'Actions', icon: '📌', color: '#9b59b6' },
  action_completed: { label: 'Completed', icon: '✅', color: '#2ecc71' },
  deadline: { label: 'Deadlines', icon: '📅', color: '#9b59b6' },
};

const DAY_PERIODS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: 365 },
];

// ============================================
// STATE
// ============================================

let currentDays = 30;
let currentDensity: Density = 'comfortable';
let currentTypeFilters: string[] = [];
let currentSearch = '';
let allEvents: TimelineEvent[] = [];
let focusedEventIndex = -1;

// ============================================
// MAIN COMPONENT
// ============================================

/**
 * Create SOTA Timeline Panel
 */
export function createTimelinePanel(props: TimelinePanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'timeline-panel sot-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Timeline</h2>
        <span class="panel-count" id="timeline-count">0</span>
      </div>
      <div class="panel-actions">
        <div class="timeline-search-wrapper">
          <input type="text" id="timeline-search" class="timeline-search" placeholder="Search events..." />
        </div>
        <select id="timeline-period" class="filter-select">
          ${DAY_PERIODS.map(p => `<option value="${p.days}" ${p.days === currentDays ? 'selected' : ''}>${p.label}</option>`).join('')}
        </select>
        <div class="density-toggle" title="View density">
          <button class="density-btn ${currentDensity === 'compact' ? 'active' : ''}" data-density="compact" title="Compact">━</button>
          <button class="density-btn ${currentDensity === 'comfortable' ? 'active' : ''}" data-density="comfortable" title="Comfortable">≡</button>
          <button class="density-btn ${currentDensity === 'spacious' ? 'active' : ''}" data-density="spacious" title="Spacious">☰</button>
        </div>
        <div class="timeline-actions-menu">
          <button class="btn btn-secondary btn-sm timeline-export-btn" title="Export">📥</button>
        </div>
      </div>
    </div>
    <div class="timeline-filters" id="timeline-type-filters">
      <button class="filter-chip active" data-type="">All</button>
    </div>
    <div class="timeline-content" id="timeline-content">
      ${renderSkeletons()}
    </div>
    <div class="timeline-footer hidden" id="timeline-footer">
      <button class="btn btn-secondary btn-sm" id="timeline-load-more">Load more</button>
    </div>
  `;

  bindEvents(panel, props);
  loadTimeline(panel, props);

  return panel;
}

// ============================================
// EVENT BINDING
// ============================================

function bindEvents(panel: HTMLElement, props: TimelinePanelProps): void {
  // Period selector
  const periodSelect = panel.querySelector('#timeline-period') as HTMLSelectElement;
  on(periodSelect, 'change', () => {
    currentDays = parseInt(periodSelect.value);
    loadTimeline(panel, props);
  });

  // Density toggle
  const densityBtns = panel.querySelectorAll('.density-btn');
  densityBtns.forEach(btn => {
    on(btn as HTMLElement, 'click', () => {
      densityBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDensity = btn.getAttribute('data-density') as Density;
      updateDensity(panel);
    });
  });

  // Search
  const searchInput = panel.querySelector('#timeline-search') as HTMLInputElement;
  let searchTimeout: ReturnType<typeof setTimeout>;
  on(searchInput, 'input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = searchInput.value.toLowerCase();
      renderFilteredEvents(panel, props);
    }, 200);
  });

  // Export
  const exportBtn = panel.querySelector('.timeline-export-btn');
  if (exportBtn) {
    on(exportBtn as HTMLElement, 'click', () => showExportMenu(panel));
  }

  // Keyboard navigation
  on(panel, 'keydown', (e: KeyboardEvent) => {
    const content = panel.querySelector('#timeline-content');
    if (!content) return;

    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      navigateEvents(panel, 1, props);
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      navigateEvents(panel, -1, props);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectFocusedEvent(panel, props);
    } else if (e.key === '/') {
      e.preventDefault();
      searchInput.focus();
    } else if (e.key === 'Escape') {
      searchInput.blur();
      focusedEventIndex = -1;
      clearEventFocus(panel);
    }
  });

  // Make panel focusable for keyboard events
  panel.setAttribute('tabindex', '0');
}

// ============================================
// DATA LOADING
// ============================================

async function loadTimeline(panel: HTMLElement, props: TimelinePanelProps): Promise<void> {
  const content = panel.querySelector('#timeline-content') as HTMLElement;
  content.innerHTML = renderSkeletons();

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - currentDays);

    const data: TimelineData = await getTimeline({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      limit: 500,
    });

    allEvents = data.events || [];
    updateTypeCounts(panel, allEvents);
    renderFilteredEvents(panel, props);
    updateCount(panel, allEvents.length);
  } catch (error) {
    console.error('Failed to load timeline:', error);
    content.innerHTML = renderError();
  }
}

// ============================================
// RENDERING
// ============================================

function renderFilteredEvents(panel: HTMLElement, props: TimelinePanelProps): void {
  let filtered = [...allEvents];

  // Apply type filter
  if (currentTypeFilters.length > 0) {
    filtered = filtered.filter(e => currentTypeFilters.includes(e.type));
  }

  // Apply search filter
  if (currentSearch) {
    filtered = filtered.filter(e => {
      const title = (e.title || '').toLowerCase();
      const content = (e.content || e.description || '').toLowerCase();
      const owner = (e.owner || e.user || e.actor || '').toLowerCase();
      return title.includes(currentSearch) || content.includes(currentSearch) || owner.includes(currentSearch);
    });
  }

  const content = panel.querySelector('#timeline-content') as HTMLElement;

  if (filtered.length === 0) {
    content.innerHTML = renderEmptyState();
    return;
  }

  // Group by date
  const grouped = groupByDate(filtered);
  const today = new Date().toISOString().split('T')[0];

  content.innerHTML = `
    <div class="timeline-list density-${currentDensity}">
      ${Object.entries(grouped).map(([date, events]) => `
        <div class="timeline-day" data-date="${date}">
          <div class="timeline-date-header sticky">
            <span class="date-label">${formatDateLabel(date)}</span>
            <span class="event-count">${events.length} event${events.length === 1 ? '' : 's'}</span>
          </div>
          ${date === today ? '<div class="today-marker"><span>Today</span></div>' : ''}
          <div class="timeline-day-events">
            ${events.map((event, idx) => renderEventCard(event, idx)).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  bindEventCardClicks(panel, filtered, props);
  focusedEventIndex = -1;
}

function renderEventCard(event: TimelineEvent, index: number): string {
  const config = EVENT_TYPES[event.type] || { label: event.type, icon: '📎', color: '#888' };
  const icon = event.icon || config.icon;
  const color = event.color || config.color;
  const owner = event.owner || event.user || event.actor;
  const initials = owner ? getInitials(owner) : '';
  const statusBadge = event.status ? `<span class="status-badge status-${event.status}">${event.status}</span>` : '';
  const time = event.date ? formatTime(event.date) : '';
  const relativeTime = event.date ? formatRelativeTime(event.date) : '';
  const fullDateTime = event.date ? formatDateTime(event.date) : '';

  return `
    <div class="timeline-event" data-id="${event.id}" data-index="${index}" tabindex="0">
      <div class="event-avatar" style="--event-color: ${color}">
        ${initials || icon}
      </div>
      <div class="event-body">
        <div class="event-header">
          <span class="event-type-badge" style="--event-color: ${color}">
            <span class="type-icon">${icon}</span>
            ${config.label}
          </span>
          ${statusBadge}
          <span class="event-time" title="${fullDateTime}">${relativeTime}</span>
        </div>
        <div class="event-title">${escapeHtml(event.title)}</div>
        ${event.content || event.description ? `<div class="event-content">${escapeHtml(truncate(event.content || event.description || '', 150))}</div>` : ''}
        ${owner ? `<div class="event-owner"><span class="owner-name">by ${escapeHtml(owner)}</span></div>` : ''}
      </div>
      <div class="event-meta">
        <span class="meta-time">${time}</span>
      </div>
    </div>
  `;
}

function renderSkeletons(): string {
  const skeletonCount = 8;
  return `
    <div class="timeline-skeletons">
      ${Array(skeletonCount).fill(0).map(() => `
        <div class="skeleton-event">
          <div class="skeleton-avatar shimmer"></div>
          <div class="skeleton-body">
            <div class="skeleton-line short shimmer"></div>
            <div class="skeleton-line long shimmer"></div>
            <div class="skeleton-line medium shimmer"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderEmptyState(): string {
  return `
    <div class="timeline-empty">
      <div class="empty-illustration">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="50" fill="var(--bg-card)" stroke="var(--border)" stroke-width="2"/>
          <path d="M60 30V60L80 75" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="60" cy="60" r="6" fill="var(--accent)"/>
        </svg>
      </div>
      <h3>No events found</h3>
      <p>Try adjusting your filters or date range</p>
      <div class="empty-actions">
        <button class="btn btn-primary btn-sm" id="empty-clear-filters">Clear Filters</button>
      </div>
    </div>
  `;
}

function renderError(): string {
  return `
    <div class="timeline-error">
      <div class="error-icon">⚠️</div>
      <h3>Failed to load timeline</h3>
      <p>Please try again later</p>
      <button class="btn btn-primary btn-sm" id="timeline-retry">Retry</button>
    </div>
  `;
}

// ============================================
// TYPE FILTERS
// ============================================

function updateTypeCounts(panel: HTMLElement, events: TimelineEvent[]): void {
  const counts: Record<string, number> = {};
  events.forEach(e => {
    counts[e.type] = (counts[e.type] || 0) + 1;
  });

  const container = panel.querySelector('#timeline-type-filters') as HTMLElement;
  const typesWithEvents = Object.keys(counts).filter(type => counts[type] > 0);

  container.innerHTML = `
    <button class="filter-chip ${currentTypeFilters.length === 0 ? 'active' : ''}" data-type="">All (${events.length})</button>
    ${typesWithEvents.map(type => {
    const config = EVENT_TYPES[type] || { label: type, icon: '📎', color: '#888' };
    const isActive = currentTypeFilters.includes(type);
    return `
        <button class="filter-chip ${isActive ? 'active' : ''}" data-type="${type}" style="--chip-color: ${config.color}">
          ${config.icon} ${config.label} (${counts[type]})
        </button>
      `;
  }).join('')}
  `;

  // Bind filter clicks
  const chips = container.querySelectorAll('.filter-chip');
  chips.forEach(chip => {
    on(chip as HTMLElement, 'click', () => {
      const type = chip.getAttribute('data-type') || '';
      if (!type) {
        currentTypeFilters = [];
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      } else {
        const allChip = container.querySelector('[data-type=""]');
        allChip?.classList.remove('active');

        if (currentTypeFilters.includes(type)) {
          currentTypeFilters = currentTypeFilters.filter(t => t !== type);
          chip.classList.remove('active');
        } else {
          currentTypeFilters.push(type);
          chip.classList.add('active');
        }

        if (currentTypeFilters.length === 0) {
          allChip?.classList.add('active');
        }
      }
      renderFilteredEvents(panel, {});
    });
  });
}

// ============================================
// NAVIGATION & INTERACTION
// ============================================

function bindEventCardClicks(panel: HTMLElement, events: TimelineEvent[], props: TimelinePanelProps): void {
  const cards = panel.querySelectorAll('.timeline-event');
  cards.forEach(card => {
    on(card as HTMLElement, 'click', () => {
      const id = card.getAttribute('data-id');
      const event = events.find(e => String(e.id) === id);
      if (event && props.onEventClick) {
        props.onEventClick(event);
      }
    });
  });

  // Clear filters button in empty state
  const clearBtn = panel.querySelector('#empty-clear-filters');
  if (clearBtn) {
    on(clearBtn as HTMLElement, 'click', () => {
      currentTypeFilters = [];
      currentSearch = '';
      const searchInput = panel.querySelector('#timeline-search') as HTMLInputElement;
      if (searchInput) searchInput.value = '';
      updateTypeCounts(panel, allEvents);
      renderFilteredEvents(panel, props);
    });
  }

  // Retry button in error state
  const retryBtn = panel.querySelector('#timeline-retry');
  if (retryBtn) {
    on(retryBtn as HTMLElement, 'click', () => loadTimeline(panel, props));
  }
}

function navigateEvents(panel: HTMLElement, direction: number, props: TimelinePanelProps): void {
  const cards = panel.querySelectorAll('.timeline-event');
  if (cards.length === 0) return;

  clearEventFocus(panel);
  focusedEventIndex = Math.max(0, Math.min(cards.length - 1, focusedEventIndex + direction));

  const targetCard = cards[focusedEventIndex] as HTMLElement;
  if (targetCard) {
    targetCard.classList.add('focused');
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    targetCard.focus();
  }
}

function selectFocusedEvent(panel: HTMLElement, props: TimelinePanelProps): void {
  const cards = panel.querySelectorAll('.timeline-event');
  if (focusedEventIndex >= 0 && focusedEventIndex < cards.length) {
    const card = cards[focusedEventIndex] as HTMLElement;
    card.click();
  }
}

function clearEventFocus(panel: HTMLElement): void {
  panel.querySelectorAll('.timeline-event.focused').forEach(el => el.classList.remove('focused'));
}

function updateDensity(panel: HTMLElement): void {
  const list = panel.querySelector('.timeline-list');
  if (list) {
    list.className = `timeline-list density-${currentDensity}`;
  }
}

function updateCount(panel: HTMLElement, count: number): void {
  const countEl = panel.querySelector('#timeline-count');
  if (countEl) countEl.textContent = String(count);
}

// ============================================
// EXPORT MENU
// ============================================

function showExportMenu(panel: HTMLElement): void {
  const existing = panel.querySelector('.export-menu');
  if (existing) {
    existing.remove();
    return;
  }

  const menu = createElement('div', { className: 'export-menu dropdown-menu' });
  menu.innerHTML = `
    <button class="dropdown-item" data-format="csv">📊 Export CSV</button>
    <button class="dropdown-item" data-format="json">📦 Export JSON</button>
  `;

  const exportBtn = panel.querySelector('.timeline-export-btn');
  if (exportBtn) {
    exportBtn.appendChild(menu);
  }

  menu.querySelectorAll('.dropdown-item').forEach(item => {
    on(item as HTMLElement, 'click', () => {
      const format = item.getAttribute('data-format');
      exportTimeline(format || 'csv');
      menu.remove();
    });
  });

  // Close on outside click
  setTimeout(() => {
    const closeHandler = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 0);
}

function exportTimeline(format: string): void {
  const data = allEvents.map(e => ({
    date: e.date,
    type: e.type,
    title: e.title,
    content: e.content || e.description,
    owner: e.owner || e.user || e.actor,
    status: e.status,
  }));

  let content: string;
  let filename: string;
  let mimeType: string;

  if (format === 'csv') {
    const headers = ['Date', 'Type', 'Title', 'Content', 'Owner', 'Status'];
    const rows = data.map(d => [
      d.date, d.type, `"${(d.title || '').replace(/"/g, '""')}"`,
      `"${(d.content || '').replace(/"/g, '""')}"`,
      `"${(d.owner || '').replace(/"/g, '""')}"`, d.status || ''
    ].join(','));
    content = [headers.join(','), ...rows].join('\n');
    filename = `timeline-${new Date().toISOString().split('T')[0]}.csv`;
    mimeType = 'text/csv';
  } else {
    content = JSON.stringify(data, null, 2);
    filename = `timeline-${new Date().toISOString().split('T')[0]}.json`;
    mimeType = 'application/json';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// UTILITIES
// ============================================

function groupByDate(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  const grouped: Record<string, TimelineEvent[]> = {};

  events.forEach(event => {
    const date = event.date ? event.date.split('T')[0] : 'unknown';
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(event);
  });

  // Sort by date descending
  return Object.fromEntries(
    Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a))
  );
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());

  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  if (date >= thisWeekStart) return 'This week - ' + formatDate(date, { weekday: 'long' });

  return formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createTimelinePanel;
