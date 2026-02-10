/**
 * Question Detail View
 * Full-page view for question details, replacing the panel when a card is clicked
 * Features: timeline, contact picker, answer suggestions, follow-up chain, entity display
 */

import { createElement, on } from '../../utils/dom';
import { Question, questionsService } from '../../services/questions';
import { contactsService, Contact } from '../../services/contacts';
import { toast } from '../../services/toast';
import { formatRelativeTime, formatDateTime } from '../../utils/format';
import { http } from '../../services/api';

export interface QuestionDetailViewProps {
  question: Question;
  onClose: () => void;
  onUpdate?: (question: Question) => void;
  onNavigateToQuestion?: (questionId: string) => void;
}

interface QuestionChain {
  parent: Question | null;
  children: Question[];
}

interface TimelineEvent {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  actor_name?: string;
  created_at: string;
}

interface PotentialAnswer {
  type: 'fact' | 'decision';
  id: string;
  content: string;
  confidence: number;
  source?: string;
}

interface SimilarQuestion {
  id: string;
  content: string;
  status: string;
  priority: string;
  similarityScore: number;
}

let currentQuestion: Question | null = null;
let contacts: Contact[] = [];

/**
 * Create and show the question detail view
 */
export function createQuestionDetailView(props: QuestionDetailViewProps): HTMLElement {
  const { question, onClose, onUpdate, onNavigateToQuestion } = props;
  currentQuestion = question;

  const container = createElement('div', { className: 'question-detail-view' });

  container.innerHTML = `
    <div class="question-detail-header">
      <div class="breadcrumb">
        <a href="#" class="breadcrumb-link" id="back-to-list">Questions</a>
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-current">Question #${String(question.id).substring(0, 8)}</span>
      </div>
      <div class="header-actions">
        ${question.sla_breached ? '<span class="sla-badge breached">SLA Breached</span>' : ''}
        <button class="btn btn-icon" id="close-detail" title="Close">×</button>
      </div>
    </div>

    <div class="question-detail-content">
      <!-- Main Question Card -->
      <section class="detail-section question-main">
        <div class="question-badges">
          <span class="priority-badge priority-${question.priority}">${question.priority}</span>
          <span class="status-badge status-${question.status}">${question.status}</span>
          ${question.requester_role ? `
            <div class="requester-badge-full" title="Question from the perspective of this role">
              <div class="requester-avatar-sm">${getInitials((question as any).requester_name || question.requester_role)}</div>
              <div class="requester-text">
                ${(question as any).requester_name ? `<span class="requester-name-sm">${escapeHtml((question as any).requester_name)}</span>` : ''}
                <span class="requester-role-sm">${escapeHtml(question.requester_role)}</span>
              </div>
            </div>
          ` : ''}
          <span class="question-date">Created ${formatRelativeTime(question.created_at)}</span>
        </div>
        <h2 class="question-text">${escapeHtml(question.content)}</h2>
        ${question.context ? `<p class="question-context">${escapeHtml(question.context)}</p>` : ''}
        ${renderEntities(question)}
      </section>

      <!-- Two-column layout -->
      <div class="detail-columns">
        <div class="detail-column-left">
          <!-- Assignment Section - SOTA Design -->
          <section class="detail-section" id="assignment-section">
            <div class="section-header-sota">
              <h3>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Assignment
                <span class="section-subtitle">Who should answer this question?</span>
              </h3>
              <button type="button" class="btn-ai-suggest" id="ai-suggest-btn">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                AI Suggest
              </button>
            </div>
            
            <!-- Current Assignment Display -->
            <div id="current-assignment" class="current-assignment-card">
              ${question.assigned_to ? `
                <div class="assigned-contact-display">
                  <div class="contact-avatar-lg" id="assigned-avatar">
                    ${getInitials(question.assigned_to)}
                  </div>
                  <div class="contact-details">
                    <div class="contact-name-lg">${escapeHtml(question.assigned_to)}</div>
                    <div class="contact-role-sm" id="assigned-role">Loading...</div>
                  </div>
                  <button class="btn-change-assignment" id="change-assignee-btn">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                    </svg>
                    Change
                  </button>
                </div>
              ` : `
                <div class="no-assignment">
                  <div class="no-assignment-icon">
                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                    </svg>
                  </div>
                  <span>No one assigned to answer</span>
                  <p class="no-assignment-hint">Use AI Suggest to find the best person</p>
                  <button class="btn-assign-now" id="show-picker-btn">Choose Manually</button>
                </div>
              `}
            </div>
            
            <!-- Contact Picker (hidden by default) -->
            <div id="contact-picker" class="contact-picker-sota hidden">
              <div class="picker-search">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input type="text" id="contact-search" placeholder="Search contacts..." autocomplete="off">
              </div>
              <div id="contact-list" class="contact-list-grid">
                <div class="loading">Loading contacts...</div>
              </div>
            </div>
            
            <!-- Hidden select for form submission -->
            <select id="assignee-select" class="form-select hidden">
              <option value="">Select contact...</option>
            </select>
            
            <!-- AI Suggestions Panel -->
            <div id="suggestions-panel" class="suggestions-panel-sota hidden"></div>
          </section>

          <!-- Potential Answers Section -->
          <section class="detail-section" id="answers-section">
            <div class="section-header">
              <h3>Potential Answers</h3>
              <button class="btn btn-secondary btn-sm" id="check-answers-btn">
                Check Knowledge Base
              </button>
            </div>
            <div id="potential-answers" class="potential-answers">
              <p class="empty-state">Click "Check Knowledge Base" to find potential answers</p>
            </div>
          </section>

          <!-- Answer Form Section -->
          <section class="detail-section" id="answer-section">
            <h3>${question.answer ? 'Current Answer' : 'Your Answer'}</h3>
            ${question.answer ? renderExistingAnswer(question) : ''}
            <div class="answer-form ${question.status === 'resolved' ? 'hidden' : ''}">
              <div class="form-group">
                <textarea id="answer-input" rows="4" 
                  placeholder="Type your answer here...">${question.answer || ''}</textarea>
              </div>
              <div class="form-row answer-form-row">
                <div class="form-group source-group">
                  <label>Source</label>
                  <div class="source-options">
                    <label class="source-option ${question.answer_source === 'manual' || !question.answer_source ? 'active' : ''}">
                      <input type="radio" name="answer-source" value="manual" ${question.answer_source === 'manual' || !question.answer_source ? 'checked' : ''}>
                      <span class="source-icon">✏️</span>
                      <span class="source-label">Manual</span>
                    </label>
                    <label class="source-option ${question.answer_source === 'document' ? 'active' : ''}">
                      <input type="radio" name="answer-source" value="document" ${question.answer_source === 'document' ? 'checked' : ''}>
                      <span class="source-icon">📄</span>
                      <span class="source-label">Document</span>
                    </label>
                    <label class="source-option ${question.answer_source === 'ai' ? 'active' : ''}">
                      <input type="radio" name="answer-source" value="ai" ${question.answer_source === 'ai' ? 'checked' : ''}>
                      <span class="source-icon">🤖</span>
                      <span class="source-label">AI</span>
                    </label>
                  </div>
                </div>
                <div class="form-group answered-by-group">
                  <label>Answered By</label>
                  <div class="answered-by-picker">
                    <div id="answered-by-display" class="answered-by-display">
                      ${question.answered_by_contact_id || question.answered_by_name ? `
                        <div class="answered-by-card" id="current-answerer">
                          <div class="answerer-avatar" id="answerer-avatar">${getInitials(question.answered_by_name || '')}</div>
                          <span class="answerer-name">${escapeHtml(question.answered_by_name || 'Contact')}</span>
                          <button type="button" class="btn-clear-answerer" id="clear-answerer">×</button>
                        </div>
                      ` : `
                        <button type="button" class="btn-select-answerer" id="show-answerer-picker">
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                          </svg>
                          Select who answered...
                        </button>
                      `}
                    </div>
                    <!-- Hidden select for form -->
                    <select id="answered-by-contact" class="form-select hidden">
                      <option value="">Select who answered...</option>
                    </select>
                    <!-- Contact picker dropdown -->
                    <div id="answerer-picker-dropdown" class="answerer-picker-dropdown hidden">
                      <div class="picker-search-sm">
                        <input type="text" id="answerer-search" placeholder="Search contacts...">
                      </div>
                      <div id="answerer-list" class="answerer-list"></div>
                      <div class="answerer-other">
                        <input type="text" id="answerer-other-name" placeholder="Or type a name...">
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label>Follow-up Questions (one per line)</label>
                <textarea id="followup-input" rows="2" 
                  placeholder="Add any follow-up questions..."></textarea>
              </div>
              <div class="form-actions">
                <button class="btn btn-primary" id="save-answer-btn">
                  ${question.answer ? 'Update Answer' : 'Save Answer'}
                </button>
              </div>
            </div>
          </section>
        </div>

        <div class="detail-column-right">
          <!-- Follow-up Chain Section -->
          <section class="detail-section" id="chain-section">
            <h3>Follow-up Chain</h3>
            <div id="chain-content" class="chain-content">
              <div class="loading">Loading...</div>
            </div>
          </section>

          <!-- Similar Questions Section -->
          <section class="detail-section" id="similar-section">
            <h3>Similar Questions</h3>
            <div id="similar-content" class="similar-content">
              <div class="loading">Loading...</div>
            </div>
          </section>

          <!-- Timeline Section -->
          <section class="detail-section" id="timeline-section">
            <h3>Timeline</h3>
            <div id="timeline-content" class="timeline-content">
              <div class="loading">Loading...</div>
            </div>
          </section>
        </div>
      </div>

    </div>

    <!-- Actions Bar - Outside scrollable content for proper click handling -->
    <div class="detail-actions">
      ${question.status === 'resolved' || question.status === 'dismissed' ? `
        <button class="btn btn-warning" id="reopen-btn">Reopen</button>
      ` : ''}
      ${question.status === 'deferred' ? `
        <button class="btn btn-info" id="undefer-btn">Resume Now</button>
      ` : `
        <button class="btn btn-secondary" id="defer-btn">Defer</button>
      `}
      ${question.was_useful === undefined && question.answer ? `
        <div class="feedback-buttons">
          <span class="feedback-label">Was this helpful?</span>
          <button class="btn btn-sm btn-success" id="feedback-yes">Yes</button>
          <button class="btn btn-sm btn-secondary" id="feedback-no">No</button>
        </div>
      ` : ''}
      <button class="btn btn-secondary" id="edit-btn">Edit</button>
      <div class="dropdown dismiss-dropdown">
        <button class="btn btn-danger" id="dismiss-btn">Dismiss ▼</button>
        <div class="dropdown-menu" id="dismiss-menu">
          <a href="#" data-reason="duplicate">Duplicate</a>
          <a href="#" data-reason="not_relevant">Not Relevant</a>
          <a href="#" data-reason="out_of_scope">Out of Scope</a>
          <a href="#" data-reason="answered_elsewhere">Answered Elsewhere</a>
          <a href="#" data-reason="no_longer_needed">No Longer Needed</a>
          <a href="#" data-reason="other">Other...</a>
        </div>
      </div>
    </div>
  `;

  // Bind events
  bindEvents(container, props);

  // Load async data
  loadContacts(container);
  loadChain(container, question.id, onNavigateToQuestion);
  loadSimilar(container, question.id, onNavigateToQuestion);
  loadTimeline(container, question.id);

  return container;
}

