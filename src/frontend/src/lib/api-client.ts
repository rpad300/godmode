/**
 * Centralized API client for the React frontend.
 * Wraps fetch with project-scoped headers, error handling, and retries.
 */

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let currentProjectId: string | null = null;

export function setCurrentProjectId(id: string | null) {
  currentProjectId = id;
}

export function getCurrentProjectId(): string | null {
  return currentProjectId;
}

function getHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (currentProjectId) {
    headers['X-Project-Id'] = currentProjectId;
  }
  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  attempt = 0
): Promise<T> {
  const maxRetries = 2;
  const retryDelay = 1000;
  const timeout = 30000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(path, {
      ...options,
      signal: controller.signal,
      credentials: 'include',
    });
    clearTimeout(timeoutId);

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();

    let data: T;
    if (contentType.includes('application/json') && text) {
      data = JSON.parse(text) as T;
    } else {
      data = text as unknown as T;
    }

    if (!response.ok) {
      const errorMessage = extractErrorMessage(data, response.statusText);

      // Retry on 503/504
      if ((response.status === 503 || response.status === 504) && attempt < maxRetries) {
        await sleep(retryDelay * Math.pow(2, attempt));
        return request<T>(path, options, attempt + 1);
      }

      throw new ApiError(errorMessage, response.status, data);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out', 0);
    }

    if (attempt < maxRetries) {
      await sleep(retryDelay * Math.pow(2, attempt));
      return request<T>(path, options, attempt + 1);
    }

    const message = error instanceof Error ? error.message : 'Network error';
    throw new ApiError(message, 0);
  }
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    return String(obj.error || obj.message || obj.detail || fallback);
  }
  return fallback || 'Request failed';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const apiClient = {
  get: <T = unknown>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: 'GET', headers: getHeaders() }),

  post: <T = unknown>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'PUT',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'PATCH',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: 'DELETE', headers: getHeaders() }),

  /** Upload files via FormData (no JSON content-type) */
  upload: async <T = unknown>(path: string, formData: FormData): Promise<T> => {
    const headers: Record<string, string> = {};
    if (currentProjectId) {
      headers['X-Project-Id'] = currentProjectId;
    }
    return request<T>(path, {
      method: 'POST',
      headers,
      body: formData,
    });
  },
};
