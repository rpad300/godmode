/**
 * Landing Page - Main Entry Point
 * GodMode Landing Page with inline auth forms
 */

// Import styles
import './styles/landing.css';

// ==================== Types ====================
interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
  };
  needsEmailVerification?: boolean;
  error?: string;
}

interface MeResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
  };
}

// ==================== HTTP Helpers ====================
/** Parse response as JSON only when Content-Type is JSON; otherwise return null and keep body as text for error message. */
async function parseJsonOrText(response: Response): Promise<{ data: unknown; isJson: boolean }> {
  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
  const isJson = contentType.includes('application/json');
  const text = await response.text();
  if (isJson && text) {
    try {
      return { data: JSON.parse(text), isJson: true };
    } catch {
      // Malformed JSON from API
      return { data: null, isJson: false };
    }
  }
  return { data: text || null, isJson: false };
}

async function post<T>(url: string, data: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  const { data: result, isJson } = await parseJsonOrText(response);

  if (!response.ok) {
    const msg =
      isJson && result && typeof result === 'object' && 'error' in result
        ? String((result as { error?: string }).error)
        : isJson && result && typeof result === 'object' && 'message' in result
          ? String((result as { message?: string }).message)
          : typeof result === 'string' && result.length > 0
            ? result
            : response.statusText || 'Pedido falhou';
    throw new Error(msg || 'Pedido falhou');
  }

  if (!isJson || result == null) {
    throw new Error('Resposta inválida do servidor. Tente novamente.');
  }

  return result as T;
}

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  const { data, isJson } = await parseJsonOrText(response);

  if (!response.ok) {
    const msg =
      isJson && data && typeof data === 'object' && 'error' in data
        ? String((data as { error?: string }).error)
        : isJson && data && typeof data === 'object' && 'message' in data
          ? String((data as { message?: string }).message)
          : typeof data === 'string' && data.length > 0
            ? data
            : response.statusText || 'Pedido falhou';
    throw new Error(msg || 'Pedido falhou');
  }

  if (!isJson || data == null) {
    throw new Error('Resposta inválida do servidor. Tente novamente.');
  }

  return data as T;
}

// ==================== Auth Functions ====================
async function checkAuth(): Promise<boolean> {
  try {
    const result = await get<MeResponse>('/api/auth/me');
    return result.authenticated === true;
  } catch {
    return false;
  }
}

async function login(email: string, password: string): Promise<AuthResponse> {
  return post<AuthResponse>('/api/auth/login', { email, password });
}

async function register(email: string, password: string): Promise<AuthResponse> {
  return post<AuthResponse>('/api/auth/register', { email, password });
}

async function forgotPassword(email: string): Promise<void> {
  await post('/api/auth/forgot-password', { email });
}

// ==================== UI Helpers ====================
function showError(elementId: string, message: string): void {
  const errorEl = document.getElementById(elementId);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('visible');
  }
}

function hideError(elementId: string): void {
  const errorEl = document.getElementById(elementId);
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }
}

function showSuccess(elementId: string, message: string): void {
  const successEl = document.getElementById(elementId);
  if (successEl) {
    successEl.textContent = message;
    successEl.classList.add('visible');
  }
}

function setLoading(button: HTMLButtonElement, loading: boolean): void {
  const textEl = button.querySelector('.btn-text') as HTMLElement;
  const loadingEl = button.querySelector('.btn-loading') as HTMLElement;

  if (textEl && loadingEl) {
    textEl.classList.toggle('hidden', loading);
    loadingEl.classList.toggle('hidden', !loading);
  }

  button.disabled = loading;
}

function scrollToElement(id: string): void {
  const element = document.getElementById(id);
  if (element) {
    const headerHeight = 64;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 20;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    });
  }
}

// ==================== Form Handlers ====================
function initAuthTabs(): void {
  const tabs = document.querySelectorAll('.landing-auth-tab');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const forgotForm = document.getElementById('forgot-form');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabType = tab.getAttribute('data-tab');

      // Update active tab
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      if (loginForm) loginForm.classList.toggle('hidden', tabType !== 'login');
      if (registerForm) registerForm.classList.toggle('hidden', tabType !== 'register');
      if (forgotForm) forgotForm.classList.add('hidden');

      // Clear errors
      hideError('login-error');
      hideError('register-error');
      hideError('forgot-error');
    });
  });
}

