import { describe, expect, it } from 'vitest';
import {
  parseInput,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
} from '../../src/modules/auth/validation.js';
import {
  ANY_PASSWORD,
  BELOW_MINIMUM_PASSWORD,
  MINIMUM_LENGTH_PASSWORD,
  TOO_SHORT_PASSWORD,
  VALID_PASSWORD,
} from '../helpers/credentials.js';

const validSignUp = {
  name: 'Ana Souza',
  email: 'Ana@Exemplo.COM',
  password: VALID_PASSWORD,
};

describe('signUpSchema', () => {
  it('lowercases the email', () => {
    expect(parseInput(signUpSchema, validSignUp).email).toBe('ana@exemplo.com');
  });

  it('trims the name', () => {
    expect(
      parseInput(signUpSchema, { ...validSignUp, name: '  Ana  ' }).name,
    ).toBe('Ana');
  });

  it('rejects a name that is only whitespace', () => {
    expect(() =>
      parseInput(signUpSchema, { ...validSignUp, name: '   ' }),
    ).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'BAD_USER_INPUT' }),
      }),
    );
  });

  it('rejects a name over 100 characters', () => {
    expect(() =>
      parseInput(signUpSchema, { ...validSignUp, name: 'a'.repeat(101) }),
    ).toThrow(/BAD_USER_INPUT|nome|name/i);
  });

  it('rejects a malformed email', () => {
    expect(() =>
      parseInput(signUpSchema, { ...validSignUp, email: 'ana' }),
    ).toThrow();
  });

  it('rejects a password under 8 characters', () => {
    expect(() =>
      parseInput(signUpSchema, {
        ...validSignUp,
        password: BELOW_MINIMUM_PASSWORD,
      }),
    ).toThrow();
  });

  it('accepts a password of exactly 8 characters', () => {
    expect(
      parseInput(signUpSchema, {
        ...validSignUp,
        password: MINIMUM_LENGTH_PASSWORD,
      }),
    ).toBeTruthy();
  });

  it('names the failing field', () => {
    try {
      parseInput(signUpSchema, {
        ...validSignUp,
        password: TOO_SHORT_PASSWORD,
      });
      throw new Error('should have thrown');
    } catch (error) {
      const { extensions } = error as {
        extensions: { fieldErrors: Record<string, string[]> };
      };
      expect(Object.keys(extensions.fieldErrors)).toContain('password');
    }
  });
});

describe('signInSchema', () => {
  it('lowercases the email', () => {
    expect(
      parseInput(signInSchema, {
        email: 'ANA@EXEMPLO.COM',
        password: ANY_PASSWORD,
      }).email,
    ).toBe('ana@exemplo.com');
  });

  it('does not enforce a password length', () => {
    // Sign-in validates against the stored hash, not against today's rules. A
    // length check here would lock out an account created under an older one,
    // and would leak that the password is short before checking anything.
    expect(
      parseInput(signInSchema, {
        email: 'ana@exemplo.com',
        password: ANY_PASSWORD,
      }),
    ).toBeTruthy();
  });
});

describe('updateProfileSchema', () => {
  it('accepts a name', () => {
    expect(parseInput(updateProfileSchema, { name: 'Ana Souza' }).name).toBe(
      'Ana Souza',
    );
  });

  it('rejects an empty name', () => {
    expect(() => parseInput(updateProfileSchema, { name: '' })).toThrow();
  });

  it('ignores an email if one is supplied', () => {
    const parsed = parseInput(updateProfileSchema, {
      name: 'Ana',
      email: 'nova@exemplo.com',
    } as { name: string });
    expect(parsed).toEqual({ name: 'Ana' });
  });
});
