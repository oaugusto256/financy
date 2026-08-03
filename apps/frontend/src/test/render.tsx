import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '@/features/auth/SessionContext';

interface Options {
  route?: string;
}

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      // No retries in tests: a mocked error would otherwise be requested three
      // more times before the assertion sees it, and every error test would
      // need a timeout instead of an assertion.
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[options.route ?? '/']}>
          <SessionProvider>{children}</SessionProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper }) };
}
