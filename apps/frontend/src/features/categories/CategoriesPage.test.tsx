import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
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