function initLoginForm(): void {
  const form = document.getElementById('login-form') as HTMLFormElement;
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('login-error');

    const emailInput = document.getElementById('login-email') as HTMLInputElement;
    const passwordInput = document.getElementById('login-password') as HTMLInputElement;
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('login-error', 'Preencha todos os campos');
      return;
    }

    setLoading(submitBtn, true);

    try {
      const result = await login(email, password);

      if (result.success) {
        // Redirect to app
        window.location.href = '/app';
      } else {
        showError('login-error', result.error || 'Erro ao entrar. Verifique as credenciais.');
      }
    } catch (err) {
      showError('login-error', err instanceof Error ? err.message : 'Erro ao entrar. Tente novamente.');
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

function initRegisterForm(): void {
  const form = document.getElementById('register-form') as HTMLFormElement;
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('register-error');

    const emailInput = document.getElementById('register-email') as HTMLInputElement;
    const passwordInput = document.getElementById('register-password') as HTMLInputElement;
    const confirmInput = document.getElementById('register-confirm') as HTMLInputElement;
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    if (!email || !password || !confirm) {
      showError('register-error', 'Preencha todos os campos');
      return;
    }

    if (password.length < 12) {
      showError('register-error', 'A password deve ter pelo menos 12 caracteres');
      return;
    }

    if (password !== confirm) {
      showError('register-error', 'As passwords não coincidem');
      return;
    }

    setLoading(submitBtn, true);

    try {
      const result = await register(email, password);

      if (result.success) {
        if (result.needsEmailVerification) {
          // Show success message and switch to login
          showError('register-error', ''); // Clear any error
          alert('Conta criada! Verifique o seu email para confirmar o registo.');

          // Switch to login tab
          const loginTab = document.querySelector('.landing-auth-tab[data-tab="login"]') as HTMLElement;
          loginTab?.click();
        } else {
          // Redirect to app
          window.location.href = '/app';
        }
      } else {
        showError('register-error', result.error || 'Erro ao criar conta. Tente novamente.');
      }
    } catch (err) {
      showError('register-error', err instanceof Error ? err.message : 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

function initForgotForm(): void {
  const form = document.getElementById('forgot-form') as HTMLFormElement;
  const forgotLink = document.getElementById('forgot-password-link');
  const backLink = document.getElementById('back-to-login-link');
  const loginForm = document.getElementById('login-form');
  const tabs = document.querySelectorAll('.landing-auth-tab');

  forgotLink?.addEventListener('click', () => {
    if (loginForm) loginForm.classList.add('hidden');
    if (form) form.classList.remove('hidden');
    tabs.forEach((t) => t.classList.remove('active'));
    hideError('login-error');
  });

  backLink?.addEventListener('click', () => {
    if (form) form.classList.add('hidden');
    if (loginForm) loginForm.classList.remove('hidden');
    const loginTab = document.querySelector('.landing-auth-tab[data-tab="login"]') as HTMLElement;
    loginTab?.classList.add('active');
    hideError('forgot-error');
  });

  // Form submission
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('forgot-error');

    const emailInput = document.getElementById('forgot-email') as HTMLInputElement;
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;

    const email = emailInput.value.trim();

    if (!email) {
      showError('forgot-error', 'Introduza o seu email');
      return;
    }

    setLoading(submitBtn, true);

    try {
      await forgotPassword(email);
      showSuccess('forgot-success', 'Se o email existir, receberá um link de recuperação.');
      emailInput.value = '';
    } catch {
      // Always show success to not reveal if email exists
      showSuccess('forgot-success', 'Se o email existir, receberá um link de recuperação.');
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

// ==================== Navigation ====================
function initNavigation(): void {
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = anchor.getAttribute('href')?.slice(1);
      if (targetId) {
        scrollToElement(targetId);
        // Close mobile nav if open
        document.getElementById('mobile-nav')?.classList.remove('open');
      }
    });
  });

  // Scroll buttons
  document.querySelectorAll('[data-scroll-to]').forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-scroll-to');
      if (targetId) {
        scrollToElement(targetId);
        // Close mobile nav if open
        document.getElementById('mobile-nav')?.classList.remove('open');
      }
    });
  });

  // Mobile menu toggle
  const menuToggle = document.getElementById('menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');

  menuToggle?.addEventListener('click', () => {
    mobileNav?.classList.toggle('open');
  });

  // Close mobile nav on outside click
  document.addEventListener('click', (e) => {
    if (mobileNav?.classList.contains('open')) {
      const target = e.target as HTMLElement;
      if (!mobileNav.contains(target) && !menuToggle?.contains(target)) {
        mobileNav.classList.remove('open');
      }
    }
  });
}

// ==================== FAQ ====================
function initFAQ(): void {
  document.querySelectorAll('.landing-faq-question').forEach((question) => {
    question.addEventListener('click', () => {
      const isExpanded = question.getAttribute('aria-expanded') === 'true';
      const answer = question.nextElementSibling as HTMLElement;

      // Toggle current
      question.setAttribute('aria-expanded', String(!isExpanded));
      answer?.classList.toggle('open', !isExpanded);
    });
  });
}

// ==================== Header Scroll ====================
function initHeaderScroll(): void {
  const header = document.getElementById('landing-header');
  if (!header) return;

  let lastScrollY = window.scrollY;

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    header.classList.toggle('landing-header-scrolled', currentScrollY > 50);
    lastScrollY = currentScrollY;
  });
}

// ==================== Initialize ====================
async function init(): Promise<void> {
  console.log('🚀 GodMode Landing initializing...');

  // Check if already authenticated
  const isAuthenticated = await checkAuth();

  if (isAuthenticated) {
    console.log('✅ User authenticated, redirecting to app...');
    window.location.href = '/app';
    return;
  }

  // Initialize UI
  initAuthTabs();
  initLoginForm();
  initRegisterForm();
  initForgotForm();
  initNavigation();
  initFAQ();
  initHeaderScroll();

  console.log('✅ GodMode Landing ready');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
