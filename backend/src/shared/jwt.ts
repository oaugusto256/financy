import { SignJWT, jwtVerify } from 'jose';
import { env } from './env.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ALGORITHM = 'HS256';

/** Signs a 7-day token whose subject is the user id. */
export async function signToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

/** Returns the user id, or null for any token that is not valid right now. */
export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
    });
    return payload.sub ?? null;
  } catch {
    // Malformed, expired, wrong signature, wrong algorithm — all of them mean
    // the same thing to the caller: there is no authenticated user.
    return null;
  }
}
