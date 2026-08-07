import type { GraphQLContext } from '../context.js';
import { unauthenticated } from './errors.js';

/**
 * The single entry point to a user id. Every authenticated resolver starts
 * here, so no resolver has the option of reading `context.userId` and
 * forgetting to check it.
 */
export function requireUser(context: GraphQLContext): string {
  if (!context.userId) throw unauthenticated();
  return context.userId;
}
