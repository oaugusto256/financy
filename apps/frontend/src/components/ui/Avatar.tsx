import { cn } from '@/lib/cn';
import { initialsFromName } from '@/lib/initials';

export interface AvatarProps {
  name: string;
  size?: 'sm' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'size-9 text-xs',
  lg: 'size-20 text-2xl',
} as const;

export function Avatar({ name, size = 'sm', className }: AvatarProps) {
  return (
    <span
      title={name}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-gray-300 font-medium text-gray-700',
        SIZES[size],
        className,
      )}
    >
      {initialsFromName(name)}
    </span>
  );
}
