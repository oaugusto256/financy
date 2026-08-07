import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from '@/components/ui/Skeleton';

describe('Skeleton', () => {
  it('announces that something is loading', () => {
    // aria-label on a plain div is not reliably exposed. The old tests read the
    // attribute directly with getByLabelText, which passed against markup no
    // screen reader announced.
    render(<Skeleton label="Carregando transações" count={3} />);

    const status = screen.getByRole('status', {
      name: 'Carregando transações',
    });

    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it('renders one placeholder per count', () => {
    render(<Skeleton label="Carregando" count={4} />);

    expect(
      screen
        .getByRole('status')
        .querySelectorAll('[data-slot="skeleton-item"]'),
    ).toHaveLength(4);
  });
});
