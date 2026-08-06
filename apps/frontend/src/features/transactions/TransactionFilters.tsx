import { useMemo } from 'react';
import { parse } from 'date-fns';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { monthLabel, periodOptions } from '@/lib/period';
import { SEARCH_MAX_LENGTH, type FilterValues } from './useTransactionFilters';

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

  const periodOptionsList = [...periods];

  // Mirrors the category placeholder above: `values.period` has already
  // passed `periodRange`'s validation in useTransactionFilters — a hand-typed
  // ?period=banana never reaches this component at all — so a value that
  // still matches no <option> is a real month outside the twelve-month
  // window `periods` covers, e.g. an old bookmark or shared link. Unlike the
  // category id, the label is derivable from the value itself, so this needs
  // no `…` placeholder.
  if (
    values.period &&
    !periods.some((option) => option.value === values.period)
  ) {
    periodOptionsList.push({
      value: values.period,
      label: monthLabel(parse(values.period, 'yyyy-MM', new Date())),
    });
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
        maxLength={SEARCH_MAX_LENGTH}
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
        options={periodOptionsList}
        value={values.period}
        onChange={(event) => onValueChange('period', event.target.value)}
      />
    </div>
  );
}