/**
 * Render extracted entities as tags
 */
function renderEntities(question: Question): string {
  const entities = question.extracted_entities || [];
  const topics = question.extracted_topics || [];
  
  if (entities.length === 0 && topics.length === 0) {
    return '';
  }

  const tags = [
    ...entities.map(e => `<span class="entity-tag entity-${e.type}">@${e.name}</span>`),
    ...topics.map(t => `<span class="entity-tag entity-topic">#${t.name}</span>`)
  ];

  return `<div class="question-entities">${tags.join('')}</div>`;
}

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Get avatar HTML for a contact
 */
function getContactAvatar(contact: { name: string; photoUrl?: string; avatarUrl?: string; photo_url?: string; avatar_url?: string }): string {
  const photoUrl = contact.photoUrl || contact.avatarUrl || contact.photo_url || contact.avatar_url;
  if (photoUrl) {
    return `<img src="${photoUrl}" alt="${escapeHtml(contact.name)}" onerror="this.classList.add('gm-none'); this.nextElementSibling.classList.remove('gm-none'); this.nextElementSibling.classList.add('gm-flex');">
            <span class="avatar-fallback gm-none">${getInitials(contact.name)}</span>`;
  }
  return getInitials(contact.name);
}

/**
 * Get score color based on value
 */
function getScoreColor(score: number): string {
  if (score >= 75) return '#10b981'; // green
  if (score >= 50) return '#f59e0b'; // amber
  return '#6b7280'; // gray
}

/**
 * Render existing answer display
 */
