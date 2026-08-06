import { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PanelError } from '@/components/ui/PanelError';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { useSummaryQuery } from '@/graphql/generated/graphql';
import { centsToDisplay, formatSignedAmount } from '@/lib/currency';
import { currentPeriod } from '@/lib/period';

export function DashboardPage() {
  // Read once per mount, not per render. The period is part of a query key, and
  // recomputing it every render would mint a new key the moment the clock rolls
  // past midnight on the last day of a month with the tab still open.
  const [period] = useState(currentPeriod);
  const summary = useSummaryQuery(period);
  const figures = summary.data?.summary;

  return (
    <PageShell title="Dashboard" subtitle="Sua visão geral do mês">
      {summary.isPending ? (
        <Skeleton
          label="Carregando resumo"
          count={3}
          className="h-24 p-5"
          containerClassName="grid gap-4 sm:grid-cols-3"
        />
      ) : summary.isError || !figures ? (
        <PanelError
          message="Não foi possível carregar o resumo"
          onRetry={() => void summary.refetch()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* No separate empty state. A new user's balance genuinely is zero,
              and a "no data yet" card would have to be distinguished from a
              real zero, which the data cannot do. */}
          <StatCard
            icon={Wallet}
            label="Saldo total"
            value={centsToDisplay(figures.totalBalance)}
          />
          <StatCard
            icon={ArrowUpCircle}
            label="Receitas do mês"
            value={centsToDisplay(figures.monthIncome)}
            iconClassName="text-success"
          />
          <StatCard
            icon={ArrowDownCircle}
            label="Despesas do mês"
            // The API figure is unsigned, so the sign is applied here — except
            // at zero, where "-R$ 0,00" would be the only card in the row not
            // reading as the plain zero it is.
            value={
              figures.monthExpense === 0
                ? centsToDisplay(0)
                : formatSignedAmount(figures.monthExpense, 'EXPENSE')
            }
            iconClassName="text-danger"
          />
        </div>
      )}
    </PageShell>
  );
}
