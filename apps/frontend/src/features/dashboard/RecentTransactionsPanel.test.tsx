import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { api, graphqlError, ok } from '@/test/msw/api';
import { RecentTransactionsPanel } from './RecentTransactionsPanel';

function aTransaction(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `transaction-${index}`,
    description: `Transação ${index}`,
    amount: 1_000 * index,
    type: 'EXPENSE',
    date: `2026-08-${String(index).padStart(2, '0')}T03:00:00.000Z`,
    category: {
      id: 'category-1',
      name: 'Mercado',
      icon: 'SHOPPING_CART',
      color: 'GREEN',
    },
    ...overrides,
  };
}

function mockRecent(items: unknown[]) {
  server.use(
    api.query('Transactions', () =>
      ok({ transactions: { items, totalCount: items.length } }),
    ),
  );
}

const noop = () => {};

describe('RecentTransactionsPanel', () => {
  it('announces that it is loading before the rows arrive', () => {
    mockRecent([]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(
      screen.getByRole('status', { name: 'Carregando transações recentes' }),
    ).toBeInTheDocument();
  });

  it('renders the rows it was given, in a named section', async () => {
    mockRecent([aTransaction(1), aTransaction(2)]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(await screen.findByText('Transação 1')).toBeInTheDocument();
    expect(screen.getByText('Transação 2')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Transações recentes' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('asks for exactly five rows', async () => {
    const variables = vi.fn();
    server.use(
      api.query('Transactions', ({ variables: received }) => {
        variables(received);
        return ok({
          transactions: { items: [aTransaction(1)], totalCount: 1 },
        });
      }),
    );
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);
    await screen.findByText('Transação 1');

    expect(variables).toHaveBeenCalledWith({ limit: 5, offset: 0 });
  });

  it('renders the date, the signed amount and the category tag', async () => {
    mockRecent([aTransaction(4, { amount: 244_215, type: 'EXPENSE' })]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(await screen.findByText('-R$ 2.442,15')).toBeInTheDocument();
    expect(screen.getByText('04/08/26')).toBeInTheDocument();
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(screen.getByText('Saída')).toBeInTheDocument();
  });

  it('renders an income row with a plus sign', async () => {
    mockRecent([aTransaction(1, { amount: 780_000, type: 'INCOME' })]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(await screen.findByText('+R$ 7.800,00')).toBeInTheDocument();
    expect(screen.getByText('Entrada')).toBeInTheDocument();
  });

  it('renders an uncategorized row with the neutral tag', async () => {
    mockRecent([aTransaction(1, { category: null })]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(await screen.findByText('Sem categoria')).toBeInTheDocument();
  });

  it('says so when there is nothing yet, and still offers the create action', async () => {
    mockRecent([]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(
      await screen.findByText('Nenhuma transação ainda'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '+ Nova transação' }),
    ).toBeInTheDocument();
  });

  it('offers a retry when the query fails, and the retry refetches', async () => {
    let calls = 0;
    server.use(
      api.query('Transactions', () => {
        calls += 1;
        return calls === 1
          ? graphqlError('NOT_FOUND')
          : ok({
              transactions: { items: [aTransaction(1)], totalCount: 1 },
            });
      }),
    );
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as transações',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await screen.findByText('Transação 1')).toBeInTheDocument();
  });

  it('calls onCreate from the footer button', async () => {
    const onCreate = vi.fn();
    mockRecent([]);
    renderWithProviders(<RecentTransactionsPanel onCreate={onCreate} />);
    await screen.findByText('Nenhuma transação ainda');

    await userEvent.click(
      screen.getByRole('button', { name: '+ Nova transação' }),
    );

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('links to the full ledger', async () => {
    mockRecent([]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);
    await screen.findByText('Nenhuma transação ainda');

    expect(screen.getByRole('link', { name: 'Ver todas' })).toHaveAttribute(
      'href',
      '/transactions',
    );
  });
});
