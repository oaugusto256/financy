import { readFileSync } from 'node:fs';
import { buildSchema, lexicographicSortSchema, printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { typeDefs } from '../../src/schema.js';

/**
 * Sorted before printing. schema-ast writes the artifact lexicographically
 * while the SDL is printed in source order, so an unsorted comparison fails on
 * declaration order alone — which says nothing about whether the two schemas
 * differ.
 */
const normalize = (sdl: string) =>
  printSchema(lexicographicSortSchema(buildSchema(sdl)));

describe('the committed schema artifact', () => {
  it('matches the SDL the server actually serves', () => {
    const committed = readFileSync(
      new URL('../../schema.graphql', import.meta.url),
      'utf8',
    );

    expect(normalize(committed)).toBe(normalize(typeDefs.join('\n')));
  });
});
