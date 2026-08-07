/**
 * Development data. Not for any other environment: it deletes the seed user's
 * rows on every run and its password comes from the SEED_PASSWORD environment
 * variable, falling back to a non-secret placeholder when unset.
 *
 * Twenty-seven transactions across the current month and the eleven before it,
 * because that is what the transactions table in the design shows ("1 a 10 | 27
 * resultados") and because pagination and the dashboard's month figures both
 * need more than a handful of rows to be worth looking at.
 */
import { prisma } from '../src/shared/prisma.js';
import { hashPassword } from '../src/shared/password.js';
import { monthsBack } from './seed-dates.js';

const SEED_EMAIL = 'ana@financy.dev';
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'trocar-esta-senha';

const CATEGORIES = [
  {
    name: 'Moradia',
    description: 'Aluguel e contas da casa',
    icon: 'HOME',
    color: 'BLUE',
  },
  {
    name: 'Mercado',
    description: 'Compras da semana',
    icon: 'SHOPPING_CART',
    color: 'GREEN',
  },
  { name: 'Transporte', description: null, icon: 'BUS', color: 'ORANGE' },
  {
    name: 'Saúde',
    description: 'Plano, farmácia e consultas',
    icon: 'HEART_PULSE',
    color: 'RED',
  },
  { name: 'Lazer', description: null, icon: 'TICKET', color: 'PURPLE' },
  {
    name: 'Educação',
    description: 'Cursos e livros',
    icon: 'BOOK_OPEN',
    color: 'YELLOW',
  },
  {
    name: 'Salário',
    description: 'Entrada mensal',
    icon: 'BRIEFCASE',
    color: 'PINK',
  },
] as const;

/**
 * Fixed rows with dates relative to the run: descriptions, amounts, types and
 * category assignments are literals, so two runs a week apart produce the same
 * data — but the dates are computed from the run time, so the dashboard's
 * current-month figures are never zero and slice 4's period select has
 * something to select in every one of its twelve month options.
 *
 * `monthsAgo: 0` is the current month. Every `day` is between 3 and 28: no
 * month is too short for any of them, and none sits close enough to a boundary
 * for local midnight to fall outside the UTC window `summary` builds.
 *
 * Amounts are integer cents throughout — 150_000 is R$ 1.500,00.
 */
