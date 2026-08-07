import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  CATEGORY_COLORS,
  CATEGORY_COLOR_LABELS,
  CATEGORY_COLOR_VALUES,
  type CategoryColor,
} from '@/lib/category-tokens';

export interface ColorPickerProps {
  legend: string;
  name: string;
  value: CategoryColor;
  onChange: (value: CategoryColor) => void;
}

export function ColorPicker({
  legend,
  name,
  value,
  onChange,
}: ColorPickerProps) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-gray-700">
        {legend}
      </legend>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_COLOR_VALUES.map((token) => {
          const selected = token === value;

          return (
            <label key={token} className="cursor-pointer">
              <input
                type="radio"
                name={name}
                value={token}
                checked={selected}
                onChange={() => onChange(token)}
                aria-label={CATEGORY_COLOR_LABELS[token]}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-base/30',
                  CATEGORY_COLORS[token].swatch,
                  selected && 'ring-2 ring-brand-base ring-offset-2',
                )}
              >
                {selected && (
                  <Check aria-hidden="true" className="size-4 text-white" />
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
