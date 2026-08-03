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
    // from apps/frontend/.env — a gitignored file. Declaring the value here
    // keeps the suite green on a fresh clone, where that file does not exist.
    env: {
      VITE_BACKEND_URL: 'http://localhost:4000/graphql',
    },
  },
});
