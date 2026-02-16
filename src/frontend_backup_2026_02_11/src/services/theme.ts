/**
 * Theme Service
 * Manages dark/light/system theme with auto-detection
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

class ThemeService {
  private mode: ThemeMode;
  private listeners: Set<(theme: EffectiveTheme) => void> = new Set();
  private mediaQuery: MediaQueryList;

  constructor() {
    this.mode = this.getSavedTheme();
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    this.apply();
    this.watchSystemChanges();
  }

  /**
   * Get saved theme from localStorage or default to 'system'
   */
  private getSavedTheme(): ThemeMode {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    return 'system';
  }

  /**
   * Get the system's preferred color scheme
   */
  private getSystemTheme(): EffectiveTheme {
    return this.mediaQuery.matches ? 'light' : 'dark';
  }

  /**
   * Watch for system theme changes
   */
  private watchSystemChanges(): void {
    this.mediaQuery.addEventListener('change', () => {
      if (this.mode === 'system') {
        this.apply();
      }
    });
  }

  /**
   * Get the effective theme (resolving 'system' to actual theme)
   */
  getEffective(): EffectiveTheme {
    if (this.mode === 'system') {
      return this.getSystemTheme();
    }
    return this.mode;
  }

  /**
   * Get the current mode setting
   */
  getMode(): ThemeMode {
    return this.mode;
  }

  /**
   * Apply the current theme to the document
   */
  apply(): void {
    const effective = this.getEffective();
    document.documentElement.setAttribute('data-theme', effective);
    
    // Notify listeners
    this.listeners.forEach(fn => fn(effective));
  }

  /**
   * Set theme mode directly
   */
  set(mode: ThemeMode): void {
    this.mode = mode;
    localStorage.setItem('theme', mode);
    this.apply();
  }

  /**
   * Cycle through themes: light -> dark -> system -> light
   */
  cycle(): ThemeMode {
    const modes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = modes.indexOf(this.mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.set(modes[nextIndex]);
    return this.mode;
  }

  /**
   * Toggle between light and dark (ignores system)
   */
  toggle(): EffectiveTheme {
    const effective = this.getEffective();
    const newTheme: EffectiveTheme = effective === 'dark' ? 'light' : 'dark';
    this.set(newTheme);
    return newTheme;
  }

  /**
   * Subscribe to theme changes
   */
  onChange(callback: (theme: EffectiveTheme) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Get icon for current theme mode
   */
  getIcon(): string {
    switch (this.mode) {
      case 'light': return '☀️';
      case 'dark': return '🌙';
      case 'system': return '💻';
    }
  }

  /**
   * Get label for current theme mode
   */
  getLabel(): string {
    switch (this.mode) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'system': return 'System';
    }
  }
}

// Export singleton instance
export const theme = new ThemeService();

// Export class for testing
export { ThemeService };
