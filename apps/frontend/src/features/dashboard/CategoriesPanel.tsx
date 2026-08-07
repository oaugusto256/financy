import { Card } from '@/components/ui/Card';
import { PanelError } from '@/components/ui/PanelError';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tag } from '@/components/ui/Tag';
import { TextLink } from '@/components/ui/TextLink';
import { useCategoriesQuery } from '@/graphql/generated/graphql';
import { centsToDisplay } from '@/lib/currency';

/** Five, as frontend.md section 5 specifies. */
export const CATEGORY_LIMIT = 5;

export function CategoriesPanel() {
  const categories = useCategoriesQuery();
  const all = categories.data?.categories;

  // Sorted and capped on the client: `categories` returns the whole list
  // precisely because it is small (backend.md section 5), so this costs nothing
  // and needs no new argument. Array.prototype.sort is stable, so categories
  // with equal totals keep the server's alphabetical order rather than
  // reshuffling between renders. Copied first — sort mutates, and the array
  // belongs to the query cache.
  const top = all
    ? [...all]
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, CATEGORY_LIMIT)
    : undefined;

  return (
    <Card
      as="section"
      aria-labelledby="dashboard-categories-title"
      // `self-start` keeps the card at its content height. Without it the grid
      // stretches it to the taller transactions panel beside it, leaving a
      // block of empty card below the last row.
      className="flex flex-col self-start"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2
          id="dashboard-categories-title"
          className="text-xs font-semibold uppercase tracking-wider text-gray-500"
        >
          Categorias
        </h2>
        <TextLink to="/categories" arrow>
          Gerenciar
        </TextLink>
      </div>

      <div className="flex-1 p-6">
        {categories.isPending ? (
          <Skeleton
            label="Carregando categorias"
            count={CATEGORY_LIMIT}
            className="h-12"
            containerClassName="flex flex-col gap-2"
          />
        ) : categories.isError || !top ? (
          <PanelError
            message="Não foi possível carregar as categorias"
            onRetry={() => void categories.refetch()}
          />
        ) : top.length === 0 ? (
          // The way out is the "Gerenciar" link above, which stays mounted in
          // every state.
          <p className="py-6 text-center text-sm text-gray-500">
            Nenhuma categoria ainda
          </p>
        ) : (
          // The name is carried by the Tag alone — no icon badge and no
          // separate heading. frontend.md section 5.
          <ul className="flex flex-col gap-5">
            {top.map((category) => (
              <li key={category.id} className="flex items-center gap-3">
                <Tag
                  color={category.color}
                  className="min-w-0 truncate px-3 py-1.5 text-sm"
                >
                  {category.name}
                </Tag>

                {/* Both columns are right-aligned at a fixed width so the
                    counts and the totals line up down the panel rather than
                    drifting with the width of the figure beside them. */}
                <span className="ml-auto w-16 shrink-0 text-right text-sm text-gray-500">
                  {category.transactionCount === 1
                    ? '1 item'
                    : `${category.transactionCount} itens`}
                </span>

                <span className="min-w-28 shrink-0 text-right text-sm font-semibold text-gray-800">
                  {centsToDisplay(category.totalAmount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
