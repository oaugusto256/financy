import { describe, expect, it } from 'vitest';
import { ClientError } from 'graphql-request';
import { errorCodeOf, fieldErrorsOf } from './graphql-errors';

type ClientErrorResponse = ConstructorParameters<typeof ClientError>[0];

function clientError(extensions?: Record<string, unknown>) {
  // Cast because a real response carries headers, a body, and per-error
  // locations, paths and nodes that neither reader looks at. Spelling them out
  // here would assert nothing about either function.
  const response = {
    status: 200,
    errors: [{ message: 'Erro', ...(extensions ? { extensions } : {}) }],
  } as unknown as ClientErrorResponse;

  return new ClientError(response, { query: 'query {}' });
}

describe('errorCodeOf', () => {
  it('reads the code of the first error', () => {
    expect(errorCodeOf(clientError({ code: 'INVALID_CREDENTIALS' }))).toBe(
      'INVALID_CREDENTIALS',
    );
  });

  it('returns null when the error carries no extensions', () => {
    expect(errorCodeOf(clientError())).toBeNull();
  });

  it('returns null for a plain Error', () => {
    expect(errorCodeOf(new Error('caiu'))).toBeNull();
  });

  it('returns null for undefined', () => {
    // An error reader that throws while reading an error turns a handled
    // failure into a blank screen.
    expect(errorCodeOf(undefined)).toBeNull();
  });
});

describe('fieldErrorsOf', () => {
  it('reads the field errors of the first error', () => {
    expect(
      fieldErrorsOf(
        clientError({
          code: 'BAD_USER_INPUT',
          fieldErrors: { password: ['muito curta'] },
        }),
      ),
    ).toEqual({ password: ['muito curta'] });
  });

  it('returns an empty object when the error carries no extensions', () => {
    expect(fieldErrorsOf(clientError())).toEqual({});
  });

  it('returns an empty object for a plain Error', () => {
    expect(fieldErrorsOf(new Error('caiu'))).toEqual({});
  });

  it('returns an empty object for undefined', () => {
    expect(fieldErrorsOf(undefined)).toEqual({});
  });
});
