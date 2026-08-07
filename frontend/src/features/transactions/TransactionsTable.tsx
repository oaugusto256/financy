import { TransactionRow, type TransactionRowData } from './TransactionRow';

export type { TransactionRowData };

export interface TransactionsTableProps {
  transactions: TransactionRowData[];
  onEdit: (transaction: TransactionRowData) => void;
  onDelete: (transaction: TransactionRowData) => void;
}

const COLUMNS = [
  'Descrição',
  'Data',
  'Categoria',
  'Tipo',
  'Valor',
  'Ações',
] as const;

/**
 * Six columns is more than a narrow window fits. The wrapper scrolls
 * horizontally rather than the row collapsing into a card: one markup path, one
 * set of tests, and real table semantics at every width. `frontend.md`
 * section 12 records the decision, since the design is desktop-only.
 */
export function TransactionsTable({
  transactions,
  onEdit,
  onDelete,
}: TransactionsTableProps) {
  return (
    <div className="overflow-x-auto">
      {/* An arbitrary value, not min-w-3xl: nothing in this codebase uses the
          min-w container scale, and a utility Tailwind does not emit compiles
          to nothing and the table silently stops forcing the scroll. */}
      <table className="w-full min-w-[48rem] border-collapse text-left">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-4 py-3 text-xs font-semibold tracking-wide text-gray-500 uppercase"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
