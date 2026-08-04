import { useState } from 'react';
import { ArrowLeftRight, Star, Tags } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { PageShell } from '@/components/layout/PageShell';
import {
  useCategoriesQuery,
  useCategoryStatsQuery,
} from '@/graphql/generated/graphql';
import { CategoryCard, type CategoryCardData } from './CategoryCard';
import { CategoryDialog, type CategoryFormTarget } from './CategoryDialog';
import { DeleteCategoryDialog } from './DeleteCategoryDialog';

function GridSkeleton() {
  return (
    <div
      aria-label="Carregando categorias"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index} className="h-40 animate-pulse bg-gray-200 p-5" />
      ))}
    </div>
  );
}

function PanelError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 p-8 text-center">
      <p className="text-sm text-gray-600">{message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Tentar novamente
      </Button>
    </Card>
  );
}

export function CategoriesPage() {
  const [dialogTarget, setDialogTarget] = useState<CategoryFormTarget | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryCardData | null>(
    null,
  );

  const categories = useCategoriesQuery();
  const stats = useCategoryStatsQuery();

  function openCreate() {
    setDialogTarget(null);
    setDialogOpen(true);
  }

  function openEdit(category: CategoryCardData) {
    setDialogTarget({
      id: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
    });
    setDialogOpen(true);
  }

  return (
    <PageShell
      title="Categorias"
      subtitle="Organize suas transações por categoria"
      action={<Button onClick={openCreate}>+ Nova categoria</Button>}
    >
      <div className="mb-6">
        {stats.isPending ? (
          <div
            aria-label="Carregando números"
            className="grid gap-4 sm:grid-cols-3"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <Card
                key={index}
                className="h-24 animate-pulse bg-gray-200 p-5"
              />
            ))}
          </div>
        ) : stats.isError || !stats.data ? (
          <PanelError
            message="Não foi possível carregar os números"
            onRetry={() => void stats.refetch()}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={Tags}
              label="Total de categorias"
              value={String(stats.data.categoryStats.totalCategories)}
            />
            <StatCard
              icon={ArrowLeftRight}
              label="Total de transações"
              value={String(stats.data.categoryStats.totalTransactions)}
            />
            <StatCard
              icon={Star}
              label="Categoria mais utilizada"
              value={stats.data.categoryStats.mostUsed?.name ?? '—'}
            />
          </div>
        )}
      </div>

      {categories.isPending ? (
        <GridSkeleton />
      ) : categories.isError || !categories.data ? (
        <PanelError
          message="Não foi possível carregar as categorias"
          onRetry={() => void categories.refetch()}
        />
      ) : categories.data.categories.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-medium text-gray-800">Nenhuma categoria ainda</p>
          <p className="text-sm text-gray-500">
            Crie uma categoria para organizar suas transações.
          </p>
          <Button onClick={openCreate}>Criar primeira categoria</Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.data.categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Keyed on the target so React Hook Form takes fresh defaultValues:
          without it, the second category edited opens with the first one's
          name. */}
      <CategoryDialog
        key={dialogTarget?.id ?? 'new'}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        category={dialogTarget}
      />

      <DeleteCategoryDialog
        category={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </PageShell>
  );
}