function renderExistingAnswer(question: Question): string {
  if (!question.answer) return '';

  return `
    <div class="existing-answer">
      <div class="answer-text">${escapeHtml(question.answer)}</div>
      <div class="answer-meta">
        <span class="answer-source-badge">${question.answer_source || 'manual'}</span>
        ${question.answered_by_name ? `<span class="answered-by">by ${escapeHtml(question.answered_by_name)}</span>` : ''}
        ${question.answered_at ? `<span class="answered-date">${formatRelativeTime(question.answered_at)}</span>` : ''}
      </div>
      ${question.answer_provenance ? renderProvenance(question.answer_provenance) : ''}
    </div>
  `;
}

/**
 * Render answer provenance chain
 */
function renderProvenance(provenance: { sources?: Array<{ type: string; content: string; confidence: number }> }): string {
  if (!provenance.sources || provenance.sources.length === 0) return '';

  const sources = provenance.sources.map(s => `
    <div class="provenance-source">
      <span class="source-type">${s.type}</span>
      <span class="source-content">${escapeHtml(s.content.substring(0, 100))}...</span>
      <span class="source-confidence">${Math.round(s.confidence * 100)}%</span>
    </div>
  `).join('');

  return `
    <div class="answer-provenance">
      <div class="provenance-label">Sources:</div>
      ${sources}
    </div>
  `;
}

/**
 * Bind all event handlers
 */
function bindEvents(container: HTMLElement, props: QuestionDetailViewProps): void {
  const { onClose, onUpdate } = props;

  // Close button
  const closeBtn = container.querySelector('#close-detail');
  if (closeBtn) {
    on(closeBtn as HTMLElement, 'click', onClose);
  }

  // Back to list link
  const backLink = container.querySelector('#back-to-list');
  if (backLink) {
    on(backLink as HTMLElement, 'click', (e) => {
      e.preventDefault();
      onClose();
    });
  }

  // AI Suggest button
  const aiSuggestBtn = container.querySelector('#ai-suggest-btn');
  if (aiSuggestBtn) {
    on(aiSuggestBtn as HTMLElement, 'click', () => loadAISuggestions(container));
  }

  // Check answers button
  const checkAnswersBtn = container.querySelector('#check-answers-btn');
  if (checkAnswersBtn) {
    on(checkAnswersBtn as HTMLElement, 'click', () => checkPotentialAnswers(container));
  }

  // Save answer button
  const saveAnswerBtn = container.querySelector('#save-answer-btn');
  if (saveAnswerBtn) {
    on(saveAnswerBtn as HTMLElement, 'click', () => saveAnswer(container, onUpdate));
  }

  // Reopen button
  const reopenBtn = container.querySelector('#reopen-btn');
  if (reopenBtn) {
    on(reopenBtn as HTMLElement, 'click', () => reopenQuestion(container, onUpdate));
  }

  // Dismiss button and dropdown
  const dismissBtn = container.querySelector('#dismiss-btn');
  const dismissMenu = container.querySelector('#dismiss-menu');
  console.log('[QuestionDetail] Dismiss btn found:', !!dismissBtn, 'Menu found:', !!dismissMenu);
  
  if (dismissBtn && dismissMenu) {
    on(dismissBtn as HTMLElement, 'click', (e) => {
      console.log('[QuestionDetail] Dismiss button clicked');
      e.stopPropagation();
      dismissMenu.classList.toggle('show');
    });
    
    // Dismiss reasons
    const reasonLinks = dismissMenu.querySelectorAll('a[data-reason]');
    console.log('[QuestionDetail] Dismiss reason links:', reasonLinks.length);
    
    reasonLinks.forEach(link => {
      on(link as HTMLElement, 'click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const reason = link.getAttribute('data-reason') as 'duplicate' | 'not_relevant' | 'out_of_scope' | 'answered_elsewhere' | 'no_longer_needed' | 'other';
        console.log('[QuestionDetail] Dismiss reason clicked:', reason);
        dismissMenu.classList.remove('show');
        
        let details: string | undefined;
        if (reason === 'other') {
          details = prompt('Please provide a reason for dismissing this question:') || undefined;
          if (!details) return;
        }
        
        try {
          console.log('[QuestionDetail] Calling dismissQuestionWithReason...');
          await dismissQuestionWithReason(container, props, reason, details);
          console.log('[QuestionDetail] Dismiss completed');
        } catch (err) {
          console.error('[QuestionDetail] Dismiss error:', err);
        }
      });
    });
    
    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.dismiss-dropdown')) {
        dismissMenu.classList.remove('show');
      }
    });
  } else {
    console.warn('[QuestionDetail] Dismiss button or menu not found!');
  }

  // Defer button
  const deferBtn = container.querySelector('#defer-btn');
  if (deferBtn) {
    on(deferBtn as HTMLElement, 'click', () => showDeferDialog(container, onUpdate));
  }

  // Undefer button
  const undeferBtn = container.querySelector('#undefer-btn');
  if (undeferBtn) {
    on(undeferBtn as HTMLElement, 'click', () => reopenQuestion(container, onUpdate));
  }

  // Feedback buttons
  const feedbackYes = container.querySelector('#feedback-yes');
  const feedbackNo = container.querySelector('#feedback-no');
  if (feedbackYes) {
    on(feedbackYes as HTMLElement, 'click', () => submitFeedback(container, true, onUpdate));
  }
  if (feedbackNo) {
    on(feedbackNo as HTMLElement, 'click', () => submitFeedback(container, false, onUpdate));
  }

  // Edit button
  const editBtn = container.querySelector('#edit-btn');
  if (editBtn) {
    on(editBtn as HTMLElement, 'click', () => toggleEditMode(container));
  }
}

/**
 * Load contacts for dropdowns
 */
