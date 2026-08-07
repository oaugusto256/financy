import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api, aUser, graphqlError, ok } from '@/test/msw/api';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { writeToken } from '@/lib/token-storage';
import { AppRoutes } from '@/routes';

describe('an expired session', () => {
  it('returns to login when any operation answers UNAUTHENTICATED', async () => {
    writeToken('token', true);
    server.use(api.query('Me', () => ok({ me: aUser })));

    const { queryClient } = renderWithProviders(<AppRoutes />, {
      route: '/profile',
    });
    await screen.findByLabelText('Nome completo');

    // The seventh day passes with the tab still open.
    server.use(
      api.mutation('UpdateProfile', () => graphqlError('UNAUTHENTICATED')),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Salvar alterações' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Fazer login' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem('financy.token')).toBeNull();
      expect(sessionStorage.getItem('financy.token')).toBeNull();
    });
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .filter((query) => query.state.data !== undefined),
    ).toHaveLength(0);
  });
});
