import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api, aUser, graphqlError, ok } from '@/test/msw/api';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { AppRoutes } from '@/routes';

async function fillAndSubmit({
  name = 'Ana Souza',
  email = 'ana@exemplo.com',
  password = 'uma-senha-boa',
}: { name?: string; email?: string; password?: string } = {}) {
  await userEvent.type(screen.getByLabelText('Nome completo'), name);
  await userEvent.type(screen.getByLabelText('E-mail'), email);
  await userEvent.type(screen.getByLabelText('Senha'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
}

function signUpSucceeds() {
  server.use(
    api.mutation('SignUp', () =>
      ok({ signUp: { token: 'novo-token', user: aUser } }),
    ),
    api.query('Me', () => ok({ me: aUser })),
  );
}

describe('SignUpPage', () => {
  it('creates the account, signs in and lands on the dashboard', async () => {
    signUpSucceeds();

    renderWithProviders(<AppRoutes />, { route: '/signup' });
    await fillAndSubmit();

    // frontend.md section 5: the user is signed in immediately rather than
    // being sent back to the login form.
    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
  });

  it('stores the token in sessionStorage', async () => {
    signUpSucceeds();

    renderWithProviders(<AppRoutes />, { route: '/signup' });
    await fillAndSubmit();

    // This form has no "Lembrar-me" and the design does not draw one, so a
    // brand new account does not get a token that survives the browser
    // closing — a decision its owner never made.
    await waitFor(() =>
      expect(sessionStorage.getItem('financy.token')).toBe('novo-token'),
    );
    expect(localStorage.getItem('financy.token')).toBeNull();
  });

  it('renders EMAIL_ALREADY_EXISTS on the email field', async () => {
    server.use(
      api.mutation('SignUp', () =>
        graphqlError('EMAIL_ALREADY_EXISTS', 'Este e-mail já está em uso'),
      ),
    );

    renderWithProviders(<AppRoutes />, { route: '/signup' });
    await fillAndSubmit();

    // The opposite of login on purpose: at sign-up the address is being
    // claimed, so naming it is the only useful thing to say and reveals
    // nothing the user did not just assert.
    await waitFor(() =>
      expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription(
        'Este e-mail já está em uso',
      ),
    );
  });

  it('shows the password rule before anything is typed', () => {
    renderWithProviders(<AppRoutes />, { route: '/signup' });

    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription(
      'A senha deve ter no mínimo 8 caracteres',
    );
  });

  it('rejects a seven-character password without sending anything', async () => {
    // No SignUp handler. onUnhandledRequest is 'error', so a request here
    // fails the test — which is the assertion.
    renderWithProviders(<AppRoutes />, { route: '/signup' });
    await fillAndSubmit({ password: '1234567' });

    expect(
      await screen.findByText('A senha deve ter no mínimo 8 caracteres'),
    ).toBeInTheDocument();
  });

  it('rejects a name over 100 characters', async () => {
    renderWithProviders(<AppRoutes />, { route: '/signup' });
    await fillAndSubmit({ name: 'a'.repeat(101) });

    expect(
      await screen.findByText('O nome deve ter no máximo 100 caracteres'),
    ).toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      api.mutation('SignUp', async () => {
        await held;
        return ok({ signUp: { token: 'novo-token', user: aUser } });
      }),
      api.query('Me', () => ok({ me: aUser })),
    );

    renderWithProviders(<AppRoutes />, { route: '/signup' });
    await fillAndSubmit();

    expect(
      await screen.findByRole('button', { name: 'Criar conta' }),
    ).toBeDisabled();

    // Released and then awaited to completion. Left in flight, the mutation
    // resolves after this test ends and writes its token after the global
    // afterEach has cleared storage — a session leaking into the next test.
    release();
    await screen.findByRole('heading', { name: 'Dashboard' });
  });

  it('links back to the login screen', async () => {
    renderWithProviders(<AppRoutes />, { route: '/signup' });
    await userEvent.click(screen.getByRole('link', { name: 'Fazer login' }));

    expect(
      screen.getByRole('heading', { name: 'Fazer login' }),
    ).toBeInTheDocument();
  });
});
