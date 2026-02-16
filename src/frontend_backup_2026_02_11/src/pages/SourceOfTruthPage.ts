/**
 * Source of Truth Component
 * Displays questions, risks, actions, and decisions
 */

import { createElement, on, addClass, removeClass } from '@lib/dom';
import { uiStore, SotView } from '@stores/ui';
import { dataStore, Question, Risk, Action, Decision } from '@stores/data';
import { formatRelativeTime } from '@lib/format';
import { createQuestionDetailView } from './questions/QuestionDetailView';
import { Question as QuestionAPI } from '@services/questions';
import { createQuestionsPanel as createFullQuestionsPanel } from './sot/QuestionsPanel';

export interface SourceOfTruthProps {
  onQuestionClick?: (question: Question) => void;
  onRiskClick?: (risk: Risk) => void;
  onActionClick?: (action: Action) => void;
  onDecisionClick?: (decision: Decision) => void;
}

/**
 * Create Source of Truth component
 */
export function createSourceOfTruth(props: SourceOfTruthProps = {}): HTMLElement {
  const container = createElement('div', { className: 'source-of-truth' });

  // Tabs
  const tabs = createElement('div', { className: 'tabs' });
  const tabConfigs: Array<{ id: SotView; label: string; icon: string }> = [
    { id: 'questions', label: 'Questions', icon: '❓' },
    { id: 'risks', label: 'Risks', icon: '⚠️' },
    { id: 'actions', label: 'Actions', icon: '✅' },
    { id: 'decisions', label: 'Decisions', icon: '🎯' },
  ];

  tabConfigs.forEach(config => {
    const tab = createElement('button', {
      className: 'tab',
    });
    tab.setAttribute('data-tab', config.id);
    tab.innerHTML = `${config.icon} ${config.label} <span class="badge" data-count="0">0</span>`;

    on(tab, 'click', () => {
      uiStore.setSotView(config.id);
    });

    tabs.appendChild(tab);
  });

  container.appendChild(tabs);

  // Content panels
  const panels = createElement('div', { className: 'tab-panels' });

  // Use the full QuestionsPanel with Generate button and filters
  const questionsPanel = createFullQuestionsPanel({
    onQuestionClick: props.onQuestionClick as unknown as (q: QuestionAPI) => void,
    useDetailView: true,
    containerElement: container
  });
  questionsPanel.classList.add('tab-panel');

  const risksPanel = createRisksPanel(props.onRiskClick);
  const actionsPanel = createActionsPanel(props.onActionClick);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decisionsPanel = createDecisionsPanel({
    onDecisionClick: props.onDecisionClick as any,
    useDetailView: true,
    containerElement: container
  });

  questionsPanel.setAttribute('data-panel', 'questions');
  risksPanel.setAttribute('data-panel', 'risks');
  actionsPanel.setAttribute('data-panel', 'actions');
  decisionsPanel.setAttribute('data-panel', 'decisions');

  panels.appendChild(questionsPanel);
  panels.appendChild(risksPanel);
  panels.appendChild(actionsPanel);
  panels.appendChild(decisionsPanel);

  container.appendChild(panels);

  // Subscribe to UI state changes
  uiStore.subscribe((state) => {
    // Update active tab
    tabs.querySelectorAll('.tab').forEach(tab => {
      const tabId = tab.getAttribute('data-tab');
      if (tabId === state.sotCurrentView) {
        addClass(tab as HTMLElement, 'active');
      } else {
        removeClass(tab as HTMLElement, 'active');
      }
    });

    // Update active panel
    panels.querySelectorAll('[data-panel]').forEach(panel => {
      const panelId = panel.getAttribute('data-panel');
      if (panelId === state.sotCurrentView) {
        addClass(panel as HTMLElement, 'active');
      } else {
        removeClass(panel as HTMLElement, 'active');
      }
    });
  });

  // Subscribe to data changes
  dataStore.subscribe((data) => {
    // Update badges
    const questionsBadge = tabs.querySelector('[data-tab="questions"] .badge');
    const risksBadge = tabs.querySelector('[data-tab="risks"] .badge');
    const actionsBadge = tabs.querySelector('[data-tab="actions"] .badge');
    const decisionsBadge = tabs.querySelector('[data-tab="decisions"] .badge');

    if (questionsBadge) questionsBadge.textContent = String(data.questions.length);
    if (risksBadge) risksBadge.textContent = String(data.risks.length);
    if (actionsBadge) actionsBadge.textContent = String(data.actions.length);
    if (decisionsBadge) decisionsBadge.textContent = String(data.decisions.length);

    // Re-render panels
    renderQuestions(questionsPanel, data.questions, props.onQuestionClick);
    renderRisks(risksPanel, data.risks, props.onRiskClick);
    renderActions(actionsPanel, data.actions, props.onActionClick);
    renderDecisions(decisionsPanel, data.decisions, props.onDecisionClick);
  });

  // Set initial active state
  const initialView = uiStore.getState().sotCurrentView;
  const initialTab = tabs.querySelector(`[data-tab="${initialView}"]`);
  const initialPanel = panels.querySelector(`[data-panel="${initialView}"]`);
  if (initialTab) addClass(initialTab as HTMLElement, 'active');
  if (initialPanel) addClass(initialPanel as HTMLElement, 'active');

  return container;
}

