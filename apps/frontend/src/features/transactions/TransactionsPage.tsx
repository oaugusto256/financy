import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
import { PanelError } from '@/components/ui/PanelError';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageShell } from '@/components/layout/PageShell';
import {
  useCategoriesQuery,
  useTransactionsQuery,
} from '@/graphql/generated/graphql';
import {
  TransactionsTable,
  type TransactionRowData,
} from './TransactionsTable';
import {
  TransactionDialog,
  type TransactionFormTarget,
} from './TransactionDialog';
import {
  DeleteTransactionDialog,
  type DeleteTransactionTarget,
} from './DeleteTransactionDialog';
import { useTransactionFilters } from './useTransactionFilters';
import { TransactionFilters } from './TransactionFilters';

/** Ten rows per page, matching the design. */
export const PAGE_SIZE = 10;

export function TransactionsPage() {
  // Every filter, and the page, live in the query string. useTransactionFilters
  // owns the reading and the writing; nothing here mirrors them in state.
  const filters = useTransactionFilters();
  const { page } = filters;
  const [, setSearchParams] = useSearchParams();

  // The bar's category select. Already in the cache whenever the categories
  // page or the transaction dialog has run; here it is just another query.
  const categories = useCategoriesQuery();

  const [dialogTarget, setDialogTarget] =
    useState<TransactionFormTarget | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<DeleteTransactionTarget | null>(null);

  const transactions = useTransactionsQuery({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    // Spread, not `filter: filters.filter`: an explicit `filter: undefined`
    // is still a key with a `filter` property, and would miss the cache entry
    // every pre-filter caller wrote.
    ...(filters.filter && { filter: filters.filter }),
  });

  function goToPage(next: number) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set('page', String(next));
      return params;
    });
  }

  function openCreate() {
    setDialogTarget(null);
    setDialogOpen(true);
  }

  function openEdit(transaction: TransactionRowData) {
    setDialogTarget({
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      date: transaction.date,
      categoryId: transaction.category?.id ?? null,
    });
    setDialogOpen(true);
  }

  // `result`, not `page`: the page number and the page of data are different
  // things, and reusing the word is how a bug gets written.
  const result = transactions.data?.transactions;
  const totalCount = result?.totalCount ?? 0;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, totalCount);

  // Reachable once data has loaded: deleting the last row(s) on the last page
  // shrinks totalCount, and the URL is still asking for the old, now
  // out-of-range page. A hand-typed `?page=99` reaches the same state on the
  // very first load. `!!result` gates this on data actually being in — the
  // pending and error branches below must not be preempted by it.
  const pageOutOfRange = !!result && totalCount > 0 && page > pageCount;

  useEffect(() => {
    if (!pageOutOfRange) return;

    // `replace: true` so this correction does not sit in history — a user
    // pressing back should not land right back on the dead page it just
    // fixed.
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.set('page', String(pageCount));
        return params;
      },
      { replace: true },
    );
  }, [pageOutOfRange, pageCount, setSearchParams]);

  return (
    <PageShell
      title="Transações"
      subtitle="Acompanhe suas entradas e saídas"
      action={<Button onClick={openCreate}>+ Nova transação</Button>}
    >
      <TransactionFilters
        values={filters.values}
        draftSearch={filters.draftSearch}
        onSearchChange={filters.setDraftSearch}
        onValueChange={filters.setValue}
        categories={categories.data?.categories ?? []}
        categoriesFailed={categories.isError}
      />

      {transactions.isPending || pageOutOfRange ? (
        // The out-of-range case renders as loading rather than the stale,
        // empty response for the dead page — the effect above is about to
        // refetch at the corrected offset, and there is nothing worth
        // showing from the request that is being discarded.
        <Skeleton
          label="Carregando transações"
          count={5}
          className="h-14"
          containerClassName="flex flex-col gap-2"
        />
      ) : transactions.isError || !result ? (
        <PanelError
          message="Não foi possível carregar as transações"
          onRetry={() => void transactions.refetch()}
        />
      ) : totalCount === 0 ? (
        // Two different empty states. frontend.md section 10: a user who
        // filtered into nothing must not be told they have no transactions —
        // and must be offered the way out.
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          {filters.isFiltered ? (
            <>
              <p className="font-medium text-gray-800">
                Nenhuma transação encontrada
              </p>
              <p className="text-sm text-gray-500">
                Nenhum resultado corresponde aos filtros aplicados.
              </p>
              <Button variant="secondary" onClick={filters.clear}>
                Limpar filtros
              </Button>
            </>
          ) : (
            <>
              <p className="font-medium text-gray-800">
                Nenhuma transação ainda
              </p>
              <p className="text-sm text-gray-500">
                Registre sua primeira despesa ou receita.
              </p>
              <Button onClick={openCreate}>Criar primeira transação</Button>
            </>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <TransactionsTable
            transactions={result.items}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">
              {first} a {last} | {totalCount} resultados
            </p>
            <Pagination
              page={page}
              pageCount={pageCount}
              onPageChange={goToPage}
            />
          </div>
        </Card>
      )}

      {/* Mounted only while open. A permanently mounted dialog keyed on its
          target reopens holding the previous values — the blocking defect
          slice 2's review found on the categories page. */}
      {dialogOpen && (
        <TransactionDialog
          open
          onClose={() => setDialogOpen(false)}
          transaction={dialogTarget}
        />
      )}

      <DeleteTransactionDialog
        transaction={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </PageShell>
  );
}
