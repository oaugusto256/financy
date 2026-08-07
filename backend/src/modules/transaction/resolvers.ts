import type { Resolvers } from '../../graphql/generated/resolvers.js';
import { requireUser } from '../../shared/auth-guard.js';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from './service.js';

export const transactionResolvers: Resolvers = {
  Query: {
    transactions: (_parent, args, context) =>
      listTransactions(requireUser(context), args),
  },

  Mutation: {
    createTransaction: (_parent, { input }, context) =>
      createTransaction(requireUser(context), input),
    updateTransaction: (_parent, { id, input }, context) =>
      updateTransaction(requireUser(context), id, input),
    deleteTransaction: (_parent, { id }, context) =>
      deleteTransaction(requireUser(context), id),
  },

  Transaction: {
    // Through the loader, not a query per row: ten rows cost one lookup.
    // Guarding on categoryId keeps a null out of the loader's key list, which
    // would otherwise be a cache entry for the string "null".
    category: (transaction, _args, context) =>
      transaction.categoryId
        ? context.loaders.categoryById.load(transaction.categoryId)
        : null,
  },
};
