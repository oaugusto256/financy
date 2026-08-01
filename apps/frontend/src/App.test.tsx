import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the application name', () => {
  render(<App />);
  expect(screen.getByText('Financy')).toBeInTheDocument();
});
