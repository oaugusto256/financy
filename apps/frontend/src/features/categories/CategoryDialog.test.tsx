import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryDialog } from '@/features/categories/CategoryDialog';
import { api, graphqlError, ok } from '@/test/msw/api';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';

const existing = {
  id: 'category-1',
  name: 'Mercado',
  description: 'Compras da semana',
  icon: 'SHOPPING_CART' as const,
  color: 'GREEN' as const,
};

beforeEach(() => {
  server.use(
    api.mutation('CreateCategory', () =>
      ok({ createCategory: { id: 'category-2' } }),
    ),
    api.mutation('UpdateCategory', () =>
      ok({ updateCategory: { id: existing.id } }),
    ),
  );
});

async function submit() {
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
}

describe('CategoryDialog', () => {
  it('opens empty for a new category', () => {
    renderWithProviders(<CategoryDialog open onClose={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: 'Nova categoria' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('');
    // Both pickers open with a default selection. frontend.md section 5.
    expect(screen.getByRole('radio', { name: 'Carteira' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Verde' })).toBeChecked();
  });

  it('opens prefilled for an existing category', () => {
    renderWithProviders(
      <CategoryDialog open onClose={vi.fn()} category={existing} />,
    );

    expect(
      screen.getByRole('heading', { name: 'Editar categoria' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Mercado');
    expect(screen.getByLabelText('Descrição (opcional)')).toHaveValue(
      'Compras da semana',
    );
    expect(
      screen.getByRole('radio', { name: 'Carrinho de compras' }),
    ).toBeChecked();
  });

  it('creates a category and closes', async () => {
    const onClose = vi.fn();
    renderWithProviders(<CategoryDialog open onClose={onClose} />);

    await userEvent.type(screen.getByLabelText('Nome'), 'Transporte');
    await userEvent.click(screen.getByRole('radio', { name: 'Ônibus' }));
    await submit();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await screen.findByText('Categoria criada')).toBeInTheDocument();
  });

  it('sends the id when editing', async () => {
    const variables = vi.fn();
    server.use(
      api.mutation('UpdateCategory', ({ variables: received }) => {
        variables(received);
        return ok({ updateCategory: { id: existing.id } });
      }),
    );

    renderWithProviders(
      <CategoryDialog open onClose={vi.fn()} category={existing} />,
    );
    await userEvent.clear(screen.getByLabelText('Nome'));
    await userEvent.type(screen.getByLabelText('Nome'), 'Alimentação');
    await submit();

    await waitFor(() =>
      expect(variables).toHaveBeenCalledWith(
        expect.objectContaining({
          id: existing.id,
          input: expect.objectContaining({ name: 'Alimentação' }),
        }),
      ),
    );
  });

  it('sends a cleared description as null rather than an empty string', async () => {
    const variables = vi.fn();
    server.use(
      api.mutation('UpdateCategory', ({ variables: received }) => {
        variables(received);
        return ok({ updateCategory: { id: existing.id } });
      }),
    );

    renderWithProviders(
      <CategoryDialog open onClose={vi.fn()} category={existing} />,
    );
    await userEvent.clear(screen.getByLabelText('Descrição (opcional)'));
    await submit();

    await waitFor(() =>
      expect(variables).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ description: null }),
        }),
      ),
    );
  });

  it('rejects an empty name without sending anything', async () => {
    // No handler is needed: MSW is strict, so a request here fails the test,
    // which is the assertion.
    server.resetHandlers();
    renderWithProviders(<CategoryDialog open onClose={vi.fn()} />);

    await submit();

    expect(await screen.findByText('Informe um nome')).toBeInTheDocument();
  });

  it('rejects a name longer than 50 characters', async () => {
    server.resetHandlers();
    renderWithProviders(<CategoryDialog open onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nome'), 'a'.repeat(51));
    await submit();

    expect(
      await screen.findByText('O nome deve ter no máximo 50 caracteres'),
    ).toBeInTheDocument();
  });

  it('renders a duplicate name from the server on the name field', async () => {
    server.use(
      api.mutation('CreateCategory', () =>
        graphqlError(
          'BAD_USER_INPUT',
          'Já existe uma categoria com esse nome',
          {
            name: ['Já existe uma categoria com esse nome'],
          },
        ),
      ),
    );

    const onClose = vi.fn();
    renderWithProviders(<CategoryDialog open onClose={onClose} />);
    await userEvent.type(screen.getByLabelText('Nome'), 'Mercado');
    await submit();

    await waitFor(() =>
      expect(screen.getByLabelText('Nome')).toHaveAccessibleDescription(
        'Já existe uma categoria com esse nome',
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables the submit button while the request is in flight', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      api.mutation('CreateCategory', async () => {
        await held;
        return ok({ createCategory: { id: 'category-2' } });
      }),
    );

    renderWithProviders(<CategoryDialog open onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Nome'), 'Transporte');
    await submit();

    expect(
      await screen.findByRole('button', { name: 'Salvar' }),
    ).toBeDisabled();
    release();
  });
});
