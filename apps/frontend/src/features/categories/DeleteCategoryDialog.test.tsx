import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeleteCategoryDialog } from '@/features/categories/DeleteCategoryDialog';
import { api, graphqlError, ok } from '@/test/msw/api';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';

const category = { id: 'category-1', name: 'Mercado' };

describe('DeleteCategoryDialog', () => {
  it('names the category and says the transactions are kept', () => {
    renderWithProviders(
      <DeleteCategoryDialog category={category} onClose={vi.fn()} />,
    );

    expect(
      screen.getByRole('heading', { name: 'Excluir categoria' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Mercado/)).toBeInTheDocument();
    // Adapted from the brief's literal regex: the rendered sentence is
    // "...mantidas, sem categoria" — a comma, not a space, follows "mantidas"
    // — so a pattern requiring a literal space there never matches. Widening
    // the gaps to plain `.*` still pins the assertion on the consequence
    // sentence (transactions are kept, without a category).
    expect(
      screen.getByText(/transações.*mantidas.*sem categoria/i),
    ).toBeInTheDocument();
  });

  it('deletes only after the confirmation is used', async () => {
    const onClose = vi.fn();
    server.use(
      api.mutation('DeleteCategory', () => ok({ deleteCategory: true })),
    );

    renderWithProviders(
      <DeleteCategoryDialog category={category} onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await screen.findByText('Categoria excluída')).toBeInTheDocument();
  });

  it('sends nothing when the user cancels', async () => {
    // MSW is strict: any request from this path fails the test.
    const onClose = vi.fn();
    renderWithProviders(
      <DeleteCategoryDialog category={category} onClose={onClose} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('reports a failure as an error toast and stays open', async () => {
    const onClose = vi.fn();
    server.use(
      api.mutation('DeleteCategory', () =>
        graphqlError('NOT_FOUND', 'Categoria não encontrado'),
      ),
    );

    renderWithProviders(
      <DeleteCategoryDialog category={category} onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(
      await screen.findByText('Não foi possível excluir. Tente novamente.'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing when no category is given', () => {
    renderWithProviders(
      <DeleteCategoryDialog category={null} onClose={vi.fn()} />,
    );

    expect(
      screen.queryByRole('heading', { name: 'Excluir categoria' }),
    ).not.toBeInTheDocument();
  });
});
