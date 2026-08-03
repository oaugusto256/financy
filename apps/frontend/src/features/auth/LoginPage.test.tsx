import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api, aUser, graphqlError, ok } from '@/test/msw/api';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { AppRoutes } from '@/routes';

async function fillAndSubmit(
  email = 'ana@exemplo.com',
  password = 'uma-senha-boa',
) {
  await userEvent.type(screen.getByLabelText('E-mail'), email);
  await userEvent.type(screen.getByLabelText('Senha'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

function signInSucceeds() {
  server.use(
    api.mutation('SignIn', () =>
      ok({ signIn: { token: 'novo-token', user: aUser } }),
    ),
    api.query('Me', () => ok({ me: aUser })),
  );
}

describe('LoginPage', () => {
  it('signs in and lands on the dashboard', async () => {
    signInSucceeds();

    renderWithProviders(<AppRoutes />, { route: '/' });
    await fillAndSubmit();

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
  });

  it('stores the token in localStorage when Lembrar-me is checked', async () => {
    signInSucceeds();

    renderWithProviders(<AppRoutes />, { route: '/' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Lembrar-me' }));
    await fillAndSubmit();

    await waitFor(() =>
      expect(localStorage.getItem('financy.token')).toBe('novo-token'),
    );
    expect(sessionStorage.getItem('financy.token')).toBeNull();
  });

  it('stores the token in sessionStorage when it is not checked', async () => {
    signInSucceeds();

    renderWithProviders(<AppRoutes />, { route: '/' });
    await fillAndSubmit();

    await waitFor(() =>
      expect(sessionStorage.getItem('financy.token')).toBe('novo-token'),
    );
    expect(localStorage.getItem('financy.token')).toBeNull();
  });

  it('renders INVALID_CREDENTIALS as a form-level error', async () => {
    server.use(
      api.mutation('SignIn', () =>
        graphqlError('INVALID_CREDENTIALS', 'E-mail ou senha incorretos'),
      ),
    );

    renderWithProviders(<AppRoutes />, { route: '/' });
    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-mail ou senha incorretos',
    );
    // Not attached to a field: saying which one is wrong tells an attacker
    // which addresses have accounts.
    expect(screen.getByLabelText('E-mail')).not.toHaveAccessibleDescription(
      /incorret/i,
    );
    expect(
      screen.getByRole('heading', { name: 'Fazer login' }),
    ).toBeInTheDocument();
  });

  it('validates the email before sending anything', async () => {
    // No SignIn handler. onUnhandledRequest is 'error', so a request here
    // fails the test — which is the assertion.
    renderWithProviders(<AppRoutes />, { route: '/' });
    await fillAndSubmit('nao-e-um-email');

    expect(
      await screen.findByText('Informe um e-mail válido'),
    ).toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      api.mutation('SignIn', async () => {
        await held;
        return ok({ signIn: { token: 'novo-token', user: aUser } });
      }),
      api.query('Me', () => ok({ me: aUser })),
    );

    renderWithProviders(<AppRoutes />, { route: '/' });
    await fillAndSubmit();

    expect(
      await screen.findByRole('button', { name: 'Entrar' }),
    ).toBeDisabled();

    // Released and then awaited to completion. Left in flight, the mutation
    // resolves after this test ends and writes its token after the global
    // afterEach has cleared storage — a session leaking into the next test.
    release();
    await screen.findByRole('heading', { name: 'Dashboard' });
  });

  it('does not render a password recovery link', () => {
    renderWithProviders(<AppRoutes />, { route: '/' });
    expect(screen.queryByText(/recuperar senha/i)).not.toBeInTheDocument();
  });

  it('links to the sign up page', async () => {
    renderWithProviders(<AppRoutes />, { route: '/' });
    await userEvent.click(screen.getByRole('link', { name: 'Criar conta' }));

    expect(
      screen.getByRole('heading', { name: 'Criar conta' }),
    ).toBeInTheDocument();
  });
});
