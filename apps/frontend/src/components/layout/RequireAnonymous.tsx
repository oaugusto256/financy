import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/features/auth/useSession';

/** Public-only routes. A signed-in user has no use for the sign up form. */
export function RequireAnonymous() {
  const { token } = useSession();
  return token ? <Navigate to="/" replace /> : <Outlet />;
}
