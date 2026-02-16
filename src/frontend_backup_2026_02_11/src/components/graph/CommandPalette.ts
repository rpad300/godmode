/**
 * CommandPalette - Quick action launcher (Cmd+K)
 * 
 * Features:
 * - Fuzzy search
 * - Keyboard navigation
 * - Action categories
 * - Recent actions
 */

import { createElement, on } from '@lib/dom';

export interface CommandPaletteProps {
  onClose?: () => void;
  onAction?: (actionId: string, data?: unknown) => void;
}

interface Command {
  id: string;
  label: string;
  description?: string;
  category: string;
  icon: string;
  shortcut?: string;
  keywords?: string[];
}

const COMMANDS: Command[] = [
  // Navigation
  { id: 'go-explorer', label: 'Go to Explorer', category: 'Navigation', icon: '🔍', shortcut: '1' },
  { id: 'go-ontology', label: 'Go to Ontology', category: 'Navigation', icon: '📚', shortcut: '2' },
  { id: 'go-query', label: 'Go to Query Builder', category: 'Navigation', icon: '💻', shortcut: '3' },
  { id: 'go-analytics', label: 'Go to Analytics', category: 'Navigation', icon: '📊', shortcut: '4' },

  // Graph Actions
  { id: 'fit-view', label: 'Fit Graph to View', category: 'Graph', icon: '⬜', keywords: ['zoom', 'fit', 'center'] },
  { id: 'find-paths', label: 'Find Paths Between Nodes', category: 'Graph', icon: '🔗', keywords: ['path', 'connection', 'route'] },
  { id: 'detect-communities', label: 'Detect Communities', category: 'Graph', icon: '🎯', keywords: ['cluster', 'group'] },
  { id: 'export-graph', label: 'Export Graph', category: 'Graph', icon: '📤', keywords: ['download', 'save', 'export'] },
  { id: 'create-snapshot', label: 'Create Snapshot', category: 'Graph', icon: '📸', keywords: ['save', 'backup', 'snapshot'] },

  // Filter Actions
  { id: 'filter-people', label: 'Show Only People', category: 'Filter', icon: '👥', keywords: ['person', 'people', 'filter'] },
  { id: 'filter-projects', label: 'Show Only Projects', category: 'Filter', icon: '📁', keywords: ['project', 'filter'] },
  { id: 'filter-decisions', label: 'Show Only Decisions', category: 'Filter', icon: '✅', keywords: ['decision', 'filter'] },
  { id: 'filter-risks', label: 'Show Only Risks', category: 'Filter', icon: '⚠️', keywords: ['risk', 'filter'] },
  { id: 'clear-filters', label: 'Clear All Filters', category: 'Filter', icon: '🔄', keywords: ['reset', 'clear'] },

  // AI Actions
  { id: 'ai-copilot', label: 'Open AI Copilot', category: 'AI', icon: '🤖', shortcut: 'C' },
  { id: 'ai-insights', label: 'Generate AI Insights', category: 'AI', icon: '💡', keywords: ['insight', 'analysis'] },
  { id: 'ai-summarize', label: 'Summarize Selection', category: 'AI', icon: '📝', keywords: ['summary', 'summarize'] },
  { id: 'ai-explain', label: 'Explain Connection', category: 'AI', icon: '❓', keywords: ['explain', 'why'] },

  // Query Actions
  { id: 'new-query', label: 'New Cypher Query', category: 'Query', icon: '➕', keywords: ['query', 'cypher', 'new'] },
  { id: 'query-history', label: 'View Query History', category: 'Query', icon: '📜', keywords: ['history', 'past'] },
  { id: 'query-templates', label: 'Browse Query Templates', category: 'Query', icon: '📋', keywords: ['template', 'pattern'] },

  // Settings
  { id: 'toggle-theme', label: 'Toggle Dark/Light Mode', category: 'Settings', icon: '🌙', keywords: ['theme', 'dark', 'light', 'mode'] },
  { id: 'toggle-labels', label: 'Toggle Node Labels', category: 'Settings', icon: '🏷️', keywords: ['label', 'text'] },
  { id: 'toggle-physics', label: 'Toggle Physics Simulation', category: 'Settings', icon: '⚡', keywords: ['physics', 'animation'] },
];

/**
 * Create the command palette component
 */
export function createCommandPalette(props: CommandPaletteProps = {}): HTMLElement {
  const container = createElement('div', { className: 'command-palette' });

  container.innerHTML = `
    <div class="palette-search">
      <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="palette-input" class="palette-input" placeholder="Type a command or search..." autofocus>
      <div class="palette-shortcut">
        <kbd>Esc</kbd> to close
      </div>
    </div>
    
    <div class="palette-results" id="palette-results">
      <!-- Results will be rendered here -->
    </div>
    
    <div class="palette-footer">
      <div class="footer-hint">
        <kbd>↑↓</kbd> to navigate
        <kbd>Enter</kbd> to select
      </div>
    </div>
  `;

  // Initialize
  initPalette(container, props);

  return container;
}

