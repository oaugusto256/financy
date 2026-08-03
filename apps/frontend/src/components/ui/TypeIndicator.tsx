import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface TypeIndicatorProps {
  type: TransactionType;
  className?: string;
}

export function TypeIndicator({ type, className }: TypeIndicatorProps) {
  const isIncome = type === 'INCOME';
  const Icon = isIncome ? ArrowUpCircle : ArrowDownCircle;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium',
        isIncome ? 'text-success' : 'text-danger',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {isIncome ? 'Entrada' : 'Saída'}
    </span>
  );
}
