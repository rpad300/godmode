/**
 * Bulk Actions Component
 * Selection management and bulk operations
 */

import { createElement, on } from '@lib/dom';
import { http } from '@services/api';
import { toast } from '@services/toast';
import { undoManager } from '@services/undo';

export interface BulkActionsProps {
  type: 'questions' | 'risks' | 'actions' | 'decisions' | 'contacts' | 'documents';
  onComplete?: () => void;
}

interface BulkOperation {
  type: string;
  ids: string[];
  action: string;
  data?: Record<string, unknown>;
}

let selectedIds: Set<string> = new Set();

/**
 * Create bulk actions bar
 */
export function createBulkActionsBar(props: BulkActionsProps): HTMLElement {
  const bar = createElement('div', { className: 'bulk-actions-bar hidden' });

  bar.innerHTML = `
    <div class="bulk-info">
      <span class="bulk-count">0</span> selected
    </div>
    <div class="bulk-buttons">
      ${getActionsForType(props.type)}
      <button class="btn btn-sm btn-secondary" id="bulk-clear">Clear</button>
    </div>
  `;

  // Bind clear
  const clearBtn = bar.querySelector('#bulk-clear');
  if (clearBtn) {
    on(clearBtn as HTMLElement, 'click', () => {
      clearSelection();
      updateBar(bar);
    });
  }

  // Bind actions
  bindActionButtons(bar, props);

  return bar;
}

/**
 * Get action buttons for type
 */
function getActionsForType(type: string): string {
  const common = `
    <button class="btn btn-sm btn-danger" id="bulk-delete">Delete</button>
  `;

  switch (type) {
    case 'questions':
      return `
        <button class="btn btn-sm" id="bulk-status" data-status="resolved">Mark Resolved</button>
        <button class="btn btn-sm" id="bulk-assign">Assign To...</button>
        ${common}
      `;
    case 'actions':
      return `
        <button class="btn btn-sm" id="bulk-status" data-status="completed">Mark Complete</button>
        <button class="btn btn-sm" id="bulk-assign">Assign To...</button>
        ${common}
      `;
    case 'risks':
      return `
        <button class="btn btn-sm" id="bulk-status" data-status="mitigated">Mark Mitigated</button>
        ${common}
      `;
    case 'decisions':
      return `
        <button class="btn btn-sm" id="bulk-status" data-status="approved">Approve</button>
        <button class="btn btn-sm" id="bulk-status" data-status="rejected">Reject</button>
        ${common}
      `;
    default:
      return common;
  }
}

/**
 * Bind action buttons
 */
function bindActionButtons(bar: HTMLElement, props: BulkActionsProps): void {
  // Delete
  const deleteBtn = bar.querySelector('#bulk-delete');
  if (deleteBtn) {
    on(deleteBtn as HTMLElement, 'click', async () => {
      if (!confirm(`Delete ${selectedIds.size} items?`)) return;

      await performBulkAction({
        type: props.type,
        ids: Array.from(selectedIds),
        action: 'delete',
      }, props);
    });
  }

  // Status change
  const statusBtns = bar.querySelectorAll('[id^="bulk-status"]');
  statusBtns.forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const status = btn.getAttribute('data-status');
      if (!status) return;

      await performBulkAction({
        type: props.type,
        ids: Array.from(selectedIds),
        action: 'status',
        data: { status },
      }, props);
    });
  });

  // Assign
  const assignBtn = bar.querySelector('#bulk-assign');
  if (assignBtn) {
    on(assignBtn as HTMLElement, 'click', () => {
      const assignee = prompt('Assign to:');
      if (!assignee) return;

      performBulkAction({
        type: props.type,
        ids: Array.from(selectedIds),
        action: 'assign',
        data: { assignee },
      }, props);
    });
  }
}

/**
 * Perform bulk action
 */
async function performBulkAction(operation: BulkOperation, props: BulkActionsProps): Promise<void> {
  try {
    let endpoint = '';
    let body: Record<string, unknown> = { type: operation.type, ids: operation.ids };

    switch (operation.action) {
      case 'delete':
        endpoint = '/api/bulk/delete';
        break;
      case 'status':
        endpoint = '/api/bulk/status';
        body = { ...body, status: operation.data?.status };
        break;
      case 'assign':
        endpoint = '/api/bulk/assign';
        body = { ...body, assignee: operation.data?.assignee };
        break;
    }

    const response = await http.post<{ actionId?: string; affected: number }>(endpoint, body);

    // Register for undo if supported
    if (response.data.actionId) {
      undoManager.push({
        type: `bulk-${operation.action}`,
        description: `${operation.action} ${operation.ids.length} items`,
        undo: async () => {
          await http.post(`/api/undo/${response.data.actionId}`);
          props.onComplete?.();
        },
      });
    }

    toast.success(`Updated ${response.data.affected || operation.ids.length} items`);
    clearSelection();
    props.onComplete?.();
  } catch {
    toast.error('Bulk operation failed');
  }
}

/**
 * Toggle item selection
 */
export function toggleSelection(id: string, bar: HTMLElement): void {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }
  updateBar(bar);
}

/**
 * Select item
 */
export function selectItem(id: string, bar: HTMLElement): void {
  selectedIds.add(id);
  updateBar(bar);
}

/**
 * Deselect item
 */
export function deselectItem(id: string, bar: HTMLElement): void {
  selectedIds.delete(id);
  updateBar(bar);
}

/**
 * Clear selection
 */
export function clearSelection(): void {
  selectedIds.clear();
  // Update checkboxes in DOM
  document.querySelectorAll('.bulk-checkbox:checked').forEach(cb => {
    (cb as HTMLInputElement).checked = false;
  });
}

/**
 * Get selected IDs
 */
export function getSelectedIds(): string[] {
  return Array.from(selectedIds);
}

/**
 * Is item selected
 */
export function isSelected(id: string): boolean {
  return selectedIds.has(id);
}

/**
 * Update bar visibility and count
 */
function updateBar(bar: HTMLElement): void {
  const count = selectedIds.size;

  bar.classList.toggle('hidden', count === 0);

  const countEl = bar.querySelector('.bulk-count');
  if (countEl) {
    countEl.textContent = String(count);
  }
}

/**
 * Create checkbox for bulk selection
 */
export function createBulkCheckbox(id: string, bar: HTMLElement): HTMLElement {
  const checkbox = createElement('input', {
    type: 'checkbox',
    className: 'bulk-checkbox',
  }) as HTMLInputElement;
  checkbox.setAttribute('data-id', id);
  checkbox.checked = isSelected(id);

  on(checkbox, 'change', (e) => {
    e.stopPropagation();
    toggleSelection(id, bar);
    checkbox.checked = isSelected(id);
  });

  return checkbox;
}

export default createBulkActionsBar;
