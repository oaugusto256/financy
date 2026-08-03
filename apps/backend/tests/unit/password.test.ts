import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/shared/password.js';
import { VALID_PASSWORD, WRONG_PASSWORD } from '../helpers/credentials.js';

describe('password hashing', () => {
  it('produces an argon2id hash, not the password', async () => {
    const hash = await hashPassword(VALID_PASSWORD);

    expect(hash).not.toBe(VALID_PASSWORD);
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('produces a different hash each time', async () => {
    const [first, second] = await Promise.all([
      hashPassword(VALID_PASSWORD),
      hashPassword(VALID_PASSWORD),
    ]);

    expect(first).not.toBe(second);
  });

  it('verifies the correct password', async () => {
    const hash = await hashPassword(VALID_PASSWORD);
    expect(await verifyPassword(hash, VALID_PASSWORD)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword(VALID_PASSWORD);
    expect(await verifyPassword(hash, WRONG_PASSWORD)).toBe(false);
  });

  it('returns false rather than throwing on a malformed hash', async () => {
    expect(await verifyPassword('not-a-hash', VALID_PASSWORD)).toBe(false);
  });
});
