import { prisma } from '../../src/shared/prisma.js';

/** Empties every table. Called by each integration suite in `beforeEach`. */
export async function resetDatabase(): Promise<void> {
  // Children first: SQLite enforces the foreign keys, so deleting users while
  // their rows are still there fails rather than cascading.
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}
