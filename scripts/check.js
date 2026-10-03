import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

for (const directory of [
  'apps/backend/src',
  'apps/backend/scripts',
  'apps/frontend',
  'apps/frontend/public',
  'scripts',
  'test',
]) {
  for (const name of await readdir(directory)) {
    if (!name.endsWith('.js')) continue;
    const result = spawnSync(process.execPath, ['--check', join(directory, name)], {
      stdio: 'inherit',
    });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
console.log('All JavaScript syntax checks passed.');
