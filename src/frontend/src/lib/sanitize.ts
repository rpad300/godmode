import DOMPurify from 'dompurify';

/**
 * Sanitize HTML to prevent XSS when using dangerouslySetInnerHTML.
 * Allows safe formatting tags only.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
      'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 'a',
      'code', 'pre', 'blockquote', 'table', 'thead', 'tbody',
      'tr', 'th', 'td', 'div', 'span', 'img', 'sub', 'sup',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'title'],
    ALLOW_DATA_ATTR: false,
  });
}