async function loadContacts(container: HTMLElement): Promise<void> {
  try {
    const response = await contactsService.getAll();
    contacts = response?.contacts || [];
    
    const assigneeSelect = container.querySelector('#assignee-select') as HTMLSelectElement;
    const answeredBySelect = container.querySelector('#answered-by-contact') as HTMLSelectElement;
    const contactList = container.querySelector('#contact-list') as HTMLElement;
    const contactSearch = container.querySelector('#contact-search') as HTMLInputElement;

    // Populate hidden select for form
    if (assigneeSelect) {
      for (const contact of contacts) {
        const option = document.createElement('option');
        option.value = contact.id;
        option.textContent = `${contact.name}${contact.role ? ` (${contact.role})` : ''}`;
        if (currentQuestion?.assigned_to === contact.name) {
          option.selected = true;
        }
        assigneeSelect.appendChild(option);
      }
    }

    // Populate answered by select
    if (answeredBySelect) {
      for (const contact of contacts) {
        const option = document.createElement('option');
        option.value = contact.id;
        option.textContent = `${contact.name}${contact.role ? ` (${contact.role})` : ''}`;
        if (currentQuestion?.answered_by_contact_id === contact.id) {
          option.selected = true;
        }
        answeredBySelect.appendChild(option);
      }
      
      // Add "Other" option for external
      const otherOption = document.createElement('option');
      otherOption.value = '__other__';
      otherOption.textContent = '+ Other (type name)';
      answeredBySelect.appendChild(otherOption);
    }

    // Render SOTA contact picker grid
    if (contactList) {
      renderContactGrid(container, contacts);
      
      // Bind search
      if (contactSearch) {
        contactSearch.addEventListener('input', () => {
          const query = contactSearch.value.toLowerCase();
          const filtered = contacts.filter(c => 
            c.name.toLowerCase().includes(query) ||
            (c.role && c.role.toLowerCase().includes(query)) ||
            (c.organization && c.organization.toLowerCase().includes(query))
          );
          renderContactGrid(container, filtered);
        });
      }
    }
    
    // Update assigned contact avatar display
    updateAssignedDisplay(container);
    
    // Bind picker toggle buttons
    bindPickerButtons(container);
    
    // Setup answerer picker
    setupAnswererPicker(container);
    
    // Setup source options
    setupSourceOptions(container);
    
  } catch (e) {
    console.error('Error loading contacts:', e);
  }
}

/**
 * Setup the answerer picker functionality
 */
function setupAnswererPicker(container: HTMLElement): void {
  const showBtn = container.querySelector('#show-answerer-picker');
  const dropdown = container.querySelector('#answerer-picker-dropdown') as HTMLElement;
  const answererList = container.querySelector('#answerer-list') as HTMLElement;
  const answererSearch = container.querySelector('#answerer-search') as HTMLInputElement;
  const answererOtherInput = container.querySelector('#answerer-other-name') as HTMLInputElement;
  
  if (!dropdown || !answererList) return;
  
  // Render contacts in answerer list
  const renderAnswererList = (filter = '') => {
    const filtered = filter 
      ? contacts.filter(c => 
          c.name.toLowerCase().includes(filter.toLowerCase()) ||
          (c.role && c.role.toLowerCase().includes(filter.toLowerCase()))
        )
      : contacts;
    
    answererList.innerHTML = filtered.map(contact => {
      const photoUrl = contact.photoUrl || contact.avatarUrl || contact.photo_url || contact.avatar_url;
      return `
        <div class="answerer-item" data-contact-id="${contact.id}" data-contact-name="${escapeHtml(contact.name)}">
          <div class="answerer-avatar-sm">
            ${photoUrl 
              ? `<img src="${photoUrl}" alt="${escapeHtml(contact.name)}" onerror="this.parentElement.innerHTML='${getInitials(contact.name)}'">`
              : getInitials(contact.name)
            }
          </div>
          <div class="answerer-info">
            <span class="answerer-name">${escapeHtml(contact.name)}</span>
            ${contact.role ? `<span class="answerer-role">${escapeHtml(contact.role)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    // Bind click handlers
    answererList.querySelectorAll('.answerer-item').forEach(item => {
      on(item as HTMLElement, 'click', () => {
        const contactId = item.getAttribute('data-contact-id');
        const contactName = item.getAttribute('data-contact-name');
        selectAnswerer(container, contactId || '', contactName || '');
        dropdown.classList.add('hidden');
      });
    });
  };
  
  // Show picker
  if (showBtn) {
    on(showBtn as HTMLElement, 'click', () => {
      dropdown.classList.toggle('hidden');
      renderAnswererList();
      if (answererSearch) answererSearch.focus();
    });
  }
  
  // Search filter
  if (answererSearch) {
    answererSearch.addEventListener('input', () => {
      renderAnswererList(answererSearch.value);
    });
  }
  
  // Other name input
  if (answererOtherInput) {
    answererOtherInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const name = answererOtherInput.value.trim();
        if (name) {
          selectAnswerer(container, '', name);
          dropdown.classList.add('hidden');
        }
      }
    });
  }
  
  // Clear button
  const clearBtn = container.querySelector('#clear-answerer');
  if (clearBtn) {
    on(clearBtn as HTMLElement, 'click', () => {
      selectAnswerer(container, '', '');
    });
  }
  
  // Close on outside click
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.answered-by-picker') && !dropdown.classList.contains('hidden')) {
      dropdown.classList.add('hidden');
    }
  });
}

/**
 * Select an answerer
 */
function selectAnswerer(container: HTMLElement, contactId: string, contactName: string): void {
  const display = container.querySelector('#answered-by-display') as HTMLElement;
  const select = container.querySelector('#answered-by-contact') as HTMLSelectElement;
  
  if (select) {
    select.value = contactId;
  }
  
  if (display) {
    if (contactName) {
      const contact = contacts.find(c => c.id === contactId);
      const photoUrl = contact?.photoUrl || contact?.avatarUrl || contact?.photo_url || contact?.avatar_url;
      
      display.innerHTML = `
        <div class="answered-by-card" id="current-answerer">
          <div class="answerer-avatar">
            ${photoUrl 
              ? `<img src="${photoUrl}" alt="${escapeHtml(contactName)}" onerror="this.parentElement.innerHTML='${getInitials(contactName)}'">`
              : getInitials(contactName)
            }
          </div>
          <span class="answerer-name">${escapeHtml(contactName)}</span>
          <button type="button" class="btn-clear-answerer" id="clear-answerer">×</button>
        </div>
      `;
      
      // Re-bind clear button
      const clearBtn = display.querySelector('#clear-answerer');
      if (clearBtn) {
        on(clearBtn as HTMLElement, 'click', (e) => {
          e.stopPropagation();
          selectAnswerer(container, '', '');
        });
      }
    } else {
      display.innerHTML = `
        <button type="button" class="btn-select-answerer" id="show-answerer-picker">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          Select who answered...
        </button>
      `;
      
      // Re-setup picker
      setupAnswererPicker(container);
    }
  }
}

/**
 * Setup source option radio buttons
 */
function setupSourceOptions(container: HTMLElement): void {
  const sourceOptions = container.querySelectorAll('.source-option input[type="radio"]');
  
  sourceOptions.forEach(input => {
    input.addEventListener('change', () => {
      // Update active state
      container.querySelectorAll('.source-option').forEach(opt => opt.classList.remove('active'));
      (input as HTMLElement).closest('.source-option')?.classList.add('active');
    });
  });
}

/**
 * Render contact grid with cards
 */
