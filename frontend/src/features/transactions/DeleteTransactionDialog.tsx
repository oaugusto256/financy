import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/useToast';
import {
  useCategoriesQuery,
  useCategoryStatsQuery,
  useDeleteTransactionMutation,
} from '@/graphql/generated/graphql';

export interface DeleteTransactionTarget {
  id: string;
  description: string;
}

export interface DeleteTransactionDialogProps {
  transaction: DeleteTransactionTarget | null;
  onClose: () => void;
}

export function DeleteTransactionDialog({
  transaction,
  onClose,
}: DeleteTransactionDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const deleteTransaction = useDeleteTransactionMutation();
  // deleteTransaction.isPending goes false the instant mutateAsync resolves,
  // while the dialog stays open and interactive through the awaited
  // invalidation below. A local flag stays true for the whole handler, so a
  // second click in that window cannot fire a second delete that answers
  // NOT_FOUND for a row already gone.
  const [pending, setPending] = useState(false);

  if (!transaction) return null;

  async function confirm() {
    if (!transaction) return;

    setPending(true);
    try {
      await deleteTransaction.mutateAsync({ id: transaction.id });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['Transactions'] }),
        queryClient.invalidateQueries({
          queryKey: useCategoriesQuery.getKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: useCategoryStatsQuery.getKey(),
        }),
        queryClient.invalidateQueries({ queryKey: ['Summary'] }),
      ]);

      showToast('Transação excluída');
      onClose();
    } catch {
      showToast('Não foi possível excluir. Tente novamente.', 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Excluir transação">
      {/* No consequence to spell out, unlike the category confirmation:
          deleting a transaction deletes exactly that transaction. */}
      <p className="text-sm text-gray-600">
        Tem certeza que deseja excluir{' '}
        <strong>{transaction.description}</strong>? Esta ação não pode ser
        desfeita.
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
