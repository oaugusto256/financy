import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('parses a valid environment', () => {
    expect(
      parseEnv({ VITE_BACKEND_URL: 'http://localhost:4000/graphql' }),
    ).toEqual({ VITE_BACKEND_URL: 'http://localhost:4000/graphql' });
  });

  it('throws when the backend URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/VITE_BACKEND_URL/);
  });

  it('throws when the backend URL is not a URL', () => {
    expect(() => parseEnv({ VITE_BACKEND_URL: 'localhost' })).toThrow(
      /VITE_BACKEND_URL/,
    );
  });
});
