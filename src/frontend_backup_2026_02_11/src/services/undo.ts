/**
 * Undo Service
 * Manages undo/redo stack for operations
 */

export interface UndoAction {
  id?: string;
  type?: string;
  description: string;
  undo: () => Promise<void> | void;
  redo?: () => Promise<void> | void;
  timestamp: number;
}

class UndoService {
  private undoStack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];
  private maxSize = 50;
  private listeners: Set<() => void> = new Set();

  /**
   * Push a new action to the undo stack
   */
  push(action: Omit<UndoAction, 'timestamp'>): void {
    this.undoStack.push({
      ...action,
      timestamp: Date.now(),
    });

    // Clear redo stack on new action
    this.redoStack = [];

    // Limit stack size
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }

    this.notify();
  }

  /**
   * Undo the last action
   */
  async undo(): Promise<boolean> {
    const action = this.undoStack.pop();
    if (!action) return false;

    try {
      await action.undo();
      this.redoStack.push(action);
      this.notify();
      return true;
    } catch (error) {
      console.error('Undo failed:', error);
      // Put action back on stack
      this.undoStack.push(action);
      return false;
    }
  }

  /**
   * Redo the last undone action
   */
  async redo(): Promise<boolean> {
    const action = this.redoStack.pop();
    if (!action || !action.redo) return false;

    try {
      await action.redo();
      this.undoStack.push(action);
      this.notify();
      return true;
    } catch (error) {
      console.error('Redo failed:', error);
      // Put action back on stack
      this.redoStack.push(action);
      return false;
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get last undoable action description
   */
  getUndoDescription(): string | null {
    const action = this.undoStack[this.undoStack.length - 1];
    return action?.description ?? null;
  }

  /**
   * Get last redoable action description
   */
  getRedoDescription(): string | null {
    const action = this.redoStack[this.redoStack.length - 1];
    return action?.description ?? null;
  }

  /**
   * Clear all undo/redo history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  /**
   * Subscribe to changes
   */
  onChange(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify listeners of changes
   */
  private notify(): void {
    this.listeners.forEach(fn => fn());
  }

  /**
   * Get stack sizes for debugging
   */
  getState(): { undoCount: number; redoCount: number } {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
  }
}

// Export singleton
export const undoManager = new UndoService();

// Export class for testing
export { UndoService };
