import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { createApp } from '../apps/backend/src/app.js';
import { loadConfig } from '../apps/backend/src/config.js';
import { CHUNK_BYTES } from '../apps/backend/src/chunks.js';

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
// Uploads through resumable sessions like the browser does. Returns the first
// failing response, or a 201 response with the receipt, so callers can check
// status and body uniformly.
export async function upload(base, options = {}) {
  const content = Buffer.from(options.content ?? 'hello from ghostdrop');
  const headers = options.headers || {};
  const created = await fetch(`${base}/api/uploads/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      name: options.name || 'hello.txt',
      size: content.length,
      password: options.password || '',
      expiration: options.expiration || 'month',
      oneTime: !!options.oneTime,
    }),
  });
  if (!created.ok) return created;
  const session = await created.json();
  const path = `${base}/api/uploads/sessions/${session.id}`;
  const auth = { ...headers, 'X-Upload-Token': session.token };
  for (let offset = 0; offset < content.length; offset += CHUNK_BYTES) {
    const response = await fetch(`${path}/chunks`, {
      method: 'PUT',
      headers: {
        ...auth,
        'Content-Type': 'application/octet-stream',
        'X-Upload-Offset': String(offset),
      },
      body: content.subarray(offset, offset + CHUNK_BYTES),
    });
    if (!response.ok) return response;
  }
  let response = await fetch(`${path}/complete`, { method: 'POST', headers: auth });
  if (!response.ok) return response;
  let result = await response.json();
  for (let i = 0; result.state !== 'complete' && !result.error && i < 500; i++) {
    await setTimeout(10);
    response = await fetch(path, { headers: auth });
    if (!response.ok) return response;
    result = await response.json();
  }
  if (result.state !== 'complete')
    return new Response(JSON.stringify({ error: result.error || 'Upload did not finish.' }), {
      status: 500,
    });
  return new Response(JSON.stringify(result.file), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}
