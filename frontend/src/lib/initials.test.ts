import { describe, expect, it } from 'vitest';
import { initialsFromName } from './initials';

describe('initialsFromName', () => {
  it('takes the first and last initials', () => {
    expect(initialsFromName('Conta teste')).toBe('CT');
  });

  it('uses one letter for a single name', () => {
    expect(initialsFromName('Otávio')).toBe('O');
  });

  it('ignores surrounding and repeated whitespace', () => {
    expect(initialsFromName('  Ana   Maria  Silva  ')).toBe('AS');
  });

  it('returns an empty string for an empty name', () => {
    expect(initialsFromName('   ')).toBe('');
  });
});
