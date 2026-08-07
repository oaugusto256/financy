import type { Request } from 'express';
import { verifyToken } from './shared/jwt.js';
import { createLoaders, type Loaders } from './shared/dataloaders.js';

export interface GraphQLContext {
  userId: string | null;
  loaders: Loaders;
}

const BEARER = /^Bearer (.+)$/;

/**
 * Resolves the bearer token into a user id exactly once per request. A missing,
 * malformed or expired token produces a context with no user rather than an
 * error: whether that is allowed is the resolver's decision, not the
 * transport's — `signIn` is reached without a token by definition.
 *
 * The loaders are built here, after the user is known, so each request gets its
 * own cache scoped to its own caller. Sharing one across requests would serve a
 * cached total to the next person through the door.
 */
export async function createContext({
  req,
}: {
  req: Request;
}): Promise<GraphQLContext> {
  const header = req.headers.authorization;
  const match = header ? BEARER.exec(header) : null;
  const userId = match?.[1] ? await verifyToken(match[1]) : null;

  return { userId, loaders: createLoaders(userId) };
}
