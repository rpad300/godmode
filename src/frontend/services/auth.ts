/**
 * Auth Service
 * Handles authentication state and API calls
 */

import { http } from './api';
import { appStore, User } from '../stores/app';
import { toast } from './toast';

// Types
export interface AuthStatus {
  configured: boolean;
  url?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface OTPRequestResponse {
  success: boolean;
  message?: string;
  expiresInMinutes?: number;
  config?: OTPConfig;
  retryAfter?: number;
}

export interface OTPVerifyResponse {
  success: boolean;
  user?: AuthUser;
  redirectTo?: string;
  error?: string;
  attemptsRemaining?: number;
  needsEmailVerification?: boolean;
  fallbackToPassword?: boolean;
}

export interface OTPConfig {
  codeLength: number;
  expirationMinutes: number;
  resendCooldownSeconds: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username?: string;
  display_name?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  email_confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
  user_metadata?: {
    username?: string;
    display_name?: string;
  };
  profile?: UserProfile | null;
}

export interface UserProfile {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  timezone?: string;
  preferences?: Record<string, unknown>;
  role?: 'user' | 'admin' | 'superadmin'; // Application role from user_profiles table
}

export interface LoginResponse {
  success: boolean;
  user: AuthUser;
}

export interface RegisterResponse {
  success: boolean;
  user: AuthUser;
  session?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  needsEmailVerification: boolean;
}

export interface MeResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

// Auth state
let isInitialized = false;
let authCheckPromise: Promise<boolean> | null = null;

/**
 * Check if authentication is configured (Supabase)
 */
export async function checkAuthStatus(): Promise<AuthStatus> {
  try {
    const response = await http.get<AuthStatus>('/api/auth/status');
    const configured = response.data.configured;
    appStore.setAuthConfigured(configured);
    return response.data;
  } catch {
    appStore.setAuthConfigured(false);
    return { configured: false };
  }
}

/**
 * Check current session and get user
 */
export async function checkSession(): Promise<User | null> {
  try {
    const response = await http.get<MeResponse>('/api/auth/me');
    
    if (response.data.authenticated && response.data.user) {
      const authUser = response.data.user;
      const user = mapAuthUserToUser(authUser);
      appStore.setCurrentUser(user);
      return user;
    }
    
    appStore.setCurrentUser(null);
    return null;
  } catch {
    appStore.setCurrentUser(null);
    return null;
  }
}

/**
 * Initialize auth - check status and session
 * When Supabase is configured, always requires valid authentication
 */
export async function initAuth(): Promise<boolean> {
  // Prevent multiple simultaneous checks
  if (authCheckPromise) {
    return authCheckPromise;
  }

  authCheckPromise = (async () => {
    try {
      // Check if auth is configured
      const status = await checkAuthStatus();
      
      if (!status.configured) {
        // Auth not configured - allow guest mode
        isInitialized = true;
        return false;
      }

      // Auth is configured - check current session
      // If session is invalid, user MUST login
      const user = await checkSession();
      isInitialized = true;
      
      if (!user) {
        // No valid session - clear any stale user data
        appStore.setCurrentUser(null);
        console.log('🔐 Supabase configured but no valid session - login required');
        return false;
      }
      
      return true;
    } catch {
      // Auth check failed - clear user and require login
      appStore.setCurrentUser(null);
      isInitialized = true;
      return false;
    } finally {
      authCheckPromise = null;
    }
  })();

  return authCheckPromise;
}

/**
 * Login with email and password
 */
export async function login(credentials: LoginRequest): Promise<User> {
  const response = await http.post<LoginResponse>('/api/auth/login', credentials);
  
  if (!response.data.success) {
    throw new Error('Login failed');
  }

  const user = mapAuthUserToUser(response.data.user);
  appStore.setCurrentUser(user);
  return user;
}

/**
 * Register new account
 */
export async function register(data: RegisterRequest): Promise<{ user: User; needsEmailVerification: boolean }> {
  // Validate password length (min 12 chars as per server)
  if (data.password.length < 12) {
    throw new Error('Password must be at least 12 characters');
  }

  // Validate username if provided
  if (data.username && data.username.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }

  if (data.username && !/^[a-zA-Z0-9_]+$/.test(data.username)) {
    throw new Error('Username can only contain letters, numbers, and underscores');
  }

  const response = await http.post<RegisterResponse>('/api/auth/register', data);
  
  if (!response.data.success) {
    throw new Error('Registration failed');
  }

  const user = mapAuthUserToUser(response.data.user);
  
  // Only set user if no email verification required
  if (!response.data.needsEmailVerification) {
    appStore.setCurrentUser(user);
  }

  return { 
    user, 
    needsEmailVerification: response.data.needsEmailVerification 
  };
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  try {
    await http.post('/api/auth/logout');
  } catch {
    // Ignore logout errors - clear local state anyway
  }
  
  appStore.setCurrentUser(null);
  appStore.setCurrentProject(null);
}

/**
 * Request password reset
 */
export async function forgotPassword(email: string): Promise<void> {
  await http.post('/api/auth/forgot-password', { email });
  // Always succeeds - doesn't reveal if email exists
}

/**
 * Reset password with token
 */
export async function resetPassword(password: string, accessToken: string): Promise<void> {
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters');
  }

