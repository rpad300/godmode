/**
 * Keyboard Shortcuts Service
 * Manages global keyboard shortcuts
 */

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  handler: () => void;
}

// Type for string-based shortcut registration (e.g., 'mod+k', 'ctrl+shift+s')
export type ShortcutHandler = (event: KeyboardEvent) => void;

class ShortcutService {
  private shortcuts: Map<string, Shortcut> = new Map();
  private enabled = true;
  private isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  constructor() {
    this.handleKeydown = this.handleKeydown.bind(this);
    document.addEventListener('keydown', this.handleKeydown);
  }

  /**
   * Parse string shortcut to Shortcut object
   * Supports: 'mod+k' (cmd on Mac, ctrl on others), 'ctrl+shift+s', '/', 'Escape'
   */
  private parseShortcut(shortcutStr: string, handler: ShortcutHandler, description = ''): Shortcut {
    const parts = shortcutStr.toLowerCase().split('+');
    const key = parts.pop() || shortcutStr;
    
    const shortcut: Shortcut = {
      key,
      ctrl: parts.includes('ctrl') || (parts.includes('mod') && !this.isMac),
      shift: parts.includes('shift'),
      alt: parts.includes('alt'),
      meta: parts.includes('meta') || (parts.includes('mod') && this.isMac),
      description,
      handler: () => {
        // Create a synthetic event for backwards compatibility
        const syntheticEvent = new KeyboardEvent('keydown', { key });
        handler(syntheticEvent);
      },
    };

    return shortcut;
  }

  /**
   * Generate unique key for shortcut
   */
  private getShortcutKey(shortcut: Omit<Shortcut, 'description' | 'handler'>): string {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('ctrl');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.alt) parts.push('alt');
    if (shortcut.meta) parts.push('meta');
    if (shortcut.key) {
      parts.push(shortcut.key.toLowerCase());
    }
    return parts.join('+');
  }

  /**
   * Handle keydown events
   */
  private handleKeydown(event: KeyboardEvent): void {
    if (!this.enabled) return;

    // Don't trigger shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Allow Escape in input fields
      if (event.key !== 'Escape') {
        return;
      }
    }

    const key = this.getShortcutKey({
      key: event.key,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey,
    });

    const shortcut = this.shortcuts.get(key);
    if (shortcut) {
      event.preventDefault();
      shortcut.handler();
    }
  }

  /**
   * Register a keyboard shortcut
   * Supports both object format and string format:
   * - Object: { key: 'k', ctrl: true, handler: () => {}, description: 'Search' }
   * - String: register('mod+k', (e) => {}, 'Search')
   */
  register(shortcutOrKey: Shortcut | string, handler?: ShortcutHandler, description?: string): () => void {
    let shortcut: Shortcut;
    
    if (typeof shortcutOrKey === 'string') {
      if (!handler) {
        throw new Error('Handler is required when using string shortcut format');
      }
      shortcut = this.parseShortcut(shortcutOrKey, handler, description || '');
    } else {
      shortcut = shortcutOrKey;
    }
    
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
    
    // Return unregister function
    return () => this.shortcuts.delete(key);
  }

  /**
   * Unregister a shortcut by key combination
   */
  unregister(shortcut: Omit<Shortcut, 'description' | 'handler'>): void {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.delete(key);
  }

  /**
   * Enable/disable all shortcuts
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get all registered shortcuts
   */
  getAll(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Show shortcuts help modal
   */
  showHelp(): void {
    const shortcuts = this.getAll();
    console.log('Keyboard Shortcuts:');
    shortcuts.forEach(s => {
      const parts: string[] = [];
      if (s.ctrl) parts.push('Ctrl');
      if (s.shift) parts.push('Shift');
      if (s.alt) parts.push('Alt');
      if (s.meta) parts.push('Cmd');
      parts.push(s.key.toUpperCase());
      console.log(`  ${parts.join('+')} - ${s.description}`);
    });
  }

  /**
   * Destroy service and remove event listener
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeydown);
    this.shortcuts.clear();
  }
}

// Export singleton
export const shortcuts = new ShortcutService();

// Export class for testing
export { ShortcutService };
