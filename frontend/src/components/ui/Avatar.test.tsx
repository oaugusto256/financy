import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('shows the initials and keeps the full name available', () => {
    render(<Avatar name="Conta teste" />);
    expect(screen.getByText('CT')).toBeInTheDocument();
    expect(screen.getByTitle('Conta teste')).toBeInTheDocument();
  });
});