function renderContactGrid(container: HTMLElement, contactsToRender: typeof contacts): void {
  const contactList = container.querySelector('#contact-list') as HTMLElement;
  if (!contactList) return;
  
  if (contactsToRender.length === 0) {
    contactList.innerHTML = '<div class="empty-state">No contacts found</div>';
    return;
  }
  
  contactList.innerHTML = contactsToRender.map(contact => {
    const photoUrl = contact.photoUrl || contact.avatarUrl || contact.photo_url || contact.avatar_url;
    const isCurrentAssignee = currentQuestion?.assigned_to === contact.name;
    
    return `
      <div class="contact-card-picker ${isCurrentAssignee ? 'selected' : ''}" data-contact-id="${contact.id}" data-contact-name="${escapeHtml(contact.name)}">
        <div class="contact-avatar-picker">
          ${photoUrl 
            ? `<img src="${photoUrl}" alt="${escapeHtml(contact.name)}" onerror="this.parentElement.innerHTML='${getInitials(contact.name)}'">`
            : getInitials(contact.name)
          }
        </div>
        <div class="contact-info-picker">
          <div class="contact-name-picker">${escapeHtml(contact.name)}</div>
          ${contact.role ? `<div class="contact-role-picker">${escapeHtml(contact.role)}</div>` : ''}
          ${contact.organization ? `<div class="contact-org-picker">${escapeHtml(contact.organization)}</div>` : ''}
        </div>
        ${isCurrentAssignee ? '<div class="current-badge">Current</div>' : ''}
      </div>
    `;
  }).join('');
  
  // Bind click handlers
  contactList.querySelectorAll('.contact-card-picker').forEach(card => {
    on(card as HTMLElement, 'click', async () => {
      const contactId = card.getAttribute('data-contact-id');
      const contactName = card.getAttribute('data-contact-name');
      const assigneeSelect = container.querySelector('#assignee-select') as HTMLSelectElement;
      const picker = container.querySelector('#contact-picker') as HTMLElement;
      
      if (contactId && assigneeSelect && currentQuestion) {
        assigneeSelect.value = contactId;
        
        // Save to server FIRST
        try {
          await questionsService.update(currentQuestion.id, {
            assigned_to: contactName || undefined,
            status: 'assigned'
          });
          
          // Update current question state
          currentQuestion.assigned_to = contactName || undefined;
          currentQuestion.status = 'assigned';
          
          // Update display
          updateAssignedDisplay(container);
          
          // Hide picker
          if (picker) {
            picker.classList.add('hidden');
          }
          
          toast.success(`Assigned to ${contactName}`);
        } catch (e) {
          console.error('[QuestionDetail] Failed to save assignment:', e);
          toast.error('Failed to save assignment');
        }
      }
    });
  });
}

/**
 * Update assigned contact display
 */
function updateAssignedDisplay(container: HTMLElement): void {
  const display = container.querySelector('#current-assignment') as HTMLElement;
  if (!display || !currentQuestion) return;
  
  if (currentQuestion.assigned_to) {
    const contact = contacts.find(c => c.name === currentQuestion?.assigned_to);
    const photoUrl = contact?.photoUrl || contact?.avatarUrl || contact?.photo_url || contact?.avatar_url;
    
    display.innerHTML = `
      <div class="assigned-contact-display">
        <div class="contact-avatar-lg">
          ${photoUrl 
            ? `<img src="${photoUrl}" alt="${escapeHtml(currentQuestion.assigned_to)}" onerror="this.parentElement.innerHTML='${getInitials(currentQuestion.assigned_to)}'">`
            : getInitials(currentQuestion.assigned_to)
          }
        </div>
        <div class="contact-details">
          <div class="contact-name-lg">${escapeHtml(currentQuestion.assigned_to)}</div>
          <div class="contact-role-sm">${contact?.role || 'Team Member'}</div>
          ${contact?.organization ? `<div class="contact-org-sm">${escapeHtml(contact.organization)}</div>` : ''}
        </div>
        <button class="btn-change-assignment" id="change-assignee-btn">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
          </svg>
          Change
        </button>
      </div>
    `;
  } else {
    display.innerHTML = `
      <div class="no-assignment">
        <div class="no-assignment-icon">
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
          </svg>
        </div>
        <span>No one assigned yet</span>
        <button class="btn-assign-now" id="show-picker-btn">Assign Someone</button>
      </div>
    `;
  }
  
  // Re-bind picker buttons
  bindPickerButtons(container);
}

/**
 * Bind picker toggle buttons
 */
function bindPickerButtons(container: HTMLElement): void {
  const showPickerBtn = container.querySelector('#show-picker-btn');
  const changeBtn = container.querySelector('#change-assignee-btn');
  const picker = container.querySelector('#contact-picker') as HTMLElement;
  
  if (showPickerBtn && picker) {
    on(showPickerBtn as HTMLElement, 'click', () => {
      picker.classList.toggle('hidden');
      const searchInput = picker.querySelector('#contact-search') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    });
  }
  
  if (changeBtn && picker) {
    on(changeBtn as HTMLElement, 'click', () => {
      picker.classList.toggle('hidden');
      const searchInput = picker.querySelector('#contact-search') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    });
  }
}

/**
 * Load question chain (parent + children)
 */
async function loadChain(
  container: HTMLElement, 
  questionId: string | number,
  onNavigate?: (id: string) => void
): Promise<void> {
  const chainContent = container.querySelector('#chain-content');
  if (!chainContent) return;

  try {
    const response = await http.get<{ parent: Question | null; children: Question[] }>(
      `/api/questions/${questionId}/chain`
    );
    const { parent, children } = response.data;

    if (!parent && children.length === 0) {
      chainContent.innerHTML = '<p class="empty-state">No follow-up chain</p>';
      return;
    }

    let html = '';

    if (parent) {
      html += `
        <div class="chain-item chain-parent" data-id="${parent.id}">
          <span class="chain-arrow">←</span>
          <span class="chain-label">Parent:</span>
          <span class="chain-content">${escapeHtml(parent.content.substring(0, 50))}...</span>
          <span class="status-badge status-${parent.status}">${parent.status}</span>
        </div>
      `;
    }

    html += `<div class="chain-item chain-current">This question</div>`;

    for (const child of children) {
      html += `
        <div class="chain-item chain-child" data-id="${child.id}">
          <span class="chain-arrow">→</span>
          <span class="chain-content">${escapeHtml(child.content.substring(0, 50))}...</span>
          <span class="status-badge status-${child.status}">${child.status}</span>
        </div>
      `;
    }

    chainContent.innerHTML = html;

    // Bind click handlers for navigation
    chainContent.querySelectorAll('.chain-item[data-id]').forEach(item => {
      on(item as HTMLElement, 'click', () => {
        const id = item.getAttribute('data-id');
        if (id && onNavigate) {
          onNavigate(id);
        }
      });
    });
  } catch (e) {
    chainContent.innerHTML = '<p class="error">Failed to load chain</p>';
  }
}

