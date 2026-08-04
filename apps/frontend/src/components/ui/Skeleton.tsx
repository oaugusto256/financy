import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

export interface SkeletonProps {
  label: string;
  count: number;
  /** Applied to each placeholder — this is where the shape comes from. */
  className?: string;
  containerClassName?: string;
}

/**
 * Placeholders shaped like the content they replace, not a spinner over the
 * page. `frontend.md` section 10.
 *
 * role="status" with aria-busy, not aria-label on a div: a label on a plain div
 * has no role to attach to and is not reliably exposed, which is what slice 2's
 * review caught.
 */
export function Skeleton({
  label,
  count,
  className,
  containerClassName,
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className={containerClassName}
    >
      {Array.from({ length: count }, (_, index) => (
        <Card
          key={index}
          data-slot="skeleton-item"
          className={cn('animate-pulse bg-gray-200', className)}
        />
      ))}
    </div>
  );
}
