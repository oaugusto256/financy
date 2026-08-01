import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  helperText?: string;
  error?: string;
  icon?: LucideIcon;
}

// A native <select>, not a custom listbox. It is keyboard accessible, screen
// reader accessible and mobile friendly at no cost, and the design's select is
// a styled native control rather than a searchable combobox.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      options,
      placeholder,
      helperText,
      error,
      icon: Icon,
      className,
      id,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const descriptionId = `${selectId}-description`;
    const description = error ?? helperText;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={selectId}
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
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
            />
          )}
          <select
            id={selectId}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={description ? descriptionId : undefined}
            className={cn(
              'w-full appearance-none rounded-lg border bg-white py-2.5 text-sm text-gray-800',
              'focus:outline-none focus:ring-2 focus:ring-brand-base/30',
              'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400',
              Icon ? 'pl-9 pr-9' : 'pl-3 pr-9',
              error
                ? 'border-danger focus:border-danger'
                : 'border-gray-300 focus:border-brand-base',
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-500"
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
  },
);
