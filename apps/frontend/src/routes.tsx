import { Route, Routes } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { PageShell } from '@/components/layout/PageShell';
import { StyleGuide } from '@/pages/StyleGuide';

// Placeholders that slices 1 through 5 replace, each named for the page it
// will become.
function Placeholder({ title }: { title: string }) {
  return (
    <>
      <TopBar userName="Conta teste" />
      <PageShell title={title} subtitle="Em construção">
        <p className="text-sm text-gray-500">
          Esta página chega em uma fatia futura.
        </p>
      </PageShell>
    </>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder title="Dashboard" />} />
      <Route
        path="/transactions"
        element={<Placeholder title="Transações" />}
      />
      <Route path="/categories" element={<Placeholder title="Categorias" />} />
      <Route path="/profile" element={<Placeholder title="Perfil" />} />
      <Route path="/style-guide" element={<StyleGuide />} />
      <Route path="*" element={<Placeholder title="Página não encontrada" />} />
    </Routes>
  );
}
