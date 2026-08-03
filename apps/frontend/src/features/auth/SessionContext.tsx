import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clearToken, readToken, writeToken } from '@/lib/token-storage';
import { setAuthToken } from '@/lib/graphql-client';
import { onUnauthenticated } from '@/lib/unauthenticated';
import { useMeQuery } from '@/graphql/generated/graphql';
import { SessionContext, type Session, type SessionUser } from './useSession';

export type { Session, SessionUser };

export function SessionProvider({ children }: { children: ReactNode }) {
  // Read synchronously on the first render. An effect would mean one render
  // with no token, which is one render of the login screen for a signed-in
  // user reloading the page.
  const [token, setToken] = useState<string | null>(() => {
    const stored = readToken();
    setAuthToken(stored);
    return stored;
  });

  const queryClient = useQueryClient();

  const meQuery = useMeQuery(undefined, {
    enabled: token !== null,
    // The current user only changes when this application changes it, and
    // updateProfile invalidates this key when it does. Without this, signIn's
    // seeded payload is stale the moment it lands and the query refetches it —
    // the round trip seeding exists to avoid.
    staleTime: Infinity,
  });

  const signOut = useCallback(() => {
    clearToken();
    setAuthToken(null);
    setToken(null);
    // clear(), not invalidateQueries(): the next user on this browser must not
    // see the previous one's data render from cache while their own loads.
    queryClient.clear();
  }, [queryClient]);

  // Every UNAUTHENTICATED response, from any operation in any slice. This is
  // what turns a tab left open past the seventh day into the login screen
  // rather than a shell whose every panel fails.
  useEffect(
    () =>
      onUnauthenticated(() => {
        // The guard stops a redundant signOut — and the cache clear it
        // carries — from running when there was no session to begin with.
        if (readToken()) signOut();
      }),
    [signOut],
  );

  // Kept for the one case the notifier does not cover: NOT_FOUND, returned
  // when a valid token names a user who has been deleted. That is also a dead
  // session.
  useEffect(() => {
    if (!meQuery.isError || !token) return;

    // Deferred to a microtask rather than called in the effect body: signOut
    // sets state, and setting state synchronously inside an effect cascades an
    // extra render pass.
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) signOut();
    });

    return () => {
      cancelled = true;
    };
  }, [meQuery.isError, token, signOut]);

  const signIn = useCallback(
    (nextToken: string, user: SessionUser, remember: boolean) => {
      writeToken(nextToken, remember);
      setAuthToken(nextToken);
      setToken(nextToken);
      // Every auth operation selects the same User fields, so the payload the
      // mutation already returned is a complete Me result. Seeding it avoids a
      // round trip and keeps one source of truth for the current user.
      queryClient.setQueryData(useMeQuery.getKey(), { me: user });
    },
    [queryClient],
  );

  const value = useMemo<Session>(
    () => ({
      token,
      user: meQuery.data?.me ?? null,
      isLoadingUser: token !== null && meQuery.isPending,
      signIn,
      signOut,
    }),
    [token, meQuery.data, meQuery.isPending, signIn, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
