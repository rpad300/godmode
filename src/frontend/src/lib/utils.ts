/**
 * Purpose:
 *   General-purpose utility functions shared across the frontend.
 *
 * Responsibilities:
 *   - cn(): merge and deduplicate Tailwind CSS class strings
 *
 * Key dependencies:
 *   - clsx: conditional class concatenation
 *   - tailwind-merge: intelligent Tailwind class deduplication (e.g. p-2 + p-4 => p-4)
 *
 * Side effects:
 *   - None
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
