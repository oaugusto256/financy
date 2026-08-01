import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';

export function TextLink({ className, ...props }: LinkProps) {
  return (
    <Link
      className={cn(
        'text-sm font-medium text-brand-base hover:underline',
        'focus:outline-none focus:ring-2 focus:ring-brand-base/30 rounded',
        className,
      )}
      {...props}
    />
  );
}
