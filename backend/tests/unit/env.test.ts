import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/shared/env.js';

const valid = {
  DATABASE_URL: 'file:./dev.db',
  JWT_SECRET: 'a-secret-that-is-long-enough-for-hs256',
  PORT: '4000',
  CORS_ORIGIN: 'http://localhost:5173',
  NODE_ENV: 'development',
};

describe('parseEnv', () => {
  it('parses a valid environment', () => {
    expect(parseEnv(valid)).toEqual({
      DATABASE_URL: 'file:./dev.db',
      JWT_SECRET: 'a-secret-that-is-long-enough-for-hs256',
      PORT: 4000,
      CORS_ORIGIN: 'http://localhost:5173',
      NODE_ENV: 'development',
    });
  });

  it('coerces PORT to a number', () => {
    expect(parseEnv(valid).PORT).toBe(4000);
  });

  it('defaults PORT when absent', () => {
    const { PORT: _PORT, ...rest } = valid;
    expect(parseEnv(rest).PORT).toBe(4000);
  });

  it('throws when NODE_ENV is missing', () => {
    // Deliberately not defaulted: a deploy that omits it would otherwise be
    // handed the development posture silently.
    expect(() => parseEnv({ ...valid, NODE_ENV: undefined })).toThrow(
      /NODE_ENV/,
    );
  });

  it('throws when NODE_ENV is not one of the three known values', () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('throws when JWT_SECRET is missing', () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: undefined })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('throws when JWT_SECRET is empty', () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET is shorter than 32 characters', () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: 'a'.repeat(31) })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: undefined })).toThrow(
      /DATABASE_URL/,
    );
  });
});
