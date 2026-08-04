import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAnonymous } from '@/components/layout/RequireAnonymous';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { PageShell } from '@/components/layout/PageShell';
import { StyleGuide } from '@/pages/StyleGuide';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { CategoriesPage } from '@/features/categories/CategoriesPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { useSession } from '@/features/auth/useSession';

// Placeholders that slices 2 through 5 replace, each named for the page it
// will become.
function Placeholder({ title }: { title: string }) {
  return (
    <PageShell title={title} subtitle="Em construção">
      <p className="text-sm text-gray-500">
        Esta página chega em uma fatia futura.
      </p>
    </PageShell>
  );
}

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
      <Placeholder title="Dashboard" />
    </AppLayout>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route
            path="/transactions"
            element={<Placeholder title="Transações" />}
          />
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
