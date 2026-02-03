/**
 * Notifications Dropdown Component
 * Bell icon with notification list in header
 */

import { createElement, on } from '../utils/dom';
import { notificationsService, Notification } from '../services/notifications';
import { toast } from '../services/toast';
import { formatRelativeTime } from '../utils/format';

export interface NotificationsDropdownProps {
  onNotificationClick?: (notification: Notification) => void;
}

let isOpen = false;
let unreadCount = 0;

/**
 * Create notifications dropdown
 */
export function createNotificationsDropdown(props: NotificationsDropdownProps = {}): HTMLElement {
  const container = createElement('div', { className: 'notifications-dropdown' });

  container.innerHTML = `
    <button class="notifications-trigger" id="notifications-trigger">
      <span class="bell-icon">🔔</span>
      <span class="notification-badge hidden" id="notification-badge">0</span>
    </button>
    <div class="notifications-panel hidden" id="notifications-panel">
      <div class="notifications-header">
        <h3>Notifications</h3>
        <button class="btn-link" id="mark-all-read">Mark all read</button>
      </div>
      <div class="notifications-list" id="notifications-list">
        <div class="loading">Loading...</div>
      </div>
    </div>
  `;

  // Bind trigger click
  const trigger = container.querySelector('#notifications-trigger');
  if (trigger) {
    on(trigger as HTMLElement, 'click', (e) => {
      e.stopPropagation();
      toggleDropdown(container, props);
    });
  }

  // Mark all as read
  const markAllBtn = container.querySelector('#mark-all-read');
  if (markAllBtn) {
    on(markAllBtn as HTMLElement, 'click', async () => {
      try {
        await notificationsService.markAllRead();
        toast.success('All notifications marked as read');
        loadNotifications(container, props);
        updateBadge(container, 0);
      } catch {
        toast.error('Failed to mark notifications as read');
      }
    });
  }

  // Close on outside click
  document.addEventListener('click', () => {
    closeDropdown(container);
  });

  // Initial count load
  loadUnreadCount(container);

  // Periodic refresh
  setInterval(() => loadUnreadCount(container), 60000);

  return container;
}

/**
 * Toggle dropdown
 */
function toggleDropdown(container: HTMLElement, props: NotificationsDropdownProps): void {
  isOpen = !isOpen;
  const panel = container.querySelector('#notifications-panel');
  
  if (panel) {
    panel.classList.toggle('hidden', !isOpen);
    
    if (isOpen) {
      loadNotifications(container, props);
    }
  }
}

/**
 * Close dropdown
 */
function closeDropdown(container: HTMLElement): void {
  isOpen = false;
  const panel = container.querySelector('#notifications-panel');
  if (panel) {
    panel.classList.add('hidden');
  }
}

/**
 * Load unread count
 */
async function loadUnreadCount(container: HTMLElement): Promise<void> {
  try {
    const count = await notificationsService.getUnreadCount();
    unreadCount = count;
    updateBadge(container, count);
  } catch {
    // Ignore
  }
}

/**
 * Update badge
 */
function updateBadge(container: HTMLElement, count: number): void {
  const badge = container.querySelector('#notification-badge') as HTMLElement;
  if (badge) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('hidden', count === 0);
  }
}

/**
 * Load notifications
 */
async function loadNotifications(container: HTMLElement, props: NotificationsDropdownProps): Promise<void> {
  const list = container.querySelector('#notifications-list') as HTMLElement;
  list.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const notifications = await notificationsService.getAll({ limit: 20 });
    renderNotifications(list, notifications, container, props);
  } catch {
    list.innerHTML = '<div class="error">Failed to load</div>';
  }
}

/**
 * Render notifications
 */
function renderNotifications(
  container: HTMLElement, 
  notifications: Notification[],
  dropdown: HTMLElement,
  props: NotificationsDropdownProps
): void {
  if (notifications.length === 0) {
    container.innerHTML = '<div class="empty">No notifications</div>';
    return;
  }

  container.innerHTML = notifications.map(n => `
    <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
      <div class="notification-icon">${getIcon(n.type)}</div>
      <div class="notification-content">
        <div class="notification-title">${escapeHtml(n.title)}</div>
        ${n.message ? `<div class="notification-message">${escapeHtml(n.message)}</div>` : ''}
        <div class="notification-time">${formatRelativeTime(n.created_at)}</div>
      </div>
      <button class="btn-icon dismiss-btn" title="Dismiss">×</button>
    </div>
  `).join('');

  // Bind click events
  container.querySelectorAll('.notification-item').forEach(item => {
    on(item as HTMLElement, 'click', async (e) => {
      if ((e.target as HTMLElement).closest('.dismiss-btn')) return;
      
      const id = item.getAttribute('data-id');
      const notification = notifications.find(n => n.id === id);
      if (notification) {
        // Mark as read
        if (!notification.read) {
          await notificationsService.markRead(id!);
          item.classList.remove('unread');
          unreadCount = Math.max(0, unreadCount - 1);
          updateBadge(dropdown, unreadCount);
        }
        
        closeDropdown(dropdown);
        props.onNotificationClick?.(notification);
      }
    });

    // Dismiss button
    const dismissBtn = item.querySelector('.dismiss-btn');
    if (dismissBtn) {
      on(dismissBtn as HTMLElement, 'click', async (e) => {
        e.stopPropagation();
        const id = item.getAttribute('data-id');
        if (!id) return;

        try {
          await notificationsService.delete(id);
          item.remove();
          if (!item.classList.contains('unread')) return;
          unreadCount = Math.max(0, unreadCount - 1);
          updateBadge(dropdown, unreadCount);
        } catch {
          // Ignore
        }
      });
    }
  });
}

/**
 * Get icon by type
 */
function getIcon(type: string): string {
  switch (type) {
    case 'question': return '❓';
    case 'risk': return '⚠️';
    case 'action': return '✅';
    case 'decision': return '⚖️';
    case 'mention': return '@';
    case 'comment': return '💬';
    case 'assignment': return '👤';
    default: return '📣';
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
 * Initialize notifications in header
 */
export function initNotificationsDropdown(
  container: HTMLElement,
  props: NotificationsDropdownProps = {}
): HTMLElement {
  const dropdown = createNotificationsDropdown(props);
  container.appendChild(dropdown);
  return dropdown;
}

export default createNotificationsDropdown;
