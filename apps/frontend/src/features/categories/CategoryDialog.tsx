import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Dialog } from '@/components/ui/Dialog';
import { IconPicker } from '@/components/ui/IconPicker';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/useToast';
import {
  useCategoriesQuery,
  useCategoryStatsQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
} from '@/graphql/generated/graphql';
import { fieldErrorsOf } from '@/lib/graphql-errors';
import type { CategoryColor, CategoryIcon } from '@/lib/category-tokens';
import { categoryFormSchema, type CategoryFormValues } from './validation';

export interface CategoryFormTarget {
  id: string;
  name: string;
  description?: string | null;
  icon: CategoryIcon;
  color: CategoryColor;
}

export interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
  category?: CategoryFormTarget | null;
}

const DEFAULT_ICON: CategoryIcon = 'WALLET';
const DEFAULT_COLOR: CategoryColor = 'GREEN';

export function CategoryDialog({
  open,
  onClose,
  category,
}: CategoryDialogProps) {
  const editing = Boolean(category);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      icon: category?.icon ?? DEFAULT_ICON,
      color: category?.color ?? DEFAULT_COLOR,
    },
  });

  // useWatch rather than form.watch: the pickers stay uncontrolled and
  // React Hook Form still owns the value, but the subscription is one the
  // compiler can memoize. form.watch() cannot be, and lint says so.
  const icon = useWatch({ control: form.control, name: 'icon' });
  const color = useWatch({ control: form.control, name: 'color' });

  async function invalidate() {
    // Both lists carry counts that this mutation changed. frontend.md section 6.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: useCategoriesQuery.getKey() }),
      queryClient.invalidateQueries({
        queryKey: useCategoryStatsQuery.getKey(),
      }),
    ]);
  }

  const createCategory = useCreateCategoryMutation();
  const updateCategory = useUpdateCategoryMutation();
  const pending = createCategory.isPending || updateCategory.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    // An empty box means "no description", not a description of "". The API
    // takes null for that.
    const input = {
      name: values.name,
      description: values.description.length > 0 ? values.description : null,
      icon: values.icon,
      color: values.color,
    };

    try {
      if (category) {
        await updateCategory.mutateAsync({ id: category.id, input });
      } else {
        await createCategory.mutateAsync({ input });
      }

      await invalidate();
      showToast(editing ? 'Categoria atualizada' : 'Categoria criada');
      onClose();
    } catch (error) {
      const nameError = fieldErrorsOf(error).name?.[0];
      if (nameError) {
        form.setError('name', { message: nameError });
        return;
      }

      setFormError('Não foi possível salvar. Tente novamente.');
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Editar categoria' : 'Nova categoria'}
      subtitle="Organize suas transações com categorias"
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

        <Input
          label="Nome"
          placeholder="Mercado"
          error={form.formState.errors.name?.message}
          {...form.register('name')}
        />

        <Input
          label="Descrição (opcional)"
          placeholder="Compras da semana"
          error={form.formState.errors.description?.message}
          {...form.register('description')}
        />

        <IconPicker
          legend="Ícone"
          value={icon}
          registration={form.register('icon')}
        />

        <ColorPicker
          legend="Cor"
          value={color}
          registration={form.register('color')}
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
