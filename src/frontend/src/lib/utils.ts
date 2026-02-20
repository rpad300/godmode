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

/** Merge and deduplicate Tailwind CSS class names. Conflicting utilities are resolved by tailwind-merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Check if a value is a valid, renderable avatar/image URL (guards against '', 'undefined', 'null'). */
export function isValidAvatarUrl(url: unknown): url is string {
  return typeof url === 'string' && url.length > 0 && url !== 'undefined' && url !== 'null';
}

/** Extract up to 2 initials from a name by splitting on word boundaries. "Ricardo Dias" → "RD". */
export function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
}

/**
 * Resolve the best avatar URL from a person-like object.
 * Priority: uploaded image (Google Drive or Supabase Storage) > photo_url > avatarUrl > avatar_url > avatar > image
 */
export function resolveAvatarUrl(person: Record<string, unknown> | null | undefined): string | null {
  if (!person) return null;
  const candidates = [person.photo_url, person.avatarUrl, person.avatar_url, person.avatar, person.image];
  const valid: string[] = [];
  for (const c of candidates) {
    if (isValidAvatarUrl(c)) valid.push(c);
  }
  if (valid.length === 0) return null;
  const uploaded = valid.find(u =>
    u.includes('/storage/v1/object/public/avatars/') ||
    u.includes('drive.google.com/thumbnail')
  );
  return uploaded || valid[0];
}

