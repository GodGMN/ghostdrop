import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, upload } from './helpers.js';
import { openStore } from '../apps/backend/src/store.js';
import { hashPassword } from '../apps/backend/src/security.js';

test('metrics token is read-only, required, and optional', async (t) => {
  const disabled = await fixture(t, { metricsToken: '' });
  assert.equal((await fetch(`${disabled.base}/api/metrics`)).status, 404);
  const { base } = await fixture(t, {
    metricsToken: 'metrics-secret',
    adminPasswordHash: await hashPassword('admin-password'),
  });
  for (const authorization of ['', 'Bearer wrong', 'Basic metrics-secret'])
    assert.equal((await fetch(`${base}/api/metrics`, { headers: { authorization } })).status, 401);
  const headers = { authorization: 'Bearer metrics-secret' };
  const empty = await (await fetch(`${base}/api/metrics`, { headers })).json();
  assert.equal(empty.daily.length, 30);
  assert.equal(empty.totals.lastActivityAt, null);
  for (const days of ['0', '367', '1.5', 'abc', '1&days=2'])
    assert.equal((await fetch(`${base}/api/metrics?days=${days}`, { headers })).status, 400);
  assert.equal((await fetch(`${base}/api/admin/stats`, { headers })).status, 401);
});

test('usage survives deletion and reopening, excludes previews, failures and admin downloads', async (t) => {
  const { base, store } = await fixture(t, {
    metricsToken: 'metrics-secret',
    adminPasswordHash: await hashPassword('admin-password'),
  });
  const headers = { authorization: 'Bearer metrics-secret' };
  const metrics = async () => (await fetch(`${base}/api/metrics?days=2`, { headers })).json();
  const file = await (await upload(base, { content: 'hello' })).json();
  const path = `${base}/api/files/${file.id}`;
  assert.equal(await (await fetch(`${path}/preview`)).text(), 'hello');
  assert.equal((await fetch(`${path}/download`, { method: 'HEAD' })).status, 405);
  assert.equal((await fetch(`${path}/download`, { headers: { Range: 'bytes=0-1' } })).status, 416);
  const login = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin-password' }),
  });
  const { csrf } = await login.json();
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal(
    await (
      await fetch(`${base}/api/admin/files/${file.id}/download`, { headers: { Cookie: cookie } })
    ).text(),
    'hello',
  );
  assert.equal((await metrics()).totals.downloads, 0);
  assert.equal(await (await fetch(`${path}/download`)).text(), 'hello');
  const one = await (await upload(base, { content: 'once', oneTime: true })).json();
  assert.equal(await (await fetch(`${base}/api/files/${one.id}/download`)).text(), 'once');
  assert.equal((await fetch(`${base}/api/files/${one.id}/download`)).status, 404);
  // Content-Length lets the client finish reading before the server emits finish.
  for (let attempt = 0; attempt < 100 && (await metrics()).totals.downloads < 2; attempt++)
    await setTimeout(10);
  const before = await metrics();
  assert.deepEqual(before.current, { activeFiles: 1, storedBytes: 5 });
  assert.equal(before.totals.uploads, 2);
  assert.equal(before.totals.uploadedBytes, 9);
  assert.equal(before.totals.downloads, 2);
  assert.equal(before.totals.downloadedBytes, 9);
  assert.ok(before.totals.lastActivityAt >= before.trackedSince);
  assert.equal(before.daily.at(-1).downloads, 2);
  await fetch(`${base}/api/admin/files/${file.id}`, {
    method: 'DELETE',
    headers: { Cookie: cookie, 'X-CSRF-Token': csrf },
  });
  const after = await metrics();
  assert.deepEqual(after.current, { activeFiles: 0, storedBytes: 0 });
  assert.deepEqual(after.totals, before.totals);
  const reopened = openStore(store.dataDir);
  assert.equal(
    reopened.db.prepare('SELECT sum(downloads) AS count FROM usage_daily').get().count,
    2,
  );
  assert.equal(
    reopened.db.prepare('SELECT started_at FROM usage_tracking').get().started_at,
    before.trackedSince,
  );
  reopened.db.close();
});

test('concurrent downloads count independently; interrupted transfers and expired files do not', async (t) => {
  const { base, store } = await fixture(t, { metricsToken: 'secret' });
  const metrics = async () =>
    (await fetch(`${base}/api/metrics`, { headers: { authorization: 'Bearer secret' } })).json();
  const file = await (await upload(base, { content: 'abc' })).json();
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      assert.equal(await (await fetch(`${base}/api/files/${file.id}/download`)).text(), 'abc');
    }),
  );
  for (let attempt = 0; attempt < 100 && (await metrics()).totals.downloads < 5; attempt++)
    await setTimeout(10);
  assert.equal((await metrics()).totals.downloads, 5);
  const large = await (await upload(base, { content: Buffer.alloc(16 * 1024 * 1024, 120) })).json();
  const transfer = await fetch(`${base}/api/files/${large.id}/download`);
  const reader = transfer.body.getReader();
  await reader.read();
  await reader.cancel();
  store.db.prepare('UPDATE files SET expires_at = 0').run();
  assert.equal((await fetch(`${base}/api/files/${file.id}/download`)).status, 410);
  const result = await metrics();
  assert.equal(result.totals.downloads, 5);
  assert.equal(result.totals.downloadedBytes, 15);
  assert.deepEqual(result.current, { activeFiles: 0, storedBytes: 0 });
});
