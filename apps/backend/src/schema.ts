import { DateTimeISOResolver } from 'graphql-scalars';
import { authTypeDefs } from './modules/auth/schema.js';
import { authResolvers } from './modules/auth/resolvers.js';

const rootTypeDefs = /* GraphQL */ `
  scalar DateTime

  type Query {
    health: String!
  }

  type Mutation {
    _empty: Boolean
  }
`;

export const typeDefs = [rootTypeDefs, authTypeDefs];

export const resolvers = {
  DateTime: DateTimeISOResolver,

  Query: {
    health: () => 'ok',
    ...(authResolvers.Query ?? {}),
  },

  Mutation: {
    ...(authResolvers.Mutation ?? {}),
  },
};
