import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, aUser, graphqlError, ok } from '@/test/msw/api';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { writeToken } from '@/lib/token-storage';
import { AppRoutes } from '@/routes';

const mercado = {
  id: 'category-1',
  name: 'Mercado',
  description: 'Compras da semana',
  icon: 'SHOPPING_CART',
  color: 'GREEN',
  transactionCount: 3,
};

const transporte = {
  id: 'category-2',
  name: 'Transporte',
  description: null,
  icon: 'BUS',
  color: 'BLUE',
  transactionCount: 1,
};

const stats = {
  totalCategories: 2,
  totalTransactions: 5,
  mostUsed: {
    id: mercado.id,
    name: 'Mercado',
    icon: 'SHOPPING_CART',
    color: 'GREEN',
  },
};

beforeEach(() => {
  writeToken('token', true);
  server.use(api.query('Me', () => ok({ me: aUser })));
});

function renderCategories() {
  return renderWithProviders(<AppRoutes />, { route: '/categories' });
}

function populated() {
  server.use(
    api.query('Categories', () => ok({ categories: [mercado, transporte] })),
    api.query('CategoryStats', () => ok({ categoryStats: stats })),
  );
}

describe('CategoriesPage', () => {
  it('renders the stat cards', async () => {
    populated();
    renderCategories();

    expect(await screen.findByText('Total de categorias')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Total de transações')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Categoria mais utilizada')).toBeInTheDocument();
  });

  it('renders a card per category', async () => {
    populated();
    renderCategories();

    const card = await screen.findByRole('article', { name: 'Mercado' });
    expect(within(card).getByText('Compras da semana')).toBeInTheDocument();
    expect(within(card).getByText('3 itens')).toBeInTheDocument();
    expect(
      screen.getByRole('article', { name: 'Transporte' }),
    ).toBeInTheDocument();
  });

  it('renders a skeleton while the list loads', () => {
    populated();
    renderCategories();

    expect(screen.getByLabelText('Carregando categorias')).toBeInTheDocument();
  });

  it('offers to create one when there are none', async () => {
    server.use(
      api.query('Categories', () => ok({ categories: [] })),
      api.query('CategoryStats', () =>
        ok({
          categoryStats: {
            totalCategories: 0,
            totalTransactions: 0,
            mostUsed: null,
          },
        }),
      ),
    );
    renderCategories();

    expect(
      await screen.findByText('Nenhuma categoria ainda'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Criar primeira categoria' }),
    ).toBeInTheDocument();
  });

  it('offers a retry when the list fails', async () => {
    server.use(
      api.query('Categories', () => graphqlError('INTERNAL_SERVER_ERROR')),
      api.query('CategoryStats', () => ok({ categoryStats: stats })),
    );
    renderCategories();

    expect(
      await screen.findByText('Não foi possível carregar as categorias'),
    ).toBeInTheDocument();

    server.use(
      api.query('Categories', () => ok({ categories: [mercado, transporte] })),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(
      await screen.findByRole('article', { name: 'Mercado' }),
    ).toBeInTheDocument();
  });

  it('keeps the grid usable when only the stats fail', async () => {
    server.use(
      api.query('Categories', () => ok({ categories: [mercado] })),
      api.query('CategoryStats', () => graphqlError('INTERNAL_SERVER_ERROR')),
    );
    renderCategories();

    // Scoped to the panel that failed. frontend.md section 10.
    expect(
      await screen.findByText('Não foi possível carregar os números'),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('article', { name: 'Mercado' }),
    ).toBeInTheDocument();
  });

  it('creates a category and refetches both lists', async () => {
    populated();
    server.use(
      api.mutation('CreateCategory', () =>
        ok({ createCategory: { id: 'category-3' } }),
      ),
    );
    renderCategories();
    await screen.findByRole('article', { name: 'Mercado' });

    await userEvent.click(
      screen.getByRole('button', { name: '+ Nova categoria' }),
    );
    await userEvent.type(screen.getByLabelText('Nome'), 'Lazer');

    const lazer = {
      ...transporte,
      id: 'category-3',
      name: 'Lazer',
      icon: 'TICKET',
      color: 'PURPLE',
    };
    server.use(
      api.query('Categories', () =>
        ok({ categories: [lazer, mercado, transporte] }),
      ),
      api.query('CategoryStats', () =>
        ok({ categoryStats: { ...stats, totalCategories: 3 } }),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    // The refetched list is the observable proof of invalidation.
    expect(
      await screen.findByRole('article', { name: 'Lazer' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
  });

  it('sends only one create mutation on a second click during invalidation', async () => {
    // createCategory.isPending goes false as soon as the mutation response
    // arrives, well before the awaited invalidateQueries refetches below
    // settle. Holding the Categories refetch open reproduces that window.
    populated();
    const createCalls = vi.fn();
    server.use(
      api.mutation('CreateCategory', ({ variables }) => {
        createCalls(variables);
        return ok({ createCategory: { id: 'category-3' } });
      }),
    );
    renderCategories();
    await screen.findByRole('article', { name: 'Mercado' });

    await userEvent.click(
      screen.getByRole('button', { name: '+ Nova categoria' }),
    );
    await userEvent.type(screen.getByLabelText('Nome'), 'Lazer');

    // Only held once the initial list has already loaded: holding it from
    // the start would hang the render this test's setup depends on.
    let releaseList: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      releaseList = resolve;
    });
    server.use(
      api.query('Categories', async () => {
        await held;
        return ok({ categories: [mercado, transporte] });
      }),
    );

    const submit = screen.getByRole('button', { name: 'Salvar' });
    await userEvent.click(submit);
    await userEvent.click(submit);

    releaseList();
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Nova categoria' }),
      ).not.toBeInTheDocument(),
    );
    expect(createCalls).toHaveBeenCalledTimes(1);
  });

  it('reopens the create dialog empty after a create, not prefilled from the last one', async () => {
    // Regression for the dialog staying mounted across "+ Nova categoria"
    // opens: react-hook-form keeps field values unless the component
    // unmounts, so a second create used to reopen showing "Lazer" and its
    // icon/color rather than a blank form.
    populated();
    server.use(
      api.mutation('CreateCategory', () =>
        ok({ createCategory: { id: 'category-3' } }),
      ),
    );
    renderCategories();
    await screen.findByRole('article', { name: 'Mercado' });

    await userEvent.click(
      screen.getByRole('button', { name: '+ Nova categoria' }),
    );
    await userEvent.type(screen.getByLabelText('Nome'), 'Lazer');
    await userEvent.click(screen.getByRole('radio', { name: 'Ingresso' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Nova categoria' }),
      ).not.toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole('button', { name: '+ Nova categoria' }),
    );

    expect(screen.getByLabelText('Nome')).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Carteira' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Verde' })).toBeChecked();
  });

  it('shows the right category after canceling an edit and opening a different one', async () => {
    populated();
    renderCategories();
    const mercadoCard = await screen.findByRole('article', {
      name: 'Mercado',
    });

    await userEvent.click(
      within(mercadoCard).getByRole('button', { name: 'Editar Mercado' }),
    );
    expect(screen.getByLabelText('Nome')).toHaveValue('Mercado');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    const transporteCard = screen.getByRole('article', {
      name: 'Transporte',
    });
    await userEvent.click(
      within(transporteCard).getByRole('button', {
        name: 'Editar Transporte',
      }),
    );

    expect(screen.getByLabelText('Nome')).toHaveValue('Transporte');
  });

  it('discards an abandoned edit when the same category is reopened', async () => {
    populated();
    renderCategories();
    const card = await screen.findByRole('article', { name: 'Mercado' });

    await userEvent.click(
      within(card).getByRole('button', { name: 'Editar Mercado' }),
    );
    await userEvent.clear(screen.getByLabelText('Nome'));
    await userEvent.type(screen.getByLabelText('Nome'), 'Nome abandonado');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await userEvent.click(
      within(card).getByRole('button', { name: 'Editar Mercado' }),
    );

    expect(screen.getByLabelText('Nome')).toHaveValue('Mercado');
  });

  it('opens the dialog prefilled from a card edit button', async () => {
    populated();
    renderCategories();
    const card = await screen.findByRole('article', { name: 'Mercado' });

    await userEvent.click(
      within(card).getByRole('button', { name: 'Editar Mercado' }),
    );

    expect(
      screen.getByRole('heading', { name: 'Editar categoria' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Mercado');
  });

  it('deletes from a card and refetches', async () => {
    populated();
    server.use(
      api.mutation('DeleteCategory', () => ok({ deleteCategory: true })),
    );
    renderCategories();
    const card = await screen.findByRole('article', { name: 'Mercado' });

    await userEvent.click(
      within(card).getByRole('button', { name: 'Excluir Mercado' }),
    );

    server.use(
      api.query('Categories', () => ok({ categories: [transporte] })),
      api.query('CategoryStats', () =>
        ok({ categoryStats: { ...stats, totalCategories: 1, mostUsed: null } }),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('article', { name: 'Mercado' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('sends only one delete mutation on a second click during invalidation', async () => {
    // deleteCategory.isPending goes false as soon as the mutation response
    // arrives, before the awaited invalidateQueries refetches below settle.
    // A second click in that window used to fire a second delete that
    // answered NOT_FOUND for a row already gone.
    populated();
    const deleteCalls = vi.fn();
    server.use(
      api.mutation('DeleteCategory', ({ variables }) => {
        deleteCalls(variables);
        return ok({ deleteCategory: true });
      }),
    );
    renderCategories();
    const card = await screen.findByRole('article', { name: 'Mercado' });

    await userEvent.click(
      within(card).getByRole('button', { name: 'Excluir Mercado' }),
    );

    // Only held once the initial list has already loaded: holding it from
    // the start would hang the render this test's setup depends on.
    let releaseList: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      releaseList = resolve;
    });
    server.use(
      api.query('Categories', async () => {
        await held;
        return ok({ categories: [transporte] });
      }),
    );

    const confirm = screen.getByRole('button', { name: 'Excluir' });
    await userEvent.click(confirm);
    await userEvent.click(confirm);

    releaseList();
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Excluir categoria' }),
      ).not.toBeInTheDocument(),
    );
    expect(deleteCalls).toHaveBeenCalledTimes(1);
  });

  it('does not delete without the confirmation', async () => {
    // No DeleteCategory handler: a request fails the test, which is the point.
    populated();
    renderCategories();
    const card = await screen.findByRole('article', { name: 'Mercado' });

    await userEvent.click(
      within(card).getByRole('button', { name: 'Excluir Mercado' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(
      screen.getByRole('article', { name: 'Mercado' }),
    ).toBeInTheDocument();
  });
});
