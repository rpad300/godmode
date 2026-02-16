/**
 * Global Error Boundary
 * Catches unhandled errors and promise rejections to prevent "Zombie App" state.
 * Displays a friendly "Toast of Death" or recovery UI.
 */
import { toast } from '@services/toast';

export class ErrorBoundary {
  private static isInitialized = false;

  static init(): void {
    if (this.isInitialized) return;

    window.addEventListener('error', this.handleError);
    window.addEventListener('unhandledrejection', this.handleRejection);

    this.isInitialized = true;
    console.log('[ErrorBoundary] Initialized global error handling.');
  }

  private static handleError(event: ErrorEvent): void {
    console.error('[ErrorBoundary] Uncaught Exception:', event.error);
    ErrorBoundary.showErrorUI('An unexpected error occurred.', event.error?.message);
  }

  private static handleRejection(event: PromiseRejectionEvent): void {
    console.error('[ErrorBoundary] Unhandled Promise Rejection:', event.reason);
    // Extract meaningful message from various rejection types
    const message = event.reason?.message || (typeof event.reason === 'string' ? event.reason : 'Unknown failure');
    ErrorBoundary.showErrorUI('Async operation failed.', message);
  }

  private static showErrorUI(title: string, details?: string): void {
    // We use a persistent, strictly styled toast or overlay here
    // For now, we reuse the toast service but force it to be persistent if possible,
    // or just show an error toast.

    // In a SOTA app, this might replace the root element with a "Crash Screen" 
    // if the error is catastrophic (determined by heuristics), but for now we warn the user.

    const msg = `${title} ${details ? `(${details})` : ''}`;
    toast.error(msg); // Assuming toast has a way to stick, or we just show it.

    // Optional: Send to telemetry service
    // Telemetry.trackError(...) 
  }
}
