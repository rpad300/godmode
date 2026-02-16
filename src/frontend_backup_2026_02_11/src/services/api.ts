/**
 * API Service
 * Centralized HTTP client with error handling
 */

import { toast } from './toast';

let getCurrentProjectId: (() => string | null) | null = null;
export function setProjectIdGetter(getter: () => string | null): void {
  getCurrentProjectId = getter;
}

export interface ApiResponse<T = unknown> {
  data: T;
  ok: boolean;
  status: number;
  statusText: string;
}

/**
 * API client configuration
 */
interface ApiConfig {
  baseUrl: string;
  defaultHeaders: Record<string, string>;
  showErrorToasts: boolean;
  timeout: number;
  retryCount: number;
  retryDelay: number;
  onUnauthorized?: () => void;
  onForbidden?: () => void;
}

const config: ApiConfig = {
  baseUrl: '',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  showErrorToasts: true,
  timeout: 30000, // 30 seconds
  retryCount: 2, // Retry failed requests up to 2 times
  retryDelay: 1000, // Start with 1 second delay
};

// Request interceptors
type RequestInterceptor = (options: RequestInit) => RequestInit | Promise<RequestInit>;
type ResponseInterceptor = (response: ApiResponse<unknown>) => ApiResponse<unknown> | Promise<ApiResponse<unknown>>;

const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];

/**
 * Add request interceptor
 */
export function addRequestInterceptor(interceptor: RequestInterceptor): () => void {
  requestInterceptors.push(interceptor);
  return () => {
    const index = requestInterceptors.indexOf(interceptor);
    if (index > -1) requestInterceptors.splice(index, 1);
  };
}

/**
 * Add response interceptor
 */
export function addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
  responseInterceptors.push(interceptor);
  return () => {
    const index = responseInterceptors.indexOf(interceptor);
    if (index > -1) responseInterceptors.splice(index, 1);
  };
}

/**
 * Make an API request with proper error handling
 */
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
  attempt = 0
): Promise<ApiResponse<T>> {
  const url = `${config.baseUrl}${path}`;

  // Apply request interceptors
  let finalOptions: RequestInit = {
    ...options,
    headers: {
      ...config.defaultHeaders,
      ...options.headers,
    },
  };

  for (const interceptor of requestInterceptors) {
    finalOptions = await interceptor(finalOptions);
  }

  // Per-request timeout (optional); do not pass timeout to fetch
  const optsWithTimeout = finalOptions as RequestInit & { timeout?: number };
  const timeoutMs = optsWithTimeout.timeout ?? config.timeout;
  delete (finalOptions as RequestInit & { timeout?: number }).timeout;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...finalOptions,
      signal: controller.signal,
      credentials: 'include', // Include cookies for authentication
    });

    clearTimeout(timeoutId);

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();
    let data: T;
    if (contentType.includes('application/json') && text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        const msg = 'Invalid server response (not JSON). You may be seeing an error page or wrong endpoint.';
        if (config.showErrorToasts) toast.error(msg);
        throw new ApiError(msg, response.status || 0);
      }
    } else {
      data = text as unknown as T;
    }

    if (!response.ok) {
      // Handle specific HTTP errors
      switch (response.status) {
        case 401:
          if (config.onUnauthorized) {
            config.onUnauthorized();
          }
          break;
        case 403:
          if (config.onForbidden) {
            config.onForbidden();
          }
          break;
        case 429:
          // Rate limited - auto retry with exponential backoff
          if (attempt < 3) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
            await sleep(retryAfter * 1000);
            return api<T>(path, options, attempt + 1);
          }
          break;
        case 503:
        case 504:
          // Service unavailable - retry
          if (attempt < config.retryCount) {
            await sleep(config.retryDelay * Math.pow(2, attempt));
            return api<T>(path, options, attempt + 1);
          }
          break;
      }

      const errorMessage = extractErrorMessage(data, response.statusText);

      if (config.showErrorToasts) {
        toast.error(errorMessage);
      }

      throw new ApiError(errorMessage, response.status, data);
    }

    let result: ApiResponse<T> = {
      data,
      ok: true,
      status: response.status,
      statusText: response.statusText,
    };

    // Apply response interceptors
    for (const interceptor of responseInterceptors) {
      result = await interceptor(result) as ApiResponse<T>;
    }

    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    // Abort error (timeout)
    if (error instanceof DOMException && error.name === 'AbortError') {
      const message = 'Request timed out';
      if (config.showErrorToasts) {
        toast.error(message);
      }
      throw new ApiError(message, 0);
    }

    // Network or other error - retry if configured
    if (attempt < config.retryCount) {
      await sleep(config.retryDelay * Math.pow(2, attempt));
      return api<T>(path, options, attempt + 1);
    }

    const rawMessage = error instanceof Error ? error.message : 'Network error';
    const isJsonParseError = rawMessage.includes('JSON') || rawMessage.includes('Unexpected token');
    const message = isJsonParseError
      ? 'Invalid server response. Check that the server is running and the URL is correct.'
      : rawMessage;
    if (config.showErrorToasts) {
      toast.error(`Connection error: ${message}`);
    }
    throw new ApiError(message, 0);
  }
}

/**
 * Extract error message from response data
 */
function extractErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    return String(obj.error || obj.message || obj.detail || fallback);
  }
  return fallback || 'Request failed';
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Custom API Error class
 */
class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Convenience methods
 */
export const http = {
  get: <T = unknown>(path: string, options?: RequestInit & { timeout?: number }) =>
    api<T>(path, { ...options, method: 'GET' }),

  post: <T = unknown>(path: string, body?: unknown, options?: RequestInit & { timeout?: number }) =>
    api<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(path: string, body?: unknown, options?: RequestInit & { timeout?: number }) =>
    api<T>(path, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(path: string, body?: unknown, options?: RequestInit & { timeout?: number }) =>
    api<T>(path, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(path: string, options?: RequestInit & { timeout?: number }) =>
    api<T>(path, { ...options, method: 'DELETE' }),
};

/**
 * Configure API client
 */
export function configureApi(newConfig: Partial<ApiConfig>): void {
  Object.assign(config, newConfig);
}

export { ApiError };

/**
 * Returns headers that include X-Project-Id for project-scoped API calls.
 * Use with raw fetch when the response is not JSON (e.g. blob, stream).
 */
export function getProjectHeaders(): Record<string, string> {
  const id = getCurrentProjectId?.() ?? null;
  return id ? { 'X-Project-Id': id } : {};
}

/**
 * fetch with X-Project-Id and credentials for project-scoped endpoints.
 * Use instead of raw fetch when the route is project-scoped (e.g. export, upload, graph sync).
 */
export async function fetchWithProject(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  Object.entries(getProjectHeaders()).forEach(([k, v]) => headers.set(k, v));
  return fetch(input, { ...init, headers, credentials: 'include' });
}
