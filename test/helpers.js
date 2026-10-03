import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../apps/backend/src/app.js';
import { loadConfig } from '../apps/backend/src/config.js';

export async function fixture(t, overrides = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'ghostdrop-test-'));
  const config = { ...loadConfig(), dataDir, ...overrides };
  const runtime = createApp(config);
  await runtime.ready;
  const server = runtime.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  config.origin = base;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await runtime.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  return { ...runtime, base, config, server };
}
export async function upload(base, options = {}) {
  const body = new FormData();
  body.append('password', options.password || '');
  body.append('expiration', options.expiration || 'month');
  body.append('oneTime', String(options.oneTime || false));
  body.append(
    'file',
    new Blob([options.content ?? 'hello from ghostdrop']),
    options.name || 'hello.txt',
  );
  return fetch(`${base}/api/uploads`, { method: 'POST', body });
}
