export const typeDefs = /* GraphQL */ `
  type Query {
    health: String!
  }
`;

export const resolvers = {
  Query: {
    health: () => 'ok',
  },
};
