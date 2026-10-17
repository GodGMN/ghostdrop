import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, upload } from './helpers.js';
import { loadConfig } from '../apps/backend/src/config.js';

const start = (base, size) =>
  fetch(`${base}/api/uploads/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'reserved.bin', size }),
  });

test('the storage limit counts stored files and unfinished uploads', async (t) => {
  const { base, store } = await fixture(t, { maxTotalBytes: 100 });
  assert.equal((await upload(base, { content: 'x'.repeat(60) })).status, 201);
  const reserved = await start(base, 30);
  assert.equal(reserved.status, 201);
  const refused = await start(base, 11);
  assert.equal(refused.status, 507);
  assert.match((await refused.json()).error, /out of upload space/);
  assert.equal((await start(base, 10)).status, 201);
  const { id, token } = await reserved.json();
  await fetch(`${base}/api/uploads/sessions/${id}`, {
    method: 'DELETE',
    headers: { 'X-Upload-Token': token },
  });
  assert.equal((await start(base, 30)).status, 201);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM files').get().n, 1);
});

test('concurrent uploads cannot jointly exceed the storage limit', async (t) => {
  const { base } = await fixture(t, { maxTotalBytes: 100 });
  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      fetch(`${base}/api/uploads/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'race.bin', size: 40, password: 'slow-hash' }),
      }),
    ),
  );
  const statuses = responses.map((response) => response.status).sort();
  assert.deepEqual(statuses, [201, 201, 507, 507, 507]);
});

test('without a storage limit uploads are bounded only per file', async (t) => {
  const { base } = await fixture(t);
  assert.equal((await start(base, 50 * 1024 * 1024)).status, 201);
  assert.equal(loadConfig({}).maxTotalBytes, 0);
  assert.equal(loadConfig({ MAX_TOTAL_BYTES: '1073741824' }).maxTotalBytes, 1073741824);
  assert.throws(() => loadConfig({ MAX_TOTAL_BYTES: '-5' }));
});
