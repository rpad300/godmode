/**
 * QueryBuilder - Visual and Cypher query builder
 * 
 * Features:
 * - Raw Cypher editor with syntax highlighting
 * - Query templates from ontology
 * - Query history with favorites
 * - Results as table and graph
 * - AI-powered query generation
 */

import { createElement, on } from '../../utils/dom';
import { graphService, CypherQueryResult, GraphQueryHistory } from '../../services/graph';
import { toast } from '../../services/toast';

export interface QueryBuilderProps {
  onExecute?: (cypher: string, results: CypherQueryResult) => void;
  initialQuery?: string;
}

interface BuilderState {
  query: string;
  results: CypherQueryResult | null;
  history: GraphQueryHistory[];
  templates: Array<{ id: string; name: string; description: string; cypher: string; category: string }>;
  isLoading: boolean;
  activeTab: 'editor' | 'templates' | 'history';
  resultsView: 'table' | 'json';
}

/**
 * Create the query builder component
 */
export function createQueryBuilder(props: QueryBuilderProps = {}): HTMLElement {
  const state: BuilderState = {
    query: props.initialQuery || '// Enter your Cypher query here\nMATCH (n) RETURN n LIMIT 10',
    results: null,
    history: [],
    templates: [],
    isLoading: false,
    activeTab: 'editor',
    resultsView: 'table',
  };

  const container = createElement('div', { className: 'query-builder' });
  
  container.innerHTML = `
    <div class="query-builder-layout">
      <div class="query-sidebar">
        <div class="sidebar-tabs">
          <button class="sidebar-tab active" data-tab="templates">Templates</button>
          <button class="sidebar-tab" data-tab="history">History</button>
        </div>
        <div class="sidebar-content" id="query-sidebar-content">
          <div class="loading-state">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
      
      <div class="query-main">
        <div class="query-editor-area">
          <div class="editor-toolbar">
            <div class="editor-toolbar-left">
              <span class="editor-label">Cypher Query</span>
            </div>
            <div class="editor-toolbar-right">
              <button class="editor-btn" id="btn-format" title="Format Query">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="21" y1="10" x2="3" y2="10"/>
                  <line x1="21" y1="6" x2="3" y2="6"/>
                  <line x1="21" y1="14" x2="3" y2="14"/>
                  <line x1="21" y1="18" x2="3" y2="18"/>
                </svg>
              </button>
              <button class="editor-btn" id="btn-clear" title="Clear">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
              <button class="editor-btn" id="btn-ai-generate" title="Generate with AI">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                AI Generate
              </button>
            </div>
          </div>
          <div class="editor-container">
            <textarea
              id="cypher-editor"
              class="cypher-editor"
              spellcheck="false"
              placeholder="MATCH (n) RETURN n LIMIT 10"
            >${escapeHtml(state.query)}</textarea>
            <div class="editor-line-numbers" id="line-numbers"></div>
          </div>
          <div class="editor-actions">
            <button class="btn btn-primary" id="btn-execute">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Execute
            </button>
            <button class="btn btn-secondary" id="btn-explain">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Explain
            </button>
            <button class="btn btn-secondary" id="btn-save">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Save
            </button>
          </div>
        </div>
        
        <div class="query-results-area">
          <div class="results-header">
            <div class="results-tabs">
              <button class="results-tab active" data-view="table">Table</button>
              <button class="results-tab" data-view="json">JSON</button>
            </div>
            <div class="results-info" id="results-info">
              <!-- Results count and timing -->
            </div>
          </div>
          <div class="results-content" id="results-content">
            <div class="results-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              <p>Execute a query to see results</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- AI Generate Modal -->
    <div class="modal-overlay hidden" id="ai-modal">
      <div class="modal ai-generate-modal">
        <div class="modal-header">
          <h3>Generate Query with AI</h3>
          <button class="modal-close" id="ai-modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <label class="form-label">Describe what you want to query in natural language:</label>
          <textarea
            id="ai-prompt"
            class="form-textarea"
            placeholder="e.g., Find all people who work in the Engineering department and are connected to at least 3 projects"
            rows="3"
          ></textarea>
          <div class="ai-examples">
            <p class="examples-label">Examples:</p>
            <button class="example-chip" data-prompt="Show all people and their roles">People and roles</button>
            <button class="example-chip" data-prompt="Find the top 10 most connected nodes">Most connected</button>
            <button class="example-chip" data-prompt="Show decisions made in the last month">Recent decisions</button>
            <button class="example-chip" data-prompt="Find all risks with high severity">High-risk items</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="ai-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="ai-modal-generate">Generate Query</button>
        </div>
      </div>
    </div>
  `;

  // Initialize
  initQueryBuilder(container, state, props);

  return container;
}