const TRANSACTIONS = [
  // The current month: a salary, the fixed bills, and enough rows for the
  // dashboard's five-row recent panel to be full.
  {
    monthsAgo: 0,
    day: 5,
    description: 'Salário',
    amount: 780_000,
    type: 'INCOME',
    category: 'Salário',
  },
  {
    monthsAgo: 0,
    day: 5,
    description: 'Aluguel',
    amount: 210_000,
    type: 'EXPENSE',
    category: 'Moradia',
  },
  {
    monthsAgo: 0,
    day: 6,
    description: 'Conta de água',
    amount: 9_120,
    type: 'EXPENSE',
    category: 'Moradia',
  },
  {
    monthsAgo: 0,
    day: 8,
    description: 'Compras da semana',
    amount: 35_910,
    type: 'EXPENSE',
    category: 'Mercado',
  },
  {
    monthsAgo: 0,
    day: 10,
    description: 'Uber para o aeroporto',
    amount: 7_830,
    type: 'EXPENSE',
    category: 'Transporte',
  },
  {
    monthsAgo: 0,
    day: 17,
    description: 'Plano de saúde',
    amount: 48_700,
    type: 'EXPENSE',
    category: 'Saúde',
  },

  {
    monthsAgo: 1,
    day: 5,
    description: 'Salário',
    amount: 780_000,
    type: 'INCOME',
    category: 'Salário',
  },
  {
    monthsAgo: 1,
    day: 5,
    description: 'Aluguel',
    amount: 210_000,
    type: 'EXPENSE',
    category: 'Moradia',
  },
  {
    monthsAgo: 1,
    day: 6,
    description: 'Conta de luz',
    amount: 18_740,
    type: 'EXPENSE',
    category: 'Moradia',
  },
  {
    monthsAgo: 1,
    day: 7,
    description: 'Compras da semana',
    amount: 34_215,
    type: 'EXPENSE',
    category: 'Mercado',
  },
  {
    monthsAgo: 1,
    day: 18,
    description: 'Freelance de design',
    amount: 120_000,
    type: 'INCOME',
    category: null,
  },
  {
    monthsAgo: 1,
    day: 28,
    description: 'Compras da semana',
    amount: 27_640,
    type: 'EXPENSE',
    category: 'Mercado',
  },

  {
    monthsAgo: 2,
    day: 9,
    description: 'Recarga do bilhete único',
    amount: 10_000,
    type: 'EXPENSE',
    category: 'Transporte',
  },
  {
    monthsAgo: 2,
    day: 11,
    description: 'Cinema',
    amount: 6_400,
    type: 'EXPENSE',
    category: 'Lazer',
  },

  {
    monthsAgo: 3,
    day: 13,
    description: 'Farmácia',
    amount: 8_930,
    type: 'EXPENSE',
    category: 'Saúde',
  },
  {
    monthsAgo: 3,
    day: 14,
    description: 'Compras da semana',
    amount: 29_880,
    type: 'EXPENSE',
    category: 'Mercado',
  },

  {
    monthsAgo: 4,
    day: 16,
    description: 'Curso de inglês',
    amount: 32_000,
    type: 'EXPENSE',
    category: 'Educação',
  },
  {
    monthsAgo: 4,
    day: 19,
    description: 'Jantar fora',
    amount: 11_250,
    type: 'EXPENSE',
    category: 'Lazer',
  },

  {
    monthsAgo: 5,
    day: 21,
    description: 'Compras da semana',
    amount: 31_470,
    type: 'EXPENSE',
    category: 'Mercado',
  },
  {
    monthsAgo: 5,
    day: 23,
    description: 'Consulta médica',
    amount: 25_000,
    type: 'EXPENSE',
    category: 'Saúde',
  },

  {
    monthsAgo: 6,
    day: 26,
    description: 'Internet',
    amount: 12_990,
    type: 'EXPENSE',
    category: 'Moradia',
  },
  {
    monthsAgo: 7,
    day: 3,
    description: 'Reembolso de passagem',
    amount: 8_500,
    type: 'INCOME',
    category: 'Transporte',
  },
  {
    monthsAgo: 8,
    day: 12,
    description: 'Livro de arquitetura',
    amount: 14_900,
    type: 'EXPENSE',
    category: 'Educação',
  },
  {
    monthsAgo: 9,
    day: 14,
    description: 'Show',
    amount: 22_000,
    type: 'EXPENSE',
    category: 'Lazer',
  },
  {
    monthsAgo: 10,
    day: 15,
    description: 'Compras da semana',
    amount: 30_050,
    type: 'EXPENSE',
    category: 'Mercado',
  },

  {
    monthsAgo: 11,
    day: 19,
    description: 'Presente de aniversário',
    amount: 15_000,
    type: 'EXPENSE',
    category: null,
  },
  {
    monthsAgo: 11,
    day: 21,
    description: 'Venda de bicicleta usada',
    amount: 65_000,
    type: 'INCOME',
    category: null,
  },
] as const;

async function main() {
  // `prisma migrate dev` and `prisma migrate reset` both invoke this file
  // automatically (package.json's `prisma.seed` entry), with no prompt and no
  // typed `npm run db:seed`. Pointed at a non-development `DATABASE_URL`, the
  // delete-then-recreate below destroys a real account and replaces it with a
  // password the repo publishes. Bail before that can happen.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run prisma/seed.ts with NODE_ENV=production: it deletes and recreates the seed user, which would destroy real data.',
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: SEED_EMAIL },
    select: { id: true },
  });

  // Scoped to the seed user only. A blanket deleteMany would wipe whatever the
  // developer was in the middle of testing with their own account.
  if (existing) await prisma.user.delete({ where: { id: existing.id } });

  const user = await prisma.user.create({
    data: {
      name: 'Ana Souza',
      email: SEED_EMAIL,
      passwordHash: await hashPassword(SEED_PASSWORD),
    },
  });

  const categoriesByName = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await prisma.category.create({
      data: {
        userId: user.id,
        name: category.name,
        description: category.description,
        icon: category.icon,
        color: category.color,
      },
    });
    categoriesByName.set(category.name, created.id);
  }

  await prisma.transaction.createMany({
    data: TRANSACTIONS.map((transaction) => ({
      userId: user.id,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      date: monthsBack(transaction.monthsAgo, transaction.day),
      categoryId: transaction.category
        ? (categoriesByName.get(transaction.category) ?? null)
        : null,
    })),
  });

  console.log(
    `Seeded ${SEED_EMAIL} with ${CATEGORIES.length} categories and ${TRANSACTIONS.length} transactions.`,
  );

  // Only the non-secret built-in fallback is safe to print. A developer who
  // sets a real SEED_PASSWORD must never see it echoed back in a shell or CI
  // log — they already know it, and logging it is the only way it leaks.
  if (process.env.SEED_PASSWORD === undefined) {
    console.log(`Development password: ${SEED_PASSWORD}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
