import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelError } from '@/components/ui/PanelError';

describe('PanelError', () => {
  it('announces itself', () => {
    // Without role="alert" a failed refetch changes the screen and says
    // nothing.
    render(
      <PanelError message="Não foi possível carregar" onRetry={vi.fn()} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar',
    );
  });

  it('offers a retry', async () => {
    const onRetry = vi.fn();
    render(<PanelError message="Falhou" onRetry={onRetry} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
