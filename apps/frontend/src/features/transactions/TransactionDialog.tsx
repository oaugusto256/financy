import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/useToast';
import {
  useCategoriesQuery,
  useCategoryStatsQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
} from '@/graphql/generated/graphql';
import { fieldErrorsOf } from '@/lib/graphql-errors';
import { centsToDisplay, digitsToCents } from '@/lib/currency';
import { fromDateInputValue, toDateInputValue } from '@/lib/format';
import {
  transactionFormSchema,
  type TransactionFormValues,
} from './validation';

export interface TransactionFormTarget {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  /** The ISO instant the API returned. */
  date: string;
  categoryId: string | null;
}

export interface TransactionDialogProps {
  open: boolean;
  onClose: () => void;
  transaction?: TransactionFormTarget | null;
}

const TYPE_OPTIONS = [
  { value: 'EXPENSE', label: 'Despesa', tone: 'danger' },
  { value: 'INCOME', label: 'Receita', tone: 'success' },
] as const;

const UNCATEGORIZED = '';

/** Today, in the format the date input wants. */
function today(): string {
  return toDateInputValue(new Date().toISOString());
}

export function TransactionDialog({
  open,
  onClose,
  transaction,
}: TransactionDialogProps) {
  const editing = Boolean(transaction);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  // The category list, for the select. It is already in the cache whenever the
  // categories page has been visited; here it is just another query.
  const categories = useCategoriesQuery();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      description: transaction?.description ?? '',
      amount: transaction?.amount ?? 0,
      type: transaction?.type ?? 'EXPENSE',
      date: transaction ? toDateInputValue(transaction.date) : today(),
      categoryId: transaction?.categoryId ?? UNCATEGORIZED,
    },
  });

  const createTransaction = useCreateTransactionMutation();
  const updateTransaction = useUpdateTransactionMutation();
  // isSubmitting, not the mutation's isPending: isPending flips false the
  // moment mutateAsync resolves, while the dialog stays open and interactive
  // through the awaited invalidation below. isSubmitting stays true for the
  // whole handler, so a second click in that window cannot fire a second save.
  const pending = form.formState.isSubmitting;

  async function invalidate() {
    await Promise.all([
      // The bare literal, not getKey(variables): every page of the list is its
      // own cache entry and TanStack matches by prefix, so this invalidates all
      // of them rather than only the page that happened to be open.
      queryClient.invalidateQueries({ queryKey: ['Transactions'] }),
      // Both category lists carry per-category counts and totals this row
      // changed. frontend.md section 6.
      queryClient.invalidateQueries({ queryKey: useCategoriesQuery.getKey() }),
      queryClient.invalidateQueries({
        queryKey: useCategoryStatsQuery.getKey(),
      }),
      // The dashboard's figures, which slice 5 renders. Invalidating a key with
      // no consumer costs nothing and is what makes that slice correct on
      // arrival — the same bet slice 2 made on ['Transactions'].
      queryClient.invalidateQueries({ queryKey: ['Summary'] }),
    ]);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    const input = {
      description: values.description,
      amount: values.amount,
      type: values.type,
      date: fromDateInputValue(values.date),
      // An empty select is "sem categoria". The API takes null for that.
      categoryId:
        values.categoryId === UNCATEGORIZED ? null : values.categoryId,
    };

    try {
      if (transaction) {
        await updateTransaction.mutateAsync({ id: transaction.id, input });
      } else {
        await createTransaction.mutateAsync({ input });
      }

      await invalidate();
      showToast(editing ? 'Transação atualizada' : 'Transação criada');
      onClose();
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error);
      const named = (
        ['description', 'amount', 'date', 'categoryId'] as const
      ).find((field) => fieldErrors[field]?.[0]);

      if (named) {
        form.setError(named, { message: fieldErrors[named]?.[0] });
        return;
      }

      setFormError('Não foi possível salvar. Tente novamente.');
    }
  });

  const loadedCategories = categories.data?.categories ?? [];
  const categoryOptions = [
    { value: UNCATEGORIZED, label: 'Sem categoria' },
    ...loadedCategories.map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ];

  // The list loads asynchronously, but a transaction being edited already
  // has a categoryId at mount. A controlled select can only hold a value
  // that matches one of its <option>s, so the currently assigned category
  // needs a placeholder slot until the real list arrives and replaces it —
  // by the same value, so React just swaps the label in place.
  if (
    transaction?.categoryId &&
    !loadedCategories.some((category) => category.id === transaction.categoryId)
  ) {
    categoryOptions.push({ value: transaction.categoryId, label: '…' });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Editar transação' : 'Nova transação'}
      subtitle="Registre sua despesa ou receita"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-red-light px-3 py-2 text-sm text-red-dark"
          >
            {formError}
          </p>
        )}

        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <SegmentedControl
              legend="Tipo"
              name={field.name}
              value={field.value}
              options={[...TYPE_OPTIONS]}
              onChange={field.onChange}
            />
          )}
        />

        <Input
          label="Descrição"
          placeholder="Compras da semana"
          error={form.formState.errors.description?.message}
          {...form.register('description')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Data"
            type="date"
            error={form.formState.errors.date?.message}
            {...form.register('date')}
          />

          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <Input
                label="Valor"
                inputMode="numeric"
                // The field holds an integer for its whole life. This is the
                // only place cents become a string, and digitsToCents is its
                // exact inverse — see lib/currency.ts.
                value={centsToDisplay(field.value)}
                onChange={(event) =>
                  field.onChange(digitsToCents(event.target.value))
                }
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                error={form.formState.errors.amount?.message}
              />
            )}
          />
        </div>

        <Controller
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <Select
              label="Categoria"
              options={categoryOptions}
              // Controlled, not registered: the default value can be a
              // category the options list does not hold yet (it loads
              // asynchronously), and a native uncontrolled select never
              // re-applies a selection once the matching <option> shows up
              // later. A controlled value re-syncs on every render instead.
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              error={form.formState.errors.categoryId?.message}
            />
          )}
        />

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Salvar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
