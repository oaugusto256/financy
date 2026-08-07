import { ChevronRight } from 'lucide-react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';

export interface TextLinkProps extends LinkProps {
  /**
   * Draws a chevron after the label, as the panel headers do. Hidden from the
   * accessibility tree, so the link is still addressed by its label alone.
   */
  arrow?: boolean;
}

export function TextLink({
  arrow = false,
  className,
  children,
  ...props
}: TextLinkProps) {
  return (
    <Link
      className={cn(
        'text-sm font-medium text-brand-base hover:underline',
        'focus:outline-none focus:ring-2 focus:ring-brand-base/30 rounded',
        arrow && 'inline-flex items-center gap-1',
        className,
      )}
      {...props}
    >
      {children}
      {arrow && <ChevronRight aria-hidden="true" className="size-4" />}
    </Link>
  );
}
