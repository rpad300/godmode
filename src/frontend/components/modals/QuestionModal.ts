/**
 * Question Modal Component
 * View, create, edit, and answer questions with AI suggestions
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { 
  questionsService, 
  Question, 
  CreateQuestionRequest, 
  AssigneeSuggestion 
} from '../../services/questions';
import { toast } from '../../services/toast';
import { formatRelativeTime } from '../../utils/format';

const MODAL_ID = 'question-modal';

export interface QuestionModalProps {
  mode: 'view' | 'answer' | 'create' | 'edit';
  question?: Question;
  onSave?: (question: Question) => void;
  onDismiss?: (questionId: string | number) => void;
  onDelete?: (questionId: string | number) => void;
}

let currentSuggestions: AssigneeSuggestion[] = [];

/**
 * Show question modal
 */
export function showQuestionModal(props: QuestionModalProps): void {
  const { mode, question, onSave, onDismiss } = props;
  currentSuggestions = [];

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'question-modal-content' });

  if (mode === 'create') {
    renderCreateForm(content);
  } else if (mode === 'edit' && question) {
    renderEditForm(content, question);
  } else if (question) {
    renderQuestionView(content, question, mode === 'answer');
  }

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });
  createFooterButtons(footer, mode, question, content, props);

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: getModalTitle(mode),
    content,
    size: 'lg',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);
}

/**
 * Get modal title based on mode
 */
function getModalTitle(mode: string): string {
  switch (mode) {
    case 'create': return 'New Question';
    case 'edit': return 'Edit Question';
    case 'answer': return 'Answer Question';
    default: return 'Question Details';
  }
}

/**
 * Create footer buttons based on mode
 */
function createFooterButtons(
  footer: HTMLElement,
  mode: string,
  question: Question | undefined,
  content: HTMLElement,
  props: QuestionModalProps
): void {
  const { onSave, onDismiss, onDelete } = props;

  if (mode === 'create') {
    const cancelBtn = createElement('button', { className: 'btn btn-secondary', textContent: 'Cancel' });
    const createBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Create Question' });

    on(cancelBtn, 'click', () => closeModal(MODAL_ID));
    on(createBtn, 'click', () => handleCreate(content, onSave));

    footer.appendChild(cancelBtn);
    footer.appendChild(createBtn);
  } else if (mode === 'edit' && question) {
    const cancelBtn = createElement('button', { className: 'btn btn-secondary', textContent: 'Cancel' });
    const saveBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Save Changes' });

    on(cancelBtn, 'click', () => closeModal(MODAL_ID));
    on(saveBtn, 'click', () => handleEdit(content, question, onSave));

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
  } else if (question) {
    const status = question.status;

    if (status !== 'resolved' && status !== 'dismissed') {
      const dismissBtn = createElement('button', { className: 'btn btn-secondary', textContent: 'Dismiss' });
      on(dismissBtn, 'click', () => handleDismiss(question.id, onDismiss));
      footer.appendChild(dismissBtn);

      if (mode === 'answer') {
        const saveAnswerBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Save Answer' });
        on(saveAnswerBtn, 'click', () => handleAnswer(content, question, onSave));
        footer.appendChild(saveAnswerBtn);
      } else {
        const answerBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Answer' });
        on(answerBtn, 'click', () => {
          closeModal(MODAL_ID);
          showQuestionModal({ ...props, mode: 'answer' });
        });
        footer.appendChild(answerBtn);
      }
    } else if (status === 'resolved') {
      const reopenBtn = createElement('button', { className: 'btn btn-warning', textContent: 'Reopen' });
      on(reopenBtn, 'click', () => handleReopen(question, onSave));
      footer.appendChild(reopenBtn);
    }

    const closeBtn = createElement('button', { className: 'btn btn-secondary', textContent: 'Close' });
    on(closeBtn, 'click', () => closeModal(MODAL_ID));
    footer.appendChild(closeBtn);
  }
}

/**
 * Render create form
 */
