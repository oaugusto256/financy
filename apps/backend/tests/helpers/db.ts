import { prisma } from '../../src/shared/prisma.js';

/** Empties every table. Called by each integration suite in `beforeEach`. */
export async function resetDatabase(): Promise<void> {
  await prisma.user.deleteMany();
}
