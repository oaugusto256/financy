import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IconPicker } from '@/components/ui/IconPicker';
import { CATEGORY_ICON_VALUES } from '@/lib/category-tokens';

describe('IconPicker', () => {
  it('renders one radio per token', () => {
    render(
      <IconPicker
        legend="Ícone"
        name="icon"
        value="WALLET"
        onChange={vi.fn()}
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
        name="icon"
        value="WALLET"
        onChange={vi.fn()}
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
        name="icon"
        value="WALLET"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('group', { name: 'Ícone' })).toBeInTheDocument();
  });

  it('reports the chosen token', async () => {
    const onChange = vi.fn();
    render(
      <IconPicker
        legend="Ícone"
        name="icon"
        value="WALLET"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Ônibus' }));

    expect(onChange).toHaveBeenCalledWith('BUS');
  });
});
