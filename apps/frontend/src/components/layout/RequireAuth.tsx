import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/features/auth/useSession';

/** Private routes. No token means the login screen, which `/` serves. */
export function RequireAuth() {
  const { token } = useSession();
  return token ? <Outlet /> : <Navigate to="/" replace />;
}
