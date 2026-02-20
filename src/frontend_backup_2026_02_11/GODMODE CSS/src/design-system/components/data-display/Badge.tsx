/**
 * Badge Component
 * Status indicator with color variants
 */

import { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export const badgeVariants = ['default', 'success', 'warning', 'danger', 'info'] as const;
export const badgeSizes = ['sm', 'md', 'lg'] as const;

export type BadgeVariant = typeof badgeVariants[number];
export type BadgeSize = typeof badgeSizes[number];

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const baseStyles = 'inline-flex items-center gap-1.5 font-medium rounded-full';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-secondary text-text-secondary',
  success: 'bg-status-success-bg text-status-success',
  warning: 'bg-status-warning-bg text-status-warning',
  danger: 'bg-status-danger-bg text-status-danger',
  info: 'bg-status-info-bg text-status-info',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function Badge({ 
  className, 
  variant = 'default', 
  size = 'md',
  dot = false,
  children, 
  ...props 
}: BadgeProps) {
  return (
    <span
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      )}
      {children}
    </span>
  );
}