/**
 * Load similar questions
 */
async function loadSimilar(
  container: HTMLElement, 
  questionId: string | number,
  onNavigate?: (id: string) => void
): Promise<void> {
  const similarContent = container.querySelector('#similar-content');
  if (!similarContent) return;

  try {
    const response = await http.get<{ similar: SimilarQuestion[] }>(
      `/api/questions/${questionId}/similar?limit=5`
    );
    const { similar } = response.data;

    if (!similar || similar.length === 0) {
      similarContent.innerHTML = '<p class="empty-state">No similar questions found</p>';
      return;
    }

    const html = similar.map(q => `
      <div class="similar-item" data-id="${q.id}">
        <div class="similar-content">${escapeHtml(q.content.substring(0, 60))}...</div>
        <div class="similar-meta">
          <span class="status-badge status-${q.status}">${q.status}</span>
          <span class="similarity-score">${Math.round(q.similarityScore * 100)}%</span>
        </div>
      </div>
    `).join('');

    similarContent.innerHTML = html;

    // Bind click handlers
    similarContent.querySelectorAll('.similar-item').forEach(item => {
      on(item as HTMLElement, 'click', () => {
        const id = item.getAttribute('data-id');
        if (id && onNavigate) {
          onNavigate(id);
        }
      });
    });
  } catch (e) {
    similarContent.innerHTML = '<p class="error">Failed to load similar questions</p>';
  }
}

/**
 * Load timeline events
 */
async function loadTimeline(container: HTMLElement, questionId: string | number): Promise<void> {
  const timelineContent = container.querySelector('#timeline-content');
  if (!timelineContent) return;

  try {
    const response = await http.get<{ events: TimelineEvent[] }>(
      `/api/questions/${questionId}/timeline`
    );
    const { events } = response.data;

    if (!events || events.length === 0) {
      timelineContent.innerHTML = '<p class="empty-state">No events recorded</p>';
      return;
    }

    const html = events.map(e => {
      const icon = getEventIcon(e.event_type);
      const description = getEventDescription(e);
      
      return `
        <div class="timeline-item">
          <div class="timeline-icon">${icon}</div>
          <div class="timeline-content">
            <div class="timeline-title">${description}</div>
            <div class="timeline-date">${formatDateTime(e.created_at)}</div>
          </div>
        </div>
      `;
    }).join('');

    timelineContent.innerHTML = `<div class="timeline-list">${html}</div>`;
  } catch (e) {
    timelineContent.innerHTML = '<p class="error">Failed to load timeline</p>';
  }
}

/**
 * Get icon for event type
 */
function getEventIcon(eventType: string): string {
  const icons: Record<string, string> = {
    created: '📝',
    assigned: '👤',
    answered: '✅',
    priority_changed: '🔺',
    status_changed: '🔄',
    reopened: '🔓',
    dismissed: '❌',
    sla_breached: '⏰',
    entity_extracted: '🏷️',
    similar_linked: '🔗'
  };
  return icons[eventType] || '•';
}

/**
 * Get description for event
 */
function getEventDescription(event: TimelineEvent): string {
  const data = event.event_data || {};
  
  switch (event.event_type) {
    case 'created':
      return `Created${event.actor_name ? ` by ${event.actor_name}` : ''}`;
    case 'assigned':
      return `Assigned to ${data.to || 'someone'}${event.actor_name ? ` by ${event.actor_name}` : ''}`;
    case 'answered':
      return `Answered${event.actor_name ? ` by ${event.actor_name}` : ''} (${data.source || 'manual'})`;
    case 'priority_changed':
      return `Priority changed: ${data.from} → ${data.to}`;
    case 'status_changed':
      return `Status changed: ${data.from} → ${data.to}`;
    case 'reopened':
      return `Reopened${event.actor_name ? ` by ${event.actor_name}` : ''}`;
    case 'dismissed':
      return `Dismissed${event.actor_name ? ` by ${event.actor_name}` : ''}`;
    case 'sla_breached':
      return 'SLA breached';
    case 'entity_extracted':
      return `Entities extracted: ${(data.entities as Array<{name: string}>)?.length || 0}`;
    default:
      return event.event_type;
  }
}

/**
 * Load AI suggestions for assignee
 */
