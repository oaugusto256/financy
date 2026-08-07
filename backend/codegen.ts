import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  // The SDL is plucked out of the /* GraphQL */ template literals in these
  // files. That is why the module SDL lives in schema.ts rather than in a
  // .graphql file: no build step has to copy it into dist.
  schema: ['src/schema.ts', 'src/modules/**/schema.ts'],
  generates: {
    'src/graphql/generated/resolvers.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        contextType: '../../context.js#GraphQLContext',
        mappers: {
          User: '@prisma/client#User as UserModel',
          // The parent of transactionCount and totalAmount is a database row,
          // not the GraphQL shape — those two fields do not exist on it.
          Category: '@prisma/client#Category as CategoryModel',
          // Same reason as Category: the parent of the `category` field is a
          // database row, which has a categoryId and no category.
          Transaction: '@prisma/client#Transaction as TransactionModel',
        },
        scalars: { DateTime: 'Date' },
        useTypeImports: true,
      },
    },
    'schema.graphql': {
      plugins: ['schema-ast'],
    },
  },
};

export default config;
