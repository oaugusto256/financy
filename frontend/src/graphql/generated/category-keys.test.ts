import { describe, expect, it } from 'vitest';
import {
  useCategoriesQuery,
  useCategoryStatsQuery,
} from '@/graphql/generated/graphql';
import type { CategoryColor, CategoryIcon } from '@/graphql/generated/graphql';
import type {
  CategoryColor as TokenColor,
  CategoryIcon as TokenIcon,
} from '@/lib/category-tokens';

// The mutations invalidate by these keys. A rename in codegen output that goes
// unnoticed turns every invalidation into a silent no-op.
describe('category query keys', () => {
  it('keys the categories list', () => {
    expect(useCategoriesQuery.getKey()).toEqual(['Categories']);
  });

  it('keys the stats', () => {
    expect(useCategoryStatsQuery.getKey()).toEqual(['CategoryStats']);
  });

  it('generates icon and color as the same unions the theme uses', () => {
    // Assignability in both directions: a compile error here means the SDL and
    // the token table have drifted apart.
    const icon: TokenIcon = 'UTENSILS' as CategoryIcon;
    const color: TokenColor = 'GREEN' as CategoryColor;
    const backIcon: CategoryIcon = icon;
    const backColor: CategoryColor = color;

    expect([backIcon, backColor]).toEqual(['UTENSILS', 'GREEN']);
  });
});
