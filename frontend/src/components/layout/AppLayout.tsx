import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { useSession } from '@/features/auth/useSession';

export function AppLayout({ children }: { children?: ReactNode }) {
  const { user } = useSession();

  return (
    <>
      <TopBar userName={user?.name ?? ''} />
      {/* An <Outlet /> when used as a layout route, explicit children when the
          root route renders it directly — `/` cannot be a layout route,
          because it is the one path that serves two different screens. */}
      {children ?? <Outlet />}
    </>
  );
}
