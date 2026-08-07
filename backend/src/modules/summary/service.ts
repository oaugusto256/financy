import { prisma } from '../../shared/prisma.js';
import { parseInput } from '../../shared/validation.js';
import { summaryArgsSchema } from './validation.js';

export interface Summary {
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
}

interface TypeSum {
  type: string;
  _sum: { amount: number | null };
}

const sumOf = (rows: TypeSum[], type: string) =>
  rows.find((row) => row.type === type)?._sum.amount ?? 0;

/**
 * The requested calendar month as a half-open UTC interval. Half-open is what
 * makes backend.md section 5's "the last instant of the final day" exact
 * without picking a millisecond, and `Date.UTC(year, 12, 1)` rolls into
 * January of the following year on its own, so December needs no special case.
 *
 * UTC, not server-local: a local window makes every figure depend on the TZ the
 * process happens to run under, so the same data reads differently on a
 * developer's machine and a deployed one. The cost — a user at UTC-3 who
 * records a transaction late on the last day of a month sees it counted in the
 * next one — is recorded as a deviation in frontend.md section 12.
 */
function monthWindow(month: number, year: number) {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

/**
 * No DataLoader: this is a single root field resolved once per request, not a
 * per-row field, so there is no N+1 to batch. The two aggregates run inside one
 * $transaction so all three figures come from one consistent read — separately,
 * a write landing between them could produce a balance that no single moment of
 * the database ever held.
 */
export async function getSummary(
  userId: string,
  args: unknown,
): Promise<Summary> {
  const { month, year } = parseInput(summaryArgsSchema, args);
  const date = monthWindow(month, year);

  const [allTime, inMonth] = await prisma.$transaction([
    prisma.transaction.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['type'],
      where: { userId, date },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalBalance: sumOf(allTime, 'INCOME') - sumOf(allTime, 'EXPENSE'),
    monthIncome: sumOf(inMonth, 'INCOME'),
    // Unsigned, matching Category.totalAmount. The dashboard card renders the
    // minus sign. backend.md section 5.
    monthExpense: sumOf(inMonth, 'EXPENSE'),
  };
}
