import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // src/lib/env.ts parses import.meta.env at module load, which Vite fills
    // from frontend/.env — a gitignored file. Declaring the value here
    // keeps the suite green on a fresh clone, where that file does not exist.
    //
    // TZ is pinned here (in addition to the npm scripts) so it holds
    // regardless of how vitest is invoked: dates in this app are stored as
    // local-midnight instants, which round-trip correctly only against a
    // fixed zone. Without it a local-midnight instant formats as the
    // previous day in UTC.
    env: {
      VITE_BACKEND_URL: 'http://localhost:4000/graphql',
      TZ: 'America/Sao_Paulo',
    },
  },
});
