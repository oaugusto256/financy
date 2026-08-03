import { render, screen } from '@testing-library/react';
import { Tag } from './Tag';

describe('Tag', () => {
  it('renders its label', () => {
    render(<Tag color="BLUE">Alimentação</Tag>);
    expect(screen.getByText('Alimentação')).toBeInTheDocument();
  });

  it('applies the color family from the design', () => {
    render(<Tag color="BLUE">Alimentação</Tag>);
    const tag = screen.getByText('Alimentação');
    expect(tag).toHaveClass('bg-blue-light');
    expect(tag).toHaveClass('text-blue-dark');
  });

  it('falls back to neutral for an uncategorized transaction', () => {
    render(<Tag>Sem categoria</Tag>);
    const tag = screen.getByText('Sem categoria');
    expect(tag).toHaveClass('bg-gray-200');
    expect(tag).toHaveClass('text-gray-600');
  });
});