function renderCreateForm(container: HTMLElement): void {
  container.innerHTML = `
    <form id="question-form" class="question-form">
      <div class="form-group">
        <label for="question-content">Question <span class="required">*</span></label>
        <textarea id="question-content" rows="3" required minlength="5"
                  placeholder="What needs to be clarified? (min 5 characters)"></textarea>
        <div id="duplicate-warning" class="form-warning hidden"></div>
      </div>
      
      <div class="form-group">
        <label for="question-context">Context</label>
        <textarea id="question-context" rows="2"
                  placeholder="Why is this question important?"></textarea>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="question-priority">Priority</label>
          <select id="question-priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="question-assignee">Assign To</label>
          <input type="text" id="question-assignee" placeholder="Person name">
          <button type="button" id="suggest-assignee-btn" class="btn btn-sm btn-secondary">
            AI Suggest
          </button>
        </div>
      </div>
      
      <div id="suggestions-container" class="suggestions-container hidden"></div>
    </form>
  `;

  // Bind AI suggest button
  const suggestBtn = container.querySelector('#suggest-assignee-btn');
  if (suggestBtn) {
    on(suggestBtn as HTMLElement, 'click', () => loadAssigneeSuggestions(container));
  }
}

/**
 * Render edit form
 */
function renderEditForm(container: HTMLElement, question: Question): void {
  container.innerHTML = `
    <form id="question-form" class="question-form">
      <div class="form-group">
        <label for="question-content">Question <span class="required">*</span></label>
        <textarea id="question-content" rows="3" required minlength="5">${escapeHtml(question.content)}</textarea>
      </div>
      
      <div class="form-group">
        <label for="question-context">Context</label>
        <textarea id="question-context" rows="2">${escapeHtml(question.context || '')}</textarea>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="question-priority">Priority</label>
          <select id="question-priority">
            <option value="low" ${question.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${question.priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${question.priority === 'high' ? 'selected' : ''}>High</option>
            <option value="critical" ${question.priority === 'critical' ? 'selected' : ''}>Critical</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="question-status">Status</label>
          <select id="question-status">
            <option value="pending" ${question.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="assigned" ${question.status === 'assigned' ? 'selected' : ''}>Assigned</option>
            <option value="resolved" ${question.status === 'resolved' ? 'selected' : ''}>Resolved</option>
            <option value="dismissed" ${question.status === 'dismissed' ? 'selected' : ''}>Dismissed</option>
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label for="question-assignee">Assigned To</label>
        <input type="text" id="question-assignee" value="${escapeHtml(question.assigned_to || '')}">
      </div>
      
      <div class="form-group">
        <label for="question-category">Category</label>
        <input type="text" id="question-category" value="${escapeHtml(question.category || '')}">
      </div>
    </form>
  `;
}

/**
 * Render question view
 */
