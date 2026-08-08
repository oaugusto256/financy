import { DateTimeISOResolver } from 'graphql-scalars';
import { isDatabaseReachable } from './shared/database-health.js';
import type { Resolvers } from './graphql/generated/resolvers.js';
import { authTypeDefs } from './modules/auth/schema.js';
import { authResolvers } from './modules/auth/resolvers.js';
import { categoryTypeDefs } from './modules/category/schema.js';
import { categoryResolvers } from './modules/category/resolvers.js';
import { transactionTypeDefs } from './modules/transaction/schema.js';
import { transactionResolvers } from './modules/transaction/resolvers.js';
import { summaryTypeDefs } from './modules/summary/schema.js';
import { summaryResolvers } from './modules/summary/resolvers.js';

// `Mutation` no longer needs a placeholder field: the category and
// transaction modules each extend it with real fields.
const rootTypeDefs = /* GraphQL */ `
  scalar DateTime

  type Query {
    health: String!
  }

  type Mutation
`;

export const typeDefs = [
  rootTypeDefs,
  authTypeDefs,
  categoryTypeDefs,
  transactionTypeDefs,
  summaryTypeDefs,
];

// Explicitly typed: an inferred object type keeps `Category`'s `| undefined`
// (from the optional field access below) as part of a required key, which
// then fails ApolloServer's index-signature check. Annotating with the
// generated `Resolvers` type makes it a true optional property instead.
export const resolvers: Resolvers = {
  DateTime: DateTimeISOResolver,

  Query: {
    // Shares the REST route's probe rather than answering unconditionally,
    // so the two health surfaces cannot disagree about what "healthy" means.
    // An unreachable database throws a plain (unexpected) error, which
    // `formatError` in app.ts masks like any other internal failure — the
    // point is that a caller sees an error instead of `data: { health: 'ok'
    // }`, not that the message names the cause.
    health: async () => {
      const healthy = await isDatabaseReachable();
      if (!healthy) throw new Error('Database unreachable');
      return 'ok';
    },
    ...(authResolvers.Query ?? {}),
    ...(categoryResolvers.Query ?? {}),
    ...(transactionResolvers.Query ?? {}),
    ...(summaryResolvers.Query ?? {}),
  },

  Mutation: {
    ...(authResolvers.Mutation ?? {}),
    ...(categoryResolvers.Mutation ?? {}),
    ...(transactionResolvers.Mutation ?? {}),
  },

  Category: categoryResolvers.Category,
  Transaction: transactionResolvers.Transaction,
};
