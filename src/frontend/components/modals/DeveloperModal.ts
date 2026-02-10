/**
 * Developer Modal Component
 * Developer tools and debugging options
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { appStore } from '../../stores/app';
import { dataStore } from '../../stores/data';
import { uiStore } from '../../stores/ui';
import { http, fetchWithProject } from '../../services/api';
import { toast } from '../../services/toast';

const MODAL_ID = 'developer-modal';

type DevTab = 'info' | 'logs' | 'cache' | 'api';

/**
 * Show developer modal
 */
export function showDeveloperModal(): void {
  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'developer-modal-content' });
  
  let currentTab: DevTab = 'info';

  function render(): void {
    content.innerHTML = `
      <div class="dev-tabs">
        <button class="dev-tab ${currentTab === 'info' ? 'active' : ''}" data-tab="info">Info</button>
        <button class="dev-tab ${currentTab === 'logs' ? 'active' : ''}" data-tab="logs">Logs</button>
        <button class="dev-tab ${currentTab === 'cache' ? 'active' : ''}" data-tab="cache">Cache</button>
        <button class="dev-tab ${currentTab === 'api' ? 'active' : ''}" data-tab="api">API Test</button>
      </div>
      <div class="dev-content">
        ${renderTabContent(currentTab)}
      </div>
    `;

    // Bind tab clicks
    content.querySelectorAll('.dev-tab').forEach(tab => {
      on(tab as HTMLElement, 'click', () => {
        currentTab = tab.getAttribute('data-tab') as DevTab;
        render();
      });
    });

    // Bind actions
    bindActions(content);
  }

  render();

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });
  const closeBtn = createElement('button', {
    className: 'btn btn-secondary',
    textContent: 'Close',
  });
  on(closeBtn, 'click', () => closeModal(MODAL_ID));
  footer.appendChild(closeBtn);

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: 'Developer Tools',
    content,
    size: 'lg',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);
}

/**
 * Render tab content
 */
function renderTabContent(tab: DevTab): string {
  switch (tab) {
    case 'info':
      return renderInfoTab();
    case 'logs':
      return renderLogsTab();
    case 'cache':
      return renderCacheTab();
    case 'api':
      return renderApiTab();
  }
}

/**
 * Render info tab
 */
function renderInfoTab(): string {
  const appState = appStore.getState();
  const dataState = dataStore.getState();
  const uiState = uiStore.getState();

  return `
    <div class="dev-section">
      <h4>Application State</h4>
      <pre class="code-block">${JSON.stringify({
        projectId: appState.currentProjectId,
        user: appState.currentUser?.email,
        authConfigured: appState.authConfigured,
      }, null, 2)}</pre>
    </div>
    
    <div class="dev-section">
      <h4>Data Counts</h4>
      <table class="dev-table">
        <tr><td>Questions</td><td>${dataState.questions.length}</td></tr>
        <tr><td>Risks</td><td>${dataState.risks.length}</td></tr>
        <tr><td>Actions</td><td>${dataState.actions.length}</td></tr>
        <tr><td>Decisions</td><td>${dataState.decisions.length}</td></tr>
        <tr><td>Contacts</td><td>${dataState.contacts.length}</td></tr>
        <tr><td>Chat Messages</td><td>${dataState.chatHistory.length}</td></tr>
      </table>
    </div>
    
    <div class="dev-section">
      <h4>UI State</h4>
      <pre class="code-block">${JSON.stringify({
        currentTab: uiState.currentTab,
        sotView: uiState.sotCurrentView,
        sidebarOpen: uiState.sidebarOpen,
        modalOpen: uiState.modalOpen,
      }, null, 2)}</pre>
    </div>
    
    <div class="dev-section">
      <h4>Environment</h4>
      <table class="dev-table">
        <tr><td>User Agent</td><td>${navigator.userAgent.slice(0, 50)}...</td></tr>
        <tr><td>Screen</td><td>${window.innerWidth}x${window.innerHeight}</td></tr>
        <tr><td>Theme</td><td>${document.documentElement.getAttribute('data-theme')}</td></tr>
      </table>
    </div>
  `;
}

/**
 * Render logs tab
 */
function renderLogsTab(): string {
  return `
    <div class="dev-section">
      <h4>Console Logs</h4>
      <p class="text-muted">Open browser DevTools (F12) to view console logs.</p>
      <div class="dev-actions">
        <button class="btn btn-secondary btn-sm" data-action="clear-console">Clear Console</button>
        <button class="btn btn-secondary btn-sm" data-action="log-state">Log State</button>
      </div>
    </div>
    
    <div class="dev-section">
      <h4>Performance</h4>
      <table class="dev-table">
        <tr><td>Page Load</td><td>${Math.round(performance.now())}ms</td></tr>
        <tr><td>Memory</td><td>${getMemoryUsage()}</td></tr>
      </table>
    </div>
  `;
}

