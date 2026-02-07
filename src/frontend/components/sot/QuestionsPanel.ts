/**
 * Questions Panel Component
 * Displays and manages questions in the Source of Truth
 * Updated to support detail view instead of modal
 */

import { createElement, on } from '../../utils/dom';
import { questionsService, Question } from '../../services/questions';
import { dataStore } from '../../stores/data';
import { showQuestionModal } from '../modals/QuestionModal';
import { createQuestionDetailView } from '../questions/QuestionDetailView';
import { toast } from '../../services/toast';
import { formatRelativeTime } from '../../utils/format';
import { http } from '../../services/api';

export interface QuestionsPanelProps {
  onQuestionClick?: (question: Question) => void;
  useDetailView?: boolean; // If true, replace panel with detail view instead of modal
  containerElement?: HTMLElement; // Parent container for detail view replacement
}

let currentFilter: string = 'all';
let currentView: 'status' | 'person' | 'team' = 'status';

/**
 * Create questions panel
 */
export function createQuestionsPanel(props: QuestionsPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'sot-panel questions-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Questions</h2>
        <span class="panel-count" id="questions-count">0</span>
      </div>
      <div class="panel-actions">
        <select id="questions-filter" class="filter-select">
          <option value="all">All Active</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="critical">Critical Priority</option>
          <option value="overdue">Overdue (SLA)</option>
          <option value="resolved">✓ Resolved</option>
          <option value="dismissed">✗ Dismissed</option>
        </select>
        <div class="view-tabs">
          <button class="view-tab active" data-view="status">By Status</button>
          <button class="view-tab" data-view="person">By Person</button>
          <button class="view-tab" data-view="team">By Team</button>
        </div>
        <button class="btn btn-secondary btn-sm" id="generate-team-btn" title="Generate questions for team based on roles">⚡ Generate</button>
        <button class="btn btn-primary btn-sm" id="add-question-btn">+ Add</button>
      </div>
    </div>
    <div class="panel-content" id="questions-content">
      <div class="loading">Loading questions...</div>
    </div>
  `;

  // Bind events
  const filterSelect = panel.querySelector('#questions-filter') as HTMLSelectElement;
  on(filterSelect, 'change', () => {
    currentFilter = filterSelect.value;
    loadQuestions(panel, props);
  });

  const viewTabs = panel.querySelectorAll('.view-tab');
  viewTabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      viewTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.getAttribute('data-view') as 'status' | 'person' | 'team';
      loadQuestions(panel, props);
    });
  });

  const addBtn = panel.querySelector('#add-question-btn');
  if (addBtn) {
    on(addBtn as HTMLElement, 'click', () => {
      showQuestionModal({
        mode: 'create',
        onSave: () => loadQuestions(panel, props),
      });
    });
  }

  // Generate for team button
  const generateBtn = panel.querySelector('#generate-team-btn');
  if (generateBtn) {
    on(generateBtn as HTMLElement, 'click', () => showGenerateForTeamDialog(panel, props));
  }

  // Initial load
  loadQuestions(panel, props);

  // Subscribe to data changes
  dataStore.subscribe(() => {
    updateCount(panel);
  });

  return panel;
}

/**
 * Load questions
 */
async function loadQuestions(panel: HTMLElement, props: QuestionsPanelProps): Promise<void> {
  const content = panel.querySelector('#questions-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    let questions: Question[] = [];

    if (currentView === 'status') {
      // Handle special filters
      if (currentFilter === 'overdue') {
        // Get all pending/assigned questions and filter by SLA breach
        questions = await questionsService.getAll();
        questions = questions.filter(q => 
          q.sla_breached === true || 
          (q.status !== 'resolved' && q.status !== 'dismissed' && isOverdue(q))
        );
      } else if (currentFilter === 'critical') {
        // Filter by critical priority
        questions = await questionsService.getAll();
        questions = questions.filter(q => q.priority === 'critical' && q.status !== 'resolved' && q.status !== 'dismissed');
      } else if (currentFilter === 'all') {
        // "All" means all ACTIVE questions - exclude dismissed/resolved
        questions = await questionsService.getAll();
        questions = questions.filter(q => q.status !== 'dismissed' && q.status !== 'resolved' && q.status !== 'closed');
      } else if (currentFilter === 'dismissed') {
        // Specifically show dismissed questions
        questions = await questionsService.getAll();
        questions = questions.filter(q => q.status === 'dismissed');
      } else if (currentFilter === 'resolved') {
        // Specifically show resolved/answered questions
        questions = await questionsService.getAll();
        questions = questions.filter(q => q.status === 'resolved' || q.status === 'answered');
      } else {
        // Filter by specific status (pending, assigned, etc.)
        questions = await questionsService.getAll();
        questions = questions.filter(q => q.status === currentFilter);
      }
      renderByStatus(content, questions, props);
    } else if (currentView === 'person') {
      const grouped = await questionsService.getByPerson();
      renderGrouped(content, grouped, props);
    } else if (currentView === 'team') {
      const grouped = await questionsService.getByTeam();
      renderGrouped(content, grouped, props);
    }

    // Update store
    if (currentView === 'status') {
      dataStore.setQuestions(questions as unknown as []);
    }

    updateCount(panel);
  } catch (error) {
    content.innerHTML = '<div class="error">Failed to load questions</div>';
  }
}

/**
 * Check if a question is overdue based on SLA
 */
function isOverdue(question: Question): boolean {
  if (!question.created_at) return false;
  const slaHours = question.sla_hours || 168; // 7 days default
  const created = new Date(question.created_at);
  const deadline = new Date(created.getTime() + slaHours * 60 * 60 * 1000);
  return new Date() > deadline;
}

/**
 * Render questions by status
 */
function renderByStatus(container: HTMLElement, questions: Question[], props: QuestionsPanelProps): void {
  if (questions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No questions found</p>
        <button class="btn btn-primary" id="empty-add-btn">Add Question</button>
      </div>
    `;
    const addBtn = container.querySelector('#empty-add-btn');
    if (addBtn) {
      on(addBtn as HTMLElement, 'click', () => {
        showQuestionModal({ mode: 'create' });
      });
    }
    return;
  }

  container.innerHTML = questions.map(q => createQuestionCard(q)).join('');
  bindCardEvents(container, questions, props);
}

