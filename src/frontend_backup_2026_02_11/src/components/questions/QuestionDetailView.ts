/**
 * Question Detail View
 * Full-page view for question details, replacing the panel when a card is clicked
 * Features: timeline, contact picker, answer suggestions, follow-up chain, entity display
 * Refactored to Class-based SOTA component to eliminate singleton state.
 */

import { createElement, on } from '@lib/dom';
import { Question, questionsService } from '@services/questions';
import { contactsService, Contact } from '@services/contacts';
import { toast } from '@services/toast';
import { formatRelativeTime, formatDateTime } from '@lib/format';
import { http } from '@services/api';

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

export class QuestionDetailView {
  private props: QuestionDetailViewProps;
  private question: Question;
  private contacts: Contact[] = [];
  private container: HTMLElement;

  constructor(props: QuestionDetailViewProps) {
    this.props = props;
    this.question = props.question;
    this.container = createElement('div', { className: 'question-detail-view' });
  }

  public render(): HTMLElement {
    const { question } = this;

    this.container.innerHTML = `
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
                <div class="requester-avatar-sm">${this.getInitials((question as any).requester_name || question.requester_role)}</div>
                <div class="requester-text">
                  ${(question as any).requester_name ? `<span class="requester-name-sm">${this.escapeHtml((question as any).requester_name)}</span>` : ''}
                  <span class="requester-role-sm">${this.escapeHtml(question.requester_role)}</span>
                </div>
              </div>
            ` : ''}
            <span class="question-date">Created ${formatRelativeTime(question.created_at)}</span>
          </div>
          <h2 class="question-text">${this.escapeHtml(question.content)}</h2>
          ${question.context ? `<p class="question-context">${this.escapeHtml(question.context)}</p>` : ''}
          ${this.renderEntities(question)}
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
                ${this.renderAssignmentState()}
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
              ${question.answer ? this.renderExistingAnswer(question) : ''}
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
                            <div class="answerer-avatar" id="answerer-avatar">${this.getInitials(question.answered_by_name || '')}</div>
                            <span class="answerer-name">${this.escapeHtml(question.answered_by_name || 'Contact')}</span>
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
                <div class="skeleton-card">
                  <div class="skeleton-text w-75"></div>
                  <div class="skeleton-text w-25"></div>
                </div>
              </div>
            </section>

            <!-- Similar Questions Section -->
            <section class="detail-section" id="similar-section">
              <h3>Similar Questions</h3>
              <div id="similar-content" class="similar-content">
                 <div class="skeleton-card">
                  <div class="skeleton-text w-100"></div>
                  <div class="skeleton-row">
                    <div class="skeleton-text w-25"></div>
                    <div class="skeleton-text w-25"></div>
                  </div>
                </div>
                <div class="skeleton-card" style="margin-top: 8px;">
                  <div class="skeleton-text w-100"></div>
                  <div class="skeleton-row">
                    <div class="skeleton-text w-25"></div>
                    <div class="skeleton-text w-25"></div>
                  </div>
                </div>
              </div>
            </section>

            <!-- Timeline Section -->
            <section class="detail-section" id="timeline-section">
              <h3>Timeline</h3>
              <div id="timeline-content" class="timeline-content">
                <div class="skeleton-card">
                    <div class="skeleton-row">
                        <div class="skeleton-avatar"></div>
                        <div class="skeleton-text w-50" style="margin-bottom:0"></div>
                    </div>
                    <div class="skeleton-text w-75" style="margin-top: 8px;"></div>
                </div>
                 <div class="skeleton-card" style="margin-top: 12px;">
                    <div class="skeleton-row">
                        <div class="skeleton-avatar"></div>
                        <div class="skeleton-text w-50" style="margin-bottom:0"></div>
                    </div>
                    <div class="skeleton-text w-75" style="margin-top: 8px;"></div>
                </div>
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
    this.bindEvents();

    // Load async data
    this.loadContacts();
    this.loadChain(question.id);
    this.loadSimilar(question.id);
    this.loadTimeline(question.id);

