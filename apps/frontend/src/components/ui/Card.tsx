import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'article' | 'section';
}

export function Card({ as: Element = 'div', className, ...props }: CardProps) {
  return (
    <Element
      className={cn('rounded-xl border border-gray-200 bg-white', className)}
      {...props}
    />
  );
}