async function loadAISuggestions(container: HTMLElement): Promise<void> {
  const panel = container.querySelector('#suggestions-panel') as HTMLElement;
  const btn = container.querySelector('#ai-suggest-btn') as HTMLButtonElement;
  
  if (!panel || !currentQuestion) return;

  btn.disabled = true;
  btn.innerHTML = `
    <svg class="spin" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>
    Analyzing...
  `;
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="suggestions-loading">
      <div class="ai-thinking-animation">
        <span></span><span></span><span></span>
      </div>
      <div class="loading-text">AI is analyzing question context and team expertise...</div>
    </div>
  `;

  try {
    const result = await questionsService.suggestAssignee({
      id: currentQuestion.id,
      useAI: true
    });

    if (result.suggestions.length === 0) {
      panel.innerHTML = `
        <div class="no-suggestions">
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div class="no-suggestions-text">No matching experts found</div>
          <button class="btn-show-all-contacts" id="show-all-btn">Browse all contacts</button>
        </div>
      `;
      
      // Bind show all button
      const showAllBtn = panel.querySelector('#show-all-btn');
      if (showAllBtn) {
        on(showAllBtn as HTMLElement, 'click', () => {
          panel.classList.add('hidden');
          const picker = container.querySelector('#contact-picker') as HTMLElement;
          if (picker) {
            picker.classList.remove('hidden');
          }
        });
      }
    } else {
      panel.innerHTML = `
        <div class="suggestions-header-sota">
          <div class="ai-badge">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            AI Recommended
          </div>
          ${result.cached ? '<span class="cached-tag">Cached</span>' : '<span class="fresh-tag">Fresh</span>'}
        </div>
        <div class="suggestions-list-sota">
          ${result.suggestions.map((s, i) => {
            const contact = contacts.find(c => (c.name || '').trim().toLowerCase() === (s.person || '').trim().toLowerCase())
              || contacts.find(c => (c.aliases || []).some(a => String(a).trim().toLowerCase() === (s.person || '').trim().toLowerCase()));
            const photoUrl = contact?.photoUrl || contact?.avatarUrl || contact?.photo_url || contact?.avatar_url;
            const roleDisplay = contact?.role ?? s.role ?? '';
            const scoreColor = getScoreColor(s.score);
            
            return `
              <div class="suggestion-card-sota" data-index="${i}">
                <div class="suggestion-rank">#${i + 1}</div>
                <div class="suggestion-avatar-sota">
                  ${photoUrl 
                    ? `<img src="${photoUrl}" alt="${escapeHtml(s.person)}" onerror="this.parentElement.innerHTML='${getInitials(s.person)}'">`
                    : getInitials(s.person)
                  }
                </div>
                <div class="suggestion-info-sota">
                  <div class="suggestion-name-sota">${escapeHtml(s.person)}</div>
                  ${roleDisplay ? `<div class="suggestion-role-sota">${escapeHtml(roleDisplay)}</div>` : ''}
                  <div class="suggestion-reason-sota">${escapeHtml(s.reason)}</div>
                </div>
                <div class="suggestion-score-sota" style="--score-color: ${scoreColor}">
                  <div class="score-ring">
                    <svg viewBox="0 0 36 36">
                      <path class="score-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                      <path class="score-fill" stroke-dasharray="${s.score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                    </svg>
                    <div class="score-value">${s.score}%</div>
                  </div>
                  <div class="score-label">Match</div>
                </div>
                <button class="btn-select-suggestion">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  Assign
                </button>
              </div>
            `;
          }).join('')}
        </div>
        <div class="suggestions-footer">
          <button class="btn-link" id="hide-suggestions-btn">Close suggestions</button>
        </div>
      `;

      // Bind click to select
      panel.querySelectorAll('.suggestion-card-sota').forEach(item => {
        const selectBtn = item.querySelector('.btn-select-suggestion');
        if (selectBtn) {
          on(selectBtn as HTMLElement, 'click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(item.getAttribute('data-index') || '0');
            const suggestion = result.suggestions[idx];
            if (suggestion && currentQuestion) {
              const select = container.querySelector('#assignee-select') as HTMLSelectElement;
              const contact = contacts.find(c => c.name === suggestion.person);
              
              // Save to server FIRST
              try {
                await questionsService.update(currentQuestion.id, {
                  assigned_to: suggestion.person,
                  status: 'assigned'
                });
                
                if (contact && select) {
                  select.value = contact.id;
                }
                // Update current question state
                currentQuestion.assigned_to = suggestion.person;
                currentQuestion.status = 'assigned';
                
                // Update display
                updateAssignedDisplay(container);
                panel.classList.add('hidden');
                toast.success(`Assigned to ${suggestion.person}`);
              } catch (err) {
                console.error('[QuestionDetail] Failed to save AI suggestion assignment:', err);
                toast.error('Failed to save assignment');
              }
            }
          });
        }
      });
      
      // Bind hide button
      const hideBtn = panel.querySelector('#hide-suggestions-btn');
      if (hideBtn) {
        on(hideBtn as HTMLElement, 'click', () => {
          panel.classList.add('hidden');
        });
      }
    }
  } catch (e) {
    const isTimeout = (err: unknown) =>
      (err as { message?: string; status?: number }).message === 'Request timed out' ||
      (err as { status?: number }).status === 0;
    const timeoutMessage = isTimeout(e);
    panel.innerHTML = `
      <div class="suggestions-error">
        <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <div>${timeoutMessage ? 'This took longer than expected.' : 'Failed to get AI suggestions.'}</div>
        ${timeoutMessage ? '<p class="suggestions-error-hint">You can try again (suggestions may be ready) or choose someone manually.</p>' : ''}
        <button class="btn-retry" id="retry-suggestions-btn">Try Again</button>
      </div>
    `;
    
    const retryBtn = panel.querySelector('#retry-suggestions-btn');
    if (retryBtn) {
      on(retryBtn as HTMLElement, 'click', () => loadAISuggestions(container));
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
      AI Suggest
    `;
  }
}

/**
 * Check for potential answers in knowledge base
 */
async function checkPotentialAnswers(container: HTMLElement): Promise<void> {
  const answersDiv = container.querySelector('#potential-answers') as HTMLElement;
  const btn = container.querySelector('#check-answers-btn') as HTMLButtonElement;
  
  if (!answersDiv || !currentQuestion) return;

  btn.disabled = true;
  btn.textContent = 'Checking...';
  answersDiv.innerHTML = '<div class="loading">Searching knowledge base...</div>';

  try {
    const response = await http.post<{ potentialAnswers: PotentialAnswer[] }>(
      `/api/questions/${currentQuestion.id}/check-answer`,
      {}
    );
    const { potentialAnswers } = response.data;

    if (!potentialAnswers || potentialAnswers.length === 0) {
      answersDiv.innerHTML = '<p class="empty-state">No potential answers found in knowledge base</p>';
    } else {
      answersDiv.innerHTML = potentialAnswers.map(a => `
        <div class="potential-answer" data-content="${escapeHtml(a.content)}">
          <div class="answer-header">
            <span class="answer-type">${a.type.toUpperCase()}</span>
            <span class="answer-confidence">${Math.round(a.confidence * 100)}%</span>
          </div>
          <div class="answer-content">${escapeHtml(a.content.substring(0, 200))}...</div>
          ${a.source ? `<div class="answer-source">Source: ${escapeHtml(a.source)}</div>` : ''}
          <button class="btn btn-sm btn-secondary use-answer-btn">Use This</button>
        </div>
      `).join('');

      // Bind "Use This" buttons
      answersDiv.querySelectorAll('.use-answer-btn').forEach(btn => {
        on(btn as HTMLElement, 'click', (e) => {
          e.stopPropagation();
          const parent = (btn as HTMLElement).closest('.potential-answer');
          const content = parent?.getAttribute('data-content');
          if (content) {
            const answerInput = container.querySelector('#answer-input') as HTMLTextAreaElement;
            if (answerInput) {
              answerInput.value = content;
              toast.success('Answer filled from knowledge base');
            }
          }
        });
      });
    }
  } catch (e) {
    answersDiv.innerHTML = '<p class="error">Failed to check knowledge base</p>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Check Knowledge Base';
  }
}

/**
 * Save answer
 */
