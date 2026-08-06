import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { api, aUser, graphqlError, ok } from '@/test/msw/api';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';

function aTransaction(index: number) {
  return {
    id: `transaction-${index}`,
    description: `Transação ${index}`,
    amount: 1_000 * index,
    type: 'EXPENSE',
    date: `2026-08-${String(index).padStart(2, '0')}T03:00:00.000Z`,
    category: null,
  };
}

function mockPage(items: unknown[], totalCount: number) {
  server.use(
    api.query('Transactions', () =>
      ok({ transactions: { items, totalCount } }),
    ),
  );
}

beforeEach(() => {
  // MSW is strict, so the shell's own query has to be mocked on every render.
  server.use(api.query('Me', () => ok({ me: aUser })));
  server.use(api.query('Categories', () => ok({ categories: [] })));
});

describe('TransactionsPage', () => {
  it('announces that it is loading before the rows arrive', () => {
    mockPage([], 0);
    renderWithProviders(<TransactionsPage />);

    expect(
      screen.getByRole('status', { name: 'Carregando transações' }),
    ).toBeInTheDocument();
  });

  it('renders the rows it was given', async () => {
    mockPage([aTransaction(1), aTransaction(2)], 2);
    renderWithProviders(<TransactionsPage />);

    expect(await screen.findByText('Transação 1')).toBeInTheDocument();
    expect(screen.getByText('Transação 2')).toBeInTheDocument();
  });

  it('offers the create action when there is nothing yet', async () => {
    mockPage([], 0);
    renderWithProviders(<TransactionsPage />);

    expect(
      await screen.findByText('Nenhuma transação ainda'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Criar primeira transação' }),
    ).toBeInTheDocument();
  });

  it('offers a retry when the query fails', async () => {
    server.use(api.query('Transactions', () => graphqlError('NOT_FOUND')));
    renderWithProviders(<TransactionsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as transações',
    );
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument();
  });

  it('reports the range and the total, as the design does', async () => {
    mockPage(
      Array.from({ length: 10 }, (_, index) => aTransaction(index + 1)),
      27,
    );
    renderWithProviders(<TransactionsPage />);

    expect(
      await screen.findByText('1 a 10 | 27 resultados'),
    ).toBeInTheDocument();
  });

  it('reports a partial last page correctly', async () => {
    mockPage(
      Array.from({ length: 7 }, (_, index) => aTransaction(index + 1)),
      27,
    );
    renderWithProviders(<TransactionsPage />, {
      route: '/transactions?page=3',
    });

    expect(
      await screen.findByText('21 a 27 | 27 resultados'),
    ).toBeInTheDocument();
  });

  it('asks for the right window when a page is chosen', async () => {
    const variables = vi.fn();
    server.use(
      api.query('Transactions', ({ variables: received }) => {
        variables(received);
        return ok({
          transactions: {
            items: [aTransaction(1)],
            totalCount: 27,
          },
        });
      }),
    );

    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    await userEvent.click(screen.getByRole('button', { name: '3' }));

    await waitFor(() =>
      expect(variables).toHaveBeenLastCalledWith({ limit: 10, offset: 20 }),
    );
  });

  it('keeps the page in the URL so the view can be reloaded and shared', async () => {
    mockPage([aTransaction(1)], 27);
    renderWithProviders(<TransactionsPage />, {
      route: '/transactions?page=2',
    });

    await screen.findByText('Transação 1');

    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('escapes an out-of-range page instead of showing a false empty state', async () => {
    // Reachable in practice: deleting the last row(s) on the last page
    // shrinks totalCount below the URL's offset, and the refetch that
    // follows returns an empty `items` array for a totalCount that is still
    // positive. A hand-typed `?page=99` reaches the same state on first
    // load. The offset check below mirrors what the real resolver does —
    // an out-of-range offset returns no rows even though totalCount isn't 0.
    const totalCount = 25;
    server.use(
      api.query('Transactions', ({ variables }) => {
        const { offset } = variables as { offset: number; limit: number };
        const items = offset >= totalCount ? [] : [aTransaction(offset + 1)];
        return ok({ transactions: { items, totalCount } });
      }),
    );

    renderWithProviders(<TransactionsPage />, {
      route: '/transactions?page=99',
    });

    // pageCount is 3 (ceil(25 / 10)); the page should settle there, holding
    // the last page's row, rather than dead-ending on page 99.
    expect(await screen.findByText('Transação 21')).toBeInTheDocument();
    expect(
      screen.queryByText('Nenhuma transação ainda'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('still shows the genuine empty state when totalCount is 0', async () => {
    mockPage([], 0);
    renderWithProviders(<TransactionsPage />);

    expect(
      await screen.findByText('Nenhuma transação ainda'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Criar primeira transação' }),
    ).toBeInTheDocument();
  });

  it('opens an empty dialog for a new transaction', async () => {
    mockPage([aTransaction(1)], 1);
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    await userEvent.click(
      screen.getByRole('button', { name: '+ Nova transação' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Nova transação' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toHaveValue('');
  });

  it('opens the dialog holding the row it was asked to edit', async () => {
    mockPage([aTransaction(1)], 1);
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar Transação 1' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Editar transação' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toHaveValue('Transação 1');
  });

  it('opens a fresh form after an edit was cancelled', async () => {
    // Slice 2's review found the category dialog reopening with the previous
    // values, because it stayed mounted. This is that regression, for the
    // dialog with the same shape.
    mockPage([aTransaction(1)], 1);
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar Transação 1' }),
    );
    await screen.findByRole('heading', { name: 'Editar transação' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await userEvent.click(
      screen.getByRole('button', { name: '+ Nova transação' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Nova transação' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toHaveValue('');
  });

  it('opens a second edit holding the newly chosen row, not the first', async () => {
    // Task 12's review flagged that TransactionDialog captures its
    // defaultValues once at mount, with no reset-on-open effect — correctness
    // depends entirely on this page remounting it fresh per target. Two edits
    // in a row, back to back, is the case that would leak the first row's
    // values into the second if the dialog stayed mounted across targets.
    mockPage([aTransaction(1), aTransaction(2)], 2);
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar Transação 1' }),
    );
    await screen.findByRole('heading', { name: 'Editar transação' });
    expect(screen.getByLabelText('Descrição')).toHaveValue('Transação 1');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar Transação 2' }),
    );

    await screen.findByRole('heading', { name: 'Editar transação' });
    expect(screen.getByLabelText('Descrição')).toHaveValue('Transação 2');
  });

  it('confirms before deleting', async () => {
    mockPage([aTransaction(1)], 1);
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir Transação 1' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Excluir transação' }),
    ).toBeInTheDocument();
  });
});
