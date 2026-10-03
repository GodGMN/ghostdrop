import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, utimesSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { createApp } from '../apps/backend/src/app.js';
import { loadConfig } from '../apps/backend/src/config.js';
import { upload } from './helpers.js';

test('restart preserves files and passwords and recovers interrupted deletions', async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ghostdrop-restart-'));
  let runtime, server;
  async function start() {
    runtime = createApp({ ...loadConfig(), dataDir });
    await runtime.ready;
    server = runtime.app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    await runtime.close();
  }
  t.after(async () => {
    await stop();
    rmSync(dataDir, { recursive: true, force: true });
  });
  let base = await start();
  const saved = await (await upload(base, { password: 'persisted-password' })).json();
  const pending = await (await upload(base)).json();
  runtime.store.db.prepare("UPDATE files SET state = 'deleting' WHERE id = ?").run(pending.id);
  const orphan = join(runtime.store.filesDir, 'orphan');
  writeFileSync(orphan, 'orphan');
  const partial = join(runtime.store.partialDir, 'old-partial');
  writeFileSync(partial, 'unfinished');
  utimesSync(partial, 0, 0);
  await stop();
  base = await start();
  assert.equal(existsSync(join(runtime.store.filesDir, pending.id)), false);
  assert.equal(existsSync(orphan), false);
  assert.equal(existsSync(partial), false);
  assert.equal((await fetch(`${base}/api/files/${saved.id}/download`)).status, 401);
  const response = await fetch(`${base}/api/files/${saved.id}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"password":"persisted-password"}',
  });
  assert.equal(response.status, 200);
  const download = await fetch(`${base}/api/files/${saved.id}/download`, {
    headers: { Cookie: response.headers.get('set-cookie').split(';')[0] },
  });
  assert.equal(download.status, 200);
  assert.equal(await download.text(), 'hello from ghostdrop');
});
