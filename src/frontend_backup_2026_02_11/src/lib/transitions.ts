/**
 * SOTA View Transitions Utility
 * Wraps DOM updates in document.startViewTransition if supported.
 */

export function startViewTransition(callback: () => void | Promise<void>): void {
    // Check browser support
    if (!document.startViewTransition) {
        callback();
        return;
    }

    // Start transition
    const transition = document.startViewTransition(async () => {
        await callback();
    });

    // Optional: Handle cleanup or logging
    transition.finished.then(() => {
        // Transition complete
        document.documentElement.classList.remove('vt-slide', 'vt-slide-back');
    });
}

/**
 * Trigger a back navigation transition
 */
export function navigateBack(callback: () => void | Promise<void>): void {
    document.documentElement.classList.add('vt-slide-back');
    startViewTransition(callback);
}

/**
 * Trigger a forward navigation transition
 */
export function navigateForward(callback: () => void | Promise<void>): void {
    document.documentElement.classList.add('vt-slide');
    startViewTransition(callback);
}
