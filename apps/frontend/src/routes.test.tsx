import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { api, aUser, ok } from '@/test/msw/api';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { writeToken } from '@/lib/token-storage';
import { AppRoutes } from './routes';

function signedIn() {
  writeToken('token', true);
  server.use(api.query('Me', () => ok({ me: aUser })));
  // The root route now renders the real dashboard, whose three sections all
  // fetch. MSW is strict, so every one of them needs a handler; `server.use`
  // prepends, so a later, more specific handler in a single test still wins.
  server.use(
    api.query('Summary', () =>
      ok({ summary: { totalBalance: 0, monthIncome: 0, monthExpense: 0 } }),
    ),
  );
  server.use(
    api.query('Transactions', () =>
      ok({ transactions: { items: [], totalCount: 0 } }),
    ),
  );
  server.use(api.query('Categories', () => ok({ categories: [] })));
}

describe('routing', () => {
  it('serves the login screen at / when signed out', () => {
    renderWithProviders(<AppRoutes />, { route: '/' });
    expect(
      screen.getByRole('heading', { name: 'Fazer login' }),
    ).toBeInTheDocument();
  });

  it('serves the dashboard at / when signed in', async () => {
    signedIn();
    renderWithProviders(<AppRoutes />, { route: '/' });
    // The dashboard has no page heading of its own, and the deleted
    // placeholder rendered one, so the panels are what identifies the real
    // DashboardPage.
    expect(
      await screen.findByRole('region', { name: 'Transações recentes' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Categorias' }),
    ).toBeInTheDocument();
  });

  it('redirects a private route to / when signed out', () => {
    renderWithProviders(<AppRoutes />, { route: '/transactions' });
    expect(
      screen.getByRole('heading', { name: 'Fazer login' }),
    ).toBeInTheDocument();
  });

  it('serves the transactions page at /transactions when signed in', async () => {
    signedIn();
    server.use(
      api.query('Transactions', () =>
        ok({
          transactions: { items: [], totalCount: 0 },
        }),
      ),
    );
    server.use(api.query('Categories', () => ok({ categories: [] })));
    renderWithProviders(<AppRoutes />, { route: '/transactions' });
    expect(
      await screen.findByRole('heading', { name: 'Transações' }),
    ).toBeInTheDocument();
  });

  it('redirects /categories to / when signed out', () => {
    renderWithProviders(<AppRoutes />, { route: '/categories' });
    expect(
      screen.getByRole('heading', { name: 'Fazer login' }),
    ).toBeInTheDocument();
  });

  it('redirects the sign up route to / when signed in', async () => {
    signedIn();
    renderWithProviders(<AppRoutes />, { route: '/signup' });
    expect(
      await screen.findByRole('region', { name: 'Transações recentes' }),
    ).toBeInTheDocument();
  });

  it('serves the sign up screen when signed out', () => {
    renderWithProviders(<AppRoutes />, { route: '/signup' });
    expect(
      screen.getByRole('heading', { name: 'Criar conta' }),
    ).toBeInTheDocument();
  });

  it('shows the top bar on a private route and not on a public one', async () => {
    renderWithProviders(<AppRoutes />, { route: '/' });
    expect(
      screen.queryByRole('navigation', { name: 'Principal' }),
    ).not.toBeInTheDocument();

    signedIn();
    renderWithProviders(<AppRoutes />, { route: '/profile' });
    expect(
      await screen.findByRole('navigation', { name: 'Principal' }),
    ).toBeInTheDocument();
  });
});
