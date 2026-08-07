import { GraphQLError } from 'graphql';

/** The codes in `backend.md` section 7. The frontend switches on these. */
export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  NOT_FOUND: 'NOT_FOUND',
  BAD_USER_INPUT: 'BAD_USER_INPUT',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
} as const;

export type DeliberateErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * What the client is told when the server raised an error it did not intend.
 * Portuguese, like every other message here: it is rendered to the user.
 */
export const INTERNAL_ERROR_MESSAGE = 'Erro interno do servidor';

const DELIBERATE_CODES: ReadonlySet<string> = new Set(Object.values(ErrorCode));

/**
 * True for the codes above — the ones this server raises on purpose, whose
 * message was written for the person reading it. Anything else reaching the
 * client is an accident and must not describe our internals.
 */
export function isDeliberateErrorCode(code: unknown): boolean {
  return typeof code === 'string' && DELIBERATE_CODES.has(code);
}

function graphqlError(
  code: DeliberateErrorCode,
  message: string,
  extensions: Record<string, unknown> = {},
): GraphQLError {
  return new GraphQLError(message, { extensions: { code, ...extensions } });
}

export const unauthenticated = () =>
  graphqlError(ErrorCode.UNAUTHENTICATED, 'Autenticação obrigatória');

export const notFound = (what = 'Recurso') =>
  graphqlError(ErrorCode.NOT_FOUND, `${what} não encontrado`);

export const badUserInput = (
  message: string,
  fieldErrors: Record<string, string[]> = {},
) => graphqlError(ErrorCode.BAD_USER_INPUT, message, { fieldErrors });

export const emailAlreadyExists = () =>
  graphqlError(ErrorCode.EMAIL_ALREADY_EXISTS, 'Este e-mail já está em uso');

export const invalidCredentials = () =>
  graphqlError(ErrorCode.INVALID_CREDENTIALS, 'E-mail ou senha incorretos');
