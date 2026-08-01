import { Tag as TagIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  type CategoryColor,
  type CategoryIcon,
} from '@/lib/category-tokens';

export interface CategoryBadgeProps {
  icon?: CategoryIcon;
  color?: CategoryColor;
  className?: string;
}

// Falls back to neutral when the category is absent, as Tag does. A transaction
// can have no category from the day it is created, and any category can be
// deleted out from under one — the design has no state for that, so this is
// where it is handled.
export function CategoryBadge({ icon, color, className }: CategoryBadgeProps) {
  const palette = color
    ? CATEGORY_COLORS[color]
    : { bg: 'bg-gray-200', icon: 'text-gray-500' };
  const Icon = icon ? CATEGORY_ICONS[icon] : TagIcon;

  return (
    <span
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg',
        palette.bg,
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn('size-4', palette.icon)} />
    </span>
  );
}