/**
 * Initialize palette
 */
function initPalette(container: HTMLElement, props: CommandPaletteProps): void {
  const input = container.querySelector('#palette-input') as HTMLInputElement;
  const results = container.querySelector('#palette-results') as HTMLElement;

  let selectedIndex = 0;
  let filteredCommands = [...COMMANDS];

  // Initial render
  renderResults(results, filteredCommands, selectedIndex, props);

  // Filter on input
  on(input, 'input', () => {
    const query = input.value.toLowerCase().trim();

    if (!query) {
      filteredCommands = [...COMMANDS];
    } else {
      filteredCommands = COMMANDS.filter(cmd => {
        const searchText = [
          cmd.label,
          cmd.description || '',
          cmd.category,
          ...(cmd.keywords || []),
        ].join(' ').toLowerCase();

        return searchText.includes(query) || fuzzyMatch(query, cmd.label.toLowerCase());
      });
    }

    selectedIndex = 0;
    renderResults(results, filteredCommands, selectedIndex, props);
  });

  // Keyboard navigation
  on(input, 'keydown', (e: Event) => {
    const event = e as KeyboardEvent;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
        renderResults(results, filteredCommands, selectedIndex, props);
        break;

      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        renderResults(results, filteredCommands, selectedIndex, props);
        break;

      case 'Enter':
        event.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex], props);
        }
        break;

      case 'Escape':
        event.preventDefault();
        props.onClose?.();
        break;
    }
  });

  // Click outside to close
  on(container, 'click', (e: Event) => {
    if (e.target === container) {
      props.onClose?.();
    }
  });
}

/**
 * Render results
 */
function renderResults(
  container: HTMLElement,
  commands: Command[],
  selectedIndex: number,
  props: CommandPaletteProps
): void {
  if (commands.length === 0) {
    container.innerHTML = `
      <div class="palette-empty">
        <p>No commands found</p>
      </div>
    `;
    return;
  }

  // Group by category
  const byCategory: Record<string, Command[]> = {};
  commands.forEach(cmd => {
    if (!byCategory[cmd.category]) byCategory[cmd.category] = [];
    byCategory[cmd.category].push(cmd);
  });

  let globalIndex = 0;

  container.innerHTML = Object.entries(byCategory).map(([category, cmds]) => `
    <div class="palette-category">
      <div class="category-label">${escapeHtml(category)}</div>
      ${cmds.map(cmd => {
    const index = globalIndex++;
    const isSelected = index === selectedIndex;
    return `
          <div class="palette-item ${isSelected ? 'selected' : ''}" data-id="${cmd.id}" data-index="${index}">
            <span class="item-icon">${cmd.icon}</span>
            <span class="item-label">${escapeHtml(cmd.label)}</span>
            ${cmd.description ? `<span class="item-description">${escapeHtml(cmd.description)}</span>` : ''}
            ${cmd.shortcut ? `<kbd class="item-shortcut">${cmd.shortcut}</kbd>` : ''}
          </div>
        `;
  }).join('')}
    </div>
  `).join('');

  // Bind click events
  container.querySelectorAll('.palette-item').forEach(item => {
    on(item as HTMLElement, 'click', () => {
      const id = item.getAttribute('data-id');
      const cmd = commands.find(c => c.id === id);
      if (cmd) {
        executeCommand(cmd, props);
      }
    });

    // Hover to select
    on(item as HTMLElement, 'mouseenter', () => {
      container.querySelectorAll('.palette-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    });
  });

  // Scroll selected into view
  const selectedEl = container.querySelector('.palette-item.selected');
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest' });
  }
}

/**
 * Execute command
 */
function executeCommand(command: Command, props: CommandPaletteProps): void {
  props.onAction?.(command.id);
  props.onClose?.();
}

/**
 * Fuzzy match
 */
function fuzzyMatch(query: string, text: string): boolean {
  let qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) qi++;
  }
  return qi === query.length;
}

/**
 * Show command palette (helper)
 */
export function showCommandPalette(props: CommandPaletteProps = {}): void {
  // Remove existing palette
  const existing = document.querySelector('.command-palette-overlay');
  if (existing) existing.remove();

  // Create new palette
  const overlay = createElement('div', { className: 'command-palette-overlay' });
  const palette = createCommandPalette({
    ...props,
    onClose: () => {
      overlay.remove();
      props.onClose?.();
    },
  });

  overlay.appendChild(palette);
  document.body.appendChild(overlay);

  // Focus input
  const input = overlay.querySelector('input');
  if (input) input.focus();
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createCommandPalette;
