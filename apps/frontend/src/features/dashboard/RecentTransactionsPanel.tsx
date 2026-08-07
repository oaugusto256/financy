import { Plus } from 'lucide-react';
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
      className="flex h-full flex-col"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2
          id="recent-transactions-title"
          className="text-xs font-semibold uppercase tracking-wider text-gray-500"
        >
          Transações recentes
        </h2>
        <TextLink to="/transactions" arrow>
          Ver todas
        </TextLink>
      </div>

      {/* No padding here: the rows carry their own, so their dividers run the
          full width of the card rather than stopping short of its edges. */}
      <div className="flex-1">
        {transactions.isPending ? (
          <Skeleton
            label="Carregando transações recentes"
            count={RECENT_LIMIT}
            className="h-12"
            containerClassName="flex flex-col gap-2 p-6"
          />
        ) : transactions.isError || !items ? (
          <div className="p-6">
            <PanelError
              message="Não foi possível carregar as transações"
              onRetry={() => void transactions.refetch()}
            />
          </div>
        ) : items.length === 0 ? (
          // The action that fixes it is the footer button below, which stays
          // mounted in every state.
          <p className="p-10 text-center text-sm text-gray-500">
            Nenhuma transação ainda
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {items.map((transaction) => (
              <li
                key={transaction.id}
                className="flex items-center gap-4 px-6 py-4"
              >
                {/* Both fall back to neutral when there is no category — a
                    transaction can be created without one and can lose one
                    when its category is deleted. frontend.md section 12. */}
                <CategoryBadge
                  icon={transaction.category?.icon}
                  color={transaction.category?.color}
                  className="size-11 shrink-0"
                  iconClassName="size-5"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-800">
                    {transaction.description}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {formatShortDate(transaction.date)}
                  </p>
                </div>

                {/* The category tag, never a type tag: the type is already
                    carried by the arrow and the sign. frontend.md section 12.
                    Centred in a fixed column so tags of different widths share
                    an axis down the panel instead of ending wherever the name
                    happens to end. */}
                <div className="flex w-40 shrink-0 justify-center">
                  <Tag
                    color={transaction.category?.color}
                    className="min-w-0 truncate px-4 py-1.5 text-sm"
                  >
                    {transaction.category?.name ?? 'Sem categoria'}
                  </Tag>
                </div>

                {/* The figure stays neutral and the arrow beside it carries the
                    direction, so a row reads as one line rather than a stack. */}
                <div className="flex shrink-0 items-center gap-2">
                  <span className="min-w-32 text-right font-semibold text-gray-800">
                    {formatSignedAmount(transaction.amount, transaction.type, {
                      spaced: true,
                    })}
                  </span>
                  <TypeIndicator type={transaction.type} labelHidden />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Borderless and transparent: the card's own divider separates it from
          the rows, so a second outline around the button drew a box inside a
          box. */}
      <div className="border-t border-gray-200 p-3">
        <Button
          variant="secondary"
          icon={Plus}
          className="w-full border-transparent bg-transparent text-brand-base hover:bg-gray-100"
          onClick={onCreate}
        >
          Nova transação
        </Button>
      </div>
    </Card>
  );
}
