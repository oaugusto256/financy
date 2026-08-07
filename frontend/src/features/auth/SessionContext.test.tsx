import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api, aUser, graphqlError, ok } from '@/test/msw/api';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { readToken, writeToken } from '@/lib/token-storage';
import { useMeQuery } from '@/graphql/generated/graphql';
import { useSession } from './useSession';

function Probe() {
  const { token, user, signIn, signOut } = useSession();

  return (
    <div>
      <p>token: {token ?? 'nenhum'}</p>
      <p>user: {user?.name ?? 'nenhum'}</p>
      <button onClick={() => signIn('novo-token', aUser, true)}>entrar</button>
      <button onClick={signOut}>sair</button>
    </div>
  );
}

describe('SessionContext', () => {
  it('starts with no session when storage is empty', () => {
    renderWithProviders(<Probe />);
    expect(screen.getByText('token: nenhum')).toBeInTheDocument();
  });

  it('hydrates the token from storage on load', async () => {
    writeToken('stored-token', true);
    server.use(api.query('Me', () => ok({ me: aUser })));

    renderWithProviders(<Probe />);

    expect(screen.getByText('token: stored-token')).toBeInTheDocument();
    expect(await screen.findByText('user: Ana Souza')).toBeInTheDocument();
  });

  it('does not fetch the user when there is no token', () => {
    // No Me handler is registered. onUnhandledRequest is 'error', so a request
    // fired here fails the test rather than passing quietly.
    renderWithProviders(<Probe />);
    expect(screen.getByText('user: nenhum')).toBeInTheDocument();
  });

  it('signIn stores the token and seeds the user without a request', async () => {
    renderWithProviders(<Probe />);

    await userEvent.click(screen.getByRole('button', { name: 'entrar' }));

    expect(screen.getByText('token: novo-token')).toBeInTheDocument();
    expect(screen.getByText('user: Ana Souza')).toBeInTheDocument();
    expect(readToken()).toBe('novo-token');
  });

  it('signOut clears the token, the user and the cache', async () => {
    writeToken('stored-token', true);
    server.use(api.query('Me', () => ok({ me: aUser })));

    const { queryClient } = renderWithProviders(<Probe />);
    await screen.findByText('user: Ana Souza');

    await userEvent.click(screen.getByRole('button', { name: 'sair' }));

    expect(readToken()).toBeNull();
    expect(screen.getByText('token: nenhum')).toBeInTheDocument();
    // The cache must be emptied, not just invalidated: without this the next
    // user to sign in on this browser sees the previous one's data render
    // from cache before their own arrives. Asserted as "no entry holds data"
    // rather than "the cache has no entries", because the mounted Me query
    // rebuilds its own empty entry on the render that follows clear().
    expect(screen.getByText('user: nenhum')).toBeInTheDocument();
    expect(queryClient.getQueryData(useMeQuery.getKey())).toBeUndefined();
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .filter((query) => query.state.data !== undefined),
    ).toHaveLength(0);
  });

  it('drops the session when the stored token is rejected', async () => {
    writeToken('expired-token', true);
    server.use(api.query('Me', () => graphqlError('UNAUTHENTICATED')));

    renderWithProviders(<Probe />);

    await waitFor(() => expect(readToken()).toBeNull());
    expect(screen.getByText('token: nenhum')).toBeInTheDocument();
  });
});
