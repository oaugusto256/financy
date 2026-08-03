import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './routes';
import { SessionProvider } from './features/auth/SessionContext';

const queryClient = new QueryClient({
  defaultOptions: {
    // refetchOnWindowFocus is off: a background refetch every time the user
    // alts back to the browser is noise for data that only changes when they
    // change it.
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <AppRoutes />
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
