import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ColorPicker } from '@/components/ui/ColorPicker';

function registration(onChange = vi.fn()) {
  return { name: 'color', onChange, onBlur: vi.fn(), ref: vi.fn() };
}

describe('ColorPicker', () => {
  it('renders one radio per color family', () => {
    render(
      <ColorPicker legend="Cor" value="GREEN" registration={registration()} />,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(7);
  });

  it('labels every swatch in Portuguese and marks the selected one', () => {
    render(
      <ColorPicker legend="Cor" value="GREEN" registration={registration()} />,
    );

    expect(screen.getByRole('radio', { name: 'Verde' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Roxo' })).not.toBeChecked();
  });

  it('reports a change through the registration', async () => {
    const onChange = vi.fn();
    render(
      <ColorPicker
        legend="Cor"
        value="GREEN"
        registration={registration(onChange)}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Vermelho' }));

    expect(onChange).toHaveBeenCalled();
  });
});
