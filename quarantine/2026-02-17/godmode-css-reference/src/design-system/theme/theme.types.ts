/**
 * Theme Types
 * TypeScript types for theme system
 */

export type Theme = 'light' | 'dark';

export interface ThemeConfig {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}
