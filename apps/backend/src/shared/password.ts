import { hash, verify } from '@node-rs/argon2';

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(
  hashed: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    // A stored value that is not a valid argon2 encoding is a failed login,
    // not a crash. Callers cannot tell the difference and should not have to.
    return false;
  }
}
