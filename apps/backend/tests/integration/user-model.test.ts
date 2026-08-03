import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';
import { resetDatabase } from '../helpers/db.js';

beforeEach(resetDatabase);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('the User model', () => {
  it('stores a user and generates an id and timestamps', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Ana Souza',
        email: 'ana@exemplo.com',
        passwordHash: 'hash',
      },
    });

    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('rejects a duplicate email', async () => {
    const data = {
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      passwordHash: 'hash',
    };
    await prisma.user.create({ data });

    await expect(prisma.user.create({ data })).rejects.toThrow();
  });
});
