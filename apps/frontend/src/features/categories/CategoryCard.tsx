import { Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { IconButton } from '@/components/ui/IconButton';
import { Tag } from '@/components/ui/Tag';
import type { CategoryColor, CategoryIcon } from '@/lib/category-tokens';

export interface CategoryCardData {
  id: string;
  name: string;
  description?: string | null;
  icon: CategoryIcon;
  color: CategoryColor;
  transactionCount: number;
}

export interface CategoryCardProps {
  category: CategoryCardData;
  onEdit: (category: CategoryCardData) => void;
  onDelete: (category: CategoryCardData) => void;
}

export function CategoryCard({
  category,
  onEdit,
  onDelete,
}: CategoryCardProps) {
  const { name, description, icon, color, transactionCount } = category;

  return (
    // An article named by the category, so a test and a screen reader can both
    // address one card among twelve.
    <Card as="article" aria-label={name} className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between">
        <CategoryBadge icon={icon} color={color} />
        <div className="flex gap-2">
          <IconButton
            icon={Trash2}
            label={`Excluir ${name}`}
            variant="danger"
            onClick={() => onDelete(category)}
          />
          <IconButton
            icon={Pencil}
            label={`Editar ${name}`}
            onClick={() => onEdit(category)}
          />
        </div>
      </div>

      <div>
        <p className="font-semibold text-gray-800">{name}</p>
        {description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">
            {description}
          </p>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between">
        <Tag color={color}>{name}</Tag>
        <span className="text-xs text-gray-500">
          {transactionCount === 1 ? '1 item' : `${transactionCount} itens`}
        </span>
      </div>
    </Card>
  );
}
