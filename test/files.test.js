import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { fixture, upload } from './helpers.js';

test('an interrupted accepted one-time transfer stays deleted', async (t) => {
  const { base, store } = await fixture(t);
  const file = await (
    await upload(base, { oneTime: true, content: Buffer.alloc(8 * 1024 * 1024, 120) })
  ).json();
  const response = await fetch(`${base}/api/files/${file.id}/download`);
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  await reader.read();
  await reader.cancel();
  assert.equal(existsSync(join(store.filesDir, file.id)), false);
  assert.equal((await fetch(`${base}/api/files/${file.id}/download`)).status, 404);
});

test('password protection guards download and preview, including direct byte URLs', async (t) => {
  const { base } = await fixture(t);
  const file = await (await upload(base, { password: 'secret' })).json();
  const url = `${base}/api/files/${file.id}`;
  assert.equal((await (await fetch(url)).json()).locked, true);
  for (const endpoint of ['download', 'preview'])
    assert.equal((await fetch(`${url}/${endpoint}`)).status, 401);
  const wrong = await fetch(`${url}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong' }),
  });
  assert.equal(wrong.status, 401);
  const unlocked = await fetch(`${url}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'secret' }),
  });
  assert.equal(unlocked.status, 200);
  const cookie = unlocked.headers.get('set-cookie').split(';')[0];
  assert.match(unlocked.headers.get('set-cookie'), /HttpOnly/);
  const download = await fetch(`${url}/download`, { headers: { Cookie: cookie } });
  assert.equal(download.status, 200);
  assert.equal(await download.text(), 'hello from ghostdrop');
  assert.equal((await fetch(`${url}/preview`, { headers: { Cookie: cookie } })).status, 400);
  assert.equal(
    (await (await fetch(url, { headers: { Cookie: cookie } })).json()).previewAvailable,
    false,
  );
  assert.equal((await fetch(`${url}/download`)).status, 401);
});
test('legacy preview pages redirect to the default sharing page', async (t) => {
  const { base } = await fixture(t);
  const file = await (await upload(base)).json();
  const response = await fetch(`${base}/f/${file.id}/preview`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), `/f/${file.id}`);
});
test('password guesses are rate limited', async (t) => {
  const { base } = await fixture(t);
  const file = await (await upload(base, { password: 'secret' })).json();
  let response;
  for (let i = 0; i < 9; i++)
    response = await fetch(`${base}/api/files/${file.id}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });
  assert.equal(response.status, 429);
});
test('one-time download is claimed once under concurrent requests and physically deleted', async (t) => {
  const { base, store } = await fixture(t);
  const file = await (await upload(base, { oneTime: true })).json();
  const url = `${base}/api/files/${file.id}/download`;
  const responses = await Promise.all(Array.from({ length: 8 }, () => fetch(url)));
  assert.equal(responses.filter((r) => r.status === 200).length, 1);
  assert.equal(responses.filter((r) => r.status === 404).length, 7);
  assert.equal(await responses.find((r) => r.status === 200).text(), 'hello from ghostdrop');
  assert.equal(existsSync(join(store.filesDir, file.id)), false);
  assert.equal(store.db.prepare('SELECT * FROM files WHERE id = ?').get(file.id), undefined);
});
test('metadata, previews, HEAD and ranges do not consume one-time files', async (t) => {
  const { base } = await fixture(t);
  const file = await (await upload(base, { oneTime: true })).json();
  const url = `${base}/api/files/${file.id}`;
  assert.equal((await fetch(url)).status, 200);
  assert.equal((await fetch(`${url}/preview`)).status, 400);
  assert.equal((await fetch(`${url}/download`, { method: 'HEAD' })).status, 405);
  assert.equal((await fetch(`${url}/download`, { headers: { Range: 'bytes=0-2' } })).status, 416);
  assert.equal((await fetch(`${url}/download`)).status, 200);
});
test('expired files are immediately unavailable and physically removed', async (t) => {
  const { base, store } = await fixture(t);
  const file = await (await upload(base)).json();
  store.db.prepare('UPDATE files SET expires_at = ? WHERE id = ?').run(Date.now() - 1, file.id);
  assert.equal((await fetch(`${base}/api/files/${file.id}/download`)).status, 410);
  assert.equal(existsSync(join(store.filesDir, file.id)), false);
});
test('deletion requires the private token and an explicit mutation', async (t) => {
  const { base, store } = await fixture(t);
  const file = await (await upload(base)).json();
  assert.equal((await fetch(`${base}/delete/${file.id}`)).status, 200);
  assert.equal(existsSync(join(store.filesDir, file.id)), true);
  const url = `${base}/api/files/${file.id}`;
  assert.equal(
    (
      await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: '{"token":"incorrect"}',
      })
    ).status,
    403,
  );
  const options = {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: file.deletionToken }),
  };
  assert.equal((await fetch(`${url}/delete-info`, { ...options, method: 'POST' })).status, 200);
  assert.equal(existsSync(join(store.filesDir, file.id)), true);
  assert.equal((await fetch(url, { ...options, method: 'DELETE' })).status, 200);
  assert.equal(existsSync(join(store.filesDir, file.id)), false);
});
test('cleanup removes expired files, pending deletions, old partials and orphan bytes', async (t) => {
  const { base, store, runCleanup } = await fixture(t);
  const expired = await (await upload(base)).json();
  const claimed = await (await upload(base)).json();
  store.db.prepare('UPDATE files SET expires_at = 0 WHERE id = ?').run(expired.id);
  store.db.prepare("UPDATE files SET state = 'deleting' WHERE id = ?").run(claimed.id);
  const old = join(store.partialDir, 'old');
  writeFileSync(old, 'partial');
  utimesSync(old, 0, 0);
  const active = join(store.partialDir, 'active');
  writeFileSync(active, 'partial');
  utimesSync(active, 0, 0);
  store.activeUploads.add('active');
  const orphan = join(store.filesDir, 'orphan');
  writeFileSync(orphan, 'orphan');
  const result = await runCleanup();
  assert.equal(result.files, 3);
  assert.equal(result.partials, 1);
  assert.equal(existsSync(old), false);
  assert.equal(existsSync(orphan), false);
  assert.equal(existsSync(active), true);
  store.activeUploads.delete('active');
});
test('uploaded HTML and SVG never receive an inline preview', async (t) => {
  const { base } = await fixture(t);
  for (const name of ['unsafe.html', 'unsafe.svg']) {
    const file = await (await upload(base, { name, content: '<script>alert(1)</script>' })).json();
    assert.equal((await fetch(`${base}/api/files/${file.id}/preview`)).status, 400);
    const response = await fetch(`${base}/api/files/${file.id}/download`);
    assert.equal(response.headers.get('content-type'), 'application/octet-stream');
    assert.match(response.headers.get('content-disposition'), /^attachment/);
  }
});
