import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAnonymous } from '@/components/layout/RequireAnonymous';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { StyleGuide } from '@/pages/StyleGuide';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { CategoriesPage } from '@/features/categories/CategoriesPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { useSession } from '@/features/auth/useSession';

/**
 * One path, two screens, as the requirements specify. This is the only route
 * that decides for itself rather than sitting behind a guard: declaring `/`
 * twice with opposite guards would make each redirect to the other, and the
 * loop only appears once somebody is actually signed in.
 */
function RootRoute() {
  const { token } = useSession();

  if (!token) return <LoginPage />;

  return (
    <AppLayout>
      <DashboardPage />
    </AppLayout>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route element={<RequireAnonymous />}>
        <Route path="/signup" element={<SignUpPage />} />
      </Route>

      <Route path="/style-guide" element={<StyleGuide />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