/**
 * Render cache tab
 */
function renderCacheTab(): string {
  const keys = Object.keys(localStorage);
  const totalSize = keys.reduce((acc, key) => acc + (localStorage.getItem(key)?.length || 0), 0);

  return `
    <div class="dev-section">
      <h4>LocalStorage</h4>
      <p>Items: ${keys.length} | Size: ${formatBytes(totalSize * 2)}</p>
      <div class="dev-actions">
        <button class="btn btn-danger btn-sm" data-action="clear-storage">Clear All Storage</button>
        <button class="btn btn-secondary btn-sm" data-action="export-storage">Export Storage</button>
      </div>
      <div class="storage-list">
        ${keys.map(key => `
          <div class="storage-item">
            <span class="storage-key">${key}</span>
            <span class="storage-size">${formatBytes((localStorage.getItem(key)?.length || 0) * 2)}</span>
            <button class="btn-sm btn-danger" data-action="delete-key" data-key="${key}">×</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Render API tab
 */
function renderApiTab(): string {
  return `
    <div class="dev-section">
      <h4>API Test</h4>
      <div class="form-group">
        <label>Endpoint</label>
        <div class="input-group">
          <select id="api-method" class="form-control api-method-select">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          <input type="text" id="api-endpoint" class="form-control" value="/api/health" placeholder="/api/...">
        </div>
      </div>
      <div class="form-group">
        <label>Body (JSON)</label>
        <textarea id="api-body" class="form-control" rows="3" placeholder='{"key": "value"}'></textarea>
      </div>
      <button class="btn btn-primary" data-action="test-api">Send Request</button>
    </div>
    
    <div class="dev-section">
      <h4>Response</h4>
      <pre id="api-response" class="code-block">No request sent yet</pre>
    </div>
  `;
}

/**
 * Bind action handlers
 */
function bindActions(container: HTMLElement): void {
  container.querySelectorAll('[data-action]').forEach(el => {
    const action = el.getAttribute('data-action');
    
    on(el as HTMLElement, 'click', async () => {
      switch (action) {
        case 'clear-console':
          console.clear();
          toast.success('Console cleared');
          break;
          
        case 'log-state':
          console.group('Application State');
          console.log('App:', appStore.getState());
          console.log('Data:', dataStore.getState());
          console.log('UI:', uiStore.getState());
          console.groupEnd();
          toast.success('State logged to console');
          break;
          
        case 'clear-storage':
          localStorage.clear();
          toast.success('Storage cleared');
          location.reload();
          break;
          
        case 'export-storage':
          const data = { ...localStorage };
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'localstorage-backup.json';
          a.click();
          toast.success('Storage exported');
          break;
          
        case 'delete-key':
          const key = el.getAttribute('data-key');
          if (key) {
            localStorage.removeItem(key);
            toast.success(`Removed: ${key}`);
            showDeveloperModal(); // Refresh
          }
          break;
          
        case 'test-api':
          await testApi(container);
          break;
      }
    });
  });
}

/**
 * Test API endpoint
 */
async function testApi(container: HTMLElement): Promise<void> {
  const method = (container.querySelector('#api-method') as HTMLSelectElement).value;
  const endpoint = (container.querySelector('#api-endpoint') as HTMLInputElement).value;
  const bodyText = (container.querySelector('#api-body') as HTMLTextAreaElement).value;
  const responseEl = container.querySelector('#api-response') as HTMLPreElement;

  responseEl.textContent = 'Loading...';

  try {
    const options: RequestInit = { method };
    if (bodyText && method !== 'GET') {
      options.body = bodyText;
      options.headers = { 'Content-Type': 'application/json' };
    }

    const start = performance.now();
    const response = await fetchWithProject(endpoint, options);
    const elapsed = Math.round(performance.now() - start);
    const data = await response.json().catch(() => response.text());

    responseEl.textContent = `Status: ${response.status} (${elapsed}ms)\n\n${JSON.stringify(data, null, 2)}`;
  } catch (error) {
    responseEl.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Get memory usage
 */
function getMemoryUsage(): string {
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
  if (perf.memory) {
    return formatBytes(perf.memory.usedJSHeapSize);
  }
  return 'N/A';
}

/**
 * Format bytes
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default showDeveloperModal;
