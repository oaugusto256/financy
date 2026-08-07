import { afterAll, expect, it } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';

afterAll(async () => {
  await prisma.$disconnect();
});

it('connects to the database', async () => {
  const result = await prisma.$queryRaw`SELECT 1 as value`;
  // BigInt, not number: $queryRaw hands back SQLite integers untouched rather
  // than narrowing them to JavaScript's safe range.
  expect(result).toEqual([{ value: 1n }]);
});
