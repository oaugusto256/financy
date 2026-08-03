import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, className, id, ...props }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          ref={ref}
          type="checkbox"
          className={cn(
            'size-4 rounded border-gray-300 text-brand-base',
            'accent-brand-base',
            'focus:outline-none focus:ring-2 focus:ring-brand-base/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        />
        <label
          htmlFor={inputId}
          className="cursor-pointer select-none text-sm text-gray-600"
        >
          {label}
        </label>
      </div>
    );
  },
);
