import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { PanelError } from '@/components/ui/PanelError';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tag } from '@/components/ui/Tag';
import { TextLink } from '@/components/ui/TextLink';
import { TypeIndicator } from '@/components/ui/TypeIndicator';
import { useTransactionsQuery } from '@/graphql/generated/graphql';
import { formatSignedAmount } from '@/lib/currency';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Five, as frontend.md section 5 specifies. */
export const RECENT_LIMIT = 5;

export interface RecentTransactionsPanelProps {
  /** Opens the screen's one transaction dialog. Owned by DashboardPage. */
  onCreate: () => void;
}

/**
 * Reuses the paginated `Transactions` query rather than a dedicated field: its
 * default ordering is already date DESC, createdAt DESC, which is exactly "the
 * five most recent". A second field returning the same rows in the same order
 * would be a second thing to keep correct.
 */
export function RecentTransactionsPanel({
  onCreate,
}: RecentTransactionsPanelProps) {
  const transactions = useTransactionsQuery({
    limit: RECENT_LIMIT,
    offset: 0,
  });
  const items = transactions.data?.transactions.items;

  return (
    <Card
      as="section"
      aria-labelledby="recent-transactions-title"
      className="flex flex-col"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2
          id="recent-transactions-title"
          className="font-semibold text-gray-800"
        >
          Transações recentes
        </h2>
        <TextLink to="/transactions">Ver todas</TextLink>
      </div>

      <div className="flex-1 p-5">
        {transactions.isPending ? (
          <Skeleton
            label="Carregando transações recentes"
            count={RECENT_LIMIT}
            className="h-12"
            containerClassName="flex flex-col gap-2"
          />
        ) : transactions.isError || !items ? (
          <PanelError
            message="Não foi possível carregar as transações"
            onRetry={() => void transactions.refetch()}
          />
        ) : items.length === 0 ? (
          // The action that fixes it is the footer button below, which stays
          // mounted in every state.
          <p className="py-6 text-center text-sm text-gray-500">
            Nenhuma transação ainda
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((transaction) => (
              <li key={transaction.id} className="flex items-center gap-3">
                {/* Both fall back to neutral when there is no category — a
                    transaction can be created without one and can lose one
                    when its category is deleted. frontend.md section 12. */}
                <CategoryBadge
                  icon={transaction.category?.icon}
                  color={transaction.category?.color}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-800">
                    {transaction.description}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatShortDate(transaction.date)}
                  </p>
                </div>

                {/* The category tag, never a type tag: the type is already
                    carried by the arrow and the sign. frontend.md section 12. */}
                <Tag color={transaction.category?.color}>
                  {transaction.category?.name ?? 'Sem categoria'}
                </Tag>

                <div className="flex flex-col items-end gap-0.5">
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      transaction.type === 'INCOME'
                        ? 'text-success'
                        : 'text-danger',
                    )}
                  >
                    {formatSignedAmount(transaction.amount, transaction.type)}
                  </span>
                  <TypeIndicator type={transaction.type} className="text-xs" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-gray-200 px-5 py-4">
        <Button variant="secondary" className="w-full" onClick={onCreate}>
          + Nova transação
        </Button>
      </div>
    </Card>
  );
}
