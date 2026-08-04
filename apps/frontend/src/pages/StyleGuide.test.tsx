import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StyleGuide } from './StyleGuide';
import { ToastProvider } from '@/components/ui/Toast';
import {
  CATEGORY_COLOR_VALUES,
  CATEGORY_ICON_VALUES,
} from '@/lib/category-tokens';

function renderStyleGuide() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <StyleGuide />
      </MemoryRouter>
    </ToastProvider>,
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
    renderStyleGuide();

    // Scoped to the Tag section: the token text now also appears in the
    // Category Colors gallery added below, so an unscoped query matches both.
    const tagSection = screen
      .getByRole('heading', { name: 'Tag' })
      .closest('div');
    for (const color of CATEGORY_COLOR_VALUES) {
      expect(within(tagSection!).getByText(color)).toBeInTheDocument();
    }

    // Scoped to the Category Badge section: the unscoped selector also
    // matched the sixteen IconPicker cells, so the count stayed above the
    // threshold even if every CategoryBadge vanished.
    const badgeSection = screen
      .getByRole('heading', { name: 'Category Badge' })
      .closest('div');
    const badges = badgeSection!.querySelectorAll(
      '.rounded-lg.size-9, .size-9',
    );
    expect(badges.length).toBe(CATEGORY_ICON_VALUES.length + 1);
  });

  it('opens the dialog from the page', async () => {
    renderStyleGuide();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Abrir diálogo' }),
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Nova transação');
  });

  it('names every category icon beside the icon it draws', () => {
    renderStyleGuide();

    // The owner has to confirm these sixteen against Figma. A glyph with no
    // token name beside it cannot be confirmed or rejected.
    const gallery = screen.getByRole('list', { name: 'Ícones de categoria' });

    for (const token of CATEGORY_ICON_VALUES) {
      expect(within(gallery).getByText(token)).toBeInTheDocument();
    }
    expect(
      within(gallery).getByText('Carrinho de compras'),
    ).toBeInTheDocument();
  });

  it('names every category color beside the swatch it draws', () => {
    renderStyleGuide();

    const gallery = screen.getByRole('list', { name: 'Cores de categoria' });

    for (const token of CATEGORY_COLOR_VALUES) {
      expect(within(gallery).getByText(token)).toBeInTheDocument();
    }
    expect(within(gallery).getByText('Verde')).toBeInTheDocument();
  });
});
