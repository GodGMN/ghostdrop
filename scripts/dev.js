import { spawn } from 'node:child_process';

const frontendPort = process.env.FRONTEND_PORT || process.env.PORT || '3000';
const backendPort = process.env.BACKEND_PORT || String(Number(frontendPort) + 1);
const watch = process.env.npm_lifecycle_event === 'dev';
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
}

for (const [entry, env] of [
  ['apps/backend/src/server.js', { PORT: backendPort }],
  [
    'apps/frontend/server.js',
    {
      FRONTEND_PORT: frontendPort,
      BACKEND_URL: `http://127.0.0.1:${backendPort}`,
    },
  ],
]) {
  const child = spawn(process.execPath, [...(watch ? ['--watch'] : []), entry], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  children.push(child);
  child.on('error', () => stop(1));
  child.on('exit', (code) => stop(code || 0));
}

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop());
