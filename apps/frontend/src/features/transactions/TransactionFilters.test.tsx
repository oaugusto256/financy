import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionFilters } from './TransactionFilters';
import { periodOptions } from '@/lib/period';

const values = { search: '', type: '', categoryId: '', period: '' };
const categories = [
  { id: 'cat-1', name: 'Mercado' },
  { id: 'cat-2', name: 'Salário' },
];

/**
 * The most recent real month periodOptions() offers, not "all periods"
 * (index 0). Read from periodOptions() rather than hard-coded so the test
 * does not age out once that month falls out of the twelve-month window.
 */
function aRealMonth(): string {
  return periodOptions()[1]!.value;
}

function renderBar(
  overrides: Partial<Parameters<typeof TransactionFilters>[0]> = {},
) {
  const onSearchChange = vi.fn();
  const onValueChange = vi.fn();

  render(
    <TransactionFilters
      values={values}
      draftSearch=""
      onSearchChange={onSearchChange}
      onValueChange={onValueChange}
      categories={categories}
      {...overrides}
    />,
  );

  return { onSearchChange, onValueChange };
}

describe('TransactionFilters', () => {
  it('offers the four controls the design draws', () => {
    renderBar();

    expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
    expect(screen.getByLabelText('Período')).toBeInTheDocument();
  });

  it('names the type options as the design does', () => {
    renderBar();

    const type = screen.getByLabelText('Tipo');
    expect(within(type).getByRole('option', { name: 'Todos' })).toHaveValue('');
    expect(within(type).getByRole('option', { name: 'Entrada' })).toHaveValue(
      'INCOME',
    );
    expect(within(type).getByRole('option', { name: 'Saída' })).toHaveValue(
      'EXPENSE',
    );
  });

  it('lists the user’s categories behind a "Todas" option', () => {
    renderBar();

    const category = screen.getByLabelText('Categoria');
    const options = within(category).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Todas',
      'Mercado',
      'Salário',
    ]);
  });

  it('offers thirteen periods, with "all" first and selected by default', () => {
    renderBar();

    const period = screen.getByLabelText('Período');
    const options = within(period).getAllByRole('option');
    expect(options).toHaveLength(13);
    expect(options[0]).toHaveTextContent('Todos os períodos');
    expect(period).toHaveValue('');
  });

  it('reports a typed character without waiting for anything', async () => {
    const { onSearchChange } = renderBar();

    await userEvent.type(screen.getByLabelText('Buscar'), 'a');

    expect(onSearchChange).toHaveBeenCalledWith('a');
  });

  it('reports a chosen type, category and period by field name', async () => {
    const { onValueChange } = renderBar();
    const month = aRealMonth();

    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'INCOME');
    await userEvent.selectOptions(screen.getByLabelText('Categoria'), 'cat-1');
    await userEvent.selectOptions(screen.getByLabelText('Período'), month);

    expect(onValueChange).toHaveBeenCalledWith('type', 'INCOME');
    expect(onValueChange).toHaveBeenCalledWith('categoryId', 'cat-1');
    expect(onValueChange).toHaveBeenCalledWith('period', month);
  });

  it('shows the values it was given', () => {
    const month = aRealMonth();

    renderBar({
      values: {
        search: 'mercado',
        type: 'EXPENSE',
        categoryId: 'cat-2',
        period: month,
      },
      draftSearch: 'mercado',
    });

    expect(screen.getByLabelText('Buscar')).toHaveValue('mercado');
    expect(screen.getByLabelText('Tipo')).toHaveValue('EXPENSE');
    expect(screen.getByLabelText('Categoria')).toHaveValue('cat-2');
    expect(screen.getByLabelText('Período')).toHaveValue(month);
  });

  it('holds a selected category that is not in the list yet', () => {
    // The categories query resolves after the first render, and the URL may
    // already name a category. A native select cannot hold a value with no
    // matching <option>, so it would silently fall back to "Todas" and the
    // bar would disagree with the rows on screen.
    renderBar({
      values: { ...values, categoryId: 'cat-9' },
      categories: [],
    });

    expect(screen.getByLabelText('Categoria')).toHaveValue('cat-9');
  });

  it('says so when the category list could not be loaded', () => {
    // The gap slice 3 left in the dialog: categories.isError was never read,
    // so a failed list looked identical to a slow one.
    renderBar({ categories: [], categoriesFailed: true });

    expect(screen.getByLabelText('Categoria')).toHaveAccessibleDescription(
      'Não foi possível carregar as categorias',
    );
  });
});