/**
 * Initialize the query builder
 */
async function initQueryBuilder(
  container: HTMLElement,
  state: BuilderState,
  props: QueryBuilderProps
): Promise<void> {
  const editor = container.querySelector('#cypher-editor') as HTMLTextAreaElement;
  const sidebarContent = container.querySelector('#query-sidebar-content') as HTMLElement;

  // Update line numbers
  updateLineNumbers(container, editor);
  on(editor, 'input', () => {
    state.query = editor.value;
    updateLineNumbers(container, editor);
  });
  on(editor, 'scroll', () => {
    const lineNumbers = container.querySelector('#line-numbers') as HTMLElement;
    if (lineNumbers) {
      lineNumbers.scrollTop = editor.scrollTop;
    }
  });

  // Bind sidebar tabs
  const sidebarTabs = container.querySelectorAll('.sidebar-tab');
  sidebarTabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      const tabId = tab.getAttribute('data-tab') as 'templates' | 'history';
      sidebarTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeTab = tabId === 'templates' ? 'templates' : 'history';
      renderSidebar(sidebarContent, state, editor);
    });
  });

  // Bind results tabs
  const resultsTabs = container.querySelectorAll('.results-tab');
  resultsTabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      const view = tab.getAttribute('data-view') as 'table' | 'json';
      resultsTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.resultsView = view;
      if (state.results) {
        renderResults(container, state);
      }
    });
  });

  // Bind editor toolbar
  const btnFormat = container.querySelector('#btn-format');
  if (btnFormat) {
    on(btnFormat as HTMLElement, 'click', () => {
      editor.value = formatCypher(editor.value);
      state.query = editor.value;
      updateLineNumbers(container, editor);
    });
  }

  const btnClear = container.querySelector('#btn-clear');
  if (btnClear) {
    on(btnClear as HTMLElement, 'click', () => {
      editor.value = '';
      state.query = '';
      updateLineNumbers(container, editor);
    });
  }

  const btnAiGenerate = container.querySelector('#btn-ai-generate');
  if (btnAiGenerate) {
    on(btnAiGenerate as HTMLElement, 'click', () => showAIModal(container));
  }

  // Bind action buttons
  const btnExecute = container.querySelector('#btn-execute');
  if (btnExecute) {
    on(btnExecute as HTMLElement, 'click', () => executeQuery(container, state, props));
  }

  const btnExplain = container.querySelector('#btn-explain');
  if (btnExplain) {
    on(btnExplain as HTMLElement, 'click', () => explainQuery(container, state));
  }

  const btnSave = container.querySelector('#btn-save');
  if (btnSave) {
    on(btnSave as HTMLElement, 'click', () => saveQuery(container, state));
  }

  // Bind AI modal
  const aiModal = container.querySelector('#ai-modal') as HTMLElement;
  const aiModalClose = container.querySelector('#ai-modal-close');
  const aiModalCancel = container.querySelector('#ai-modal-cancel');
  const aiModalGenerate = container.querySelector('#ai-modal-generate');
  const aiPrompt = container.querySelector('#ai-prompt') as HTMLTextAreaElement;

  if (aiModalClose) {
    on(aiModalClose as HTMLElement, 'click', () => aiModal?.classList.add('hidden'));
  }
  if (aiModalCancel) {
    on(aiModalCancel as HTMLElement, 'click', () => aiModal?.classList.add('hidden'));
  }
  if (aiModalGenerate) {
    on(aiModalGenerate as HTMLElement, 'click', async () => {
      const prompt = aiPrompt?.value.trim();
      if (prompt) {
        await generateWithAI(container, state, editor, prompt);
        aiModal?.classList.add('hidden');
      }
    });
  }

  // Bind example chips
  const exampleChips = container.querySelectorAll('.example-chip');
  exampleChips.forEach(chip => {
    on(chip as HTMLElement, 'click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt && aiPrompt) {
        aiPrompt.value = prompt;
      }
    });
  });

  // Load templates and history
  await loadSidebarData(state);
  renderSidebar(sidebarContent, state, editor);

  // Keyboard shortcuts
  on(editor, 'keydown', (e: Event) => {
    const event = e as KeyboardEvent;
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      executeQuery(container, state, props);
    }
  });
}

