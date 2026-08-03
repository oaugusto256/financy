import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';
import { verifyToken } from '../../src/shared/jwt.js';
import { verifyPassword } from '../../src/shared/password.js';
import {
  getUser,
  signIn,
  signUp,
  updateProfile,
} from '../../src/modules/auth/service.js';
import { resetDatabase } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';

beforeEach(resetDatabase);
afterAll(async () => {
  await prisma.$disconnect();
});

const codeIs = (code: string) =>
  expect.objectContaining({
    extensions: expect.objectContaining({ code }),
  });

describe('signUp', () => {
  it('creates the user and returns a usable token', async () => {
    const { token, user } = await signUp({
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      password: 'uma-senha-boa',
    });

    expect(user.name).toBe('Ana Souza');
    expect(await verifyToken(token)).toBe(user.id);
  });

  it('stores a hash, never the password', async () => {
    const { user } = await signUp({
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      password: 'uma-senha-boa',
    });

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.passwordHash).not.toBe('uma-senha-boa');
    expect(await verifyPassword(stored.passwordHash, 'uma-senha-boa')).toBe(
      true,
    );
  });

  it('normalizes the email to lowercase', async () => {
    const { user } = await signUp({
      name: 'Ana Souza',
      email: 'Ana@Exemplo.COM',
      password: 'uma-senha-boa',
    });

    expect(user.email).toBe('ana@exemplo.com');
  });

  it('rejects an email that is already registered', async () => {
    await createUser({ email: 'ana@exemplo.com' });

    await expect(
      signUp({
        name: 'Outra Ana',
        email: 'ana@exemplo.com',
        password: 'uma-senha-boa',
      }),
    ).rejects.toThrow(codeIs('EMAIL_ALREADY_EXISTS'));
  });

  it('rejects an email already registered in another case', async () => {
    await createUser({ email: 'ana@exemplo.com' });

    await expect(
      signUp({
        name: 'Outra Ana',
        email: 'ANA@EXEMPLO.COM',
        password: 'uma-senha-boa',
      }),
    ).rejects.toThrow(codeIs('EMAIL_ALREADY_EXISTS'));
  });

  it('rejects a short password', async () => {
    await expect(
      signUp({ name: 'Ana', email: 'ana@exemplo.com', password: 'curta' }),
    ).rejects.toThrow(codeIs('BAD_USER_INPUT'));
  });
});

describe('signIn', () => {
  it('returns a token for the right password', async () => {
    const { user, password } = await createUser();

    const result = await signIn({ email: user.email, password });

    expect(await verifyToken(result.token)).toBe(user.id);
  });

  it('accepts the email in any case', async () => {
    const { user, password } = await createUser({ email: 'ana@exemplo.com' });

    const result = await signIn({ email: 'ANA@Exemplo.com', password });

    expect(await verifyToken(result.token)).toBe(user.id);
  });

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    const { user } = await createUser();

    await expect(
      signIn({ email: user.email, password: 'senha-errada' }),
    ).rejects.toThrow(codeIs('INVALID_CREDENTIALS'));
  });

  it('rejects an unknown email with the same code and message', async () => {
    const { user } = await createUser();

    const wrongPassword = await signIn({
      email: user.email,
      password: 'senha-errada',
    }).catch((error: Error) => error);
    const unknownEmail = await signIn({
      email: 'ninguem@exemplo.com',
      password: 'senha-errada',
    }).catch((error: Error) => error);

    expect((unknownEmail as Error).message).toBe(
      (wrongPassword as Error).message,
    );
  });
});

describe('getUser', () => {
  it('returns the user', async () => {
    const { user } = await createUser();
    expect((await getUser(user.id)).id).toBe(user.id);
  });

  it('throws NOT_FOUND for an id that does not exist', async () => {
    await expect(getUser('missing')).rejects.toThrow(codeIs('NOT_FOUND'));
  });
});

describe('updateProfile', () => {
  it('changes the name', async () => {
    const { user } = await createUser({ name: 'Ana' });

    const updated = await updateProfile(user.id, { name: 'Ana Souza' });

    expect(updated.name).toBe('Ana Souza');
  });

  it('leaves the email untouched', async () => {
    const { user } = await createUser({ email: 'ana@exemplo.com' });

    const updated = await updateProfile(user.id, {
      name: 'Ana Souza',
      email: 'nova@exemplo.com',
    } as { name: string });

    expect(updated.email).toBe('ana@exemplo.com');
  });

  it('does not let one user rename another', async () => {
    const { user: ana } = await createUser({ name: 'Ana' });
    const { user: bruno } = await createUser({ name: 'Bruno' });

    await updateProfile(ana.id, { name: 'Ana Souza' });

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: bruno.id },
    });
    expect(stored.name).toBe('Bruno');
  });

  it('rejects an empty name', async () => {
    const { user } = await createUser();
    await expect(updateProfile(user.id, { name: '  ' })).rejects.toThrow(
      codeIs('BAD_USER_INPUT'),
    );
  });
});
