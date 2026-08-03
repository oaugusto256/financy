import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/shared/password.js';

describe('password hashing', () => {
  it('produces an argon2id hash, not the password', async () => {
    const hash = await hashPassword('uma-senha-boa');

    expect(hash).not.toBe('uma-senha-boa');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('produces a different hash each time', async () => {
    const [first, second] = await Promise.all([
      hashPassword('uma-senha-boa'),
      hashPassword('uma-senha-boa'),
    ]);

    expect(first).not.toBe(second);
  });

  it('verifies the correct password', async () => {
    const hash = await hashPassword('uma-senha-boa');
    expect(await verifyPassword(hash, 'uma-senha-boa')).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('uma-senha-boa');
    expect(await verifyPassword(hash, 'uma-senha-ruim')).toBe(false);
  });

  it('returns false rather than throwing on a malformed hash', async () => {
    expect(await verifyPassword('not-a-hash', 'uma-senha-boa')).toBe(false);
  });
});