// NOTE: createQuestionsPanel is now imported from './sot/QuestionsPanel' as createFullQuestionsPanel
// The legacy inline version has been removed in favor of the full-featured panel

/**
 * Render questions list
 */
function renderQuestions(panel: HTMLElement, questions: Question[], onClick?: (q: Question) => void): void {
  const list = panel.querySelector('.questions-list');
  if (!list) return;

  if (questions.length === 0) {
    list.innerHTML = '<div class="empty-state">No questions yet</div>';
    return;
  }

  list.innerHTML = questions.map(q => `
    <div class="question-card ${q.status}" data-id="${q.id}">
      <div class="question-header">
        <span class="priority-badge priority-${q.priority}">${q.priority}</span>
        <span class="status-badge ${q.status}">${q.status}</span>
      </div>
      <div class="question-text">${escapeHtml(q.content || q.question || '')}</div>
      ${q.answer ? `<div class="question-answer">${escapeHtml(q.answer)}</div>` : ''}
      <div class="question-meta">${formatRelativeTime(q.created_at || q.createdAt || new Date().toISOString())}</div>
    </div>
  `).join('');

  // Always bind click to open detail view
  list.querySelectorAll('.question-card').forEach(card => {
    on(card as HTMLElement, 'click', () => {
      const id = card.getAttribute('data-id');
      const question = questions.find(q => q.id === id || String(q.id) === id);
      if (question) {
        // Call onClick if provided (for modal fallback)
        if (onClick) {
          onClick(question);
        }

        // Show the detail view
        showQuestionDetail(panel, question as unknown as QuestionAPI, questions as unknown as QuestionAPI[]);
      }
    });
  });
}

/**
 * Show question detail view (replaces the panel content)
 */
function showQuestionDetail(panel: HTMLElement, question: QuestionAPI, allQuestions: QuestionAPI[]): void {
  // Store original content
  const originalContent = panel.innerHTML;

  // Create detail view
  const detailView = createQuestionDetailView({
    question,
    onClose: () => {
      // Restore original content
      panel.innerHTML = originalContent;
      // Re-render questions
      const questions = dataStore.getState().questions;
      renderQuestions(panel, questions);
    },
    onUpdate: (updatedQuestion) => {
      // Update the question in data store
      const questions = dataStore.getState().questions;
      const index = questions.findIndex(q => q.id === updatedQuestion.id || String(q.id) === String(updatedQuestion.id));
      if (index >= 0) {
        questions[index] = updatedQuestion as unknown as Question;
        dataStore.setQuestions(questions);
      }
    },
    onNavigateToQuestion: (questionId) => {
      // Navigate to another question
      const targetQuestion = allQuestions.find(q => String(q.id) === questionId);
      if (targetQuestion) {
        showQuestionDetail(panel, targetQuestion, allQuestions);
      }
    }
  });

  // Replace panel content with detail view
  panel.innerHTML = '';
  panel.appendChild(detailView);
}

/**
 * Create risks panel
 */
function createRisksPanel(onClick?: (r: Risk) => void): HTMLElement {
  const panel = createElement('div', { className: 'tab-panel risks-panel' });
  panel.innerHTML = '<div class="risks-list"></div>';
  return panel;
}

/**
 * Render risks list
 */
