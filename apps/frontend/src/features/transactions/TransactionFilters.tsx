import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { periodOptions } from '@/lib/period';
import type { FilterValues } from './useTransactionFilters';

export interface TransactionFiltersProps {
  values: FilterValues;
  /** The search input's own value, ahead of the debounced URL write. */
  draftSearch: string;
  onSearchChange: (value: string) => void;
  onValueChange: (
    field: 'type' | 'categoryId' | 'period',
    value: string,
  ) => void;
  categories: { id: string; name: string }[];
  categoriesFailed?: boolean;
}

const TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'INCOME', label: 'Entrada' },
  { value: 'EXPENSE', label: 'Saída' },
];

/**
 * Presentational. It owns no state and fires no query, so its tests need
 * neither MSW nor a router — the page above it owns both.
 */
export function TransactionFilters({
  values,
  draftSearch,
  onSearchChange,
  onValueChange,
  categories,
  categoriesFailed = false,
}: TransactionFiltersProps) {
  // Recomputed only when the component remounts, not on every keystroke —
  // and, more to the point, the twelve months are computed from `new Date()`
  // once, so the list cannot shift under the user mid-session.
  const periods = useMemo(() => periodOptions(), []);

  const categoryOptions = [
    { value: '', label: 'Todas' },
    ...categories.map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ];

  // Same problem the transaction dialog's select has: the URL can name a
  // category before the list arrives, and a native select silently drops a
  // value with no matching <option>. A placeholder slot keyed by the same
  // value lets React swap the label in place when the real list lands.
  if (
    values.categoryId &&
    !categories.some((category) => category.id === values.categoryId)
  ) {
    categoryOptions.push({ value: values.categoryId, label: '…' });
  }

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        label="Buscar"
        placeholder="Descrição"
        icon={Search}
        type="search"
        value={draftSearch}
        onChange={(event) => onSearchChange(event.target.value)}
      />

      <Select
        label="Tipo"
        options={TYPE_OPTIONS}
        value={values.type}
        onChange={(event) => onValueChange('type', event.target.value)}
      />

      <Select
        label="Categoria"
        options={categoryOptions}
        value={values.categoryId}
        onChange={(event) => onValueChange('categoryId', event.target.value)}
        helperText={
          categoriesFailed
            ? 'Não foi possível carregar as categorias'
            : undefined
        }
      />

      <Select
        label="Período"
        options={periods}
        value={values.period}
        onChange={(event) => onValueChange('period', event.target.value)}
      />
    </div>
  );
}
