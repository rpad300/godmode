/**
 * DOM Utilities
 * Helper functions for DOM manipulation
 */

/**
 * Query selector with type safety
 */
export function $(selector: string, parent: ParentNode = document): HTMLElement | null {
  return parent.querySelector(selector);
}

/**
 * Query selector all with type safety
 */
export function $$(selector: string, parent: ParentNode = document): HTMLElement[] {
  return Array.from(parent.querySelectorAll(selector));
}

/**
 * Get element by ID with type safety
 */
export function $id<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Create element with attributes
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes?: Partial<HTMLElementTagNameMap[K]>,
  children?: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        el.className = value as string;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else if (key.startsWith('data')) {
        el.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), String(value));
      } else {
        (el as Record<string, unknown>)[key] = value;
      }
    });
  }
  
  if (children) {
    children.forEach(child => {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    });
  }
  
  return el;
}

/**
 * Add event listener with cleanup
 */
export function on<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | Window | Document,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions
): () => void {
  element.addEventListener(event, handler as EventListener, options);
  return () => element.removeEventListener(event, handler as EventListener, options);
}

/**
 * Toggle class on element
 */
export function toggleClass(element: HTMLElement, className: string, force?: boolean): boolean {
  return element.classList.toggle(className, force);
}

/**
 * Add multiple classes
 */
export function addClass(element: HTMLElement, ...classes: string[]): void {
  element.classList.add(...classes);
}

/**
 * Remove multiple classes
 */
export function removeClass(element: HTMLElement, ...classes: string[]): void {
  element.classList.remove(...classes);
}

/**
 * Check if element has class
 */
export function hasClass(element: HTMLElement, className: string): boolean {
  return element.classList.contains(className);
}

/**
 * Set multiple attributes
 */
export function setAttributes(element: HTMLElement, attrs: Record<string, string>): void {
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

/**
 * Remove element from DOM
 */
export function remove(element: HTMLElement): void {
  element.remove();
}

/**
 * Empty element contents
 */
export function empty(element: HTMLElement): void {
  element.innerHTML = '';
}

/**
 * Set inner HTML safely
 */
export function setHTML(element: HTMLElement, html: string): void {
  element.innerHTML = html;
}

/**
 * Show element. Uses class 'hidden' when display is 'block'; otherwise sets style.display.
 */
export function show(element: HTMLElement, display = 'block'): void {
  element.classList.remove('hidden');
  if (display === 'block') {
    element.style.removeProperty('display');
  } else {
    element.style.display = display;
  }
}

/**
 * Hide element using class 'hidden' (display: none).
 */
export function hide(element: HTMLElement): void {
  element.classList.add('hidden');
}

/**
 * Toggle element visibility. Uses class 'hidden' when display is 'block'.
 */
export function toggle(element: HTMLElement, visible?: boolean, display = 'block'): void {
  if (visible === undefined) {
    visible = element.classList.contains('hidden');
  }
  if (visible) {
    show(element, display);
  } else {
    hide(element);
  }
}

/**
 * Scroll element into view
 */
export function scrollIntoView(element: HTMLElement, options?: ScrollIntoViewOptions): void {
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    ...options,
  });
}

/**
 * Focus element with optional scroll
 */
export function focus(element: HTMLElement, preventScroll = false): void {
  element.focus({ preventScroll });
}

/**
 * Wait for element to appear in DOM
 */
export function waitForElement(selector: string, timeout = 5000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const element = $(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = $(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}
