/**
 * Purpose:
 *   Reactive viewport-width hook that reports whether the screen is narrower
 *   than the mobile breakpoint (768px).
 *
 * Responsibilities:
 *   - Listen to a matchMedia query for (max-width: 767px)
 *   - Return a boolean that updates on resize
 *
 * Key dependencies:
 *   - None (browser matchMedia API)
 *
 * Side effects:
 *   - Attaches/removes a matchMedia 'change' event listener
 *
 * Notes:
 *   - Returns false during the first render (SSR-safe: initial state is undefined,
 *     coerced to false via !!). Layout shift may occur on hydration.
 *
 * @returns {boolean} true when viewport width < 768px
 */
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
