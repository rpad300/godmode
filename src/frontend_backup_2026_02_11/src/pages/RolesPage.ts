/**
 * Roles Panel - SOTA Design
 * Manage role templates with AI-enhanced context
 * Note: User permissions are managed separately per member in MembersPanel
 */

import { on } from '@lib/dom';
import { http } from '@services/api';
import { toast } from '@services/toast';

interface Role {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  role_context?: string;
  color?: string;
  category?: string;
  is_template?: boolean;
  is_system?: boolean;
  created_at?: string;
}

const ROLE_CATEGORIES = [
  { id: 'project', name: 'Project', icon: '📋', examples: 'Project Manager, Scrum Master, Product Owner' },
  { id: 'technical', name: 'Technical', icon: '💻', examples: 'Developer, Architect, DevOps, QA' },
  { id: 'management', name: 'Management', icon: '👔', examples: 'Director, VP, C-Level' },
  { id: 'stakeholder', name: 'Stakeholder', icon: '🤝', examples: 'Client, Sponsor, External Partner' },
  { id: 'custom', name: 'Custom', icon: '✨', examples: 'Custom roles for your team' },
];

let currentRoles: Role[] = [];
let editingRole: Role | null = null;

/**
 * Render Roles Panel
 */
export async function renderRolesPanel(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <style>
      .roles-panel-sota {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
      }
      
      .roles-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
      }
      
      .roles-header h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .roles-header h2 svg {
        width: 28px;
        height: 28px;
        color: #e11d48;
      }
      
      .roles-header-subtitle {
        font-size: 14px;
        color: var(--text-secondary);
        margin-top: 4px;
        font-weight: 400;
      }
      
      .btn-create-role {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 14px rgba(225, 29, 72, 0.3);
      }
      
      .btn-create-role:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(225, 29, 72, 0.4);
      }
      
      .roles-layout {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 24px;
      }
      
      @media (max-width: 900px) {
        .roles-layout {
          grid-template-columns: 1fr;
        }
      }
      
      .roles-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .role-card {
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
      }
      
      .role-card:hover {
        border-color: #e11d48;
        transform: translateX(4px);
      }
      
      .role-card.active {
        border-color: #e11d48;
        background: linear-gradient(135deg, rgba(225,29,72,0.08) 0%, rgba(225,29,72,0.03) 100%);
      }
      
      .role-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }
      
      .role-color-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      
      .role-card-name {
        font-weight: 600;
        color: var(--text-primary);
        flex: 1;
      }
      
      .role-card-badges {
        display: flex;
        gap: 4px;
      }
      
      .role-badge {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
      }
      
      .role-badge.template {
        background: #dbeafe;
        color: #1d4ed8;
      }
      
      .role-badge.system {
        background: #fef3c7;
        color: #92400e;
      }
      
      .role-card-category {
        font-size: 11px;
        color: var(--text-muted);
        margin-bottom: 4px;
      }
      
      .role-card-desc {
        font-size: 13px;
        color: var(--text-secondary);
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      
      /* Editor Panel */
      .role-editor {
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 20px;
        overflow: hidden;
      }
      
      .role-editor-header {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        padding: 24px;
        color: white;
      }
      
      .role-editor-header h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
      }
      
      .role-editor-body {
        padding: 24px;
      }
      
      .form-row {
        display: flex;
        gap: 16px;
        margin-bottom: 20px;
      }
      
      .form-group {
        flex: 1;
      }
      
      .form-group label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        margin-bottom: 8px;
      }
      
      .form-group input,
      .form-group textarea,
      .form-group select {
        width: 100%;
        padding: 12px 16px;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        font-size: 14px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        transition: all 0.2s;
        box-sizing: border-box;
      }
      
      .form-group input:focus,
      .form-group textarea:focus,
      .form-group select:focus {
        outline: none;
        border-color: #e11d48;
        box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.1);
      }
      
      .form-group textarea {
        resize: vertical;
        min-height: 80px;
      }
      
      .form-hint {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 6px;
      }
      
      .ai-enhance-section {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        margin-top: 12px;
      }
      
      .ai-enhance-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }
      
      .ai-enhance-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
      }
      
      .ai-enhance-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }
      
      .ai-enhance-btn svg {
        width: 14px;
        height: 14px;
      }
      
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      .spin {
        animation: spin 1s linear infinite;
      }
      
      /* Actions */
      .role-editor-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid var(--border-color);
      }
      
      .btn {
        padding: 12px 24px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }
      
      .btn-secondary {
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }
      
      .btn-secondary:hover {
        background: var(--bg-tertiary);
      }
      
      .btn-primary {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        color: white;
        box-shadow: 0 4px 14px rgba(225, 29, 72, 0.3);
      }
      
      .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(225, 29, 72, 0.4);
      }
      
      .btn-danger {
        background: #fee2e2;
        color: #dc2626;
      }
      
      .btn-danger:hover {
        background: #fecaca;
      }
      
      .template-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 20px;
        padding: 14px 16px;
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        border: 1px solid #86efac;
        border-radius: 12px;
      }
      
      .template-toggle label {
        margin: 0;
        font-size: 13px;
        color: #166534;
        font-weight: 500;
      }
      
      .template-toggle input {
        accent-color: #16a34a;
        width: 18px;
        height: 18px;
      }
      
      .empty-state {
        text-align: center;
        padding: 48px;
        color: var(--text-muted);
      }
      
      .empty-state svg {
        width: 64px;
        height: 64px;
        opacity: 0.3;
        margin-bottom: 16px;
      }
      
      .info-card {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border: 1px solid #93c5fd;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 20px;
      }
      
      .info-card h4 {
        margin: 0 0 8px;
        font-size: 14px;
        color: #1e40af;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .info-card p {
        margin: 0;
        font-size: 13px;
        color: #3b82f6;
        line-height: 1.5;
      }
    </style>
    
    <div class="roles-panel-sota">
      <div class="roles-header">
        <div>
          <h2>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
            </svg>
            Role Templates
          </h2>
          <div class="roles-header-subtitle">Define roles to assign to team members and contacts. The AI uses role context to adapt responses.</div>
        </div>
        <button class="btn-create-role" id="btn-create-role">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Create Role
        </button>
      </div>
      
      <div class="roles-layout">
        <div class="roles-list" id="roles-list">
          <div class="empty-state">Loading roles...</div>
        </div>
        
        <div class="role-editor hidden" id="role-editor">
          <!-- Editor content will be rendered here -->
        </div>
      </div>
    </div>
  `;

  // Load roles
  await loadRoles(container);

  // Bind create button
  const createBtn = container.querySelector('#btn-create-role');
  if (createBtn) {
    on(createBtn as HTMLElement, 'click', () => {
      editingRole = null;
      showRoleEditor(container, null);
    });
  }
}

/**
 * Load roles from API
 */
async function loadRoles(container: HTMLElement): Promise<void> {
  const listEl = container.querySelector('#roles-list') as HTMLElement;
  if (!listEl) return;

  try {
    // Load role templates
    const response = await http.get<{ roles: Role[] }>('/api/role-templates');
    currentRoles = response.data.roles || [];

    if (currentRoles.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197"/>
          </svg>
          <p>No roles defined yet</p>
          <p class="empty-state-hint">Click "Create Role" to get started</p>
        </div>
      `;
      return;
    }

    renderRolesList(listEl, container);
  } catch (error) {
    console.error('[RolesPanel] Failed to load roles:', error);
    listEl.innerHTML = `<div class="empty-state">Failed to load roles</div>`;
  }
}

