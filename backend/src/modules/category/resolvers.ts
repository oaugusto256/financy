import type { Resolvers } from '../../graphql/generated/resolvers.js';
import { requireUser } from '../../shared/auth-guard.js';
import {
  createCategory,
  deleteCategory,
  getCategoryStats,
  listCategories,
  updateCategory,
} from './service.js';

export const categoryResolvers: Resolvers = {
  Query: {
    categories: (_parent, _args, context) =>
      listCategories(requireUser(context)),
    categoryStats: (_parent, _args, context) =>
      getCategoryStats(requireUser(context)),
  },

  Mutation: {
    createCategory: (_parent, { input }, context) =>
      createCategory(requireUser(context), input),
    updateCategory: (_parent, { id, input }, context) =>
      updateCategory(requireUser(context), id, input),
    deleteCategory: (_parent, { id }, context) =>
      deleteCategory(requireUser(context), id),
  },

  Category: {
    // Through the loader, not a query per card: twelve cards on the page cost
    // one grouped aggregate.
    transactionCount: async (category, _args, context) =>
      (await context.loaders.categoryTotals.load(category.id)).transactionCount,
    totalAmount: async (category, _args, context) =>
      (await context.loaders.categoryTotals.load(category.id)).totalAmount,
  },
};
