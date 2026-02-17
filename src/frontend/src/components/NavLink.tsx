/**
 * Purpose:
 *   Thin wrapper around react-router-dom's NavLink that supports separate
 *   className, activeClassName, and pendingClassName string props instead
 *   of the render-function className API.
 *
 * Responsibilities:
 *   - Merges base, active, and pending class names via cn() utility
 *   - Forwards ref and all remaining NavLinkProps to RouterNavLink
 *
 * Key dependencies:
 *   - react-router-dom (NavLink): route-aware anchor element
 *   - cn (utils): conditional class merging
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - This exists to simplify consuming code that prefers static class
 *     strings over react-router's render-prop className function.
 */
import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
