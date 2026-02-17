/**
 * Purpose:
 *   Manages the application colour theme (light/dark) with localStorage
 *   persistence and OS-preference detection as a fallback.
 *
 * Responsibilities:
 *   - Read persisted theme from localStorage ('godmode-theme')
 *   - Fall back to the OS prefers-color-scheme media query
 *   - Toggle the 'dark' class on <html> so Tailwind dark-mode utilities apply
 *   - Persist every change back to localStorage
 *
 * Key dependencies:
 *   - None (pure browser APIs)
 *
 * Side effects:
 *   - Reads/writes localStorage key 'godmode-theme'
 *   - Mutates document.documentElement.classList ('dark' class)
 *
 * Notes:
 *   - Re-renders the consuming component only when the theme value changes
 *
 * @returns {{ theme, toggleTheme, setTheme }}
 */
import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('godmode-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('godmode-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  return { theme, toggleTheme, setTheme };
}
