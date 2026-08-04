import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IconPicker } from '@/components/ui/IconPicker';
import { CATEGORY_ICON_VALUES } from '@/lib/category-tokens';

function registration(onChange = vi.fn()) {
  // The shape React Hook Form's register() returns. Passing it through keeps
  // the inputs uncontrolled, which is why typing in the dialog does not
  // re-render the sixteen cells.
  return { name: 'icon', onChange, onBlur: vi.fn(), ref: vi.fn() };
}

describe('IconPicker', () => {
  it('renders one radio per token', () => {
    render(
      <IconPicker
        legend="Ícone"
        value="WALLET"
        registration={registration()}
      />,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(
      CATEGORY_ICON_VALUES.length,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(16);
  });

  it('labels every option in Portuguese', () => {
    render(
      <IconPicker
        legend="Ícone"
        value="WALLET"
        registration={registration()}
      />,
    );

    expect(
      screen.getByRole('radio', { name: 'Restaurante' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Carteira' })).toBeChecked();
  });

  it('groups the options under the legend', () => {
    render(
      <IconPicker
        legend="Ícone"
        value="WALLET"
        registration={registration()}
      />,
    );

    expect(screen.getByRole('group', { name: 'Ícone' })).toBeInTheDocument();
  });

  it('reports a change through the registration', async () => {
    const onChange = vi.fn();
    render(
      <IconPicker
        legend="Ícone"
        value="WALLET"
        registration={registration(onChange)}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Ônibus' }));

    expect(onChange).toHaveBeenCalled();
  });
});
