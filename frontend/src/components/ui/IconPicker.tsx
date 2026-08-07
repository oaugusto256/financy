import { cn } from '@/lib/cn';
import {
  CATEGORY_ICONS,
  CATEGORY_ICON_LABELS,
  CATEGORY_ICON_VALUES,
  type CategoryIcon,
} from '@/lib/category-tokens';

export interface IconPickerProps {
  legend: string;
  name: string;
  value: CategoryIcon;
  onChange: (value: CategoryIcon) => void;
}

/**
 * A native radio group: one tab stop, arrow keys between options, and the right
 * announcement, none of which has to be written here. Takes a value and
 * reports a value — a consumer wires it with whatever owns the value, form
 * library or not.
 */
export function IconPicker({ legend, name, value, onChange }: IconPickerProps) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-gray-700">
        {legend}
      </legend>

      <div className="grid grid-cols-8 gap-2">
        {CATEGORY_ICON_VALUES.map((token) => {
          const Icon = CATEGORY_ICONS[token];
          const selected = token === value;

          return (
            <label key={token} className="cursor-pointer">
              <input
                type="radio"
                name={name}
                value={token}
                checked={selected}
                onChange={() => onChange(token)}
                aria-label={CATEGORY_ICON_LABELS[token]}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-lg border bg-white',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-base/30',
                  selected
                    ? 'border-brand-base ring-2 ring-brand-base'
                    : 'border-gray-300',
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    'size-4',
                    selected ? 'text-brand-base' : 'text-gray-500',
                  )}
                />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
