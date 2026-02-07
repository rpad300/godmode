/**
 * Notifications Service
 * Handles notifications and collaboration features
 */

import { http } from './api';

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'mention' | 'assignment' | 'update' | 'reminder';
  title: string;
  message: string;
  entity_type?: 'question' | 'risk' | 'action' | 'decision' | 'document' | 'contact' | 'project';
  entity_id?: string;
  is_read: boolean;
  read?: boolean; // Alias for is_read
  created_at: string;
  read_at?: string;
  action_url?: string;
}

export interface Comment {
  id: string;
  entity_type: 'question' | 'risk' | 'action' | 'decision' | 'document' | 'contact';
  entity_id: string;
  content: string;
  author: string;
  author_id?: string;
  user_id?: string;
  user_name?: string;
  mentions?: string[];
  reactions?: Array<{
    emoji: string;
    users: string[];
  }>;
  parent_id?: string;
  replies?: Comment[];
  resolved?: boolean;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
  updated_at?: string;
  is_edited: boolean;
}

export interface ProjectMember {
  id: string;
  user_id: string;
  project_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  email: string;
  name?: string;
  avatar_url?: string;
  joined_at: string;
  invited_by?: string;
  last_active?: string;
}

/**
 * Get all notifications
 */
export async function getNotifications(options?: {
  unread?: boolean;
  type?: string;
  limit?: number;
}): Promise<Notification[]> {
  try {
    const params = new URLSearchParams();
    if (options?.unread) params.set('unread', 'true');
    if (options?.type) params.set('type', options.type);
    if (options?.limit) params.set('limit', String(options.limit));

    const query = params.toString();
    const url = query ? `/api/notifications?${query}` : '/api/notifications';

    const response = await http.get<{ notifications: Notification[] }>(url);
    return response.data.notifications || [];
  } catch {
    return [];
  }
}

/**
 * Get unread count
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const response = await http.get<{ count: number }>('/api/notifications/count');
    return response.data.count || 0;
  } catch {
    return 0;
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(id: string): Promise<void> {
  await http.post(`/api/notifications/${id}/read`);
}

/**
 * Mark all as read
 */
export async function markAllAsRead(): Promise<void> {
  await http.post('/api/notifications/read-all');
}

/**
 * Delete a notification
 */
export async function deleteNotification(id: string): Promise<void> {
  await http.delete(`/api/notifications/${id}`);
}

/**
 * Get comments for an entity
 */
export async function getComments(entityType: string, entityId: string): Promise<Comment[]> {
  try {
    const response = await http.get<{ comments: Comment[] }>(`/api/comments/${entityType}/${entityId}`);
    return response.data.comments || [];
  } catch {
    return [];
  }
}

/**
 * Add a comment
 */
export async function addComment(entityType: string, entityId: string, content: string, parentId?: string): Promise<Comment> {
  const response = await http.post<{ comment: Comment; id: string }>(`/api/comments/${entityType}/${entityId}`, {
    content,
    parentId,
  });
  return response.data.comment || {
    id: response.data.id,
    entity_type: entityType as Comment['entity_type'],
    entity_id: entityId,
    content,
    author: 'You',
    created_at: new Date().toISOString(),
    is_edited: false,
  };
}

/**
 * Update a comment
 */
export async function updateComment(commentId: string, content: string): Promise<void> {
  await http.put(`/api/comments/${commentId}`, { content });
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string): Promise<void> {
  await http.delete(`/api/comments/${commentId}`);
}

/**
 * Add reaction to comment
 */
export async function addReaction(commentId: string, emoji: string): Promise<void> {
  await http.post(`/api/comments/${commentId}/react`, { emoji });
}

/**
 * Remove reaction from comment
 */
export async function removeReaction(commentId: string, emoji: string): Promise<void> {
  await http.delete(`/api/comments/${commentId}/react/${emoji}`);
}

/**
 * Create comment (alias for addComment)
 */
export async function createComment(entityType: string, entityId: string, content: string, parentId?: string): Promise<Comment> {
  return addComment(entityType, entityId, content, parentId);
}

/**
 * Resolve a comment thread
 */
export async function resolveComment(commentId: string): Promise<void> {
  await http.put(`/api/comments/${commentId}/resolve`);
}

/**
 * Get project members
 */
export async function getProjectMembers(projectId?: string): Promise<ProjectMember[]> {
  try {
    const url = projectId ? `/api/projects/${projectId}/members` : '/api/project/members';
    const response = await http.get<{ members: ProjectMember[] }>(url);
    return response.data.members || [];
  } catch {
    return [];
  }
}

/**
 * Invite member to project
 */
export async function inviteMember(email: string, role: 'admin' | 'editor' | 'viewer', projectId?: string): Promise<{ success: boolean; inviteId: string }> {
  const url = projectId ? `/api/projects/${projectId}/members` : '/api/project/members';
  const response = await http.post<{ success: boolean; inviteId: string }>(url, { email, role });
  return response.data;
}

/**
 * Update member role
 */
export async function updateMemberRole(memberId: string, role: 'admin' | 'editor' | 'viewer', projectId?: string): Promise<void> {
  const url = projectId ? `/api/projects/${projectId}/members/${memberId}` : `/api/project/members/${memberId}`;
  await http.put(url, { role });
}

/**
 * Remove member from project
 */
export async function removeMember(memberId: string, projectId?: string): Promise<void> {
  const url = projectId ? `/api/projects/${projectId}/members/${memberId}` : `/api/project/members/${memberId}`;
  await http.delete(url);
}

export const notificationsService = {
  getAll: getNotifications,
  getUnreadCount,
  markAsRead,
  markRead: markAsRead, // Alias
  markAllAsRead,
  markAllRead: markAllAsRead, // Alias
  delete: deleteNotification,
};

export const commentsService = {
  getAll: getComments,
  add: addComment,
  create: createComment,
  update: updateComment,
  delete: deleteComment,
  addReaction,
  removeReaction,
  resolve: resolveComment,
};

export interface PendingInvite {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  invited_at: string;
  created_at?: string;
  invited_by?: string;
  status: 'pending' | 'accepted' | 'expired';
}

/**
 * Get pending invites for a project
 */
export async function getInvites(projectId?: string): Promise<PendingInvite[]> {
  try {
    const url = projectId ? `/api/projects/${projectId}/invites` : '/api/project/invites';
    const response = await http.get<{ invites: PendingInvite[] }>(url);
    return response.data.invites || [];
  } catch {
    return [];
  }
}

export const membersService = {
  getAll: getProjectMembers,
  invite: inviteMember,
  updateRole: updateMemberRole,
  remove: removeMember,
  getInvites,
};