async function saveAnswer(
  container: HTMLElement, 
  onUpdate?: (question: Question) => void
): Promise<void> {
  if (!currentQuestion) return;

  const answerInput = container.querySelector('#answer-input') as HTMLTextAreaElement;
  const sourceSelect = container.querySelector('#answer-source') as HTMLSelectElement;
  const answeredBySelect = container.querySelector('#answered-by-contact') as HTMLSelectElement;
  const followupInput = container.querySelector('#followup-input') as HTMLTextAreaElement;
  const saveBtn = container.querySelector('#save-answer-btn') as HTMLButtonElement;

  const answer = answerInput?.value.trim();
  const source = sourceSelect?.value || 'manual';
  const answeredByContactId = answeredBySelect?.value !== '__other__' ? answeredBySelect?.value : undefined;
  const followupQuestions = followupInput?.value.trim();

  if (!answer || answer.length < 3) {
    toast.warning('Please provide an answer (at least 3 characters)');
    return;
  }

  // Get contact name if selected
  let answeredByName: string | undefined;
  if (answeredByContactId) {
    const contact = contacts.find(c => c.id === answeredByContactId);
    answeredByName = contact?.name;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const result = await questionsService.answer(currentQuestion.id, {
      answer,
      source: source as 'manual' | 'document' | 'ai',
      followupQuestions,
      answeredByContactId,
      answeredByName
    });

    toast.success(result.message);
    
    if (onUpdate && result.question) {
      currentQuestion = result.question;
      onUpdate(result.question);
    }
  } catch (e) {
    toast.error('Failed to save answer');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Answer';
  }
}

/**
 * Reopen question
 */
async function reopenQuestion(
  container: HTMLElement,
  onUpdate?: (question: Question) => void
): Promise<void> {
  if (!currentQuestion) return;

  const reason = prompt('Why are you reopening this question?');
  if (!reason) return;

  try {
    const updated = await questionsService.reopen(currentQuestion.id, reason);
    toast.success('Question reopened');
    currentQuestion = updated;
    if (onUpdate) onUpdate(updated);
  } catch (e) {
    toast.error('Failed to reopen question');
  }
}

/**
 * Dismiss question with reason
 */
async function dismissQuestionWithReason(
  container: HTMLElement,
  props: QuestionDetailViewProps,
  reason: 'duplicate' | 'not_relevant' | 'out_of_scope' | 'answered_elsewhere' | 'no_longer_needed' | 'other',
  details?: string
): Promise<void> {
  console.log('[QuestionDetail] dismissQuestionWithReason called, reason:', reason);
  
  if (!currentQuestion) {
    console.error('[QuestionDetail] No current question!');
    toast.error('No question selected');
    return;
  }

  console.log('[QuestionDetail] Dismissing question:', currentQuestion.id);

  try {
    const updated = await questionsService.dismissQuestion(currentQuestion.id, reason, details);
    console.log('[QuestionDetail] Dismiss API response:', updated);
    toast.success(`Question dismissed: ${reason.replace(/_/g, ' ')}`);
    currentQuestion = updated;
    if (props.onUpdate) props.onUpdate(updated);
    props.onClose();
  } catch (e) {
    console.error('[QuestionDetail] Dismiss API error:', e);
    toast.error('Failed to dismiss question');
  }
}

/**
 * Show defer dialog
 */
async function showDeferDialog(
  container: HTMLElement,
  onUpdate?: (question: Question) => void
): Promise<void> {
  if (!currentQuestion) return;

  // Create modal for defer options
  const modal = document.createElement('div');
  modal.className = 'modal open';
  modal.id = 'defer-modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-container defer-modal-container">
      <div class="modal-header">
        <h3>Defer Question</h3>
        <button class="btn btn-icon modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Defer until</label>
          <input type="datetime-local" id="defer-until" class="form-input" 
            min="${new Date().toISOString().slice(0, 16)}" required>
        </div>
        <div class="form-group">
          <label>Quick options</label>
          <div class="defer-quick-options">
            <button class="btn btn-sm btn-secondary" data-days="1">Tomorrow</button>
            <button class="btn btn-sm btn-secondary" data-days="7">Next Week</button>
            <button class="btn btn-sm btn-secondary" data-days="30">Next Month</button>
          </div>
        </div>
        <div class="form-group">
          <label>Reason (optional)</label>
          <input type="text" id="defer-reason" class="form-input" placeholder="Why are you deferring this?">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancel-defer">Cancel</button>
        <button class="btn btn-primary" id="confirm-defer">Defer</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Bind events
  modal.querySelector('.modal-close')?.addEventListener('click', () => modal.remove());
  modal.querySelector('.modal-backdrop')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#cancel-defer')?.addEventListener('click', () => modal.remove());

  // Quick options
  modal.querySelectorAll('.defer-quick-options button').forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.getAttribute('data-days') || '1');
      const date = new Date();
      date.setDate(date.getDate() + days);
      const input = modal.querySelector('#defer-until') as HTMLInputElement;
      input.value = date.toISOString().slice(0, 16);
    });
  });

  // Confirm
  modal.querySelector('#confirm-defer')?.addEventListener('click', async () => {
    const untilInput = modal.querySelector('#defer-until') as HTMLInputElement;
    const reasonInput = modal.querySelector('#defer-reason') as HTMLInputElement;

    if (!untilInput.value) {
      toast.warning('Please select a date');
      return;
    }

    try {
      const updated = await questionsService.deferQuestion(
        currentQuestion!.id,
        new Date(untilInput.value),
        reasonInput.value || undefined
      );
      toast.success('Question deferred');
      modal.remove();
      currentQuestion = updated;
      if (onUpdate) onUpdate(updated);
    } catch (e) {
      toast.error('Failed to defer question');
    }
  });
}

/**
 * Submit feedback on answer
 */
async function submitFeedback(
  container: HTMLElement,
  wasUseful: boolean,
  onUpdate?: (question: Question) => void
): Promise<void> {
  if (!currentQuestion) return;

  let feedback: string | undefined;
  if (!wasUseful) {
    feedback = prompt('What could be improved about this answer?') || undefined;
  }

  try {
    const updated = await questionsService.submitAnswerFeedback(
      currentQuestion.id,
      wasUseful,
      feedback
    );
    toast.success('Thank you for your feedback!');
    currentQuestion = updated;
    if (onUpdate) onUpdate(updated);
    
    // Update UI to hide feedback buttons
    const feedbackBtns = container.querySelector('.feedback-buttons');
    if (feedbackBtns) {
      feedbackBtns.innerHTML = `<span class="feedback-result">${wasUseful ? '👍 Helpful' : '👎 Not helpful'}</span>`;
    }
  } catch (e) {
    toast.error('Failed to submit feedback');
  }
}

/**
 * Toggle edit mode
 */
function toggleEditMode(container: HTMLElement): void {
  // TODO: Implement edit mode for question content, priority, etc.
  toast.info('Edit mode coming soon');
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createQuestionDetailView;
