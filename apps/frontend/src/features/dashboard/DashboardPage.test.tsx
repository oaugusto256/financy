import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { api, aUser, graphqlError, ok } from '@/test/msw/api';
import { currentPeriod } from '@/lib/period';
import { DashboardPage } from './DashboardPage';

function mockSummary(summary: {
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
}) {
  server.use(api.query('Summary', () => ok({ summary })));
}

beforeEach(() => {
  // MSW is strict, so the shell's own query has to be mocked on every render.
  server.use(api.query('Me', () => ok({ me: aUser })));
  // The page composes two panels that fetch on mount, so every render needs a
  // handler for them too, even in the stat-card tests that ignore them.
  // `server.use` prepends, so a later, more specific handler in a single test
  // still wins over these defaults.
  server.use(
    api.query('Transactions', () =>
      ok({ transactions: { items: [], totalCount: 0 } }),
    ),
  );
  server.use(api.query('Categories', () => ok({ categories: [] })));
});

describe('DashboardPage stat cards', () => {
  it('announces that it is loading before the figures arrive', () => {
    mockSummary({ totalBalance: 0, monthIncome: 0, monthExpense: 0 });
    renderWithProviders(<DashboardPage />);

    expect(
      screen.getByRole('status', { name: 'Carregando resumo' }),
    ).toBeInTheDocument();
  });

  it('renders the three figures as Brazilian currency', async () => {
    mockSummary({
      totalBalance: 535_785,
      monthIncome: 780_000,
      monthExpense: 244_215,
    });
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('R$ 5.357,85')).toBeInTheDocument();
    expect(screen.getByText('R$ 7.800,00')).toBeInTheDocument();
    // The API figure is unsigned; the card renders the minus sign.
    expect(screen.getByText('-R$ 2.442,15')).toBeInTheDocument();
    expect(screen.getByText('Saldo total')).toBeInTheDocument();
    expect(screen.getByText('Receitas do mês')).toBeInTheDocument();
    expect(screen.getByText('Despesas do mês')).toBeInTheDocument();
  });

  it('renders a negative balance with its minus sign', async () => {
    mockSummary({
      totalBalance: -12_345,
      monthIncome: 0,
      monthExpense: 12_345,
    });
    renderWithProviders(<DashboardPage />);

    // This fixture also drives Despesas do mês to the same signed figure
    // (design correction 1 applies the sign to a non-zero expense too), so
    // both the Saldo total and Despesas do mês cards render it.
    expect(await screen.findAllByText('-R$ 123,45')).toHaveLength(2);
  });

  it('shows a real zero rather than a special empty state', async () => {
    // A new user's balance genuinely is zero, and a "no data yet" card could
    // not be told apart from a real zero balance.
    mockSummary({ totalBalance: 0, monthIncome: 0, monthExpense: 0 });
    renderWithProviders(<DashboardPage />);

    expect(await screen.findAllByText('R$ 0,00')).toHaveLength(3);
  });

  it('asks for the current month and year', async () => {
    const variables = vi.fn();
    server.use(
      api.query('Summary', ({ variables: received }) => {
        variables(received);
        return ok({
          summary: { totalBalance: 0, monthIncome: 0, monthExpense: 0 },
        });
      }),
    );
    renderWithProviders(<DashboardPage />);

    await waitFor(() =>
      expect(variables).toHaveBeenCalledWith(currentPeriod()),
    );
    const asked = variables.mock.calls[0]![0] as {
      month: number;
      year: number;
    };
    expect(asked.month).toBe(new Date().getMonth() + 1);
    expect(asked.year).toBe(new Date().getFullYear());
  });

  it('offers a retry when the summary fails, and the retry refetches', async () => {
    let calls = 0;
    server.use(
      api.query('Summary', () => {
        calls += 1;
        return calls === 1
          ? graphqlError('NOT_FOUND')
          : ok({
              summary: {
                totalBalance: 100,
                monthIncome: 100,
                monthExpense: 0,
              },
            });
      }),
    );
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o resumo',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    // The refetched fixture also drives Receitas do mês to the same figure
    // (both totalBalance and monthIncome are 100), so both the Saldo total
    // and Receitas do mês cards render it.
    expect(await screen.findAllByText('R$ 1,00')).toHaveLength(2);
  });
});