/**
 * Load sidebar data
 */
async function loadSidebarData(state: BuilderState): Promise<void> {
  try {
    const [templates, history] = await Promise.all([
      graphService.getQueryTemplates(),
      graphService.getQueryHistory({ limit: 20 }),
    ]);
    state.templates = templates;
    state.history = history;
  } catch (error) {
    console.error('[QueryBuilder] Failed to load sidebar data:', error);
  }
}

/**
 * Render sidebar
 */
function renderSidebar(
  container: HTMLElement,
  state: BuilderState,
  editor: HTMLTextAreaElement
): void {
  if (state.activeTab === 'templates') {
    renderTemplates(container, state, editor);
  } else {
    renderHistory(container, state, editor);
  }
}

/**
 * Render templates
 */
function renderTemplates(
  container: HTMLElement,
  state: BuilderState,
  editor: HTMLTextAreaElement
): void {
  if (state.templates.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        <p>No query templates available</p>
      </div>
    `;
    return;
  }

  // Group by category
  const byCategory: Record<string, typeof state.templates> = {};
  state.templates.forEach(t => {
    const cat = t.category || 'General';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(t);
  });

  container.innerHTML = Object.entries(byCategory).map(([category, templates]) => `
    <div class="template-category">
      <h4 class="category-title">${escapeHtml(category)}</h4>
      ${templates.map(t => `
        <div class="template-item" data-cypher="${escapeHtml(t.cypher)}" title="${escapeHtml(t.description)}">
          <div class="template-name">${escapeHtml(t.name)}</div>
          <div class="template-description">${escapeHtml(t.description)}</div>
        </div>
      `).join('')}
    </div>
  `).join('');

  // Bind click events
  container.querySelectorAll('.template-item').forEach(item => {
    on(item as HTMLElement, 'click', () => {
      const cypher = item.getAttribute('data-cypher');
      if (cypher) {
        editor.value = cypher;
        state.query = cypher;
        updateLineNumbers(container.closest('.query-builder') as HTMLElement, editor);
      }
    });
  });
}

/**
 * Render history
 */
function renderHistory(
  container: HTMLElement,
  state: BuilderState,
  editor: HTMLTextAreaElement
): void {
  if (state.history.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        <p>No query history yet</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="history-list">
      ${state.history.map(h => `
        <div class="history-item" data-query="${escapeHtml(h.query_text)}">
          <div class="history-header">
            <span class="history-type">${h.query_type}</span>
            ${h.is_favorite ? '<span class="history-favorite">★</span>' : ''}
            <span class="history-time">${formatTime(h.created_at)}</span>
          </div>
          <div class="history-query">${escapeHtml(h.query_text.substring(0, 100))}${h.query_text.length > 100 ? '...' : ''}</div>
          ${h.result_count !== undefined ? `<div class="history-results">${h.result_count} results</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;

  // Bind click events
  container.querySelectorAll('.history-item').forEach(item => {
    on(item as HTMLElement, 'click', () => {
      const query = item.getAttribute('data-query');
      if (query) {
        editor.value = query;
        state.query = query;
        updateLineNumbers(container.closest('.query-builder') as HTMLElement, editor);
      }
    });
  });
}

/**
 * Execute query
 */
async function executeQuery(
  container: HTMLElement,
  state: BuilderState,
  props: QueryBuilderProps
): Promise<void> {
  const query = state.query.trim();
  if (!query || state.isLoading) return;

  state.isLoading = true;
  const btnExecute = container.querySelector('#btn-execute') as HTMLElement;
  const resultsInfo = container.querySelector('#results-info') as HTMLElement;
  
  if (btnExecute) btnExecute.classList.add('loading');
  if (resultsInfo) resultsInfo.innerHTML = '<span class="loading-text">Executing...</span>';

  const startTime = Date.now();

  try {
    const results = await graphService.executeCypher(query);
    const elapsed = Date.now() - startTime;

    state.results = results;
    state.results.executionTimeMs = elapsed;

    // Update results info
    if (resultsInfo) {
      if (results.ok) {
        resultsInfo.innerHTML = `
          <span class="results-count">${results.results.length} row${results.results.length !== 1 ? 's' : ''}</span>
          <span class="results-time">${elapsed}ms</span>
        `;
      } else {
        resultsInfo.innerHTML = `<span class="results-error">Error</span>`;
      }
    }

    // Render results
    renderResults(container, state);

    // Save to history
    await graphService.saveQueryHistory({
      query_type: 'cypher',
      query_text: query,
      result_count: results.results.length,
      execution_time_ms: elapsed,
      is_favorite: false,
    });

    // Callback
    props.onExecute?.(query, results);

  } catch (error) {
    state.results = {
      ok: false,
      results: [],
      error: error instanceof Error ? error.message : 'Query failed',
    };
    renderResults(container, state);
    toast.error('Query failed');
  }

  state.isLoading = false;
  if (btnExecute) btnExecute.classList.remove('loading');
}

/**
 * Render results
 */
function renderResults(container: HTMLElement, state: BuilderState): void {
  const resultsContent = container.querySelector('#results-content') as HTMLElement;
  if (!resultsContent || !state.results) return;

  if (!state.results.ok) {
    resultsContent.innerHTML = `
      <div class="results-error-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>${escapeHtml(state.results.error || 'Query failed')}</p>
      </div>
    `;
    return;
  }

  if (state.results.results.length === 0) {
    resultsContent.innerHTML = `
      <div class="results-empty">
        <p>Query returned no results</p>
      </div>
    `;
    return;
  }

  if (state.resultsView === 'table') {
    renderTableView(resultsContent, state.results);
  } else {
    renderJsonView(resultsContent, state.results);
  }
}

/**
 * Render table view
 */
function renderTableView(container: HTMLElement, results: CypherQueryResult): void {
  const columns = results.columns || Object.keys(results.results[0] || {});

  container.innerHTML = `
    <div class="results-table-wrapper">
      <table class="results-table">
        <thead>
          <tr>
            <th class="row-num">#</th>
            ${columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${results.results.map((row, i) => `
            <tr>
              <td class="row-num">${i + 1}</td>
              ${columns.map(col => `<td>${formatValue(row[col])}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Render JSON view
 */
function renderJsonView(container: HTMLElement, results: CypherQueryResult): void {
  container.innerHTML = `
    <div class="results-json-wrapper">
      <pre class="results-json">${escapeHtml(JSON.stringify(results.results, null, 2))}</pre>
    </div>
  `;
}

/**
 * Explain query
 */
async function explainQuery(container: HTMLElement, state: BuilderState): Promise<void> {
  const query = state.query.trim();
  if (!query) return;

  toast.info('Generating explanation...');
  
  try {
    const response = await graphService.query(`Explain this Cypher query: ${query}`);
    toast.success(response.answer.substring(0, 200));
  } catch {
    toast.error('Failed to explain query');
  }
}

/**
 * Save query
 */
async function saveQuery(container: HTMLElement, state: BuilderState): Promise<void> {
  const query = state.query.trim();
  if (!query) return;

  const name = prompt('Enter a name for this query:');
  if (!name) return;

  try {
    await graphService.saveQueryHistory({
      query_type: 'cypher',
      query_text: query,
      query_name: name,
      is_favorite: true,
    });
    toast.success('Query saved');
    
    // Refresh history
    const history = await graphService.getQueryHistory({ limit: 20 });
    state.history = history;
  } catch {
    toast.error('Failed to save query');
  }
}

/**
 * Show AI modal
 */
function showAIModal(container: HTMLElement): void {
  const modal = container.querySelector('#ai-modal');
  if (modal) {
    modal.classList.remove('hidden');
    const input = modal.querySelector('textarea');
    if (input) input.focus();
  }
}

/**
 * Generate with AI
 */
async function generateWithAI(
  container: HTMLElement,
  state: BuilderState,
  editor: HTMLTextAreaElement,
  prompt: string
): Promise<void> {
  toast.info('Generating query...');

  try {
    const response = await graphService.query(`Generate a Cypher query for: ${prompt}. Return only the Cypher code, no explanation.`);
    
    // Extract Cypher from response
    let cypher = response.answer;
    
    // Try to extract code block if present
    const codeMatch = cypher.match(/```(?:cypher)?\s*([\s\S]*?)```/);
    if (codeMatch) {
      cypher = codeMatch[1].trim();
    }

    editor.value = cypher;
    state.query = cypher;
    updateLineNumbers(container, editor);
    toast.success('Query generated');
  } catch {
    toast.error('Failed to generate query');
  }
}

/**
 * Update line numbers
 */
function updateLineNumbers(container: HTMLElement, editor: HTMLTextAreaElement): void {
  const lineNumbers = container.querySelector('#line-numbers') as HTMLElement;
  if (!lineNumbers) return;

  const lines = editor.value.split('\n').length;
  lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join('');
}

/**
 * Format Cypher query
 */
function formatCypher(query: string): string {
  // Basic formatting - uppercase keywords
  const keywords = ['MATCH', 'WHERE', 'RETURN', 'WITH', 'ORDER BY', 'LIMIT', 'SKIP', 'CREATE', 'DELETE', 'SET', 'REMOVE', 'MERGE', 'CALL', 'YIELD', 'UNWIND', 'UNION', 'OPTIONAL MATCH', 'DETACH DELETE', 'AS', 'AND', 'OR', 'NOT', 'IN', 'CONTAINS', 'STARTS WITH', 'ENDS WITH', 'IS NULL', 'IS NOT NULL', 'DESC', 'ASC'];
  
  let formatted = query;
  keywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    formatted = formatted.replace(regex, kw);
  });

  // Add newlines before main clauses
  const mainClauses = ['MATCH', 'OPTIONAL MATCH', 'WHERE', 'WITH', 'RETURN', 'ORDER BY', 'LIMIT', 'CREATE', 'DELETE', 'SET', 'MERGE', 'CALL', 'UNION'];
  mainClauses.forEach(clause => {
    const regex = new RegExp(`\\b(${clause})\\b`, 'g');
    formatted = formatted.replace(regex, '\n$1');
  });

  return formatted.trim();
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '<span class="null-value">null</span>';
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `<span class="array-value">[${value.length} items]</span>`;
    }
    const obj = value as Record<string, unknown>;
    if (obj.name || obj.label) {
      return escapeHtml(String(obj.name || obj.label));
    }
    return `<span class="object-value">{...}</span>`;
  }
  if (typeof value === 'boolean') {
    return `<span class="boolean-value">${value}</span>`;
  }
  if (typeof value === 'number') {
    return `<span class="number-value">${value}</span>`;
  }
  return escapeHtml(String(value));
}

/**
 * Format time
 */
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createQueryBuilder;
