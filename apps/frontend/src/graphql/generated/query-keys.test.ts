import { describe, expect, it } from 'vitest';
import { useMeQuery } from './graphql';

describe('generated query keys', () => {
  it('keys the me query on its operation name', () => {
    expect(useMeQuery.getKey()).toEqual(['Me']);
  });
});
