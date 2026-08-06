import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  tone: 'danger' | 'success';
}

export interface SegmentedControlProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}

// Spelled out, never interpolated: Tailwind scans source text for whole class
// names, so `bg-${tone}` compiles to nothing and the segment renders unstyled.
const SELECTED = {
  danger: 'border-danger bg-red-light text-red-dark',
  success: 'border-success bg-green-light text-green-dark',
} as const;

/**
 * A native radio group behind two labels. One tab stop, arrow keys between the
 * options and the right announcement, none of which has to be written here.
 *
 * Takes a value and reports a value. It knows nothing about React Hook Form —
 * a consumer wires it with `Controller`, which works for any form library and
 * for no form library at all.
 */
export function SegmentedControl<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-gray-700">
        {legend}
      </legend>

      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <label key={option.value} className="cursor-pointer">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex h-11 items-center justify-center rounded-lg border text-sm font-medium',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-base/30',
                  selected
                    ? SELECTED[option.tone]
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100',
                )}
              >
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
