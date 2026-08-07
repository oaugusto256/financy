import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { api, graphqlError, ok } from '@/test/msw/api';
import { DeleteTransactionDialog } from '@/features/transactions/DeleteTransactionDialog';

const target = { id: 'transaction-1', description: 'Aluguel' };

describe('DeleteTransactionDialog', () => {
  it('renders nothing until there is a target', () => {
    renderWithProviders(
      <DeleteTransactionDialog transaction={null} onClose={vi.fn()} />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names the transaction it is about to delete', () => {
    renderWithProviders(
      <DeleteTransactionDialog transaction={target} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('dialog')).toHaveTextContent('Aluguel');
  });

  it('deletes and refetches every affected list', async () => {
    const variables = vi.fn();
    server.use(
      api.mutation('DeleteTransaction', ({ variables: received }) => {
        variables(received);
        return ok({ deleteTransaction: true });
      }),
    );

    const onClose = vi.fn();
    const { queryClient } = renderWithProviders(
      <DeleteTransactionDialog transaction={target} onClose={onClose} />,
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(variables).toHaveBeenCalledWith({ id: 'transaction-1' });

    const keys = invalidate.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown[] }).queryKey[0],
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        'Transactions',
        'Categories',
        'CategoryStats',
        'Summary',
      ]),
    );
  });

  it('leaves the dialog open and says so when the delete fails', async () => {
    server.use(
      api.mutation('DeleteTransaction', () => graphqlError('NOT_FOUND')),
    );

    const onClose = vi.fn();
    renderWithProviders(
      <DeleteTransactionDialog transaction={target} onClose={onClose} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(
      await screen.findByText('Não foi possível excluir. Tente novamente.'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes without deleting when cancelled', async () => {
    const called = vi.fn();
    server.use(
      api.mutation('DeleteTransaction', () => {
        called();
        return ok({ deleteTransaction: true });
      }),
    );

    const onClose = vi.fn();
    renderWithProviders(
      <DeleteTransactionDialog transaction={target} onClose={onClose} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(called).not.toHaveBeenCalled();
  });
});
