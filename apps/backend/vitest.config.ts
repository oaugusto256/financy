import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Later slices share one SQLite test database. Parallel files would reset
    // it under each other.
    fileParallelism: false,
    globalSetup: ['./tests/setup/global-setup.ts'],
    // src/shared/env.ts parses process.env at module load, so importing
    // anything that touches it needs a valid environment. Declaring it here
    // rather than reading apps/backend/.env keeps the suite runnable on a
    // fresh clone, where that file does not exist yet.
    env: {
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'test-secret',
      PORT: '4000',
      CORS_ORIGIN: 'http://localhost:5173',
      NODE_ENV: 'test',
    },
  },
});
