import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { signToken, verifyToken } from '../../src/shared/jwt.js';
import { env } from '../../src/shared/env.js';

describe('JWT', () => {
  it('round-trips a user id', async () => {
    const token = await signToken('user-1');
    expect(await verifyToken(token)).toBe('user-1');
  });

  it('returns null for a malformed token', async () => {
    expect(await verifyToken('not-a-token')).toBeNull();
  });

  it('returns null for a token signed with another secret', async () => {
    const forged = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode('a-different-secret'));

    expect(await verifyToken(forged)).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const expired = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(env.JWT_SECRET));

    expect(await verifyToken(expired)).toBeNull();
  });
});