  const response = await http.post<{ success: boolean }>('/api/auth/reset-password', {
    password,
    access_token: accessToken,
  });

  if (!response.data.success) {
    throw new Error('Password reset failed');
  }
}

/**
 * Refresh session token
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const response = await http.post<{ success: boolean }>('/api/auth/refresh');
    return response.data.success;
  } catch {
    return false;
  }
}

/**
 * Request OTP code for passwordless login
 */
export async function requestLoginCode(email: string): Promise<OTPRequestResponse> {
  const response = await http.post<OTPRequestResponse>('/api/auth/otp/request', { email });
  return response.data;
}

/**
 * Verify OTP code and complete login
 */
export async function verifyLoginCode(email: string, code: string): Promise<User> {
  const response = await http.post<OTPVerifyResponse>('/api/auth/otp/verify', { email, code });
  
  if (!response.data.success) {
    const error = new Error(response.data.error || 'Verification failed') as Error & {
      attemptsRemaining?: number;
      needsEmailVerification?: boolean;
      fallbackToPassword?: boolean;
    };
    error.attemptsRemaining = response.data.attemptsRemaining;
    error.needsEmailVerification = response.data.needsEmailVerification;
    error.fallbackToPassword = response.data.fallbackToPassword;
    throw error;
  }
  
  // Handle redirect if needed (magic link flow)
  if (response.data.redirectTo) {
    window.location.href = response.data.redirectTo;
    throw new Error('Redirecting...');
  }
  
  if (!response.data.user) {
    throw new Error('Login completed but no user data received');
  }
  
  const user = mapAuthUserToUser(response.data.user);
  appStore.setCurrentUser(user);
  return user;
}

/**
 * Get OTP configuration
 */
export async function getOTPConfig(): Promise<OTPConfig> {
  try {
    const response = await http.get<OTPConfig>('/api/auth/otp/config');
    return response.data;
  } catch {
    // Return defaults if API fails
    return {
      codeLength: 6,
      expirationMinutes: 10,
      resendCooldownSeconds: 60
    };
  }
}

/**
 * Confirm email with code
 */
export async function confirmEmail(email: string, code: string): Promise<void> {
  const response = await http.post<{ success: boolean; message?: string; error?: string }>('/api/auth/confirm-email', { email, code });
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Confirmation failed');
  }
}

/**
 * Resend email confirmation code
 */
export async function resendConfirmation(email: string): Promise<{ expiresInMinutes?: number }> {
  const response = await http.post<{ success: boolean; message?: string; expiresInMinutes?: number; error?: string; retryAfter?: number }>('/api/auth/resend-confirmation', { email });
  
  if (!response.data.success) {
    const error = new Error(response.data.error || 'Failed to resend confirmation') as Error & { retryAfter?: number };
    error.retryAfter = response.data.retryAfter;
    throw error;
  }
  
  return { expiresInMinutes: response.data.expiresInMinutes };
}

/**
 * Map AuthUser to app User type
 * Note: role here is the APPLICATION role (superadmin/user) from user_profiles,
 * NOT the project role (owner/admin/write/read) from project_members
 */
function mapAuthUserToUser(authUser: AuthUser): User {
  const profile = authUser.profile;
  const metadata = authUser.user_metadata || {};

  return {
    id: authUser.id,
    email: authUser.email,
    name: profile?.display_name || metadata.display_name || metadata.username || authUser.email.split('@')[0],
    avatar: profile?.avatar_url,
    role: profile?.role === 'superadmin' ? 'superadmin' : (profile?.role === 'admin' ? 'admin' : 'member'), // Map to app roles
  };
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return appStore.getState().currentUser !== null;
}

/**
 * Check if auth is initialized
 */
export function isAuthInitialized(): boolean {
  return isInitialized;
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  return appStore.getState().currentUser;
}

/**
 * Listen for auth required events
 */
export function onAuthRequired(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener('godmode:auth-required', handler);
  return () => window.removeEventListener('godmode:auth-required', handler);
}

/**
 * Trigger auth required event
 */
export function triggerAuthRequired(): void {
  window.dispatchEvent(new CustomEvent('godmode:auth-required'));
}

// Export as namespace
export const auth = {
  checkStatus: checkAuthStatus,
  checkSession,
  init: initAuth,
  login,
  register,
  logout,
  forgotPassword,
  resetPassword,
  refreshSession,
  isAuthenticated,
  isInitialized: isAuthInitialized,
  getCurrentUser,
  onAuthRequired,
  triggerAuthRequired,
  // OTP / Magic Code
  requestLoginCode,
  verifyLoginCode,
  getOTPConfig,
  confirmEmail,
  resendConfirmation,
};
