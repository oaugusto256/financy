import { Pencil, Trash2 } from 'lucide-react';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { IconButton } from '@/components/ui/IconButton';
import { Tag } from '@/components/ui/Tag';
import { TypeIndicator } from '@/components/ui/TypeIndicator';
import { formatSignedAmount } from '@/lib/currency';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { CategoryColor, CategoryIcon } from '@/lib/category-tokens';

export interface TransactionRowData {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string;
  category: {
    id: string;
    name: string;
    icon: CategoryIcon;
    color: CategoryColor;
  } | null;
}

export interface TransactionRowProps {
  transaction: TransactionRowData;
  onEdit: (transaction: TransactionRowData) => void;
  onDelete: (transaction: TransactionRowData) => void;
}

const CELL = 'px-4 py-3 text-sm whitespace-nowrap';

export function TransactionRow({
  transaction,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const { description, amount, type, date, category } = transaction;

  return (
    <tr className="border-t border-gray-200">
      <td className={CELL}>
        <div className="flex items-center gap-3">
          {/* Both fall back to neutral when there is no category — a
              transaction can be created without one and can lose one when its
              category is deleted. frontend.md section 12. */}
          <CategoryBadge icon={category?.icon} color={category?.color} />
          <span className="font-medium text-gray-800">{description}</span>
        </div>
      </td>

      <td className={cn(CELL, 'text-gray-600')}>{formatShortDate(date)}</td>

      <td className={CELL}>
        <Tag color={category?.color}>{category?.name ?? 'Sem categoria'}</Tag>
      </td>

      <td className={CELL}>
        <TypeIndicator type={type} />
      </td>

      <td
        className={cn(
          CELL,
          'font-semibold',
          type === 'INCOME' ? 'text-success' : 'text-danger',
        )}
      >
        {formatSignedAmount(amount, type)}
      </td>

      <td className={CELL}>
        {/* Edit before delete, so tabbing across a row reaches the safe action
            first. */}
        <div className="flex gap-2">
          <IconButton
            icon={Pencil}
            label={`Editar ${description}`}
            onClick={() => onEdit(transaction)}
          />
          <IconButton
            icon={Trash2}
            label={`Excluir ${description}`}
            variant="danger"
            onClick={() => onDelete(transaction)}
          />
        </div>
      </td>
    </tr>
  );
}