const EMPTY_SUMMARY = { totalBalance: 0, monthIncome: 0, monthExpense: 0 };

function mockAllSections() {
  server.use(api.query('Summary', () => ok({ summary: EMPTY_SUMMARY })));
  server.use(
    api.query('Transactions', () =>
      ok({ transactions: { items: [], totalCount: 0 } }),
    ),
  );
  server.use(api.query('Categories', () => ok({ categories: [] })));
}

describe('DashboardPage composition', () => {
  it('renders all three sections', async () => {
    mockAllSections();
    renderWithProviders(<DashboardPage />);

    expect(
      await screen.findByRole('region', { name: 'Transações recentes' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Categorias' }),
    ).toBeInTheDocument();
    // The panels' <section> wrappers mount synchronously, so the region above
    // resolves on the first poll while the summary is still pending. The stat
    // cards need their own await rather than a synchronous get.
    expect(await screen.findByText('Saldo total')).toBeInTheDocument();
  });

  it('keeps the other two sections alive when one fails', async () => {
    server.use(api.query('Summary', () => graphqlError('NOT_FOUND')));
    server.use(
      api.query('Transactions', () =>
        ok({ transactions: { items: [], totalCount: 0 } }),
      ),
    );
    server.use(api.query('Categories', () => ok({ categories: [] })));
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o resumo',
    );
    expect(
      screen.getByRole('region', { name: 'Transações recentes' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Categorias' }),
    ).toBeInTheDocument();
  });

  it('opens the transaction dialog from the panel footer', async () => {
    mockAllSections();
    renderWithProviders(<DashboardPage />);
    await screen.findByText('Nenhuma transação ainda');

    await userEvent.click(
      screen.getByRole('button', { name: 'Nova transação' }),
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('refetches all three sections after a transaction is created', async () => {
    // The test this slice exists to make possible. TransactionDialog has
    // invalidated ['Summary'] since slice 3 with nothing listening; if the
    // generated key were anything but ['Summary', variables], the stat cards
    // would keep showing pre-create figures and nothing would say so.
    const summaryCalls = vi.fn();
    const transactionCalls = vi.fn();
    const categoryCalls = vi.fn();

    server.use(
      api.query('Summary', () => {
        summaryCalls();
        return ok({ summary: EMPTY_SUMMARY });
      }),
      api.query('Transactions', () => {
        transactionCalls();
        return ok({ transactions: { items: [], totalCount: 0 } });
      }),
      api.query('Categories', () => {
        categoryCalls();
        return ok({ categories: [] });
      }),
      api.query('CategoryStats', () =>
        ok({
          categoryStats: {
            totalCategories: 0,
            totalTransactions: 0,
            mostUsed: null,
          },
        }),
      ),
      api.mutation('CreateTransaction', () =>
        ok({ createTransaction: { id: 'transaction-1' } }),
      ),
    );

    renderWithProviders(<DashboardPage />);
    await screen.findByText('Nenhuma transação ainda');
    await waitFor(() => expect(summaryCalls).toHaveBeenCalledTimes(1));

    await userEvent.click(
      screen.getByRole('button', { name: 'Nova transação' }),
    );
    await screen.findByRole('dialog');
    // The baseline is taken only once the dialog's own categories fetch has
    // landed. TransactionDialog calls useCategoriesQuery() unconditionally for
    // its picker, and a fresh observer on an already-fetched key refetches on
    // mount, so a baseline captured before the dialog opened would make the
    // categories assertion below rise on the picker alone — it would stay green
    // with the mutation's category invalidation deleted. Two calls: the
    // CategoriesPanel's mount, then the picker's.
    await waitFor(() => expect(categoryCalls).toHaveBeenCalledTimes(2));
    const before = {
      summary: summaryCalls.mock.calls.length,
      transactions: transactionCalls.mock.calls.length,
      categories: categoryCalls.mock.calls.length,
    };

    await userEvent.type(await screen.findByLabelText('Descrição'), 'Café');
    await userEvent.type(screen.getByLabelText('Valor'), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(summaryCalls.mock.calls.length).toBeGreaterThan(before.summary);
      expect(transactionCalls.mock.calls.length).toBeGreaterThan(
        before.transactions,
      );
      expect(categoryCalls.mock.calls.length).toBeGreaterThan(
        before.categories,
      );
    });
  });
});
