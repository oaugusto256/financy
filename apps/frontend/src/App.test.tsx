import { render, screen } from '@testing-library/react';
import { App } from './App';

// The root path serves the login screen with no session, so this asserts the
// public shell rather than a page heading: which screen the root serves is
// routes.test.tsx's subject, and asserting it here only doubles the churn.
it('renders the public shell at the root path when signed out', () => {
  render(<App />);
  expect(
    screen.queryByRole('navigation', { name: 'Principal' }),
  ).not.toBeInTheDocument();
});
