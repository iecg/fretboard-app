import { execSync } from 'node:child_process';

try {
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
} catch {
  // Not a git repo or git unavailable — skip hooks setup
}

try {
  execSync('pnpm --filter @fretflow/core run build', { stdio: 'inherit' });
} catch {
  process.exitCode = 1;
}
