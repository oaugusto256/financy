import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/shared/env.js';

const valid = {
  DATABASE_URL: 'file:./dev.db',
  JWT_SECRET: 'a-secret-long-enough',
  PORT: '4000',
  CORS_ORIGIN: 'http://localhost:5173',
  NODE_ENV: 'development',
};

describe('parseEnv', () => {
  it('parses a valid environment', () => {
    expect(parseEnv(valid)).toEqual({
      DATABASE_URL: 'file:./dev.db',
      JWT_SECRET: 'a-secret-long-enough',
      PORT: 4000,
      CORS_ORIGIN: 'http://localhost:5173',
      NODE_ENV: 'development',
    });
  });

  it('coerces PORT to a number', () => {
    expect(parseEnv(valid).PORT).toBe(4000);
  });

  it('defaults PORT and NODE_ENV when absent', () => {
    const { PORT: _PORT, ...rest } = valid;
    const parsed = parseEnv({ ...rest, NODE_ENV: undefined });
    expect(parsed.PORT).toBe(4000);
    expect(parsed.NODE_ENV).toBe('development');
  });

  it('throws when JWT_SECRET is missing', () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: undefined })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('throws when JWT_SECRET is empty', () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: undefined })).toThrow(
      /DATABASE_URL/,
    );
  });
});
