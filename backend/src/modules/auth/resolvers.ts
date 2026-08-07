import type { Resolvers } from '../../graphql/generated/resolvers.js';
import { requireUser } from '../../shared/auth-guard.js';
import { getUser, signIn, signUp, updateProfile } from './service.js';

export const authResolvers: Resolvers = {
  Query: {
    me: (_parent, _args, context) => getUser(requireUser(context)),
  },

  Mutation: {
    signUp: (_parent, { input }) => signUp(input),
    signIn: (_parent, { input }) => signIn(input),
    updateProfile: (_parent, { input }, context) =>
      updateProfile(requireUser(context), input),
  },
};
