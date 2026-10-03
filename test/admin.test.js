import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { fixture, upload } from './helpers.js';
import { hashPassword } from '../apps/backend/src/security.js';

async function adminFixture(t) {
  const runtime = await fixture(t, { adminPasswordHash: await hashPassword('admin-test') });
  const response = await fetch(`${runtime.base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"password":"admin-test"}',
  });
  const { csrf } = await response.json();
  return {
    ...runtime,
    headers: { Cookie: response.headers.get('set-cookie').split(';')[0], 'X-CSRF-Token': csrf },
  };
}
test('admin file data and mutations require authentication and CSRF', async (t) => {
  const { base, headers } = await adminFixture(t);
  const file = await (await upload(base)).json();
  for (const path of ['files', 'stats', `files/${file.id}/download`])
    assert.equal((await fetch(`${base}/api/admin/${path}`)).status, 401);
  assert.equal(
    (
      await fetch(`${base}/api/admin/files/${file.id}`, {
        method: 'DELETE',
        headers: { Cookie: headers.Cookie },
      })
    ).status,
    403,
  );
});
test('admin searches filename, exact hash and link with pagination and private metadata omitted', async (t) => {
  const { base, store, headers } = await adminFixture(t);
  const first = await (await upload(base, { name: 'first_report.txt', password: 'secret' })).json();
  await upload(base, { name: 'other.txt' });
  const hash = store.db.prepare('SELECT sha256 FROM files WHERE id = ?').get(first.id).sha256;
  for (const [by, search] of [
    ['name', 'first_'],
    ['hash', hash],
    ['link', `${base}/f/${first.id}`],
  ]) {
    const response = await fetch(`${base}/api/admin/files?${new URLSearchParams({ by, search })}`, {
      headers,
    });
    assert.equal(response.status, 200);
    const list = await response.json();
    // Both files have identical bytes, so searching their hash returns both records.
    assert.equal(list.total, by === 'hash' ? 2 : 1);
    assert.equal('password_hash' in list.items[0], false);
    assert.equal('delete_hash' in list.items[0], false);
  }
  const response = await fetch(`${base}/api/admin/files?limit=1&offset=1`, { headers });
  assert.equal((await response.json()).items.length, 1);
  assert.equal(
    (await fetch(`${base}/api/admin/files?by=hash&search=wrong`, { headers })).status,
    400,
  );
  assert.equal((await fetch(`${base}/api/admin/files?offset=-1`, { headers })).status, 400);
});
test('admin stats, download, physical deletion and cleanup', async (t) => {
  const { base, store, headers } = await adminFixture(t);
  const file = await (await upload(base, { password: 'secret' })).json();
  const stats = await (await fetch(`${base}/api/admin/stats`, { headers })).json();
  assert.equal(stats.count, 1);
  assert.equal(stats.storedBytes, file.size);
  const download = await fetch(`${base}/api/admin/files/${file.id}/download`, { headers });
  assert.equal(download.status, 200);
  assert.equal(await download.text(), 'hello from ghostdrop');
  assert.equal(
    (await fetch(`${base}/api/admin/files/${file.id}`, { method: 'DELETE', headers })).status,
    200,
  );
  assert.equal(existsSync(join(store.filesDir, file.id)), false);
  const expired = await (await upload(base)).json();
  store.db.prepare('UPDATE files SET expires_at = 0 WHERE id = ?').run(expired.id);
  const partial = join(store.partialDir, 'old');
  writeFileSync(partial, 'partial');
  utimesSync(partial, 0, 0);
  const result = await (
    await fetch(`${base}/api/admin/cleanup`, { method: 'POST', headers })
  ).json();
  assert.equal(result.files, 1);
  assert.equal(result.partials, 1);
});