/**
 * Render roles list
 */
function renderRolesList(listEl: HTMLElement, container: HTMLElement): void {
  const categoryMap = Object.fromEntries(ROLE_CATEGORIES.map(c => [c.id, c]));

  listEl.innerHTML = currentRoles.map(role => {
    const cat = categoryMap[role.category || 'custom'];
    return `
      <div class="role-card${editingRole?.id === role.id ? ' active' : ''}" data-id="${role.id}">
        <div class="role-card-header">
          <div class="role-color-dot" style="--role-color: ${role.color || '#e11d48'}"></div>
          <div class="role-card-name">${escapeHtml(role.display_name || role.name)}</div>
          <div class="role-card-badges">
            ${role.is_template ? '<span class="role-badge template">Template</span>' : ''}
            ${role.is_system ? '<span class="role-badge system">System</span>' : ''}
          </div>
        </div>
        <div class="role-card-category">${cat?.icon || '✨'} ${cat?.name || 'Custom'}</div>
        ${role.description ? `<div class="role-card-desc">${escapeHtml(role.description)}</div>` : ''}
      </div>
    `;
  }).join('');

  // Bind click events
  listEl.querySelectorAll('.role-card').forEach(card => {
    on(card as HTMLElement, 'click', () => {
      const roleId = card.getAttribute('data-id');
      const role = currentRoles.find(r => r.id === roleId);
      if (role) {
        editingRole = role;
        listEl.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        showRoleEditor(container, role);
      }
    });
  });
}

