import { GraphQLError } from 'graphql';

/** The codes in `backend.md` section 7. The frontend switches on these. */
export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  NOT_FOUND: 'NOT_FOUND',
  BAD_USER_INPUT: 'BAD_USER_INPUT',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
} as const;

function graphqlError(
  code: (typeof ErrorCode)[keyof typeof ErrorCode],
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
