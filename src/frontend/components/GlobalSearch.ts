/**
 * Global Search Component
 * Command palette style search (Cmd+K / Ctrl+K)
 */

import { createElement, on } from '../utils/dom';
import { http } from '../services/api';
import { shortcuts } from '../services/shortcuts';

export interface GlobalSearchProps {
  onResultClick?: (result: SearchResult) => void;
}

export interface SearchResult {
  id: string;
  type: 'question' | 'risk' | 'action' | 'decision' | 'contact' | 'document' | 'email' | 'fact';
  title: string;
  subtitle?: string;
  icon?: string;
  url?: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
}

let isOpen = false;
let currentQuery = '';
let selectedIndex = 0;
let results: SearchResult[] = [];

const TYPE_ICONS: Record<string, string> = {
  question: '❓',
  risk: '⚠️',
  action: '✓',
  decision: '⚖️',
  contact: '👤',
  document: '📄',
  email: '📧',
  fact: '💡',
};

/**
 * Initialize global search
 */
export function initGlobalSearch(props: GlobalSearchProps = {}): void {
  // Create modal if not exists
  let modal = document.getElementById('global-search-modal');
  if (!modal) {
    modal = createSearchModal(props);
    document.body.appendChild(modal);
  }

  // Register keyboard shortcut
  shortcuts.register('mod+k', (e) => {
    e.preventDefault();
    toggleSearch();
  });

  // Also register / for quick search
  shortcuts.register('/', (e) => {
    // Only if not in an input
    if (document.activeElement?.tagName !== 'INPUT' && 
        document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      toggleSearch();
    }
  });
}

/**
 * Create search modal
 */
function createSearchModal(props: GlobalSearchProps): HTMLElement {
  const modal = createElement('div', {
    id: 'global-search-modal',
    className: 'global-search-modal hidden',
  });

  modal.innerHTML = `
    <div class="search-backdrop"></div>
    <div class="search-dialog">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input type="text" id="global-search-input" class="search-input" 
               placeholder="Search questions, risks, contacts..." autocomplete="off">
        <kbd class="search-shortcut">ESC</kbd>
      </div>
      <div class="search-results" id="search-results">
        <div class="search-hint">
          <p>Start typing to search...</p>
          <div class="search-tips">
            <span><kbd>↑↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Select</span>
            <span><kbd>ESC</kbd> Close</span>
          </div>
        </div>
      </div>
      <div class="search-footer">
        <span>Type to search</span>
        <span>Press <kbd>?</kbd> for more shortcuts</span>
      </div>
    </div>
  `;

  const backdrop = modal.querySelector('.search-backdrop') as HTMLElement;
  const input = modal.querySelector('#global-search-input') as HTMLInputElement;
  const resultsContainer = modal.querySelector('#search-results') as HTMLElement;

  // Close on backdrop click
  on(backdrop, 'click', closeSearch);

  // Input events
  on(input, 'input', () => {
    currentQuery = input.value;
    selectedIndex = 0;
    debounceSearch(resultsContainer, props);
  });

  on(input, 'keydown', (e) => {
    handleKeydown(e, resultsContainer, props);
  });

  return modal;
}

/**
 * Toggle search visibility
 */
export function toggleSearch(): void {
  if (isOpen) {
    closeSearch();
  } else {
    openSearch();
  }
}

/**
 * Open search
 */
export function openSearch(): void {
  const modal = document.getElementById('global-search-modal');
  if (!modal) return;

  isOpen = true;
  modal.classList.remove('hidden');
  
  const input = modal.querySelector('#global-search-input') as HTMLInputElement;
  input.value = '';
  input.focus();
  
  currentQuery = '';
  results = [];
  selectedIndex = 0;

  // Reset results
  const resultsContainer = modal.querySelector('#search-results') as HTMLElement;
  resultsContainer.innerHTML = `
    <div class="search-hint">
      <p>Start typing to search...</p>
      <div class="search-tips">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Select</span>
        <span><kbd>ESC</kbd> Close</span>
      </div>
    </div>
  `;

  // Add escape listener
  document.addEventListener('keydown', handleEscape);
}

/**
 * Close search
 */
export function closeSearch(): void {
  const modal = document.getElementById('global-search-modal');
  if (!modal) return;

  isOpen = false;
  modal.classList.add('hidden');
  
  document.removeEventListener('keydown', handleEscape);
}

/**
 * Handle escape key
 */
function handleEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    closeSearch();
  }
}

/**
 * Handle keyboard navigation
 */
function handleKeydown(e: KeyboardEvent, container: HTMLElement, props: GlobalSearchProps): void {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
      updateSelection(container);
      break;
    case 'ArrowUp':
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection(container);
      break;
    case 'Enter':
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        selectResult(selected, props);
      }
      break;
    case 'Escape':
      closeSearch();
      break;
  }
}

/**
 * Update selection highlight
 */
function updateSelection(container: HTMLElement): void {
  const items = container.querySelectorAll('.search-result');
  items.forEach((item, i) => {
    item.classList.toggle('selected', i === selectedIndex);
    if (i === selectedIndex) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

/**
 * Debounced search
 */
let searchTimeout: number;
function debounceSearch(container: HTMLElement, props: GlobalSearchProps): void {
  clearTimeout(searchTimeout);
  searchTimeout = window.setTimeout(() => {
    performSearch(container, props);
  }, 200);
}

/**
 * Perform search
 */
async function performSearch(container: HTMLElement, props: GlobalSearchProps): Promise<void> {
  if (!currentQuery.trim()) {
    container.innerHTML = `
      <div class="search-hint">
        <p>Start typing to search...</p>
        <div class="search-tips">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Select</span>
          <span><kbd>ESC</kbd> Close</span>
        </div>
      </div>
    `;
    results = [];
    return;
  }

  container.innerHTML = '<div class="search-loading">Searching...</div>';

  try {
    const response = await http.get<SearchResponse>(
      `/api/search?q=${encodeURIComponent(currentQuery)}&limit=10`
    );
    results = response.data.results || [];
    
    renderResults(container, results, props);
  } catch {
    // Fallback to local search if API fails
    results = performLocalSearch(currentQuery);
    renderResults(container, results, props);
  }
}

/**
 * Local fallback search
 */
function performLocalSearch(query: string): SearchResult[] {
  // TODO: Search local stores
  return [];
}

/**
 * Render results
 */
function renderResults(container: HTMLElement, results: SearchResult[], props: GlobalSearchProps): void {
  if (results.length === 0) {
    container.innerHTML = `
      <div class="search-empty">
        <p>No results found for "${escapeHtml(currentQuery)}"</p>
      </div>
    `;
    return;
  }

  // Group by type
  const grouped = groupByType(results);

  container.innerHTML = Object.entries(grouped).map(([type, items]) => `
    <div class="search-group">
      <div class="group-label">${capitalize(type)}s</div>
      ${items.map((result, i) => `
        <div class="search-result ${i === selectedIndex ? 'selected' : ''}" data-index="${results.indexOf(result)}">
          <span class="result-icon">${TYPE_ICONS[result.type] || '📋'}</span>
          <div class="result-content">
            <div class="result-title">${escapeHtml(result.title)}</div>
            ${result.subtitle ? `<div class="result-subtitle">${escapeHtml(result.subtitle)}</div>` : ''}
          </div>
          <span class="result-type">${result.type}</span>
        </div>
      `).join('')}
    </div>
  `).join('');

  // Bind click events
  container.querySelectorAll('.search-result').forEach(el => {
    on(el as HTMLElement, 'click', () => {
      const index = parseInt(el.getAttribute('data-index') || '0');
      const result = results[index];
      if (result) {
        selectResult(result, props);
      }
    });

    on(el as HTMLElement, 'mouseenter', () => {
      const index = parseInt(el.getAttribute('data-index') || '0');
      selectedIndex = index;
      updateSelection(container);
    });
  });
}

/**
 * Select result
 */
function selectResult(result: SearchResult, props: GlobalSearchProps): void {
  closeSearch();
  
  if (props.onResultClick) {
    props.onResultClick(result);
  } else {
    // Default navigation
    navigateToResult(result);
  }
}

/**
 * Navigate to result
 */
function navigateToResult(result: SearchResult): void {
  // Dispatch custom event for navigation
  window.dispatchEvent(new CustomEvent('godmode:navigate', {
    detail: { type: result.type, id: result.id }
  }));
}

/**
 * Group results by type
 */
function groupByType(results: SearchResult[]): Record<string, SearchResult[]> {
  const grouped: Record<string, SearchResult[]> = {};
  results.forEach(r => {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  });
  return grouped;
}

/**
 * Capitalize
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default initGlobalSearch;
