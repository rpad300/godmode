/**
 * Notifications Modal Component
 * Display and manage notifications
 */

import { createElement, on, addClass, removeClass } from '@lib/dom';
import { createModal, openModal, closeModal } from '@components/Modal';
import { http } from '@services/api';
import { toast } from '@services/toast';
import { formatRelativeTime } from '@lib/format';

const MODAL_ID = 'notifications-modal';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'mention' | 'update';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
  actor?: {
    name: string;
    avatar?: string;
  };
}

export interface NotificationsModalProps {
  onMarkAllRead?: () => void;
  onNotificationClick?: (notification: Notification) => void;
}

let notifications: Notification[] = [];
let filter: 'all' | 'unread' = 'all';

/**
 * Show notifications modal
 */
export async function showNotificationsModal(props: NotificationsModalProps = {}): Promise<void> {
  filter = 'all';

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'notifications-modal-content' });
  content.innerHTML = '<div class="loading">Loading notifications...</div>';

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });

  const markAllBtn = createElement('button', {
    className: 'btn btn-secondary',
    textContent: 'Mark All Read',
  });

  const closeBtn = createElement('button', {
    className: 'btn btn-primary',
    textContent: 'Close',
  });

  on(markAllBtn, 'click', async () => {
    try {
      await http.post('/api/notifications/mark-all-read');
      notifications.forEach(n => n.read = true);
      render();
      toast.success('All marked as read');
      props.onMarkAllRead?.();
    } catch {
      // Error shown by API service
    }
  });

  on(closeBtn, 'click', () => closeModal(MODAL_ID));

  footer.appendChild(markAllBtn);
  footer.appendChild(closeBtn);

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: 'Notifications',
    content,
    size: 'md',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  // Load notifications
  try {
    const response = await http.get<Notification[]>('/api/notifications');
    notifications = response.data;
    render();
  } catch {
    content.innerHTML = '<div class="error">Failed to load notifications</div>';
  }

  function render(): void {
    const filtered = filter === 'unread'
      ? notifications.filter(n => !n.read)
      : notifications;

    const unreadCount = notifications.filter(n => !n.read).length;

    content.innerHTML = `
      <div class="notifications-header">
        <div class="filter-tabs">
          <button class="filter-tab ${filter === 'all' ? 'active' : ''}" data-filter="all">
            All (${notifications.length})
          </button>
          <button class="filter-tab ${filter === 'unread' ? 'active' : ''}" data-filter="unread">
            Unread (${unreadCount})
          </button>
        </div>
      </div>
      
      ${filtered.length === 0 ? `
        <div class="empty-state">
          <span class="empty-icon">🔔</span>
          <p>${filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
        </div>
      ` : `
        <div class="notifications-list">
          ${filtered.map(n => renderNotification(n)).join('')}
        </div>
      `}
    `;

    // Bind filter tabs
    content.querySelectorAll('.filter-tab').forEach(tab => {
      on(tab as HTMLElement, 'click', () => {
        filter = tab.getAttribute('data-filter') as 'all' | 'unread';
        render();
      });
    });

    // Bind notification clicks
    content.querySelectorAll('.notification-item').forEach(item => {
      const id = item.getAttribute('data-notification-id');
      const notification = notifications.find(n => n.id === id);

      if (notification) {
        on(item as HTMLElement, 'click', async () => {
          // Mark as read
          if (!notification.read) {
            try {
              await http.patch(`/api/notifications/${id}/read`);
              notification.read = true;
              removeClass(item as HTMLElement, 'unread');
            } catch {
              // Silent fail
            }
          }

          props.onNotificationClick?.(notification);

          // Navigate if link exists
          if (notification.link) {
            closeModal(MODAL_ID);
            // Handle navigation
          }
        });
      }
    });
  }
}

/**
 * Render single notification
 */
function renderNotification(notification: Notification): string {
  const icon = getNotificationIcon(notification.type);

  return `
    <div class="notification-item ${notification.read ? '' : 'unread'}" 
         data-notification-id="${notification.id}">
      <div class="notification-icon ${notification.type}">${icon}</div>
      <div class="notification-content">
        <div class="notification-title">${escapeHtml(notification.title)}</div>
        <div class="notification-message">${escapeHtml(notification.message)}</div>
        <div class="notification-meta">
          ${notification.actor ? `<span class="notification-actor">${escapeHtml(notification.actor.name)}</span> • ` : ''}
          <span class="notification-time">${formatRelativeTime(notification.createdAt)}</span>
        </div>
      </div>
      ${!notification.read ? '<div class="notification-dot"></div>' : ''}
    </div>
  `;
}

/**
 * Get icon for notification type
 */
function getNotificationIcon(type: Notification['type']): string {
  switch (type) {
    case 'info': return 'ℹ️';
    case 'success': return '✅';
    case 'warning': return '⚠️';
    case 'error': return '❌';
    case 'mention': return '💬';
    case 'update': return '🔄';
    default: return '🔔';
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

export default showNotificationsModal;