/**
 * Render grouped questions
 */
function renderGrouped(
  container: HTMLElement,
  grouped: Record<string, Question[]>,
  props: QuestionsPanelProps
): void {
  const groups = Object.entries(grouped);
  
  if (groups.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No questions found</p></div>';
    return;
  }

  container.innerHTML = groups.map(([groupName, questions]) => `
    <div class="question-group">
      <div class="group-header">
        <h3>${escapeHtml(groupName)}</h3>
        <span class="group-count">${questions.length}</span>
      </div>
      <div class="group-items">
        ${questions.map(q => createQuestionCard(q)).join('')}
      </div>
    </div>
  `).join('');

  // Flatten for event binding
  const allQuestions = groups.flatMap(([, qs]) => qs);
  bindCardEvents(container, allQuestions, props);
}

/**
 * Create question card HTML - SOTA Design
 */
function createQuestionCard(question: Question): string {
  const priorityClass = `priority-${question.priority}`;
  const statusClass = `status-${question.status}`;
  const slaBreached = question.sla_breached;
  const autoDetected = question.answer_source === 'auto-detected';
  const hasAnswer = !!question.answer;
  const hasRequesterRole = !!question.requester_role;

  // Get initials for avatar
  const getInitials = (name: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length === 1 
      ? parts[0].substring(0, 2).toUpperCase() 
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Build the card HTML
  let html = `<div class="question-card-sota${slaBreached ? ' sla-breached' : ''}${hasAnswer ? ' has-answer' : ''}" data-id="${question.id}">`;
  
  // Priority Bar
  html += `<div class="card-priority-bar ${priorityClass}"></div>`;
  
  // Card Body
  html += `<div class="card-body">`;
  
  // Top Row
  html += `<div class="card-top-row">`;
  html += `<div class="card-badges">`;
  html += `<span class="priority-pill ${priorityClass}">${question.priority}</span>`;
  html += `<span class="status-pill ${statusClass}">${question.status}</span>`;
  if (slaBreached) html += `<span class="sla-pill">SLA</span>`;
  if (autoDetected) html += `<span class="auto-pill">Answer Found</span>`;
  if (question.follow_up_to) html += `<span class="followup-pill">Follow-up</span>`;
  html += `</div>`; // .card-badges
  html += `<span class="card-timestamp">${formatRelativeTime(question.created_at)}</span>`;
  html += `</div>`; // .card-top-row
  
  // Question Text
  html += `<div class="card-question-text">${escapeHtml(question.content)}</div>`;
  
  // Bottom Row
  html += `<div class="card-bottom-row">`;
  
  // Get contacts for photo lookup
  const contacts = dataStore.getState().contacts || [];
  
  // Helper to get photo URL
  const getPhotoUrl = (name: string, contactId?: string): string | null => {
    const contact = contactId 
      ? contacts.find((c: any) => c.id === contactId)
      : contacts.find((c: any) => c.name === name);
    return contact?.photoUrl || contact?.avatarUrl || contact?.photo_url || contact?.avatar_url || null;
  };
  
  // Helper to render avatar (photo or initials)
  const renderAvatar = (name: string, photoUrl: string | null, cssClass: string): string => {
    if (photoUrl) {
      return `<div class="${cssClass}"><img src="${photoUrl}" alt="${escapeHtml(name)}" onerror="this.parentElement.innerHTML='${getInitials(name)}'"></div>`;
    }
    return `<div class="${cssClass}">${getInitials(name)}</div>`;
  };
  
  // Left: Requester (who is asking) - shows avatar + name + role
  html += `<div class="card-requester">`;
  if (hasRequesterRole) {
    const requesterName = (question as any).requester_name || '';
    const requesterRole = question.requester_role || '';
    const requesterContactId = (question as any).requester_contact_id;
    const requesterPhotoUrl = getPhotoUrl(requesterName, requesterContactId);
    
    html += `<div class="requester-chip">`;
    html += renderAvatar(requesterName || requesterRole, requesterPhotoUrl, 'requester-avatar');
    html += `<div class="requester-info">`;
    if (requesterName) {
      html += `<span class="requester-name">${escapeHtml(requesterName)}</span>`;
    }
    html += `<span class="requester-role">${escapeHtml(requesterRole)}</span>`;
    html += `</div>`;
    html += `</div>`;
  }
  html += `</div>`; // .card-requester
  
  // Right: Assignment (who should answer) - shows avatar + name
  html += `<div class="card-assignment">`;
  if (question.assigned_to) {
    const assigneePhotoUrl = getPhotoUrl(question.assigned_to);
    
    html += `<div class="assignee-chip">`;
    html += renderAvatar(question.assigned_to, assigneePhotoUrl, 'assignee-avatar');
    html += `<div class="assignee-info">`;
    html += `<span class="assignee-name">${escapeHtml(question.assigned_to)}</span>`;
    if (hasAnswer) html += `<span class="answered-badge">Answered</span>`;
    html += `</div>`;
    html += `</div>`;
  } else {
    html += `<div class="unassigned-chip">`;
    html += `<span>Unassigned</span>`;
    html += `</div>`;
  }
  html += `</div>`; // .card-assignment
  
  html += `</div>`; // .card-bottom-row
  html += `</div>`; // .card-body
  html += `</div>`; // .question-card-sota
  
  return html;
}

/**
 * Bind card click events
 */
function bindCardEvents(container: HTMLElement, questions: Question[], props: QuestionsPanelProps): void {
  container.querySelectorAll('.question-card-sota').forEach(card => {
    on(card as HTMLElement, 'click', () => {
      const id = card.getAttribute('data-id');
      const question = questions.find(q => String(q.id) === id);
      if (question) {
        if (props.onQuestionClick) {
          props.onQuestionClick(question);
        } else if (props.useDetailView && props.containerElement) {
          // Replace panel with detail view
          showQuestionDetailView(question, props);
        } else {
          // Fallback to modal
          showQuestionModal({
            mode: 'view',
            question,
            onSave: () => loadQuestions(container.closest('.questions-panel') as HTMLElement, props),
          });
        }
      }
    });
  });
}

/**
 * Show question detail view (replaces panel content)
 */
function showQuestionDetailView(question: Question, props: QuestionsPanelProps): void {
  const containerEl = props.containerElement;
  if (!containerEl) return;

  // Store current panel content for restoration
  const panelContent = containerEl.innerHTML;

  // Create detail view
  const detailView = createQuestionDetailView({
    question,
    onClose: () => {
      // Restore panel content
      containerEl.innerHTML = panelContent;
      // Re-initialize the panel
      const panel = containerEl.querySelector('.questions-panel');
      if (panel) {
        loadQuestions(panel as HTMLElement, props);
      }
    },
    onUpdate: (updatedQuestion) => {
      // If question was dismissed/resolved, close detail view and refresh list
      if (updatedQuestion.status === 'dismissed' || updatedQuestion.status === 'resolved' || updatedQuestion.status === 'closed') {
        // Restore panel content and reload
        containerEl.innerHTML = panelContent;
        const panel = containerEl.querySelector('.questions-panel');
        if (panel) {
          loadQuestions(panel as HTMLElement, props);
        }
        toast.info('Question updated - returning to list');
      }
    },
    onNavigateToQuestion: async (questionId) => {
      // Navigate to another question
      try {
        const questions = await questionsService.getAll();
        const targetQuestion = questions.find(q => String(q.id) === questionId);
        if (targetQuestion) {
          showQuestionDetailView(targetQuestion, props);
        }
      } catch (e) {
        toast.error('Failed to load question');
      }
    }
  });

  // Replace content with detail view
  containerEl.innerHTML = '';
  containerEl.appendChild(detailView);
}

/**
 * Show AI-powered generate questions dialog (SOTA version)
 * Uses the universal modal-sota.css system
 */
async function showGenerateForTeamDialog(panel: HTMLElement, props: QuestionsPanelProps): Promise<void> {
  const modal = document.createElement('div');
  modal.className = 'modal open';
  modal.id = 'generate-ai-modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-container modal-sota">
      <!-- Header -->
      <div class="sota-header header-primary">
        <div class="header-row">
          <div class="header-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
              <circle cx="7.5" cy="14.5" r="1.5"/><circle cx="16.5" cy="14.5" r="1.5"/>
            </svg>
          </div>
          <div class="header-text">
            <h2>AI Question Generator</h2>
            <p>Generate contextual questions for your project team</p>
          </div>
        </div>
        <button class="header-close" id="close-modal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="sota-tabs">
        <button class="sota-tab active" data-source="team">
          <span class="tab-icon">👥</span>
          <span>Team Members</span>
        </button>
        <button class="sota-tab" data-source="contacts">
          <span class="tab-icon">📇</span>
          <span>Project Contacts</span>
        </button>
      </div>

      <!-- Body -->
      <div class="sota-body">
        <!-- Section: Roles -->
        <div class="sota-section">
          <div class="section-title">
            <span class="title-icon">🎭</span>
            <span>Select a Role</span>
          </div>
          <div id="roles-grid" class="sota-grid">
            <div class="sota-loading">
              <div class="spinner-ring"></div>
              <p>Loading roles...</p>
            </div>
          </div>
        </div>

        <!-- Section: Configuration (hidden until role selected) -->
        <div class="sota-section gm-hidden" id="config-section">
          <div id="selected-badge"></div>
          
          <div class="config-row">
            <label>Questions to generate</label>
            <div class="config-buttons">
              <button class="config-btn active" data-count="auto" title="AI determines optimal count">✨ Auto</button>
              <button class="config-btn" data-count="3">3</button>
              <button class="config-btn" data-count="5">5</button>
              <button class="config-btn" data-count="8">8</button>
            </div>
          </div>

          <label class="toggle-row">
            <input type="checkbox" id="use-context" checked>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span>Use project context (facts, documents)</span>
          </label>
          
          <label class="toggle-row">
            <input type="checkbox" id="skip-dupes" checked>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span>Skip duplicate questions</span>
          </label>

          <button class="sota-btn-primary sota-btn-generate" id="btn-generate">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Generate Questions
          </button>
        </div>
      </div>

      <!-- Overlay for generation -->
      <div class="sota-overlay gm-hidden" id="gen-overlay">
        <div id="gen-content">
          <div class="overlay-spinner"></div>
          <h4 class="overlay-title">Generating questions...</h4>
          <p class="overlay-subtitle">AI is analyzing your project context</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // State
  type RoleData = { role: string; rolePrompt?: string; members: Array<{ id: string; name: string; photoUrl?: string; email?: string }> };
  let currentSource: 'team' | 'contacts' = 'team';
  let selectedRole: RoleData | null = null;
  let allRoles: RoleData[] = [];
  let questionCount: number | 'auto' = 'auto';

  // Elements
  const rolesGrid = modal.querySelector('#roles-grid') as HTMLElement;
  const configSection = modal.querySelector('#config-section') as HTMLElement;
  const selectedBadge = modal.querySelector('#selected-badge') as HTMLElement;
  const genOverlay = modal.querySelector('#gen-overlay') as HTMLElement;
  const genContent = modal.querySelector('#gen-content') as HTMLElement;

  // Helpers
  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };
  
  const getRoleIcon = (role: string): string => {
    const r = role.toLowerCase();
    if (r.includes('analyst') || r.includes('data')) return '📊';
    if (r.includes('manager') || r.includes('lead')) return '👔';
    if (r.includes('developer') || r.includes('engineer')) return '💻';
    if (r.includes('design') || r.includes('ux')) return '🎨';
    if (r.includes('product') || r.includes('owner')) return '📦';
    if (r.includes('qa') || r.includes('test')) return '🧪';
    if (r.includes('support') || r.includes('success')) return '🤝';
    if (r.includes('sales') || r.includes('commercial')) return '💰';
    if (r.includes('marketing')) return '📣';
    if (r.includes('security')) return '🔒';
    if (r.includes('devops') || r.includes('infra')) return '🚀';
    if (r.includes('legal')) return '⚖️';
    return '👤';
  };

  // Load roles based on source
  const loadRoles = async (source: 'team' | 'contacts') => {
    rolesGrid.innerHTML = '<div class="sota-loading"><div class="spinner-ring"></div><p>Loading roles...</p></div>';
    configSection.classList.add('gm-hidden');
    selectedRole = null;

    try {
      let roles: RoleData[] = [];

      if (source === 'team') {
        const res = await http.get<{ roles: RoleData[] }>('/api/questions/team-roles');
        roles = res.data.roles || [];
      } else {
        // Load from contacts
        const res = await http.get<{ contacts: Array<{ id: string; name: string; role?: string; photo_url?: string; email?: string }> }>('/api/contacts');
        const contacts = res.data.contacts || [];
        
        // Group by role
        const roleMap: Record<string, RoleData> = {};
        for (const c of contacts) {
          if (!c.role) continue;
          if (!roleMap[c.role]) {
            roleMap[c.role] = { role: c.role, members: [] };
          }
          roleMap[c.role].members.push({
            id: c.id,
            name: c.name,
            photoUrl: c.photo_url,
            email: c.email
          });
        }
        roles = Object.values(roleMap);
      }

      allRoles = roles;

      if (roles.length === 0) {
        rolesGrid.innerHTML = `
          <div class="sota-empty sota-empty--full">
            <div class="empty-icon">${source === 'team' ? '👥' : '📇'}</div>
            <h4>No ${source === 'team' ? 'Team Members' : 'Contacts'} with Roles</h4>
            <p>${source === 'team' 
              ? 'Add team members with roles in Project Settings' 
              : 'Add contacts with roles to this project'}</p>
          </div>
        `;
        return;
      }

      rolesGrid.innerHTML = roles.map((r, idx) => `
        <div class="sota-card" data-idx="${idx}">
          <div class="card-icon">${getRoleIcon(r.role)}</div>
          <div class="card-title">${escapeHtml(r.role)}</div>
          <div class="card-avatars">
            ${r.members.slice(0, 3).map(m => `
              <div class="mini-avatar" title="${escapeHtml(m.name)}">
                ${m.photoUrl 
                  ? `<img src="${m.photoUrl}" alt="" onerror="this.classList.add('gm-hidden');this.parentElement?.querySelector('.mini-avatar-initials')?.classList.remove('gm-hidden')">`
                  : ''}
                <span class="mini-avatar-initials${m.photoUrl ? ' gm-hidden' : ''}">${getInitials(m.name)}</span>
              </div>
            `).join('')}
            ${r.members.length > 3 ? `<div class="mini-avatar more">+${r.members.length - 3}</div>` : ''}
          </div>
          <div class="card-subtitle">${r.members.map(m => m.name).slice(0, 2).join(', ')}${r.members.length > 2 ? '...' : ''}</div>
          <div class="card-badge">${r.members.length}</div>
        </div>
      `).join('');

      // Bind clicks
      rolesGrid.querySelectorAll('.sota-card').forEach(card => {
        card.addEventListener('click', () => {
          rolesGrid.querySelectorAll('.sota-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          
          const idx = parseInt(card.getAttribute('data-idx') || '0', 10);
          selectedRole = allRoles[idx];
          showConfig();
        });
      });

    } catch (err) {
      rolesGrid.innerHTML = `
        <div class="sota-empty sota-empty--full">
          <div class="empty-icon">⚠️</div>
          <h4>Failed to Load</h4>
          <p>Could not fetch roles. Please try again.</p>
          <button class="sota-btn-primary sota-btn--center" id="retry-load">Retry</button>
        </div>
      `;
      modal.querySelector('#retry-load')?.addEventListener('click', () => loadRoles(source));
    }
  };

  // Show config panel
  const showConfig = () => {
    if (!selectedRole) return;
    
    configSection.classList.remove('gm-hidden');
    selectedBadge.innerHTML = `
      <div class="selected-badge">
        <span class="badge-icon">${getRoleIcon(selectedRole.role)}</span>
        <div class="badge-info">
          <strong>${escapeHtml(selectedRole.role)}</strong>
          <span>${selectedRole.members.map(m => m.name).join(', ')}</span>
        </div>
        <button class="badge-clear" id="clear-selection">×</button>
      </div>
    `;

    modal.querySelector('#clear-selection')?.addEventListener('click', () => {
      selectedRole = null;
      configSection.classList.add('gm-hidden');
      rolesGrid.querySelectorAll('.sota-card').forEach(c => c.classList.remove('selected'));
    });
  };

  // Generate questions
  const generateQuestions = async () => {
    if (!selectedRole) return;

    genOverlay.classList.remove('gm-hidden');
    genOverlay.style.display = 'flex';

    try {
      const res = await http.post<{
        generated: number;
        skipped: number;
        questions: Array<{ content: string; priority: string; requester_role: string }>;
      }>('/api/questions/generate-ai', {
        role: selectedRole.role,
        memberIds: selectedRole.members.map(m => m.id),
        count: questionCount,
        includeContext: (modal.querySelector('#use-context') as HTMLInputElement)?.checked ?? true,
        skipDuplicates: (modal.querySelector('#skip-dupes') as HTMLInputElement)?.checked ?? true
      });

      const q = res.data.questions || [];

      genContent.innerHTML = `
        <div class="sota-success">
          <div class="success-icon">✓</div>
          <h4>${res.data.generated} Questions Generated</h4>
          <p>${res.data.skipped > 0 ? `${res.data.skipped} duplicates skipped` : 'All questions created successfully'}</p>
        </div>
        <div class="results-list">
          ${q.slice(0, 5).map(item => `
            <div class="result-row">
              <span class="result-badge ${item.priority}">${item.priority}</span>
              <span class="result-text">${escapeHtml(item.content.length > 70 ? item.content.substring(0, 70) + '...' : item.content)}</span>
            </div>
          `).join('')}
          ${q.length > 5 ? `<p class="sota-results-more">+ ${q.length - 5} more questions</p>` : ''}
        </div>
        <p class="sota-results-footer">
          📋 Questions from <strong>${selectedRole?.role}</strong> perspective<br>
          <span class="sota-results-footer-note">Use AI Suggest on each question to find who should answer</span>
        </p>
        <button class="sota-btn-primary" id="btn-done">Done</button>
      `;

      modal.querySelector('#btn-done')?.addEventListener('click', () => {
        modal.remove();
        loadQuestions(panel, props);
      });

    } catch (err) {
      genContent.innerHTML = `
        <div class="sota-error">
          <div class="error-icon">✗</div>
          <h4>Generation Failed</h4>
          <p>Something went wrong. Please try again.</p>
          <button class="sota-btn-primary sota-btn--center" id="retry-gen">Retry</button>
        </div>
      `;
      modal.querySelector('#retry-gen')?.addEventListener('click', generateQuestions);
    }
  };

  // Bind events
  modal.querySelector('#close-modal')?.addEventListener('click', () => modal.remove());
  modal.querySelector('.modal-backdrop')?.addEventListener('click', () => modal.remove());

  // Source tabs
  modal.querySelectorAll('.sota-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('.sota-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentSource = (tab.getAttribute('data-source') as 'team' | 'contacts') || 'team';
      loadRoles(currentSource);
    });
  });

  // Count buttons
  modal.querySelectorAll('.config-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.config-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const countVal = btn.getAttribute('data-count') || 'auto';
      questionCount = countVal === 'auto' ? 'auto' : parseInt(countVal, 10);
    });
  });

  // Generate button
  modal.querySelector('#btn-generate')?.addEventListener('click', generateQuestions);

  // Initial load
  loadRoles('team');
}

/**
 * Update count badge
 */
function updateCount(panel: HTMLElement): void {
  const countEl = panel.querySelector('#questions-count');
  if (countEl) {
    const questions = dataStore.getState().questions;
    countEl.textContent = String(questions.length);
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

export default createQuestionsPanel;
