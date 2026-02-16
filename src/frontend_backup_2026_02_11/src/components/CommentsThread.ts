/**
 * Comments Thread Component
 * Inline comments for entities
 */

import { createElement, on } from '@lib/dom';
import { commentsService, Comment } from '@services/notifications';
import { appStore } from '@stores/app';
import { toast } from '@services/toast';
import { formatRelativeTime } from '@lib/format';

export interface CommentsThreadProps {
  targetType: 'question' | 'risk' | 'action' | 'decision' | 'contact' | 'document' | 'email';
  targetId: string;
  projectId?: string;
  onCommentAdded?: (comment: Comment) => void;
}

/**
 * Create comments thread
 */
export function createCommentsThread(props: CommentsThreadProps): HTMLElement {
  const container = createElement('div', { className: 'comments-thread' });

  container.innerHTML = `
    <div class="comments-header">
      <h4>Comments</h4>
      <span class="comments-count" id="comments-count">0</span>
    </div>
    <div class="comments-list" id="comments-list">
      <div class="loading">Loading comments...</div>
    </div>
    <div class="comment-form">
      <textarea id="comment-input" placeholder="Add a comment..." rows="2"></textarea>
      <div class="comment-form-actions">
        <button class="btn btn-primary btn-sm" id="submit-comment-btn" disabled>Comment</button>
      </div>
    </div>
  `;

  // Bind input
  const input = container.querySelector('#comment-input') as HTMLTextAreaElement;
  const submitBtn = container.querySelector('#submit-comment-btn') as HTMLButtonElement;

  on(input, 'input', () => {
    submitBtn.disabled = !input.value.trim();
  });

  on(submitBtn, 'click', () => submitComment(container, props, input));

  // Submit on Ctrl+Enter
  on(input, 'keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (input.value.trim()) {
        submitComment(container, props, input);
      }
    }
  });

  // Initial load
  loadComments(container, props);

  return container;
}

/**
 * Load comments
 */
async function loadComments(container: HTMLElement, props: CommentsThreadProps): Promise<void> {
  const list = container.querySelector('#comments-list') as HTMLElement;
  list.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const comments = await commentsService.getAll(props.targetType, props.targetId);

    renderComments(list, comments, container, props);
    updateCount(container, comments.length);
  } catch {
    list.innerHTML = '<div class="error">Failed to load comments</div>';
  }
}

/**
 * Render comments
 */
function renderComments(
  container: HTMLElement,
  comments: Comment[],
  thread: HTMLElement,
  props: CommentsThreadProps
): void {
  if (comments.length === 0) {
    container.innerHTML = '<div class="empty">No comments yet</div>';
    return;
  }

  // Group by parent
  const topLevel = comments.filter(c => !c.parent_id);
  const replies = comments.filter(c => c.parent_id);
  const repliesByParent: Record<string, Comment[]> = {};

  replies.forEach(r => {
    if (!repliesByParent[r.parent_id!]) repliesByParent[r.parent_id!] = [];
    repliesByParent[r.parent_id!].push(r);
  });

  container.innerHTML = topLevel.map(comment =>
    renderComment(comment, repliesByParent[comment.id] || [], thread, props)
  ).join('');

  bindCommentEvents(container, comments, thread, props);
}

/**
 * Render single comment
 */
