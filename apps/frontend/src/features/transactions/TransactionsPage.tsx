import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
import { PanelError } from '@/components/ui/PanelError';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageShell } from '@/components/layout/PageShell';
import { useTransactionsQuery } from '@/graphql/generated/graphql';
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

/** Ten rows per page, matching the design. */
export const PAGE_SIZE = 10;

export function TransactionsPage() {
  // In the URL rather than in state: a page can be reloaded, bookmarked and
  // shared, the back button behaves, and slice 4's "changing a filter resets to
  // page 1" has something that already exists to reset.
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = Number(searchParams.get('page'));
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;

  const [dialogTarget, setDialogTarget] =
    useState<TransactionFormTarget | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<DeleteTransactionTarget | null>(null);

  const transactions = useTransactionsQuery({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
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
        // Gated on totalCount, not on this page's items: an out-of-range page
        // also comes back with an empty items array, and that is a page
        // problem, not a "this user has nothing" problem.
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-medium text-gray-800">Nenhuma transação ainda</p>
          <p className="text-sm text-gray-500">
            Registre sua primeira despesa ou receita.
          </p>
          <Button onClick={openCreate}>Criar primeira transação</Button>
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
