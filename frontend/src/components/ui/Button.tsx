import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'sm';
  icon?: LucideIcon;
  loading?: boolean;
}

const VARIANTS = {
  primary: cn(
    'bg-brand-base text-white',
    'hover:bg-brand-dark',
    'disabled:bg-brand-base/50',
  ),
  secondary: cn(
    'border border-gray-300 bg-white text-gray-700',
    'hover:bg-gray-200',
    'disabled:border-gray-200 disabled:text-gray-400 disabled:bg-white',
  ),
} as const;

const SIZES = {
  md: 'h-11 px-4 text-sm',
  sm: 'h-9 px-3 text-sm',
} as const;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      icon: Icon,
      loading = false,
      disabled,
      className,
      children,
      // Defaults to button, not submit. A <button> inside a form submits it
      // unless told otherwise, which turns every cancel into a save.
      type = 'button',
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        // Loading disables the button, so a double click cannot fire the same
        // mutation twice.
        disabled={disabled ?? loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-base/30',
          'disabled:cursor-not-allowed',
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          Icon && <Icon aria-hidden="true" className="size-4" />
        )}
        {children}
      </button>
    );
  },
);
