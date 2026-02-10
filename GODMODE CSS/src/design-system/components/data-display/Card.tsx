/**
 * Card Component
 * Content container with optional header and footer
 */

import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  elevated?: boolean;
  glass?: boolean;
  noPadding?: boolean;
}

const baseStyles = 'bg-surface-primary border border-border-primary rounded-lg transition-all';

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ 
    className,
    header,
    footer,
    elevated = false,
    glass = false,
    noPadding = false,
    children,
    ...props 
  }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          elevated && 'shadow-lg hover:shadow-xl',
          glass && 'backdrop-blur-md bg-bg-glass',
          className
        )}
        {...props}
      >
        {header && (
          <div className="px-6 py-4 border-b border-border-primary">
            {header}
          </div>
        )}
        <div className={cn(!noPadding && 'p-6')}>
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-border-primary">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';
