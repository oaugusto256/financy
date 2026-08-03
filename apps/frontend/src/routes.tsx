import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAnonymous } from '@/components/layout/RequireAnonymous';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { PageShell } from '@/components/layout/PageShell';
import { StyleGuide } from '@/pages/StyleGuide';
import { AuthLayout } from '@/features/auth/AuthLayout';
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

// The login and sign up screens arrive in the next two tasks. This stands in
// for them so the module graph stays loadable meanwhile — it deliberately does
// not render either screen's heading, so routes.test.tsx fails on the two
// assertions that are genuinely unmet rather than on a missing import.
function AuthPlaceholder() {
  return (
    <AuthLayout>
      <p className="text-sm text-gray-500">Em construção</p>
    </AuthLayout>
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

  if (!token) return <AuthPlaceholder />;

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
          <Route
            path="/categories"
            element={<Placeholder title="Categorias" />}
          />
          <Route path="/profile" element={<Placeholder title="Perfil" />} />
        </Route>
      </Route>

      <Route element={<RequireAnonymous />}>
        <Route path="/signup" element={<AuthPlaceholder />} />
      </Route>

      <Route path="/style-guide" element={<StyleGuide />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
