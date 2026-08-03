import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from './Card';

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  iconClassName?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  iconClassName,
}: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden="true"
          className={cn('size-4 text-gray-500', iconClassName)}
        />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-800">{value}</p>
    </Card>
  );
}
