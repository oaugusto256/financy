import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StyleGuide } from './StyleGuide';
import {
  CATEGORY_COLOR_VALUES,
  CATEGORY_ICON_VALUES,
} from '@/lib/category-tokens';

function renderStyleGuide() {
  return render(
    <MemoryRouter>
      <StyleGuide />
    </MemoryRouter>,
  );
}

// The page exists so that drift from the Figma Style Guide is visible in one
// look. This test does not check appearance — it checks that every primitive
// still mounts, so the page cannot quietly become a blank screen between the
// slices that rely on it.
describe('StyleGuide', () => {
  it('renders a section for every primitive', () => {
    renderStyleGuide();

    for (const title of [
      'Button',
      'Icon Button',
      'Input',
      'Checkbox',
      'Tag',
      'Category Badge',
      'Type Indicator',
      'Avatar',
      'Stat Card',
      'Pagination',
      'Dialog',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('shows every category color and icon', () => {
    const { container } = renderStyleGuide();

    for (const color of CATEGORY_COLOR_VALUES) {
      expect(screen.getByText(color)).toBeInTheDocument();
    }

    // One badge per icon token, plus the neutral fallback.
    const badges = container.querySelectorAll('.rounded-lg.size-9, .size-9');
    expect(badges.length).toBeGreaterThanOrEqual(
      CATEGORY_ICON_VALUES.length + 1,
    );
  });

  it('opens the dialog from the page', async () => {
    renderStyleGuide();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Abrir diálogo' }),
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Nova transação');
  });
});
