import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { api, graphqlError, ok } from '@/test/msw/api';
import { TransactionDialog } from '@/features/transactions/TransactionDialog';

const CATEGORIES = [
  {
    id: 'category-1',
    name: 'Mercado',
    description: null,
    icon: 'SHOPPING_CART',
    color: 'GREEN',
    transactionCount: 3,
  },
];

function mockCategories() {
  server.use(api.query('Categories', () => ok({ categories: CATEGORIES })));
}

beforeEach(mockCategories);

describe('TransactionDialog, creating', () => {
  it('sends the typed amount as integer cents', async () => {
    const variables = vi.fn();
    server.use(
      api.mutation('CreateTransaction', ({ variables: received }) => {
        variables(received);
        return ok({ createTransaction: { id: 'transaction-1' } });
      }),
    );

    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    await userEvent.type(
      await screen.findByLabelText('Descrição'),
      'Compras da semana',
    );
    // Cents-first: four keystrokes are R$ 12,34.
    await userEvent.type(screen.getByLabelText('Valor'), '1234');
    await userEvent.clear(screen.getByLabelText('Data'));
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-04');
    await userEvent.selectOptions(
      screen.getByLabelText('Categoria'),
      'category-1',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(variables).toHaveBeenCalled());
    expect(variables.mock.calls[0]?.[0]).toEqual({
      input: {
        description: 'Compras da semana',
        amount: 1_234,
        type: 'EXPENSE',
        date: '2026-08-04T03:00:00.000Z',
        categoryId: 'category-1',
      },
    });
  });

  it('shows the masked value as the user types', async () => {
    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    const amount = await screen.findByLabelText('Valor');
    expect(amount).toHaveValue('R$ 0,00');

    await userEvent.type(amount, '1');
    expect(amount).toHaveValue('R$ 0,01');

    await userEvent.type(amount, '2');
    expect(amount).toHaveValue('R$ 0,12');

    await userEvent.type(amount, '34');
    expect(amount).toHaveValue('R$ 12,34');
  });

  it('sends a null category when none is chosen', async () => {
    const variables = vi.fn();
    server.use(
      api.mutation('CreateTransaction', ({ variables: received }) => {
        variables(received);
        return ok({ createTransaction: { id: 'transaction-1' } });
      }),
    );

    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText('Descrição'), 'Troco');
    await userEvent.type(screen.getByLabelText('Valor'), '500');
    await userEvent.click(screen.getByRole('radio', { name: 'Receita' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(variables).toHaveBeenCalled());
    const input = (
      variables.mock.calls[0]?.[0] as { input: Record<string, unknown> }
    ).input;
    expect(input.categoryId).toBeNull();
    expect(input.type).toBe('INCOME');
  });

  it('refuses an empty description without calling the API', async () => {
    const called = vi.fn();
    server.use(
      api.mutation('CreateTransaction', () => {
        called();
        return ok({ createTransaction: { id: 'x' } });
      }),
    );

    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText('Valor'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Informe uma descrição'),
    ).toBeInTheDocument();
    expect(called).not.toHaveBeenCalled();
  });

  it('refuses a zero amount', async () => {
    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText('Descrição'), 'Nada');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Informe um valor maior que zero'),
    ).toBeInTheDocument();
  });

  it('refetches every list the new row changed', async () => {
    server.use(
      api.mutation('CreateTransaction', () =>
        ok({ createTransaction: { id: 'transaction-1' } }),
      ),
    );

    const onClose = vi.fn();
    const { queryClient } = renderWithProviders(
      <TransactionDialog open onClose={onClose} />,
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await userEvent.type(await screen.findByLabelText('Descrição'), 'Mercado');
    await userEvent.type(screen.getByLabelText('Valor'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const keys = invalidate.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown[] }).queryKey[0],
    );
    // Both category lists carry counts and totals this row changed, and the
    // dashboard's summary does too. frontend.md section 6.
    expect(keys).toEqual(
      expect.arrayContaining([
        'Transactions',
        'Categories',
        'CategoryStats',
        'Summary',
      ]),
    );
  });

  it('surfaces a server field error on its own field', async () => {
    server.use(
      api.mutation('CreateTransaction', () =>
        graphqlError('BAD_USER_INPUT', 'Erro', {
          description: ['A descrição é obrigatória'],
        }),
      ),
    );

    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText('Descrição'), 'Mercado');
    await userEvent.type(screen.getByLabelText('Valor'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('A descrição é obrigatória'),
    ).toBeInTheDocument();
  });

  it('surfaces a server field error on the amount field', async () => {
    server.use(
      api.mutation('CreateTransaction', () =>
        graphqlError('BAD_USER_INPUT', 'Erro', {
          amount: ['O valor deve ser maior que zero'],
        }),
      ),
    );

    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText('Descrição'), 'Mercado');
    await userEvent.type(screen.getByLabelText('Valor'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('O valor deve ser maior que zero'),
    ).toBeInTheDocument();
  });

  it('shows a form-level error when the save fails for another reason', async () => {
    server.use(
      api.mutation('CreateTransaction', () => graphqlError('NOT_FOUND')),
    );

    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText('Descrição'), 'Mercado');
    await userEvent.type(screen.getByLabelText('Valor'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar. Tente novamente.',
    );
  });
});

describe('TransactionDialog, editing', () => {
  const target = {
    id: 'transaction-1',
    description: 'Aluguel',
    amount: 210_000,
    type: 'EXPENSE' as const,
    date: '2026-08-05T03:00:00.000Z',
    categoryId: 'category-1',
  };

  it('opens holding the current values', async () => {
    renderWithProviders(
      <TransactionDialog open onClose={vi.fn()} transaction={target} />,
    );

    expect(await screen.findByLabelText('Descrição')).toHaveValue('Aluguel');
    expect(screen.getByLabelText('Valor')).toHaveValue('R$ 2.100,00');
    expect(screen.getByLabelText('Data')).toHaveValue('2026-08-05');
    expect(screen.getByLabelText('Categoria')).toHaveValue('category-1');
    expect(screen.getByRole('radio', { name: 'Despesa' })).toBeChecked();
    expect(
      screen.getByRole('heading', { name: 'Editar transação' }),
    ).toBeInTheDocument();
  });

  it('sends only an update', async () => {
    const variables = vi.fn();
    server.use(
      api.mutation('UpdateTransaction', ({ variables: received }) => {
        variables(received);
        return ok({ updateTransaction: { id: target.id } });
      }),
    );

    renderWithProviders(
      <TransactionDialog open onClose={vi.fn()} transaction={target} />,
    );

    const description = await screen.findByLabelText('Descrição');
    await userEvent.clear(description);
    await userEvent.type(description, 'Aluguel de agosto');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(variables).toHaveBeenCalled());
    expect(variables.mock.calls[0]?.[0]).toMatchObject({
      id: 'transaction-1',
      input: { description: 'Aluguel de agosto', amount: 210_000 },
    });
  });
});
