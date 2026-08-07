import { createContext, useContext } from 'react';
import type { MeQuery } from '@/graphql/generated/graphql';

export type SessionUser = MeQuery['me'];

export interface Session {
  token: string | null;
  user: SessionUser | null;
  isLoadingUser: boolean;
  signIn(token: string, user: SessionUser, remember: boolean): void;
  signOut(): void;
}

// The context object lives here rather than beside the provider because
// eslint-plugin-react-refresh warns when a module exports both a component and
// a value, and fast refresh genuinely does break on that.
export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside a SessionProvider');
  }
  return session;
}
