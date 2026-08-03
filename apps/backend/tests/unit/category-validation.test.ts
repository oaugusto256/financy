import { describe, expect, it } from 'vitest';
import { parseInput } from '../../src/modules/auth/validation.js';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../../src/modules/category/validation.js';

const valid = {
  name: 'Mercado',
  description: 'Compras da semana',
  icon: 'SHOPPING_CART',
  color: 'GREEN',
};

describe('createCategorySchema', () => {
  it('accepts a complete category', () => {
    expect(parseInput(createCategorySchema, valid)).toEqual(valid);
  });

  it('trims the name', () => {
    const parsed = parseInput(createCategorySchema, {
      ...valid,
      name: '  Mercado  ',
    });

    expect(parsed.name).toBe('Mercado');
  });

  it('rejects a name that is only whitespace', () => {
    expect(() =>
      parseInput(createCategorySchema, { ...valid, name: '   ' }),
    ).toThrow('O nome é obrigatório');
  });

  it('rejects a name longer than 50 characters', () => {
    expect(() =>
      parseInput(createCategorySchema, { ...valid, name: 'a'.repeat(51) }),
    ).toThrow('O nome deve ter no máximo 50 caracteres');
  });

  it('rejects a description longer than 200 characters', () => {
    expect(() =>
      parseInput(createCategorySchema, {
        ...valid,
        description: 'a'.repeat(201),
      }),
    ).toThrow('A descrição deve ter no máximo 200 caracteres');
  });

  it('turns an omitted or empty description into null', () => {
    expect(
      parseInput(createCategorySchema, { ...valid, description: '' })
        .description,
    ).toBeNull();
    const { description, ...withoutDescription } = valid;
    expect(description).toBe('Compras da semana');
    expect(
      parseInput(createCategorySchema, withoutDescription).description,
    ).toBeNull();
  });

  it('rejects an icon outside the sixteen tokens', () => {
    expect(() =>
      parseInput(createCategorySchema, { ...valid, icon: 'ROCKET' }),
    ).toThrow('Selecione um ícone válido');
  });

  it('rejects a color outside the seven tokens', () => {
    expect(() =>
      parseInput(createCategorySchema, { ...valid, color: 'TEAL' }),
    ).toThrow('Selecione uma cor válida');
  });

  it('names the failing field so the frontend can render it inline', () => {
    try {
      parseInput(createCategorySchema, { ...valid, name: '' });
      throw new Error('should have thrown');
    } catch (error) {
      const extensions = (
        error as { extensions?: { fieldErrors?: Record<string, string[]> } }
      ).extensions;
      expect(extensions?.fieldErrors?.name).toContain('O nome é obrigatório');
    }
  });
});

describe('updateCategorySchema', () => {
  it('accepts a partial update', () => {
    expect(parseInput(updateCategorySchema, { name: 'Alimentação' })).toEqual({
      name: 'Alimentação',
    });
  });

  it('accepts an empty object as a no-op', () => {
    expect(parseInput(updateCategorySchema, {})).toEqual({});
  });

  it('distinguishes an absent description from an explicit null', () => {
    // Absent means "leave it alone", null means "clear it". Collapsing the two
    // would wipe the description on every icon change. The service branches on
    // `!== undefined`, so that is what this asserts — whether zod keeps the key
    // with an undefined value is its business.
    expect(
      parseInput(updateCategorySchema, { icon: 'BUS' }).description,
    ).toBeUndefined();
    expect(parseInput(updateCategorySchema, { description: null })).toEqual({
      description: null,
    });
    expect(parseInput(updateCategorySchema, { description: '' })).toEqual({
      description: null,
    });
  });

  it('applies the same limits as creation', () => {
    expect(() =>
      parseInput(updateCategorySchema, { name: 'a'.repeat(51) }),
    ).toThrow('O nome deve ter no máximo 50 caracteres');
  });
});
