import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import DataLoader from 'dataloader';
import { createContext } from '../../src/context.js';
import { signToken } from '../../src/shared/jwt.js';

function requestWith(authorization?: string) {
  return { headers: authorization ? { authorization } : {} } as Request;
}

// DataLoader instances hold internal caches and are never deeply equal to one
// another, even with identical config, so `userId` and `loaders` are asserted
// separately rather than comparing the whole context with `toEqual`.
describe('createContext', () => {
  it('resolves a valid bearer token to its user id', async () => {
    const token = await signToken('user-1');
    const context = await createContext({
      req: requestWith(`Bearer ${token}`),
    });

    expect(context.userId).toBe('user-1');
    expect(context.loaders.categoryTotals).toBeInstanceOf(DataLoader);
  });

  it('has no user when the header is absent', async () => {
    const context = await createContext({ req: requestWith() });

    expect(context.userId).toBeNull();
    expect(context.loaders.categoryTotals).toBeInstanceOf(DataLoader);
  });

  it('has no user when the scheme is not Bearer', async () => {
    const token = await signToken('user-1');
    const context = await createContext({ req: requestWith(`Basic ${token}`) });

    expect(context.userId).toBeNull();
    expect(context.loaders.categoryTotals).toBeInstanceOf(DataLoader);
  });

  it('has no user when the token is garbage', async () => {
    const context = await createContext({
      req: requestWith('Bearer not-a-token'),
    });

    expect(context.userId).toBeNull();
    expect(context.loaders.categoryTotals).toBeInstanceOf(DataLoader);
  });
});
