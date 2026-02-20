/**
 * Purpose:
 *   404 error page displayed when the user navigates to a non-existent route.
 *
 * Responsibilities:
 *   - Log the invalid route path to console.error for debugging
 *   - Render a minimal centered 404 message with a link back to the home page
 *
 * Side effects:
 *   - Console: logs the attempted path on mount
 */
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--gm-bg-tertiary)]">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-[var(--gm-text-tertiary)]">Oops! Page not found</p>
        <a href="/" className="text-[var(--gm-accent-primary)] underline hover:text-[var(--gm-accent-primary)]/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
