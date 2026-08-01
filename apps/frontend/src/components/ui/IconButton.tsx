import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  icon: LucideIcon;
  // Required, not optional. A button whose only content is an icon is an
  // unlabelled button, and every row of both tables is full of them.
  label: string;
  variant?: 'neutral' | 'danger';
}

const VARIANTS = {
  neutral: 'border-gray-300 text-gray-600 hover:bg-gray-200',
  danger: 'border-danger/30 text-danger hover:bg-red-light',
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon: Icon,
      label,
      variant = 'neutral',
      className,
      type = 'button',
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-lg border bg-white',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-base/30',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white',
          VARIANTS[variant],
          className,
        )}
        {...props}
      >
        <Icon aria-hidden="true" className="size-4" />
      </button>
    );
  },
);
