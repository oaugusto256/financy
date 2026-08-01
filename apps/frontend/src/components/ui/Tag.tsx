import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CATEGORY_COLORS, type CategoryColor } from '@/lib/category-tokens';

export interface TagProps {
  color?: CategoryColor;
  children: ReactNode;
  className?: string;
}

const NEUTRAL = { bg: 'bg-gray-200', text: 'text-gray-600' };

export function Tag({ color, children, className }: TagProps) {
  const palette = color ? CATEGORY_COLORS[color] : NEUTRAL;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        palette.bg,
        palette.text,
        className,
      )}
    >
      {children}
    </span>
  );
}
