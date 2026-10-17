import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fixture, upload } from './helpers.js';

test('upload streams to private disk with hashed credentials and separate random tokens', async (t) => {
  const { base, store } = await fixture(t);
  const response = await upload(base, { password: 'private', oneTime: true });
  assert.equal(response.status, 201);
  const file = await response.json();
  const record = store.db.prepare('SELECT * FROM files WHERE id = ?').get(file.id);
  assert.equal(readFileSync(join(store.filesDir, file.id), 'utf8'), 'hello from ghostdrop');
  assert.notEqual(record.password_hash, 'private');
  assert.match(record.password_hash, /^scrypt:/);
  assert.equal(file.oneTime, true);
  assert.notEqual(file.id, file.deletionToken);
  assert.notEqual(record.delete_hash, file.deletionToken);
  assert.equal(record.sha256.length, 64);
  assert.equal((await fetch(`${base}/data/files/${file.id}`)).status, 404);
  assert.deepEqual(readdirSync(store.partialDir), []);
});
test('oversized and invalid uploads leave neither file bytes nor records', async (t) => {
  const { base, store } = await fixture(t, { maxFileBytes: 8 });
  assert.equal((await upload(base, { content: 'this is far too long' })).status, 413);
  assert.equal((await upload(base, { content: 'small', expiration: 'forever' })).status, 400);
  assert.deepEqual(readdirSync(store.filesDir), []);
  assert.deepEqual(readdirSync(store.partialDir), []);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM files').get().n, 0);
});
test('cross-site uploads are rejected before a session starts', async (t) => {
  const { base, store } = await fixture(t);
  const response = await upload(base, { headers: { Origin: 'https://unrelated.example' } });
  assert.equal(response.status, 403);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM upload_sessions').get().n, 0);
});
test('the single-request multipart endpoint no longer exists', async (t) => {
  const { base } = await fixture(t);
  const body = new FormData();
  body.append('file', new Blob(['legacy']), 'legacy.txt');
  assert.equal((await fetch(`${base}/api/uploads`, { method: 'POST', body })).status, 404);
});
test('a file exactly at the size limit is accepted', async (t) => {
  const { base } = await fixture(t, { maxFileBytes: 8 });
  assert.equal((await upload(base, { content: '12345678' })).status, 201);
});
