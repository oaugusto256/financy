import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the dashboard route at the root path', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { name: 'Dashboard' }),
  ).toBeInTheDocument();
});
