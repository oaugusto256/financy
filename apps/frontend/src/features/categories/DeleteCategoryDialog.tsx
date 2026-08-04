import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/useToast';
import {
  useCategoriesQuery,
  useCategoryStatsQuery,
  useDeleteCategoryMutation,
} from '@/graphql/generated/graphql';

export interface DeleteCategoryTarget {
  id: string;
  name: string;
}

export interface DeleteCategoryDialogProps {
  category: DeleteCategoryTarget | null;
  onClose: () => void;
}

export function DeleteCategoryDialog({
  category,
  onClose,
}: DeleteCategoryDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const deleteCategory = useDeleteCategoryMutation();
  // deleteCategory.isPending goes false the instant mutateAsync resolves,
  // while the dialog stays open and interactive through the awaited
  // invalidateQueries below. A local flag stays true for the whole handler,
  // so a second click during that window is blocked rather than firing a
  // second delete that answers NOT_FOUND for a row already gone.
  const [pending, setPending] = useState(false);

  if (!category) return null;

  async function confirm() {
    if (!category) return;

    setPending(true);
    try {
      await deleteCategory.mutateAsync({ id: category.id });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: useCategoriesQuery.getKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: useCategoryStatsQuery.getKey(),
        }),
        // The backend unlinks the transactions, so their rows have to
        // re-render without a category rather than showing a tag for something
        // that no longer exists. Nothing consumes this key until slice 3, and
        // invalidating it now is what makes that slice correct on arrival.
        queryClient.invalidateQueries({ queryKey: ['Transactions'] }),
      ]);

      showToast('Categoria excluída');
      onClose();
    } catch {
      showToast('Não foi possível excluir. Tente novamente.', 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Excluir categoria">
      <p className="text-sm text-gray-600">
        Tem certeza que deseja excluir <strong>{category.name}</strong>? As
        transações desta categoria serão mantidas, sem categoria.
      </p>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={confirm}
          loading={pending}
          className="bg-danger hover:bg-red-dark"
        >
          Excluir
        </Button>
      </div>
    </Dialog>
  );
}
