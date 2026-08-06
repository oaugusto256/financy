import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { api, aUser, graphqlError, ok } from '@/test/msw/api';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { writeToken } from '@/lib/token-storage';
import { AppRoutes } from '@/routes';

beforeEach(() => {
  writeToken('token', true);
  server.use(api.query('Me', () => ok({ me: aUser })));
});

function renderProfile() {
  return renderWithProviders(<AppRoutes />, { route: '/profile' });
}

async function save() {
  await userEvent.click(
    screen.getByRole('button', { name: 'Salvar alterações' }),
  );
}

describe('ProfilePage', () => {
  it('prefills the name from me', async () => {
    renderProfile();

    expect(await screen.findByLabelText('Nome completo')).toHaveValue(
      'Ana Souza',
    );
  });

  it('shows the email as a disabled field that cannot be changed', async () => {
    renderProfile();

    const email = await screen.findByLabelText('E-mail');
    expect(email).toHaveValue('ana@exemplo.com');
    expect(email).toBeDisabled();
    expect(email).toHaveAccessibleDescription('O e-mail não pode ser alterado');
  });

  it('saves the name and refreshes it in the top bar', async () => {
    const renamed = { ...aUser, name: 'Ana Silva' };
    server.use(
      api.mutation('UpdateProfile', () => ok({ updateProfile: renamed })),
    );

    renderProfile();
    const name = await screen.findByLabelText('Nome completo');
    await userEvent.clear(name);
    await userEvent.type(name, 'Ana Silva');

    // The Me handler answers with the new name from here on, so the top bar
    // updating is the observable proof that the query was invalidated rather
    // than only the form state changing.
    server.use(api.query('Me', () => ok({ me: renamed })));
    await save();

    expect(
      await screen.findByRole('link', { name: 'Perfil de Ana Silva' }),
    ).toBeInTheDocument();
  });

  it('renders a server field error on the name field', async () => {
    server.use(
      api.mutation('UpdateProfile', () =>
        graphqlError('BAD_USER_INPUT', 'O nome é obrigatório', {
          name: ['O nome é obrigatório'],
        }),
      ),
    );

    renderProfile();
    await screen.findByLabelText('Nome completo');
    await save();

    await waitFor(() =>
      expect(
        screen.getByLabelText('Nome completo'),
      ).toHaveAccessibleDescription('O nome é obrigatório'),
    );
  });

  it('rejects an empty name without sending anything', async () => {
    // No UpdateProfile handler. onUnhandledRequest is 'error', so a request
    // here fails the test — which is the assertion.
    renderProfile();
    await userEvent.clear(await screen.findByLabelText('Nome completo'));
    await save();

    expect(await screen.findByText('Informe seu nome')).toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      api.mutation('UpdateProfile', async () => {
        await held;
        return ok({ updateProfile: aUser });
      }),
    );

    renderProfile();
    await screen.findByLabelText('Nome completo');
    await save();

    expect(
      await screen.findByRole('button', { name: 'Salvar alterações' }),
    ).toBeDisabled();

    release();
    expect(await screen.findByText('Alterações salvas')).toBeInTheDocument();
  });

  it('renders a skeleton while me is loading', () => {
    renderProfile();

    // A form that starts empty and then fills in loses whatever the user typed
    // in between. frontend.md section 10 requires the loading state.
    // role="status" is the mechanism a screen reader actually announces —
    // Skeleton's docstring calls out aria-label alone on a plain element as
    // not reliably exposed.
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome completo')).not.toBeInTheDocument();
  });

  it('signs out, empties the cache and lands on the login screen', async () => {
    const { queryClient } = renderProfile();
    await screen.findByLabelText('Nome completo');

    await userEvent.click(
      screen.getByRole('button', { name: 'Sair da conta' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Fazer login' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem('financy.token')).toBeNull();
    expect(sessionStorage.getItem('financy.token')).toBeNull();
    // Without this the next user on the same browser sees the previous user's
    // data render from cache. frontend.md section 5.
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .filter((query) => query.state.data !== undefined),
    ).toHaveLength(0);
  });
});
