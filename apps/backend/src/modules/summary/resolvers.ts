import type { Resolvers } from '../../graphql/generated/resolvers.js';
import { requireUser } from '../../shared/auth-guard.js';
import { getSummary } from './service.js';

export const summaryResolvers: Resolvers = {
  Query: {
    summary: (_parent, args, context) => getSummary(requireUser(context), args),
  },
};
