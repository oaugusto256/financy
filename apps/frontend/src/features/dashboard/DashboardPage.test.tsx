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
