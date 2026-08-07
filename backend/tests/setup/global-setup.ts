import { execFileSync } from 'node:child_process';

const TEST_DATABASE_URL = 'file:./test.db';

export default function setup() {
  // vitest.config.ts's `env` block reaches test files, not this module — it is
  // loaded by the runner before that environment exists. Passing the URL here
  // explicitly is what keeps `migrate deploy` off dev.db.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
}
