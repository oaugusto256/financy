import type { Request } from 'express';
import { verifyToken } from './shared/jwt.js';

export interface GraphQLContext {
  userId: string | null;
}

const BEARER = /^Bearer (.+)$/;

/**
 * Resolves the bearer token into a user id exactly once per request. A missing,
 * malformed or expired token produces a context with no user rather than an
 * error: whether that is allowed is the resolver's decision, not the
 * transport's — `signIn` is reached without a token by definition.
 */
export async function createContext({
  req,
}: {
  req: Request;
}): Promise<GraphQLContext> {
  const header = req.headers.authorization;
  const match = header ? BEARER.exec(header) : null;
  if (!match?.[1]) return { userId: null };

  return { userId: await verifyToken(match[1]) };
}