function renderComment(
  comment: Comment,
  replies: Comment[],
  thread: HTMLElement,
  props: CommentsThreadProps
): string {
  const currentUser = appStore.getState().currentUser;
  const isOwn = currentUser?.id === comment.user_id;

  return `
    <div class="comment ${comment.resolved ? 'resolved' : ''}" data-id="${comment.id}">
      <div class="comment-avatar">${getInitials(comment.user_name || 'U')}</div>
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-author">${escapeHtml(comment.user_name || 'Unknown')}</span>
          <span class="comment-time">${formatRelativeTime(comment.created_at)}</span>
          ${comment.resolved ? '<span class="resolved-badge">Resolved</span>' : ''}
        </div>
        <div class="comment-content">${escapeHtml(comment.content)}</div>
        <div class="comment-actions">
          <button class="btn-link reply-btn">Reply</button>
          ${!comment.resolved ? '<button class="btn-link resolve-btn">Resolve</button>' : ''}
          ${isOwn ? '<button class="btn-link delete-btn">Delete</button>' : ''}
        </div>
        <div class="reply-form hidden">
          <textarea class="reply-input" placeholder="Reply..." rows="2"></textarea>
          <div class="reply-actions">
            <button class="btn btn-sm cancel-reply-btn">Cancel</button>
            <button class="btn btn-primary btn-sm submit-reply-btn">Reply</button>
          </div>
        </div>
      </div>
    </div>
    ${replies.length > 0 ? `
      <div class="comment-replies">
        ${replies.map(r => `
          <div class="comment reply" data-id="${r.id}">
            <div class="comment-avatar small">${getInitials(r.user_name || 'U')}</div>
            <div class="comment-body">
              <div class="comment-header">
                <span class="comment-author">${escapeHtml(r.user_name || 'Unknown')}</span>
                <span class="comment-time">${formatRelativeTime(r.created_at)}</span>
              </div>
              <div class="comment-content">${escapeHtml(r.content)}</div>
              ${currentUser?.id === r.user_id ? `
                <div class="comment-actions">
                  <button class="btn-link delete-btn">Delete</button>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

/**
 * Bind comment events
 */
function bindCommentEvents(
  container: HTMLElement,
  comments: Comment[],
  thread: HTMLElement,
  props: CommentsThreadProps
): void {
  // Reply buttons
  container.querySelectorAll('.reply-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', () => {
      const comment = btn.closest('.comment');
      const replyForm = comment?.querySelector('.reply-form');
      if (replyForm) {
        replyForm.classList.toggle('hidden');
        const input = replyForm.querySelector('.reply-input') as HTMLTextAreaElement;
        input?.focus();
      }
    });
  });

  // Cancel reply
  container.querySelectorAll('.cancel-reply-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', () => {
      const replyForm = btn.closest('.reply-form');
      if (replyForm) {
        replyForm.classList.add('hidden');
        (replyForm.querySelector('.reply-input') as HTMLTextAreaElement).value = '';
      }
    });
  });

  // Submit reply
  container.querySelectorAll('.submit-reply-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const comment = btn.closest('.comment');
      const id = comment?.getAttribute('data-id');
      const input = comment?.querySelector('.reply-input') as HTMLTextAreaElement;
      if (!id || !input?.value.trim()) return;

      try {
        await commentsService.create(props.targetType, props.targetId, input.value.trim(), id);
        toast.success('Reply added');
        loadComments(thread, props);
      } catch {
        toast.error('Failed to add reply');
      }
    });
  });

  // Resolve
  container.querySelectorAll('.resolve-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const comment = btn.closest('.comment');
      const id = comment?.getAttribute('data-id');
      if (!id) return;

      try {
        await commentsService.resolve(id);
        toast.success('Comment resolved');
        loadComments(thread, props);
      } catch {
        toast.error('Failed to resolve comment');
      }
    });
  });

  // Delete
  container.querySelectorAll('.delete-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const comment = btn.closest('.comment');
      const id = comment?.getAttribute('data-id');
      if (!id || !confirm('Delete this comment?')) return;

      try {
        await commentsService.delete(id);
        toast.success('Comment deleted');
        loadComments(thread, props);
      } catch {
        toast.error('Failed to delete comment');
      }
    });
  });
}

/**
 * Submit new comment
 */
async function submitComment(
  container: HTMLElement,
  props: CommentsThreadProps,
  input: HTMLTextAreaElement
): Promise<void> {
  const content = input.value.trim();
  if (!content) return;

  const btn = container.querySelector('#submit-comment-btn') as HTMLButtonElement;
  btn.disabled = true;

  try {
    const comment = await commentsService.create(props.targetType, props.targetId, content);

    input.value = '';
    toast.success('Comment added');
    loadComments(container, props);
    props.onCommentAdded?.(comment);
  } catch {
    toast.error('Failed to add comment');
    btn.disabled = false;
  }
}

/**
 * Update count
 */
function updateCount(container: HTMLElement, count: number): void {
  const countEl = container.querySelector('#comments-count');
  if (countEl) countEl.textContent = String(count);
}

/**
 * Get initials
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createCommentsThread;
