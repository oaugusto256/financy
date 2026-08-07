import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
  icon?: LucideIcon;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, error, icon: Icon, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const description = error ?? helperText;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn(
          'text-sm font-medium',
          error ? 'text-danger' : 'text-gray-700',
        )}
      >
        {label}
      </label>

      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2',
              error ? 'text-danger' : 'text-gray-400',
            )}
          />
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={description ? descriptionId : undefined}
          className={cn(
            'w-full rounded-lg border bg-white py-2.5 text-sm text-gray-800',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-brand-base/30',
            'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400',
            Icon ? 'pl-9 pr-3' : 'px-3',
            error
              ? 'border-danger focus:border-danger'
              : 'border-gray-300 focus:border-brand-base',
            className,
          )}
          {...props}
        />
      </div>

      {description && (
        <p
          id={descriptionId}
          className={cn('text-xs', error ? 'text-danger' : 'text-gray-500')}
        >
          {description}
        </p>
      )}
    </div>
  );
});
