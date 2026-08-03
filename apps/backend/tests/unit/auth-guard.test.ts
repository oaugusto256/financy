import { describe, expect, it } from 'vitest';
import { requireUser } from '../../src/shared/auth-guard.js';

describe('requireUser', () => {
  it('returns the user id from an authenticated context', () => {
    expect(requireUser({ userId: 'user-1' })).toBe('user-1');
  });

  it('throws UNAUTHENTICATED when there is no user', () => {
    expect(() => requireUser({ userId: null })).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      }),
    );
  });
});