function renderRisks(panel: HTMLElement, risks: Risk[], onClick?: (r: Risk) => void): void {
  const list = panel.querySelector('.risks-list');
  if (!list) return;

  if (risks.length === 0) {
    list.innerHTML = '<div class="empty-state">No risks identified</div>';
    return;
  }

  list.innerHTML = risks.map(r => `
    <div class="risk-card ${r.impact}-impact" data-id="${r.id}">
      <div class="risk-header">
        <span class="impact-badge impact-${r.impact}">${r.impact} impact</span>
        <span class="probability-badge">${r.probability} probability</span>
      </div>
      <div class="risk-description">${escapeHtml(r.description || r.content || '')}</div>
      ${r.mitigation ? `<div class="risk-mitigation">Mitigation: ${escapeHtml(r.mitigation)}</div>` : ''}
    </div>
  `).join('');

  if (onClick) {
    list.querySelectorAll('.risk-card').forEach(card => {
      on(card as HTMLElement, 'click', () => {
        const id = card.getAttribute('data-id');
        const risk = risks.find(r => r.id === id);
        if (risk) onClick(risk);
      });
    });
  }
}

/**
 * Create actions panel
 */
function createActionsPanel(onClick?: (a: Action) => void): HTMLElement {
  const panel = createElement('div', { className: 'tab-panel actions-panel' });
  panel.innerHTML = '<div class="actions-list"></div>';
  return panel;
}

/**
 * Render actions list
 */
function renderActions(panel: HTMLElement, actions: Action[], onClick?: (a: Action) => void): void {
  const list = panel.querySelector('.actions-list');
  if (!list) return;

  if (actions.length === 0) {
    list.innerHTML = '<div class="empty-state">No actions defined</div>';
    return;
  }

  list.innerHTML = actions.map(a => `
    <div class="action-card ${a.status}" data-id="${a.id}">
      <div class="action-header">
        <span class="priority-badge priority-${a.priority}">${a.priority}</span>
        <span class="status-badge ${a.status}">${a.status.replace('_', ' ')}</span>
      </div>
      <div class="action-task">${escapeHtml(a.task)}</div>
      <div class="action-meta">
        ${a.assignee ? `<span>Assigned to: ${escapeHtml(a.assignee)}</span>` : ''}
        ${a.dueDate ? `<span>Due: ${a.dueDate}</span>` : ''}
      </div>
    </div>
  `).join('');

  if (onClick) {
    list.querySelectorAll('.action-card').forEach(card => {
      on(card as HTMLElement, 'click', () => {
        const id = card.getAttribute('data-id');
        const action = actions.find(a => a.id === id);
        if (action) onClick(action);
      });
    });
  }
}

/**
 * Create decisions panel
 */
function createDecisionsPanel(propsOrCallback?: { onDecisionClick?: (d: Decision) => void; useDetailView?: boolean; containerElement?: HTMLElement } | ((d: Decision) => void)): HTMLElement {
  const panel = createElement('div', { className: 'tab-panel decisions-panel' });
  panel.innerHTML = '<div class="decisions-list"></div>';
  return panel;
}

/**
 * Render decisions list
 */
function renderDecisions(panel: HTMLElement, decisions: Decision[], onClick?: (d: Decision) => void): void {
  const list = panel.querySelector('.decisions-list');
  if (!list) return;

  if (decisions.length === 0) {
    list.innerHTML = '<div class="empty-state">No decisions recorded</div>';
    return;
  }

  list.innerHTML = decisions.map(d => `
    <div class="decision-card" data-id="${d.id}">
      <div class="decision-header">
        <span class="status-badge ${d.status}">${d.status}</span>
      </div>
      <div class="decision-text">${escapeHtml((d as any).content ?? d.decision ?? '')}</div>
      ${d.rationale ? `<div class="decision-rationale">Rationale: ${escapeHtml(d.rationale)}</div>` : ''}
      <div class="decision-meta">
        ${((d as any).made_by ?? d.madeBy) ? `<span>By: ${escapeHtml((d as any).made_by ?? d.madeBy ?? '')}</span>` : ''}
        <span>${formatRelativeTime((d as any).decided_at ?? (d as any).created_at ?? d.madeAt ?? '')}</span>
      </div>
    </div>
  `).join('');

  if (onClick) {
    list.querySelectorAll('.decision-card').forEach(card => {
      on(card as HTMLElement, 'click', () => {
        const id = card.getAttribute('data-id');
        const decision = decisions.find(d => d.id === id);
        if (decision) onClick(decision);
      });
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

/**
 * Mount to container
 */
export function mountSourceOfTruth(selector: string, props: SourceOfTruthProps = {}): HTMLElement | null {
  const container = document.querySelector(selector);
  if (!container) {
    console.warn(`SourceOfTruth: Container not found: ${selector}`);
    return null;
  }

  const sot = createSourceOfTruth(props);
  container.appendChild(sot);
  return sot;
}

export default createSourceOfTruth;
