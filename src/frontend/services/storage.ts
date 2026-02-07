/**
 * Storage Service
 * Wrapper for localStorage with type safety and JSON handling
 */

/**
 * Get item from localStorage with JSON parsing.
 * Never throws: returns defaultValue if storage is blocked (e.g. Tracking Prevention) or parse fails.
 */
export function getItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Set item in localStorage with JSON serialization.
 * Never throws: no-op if storage is blocked (e.g. Tracking Prevention).
 */
export function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or quota exceeded - ignore
  }
}

/**
 * Remove item from localStorage. Never throws; no-op if storage is blocked.
 */
export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Clear all localStorage. Never throws; no-op if storage is blocked.
 */
export function clear(): void {
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
}

/**
 * Check if key exists in localStorage. Returns false if storage is blocked.
 */
export function hasItem(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * Get all keys in localStorage. Returns [] if storage is blocked.
 */
export function getKeys(): string[] {
  try {
    return Object.keys(localStorage);
  } catch {
    return [];
  }
}

/**
 * Storage namespace export
 */
export const storage = {
  get: getItem,
  set: setItem,
  remove: removeItem,
  clear,
  has: hasItem,
  keys: getKeys,
};
