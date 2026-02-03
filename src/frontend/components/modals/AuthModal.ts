/**
 * Auth Modal Component
 * Login, registration, and password reset dialogs
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { auth } from '../../services/auth';
import { toast } from '../../services/toast';

const MODAL_ID = 'auth-modal';

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'otp-request' | 'otp-verify' | 'email-confirm';

export interface AuthModalProps {
  initialMode?: AuthMode;
  resetToken?: string; // For password reset flow
  email?: string; // For OTP flows
  onSuccess?: (user: { id: string; email: string; name?: string }) => void;
  onClose?: () => void;
  required?: boolean; // If true, modal cannot be closed without logging in
}

let currentMode: AuthMode = 'login';
let currentProps: AuthModalProps = {};
let otpEmail: string = '';
let resendCooldown: number = 0;
let resendTimer: NodeJS.Timeout | null = null;

/**
 * Show auth modal
 */
export function showAuthModal(props: AuthModalProps = {}): void {
  currentMode = props.initialMode || 'login';
  currentProps = props;

  // Remove existing modal if any
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'auth-content' });
  renderAuthContent(content);

  const modal = createModal({
    id: MODAL_ID,
    title: getTitle(),
    content,
    size: 'sm',
    closable: !props.required, // Can't close if login is required
    onClose: props.onClose,
    footer: null,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  // Focus first input
  setTimeout(() => {
    const firstInput = content.querySelector('input') as HTMLInputElement;
    if (firstInput) firstInput.focus();
  }, 100);
}

/**
 * Get modal title based on mode
 */
function getTitle(): string {
  switch (currentMode) {
    case 'login': return 'Sign In';
    case 'register': return 'Create Account';
    case 'forgot': return 'Reset Password';
    case 'reset': return 'Set New Password';
    case 'otp-request': return 'Sign In with Code';
    case 'otp-verify': return 'Enter Code';
    case 'email-confirm': return 'Confirm Email';
  }
}

/**
 * Render auth content
 */
function renderAuthContent(container: HTMLElement): void {
  // Clear any existing timers
  if (resendTimer) {
    clearInterval(resendTimer);
    resendTimer = null;
  }
  
  switch (currentMode) {
    case 'login':
      renderLoginForm(container);
      break;
    case 'register':
      renderRegisterForm(container);
      break;
    case 'forgot':
      renderForgotForm(container);
      break;
    case 'reset':
      renderResetForm(container);
      break;
    case 'otp-request':
      renderOTPRequestForm(container);
      break;
    case 'otp-verify':
      renderOTPVerifyForm(container);
      break;
    case 'email-confirm':
      renderEmailConfirmForm(container);
      break;
  }
}

/**
 * Render login form
 */
function renderLoginForm(container: HTMLElement): void {
  container.innerHTML = `
    <form id="login-form" class="auth-form">
      <div class="form-group">
        <label for="login-email">Email</label>
        <input type="email" id="login-email" required autocomplete="email" placeholder="your@email.com">
      </div>
      <div class="form-group">
        <label for="login-password">Password</label>
        <input type="password" id="login-password" required autocomplete="current-password" placeholder="••••••••••••">
      </div>
      <div class="form-error" id="login-error" style="display: none;"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-text">Sign In</span>
          <span class="btn-loading" style="display: none;">Signing in...</span>
        </button>
      </div>
      <div class="auth-divider">
        <span>or</span>
      </div>
      <div class="form-group">
        <button type="button" class="btn btn-secondary btn-block" data-action="otp-request">
          Sign in with email code
        </button>
      </div>
      <div class="auth-links">
        <button type="button" class="btn-link" data-action="forgot">Forgot password?</button>
        <span class="separator">|</span>
        <button type="button" class="btn-link" data-action="register">Create account</button>
      </div>
    </form>
  `;

  const form = container.querySelector('#login-form') as HTMLFormElement;
  on(form, 'submit', async (e) => {
    e.preventDefault();
    await handleLogin(form);
  });

  bindModeLinks(container);
}

/**
 * Render registration form
 */
function renderRegisterForm(container: HTMLElement): void {
  container.innerHTML = `
    <form id="register-form" class="auth-form">
      <div class="form-group">
        <label for="register-email">Email <span class="required">*</span></label>
        <input type="email" id="register-email" required autocomplete="email" placeholder="your@email.com">
      </div>
      <div class="form-group">
        <label for="register-username">Username</label>
        <input type="text" id="register-username" autocomplete="username" placeholder="username (optional)" 
               pattern="^[a-zA-Z0-9_]+$" minlength="3">
        <small class="form-hint">Letters, numbers, and underscores only. Min 3 characters.</small>
      </div>
      <div class="form-group">
        <label for="register-display-name">Display Name</label>
        <input type="text" id="register-display-name" autocomplete="name" placeholder="Your Name (optional)">
      </div>
      <div class="form-group">
        <label for="register-password">Password <span class="required">*</span></label>
        <input type="password" id="register-password" required autocomplete="new-password" 
               minlength="12" placeholder="Min. 12 characters">
        <div class="password-strength" id="password-strength"></div>
      </div>
      <div class="form-group">
        <label for="register-confirm">Confirm Password <span class="required">*</span></label>
        <input type="password" id="register-confirm" required autocomplete="new-password" placeholder="••••••••••••">
      </div>
      <div class="form-error" id="register-error" style="display: none;"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-text">Create Account</span>
          <span class="btn-loading" style="display: none;">Creating account...</span>
        </button>
      </div>
      <div class="auth-links">
        <button type="button" class="btn-link" data-action="login">Already have an account? Sign in</button>
      </div>
    </form>
  `;

  const form = container.querySelector('#register-form') as HTMLFormElement;
  
  // Password strength indicator
  const passwordInput = form.querySelector('#register-password') as HTMLInputElement;
  on(passwordInput, 'input', () => {
    updatePasswordStrength(passwordInput.value);
  });

  on(form, 'submit', async (e) => {
    e.preventDefault();
    await handleRegister(form);
  });

  bindModeLinks(container);
}

/**
 * Render forgot password form
 */
function renderForgotForm(container: HTMLElement): void {
  container.innerHTML = `
    <form id="forgot-form" class="auth-form">
      <p class="form-description">
        Enter your email address and we'll send you a link to reset your password.
      </p>
      <div class="form-group">
        <label for="forgot-email">Email</label>
        <input type="email" id="forgot-email" required autocomplete="email" placeholder="your@email.com">
      </div>
      <div class="form-error" id="forgot-error" style="display: none;"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-text">Send Reset Link</span>
          <span class="btn-loading" style="display: none;">Sending...</span>
        </button>
      </div>
      <div class="auth-links">
        <button type="button" class="btn-link" data-action="login">Back to sign in</button>
      </div>
    </form>
  `;

  const form = container.querySelector('#forgot-form') as HTMLFormElement;
  on(form, 'submit', async (e) => {
    e.preventDefault();
    await handleForgot(form);
  });

  bindModeLinks(container);
}

/**
 * Render reset password form
 */
function renderResetForm(container: HTMLElement): void {
  container.innerHTML = `
    <form id="reset-form" class="auth-form">
      <p class="form-description">
        Enter your new password below.
      </p>
      <div class="form-group">
        <label for="reset-password">New Password</label>
        <input type="password" id="reset-password" required autocomplete="new-password" 
               minlength="12" placeholder="Min. 12 characters">
        <div class="password-strength" id="reset-password-strength"></div>
      </div>
      <div class="form-group">
        <label for="reset-confirm">Confirm Password</label>
        <input type="password" id="reset-confirm" required autocomplete="new-password" placeholder="••••••••••••">
      </div>
      <div class="form-error" id="reset-error" style="display: none;"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-text">Reset Password</span>
          <span class="btn-loading" style="display: none;">Resetting...</span>
        </button>
      </div>
    </form>
  `;

  const form = container.querySelector('#reset-form') as HTMLFormElement;
  
  // Password strength indicator
  const passwordInput = form.querySelector('#reset-password') as HTMLInputElement;
  on(passwordInput, 'input', () => {
    updatePasswordStrength(passwordInput.value, 'reset-password-strength');
  });

  on(form, 'submit', async (e) => {
    e.preventDefault();
    await handleReset(form);
  });
}

/**
 * Render OTP request form (enter email to receive code)
 */
function renderOTPRequestForm(container: HTMLElement): void {
  container.innerHTML = `
    <form id="otp-request-form" class="auth-form">
      <p class="form-description">
        Enter your email address and we'll send you a one-time code to sign in.
      </p>
      <div class="form-group">
        <label for="otp-email">Email</label>
        <input type="email" id="otp-email" required autocomplete="email" placeholder="your@email.com" value="${otpEmail}">
      </div>
      <div class="form-error" id="otp-request-error" style="display: none;"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-text">Send Code</span>
          <span class="btn-loading" style="display: none;">Sending...</span>
        </button>
      </div>
      <div class="auth-links">
        <button type="button" class="btn-link" data-action="login">Sign in with password</button>
        <span class="separator">|</span>
        <button type="button" class="btn-link" data-action="register">Create account</button>
      </div>
    </form>
  `;

  const form = container.querySelector('#otp-request-form') as HTMLFormElement;
  on(form, 'submit', async (e) => {
    e.preventDefault();
    await handleOTPRequest(form, container);
  });

  bindModeLinks(container);
}

/**
 * Render OTP verify form (enter 6-digit code)
 */
function renderOTPVerifyForm(container: HTMLElement): void {
  const maskedEmail = otpEmail ? 
    otpEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 
    'your email';
  
  container.innerHTML = `
    <form id="otp-verify-form" class="auth-form">
      <p class="form-description">
        Enter the 6-digit code sent to <strong>${maskedEmail}</strong>
      </p>
      <div class="form-group otp-input-group">
        <div class="otp-inputs">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" autocomplete="one-time-code" data-index="0">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="1">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="2">
          <span class="otp-separator">-</span>
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="3">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="4">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="5">
        </div>
        <input type="hidden" id="otp-code" name="code">
      </div>
      <div class="form-error" id="otp-verify-error" style="display: none;"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block" id="otp-verify-btn" disabled>
          <span class="btn-text">Verify Code</span>
          <span class="btn-loading" style="display: none;">Verifying...</span>
        </button>
      </div>
      <div class="otp-resend">
        <button type="button" class="btn-link" id="resend-code-btn" ${resendCooldown > 0 ? 'disabled' : ''}>
          ${resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
        </button>
      </div>
      <div class="auth-links">
        <button type="button" class="btn-link" data-action="otp-request">Use different email</button>
        <span class="separator">|</span>
        <button type="button" class="btn-link" data-action="login">Sign in with password</button>
      </div>
    </form>
  `;

  const form = container.querySelector('#otp-verify-form') as HTMLFormElement;
  const inputs = container.querySelectorAll('.otp-digit') as NodeListOf<HTMLInputElement>;
  const hiddenInput = container.querySelector('#otp-code') as HTMLInputElement;
  const verifyBtn = container.querySelector('#otp-verify-btn') as HTMLButtonElement;
  const resendBtn = container.querySelector('#resend-code-btn') as HTMLButtonElement;

  // Setup OTP input handlers
  setupOTPInputs(inputs, hiddenInput, verifyBtn);

  // Setup resend cooldown timer
  if (resendCooldown > 0) {
    startResendCooldown(resendBtn);
  }

  // Resend handler
  on(resendBtn, 'click', async () => {
    await handleResendCode(container);
  });

  on(form, 'submit', async (e) => {
    e.preventDefault();
    await handleOTPVerify(form, container);
  });

  bindModeLinks(container);

  // Focus first input
  setTimeout(() => inputs[0]?.focus(), 100);
}

/**
 * Render email confirmation form
 */
function renderEmailConfirmForm(container: HTMLElement): void {
  const email = currentProps.email || otpEmail || '';
  
  container.innerHTML = `
    <form id="email-confirm-form" class="auth-form">
      <div class="confirm-icon">✉️</div>
      <p class="form-description">
        Enter the confirmation code sent to <strong>${email || 'your email'}</strong>
      </p>
      <div class="form-group otp-input-group">
        <div class="otp-inputs">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="0">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="1">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="2">
          <span class="otp-separator">-</span>
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="3">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="4">
          <input type="text" class="otp-digit" maxlength="1" pattern="[0-9]" inputmode="numeric" data-index="5">
        </div>
        <input type="hidden" id="confirm-code" name="code">
      </div>
      <div class="form-error" id="email-confirm-error" style="display: none;"></div>
      <div class="form-group">
        <button type="submit" class="btn btn-primary btn-block" id="confirm-btn" disabled>
          <span class="btn-text">Confirm Email</span>
          <span class="btn-loading" style="display: none;">Confirming...</span>
        </button>
      </div>
      <div class="auth-links">
        <button type="button" class="btn-link" data-action="login">Back to sign in</button>
      </div>
    </form>
  `;

  const form = container.querySelector('#email-confirm-form') as HTMLFormElement;
  const inputs = container.querySelectorAll('.otp-digit') as NodeListOf<HTMLInputElement>;
  const hiddenInput = container.querySelector('#confirm-code') as HTMLInputElement;
  const confirmBtn = container.querySelector('#confirm-btn') as HTMLButtonElement;

  setupOTPInputs(inputs, hiddenInput, confirmBtn);

  on(form, 'submit', async (e) => {
    e.preventDefault();
    await handleEmailConfirm(form, container, email);
  });

  bindModeLinks(container);
  setTimeout(() => inputs[0]?.focus(), 100);
}

/**
 * Setup OTP digit inputs with auto-advance and paste support
 */
function setupOTPInputs(
  inputs: NodeListOf<HTMLInputElement>, 
  hiddenInput: HTMLInputElement, 
  submitBtn: HTMLButtonElement
): void {
  const updateHiddenValue = () => {
    const code = Array.from(inputs).map(i => i.value).join('');
    hiddenInput.value = code;
    submitBtn.disabled = code.length !== 6 || !/^\d{6}$/.test(code);
  };

  inputs.forEach((input, index) => {
    // Handle input
    on(input, 'input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      
      // Only allow digits
      if (!/^\d*$/.test(value)) {
        input.value = value.replace(/\D/g, '');
        return;
      }
      
      // If multiple digits pasted, distribute them
      if (value.length > 1) {
        const digits = value.split('');
        inputs.forEach((inp, i) => {
          inp.value = digits[i] || '';
        });
        const nextIndex = Math.min(digits.length, 5);
        inputs[nextIndex]?.focus();
        updateHiddenValue();
        return;
      }
      
      // Auto-advance to next input
      if (value && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
      
      updateHiddenValue();
    });

    // Handle keydown for backspace navigation
    on(input, 'keydown', (e) => {
      const key = (e as KeyboardEvent).key;
      
      if (key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1].focus();
        inputs[index - 1].value = '';
        updateHiddenValue();
      }
      
      // Arrow navigation
      if (key === 'ArrowLeft' && index > 0) {
        inputs[index - 1].focus();
      }
      if (key === 'ArrowRight' && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

    // Handle paste
    on(input, 'paste', (e) => {
      e.preventDefault();
      const pasted = (e as ClipboardEvent).clipboardData?.getData('text') || '';
      const digits = pasted.replace(/\D/g, '').slice(0, 6);
      
      if (digits) {
        digits.split('').forEach((digit, i) => {
          if (inputs[i]) inputs[i].value = digit;
        });
        const nextIndex = Math.min(digits.length, 5);
        inputs[nextIndex]?.focus();
        updateHiddenValue();
      }
    });

    // Select all on focus
    on(input, 'focus', () => input.select());
  });
}

/**
 * Start resend cooldown timer
 */
function startResendCooldown(button: HTMLButtonElement): void {
  if (resendTimer) clearInterval(resendTimer);
  
  const updateButton = () => {
    if (resendCooldown > 0) {
      button.disabled = true;
      button.textContent = `Resend code in ${resendCooldown}s`;
      resendCooldown--;
    } else {
      button.disabled = false;
      button.textContent = 'Resend code';
      if (resendTimer) {
        clearInterval(resendTimer);
        resendTimer = null;
      }
    }
  };
  
  updateButton();
  resendTimer = setInterval(updateButton, 1000);
}

/**
 * Handle OTP request
 */
async function handleOTPRequest(form: HTMLFormElement, container: HTMLElement): Promise<void> {
  const email = (form.querySelector('#otp-email') as HTMLInputElement).value.trim();
  const errorEl = form.querySelector('#otp-request-error') as HTMLElement;

  setFormLoading(form, true);
  hideError(errorEl);

  try {
    const result = await auth.requestLoginCode(email);
    
    // Store email for verify step
    otpEmail = email;
    
    // Set cooldown for resend
    resendCooldown = 60;
    
    toast.success(result.message || 'Code sent! Check your email.');
    
    // Switch to verify mode
    currentMode = 'otp-verify';
    const titleEl = document.querySelector(`[data-modal-id="${MODAL_ID}"] .modal-header h3`);
    if (titleEl) titleEl.textContent = getTitle();
    renderAuthContent(container);
    
  } catch (error: unknown) {
    const err = error as { message?: string; response?: { data?: { retryAfter?: number } } };
    const message = err.message || 'Failed to send code';
    showError(errorEl, message);
  } finally {
    setFormLoading(form, false);
  }
}

/**
 * Handle OTP verification
 */
async function handleOTPVerify(form: HTMLFormElement, container: HTMLElement): Promise<void> {
  const code = (form.querySelector('#otp-code') as HTMLInputElement).value;
  const errorEl = form.querySelector('#otp-verify-error') as HTMLElement;

  if (!code || code.length !== 6) {
    showError(errorEl, 'Please enter the 6-digit code');
    return;
  }

  setFormLoading(form, true);
  hideError(errorEl);

  try {
    const user = await auth.verifyLoginCode(otpEmail, code);
    
    toast.success('Signed in successfully');
    currentProps.onSuccess?.(user);
    closeModal(MODAL_ID);
    
    // Trigger data refresh
    window.dispatchEvent(new CustomEvent('godmode:auth-success'));
    
  } catch (error: unknown) {
    const err = error as { 
      message?: string; 
      attemptsRemaining?: number;
      needsEmailVerification?: boolean;
      fallbackToPassword?: boolean;
    };
    
    let message = err.message || 'Verification failed';
    
    if (err.attemptsRemaining !== undefined && err.attemptsRemaining > 0) {
      message += ` (${err.attemptsRemaining} attempts remaining)`;
    }
    
    if (err.needsEmailVerification) {
      message = 'Please confirm your email address first.';
      // Could switch to email-confirm mode here
    }
    
    if (err.fallbackToPassword) {
      message = 'Please sign in with your password instead.';
    }
    
    showError(errorEl, message);
    
    // Clear inputs on error
    const inputs = form.querySelectorAll('.otp-digit') as NodeListOf<HTMLInputElement>;
    inputs.forEach(i => i.value = '');
    inputs[0]?.focus();
    
  } finally {
    setFormLoading(form, false);
  }
}

/**
 * Handle resend code
 */
async function handleResendCode(container: HTMLElement): Promise<void> {
  if (resendCooldown > 0) return;
  
  const resendBtn = container.querySelector('#resend-code-btn') as HTMLButtonElement;
  resendBtn.disabled = true;
  resendBtn.textContent = 'Sending...';
  
  try {
    await auth.requestLoginCode(otpEmail);
    toast.success('New code sent!');
    resendCooldown = 60;
    startResendCooldown(resendBtn);
  } catch (error: unknown) {
    const err = error as { message?: string };
    toast.error(err.message || 'Failed to resend code');
    resendBtn.disabled = false;
    resendBtn.textContent = 'Resend code';
  }
}

/**
 * Handle email confirmation
 */
async function handleEmailConfirm(form: HTMLFormElement, container: HTMLElement, email: string): Promise<void> {
  const code = (form.querySelector('#confirm-code') as HTMLInputElement).value;
  const errorEl = form.querySelector('#email-confirm-error') as HTMLElement;

  if (!code || code.length !== 6) {
    showError(errorEl, 'Please enter the 6-digit code');
    return;
  }

  setFormLoading(form, true);
  hideError(errorEl);

  try {
    await auth.confirmEmail(email, code);
    
    toast.success('Email confirmed! You can now sign in.');
    
    // Switch to login mode
    currentMode = 'login';
    const titleEl = document.querySelector(`[data-modal-id="${MODAL_ID}"] .modal-header h3`);
    if (titleEl) titleEl.textContent = getTitle();
    renderAuthContent(container);
    
  } catch (error: unknown) {
    const err = error as { message?: string };
    showError(errorEl, err.message || 'Confirmation failed');
    
    // Clear inputs
    const inputs = form.querySelectorAll('.otp-digit') as NodeListOf<HTMLInputElement>;
    inputs.forEach(i => i.value = '');
    inputs[0]?.focus();
  } finally {
    setFormLoading(form, false);
  }
}

/**
 * Bind mode switch links
 */
function bindModeLinks(container: HTMLElement): void {
  const links = container.querySelectorAll('[data-action]');
  links.forEach(link => {
    on(link as HTMLElement, 'click', () => {
      const action = link.getAttribute('data-action') as AuthMode;
      currentMode = action;

      // Update modal title
      const titleEl = document.querySelector(`[data-modal-id="${MODAL_ID}"] .modal-header h3`);
      if (titleEl) titleEl.textContent = getTitle();

      // Re-render content
      renderAuthContent(container);
    });
  });
}

/**
 * Handle login submission
 */
async function handleLogin(form: HTMLFormElement): Promise<void> {
  const email = (form.querySelector('#login-email') as HTMLInputElement).value.trim();
  const password = (form.querySelector('#login-password') as HTMLInputElement).value;
  const errorEl = form.querySelector('#login-error') as HTMLElement;
  
  setFormLoading(form, true);
  hideError(errorEl);

  try {
    const user = await auth.login({ email, password });
    
    toast.success('Signed in successfully');
    currentProps.onSuccess?.(user);
    closeModal(MODAL_ID);
    
    // Trigger data refresh
    window.dispatchEvent(new CustomEvent('godmode:auth-success'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    showError(errorEl, message);
  } finally {
    setFormLoading(form, false);
  }
}

/**
 * Handle registration submission
 */
async function handleRegister(form: HTMLFormElement): Promise<void> {
  const email = (form.querySelector('#register-email') as HTMLInputElement).value.trim();
  const username = (form.querySelector('#register-username') as HTMLInputElement).value.trim();
  const displayName = (form.querySelector('#register-display-name') as HTMLInputElement).value.trim();
  const password = (form.querySelector('#register-password') as HTMLInputElement).value;
  const confirm = (form.querySelector('#register-confirm') as HTMLInputElement).value;
  const errorEl = form.querySelector('#register-error') as HTMLElement;

  // Validate passwords match
  if (password !== confirm) {
    showError(errorEl, 'Passwords do not match');
    return;
  }

  // Validate password length
  if (password.length < 12) {
    showError(errorEl, 'Password must be at least 12 characters');
    return;
  }

  setFormLoading(form, true);
  hideError(errorEl);

  try {
    const result = await auth.register({
      email,
      password,
      username: username || undefined,
      display_name: displayName || undefined,
    });

    if (result.needsEmailVerification) {
      toast.success('Account created! Please check your email to verify.');
      // Switch to login mode
      currentMode = 'login';
      const container = form.parentElement as HTMLElement;
      const titleEl = document.querySelector(`[data-modal-id="${MODAL_ID}"] .modal-header h3`);
      if (titleEl) titleEl.textContent = getTitle();
      renderAuthContent(container);
    } else {
      toast.success('Account created successfully');
      currentProps.onSuccess?.(result.user);
      closeModal(MODAL_ID);
      window.dispatchEvent(new CustomEvent('godmode:auth-success'));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    showError(errorEl, message);
  } finally {
    setFormLoading(form, false);
  }
}

/**
 * Handle forgot password submission
 */
async function handleForgot(form: HTMLFormElement): Promise<void> {
  const email = (form.querySelector('#forgot-email') as HTMLInputElement).value.trim();
  const errorEl = form.querySelector('#forgot-error') as HTMLElement;

  setFormLoading(form, true);
  hideError(errorEl);

  try {
    await auth.forgotPassword(email);
    toast.success('If an account exists with this email, you will receive a reset link.');
    
    // Switch back to login
    currentMode = 'login';
    const container = form.parentElement as HTMLElement;
    const titleEl = document.querySelector(`[data-modal-id="${MODAL_ID}"] .modal-header h3`);
    if (titleEl) titleEl.textContent = getTitle();
    renderAuthContent(container);
  } catch (error) {
    // Always show success message to not reveal if email exists
    toast.success('If an account exists with this email, you will receive a reset link.');
  } finally {
    setFormLoading(form, false);
  }
}

/**
 * Handle password reset submission
 */
async function handleReset(form: HTMLFormElement): Promise<void> {
  const password = (form.querySelector('#reset-password') as HTMLInputElement).value;
  const confirm = (form.querySelector('#reset-confirm') as HTMLInputElement).value;
  const errorEl = form.querySelector('#reset-error') as HTMLElement;

  if (password !== confirm) {
    showError(errorEl, 'Passwords do not match');
    return;
  }

  if (password.length < 12) {
    showError(errorEl, 'Password must be at least 12 characters');
    return;
  }

  if (!currentProps.resetToken) {
    showError(errorEl, 'Invalid reset token. Please request a new reset link.');
    return;
  }

  setFormLoading(form, true);
  hideError(errorEl);

  try {
    await auth.resetPassword(password, currentProps.resetToken);
    toast.success('Password reset successfully. You can now sign in.');
    
    // Switch to login
    currentMode = 'login';
    const container = form.parentElement as HTMLElement;
    const titleEl = document.querySelector(`[data-modal-id="${MODAL_ID}"] .modal-header h3`);
    if (titleEl) titleEl.textContent = getTitle();
    renderAuthContent(container);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Password reset failed';
    showError(errorEl, message);
  } finally {
    setFormLoading(form, false);
  }
}

/**
 * Set form loading state
 */
function setFormLoading(form: HTMLFormElement, loading: boolean): void {
  const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  const inputs = form.querySelectorAll('input');
  const btnText = submitBtn.querySelector('.btn-text') as HTMLElement;
  const btnLoading = submitBtn.querySelector('.btn-loading') as HTMLElement;

  submitBtn.disabled = loading;
  inputs.forEach(input => input.disabled = loading);
  
  if (btnText && btnLoading) {
    btnText.style.display = loading ? 'none' : '';
    btnLoading.style.display = loading ? '' : 'none';
  }
}

/**
 * Show error message
 */
function showError(errorEl: HTMLElement, message: string): void {
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError(errorEl: HTMLElement): void {
  errorEl.style.display = 'none';
  errorEl.textContent = '';
}

/**
 * Update password strength indicator
 */
function updatePasswordStrength(password: string, elementId = 'password-strength'): void {
  const strengthEl = document.getElementById(elementId);
  if (!strengthEl) return;

  const strength = calculatePasswordStrength(password);
  
  strengthEl.className = `password-strength strength-${strength.level}`;
  strengthEl.innerHTML = `
    <div class="strength-bar">
      <div class="strength-fill" style="width: ${strength.score}%"></div>
    </div>
    <span class="strength-label">${strength.label}</span>
  `;
}

/**
 * Calculate password strength
 */
function calculatePasswordStrength(password: string): { level: string; score: number; label: string } {
  let score = 0;

  if (password.length >= 12) score += 25;
  if (password.length >= 16) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  if (score < 30) return { level: 'weak', score, label: 'Weak' };
  if (score < 60) return { level: 'fair', score, label: 'Fair' };
  if (score < 80) return { level: 'good', score, label: 'Good' };
  return { level: 'strong', score: Math.min(score, 100), label: 'Strong' };
}

/**
 * Close auth modal
 */
export function closeAuthModal(): void {
  closeModal(MODAL_ID);
}

export default showAuthModal;
