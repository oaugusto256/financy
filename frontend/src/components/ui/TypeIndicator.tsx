import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface TypeIndicatorProps {
  type: TransactionType;
  /**
   * Keeps the label in the accessibility tree but off the screen, leaving the
   * arrow alone visible. The dashboard panel draws it that way; colour and an
   * arrow on their own would say nothing to a screen reader.
   */
  labelHidden?: boolean;
  className?: string;
}

export function TypeIndicator({
  type,
  labelHidden = false,
  className,
}: TypeIndicatorProps) {
  const isIncome = type === 'INCOME';
  const Icon = isIncome ? ArrowUpCircle : ArrowDownCircle;
  const label = isIncome ? 'Entrada' : 'Saída';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium',
        isIncome ? 'text-success' : 'text-danger',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {labelHidden ? <span className="sr-only">{label}</span> : label}
    </span>
  );
}
