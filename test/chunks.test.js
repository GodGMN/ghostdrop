import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { setTimeout } from 'node:timers/promises';
import { fixture } from './helpers.js';
import { init, chunk, status, complete, headers, path } from './chunk-helpers.js';
import { CHUNK_BYTES } from '../src/chunks.js';
import { token } from '../src/security.js';

test('multiple bounded chunks produce identical bytes and a stable finalization receipt', async (t) => {
  const { base, store } = await fixture(t);
  const content = Buffer.alloc(CHUNK_BYTES * 2 + 123);
  for (let i = 0; i < content.length; i++) content[i] = i % 251;
  const session = await init(base, { size: content.length });
  assert.equal(session.chunkSize, CHUNK_BYTES);
  assert.notEqual(
    store.db.prepare('SELECT token_hash FROM upload_sessions WHERE id = ?').get(session.id)
      .token_hash,
    session.token,
  );
  for (let offset = 0; offset < content.length; offset += CHUNK_BYTES) {
    const end = Math.min(content.length, offset + CHUNK_BYTES);
    const response = await chunk(base, session, offset, content.subarray(offset, end));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).offset, end);
  }
  const file = await complete(base, session);
  assert.deepEqual(readFileSync(join(store.filesDir, file.id)), content);
  assert.equal(
    store.db.prepare('SELECT sha256 FROM files WHERE id = ?').get(file.id).sha256,
    createHash('sha256').update(content).digest('hex'),
  );
  assert.deepEqual(await complete(base, session), file);
  assert.equal((await (await status(base, session)).json()).file.deletionToken, file.deletionToken);
  const deleted = await fetch(`${base}/api/files/${file.id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: file.deletionToken }),
  });
  assert.equal(deleted.status, 200);
});
test('initialization is idempotent with client credentials and rejects changed settings', async (t) => {
  const { base, store } = await fixture(t);
  const credentials = { id: token(), token: token() };
  const session = await init(base, { ...credentials, password: 'secret' });
  const request = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'large.bin', size: 16, password: 'secret', ...credentials }),
  };
  const replay = await fetch(`${base}/api/uploads/sessions`, request);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).id, session.id);
  const changed = await fetch(`${base}/api/uploads/sessions`, {
    ...request,
    body: JSON.stringify({ name: 'different.bin', size: 16, ...credentials }),
  });
  assert.equal(changed.status, 409);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM upload_sessions').get().n, 1);
});
test('session credentials, sizes, offsets and duplicate bytes are enforced', async (t) => {
  const { base, store } = await fixture(t, { maxFileBytes: CHUNK_BYTES * 2 });
  const session = await init(base);
  assert.equal((await fetch(path(base, session))).status, 404);
  assert.equal((await chunk(base, { ...session, token: token() }, 0, Buffer.alloc(4))).status, 404);
  assert.equal((await chunk(base, session, 1, Buffer.alloc(4))).status, 409);
  assert.equal((await chunk(base, session, 0, Buffer.alloc(CHUNK_BYTES + 1))).status, 413);
  assert.equal((await chunk(base, session, 0, Buffer.alloc(17))).status, 413);
  assert.equal((await chunk(base, session, 0, Buffer.alloc(4, 1))).status, 200);
  assert.equal((await chunk(base, session, 0, Buffer.alloc(4, 1))).status, 200);
  assert.equal((await chunk(base, session, 0, Buffer.alloc(4, 2))).status, 409);
  assert.equal((await chunk(base, session, 2, Buffer.alloc(4, 1))).status, 409);
  assert.equal((await (await status(base, session)).json()).offset, 4);
  assert.deepEqual(readFileSync(join(store.partialDir, session.id)), Buffer.alloc(4, 1));
  assert.equal(
    (await fetch(`${path(base, session)}/complete`, { method: 'POST', headers: headers(session) }))
      .status,
    409,
  );
  const tooLarge = await fetch(`${base}/api/uploads/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'large.bin', size: CHUNK_BYTES * 2 + 1 }),
  });
  assert.equal(tooLarge.status, 413);
});
function heldRequest(base, session) {
  let resolve, reject;
  const response = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  response.catch(() => {});
  const request = http.request(
    `${path(base, session)}/chunks`,
    {
      method: 'PUT',
      headers: {
        ...headers(session),
        'Content-Type': 'application/octet-stream',
        'X-Upload-Offset': '0',
        'Content-Length': '16',
      },
    },
    (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    },
  );
  request.on('error', reject);
  request.write(Buffer.alloc(8, 1));
  return { request, response };
}
async function until(predicate) {
  for (let i = 0; i < 100 && !predicate(); i++) await setTimeout(10);
  assert.ok(predicate());
}
test('concurrent chunks are serialized and interrupted chunks do not advance the offset', async (t) => {
  const { base, store } = await fixture(t);
  const session = await init(base);
  const first = heldRequest(base, session);
  t.after(() => first.request.destroy());
  await until(() => store.uploadOperations.has(session.id));
  assert.equal((await chunk(base, session, 0, Buffer.alloc(16, 1))).status, 409);
  first.request.destroy();
  await until(() => !store.uploadOperations.has(session.id));
  assert.equal((await (await status(base, session)).json()).offset, 0);
  assert.equal(readFileSync(join(store.partialDir, session.id)).length, 0);
  assert.equal((await chunk(base, session, 0, Buffer.alloc(16, 1))).status, 200);
  await complete(base, session);
});
test('cancellation removes an active session and completed bytes', async (t) => {
  const { base, store } = await fixture(t);
  const session = await init(base);
  const first = heldRequest(base, session);
  t.after(() => first.request.destroy());
  await until(() => store.uploadOperations.has(session.id));
  const cancelled = await fetch(path(base, session), {
    method: 'DELETE',
    headers: headers(session),
  });
  assert.equal(cancelled.status, 202);
  await until(() => !store.uploadOperations.has(session.id));
  assert.equal(existsSync(join(store.partialDir, session.id)), false);
  assert.equal((await status(base, session)).status, 404);
  const second = await init(base);
  await chunk(base, second, 0, Buffer.alloc(16));
  const file = await complete(base, second);
  assert.equal(
    (await fetch(path(base, second), { method: 'DELETE', headers: headers(second) })).status,
    200,
  );
  assert.equal(existsSync(join(store.filesDir, file.id)), false);
});
test('expired incomplete sessions are deleted, while expired receipts preserve shared files', async (t) => {
  const { base, store, runCleanup } = await fixture(t);
  const unfinished = await init(base);
  const finished = await init(base);
  await chunk(base, finished, 0, Buffer.alloc(16));
  const file = await complete(base, finished);
  store.db.prepare('UPDATE upload_sessions SET updated_at = 0').run();
  assert.equal((await status(base, unfinished)).status, 410);
  const result = await runCleanup();
  assert.equal(result.partials, 1);
  assert.equal(existsSync(join(store.partialDir, unfinished.id)), false);
  assert.equal(existsSync(join(store.filesDir, file.id)), true);
  assert.deepEqual(readdirSync(store.partialDir), []);
});
test('zero-byte files finalize without an empty chunk', async (t) => {
  const { base, store } = await fixture(t);
  const session = await init(base, { size: 0 });
  const file = await complete(base, session);
  assert.equal(readFileSync(join(store.filesDir, file.id)).length, 0);
});
