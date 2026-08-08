import { prisma } from './prisma.js';

// Shared by the REST `/health` route and the GraphQL `Query.health` field so
// the two surfaces cannot disagree about what "healthy" means. A trivial
// query that only succeeds if the database is actually reachable, not just
// configured — the same probe `tests/integration/prisma.test.ts` uses to
// prove connectivity.
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
