import type { GraphQLContext } from '../../context.js';
import { requireUser } from '../../shared/auth-guard.js';
import { getUser, signIn, signUp, updateProfile } from './service.js';

export const authResolvers = {
  Query: {
    me: (_parent: unknown, _args: unknown, context: GraphQLContext) =>
      getUser(requireUser(context)),
  },

  Mutation: {
    signUp: (_parent: unknown, { input }: { input: unknown }) => signUp(input),

    signIn: (_parent: unknown, { input }: { input: unknown }) => signIn(input),

    updateProfile: (
      _parent: unknown,
      { input }: { input: unknown },
      context: GraphQLContext,
    ) => updateProfile(requireUser(context), input),
  },
};