function renderQuestionView(container: HTMLElement, question: Question, showAnswerField: boolean): void {
  container.innerHTML = `
    <div class="question-view">
      <div class="question-meta">
        <span class="priority-badge priority-${question.priority}">${question.priority}</span>
        <span class="status-badge status-${question.status}">${question.status}</span>
        <span class="question-date">${formatRelativeTime(question.created_at)}</span>
        ${question.assigned_to ? `<span class="question-assignee">→ ${escapeHtml(question.assigned_to)}</span>` : ''}
      </div>
      
      <div class="question-content-large">
        ${escapeHtml(question.content)}
      </div>
      
      ${question.context ? `<div class="question-context"><strong>Context:</strong> ${escapeHtml(question.context)}</div>` : ''}
      ${question.category ? `<div class="question-category"><strong>Category:</strong> ${escapeHtml(question.category)}</div>` : ''}
      ${question.source_file ? `<div class="question-source"><strong>Source:</strong> ${escapeHtml(question.source_file)}</div>` : ''}
      
      ${question.answer ? `
        <div class="question-answer-section">
          <h4>Answer ${question.answer_source ? `<span class="answer-source">(${question.answer_source})</span>` : ''}</h4>
          <div class="answer-text">${escapeHtml(question.answer)}</div>
          ${question.resolved_at ? `<div class="answer-date">Resolved ${formatRelativeTime(question.resolved_at)}</div>` : ''}
        </div>
      ` : ''}
      
      ${showAnswerField && question.status !== 'resolved' ? `
        <div class="answer-form">
          <div class="form-group">
            <label for="question-answer">Your Answer <span class="required">*</span></label>
            <textarea id="question-answer" rows="4" required minlength="3"
                      placeholder="Provide an answer (min 3 characters)..."></textarea>
          </div>
          <div class="form-group">
            <label for="answer-source">Source</label>
            <select id="answer-source">
              <option value="manual" selected>Manual</option>
              <option value="document">From Document</option>
              <option value="ai">AI Assisted</option>
            </select>
          </div>
          <div class="form-group">
            <label for="followup-questions">Follow-up Questions (one per line)</label>
            <textarea id="followup-questions" rows="2"
                      placeholder="Add any follow-up questions..."></textarea>
          </div>
        </div>
      ` : ''}
      
      ${question.reopened_reason ? `
        <div class="reopen-reason">
          <strong>Reopen Reason:</strong> ${escapeHtml(question.reopened_reason)}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Load AI assignee suggestions
 */
async function loadAssigneeSuggestions(container: HTMLElement): Promise<void> {
  const contentInput = container.querySelector('#question-content') as HTMLTextAreaElement;
  const content = contentInput?.value.trim();

  if (!content || content.length < 5) {
    toast.warning('Please enter at least 5 characters for the question');
    return;
  }

  const suggestionsContainer = container.querySelector('#suggestions-container') as HTMLElement;
  const suggestBtn = container.querySelector('#suggest-assignee-btn') as HTMLButtonElement;

  suggestBtn.disabled = true;
  suggestBtn.textContent = 'Loading...';
  suggestionsContainer.classList.remove('hidden');
  suggestionsContainer.innerHTML = '<div class="loading">Getting AI suggestions...</div>';

  try {
    const result = await questionsService.suggestAssignee({ content, useAI: true });
    currentSuggestions = result.suggestions;

    if (currentSuggestions.length === 0) {
      suggestionsContainer.innerHTML = '<div class="no-suggestions">No suggestions available</div>';
    } else {
      suggestionsContainer.innerHTML = `
        <h4>AI Suggestions ${result.cached ? '<span class="cached">(cached)</span>' : ''}</h4>
        <div class="suggestions-list">
          ${currentSuggestions.map((s, i) => `
            <div class="suggestion-item" data-index="${i}">
              <div class="suggestion-person">${escapeHtml(s.person)}</div>
              <div class="suggestion-score">${s.score}%</div>
              <div class="suggestion-reason">${escapeHtml(s.reason)}</div>
              ${s.role ? `<div class="suggestion-role">${escapeHtml(s.role)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;

      // Bind click to select suggestion
      suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
        on(item as HTMLElement, 'click', () => {
          const index = parseInt(item.getAttribute('data-index') || '0', 10);
          const suggestion = currentSuggestions[index];
          if (suggestion) {
            const assigneeInput = container.querySelector('#question-assignee') as HTMLInputElement;
            if (assigneeInput) {
              assigneeInput.value = suggestion.person;
            }
            suggestionsContainer.classList.add('hidden');
            toast.success(`Selected: ${suggestion.person}`);
          }
        });
      });
    }
  } catch {
    suggestionsContainer.innerHTML = '<div class="error">Failed to get suggestions</div>';
  } finally {
    suggestBtn.disabled = false;
    suggestBtn.textContent = 'AI Suggest';
  }
}

/**
 * Handle create
 */
async function handleCreate(
  container: HTMLElement,
  onSave?: (question: Question) => void
): Promise<void> {
  const form = container.querySelector('#question-form') as HTMLFormElement;
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const getValue = (id: string) => {
    const el = container.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    return el?.value.trim() || '';
  };

  const data: CreateQuestionRequest = {
    content: getValue('question-content'),
    priority: getValue('question-priority') as 'low' | 'medium' | 'high' | 'critical',
    assigned_to: getValue('question-assignee') || undefined,
    context: getValue('question-context') || undefined,
  };

  try {
    const result = await questionsService.create(data);

    if (result.duplicate) {
      const warning = container.querySelector('#duplicate-warning') as HTMLElement;
      if (warning) {
        warning.classList.remove('hidden');
        warning.innerHTML = `⚠️ Similar question exists (${result.similarity}% match). <a href="#" id="view-duplicate">View existing</a>`;
      }
      return;
    }

    toast.success('Question created');
    
    const newQuestion: Question = {
      id: result.id || Date.now(),
      content: data.content,
      priority: data.priority || 'medium',
      status: data.assigned_to ? 'assigned' : 'pending',
      assigned_to: data.assigned_to,
      context: data.context,
      created_at: new Date().toISOString(),
    };

    onSave?.(newQuestion);
    closeModal(MODAL_ID);
  } catch {
    // Error shown by API service
  }
}

/**
 * Handle edit
 */
async function handleEdit(
  container: HTMLElement,
  question: Question,
  onSave?: (question: Question) => void
): Promise<void> {
  const getValue = (id: string) => {
    const el = container.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    return el?.value.trim() || '';
  };

  try {
    const updated = await questionsService.update(question.id, {
      content: getValue('question-content'),
      context: getValue('question-context') || undefined,
      priority: getValue('question-priority') as 'low' | 'medium' | 'high' | 'critical',
      status: getValue('question-status') as 'pending' | 'assigned' | 'resolved' | 'dismissed',
      assigned_to: getValue('question-assignee') || undefined,
      category: getValue('question-category') || undefined,
    });

    toast.success('Question updated');
    onSave?.(updated);
    closeModal(MODAL_ID);
  } catch {
    // Error shown by API service
  }
}

/**
 * Handle answer
 */
async function handleAnswer(
  container: HTMLElement,
  question: Question,
  onSave?: (question: Question) => void
): Promise<void> {
  const answerInput = container.querySelector('#question-answer') as HTMLTextAreaElement;
  const sourceSelect = container.querySelector('#answer-source') as HTMLSelectElement;
  const followupInput = container.querySelector('#followup-questions') as HTMLTextAreaElement;

  const answer = answerInput?.value.trim();
  const source = sourceSelect?.value || 'manual';
  const followupQuestions = followupInput?.value.trim();

  if (!answer || answer.length < 3) {
    toast.warning('Please provide an answer (at least 3 characters)');
    return;
  }

  try {
    const result = await questionsService.answer(question.id, {
      answer,
      source: source as 'manual' | 'document' | 'ai',
      followupQuestions,
    });

    toast.success(result.message);
    onSave?.(result.question);
    closeModal(MODAL_ID);
  } catch {
    // Error shown by API service
  }
}

/**
 * Handle dismiss
 */
async function handleDismiss(
  questionId: string | number,
  onDismiss?: (questionId: string | number) => void
): Promise<void> {
  const { confirm } = await import('../Modal');
  const confirmed = await confirm(
    'Are you sure you want to dismiss this question?',
    {
      title: 'Dismiss Question',
      confirmText: 'Dismiss',
    }
  );

  if (confirmed) {
    try {
      await questionsService.delete(questionId, 'dismissed');
      toast.success('Question dismissed');
      onDismiss?.(questionId);
      closeModal(MODAL_ID);
    } catch {
      // Error shown by API service
    }
  }
}

/**
 * Handle reopen
 */
async function handleReopen(
  question: Question,
  onSave?: (question: Question) => void
): Promise<void> {
  const { prompt } = await import('../Modal');
  const reason = await prompt('Why are you reopening this question?', {
    title: 'Reopen Question',
    placeholder: 'Enter reason...',
  });

  if (reason) {
    try {
      const updated = await questionsService.reopen(question.id, reason);
      toast.success('Question reopened');
      onSave?.(updated);
      closeModal(MODAL_ID);
    } catch {
      // Error shown by API service
    }
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

export default showQuestionModal;
