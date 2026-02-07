/**
 * Profile Service
 * Handles user profile management
 */

import { http } from './api';
import { appStore, User } from '../stores/app';

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  timezone?: string;
  locale?: string;
  bio?: string;
  role?: 'user' | 'admin' | 'superadmin';
  preferences?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface UpdateProfileRequest {
  username?: string;
  display_name?: string;
  avatar_url?: string;
  timezone?: string;
  locale?: string;
  bio?: string;
  preferences?: Record<string, unknown>;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

/**
 * Get current user profile
 */
export async function getProfile(): Promise<UserProfile | null> {
  try {
    const response = await http.get<{ profile: UserProfile }>('/api/profile');
    return response.data.profile;
  } catch {
    return null;
  }
}

/**
 * Update user profile
 */
export async function updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
  const response = await http.put<{ profile: UserProfile }>('/api/profile', data);
  
  // Update app store with new user info
  const currentUser = appStore.getState().currentUser;
  if (currentUser) {
    appStore.setCurrentUser({
      ...currentUser,
      name: data.display_name || currentUser.name,
      avatar: data.avatar_url || currentUser.avatar,
    });
  }
  
  return response.data.profile;
}

/**
 * Upload avatar
 */
export async function uploadAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await fetch('/api/profile/avatar', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Avatar upload failed');
  }

  const data = await response.json();
  
  // Update app store
  const currentUser = appStore.getState().currentUser;
  if (currentUser) {
    appStore.setCurrentUser({
      ...currentUser,
      avatar: data.avatar_url,
    });
  }
  
  return data.avatar_url;
}

/**
 * Remove avatar
 */
export async function removeAvatar(): Promise<void> {
  await http.delete('/api/profile/avatar');
  
  // Update app store
  const currentUser = appStore.getState().currentUser;
  if (currentUser) {
    appStore.setCurrentUser({
      ...currentUser,
      avatar: undefined,
    });
  }
}

/**
 * Change password
 */
export async function changePassword(data: ChangePasswordRequest): Promise<void> {
  if (data.new_password.length < 12) {
    throw new Error('New password must be at least 12 characters');
  }

  await http.post('/api/profile/change-password', data);
}

/**
 * Delete account
 */
export async function deleteAccount(password: string): Promise<void> {
  await http.post('/api/profile/delete', { password });
  appStore.setCurrentUser(null);
  appStore.setCurrentProject(null);
}

/**
 * Get user activity
 */
export async function getActivity(limit = 50): Promise<Array<{
  type: string;
  action: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
}>> {
  try {
    const response = await http.get<{ activities: Array<{
      type: string;
      action: string;
      entity_type: string;
      entity_id: string;
      timestamp: string;
    }> }>(`/api/profile/activity?limit=${limit}`);
    return response.data.activities || [];
  } catch {
    return [];
  }
}

/**
 * Get user sessions
 */
export async function getSessions(): Promise<Array<{
  id: string;
  device: string;
  location?: string;
  ip_address: string;
  last_active: string;
  is_current: boolean;
}>> {
  try {
    const response = await http.get<{ sessions: Array<{
      id: string;
      device: string;
      location?: string;
      ip_address: string;
      last_active: string;
      is_current: boolean;
    }> }>('/api/profile/sessions');
    return response.data.sessions || [];
  } catch {
    return [];
  }
}

/**
 * Revoke a session
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await http.delete(`/api/profile/sessions/${sessionId}`);
}

/**
 * Revoke all other sessions
 */
export async function revokeAllSessions(): Promise<void> {
  await http.post('/api/profile/sessions/revoke-all');
}

export const profileService = {
  get: getProfile,
  update: updateProfile,
  uploadAvatar,
  removeAvatar,
  changePassword,
  deleteAccount,
  getActivity,
  getSessions,
  revokeSession,
  revokeAllSessions,
};
