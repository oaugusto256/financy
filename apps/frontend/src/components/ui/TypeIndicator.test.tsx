import { render, screen } from '@testing-library/react';
import { TypeIndicator } from './TypeIndicator';

describe('TypeIndicator', () => {
  it('labels income as Entrada', () => {
    render(<TypeIndicator type="INCOME" />);
    expect(screen.getByText('Entrada')).toHaveClass('text-success');
  });

  it('labels expense as Saída', () => {
    render(<TypeIndicator type="EXPENSE" />);
    expect(screen.getByText('Saída')).toHaveClass('text-danger');
  });
});
