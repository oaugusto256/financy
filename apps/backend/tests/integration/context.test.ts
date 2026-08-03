import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { createContext } from '../../src/context.js';
import { signToken } from '../../src/shared/jwt.js';

function requestWith(authorization?: string) {
  return { headers: authorization ? { authorization } : {} } as Request;
}

describe('createContext', () => {
  it('resolves a valid bearer token to its user id', async () => {
    const token = await signToken('user-1');
    expect(await createContext({ req: requestWith(`Bearer ${token}`) })).toEqual(
      { userId: 'user-1' },
    );
  });

  it('has no user when the header is absent', async () => {
    expect(await createContext({ req: requestWith() })).toEqual({
      userId: null,
    });
  });

  it('has no user when the scheme is not Bearer', async () => {
    const token = await signToken('user-1');
    expect(await createContext({ req: requestWith(`Basic ${token}`) })).toEqual({
      userId: null,
    });
  });

  it('has no user when the token is garbage', async () => {
    expect(
      await createContext({ req: requestWith('Bearer not-a-token') }),
    ).toEqual({ userId: null });
  });
});
