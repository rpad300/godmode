/**
 * Shortcuts Modal Component
 * Display keyboard shortcuts reference
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { shortcuts } from '../../services/shortcuts';

const MODAL_ID = 'shortcuts-modal';

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: 'Undo last action' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Ctrl', 'S'], description: 'Save current item' },
      { keys: ['Esc'], description: 'Close modal / Cancel' },
      { keys: ['?'], description: 'Show this help' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', '1'], description: 'Go to Dashboard' },
      { keys: ['Ctrl', '2'], description: 'Go to Chat' },
      { keys: ['Ctrl', '3'], description: 'Go to Source of Truth' },
      { keys: ['Ctrl', '4'], description: 'Go to Timeline' },
      { keys: ['Ctrl', '5'], description: 'Go to Contacts' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Quick search' },
      { keys: ['Ctrl', 'N'], description: 'New item' },
      { keys: ['Ctrl', 'E'], description: 'Export data' },
      { keys: ['Ctrl', 'Shift', 'T'], description: 'Toggle theme' },
    ],
  },
  {
    title: 'Chat',
    shortcuts: [
      { keys: ['Enter'], description: 'Send message' },
      { keys: ['Shift', 'Enter'], description: 'New line' },
      { keys: ['↑'], description: 'Previous message' },
    ],
  },
];

/**
 * Show shortcuts modal
 */
export function showShortcutsModal(): void {
  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'shortcuts-modal-content' });

  // Get registered shortcuts from service
  const registeredShortcuts = shortcuts.getAll();

  content.innerHTML = `
    <div class="shortcuts-grid">
      ${shortcutGroups.map(group => `
        <div class="shortcut-group">
          <h4>${group.title}</h4>
          <div class="shortcut-list">
            ${group.shortcuts.map(s => `
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  ${s.keys.map(k => `<kbd>${k}</kbd>`).join(' + ')}
                </div>
                <div class="shortcut-desc">${s.description}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
    
    ${registeredShortcuts.length > 0 ? `
      <div class="shortcuts-custom">
        <h4>Active Shortcuts</h4>
        <div class="shortcut-list">
          ${registeredShortcuts.map(s => {
            const keys: string[] = [];
            if (s.ctrl) keys.push('Ctrl');
            if (s.shift) keys.push('Shift');
            if (s.alt) keys.push('Alt');
            if (s.meta) keys.push('Cmd');
            keys.push(s.key.toUpperCase());
            
            return `
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  ${keys.map(k => `<kbd>${k}</kbd>`).join(' + ')}
                </div>
                <div class="shortcut-desc">${s.description}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}
    
    <div class="shortcuts-tip">
      <p class="text-muted">
        💡 Tip: Most shortcuts use Ctrl on Windows/Linux or Cmd on Mac.
      </p>
    </div>
  `;

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });

  const closeBtn = createElement('button', {
    className: 'btn btn-primary',
    textContent: 'Got it',
  });

  on(closeBtn, 'click', () => closeModal(MODAL_ID));
  footer.appendChild(closeBtn);

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: 'Keyboard Shortcuts',
    content,
    size: 'lg',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);
}

export default showShortcutsModal;
