import { prisma } from '../../src/shared/prisma.js';
import { hashPassword } from '../../src/shared/password.js';
import { VALID_PASSWORD } from './credentials.js';

let sequence = 0;

/** Creates a user directly, bypassing the service under test. */
export async function createUser(
  overrides: { name?: string; email?: string; password?: string } = {},
) {
  sequence += 1;
  const password = overrides.password ?? VALID_PASSWORD;
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? `Usuário ${sequence}`,
      email: overrides.email ?? `usuario${sequence}@exemplo.com`,
      passwordHash: await hashPassword(password),
    },
  });

  return { user, password };
}
