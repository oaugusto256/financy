import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  // The committed artifact, not a running server: a fresh clone generates
  // without starting the backend, and CI does not need a database.
  schema: '../backend/schema.graphql',
  documents: ['src/graphql/operations/**/*.graphql'],
  generates: {
    'src/graphql/generated/graphql.ts': {
      // No `typescript` plugin alongside these two. As of codegen 6 the
      // operations plugin emits the input types an operation references on its
      // own, so adding the schema-wide plugin declares each of them twice.
      plugins: ['typescript-operations', 'typescript-react-query'],
      config: {
        reactQueryVersion: 5,
        fetcher: '@/lib/graphql-client#fetcher',
        exposeQueryKeys: true,
        exposeFetcher: true,
        // DateTime arrives as an ISO string and is formatted at render.
        // Deserializing to a Date here would mean the cache holds a value that
        // does not survive a structural clone.
        scalars: { DateTime: 'string' },
        // Union types rather than TypeScript enums, so a value from a query is
        // the same type as the CategoryIcon union in lib/category-tokens.ts.
        // A real enum would need a cast at every badge and tag.
        enumsAsTypes: true,
      },
    },
  },
};

export default config;
