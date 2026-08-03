import { describe, expect, it } from 'vitest';
import {
  CATEGORY_COLORS,
  CATEGORY_COLOR_LABELS,
  CATEGORY_COLOR_VALUES,
  CATEGORY_ICONS,
  CATEGORY_ICON_LABELS,
  CATEGORY_ICON_VALUES,
} from './category-tokens';

describe('category tokens', () => {
  it('offers the seven colors from the design', () => {
    expect(CATEGORY_COLOR_VALUES).toEqual([
      'GREEN',
      'BLUE',
      'PURPLE',
      'PINK',
      'RED',
      'ORANGE',
      'YELLOW',
    ]);
  });

  it('offers the sixteen icons from the design', () => {
    expect(CATEGORY_ICON_VALUES).toHaveLength(16);
  });

  it('maps every color to a background, text and icon class', () => {
    for (const color of CATEGORY_COLOR_VALUES) {
      const classes = CATEGORY_COLORS[color];
      expect(classes.bg).toBeTruthy();
      expect(classes.text).toBeTruthy();
      expect(classes.icon).toBeTruthy();
    }
  });

  it('maps every icon token to a component', () => {
    for (const icon of CATEGORY_ICON_VALUES) {
      expect(CATEGORY_ICONS[icon]).toBeTypeOf('object');
    }
  });
});

describe('token labels', () => {
  it('labels every icon', () => {
    for (const token of CATEGORY_ICON_VALUES) {
      expect(CATEGORY_ICON_LABELS[token]).toBeTruthy();
    }
  });

  it('labels every color', () => {
    for (const token of CATEGORY_COLOR_VALUES) {
      expect(CATEGORY_COLOR_LABELS[token]).toBeTruthy();
    }
  });
});
