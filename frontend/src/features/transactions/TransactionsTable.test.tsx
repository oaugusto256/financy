import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TransactionsTable,
  type TransactionRowData,
} from '@/features/transactions/TransactionsTable';

const rows: TransactionRowData[] = [
  {
    id: 'transaction-1',
    description: 'Aluguel',
    amount: 210_000,
    type: 'EXPENSE',
    date: '2026-08-05T03:00:00.000Z',
    category: {
      id: 'category-1',
      name: 'Moradia',
      icon: 'HOME',
      color: 'BLUE',
    },
  },
  {
    id: 'transaction-2',
    description: 'Freelance de design',
    amount: 120_000,
    type: 'INCOME',
    date: '2026-07-18T03:00:00.000Z',
    category: null,
  },
];

describe('TransactionsTable', () => {
  it('renders the six columns from the design', () => {
    render(
      <TransactionsTable
        transactions={rows}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getAllByRole('columnheader').map((cell) => cell.textContent),
    ).toEqual(['Descrição', 'Data', 'Categoria', 'Tipo', 'Valor', 'Ações']);
  });

  it('renders an expense with a leading minus and income with a plus', () => {
    render(
      <TransactionsTable
        transactions={rows}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('-R$ 2.100,00')).toBeInTheDocument();
    expect(screen.getByText('+R$ 1.200,00')).toBeInTheDocument();
  });

  it('renders the date as DD/MM/YY', () => {
    render(
      <TransactionsTable
        transactions={rows}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('05/08/26')).toBeInTheDocument();
  });

  it('labels an uncategorized row rather than leaving the cell blank', () => {
    // The design has no state for this; frontend.md section 12 records the
    // neutral tag as the decision.
    render(
      <TransactionsTable
        transactions={rows}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Sem categoria')).toBeInTheDocument();
  });

  it('names each row action after its transaction', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <TransactionsTable
        transactions={rows}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar Aluguel' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir Aluguel' }),
    );

    expect(onEdit).toHaveBeenCalledWith(rows[0]);
    expect(onDelete).toHaveBeenCalledWith(rows[0]);
  });

  it('puts edit before delete in tab order', () => {
    render(
      <TransactionsTable
        transactions={[rows[0]!]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const actions = within(screen.getAllByRole('row')[1]!).getAllByRole(
      'button',
    );

    expect(actions[0]).toHaveAccessibleName('Editar Aluguel');
    expect(actions[1]).toHaveAccessibleName('Excluir Aluguel');
  });
});
