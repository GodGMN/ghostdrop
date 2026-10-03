import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../apps/backend/src/store.js';
import { loadConfig } from '../apps/backend/src/config.js';

test('file records persist when the store reopens', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ghostdrop-'));
  try {
    const { db } = openStore(dir);
    db.prepare(
      'INSERT INTO files(id,name,mime,size,sha256,created_at,expires_at,delete_hash) VALUES(?,?,?,?,?,?,?,?)',
    ).run('test', 'hello.txt', 'text/plain', 5, 'hash', Date.now(), Date.now() + 1000, 'delete');
    db.close();
    const reopened = openStore(dir);
    assert.equal(
      reopened.db.prepare('SELECT name FROM files WHERE id = ?').get('test').name,
      'hello.txt',
    );
    reopened.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('configuration rejects invalid sizes and public origins', () => {
  assert.throws(() => loadConfig({ MAX_FILE_BYTES: '-1' }));
  assert.throws(() => loadConfig({ PUBLIC_ORIGIN: 'https://example.com/path' }));
  assert.equal(loadConfig({}).maxFileBytes, 104857600);
});
