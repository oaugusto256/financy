import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { api, graphqlError, ok } from '@/test/msw/api';
import { CategoriesPanel } from './CategoriesPanel';

function aCategory(name: string, totalAmount: number, transactionCount = 3) {
  return {
    id: `category-${name}`,
    name,
    description: null,
    icon: 'SHOPPING_CART',
    color: 'GREEN',
    transactionCount,
    totalAmount,
  };
}

function mockCategories(categories: unknown[]) {
  server.use(api.query('Categories', () => ok({ categories })));
}

describe('CategoriesPanel', () => {
  it('announces that it is loading before the rows arrive', () => {
    mockCategories([]);
    renderWithProviders(<CategoriesPanel />);

    expect(
      screen.getByRole('status', { name: 'Carregando categorias' }),
    ).toBeInTheDocument();
  });

  it('renders a row with its tag, item count and total', async () => {
    mockCategories([aCategory('Mercado', 123_456, 7)]);
    renderWithProviders(<CategoriesPanel />);

    // The name is carried by the Tag alone — the row has no icon badge and no
    // heading, so the name appears exactly once. frontend.md section 5.
    expect(await screen.findAllByText('Mercado')).toHaveLength(1);
    expect(screen.getByText('7 itens')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.234,56')).toBeInTheDocument();
  });

  it('says "1 item" in the singular', async () => {
    mockCategories([aCategory('Lazer', 1_000, 1)]);
    renderWithProviders(<CategoriesPanel />);

    expect(await screen.findByText('1 item')).toBeInTheDocument();
  });

  it('sorts by total amount descending and caps at five', async () => {
    // Six categories, supplied out of order, so the sort and the cap can fail
    // independently: an unsorted implementation drops the wrong one, and an
    // uncapped one renders six.
    mockCategories([
      aCategory('Terceira', 300),
      aCategory('Sexta', 60),
      aCategory('Primeira', 600),
      aCategory('Quinta', 100),
      aCategory('Segunda', 500),
      aCategory('Quarta', 200),
    ]);
    renderWithProviders(<CategoriesPanel />);

    await screen.findByText('Primeira');
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    // The tag is the row's first element, so its text is the category name.
    expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual([
      'Primeira',
      'Segunda',
      'Terceira',
      'Quarta',
      'Quinta',
    ]);
    expect(screen.queryByText('Sexta')).not.toBeInTheDocument();
  });

  it('says so when there is nothing yet, and still offers the way out', async () => {
    mockCategories([]);
    renderWithProviders(<CategoriesPanel />);

    expect(
      await screen.findByText('Nenhuma categoria ainda'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gerenciar' })).toHaveAttribute(
      'href',
      '/categories',
    );
  });

  it('offers a retry when the query fails, and the retry refetches', async () => {
    let calls = 0;
    server.use(
      api.query('Categories', () => {
        calls += 1;
        return calls === 1
          ? graphqlError('NOT_FOUND')
          : ok({ categories: [aCategory('Mercado', 1_000)] });
      }),
    );
    renderWithProviders(<CategoriesPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as categorias',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await screen.findByText('Mercado')).toBeInTheDocument();
  });

  it('is a section a screen reader can address by name', async () => {
    mockCategories([aCategory('Mercado', 1_000)]);
    renderWithProviders(<CategoriesPanel />);

    expect(
      await screen.findByRole('region', { name: 'Categorias' }),
    ).toBeInTheDocument();
  });
});