/**
 * Show role editor
 */
function showRoleEditor(container: HTMLElement, role: Role | null): void {
  const editorEl = container.querySelector('#role-editor') as HTMLElement;
  if (!editorEl) return;

  editorEl.classList.remove('hidden');

  const isNew = !role;

  editorEl.innerHTML = `
    <div class="role-editor-header">
      <h3>${isNew ? 'Create New Role' : 'Edit Role'}</h3>
    </div>
    
    <div class="role-editor-body">
      <div class="info-card">
        <h4>💡 How Role Templates Work</h4>
        <p>Role templates define job titles and context that helps the AI understand each person's perspective. When you assign a role to a team member or contact, the AI adapts its responses to be more relevant to their responsibilities.</p>
      </div>
      
      <form id="role-form">
        <div class="form-row">
          <div class="form-group role-form-flex-2">
            <label>Role Name *</label>
            <input type="text" id="role-name" required value="${escapeHtml(role?.display_name || role?.name || '')}" placeholder="e.g., Project Manager, Senior Developer">
          </div>
          <div class="form-group role-form-flex-1">
            <label>Category</label>
            <select id="role-category">
              ${ROLE_CATEGORIES.map(cat => `
                <option value="${cat.id}" ${role?.category === cat.id ? 'selected' : ''}>${cat.icon} ${cat.name}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group role-form-w-80">
            <label>Color</label>
            <input type="color" id="role-color" class="role-color-input" value="${role?.color || '#e11d48'}">
          </div>
        </div>
        
        <div class="form-group">
          <label>Description</label>
          <textarea id="role-description" rows="2" placeholder="Brief description of this role's main responsibilities...">${escapeHtml(role?.description || '')}</textarea>
          <div class="form-hint">A short summary shown in role lists and dropdowns.</div>
        </div>
        
        <div class="form-group">
          <label>Role Context (for AI)</label>
          <textarea id="role-context" rows="6" placeholder="Describe this role in detail for the AI:&#10;&#10;• What are their main responsibilities?&#10;• What decisions do they typically make?&#10;• What information is most relevant to them?&#10;• How should the AI adapt its tone and detail level?">${escapeHtml(role?.role_context || '')}</textarea>
          <div class="form-hint">This context helps the AI provide more relevant and targeted responses when interacting with people in this role.</div>
          <div class="ai-enhance-section">
            <button type="button" class="ai-enhance-btn" id="btn-ai-enhance">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              Enhance with AI
            </button>
            <span class="form-hint role-form-hint-ai">Let AI generate or improve the role context based on the role name.</span>
          </div>
        </div>
        
        <div class="template-toggle">
          <input type="checkbox" id="is-template" ${role?.is_template !== false ? 'checked' : ''}>
          <label for="is-template">Save as template (reusable across all projects)</label>
        </div>
        
        <div class="role-editor-actions">
          ${!isNew && !role?.is_system ? `
            <button type="button" class="btn btn-danger" id="btn-delete-role">Delete</button>
          ` : ''}
          <button type="button" class="btn btn-secondary" id="btn-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">${isNew ? 'Create Role' : 'Save Changes'}</button>
        </div>
      </form>
    </div>
  `;

  bindEditorEvents(container, role);
}

/**
 * Bind editor events
 */
function bindEditorEvents(container: HTMLElement, role: Role | null): void {
  const editorEl = container.querySelector('#role-editor') as HTMLElement;
  if (!editorEl) return;

  // Cancel button
  const cancelBtn = editorEl.querySelector('#btn-cancel');
  if (cancelBtn) {
    on(cancelBtn as HTMLElement, 'click', () => {
      editorEl.classList.add('hidden');
      editingRole = null;
      const listEl = container.querySelector('#roles-list') as HTMLElement;
      if (listEl) {
        listEl.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
      }
    });
  }

  // Delete button
  const deleteBtn = editorEl.querySelector('#btn-delete-role');
  if (deleteBtn && role) {
    on(deleteBtn as HTMLElement, 'click', async () => {
      if (!confirm(`Are you sure you want to delete "${role.display_name || role.name}"?`)) return;

      try {
        await http.delete(`/api/role-templates/${role.id}`);
        toast.success('Role deleted');
        editorEl.classList.add('hidden');
        editingRole = null;
        await loadRoles(container);
      } catch {
        toast.error('Failed to delete role');
      }
    });
  }

  // AI Enhance button
  const aiBtn = editorEl.querySelector('#btn-ai-enhance');
  if (aiBtn) {
    on(aiBtn as HTMLElement, 'click', async () => {
      const nameInput = editorEl.querySelector('#role-name') as HTMLInputElement;
      const contextInput = editorEl.querySelector('#role-context') as HTMLTextAreaElement;
      const descInput = editorEl.querySelector('#role-description') as HTMLTextAreaElement;

      const roleName = nameInput.value.trim();
      if (!roleName) {
        toast.error('Please enter a role name first');
        return;
      }

      (aiBtn as HTMLButtonElement).disabled = true;
      aiBtn.innerHTML = `<svg class="spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Enhancing...`;

      try {
        const response = await http.post<{ prompt: string; description?: string }>('/api/roles/generate', {
          title: roleName,
          currentContext: contextInput.value,
        });

        if (response.data.prompt) {
          contextInput.value = response.data.prompt;
        }
        if (response.data.description && !descInput.value) {
          descInput.value = response.data.description;
        }
        toast.success('Role context enhanced with AI');
      } catch {
        toast.error('Failed to enhance with AI');
      } finally {
        (aiBtn as HTMLButtonElement).disabled = false;
        aiBtn.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Enhance with AI`;
      }
    });
  }

  // Form submit
  const form = editorEl.querySelector('#role-form') as HTMLFormElement;
  if (form) {
    on(form, 'submit', async (e) => {
      e.preventDefault();

      const name = (editorEl.querySelector('#role-name') as HTMLInputElement).value.trim();
      const category = (editorEl.querySelector('#role-category') as HTMLSelectElement).value;
      const color = (editorEl.querySelector('#role-color') as HTMLInputElement).value;
      const description = (editorEl.querySelector('#role-description') as HTMLTextAreaElement).value.trim();
      const roleContext = (editorEl.querySelector('#role-context') as HTMLTextAreaElement).value.trim();
      const isTemplate = (editorEl.querySelector('#is-template') as HTMLInputElement).checked;

      const roleData = {
        name: name.toLowerCase().replace(/\s+/g, '_'),
        display_name: name,
        description,
        role_context: roleContext,
        category,
        color,
        is_template: isTemplate,
      };

      try {
        if (role) {
          await http.put(`/api/role-templates/${role.id}`, roleData);
          toast.success('Role updated');
        } else {
          await http.post('/api/role-templates', roleData);
          toast.success('Role created');
        }

        editorEl.classList.add('hidden');
        editingRole = null;
        await loadRoles(container);
      } catch {
        toast.error('Failed to save role');
      }
    });
  }
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default renderRolesPanel;
