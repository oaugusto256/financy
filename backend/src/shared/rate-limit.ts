import type { Request, Response } from 'express';
import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import {
  BREAK,
  Kind,
  parse,
  visit,
  type ArgumentNode,
  type ObjectValueNode,
} from 'graphql';
import { ErrorCode } from './errors.js';

export interface RateLimitConfig {
  /** Window of the per-IP limiter over the whole GraphQL endpoint. */
  windowMs: number;
  /** Requests one IP may make to the GraphQL endpoint within `windowMs`. */
  max: number;
  /** Window of the per-email limiter over `signIn` and `signUp`. */
  authWindowMs: number;
  /** Sign-in and sign-up attempts one address may collect within `authWindowMs`. */
  authMax: number;
}

/**
 * Portuguese, like every other message a user can see, and deliberately vague:
 * it says nothing about which limiter fired or how long is left beyond what the
 * `RateLimit` headers already state.
 */
const TOO_MANY_REQUESTS_MESSAGE =
  'Muitas tentativas. Aguarde alguns minutos e tente novamente.';

/**
 * Longest address the key is allowed to be. The memory store keeps one entry
 * per key until the window expires, so an attacker sending long unique
 * addresses would otherwise choose how much memory each entry costs. 320 is the
 * RFC 5321 maximum, so no address a real user could register is truncated.
 */
const MAX_KEY_LENGTH = 320;

const AUTH_FIELDS: ReadonlySet<string> = new Set(['signIn', 'signUp']);

function stringProperty(source: unknown, key: string): string | null {
  if (typeof source !== 'object' || source === null) return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function variablesOf(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) return {};
  const { variables } = body as Record<string, unknown>;
  if (typeof variables !== 'object' || variables === null) return {};
  return variables as Record<string, unknown>;
}

function emailFromObjectValue(
  node: ObjectValueNode,
  variables: Record<string, unknown>,
): string | null {
  for (const field of node.fields) {
    if (field.name.value !== 'email') continue;
    if (field.value.kind === Kind.STRING) return field.value.value;
    if (field.value.kind === Kind.VARIABLE) {
      return stringProperty(variables, field.value.name.value);
    }
  }
  return null;
}

/**
 * The address inside one argument of a `signIn`/`signUp` field. Both shapes the
 * schema allows are covered: the input object written into the document, and
 * the input object passed as a variable. Anything else yields null.
 */
function emailFromArgument(
  argument: ArgumentNode,
  variables: Record<string, unknown>,
): string | null {
  const isEmailArgument = argument.name.value === 'email';

  switch (argument.value.kind) {
    case Kind.STRING:
      return isEmailArgument ? argument.value.value : null;
    case Kind.OBJECT:
      return emailFromObjectValue(argument.value, variables);
    case Kind.VARIABLE: {
      const supplied = variables[argument.value.name.value];
      if (isEmailArgument) {
        return typeof supplied === 'string' ? supplied : null;
      }
      return stringProperty(supplied, 'email');
    }
    default:
      return null;
  }
}

/**
 * The address a request is trying to sign in or sign up with, or null if the
 * request is not one of those or does not carry a readable address.
 *
 * The document is parsed rather than pattern-matched because the address can be
 * written into the query text instead of the variables, and a limiter that only
 * read `variables.input.email` would be bypassed by moving it. Parsing is
 * skipped entirely unless the text mentions one of the two fields, so the
 * ordinary request pays a substring search and nothing more.
 *
 * Never throws. A body that is absent, not an object, or not parseable as
 * GraphQL returns null and is left to Apollo to reject — the per-IP limiter
 * still counted it.
 */
export function authEmailOf(body: unknown): string | null {
  const query = stringProperty(body, 'query');
  if (query === null) return null;
  if (!query.includes('signIn') && !query.includes('signUp')) return null;

  const variables = variablesOf(body);

  // Collected into an array rather than a closed-over variable so the value
  // survives narrowing: TypeScript does not track assignments made inside the
  // visitor.
  const found: string[] = [];

  try {
    visit(parse(query), {
      Field(node) {
        if (!AUTH_FIELDS.has(node.name.value)) return;
        for (const argument of node.arguments ?? []) {
          const email = emailFromArgument(argument, variables);
          if (email !== null) {
            found.push(email);
            return BREAK;
          }
        }
        return;
      },
    });
  } catch {
    return null;
  }

  const email = found[0];
  if (email === undefined) return null;

  // Lower-cased because `signIn` itself lower-cases the address before looking
  // it up, so `ana@` and `ANA@` are one account and must be one bucket.
  return email.trim().toLowerCase().slice(0, MAX_KEY_LENGTH);
}

/**
 * Computed once per request. `skip` and `keyGenerator` both need the address,
 * and parsing the document twice for every sign-in would double the only
 * expensive part of this.
 */
const emailByRequest = new WeakMap<Request, string | null>();

function authEmailOfRequest(req: Request): string | null {
  const cached = emailByRequest.get(req);
  if (cached !== undefined) return cached;

  const email = authEmailOf(req.body);
  emailByRequest.set(req, email);
  return email;
}

/**
 * The same body whichever limiter rejected, and — because neither limiter has
 * touched the database — the same body whether or not the address exists.
 * Shaped like a GraphQL error response so a client that only knows how to read
 * `errors[0].extensions.code` is not left guessing at a bare 429.
 */
function tooManyRequests(_req: Request, res: Response): void {
  res.status(429).json({
    errors: [
      {
        message: TOO_MANY_REQUESTS_MESSAGE,
        extensions: { code: ErrorCode.TOO_MANY_REQUESTS },
      },
    ],
  });
}

/**
 * Two limiters, mounted in this order ahead of Apollo.
 *
 * The per-IP one bounds the endpoint as a whole. On its own it is defeated by a
 * botnet spraying one guess per address, which is why the second exists: it is
 * keyed on the submitted address, so every attempt against one account counts
 * against one budget no matter where it came from.
 *
 * Both stores are in process memory. One process is what this deployment is; a
 * shared store is the change to make when it stops being.
 */
export function createRateLimiters(config: RateLimitConfig): {
  perIp: RateLimitRequestHandler;
  perEmail: RateLimitRequestHandler;
} {
  const perIp = rateLimit({
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: tooManyRequests,
  });

  const perEmail = rateLimit({
    windowMs: config.authWindowMs,
    limit: config.authMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Every request that is not a readable sign-in or sign-up passes through
    // untouched, so a user reading their dashboard never spends this budget.
    skip: (req) => authEmailOfRequest(req) === null,
    keyGenerator: (req) => authEmailOfRequest(req) ?? '',
    handler: tooManyRequests,
  });

  return { perIp, perEmail };
}