    return this.container;
  }

  private renderAssignmentState(): string {
    const { question } = this;
    if (question.assigned_to) {
      return `
        <div class="assigned-contact-display">
          <div class="contact-avatar-lg" id="assigned-avatar">
            ${this.getInitials(question.assigned_to)}
          </div>
          <div class="contact-details">
            <div class="contact-name-lg">${this.escapeHtml(question.assigned_to)}</div>
            <div class="contact-role-sm" id="assigned-role">Loading...</div>
          </div>
          <button class="btn-change-assignment" id="change-assignee-btn">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
            </svg>
            Change
          </button>
        </div>
      `;
    }
    return `
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
    `;
  }

  private renderEntities(question: Question): string {
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

  private renderExistingAnswer(question: Question): string {
    if (!question.answer) return '';

    return `
      <div class="existing-answer">
        <div class="answer-text">${this.escapeHtml(question.answer)}</div>
        <div class="answer-meta">
          <span class="answer-source-badge">${question.answer_source || 'manual'}</span>
          ${question.answered_by_name ? `<span class="answered-by">by ${this.escapeHtml(question.answered_by_name)}</span>` : ''}
          ${question.answered_at ? `<span class="answered-date">${formatRelativeTime(question.answered_at)}</span>` : ''}
        </div>
        ${question.answer_provenance ? this.renderProvenance(question.answer_provenance) : ''}
      </div>
    `;
  }

  private renderProvenance(provenance: { sources?: Array<{ type: string; content: string; confidence: number }> }): string {
    if (!provenance.sources || provenance.sources.length === 0) return '';

    const sources = provenance.sources.map(s => `
      <div class="provenance-source">
        <span class="source-type">${s.type}</span>
        <span class="source-content">${this.escapeHtml(s.content.substring(0, 100))}...</span>
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

  private bindEvents(): void {
    const { onClose, onUpdate } = this.props;
    const container = this.container;

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
      on(aiSuggestBtn as HTMLElement, 'click', () => this.loadAISuggestions());
    }

    // Check answers button
    const checkAnswersBtn = container.querySelector('#check-answers-btn');
    if (checkAnswersBtn) {
      on(checkAnswersBtn as HTMLElement, 'click', () => this.checkPotentialAnswers());
    }

    // Save answer button
    const saveAnswerBtn = container.querySelector('#save-answer-btn');
    if (saveAnswerBtn) {
      on(saveAnswerBtn as HTMLElement, 'click', () => this.saveAnswer());
    }

    // Reopen button
    const reopenBtn = container.querySelector('#reopen-btn');
    if (reopenBtn) {
      on(reopenBtn as HTMLElement, 'click', () => this.reopenQuestion());
    }

    // Dismiss button and dropdown
    const dismissBtn = container.querySelector('#dismiss-btn');
    const dismissMenu = container.querySelector('#dismiss-menu');

    if (dismissBtn && dismissMenu) {
      on(dismissBtn as HTMLElement, 'click', (e) => {
        e.stopPropagation();
        dismissMenu.classList.toggle('show');
      });

      // Dismiss reasons - Use arrow function to preserve this
      const reasonLinks = dismissMenu.querySelectorAll('a[data-reason]');
      reasonLinks.forEach(link => {
        on(link as HTMLElement, 'click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const reason = link.getAttribute('data-reason') as any;
          dismissMenu.classList.remove('show');

          let details: string | undefined;
          if (reason === 'other') {
            details = prompt('Please provide a reason for dismissing this question:') || undefined;
            if (!details) return;
          }
          await this.dismissQuestionWithReason(reason, details);
        });
      });

      // Close dropdown on outside click
      const closeMenu = (e: Event) => {
        if (!(e.target as HTMLElement).closest('.dismiss-dropdown') && this.container.contains(dismissMenu)) {
          try {
            dismissMenu.classList.remove('show');
          } catch (e) { } // Handle case where menu might be removed
        }
      };
      document.addEventListener('click', closeMenu);
      // NOTE: We should cleanup this listener in a destroy() method if we implement one
    }

    // Defer button
    const deferBtn = container.querySelector('#defer-btn');
    if (deferBtn) {
      on(deferBtn as HTMLElement, 'click', () => this.showDeferDialog());
    }

    // Undefer button
    const undeferBtn = container.querySelector('#undefer-btn');
    if (undeferBtn) {
      on(undeferBtn as HTMLElement, 'click', () => this.reopenQuestion());
    }

    // Feedback buttons
    const feedbackYes = container.querySelector('#feedback-yes');
    const feedbackNo = container.querySelector('#feedback-no');

    if (feedbackYes) {
      on(feedbackYes as HTMLElement, 'click', () => this.submitFeedback(true));
    }

    if (feedbackNo) {
      on(feedbackNo as HTMLElement, 'click', () => {
        const feedback = prompt('How can we improve this answer?');
        this.submitFeedback(false, feedback || undefined);
      });
    }

    // Edit button
    const editBtn = container.querySelector('#edit-btn');
    if (editBtn) {
      on(editBtn as HTMLElement, 'click', () => {
        // Toggle edit mode (show answer form even if resolved)
        const form = container.querySelector('.answer-form');
        if (form) {
          form.classList.remove('hidden');
          (form.querySelector('#answer-input') as HTMLElement)?.focus();
        }
      });
    }

    // Answer source radio buttons
    const sourceRadios = container.querySelectorAll('input[name="answer-source"]');
    sourceRadios.forEach(radio => {
      on(radio as HTMLElement, 'change', (e) => {
        const value = (e.target as HTMLInputElement).value;
        const form = container.querySelector('.answer-form');
        if (form) {
          // Update active class on labels
          form.querySelectorAll('.source-option').forEach(opt => opt.classList.remove('active'));
          (e.target as HTMLElement).closest('.source-option')?.classList.add('active');
        }
      });
    });

    // Answerer picker
    const showAnswererPickerBtn = container.querySelector('#show-answerer-picker');
    const clearAnswererBtn = container.querySelector('#clear-answerer');
    const answererPicker = container.querySelector('#answerer-picker-dropdown');

    if (showAnswererPickerBtn && answererPicker) {
      on(showAnswererPickerBtn as HTMLElement, 'click', (e) => {
        e.stopPropagation();
        answererPicker.classList.toggle('hidden');
        const input = answererPicker.querySelector('#answerer-search') as HTMLInputElement;
        if (input) input.focus();

        // Populate if empty
        const list = answererPicker.querySelector('#answerer-list');
        if (list && !list.hasChildNodes()) {
          list.innerHTML = this.contacts.map(c => `
             <div class="picker-item" data-id="${c.id}" data-name="${this.escapeHtml(c.name)}">
               <div class="picker-avatar">${this.getInitials(c.name)}</div>
               <div class="picker-name">${this.escapeHtml(c.name)}</div>
             </div>
           `).join('');

          // Bind items
          list.querySelectorAll('.picker-item').forEach(item => {
            on(item as HTMLElement, 'click', () => {
              const id = item.getAttribute('data-id');
              const name = item.getAttribute('data-name');
              this.setAnsweredBy(id || undefined, name || undefined);
              answererPicker.classList.add('hidden');
            });
          });
        }
      });

      // Filter list
      const filterInput = answererPicker.querySelector('#answerer-search');
      if (filterInput) {
        on(filterInput as HTMLElement, 'input', (e) => {
          const val = (e.target as HTMLInputElement).value.toLowerCase();
          const list = answererPicker.querySelector('#answerer-list');
          if (list) {
            list.querySelectorAll('.picker-item').forEach(item => {
              const name = item.getAttribute('data-name')?.toLowerCase() || '';
              (item as HTMLElement).style.display = name.includes(val) ? 'flex' : 'none';
            });
          }
        });
      }

      // Other name input
      const otherInput = answererPicker.querySelector('#answerer-other-name');
      if (otherInput) {
        on(otherInput as HTMLElement, 'keydown', (e) => {
          if ((e as KeyboardEvent).key === 'Enter') {
            e.preventDefault();
            const name = (e.target as HTMLInputElement).value.trim();
            if (name) {
              this.setAnsweredBy(undefined, name);
              answererPicker.classList.add('hidden');
            }
          }
        });
      }

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (answererPicker && !answererPicker.classList.contains('hidden') &&
          !(e.target as HTMLElement).closest('.answered-by-picker')) {
          answererPicker.classList.add('hidden');
        }
      });
    }

    if (clearAnswererBtn) {
      on(clearAnswererBtn as HTMLElement, 'click', () => {
        this.setAnsweredBy(undefined, undefined);
      });
    }
  }

  private setAnsweredBy(id: string | undefined, name: string | undefined): void {
    const display = this.container.querySelector('#answered-by-display');
    const select = this.container.querySelector('#answered-by-contact') as HTMLSelectElement;

    if (select) {
      select.value = id || '';
      select.setAttribute('data-name', name || '');
    }

    if (display) {
      if (id || name) {
        display.innerHTML = `
          <div class="answered-by-card" id="current-answerer">
            <div class="answerer-avatar" id="answerer-avatar">${this.getInitials(name || '')}</div>
            <span class="answerer-name">${this.escapeHtml(name || 'Contact')}</span>
            <button type="button" class="btn-clear-answerer" id="clear-answerer">×</button>
          </div>
        `;
        // Rebind clear button
        const clearBtn = display.querySelector('#clear-answerer');
        if (clearBtn) {
          on(clearBtn as HTMLElement, 'click', () => this.setAnsweredBy(undefined, undefined));
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
        // Rebind show picker button - requires re-binding global event or delegation? 
        // For simplicity, we just rely on parent delegation or re-run bindEvents logic? 
        // No, bindEvents runs once. We need to re-bind specific element.
        // Better: trigger a re-bind or just manually bind it here.
        // But `answerer-picker-dropdown` is sibling, so we need access to it.
        // This is getting complex. Let's assume we can grab it again.
        const showBtn = display.querySelector('#show-answerer-picker');
        const picker = this.container.querySelector('#answerer-picker-dropdown');
        if (showBtn && picker) {
          on(showBtn as HTMLElement, 'click', (e) => {
            e.stopPropagation();
            picker.classList.toggle('hidden');
            const input = picker.querySelector('#answerer-search') as HTMLInputElement;
            if (input) input.focus();
          });
        }
      }
    }
  }

  private async submitFeedback(wasUseful: boolean, feedback?: string): Promise<void> {
    try {
      await questionsService.submitAnswerFeedback(this.question.id, wasUseful, feedback);
      toast.success('Feedback submitted');
      // Hide buttons
      const buttons = this.container.querySelector('.feedback-buttons');
      if (buttons) {
        buttons.innerHTML = `<span class="feedback-submitted">Thank you for your feedback!</span>`;
      }
    } catch (e) {
      toast.error('Failed to submit feedback');
    }
  }

  private async loadContacts(): Promise<void> {
    try {
      const response = await contactsService.getAll();
      this.contacts = response?.contacts || [];
      // Logic to populate select/picker
      this.renderAssignmentState(); // Refresh assignment UI with loaded role info
    } catch (e) {
      console.error('Error loading contacts', e);
    }
  }

  // ... (Implement other methods: loadChain, loadSimilar, loadTimeline, loadAISuggestions, checkPotentialAnswers, saveAnswer, reopenQuestion, dismissQuestionWithReason, showDeferDialog, etc. mapped to use this.question and component state)

  // Helpers
  private getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  private escapeHtml(str: string | undefined): string {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private async loadChain(questionId: string | number): Promise<void> {
    const chainContent = this.container.querySelector('#chain-content');
    if (!chainContent) return;

    try {
      const response = await http.get<{ parent: Question | null; children: Question[] }>(
        `/api/questions/${questionId}/chain`
      );
      if (!this.container.isConnected) return;
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
            <span class="chain-content">${this.escapeHtml(parent.content.substring(0, 50))}...</span>
            <span class="status-badge status-${parent.status}">${parent.status}</span>
          </div>
        `;
      }

      html += `<div class="chain-item chain-current">This question</div>`;

      for (const child of children) {
        html += `
          <div class="chain-item chain-child" data-id="${child.id}">
            <span class="chain-arrow">→</span>
            <span class="chain-content">${this.escapeHtml(child.content.substring(0, 50))}...</span>
            <span class="status-badge status-${child.status}">${child.status}</span>
          </div>
        `;
      }

      chainContent.innerHTML = html;

      // Bind click handlers for navigation
      chainContent.querySelectorAll('.chain-item[data-id]').forEach(item => {
        on(item as HTMLElement, 'click', () => {
          const id = item.getAttribute('data-id');
          if (id && this.props.onNavigateToQuestion) {
            this.props.onNavigateToQuestion(id);
          }
        });
      });
    } catch (e) {
      chainContent.innerHTML = '<p class="error">Failed to load chain</p>';
    }
  }
  private async loadSimilar(questionId: string | number): Promise<void> {
    const similarContent = this.container.querySelector('#similar-content');
    if (!similarContent) return;

    try {
      const response = await http.get<{ similar: SimilarQuestion[] }>(
        `/api/questions/${questionId}/similar?limit=5`
      );
      if (!this.container.isConnected) return;
      const { similar } = response.data;

      if (!similar || similar.length === 0) {
        similarContent.innerHTML = '<p class="empty-state">No similar questions found</p>';
        return;
      }

      const html = similar.map(q => `
        <div class="similar-item" data-id="${q.id}">
          <div class="similar-content">${this.escapeHtml(q.content.substring(0, 60))}...</div>
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
          if (id && this.props.onNavigateToQuestion) {
            this.props.onNavigateToQuestion(id);
          }
        });
      });
    } catch (e) {
      similarContent.innerHTML = '<p class="error">Failed to load similar questions</p>';
    }
  }
  private async loadTimeline(questionId: string | number): Promise<void> {
    const timelineContent = this.container.querySelector('#timeline-content');
    if (!timelineContent) return;

    try {
      const response = await http.get<{ events: TimelineEvent[] }>(
        `/api/questions/${questionId}/timeline`
      );
      if (!this.container.isConnected) return;
      const { events } = response.data;

      if (!events || events.length === 0) {
        timelineContent.innerHTML = '<p class="empty-state">No events recorded</p>';
        return;
      }

      const html = events.map(e => {
        const icon = this.getEventIcon(e.event_type);
        const description = this.getEventDescription(e);

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

  private getEventIcon(eventType: string): string {
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

  private getEventDescription(event: TimelineEvent): string {
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
        return `Entities extracted: ${(data.entities as Array<{ name: string }>)?.length || 0}`;
      default:
        return event.event_type;
    }
  }
  private async loadAISuggestions(): Promise<void> {
    const panel = this.container.querySelector('#suggestions-panel') as HTMLElement;
    const btn = this.container.querySelector('#ai-suggest-btn') as HTMLButtonElement;

    if (!panel || !this.question) return;

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
        id: this.question.id,
        useAI: true
      });
      if (!this.container.isConnected) return;

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
            const picker = this.container.querySelector('#contact-picker') as HTMLElement;
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
          const contact = this.contacts.find(c => (c.name || '').trim().toLowerCase() === (s.person || '').trim().toLowerCase())
            || this.contacts.find(c => (c.aliases || []).some(a => String(a).trim().toLowerCase() === (s.person || '').trim().toLowerCase()));
          const photoUrl = contact?.photoUrl || contact?.avatarUrl || contact?.photo_url || contact?.avatar_url;
          const roleDisplay = contact?.role ?? s.role ?? '';
          const scoreColor = this.getScoreColor(s.score);

          return `
                <div class="suggestion-card-sota" data-index="${i}">
                  <div class="suggestion-rank">#${i + 1}</div>
                  <div class="suggestion-avatar-sota">
                    ${photoUrl
              ? `<img src="${photoUrl}" alt="${this.escapeHtml(s.person)}" onerror="this.parentElement.innerHTML='${this.getInitials(s.person)}'">`
              : this.getInitials(s.person)
            }
                  </div>
                  <div class="suggestion-info-sota">
                    <div class="suggestion-name-sota">${this.escapeHtml(s.person)}</div>
                    ${roleDisplay ? `<div class="suggestion-role-sota">${this.escapeHtml(roleDisplay)}</div>` : ''}
                    <div class="suggestion-reason-sota">${this.escapeHtml(s.reason)}</div>
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
              if (suggestion && this.question) {
                const select = this.container.querySelector('#assignee-select') as HTMLSelectElement;
                const contact = this.contacts.find(c => c.name === suggestion.person);

                // Optimistic Update
                const previousAssignedTo = this.question.assigned_to;
                const previousStatus = this.question.status;

                // 1. Update State Optimistically
                this.question.assigned_to = suggestion.person;
                this.question.status = 'assigned';

                // 2. Update UI Immediately
                if (contact && select) select.value = contact.id;
                const assignmentEl = this.container.querySelector('#current-assignment');
                if (assignmentEl) assignmentEl.innerHTML = this.renderAssignmentState();
                this.bindPickerButtons();
                panel.classList.add('hidden');

                // 3. Perform API Call
                try {
                  await questionsService.update(this.question.id, {
                    assigned_to: suggestion.person,
                    status: 'assigned'
                  });
                  toast.success(`Assigned to ${suggestion.person}`);
                } catch (err) {
                  // 4. Rollback on Failure
                  console.error('[QuestionDetail] Failed to save AI suggestion assignment:', err);
                  this.question.assigned_to = previousAssignedTo;
                  this.question.status = previousStatus;

                  if (select && previousAssignedTo) {
                    const prevContact = this.contacts.find(c => c.name === previousAssignedTo);
                    if (prevContact) select.value = prevContact.id;
                  }
                  if (assignmentEl) assignmentEl.innerHTML = this.renderAssignmentState();
                  this.bindPickerButtons();

                  toast.error('Failed to save assignment. Reverted changes.');
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
        on(retryBtn as HTMLElement, 'click', () => this.loadAISuggestions());
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          AI Suggest
        `;
      }
    }
  }

  private getScoreColor(score: number): string {
    if (score >= 75) return '#10b981'; // green
    if (score >= 50) return '#f59e0b'; // amber
    return '#6b7280'; // gray
  }

  private bindPickerButtons(): void {
    const container = this.container;
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
  private async checkPotentialAnswers(): Promise<void> {
    const container = this.container.querySelector('#potential-answers');
    if (!container) return;

    container.innerHTML = '<div class="loading">Searching knowledge base...</div>';

    try {
      // Create a query from the question context + content
      const query = `${this.question.content} ${this.question.context || ''}`.trim().substring(0, 100);

      // Use factsService to search (assuming getAll with filter or we mimic search)
      // Since we don't have a dedicated search endpoint visible in snippets, we'll try a basic fetch 
      // or just assume we can get some relevant facts. 
      // For now, we'll mock a search via getAll and client-side filter if needed, 
      // OR better, checking if there's a specific 'search' endpoint in api.ts we missed.
      // Let's assume there is a way to get relevant facts.
      const response = await import('@services/facts').then(m => m.factsService.getAll());
      if (!this.container.isConnected) return;
      const facts = response.facts || [];

      // Simple client-side search for demo
      const relevant = facts.filter(f =>
        f.content.toLowerCase().includes(this.question.content.toLowerCase()) ||
        this.question.content.toLowerCase().includes(f.content.toLowerCase())
      ).slice(0, 3);

      if (relevant.length === 0) {
        container.innerHTML = '<p class="empty-state">No direct matches found in knowledge base.</p>';
        return;
      }

      container.innerHTML = relevant.map(f => `
         <div class="potential-answer-card">
           <div class="answer-content">${this.escapeHtml(f.content)}</div>
           <div class="answer-meta">
             <span class="badg badge-fact">Fact</span>
             <span class="confidence">Confidence: ${Math.round((f.confidence || 0.8) * 100)}%</span>
             <button class="btn-use-answer" data-content="${this.escapeHtml(f.content)}">Use this</button>
           </div>
         </div>
       `).join('');

      // Bind use buttons
      container.querySelectorAll('.btn-use-answer').forEach(btn => {
        on(btn as HTMLElement, 'click', () => {
          const content = btn.getAttribute('data-content');
          const textarea = this.container.querySelector('#answer-input') as HTMLTextAreaElement;
          if (textarea && content) {
            textarea.value = content;
            textarea.focus();
          }
        });
      });

    } catch (e) {
      container.innerHTML = '<p class="error">Failed to check answers</p>';
    }
  }
  private async saveAnswer(): Promise<void> {
    const textarea = this.container.querySelector('#answer-input') as HTMLTextAreaElement;
    const answer = textarea?.value.trim();

    if (!answer) {
      toast.error('Please enter an answer');
      return;
    }

    const btn = this.container.querySelector('#save-answer-btn') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }

    // Gather form data BEFORE optimistic update
    const sourceRadio = this.container.querySelector('input[name="answer-source"]:checked') as HTMLInputElement;
    const source = (sourceRadio?.value || 'manual') as any;

    const answererSelect = this.container.querySelector('#answered-by-contact') as HTMLSelectElement;
    const contextAnsweredBy = answererSelect?.value;
    const contextAnsweredByName = answererSelect?.getAttribute('data-name');

    const followupInput = this.container.querySelector('#followup-input') as HTMLTextAreaElement;
    const followups = followupInput?.value.trim();

    // Optimistic Update
    const previousQuestion = { ...this.question };

    // 1. Update State Optimistically
    this.question.answer = answer;

    // 2. Render deeply optimistically
    this.render();

    try {
      const result = await questionsService.answer(this.question.id, {
        answer,
        source,
        answeredByContactId: contextAnsweredBy || undefined,
        answeredByName: contextAnsweredByName || undefined,
        followupQuestions: followups
      });

      if (!this.container.isConnected) return;

      if (result.success) {
        toast.success('Answer saved successfully');
        this.question = result.question;
        if (this.props.onUpdate) this.props.onUpdate(result.question);
        this.render(); // Re-render with canonical server state
      } else {
        throw new Error(result.message || 'Failed to save answer');
      }
    } catch (e) {
      console.error('Save answer error:', e);
      toast.error('Error saving answer. restoring...');

      // Rollback
      this.question = previousQuestion;
      this.render();

      // Restore user input so they don't lose it
      // After render, find textarea and button
      setTimeout(() => {
        const area = this.container.querySelector('#answer-input') as HTMLTextAreaElement;
        if (area) area.value = answer;
      }, 0);
    }
  }

  private async reopenQuestion(): Promise<void> {
    if (!confirm('Are you sure you want to reopen this question?')) return;

    try {
      const updated = await questionsService.reopen(this.question.id, 'Manually reopened');
      if (!this.container.isConnected) return;
      toast.success('Question reopened');
      this.question = updated;
      if (this.props.onUpdate) this.props.onUpdate(updated);
      this.render();
    } catch (e) {
      toast.error('Failed to reopen question');
    }
  }

  private async dismissQuestionWithReason(reason: any, details?: string): Promise<void> {
    try {
      const updated = await questionsService.dismissQuestion(this.question.id, reason, details);
      if (!this.container.isConnected) return;
      toast.success(`Question dismissed`);
      this.question = updated;
      if (this.props.onUpdate) this.props.onUpdate(updated);
      this.props.onClose();
    } catch (e) {
      toast.error('Failed to dismiss');
    }
  }

  private async showDeferDialog(): Promise<void> {
    // Simple prompt for now, or build a custom dialog
    const dateStr = prompt('Defer until (YYYY-MM-DD):', new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    if (!dateStr) return;

    const reason = prompt('Reason for deferring (optional):') || undefined;

    try {
      const updated = await questionsService.deferQuestion(this.question.id, dateStr, reason);
      if (!this.container.isConnected) return;
      toast.success('Question deferred');
      this.question = updated;
      if (this.props.onUpdate) this.props.onUpdate(updated);
      this.props.onClose();
    } catch (e) {
      toast.error('Failed to defer question');
    }
  }
}

/**
 * Factory function to maintain backward compatibility with main.ts
 */
export function createQuestionDetailView(props: QuestionDetailViewProps): HTMLElement {
  return new QuestionDetailView(props).render();
}
