import DataLoader from 'dataloader';
import { prisma } from './prisma.js';

export interface CategoryTotals {
  transactionCount: number;
  totalAmount: number;
}

const EMPTY: CategoryTotals = { transactionCount: 0, totalAmount: 0 };

export interface Loaders {
  categoryTotals: DataLoader<string, CategoryTotals>;
}

/**
 * Built once per request, so the twelve cards on the categories page cost one
 * grouped aggregate rather than twelve queries. backend.md section 5.
 *
 * `userId` is captured here rather than passed per key: every key in a request
 * belongs to the same caller, and putting it in the closure means the scope
 * cannot be forgotten at a call site. A null user yields zeros — unreachable in
 * practice, because every resolver that touches a loader has already been
 * through `requireUser`.
 */
export function createLoaders(userId: string | null): Loaders {
  return {
    categoryTotals: new DataLoader<string, CategoryTotals>(
      async (categoryIds) => {
        if (!userId) return categoryIds.map(() => EMPTY);

        const grouped = await prisma.transaction.groupBy({
          by: ['categoryId'],
          where: { userId, categoryId: { in: [...categoryIds] } },
          _count: { _all: true },
          _sum: { amount: true },
        });

        const byCategory = new Map(
          grouped.map((row) => [
            row.categoryId,
            {
              transactionCount: row._count._all,
              totalAmount: row._sum.amount ?? 0,
            },
          ]),
        );

        return categoryIds.map((id) => byCategory.get(id) ?? EMPTY);
      },
    ),
  };
}
