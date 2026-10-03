import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, appendFileSync, renameSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { createApp } from '../apps/backend/src/app.js';
import { loadConfig } from '../apps/backend/src/config.js';
import { init, chunk, status, complete } from './chunk-helpers.js';

test('restart resumes acknowledged bytes, rolls back extra bytes and recovers a renamed finalization', async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ghostdrop-chunk-recovery-'));
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
  const interrupted = await init(base, { password: 'persistent-secret' });
  await chunk(base, interrupted, 0, Buffer.alloc(8, 1));
  appendFileSync(join(runtime.store.partialDir, interrupted.id), Buffer.alloc(4, 2));
  const finalizing = await init(base);
  await chunk(base, finalizing, 0, Buffer.alloc(16, 3));
  runtime.store.db
    .prepare("UPDATE upload_sessions SET state = 'finalizing' WHERE id = ?")
    .run(finalizing.id);
  renameSync(
    join(runtime.store.partialDir, finalizing.id),
    join(runtime.store.filesDir, finalizing.id),
  );
  const finished = await init(base);
  await chunk(base, finished, 0, Buffer.alloc(16, 4));
  const receipt = await complete(base, finished);
  await stop();
  base = await start();
  assert.equal((await (await status(base, interrupted)).json()).offset, 8);
  assert.equal(statSync(join(runtime.store.partialDir, interrupted.id)).size, 8);
  assert.equal((await chunk(base, interrupted, 8, Buffer.alloc(8, 2))).status, 200);
  const resumed = await complete(base, interrupted);
  assert.deepEqual(
    readFileSync(join(runtime.store.filesDir, resumed.id)),
    Buffer.concat([Buffer.alloc(8, 1), Buffer.alloc(8, 2)]),
  );
  assert.equal(resumed.passwordProtected, true);
  assert.equal((await (await status(base, finalizing)).json()).state, 'uploading');
  const recovered = await complete(base, finalizing);
  assert.deepEqual(readFileSync(join(runtime.store.filesDir, recovered.id)), Buffer.alloc(16, 3));
  assert.deepEqual(await complete(base, finished), receipt);
});
