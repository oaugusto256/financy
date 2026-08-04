import { DateTimeISOResolver } from 'graphql-scalars';
import type { Resolvers } from './graphql/generated/resolvers.js';
import { authTypeDefs } from './modules/auth/schema.js';
import { authResolvers } from './modules/auth/resolvers.js';
import { categoryTypeDefs } from './modules/category/schema.js';
import { categoryResolvers } from './modules/category/resolvers.js';

// `Mutation` no longer needs a placeholder field: the category module extends
// it with three real ones.
const rootTypeDefs = /* GraphQL */ `
  scalar DateTime

  type Query {
    health: String!
  }

  type Mutation
`;

export const typeDefs = [rootTypeDefs, authTypeDefs, categoryTypeDefs];

// Explicitly typed: an inferred object type keeps `Category`'s `| undefined`
// (from the optional field access below) as part of a required key, which
// then fails ApolloServer's index-signature check. Annotating with the
// generated `Resolvers` type makes it a true optional property instead.
export const resolvers: Resolvers = {
  DateTime: DateTimeISOResolver,

  Query: {
    health: () => 'ok',
    ...(authResolvers.Query ?? {}),
    ...(categoryResolvers.Query ?? {}),
  },

  Mutation: {
    ...(authResolvers.Mutation ?? {}),
    ...(categoryResolvers.Mutation ?? {}),
  },

  Category: categoryResolvers.Category,
};
