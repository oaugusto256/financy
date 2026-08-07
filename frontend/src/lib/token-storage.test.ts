import { beforeEach, describe, expect, it } from 'vitest';
import { clearToken, readToken, writeToken } from './token-storage';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('token storage', () => {
  it('returns null when nothing is stored', () => {
    expect(readToken()).toBeNull();
  });

  it('persists across sessions when remember is true', () => {
    writeToken('abc', true);

    expect(localStorage.getItem('financy.token')).toBe('abc');
    expect(sessionStorage.getItem('financy.token')).toBeNull();
    expect(readToken()).toBe('abc');
  });

  it('dies with the tab when remember is false', () => {
    writeToken('abc', false);

    expect(sessionStorage.getItem('financy.token')).toBe('abc');
    expect(localStorage.getItem('financy.token')).toBeNull();
    expect(readToken()).toBe('abc');
  });

  it('does not leave a stale token in the other store', () => {
    writeToken('remembered', true);
    writeToken('temporary', false);

    expect(localStorage.getItem('financy.token')).toBeNull();
    expect(readToken()).toBe('temporary');
  });

  it('clears both stores', () => {
    writeToken('abc', true);
    clearToken();

    expect(readToken()).toBeNull();
    expect(localStorage.getItem('financy.token')).toBeNull();
    expect(sessionStorage.getItem('financy.token')).toBeNull();
  });
});
