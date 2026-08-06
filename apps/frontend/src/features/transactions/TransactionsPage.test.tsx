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

describe('TransactionsPage filters', () => {
  it('renders the bar above the loading state', async () => {
    mockPage([], 0);
    renderWithProviders(<TransactionsPage />);

    // Above the state switch, not inside the populated branch: a user who has
    // filtered into nothing needs the controls that got them there.
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Carregando transações' }),
    ).toBeInTheDocument();
    await screen.findByText('Nenhuma transação ainda');
  });

  it('renders the bar above the error state', async () => {
    server.use(api.query('Transactions', () => graphqlError('NOT_FOUND')));
    renderWithProviders(<TransactionsPage />);

    await screen.findByRole('alert');
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
  });

  it('sends the filter the URL asks for', async () => {
    const variables = vi.fn();
    server.use(
      api.query('Transactions', ({ variables: received }) => {
        variables(received);
        return ok({
          transactions: { items: [aTransaction(1)], totalCount: 1 },
        });
      }),
    );

    renderWithProviders(<TransactionsPage />, {
      route: '/transactions?q=mercado&type=EXPENSE&period=2026-08',
    });
    await screen.findByText('Transação 1');

    expect(variables).toHaveBeenLastCalledWith({
      limit: 10,
      offset: 0,
      filter: {
        search: 'mercado',
        type: 'EXPENSE',
        dateFrom: '2026-08-01T03:00:00.000Z',
        dateTo: '2026-09-01T02:59:59.999Z',
      },
    });
  });

  it('sends no filter when nothing is filtered', async () => {
    // The unfiltered page must keep making exactly the request it made before
    // this slice, or every cached entry is a miss and the default view of
    // /transactions quietly stops being the whole ledger.
    const variables = vi.fn();
    server.use(
      api.query('Transactions', ({ variables: received }) => {
        variables(received);
        return ok({
          transactions: { items: [aTransaction(1)], totalCount: 1 },
        });
      }),
    );

    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    expect(variables).toHaveBeenLastCalledWith({ limit: 10, offset: 0 });
  });

  it('refetches when the type select changes', async () => {
    const variables = vi.fn();
    server.use(
      api.query('Transactions', ({ variables: received }) => {
        variables(received);
        return ok({
          transactions: { items: [aTransaction(1)], totalCount: 1 },
        });
      }),
    );

    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'INCOME');

    await waitFor(() =>
      expect(variables).toHaveBeenLastCalledWith({
        limit: 10,
        offset: 0,
        filter: { type: 'INCOME' },
      }),
    );
  });

  it('goes back to page 1 when a filter changes, without bouncing off the clamp', async () => {
    // slice-3-outcome.md flagged this as the one place slice 4 could race the
    // out-of-range clamp effect: both want to rewrite `page`. It cannot,
    // because changing the filter changes the query key, so `result` is
    // undefined on that render and the clamp's `!!result` guard holds. The
    // offset in the request is the assertion.
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

    renderWithProviders(<TransactionsPage />, {
      route: '/transactions?page=3',
    });
    await screen.findByText('Transação 1');
    expect(variables).toHaveBeenLastCalledWith({ limit: 10, offset: 20 });

    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'INCOME');

    await waitFor(() =>
      expect(variables).toHaveBeenLastCalledWith({
        limit: 10,
        offset: 0,
        filter: { type: 'INCOME' },
      }),
    );
    // And it stays there — a clamp firing after the data lands would push the
    // offset back to 20.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '1' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
  });

  it('says nothing matched, not that there is nothing, when a filter empties the table', async () => {
    // frontend.md section 10: "A user who filters into nothing should not be
    // told they have no transactions."
    mockPage([], 0);
    renderWithProviders(<TransactionsPage />, {
      route: '/transactions?q=nada-disso',
    });

    expect(
      await screen.findByText('Nenhuma transação encontrada'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Nenhuma transação ainda'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Limpar filtros' }),
    ).toBeInTheDocument();
  });

  it('clears every filter from the filtered-empty state', async () => {
    server.use(
      api.query('Transactions', ({ variables }) => {
        const { filter } = variables as { filter?: unknown };
        return ok({
          transactions: filter
            ? { items: [], totalCount: 0 }
            : { items: [aTransaction(1)], totalCount: 1 },
        });
      }),
    );

    renderWithProviders(<TransactionsPage />, {
      route: '/transactions?q=nada-disso&type=EXPENSE',
    });
    await screen.findByText('Nenhuma transação encontrada');

    await userEvent.click(
      screen.getByRole('button', { name: 'Limpar filtros' }),
    );

    expect(await screen.findByText('Transação 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar')).toHaveValue('');
    expect(screen.getByLabelText('Tipo')).toHaveValue('');
  });

  it('still shows the genuine empty state when nothing is filtered', async () => {
    mockPage([], 0);
    renderWithProviders(<TransactionsPage />);

    expect(
      await screen.findByText('Nenhuma transação ainda'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Criar primeira transação' }),
    ).toBeInTheDocument();
  });

  it('refetches a filtered list after a delete', async () => {
    // The carry-over from slice-3-outcome.md: both dialogs invalidate the bare
    // ['Transactions'], and the key now carries a filter object. If prefix
    // matching failed, a deleted row would stay on screen — on a filtered
    // page only, which is the case nothing covered.
    let deleted = false;
    server.use(
      api.query('Transactions', () =>
        ok({
          transactions: deleted
            ? { items: [], totalCount: 0 }
            : { items: [aTransaction(1)], totalCount: 1 },
        }),
      ),
      api.mutation('DeleteTransaction', () => {
        deleted = true;
        return ok({ deleteTransaction: true });
      }),
    );

    renderWithProviders(<TransactionsPage />, {
      route: '/transactions?type=EXPENSE',
    });
    await screen.findByText('Transação 1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir Transação 1' }),
    );
    await screen.findByRole('heading', { name: 'Excluir transação' });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(screen.queryByText('Transação 1')).not.toBeInTheDocument(),
    );
  });

  it('caps a search over the length the API accepts, instead of erroring', async () => {
    // Simulates the backend's own BAD_USER_INPUT for a `search` over 100
    // characters (validation.ts) — the failure mode a hook-level clamp is
    // meant to make unreachable from a hand-typed or shared URL.
    const longSearch = 'a'.repeat(101);
    server.use(
      api.query('Transactions', ({ variables }) => {
        const { filter } = variables as { filter?: { search?: string } };
        if (filter?.search && filter.search.length > 100) {
          return graphqlError('BAD_USER_INPUT');
        }
        return ok({
          transactions: { items: [aTransaction(1)], totalCount: 1 },
        });
      }),
    );

    renderWithProviders(<TransactionsPage />, {
      route: `/transactions?q=${longSearch}`,
    });

    expect(await screen.findByText('Transação 1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers the categories it loaded in the category select', async () => {
    server.use(
      api.query('Categories', () =>
        ok({
          categories: [
            {
              id: 'cat-1',
              name: 'Mercado',
              description: null,
              icon: 'SHOPPING_CART',
              color: 'GREEN',
              transactionCount: 0,
            },
          ],
        }),
      ),
    );
    mockPage([aTransaction(1)], 1);
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    expect(
      await screen.findByRole('option', { name: 'Mercado' }),
    ).toBeInTheDocument();
  });
});
