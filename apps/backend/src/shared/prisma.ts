import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

// One client for the whole process. Prisma holds a connection pool, so a client
// per request would open connections faster than it closes them.
export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
